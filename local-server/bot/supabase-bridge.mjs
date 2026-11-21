import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const CACHE_TTL_MS = 15_000;
const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en', 'con', 'por',
  'para', 'sin', 'sobre', 'entre', 'y', 'o', 'ni', 'que', 'quien', 'cual', 'como', 'cuando', 'donde',
  'si', 'no', 'es', 'son', 'ser', 'estar', 'esta', 'este', 'esto', 'ese', 'esa', 'eso', 'se', 'su', 'sus',
  'le', 'les', 'lo', 'me', 'mi', 'te', 'tu', 'nos', 'puede', 'puedo', 'pueden', 'hago', 'pasa', 'hay',
  'mas', 'pero', 'porque', 'ya', 'todo', 'toda', 'todos', 'todas', 'muy', 'bien', 'mal', 'otra', 'otro'
]);

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(s) {
  return normalizeText(s)
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

function expandQueryTokens(query) {
  const tokens = new Set(tokenize(query));
  const norm = normalizeText(query);
  if (/(?:metro|subterran|subte|\bvia\b|\bvias\b)/.test(norm)) {
    for (const w of ['tren', 'riel', 'rieles', 'ferrea', 'vagoneta', 'estacion', 'tunel']) tokens.add(w);
  }
  if (/(?:volar|\balas\b|planeador)/.test(norm)) {
    for (const w of ['elytra', 'cohetes']) tokens.add(w);
  }
  if (/(?:pocion|pociones|alquimia)/.test(norm)) {
    for (const w of ['destileria', 'alquimia', 'blaze', 'verrugas']) tokens.add(w);
  }
  if (/granja/.test(norm)) {
    for (const w of ['granja', 'pistones', 'tolvas', 'observadores', 'hierro']) tokens.add(w);
  }
  // Estructuras: los jugadores las nombran en inglés y las Eras en español
  const STRUCTURES = [
    [/(ancient|ciudad\s+antigua|deep\s*dark|oscuridad|warden|sculk)/, ['ciudad', 'antigua', 'deep', 'dark']],
    [/(trial|camara\s+de\s+prueba|ominos)/, ['trial', 'chamber', 'chambers']],
    [/(fortaleza|fortress|nether\s+fortress)/, ['fortaleza', 'nether']],
    [/(bastion|bastion\s+remnant|piglin)/, ['bastion', 'piglins']],
    [/(mansion|woodland|bosque\s+oscuro)/, ['mansion', 'bosque']],
    [/(monumento|monument|guardian)/, ['monumento', 'oceano']],
    [/(stronghold|portal\s+del\s+end|end\s+city|ciudad\s+del\s+end|elytra|shulker)/, ['end', 'fortaleza', 'elytras']]
  ];
  for (const [re, add] of STRUCTURES) if (re.test(norm)) add.forEach(w => tokens.add(w));
  return [...tokens];
}

export class SupabaseBridge {
  constructor(repoRoot) {
    this.repoRoot = path.resolve(repoRoot);
    this.cfg = null;
    this.D = null;
    this.E = null;
    this.cache = { at: 0, row: null };
    this.writeQueue = Promise.resolve();
    this._loadRepoModules();
  }

  _loadRepoModules() {
    const windowObj = {
      location: { search: '' },
      addEventListener: () => {}
    };
    const ctx = vm.createContext({
      window: windowObj,
      globalThis: windowObj,
      console,
      Date,
      Math,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Set,
      Map,
      RegExp,
      Intl
    });
    for (const file of ['supabase-config.js', 'eras.js', 'data.js', 'engine.js']) {
      const code = fs.readFileSync(path.join(this.repoRoot, file), 'utf8');
      vm.runInContext(code, ctx, { filename: file });
    }
    this.cfg = windowObj.FW_SUPABASE_CONFIG;
    this.D = windowObj.FW_DATA;
    this.E = windowObj.FW_ENGINE;
    if (!this.cfg?.url || !this.cfg?.anonKey) throw new Error('supabase-config.js incompleto.');
    if (!this.D || !this.E) throw new Error('No se pudo cargar FW_DATA o FW_ENGINE.');
    if (typeof this.E.setCategories === 'function') {
      this.E.setCategories(this.D.WORK_CATEGORIES || []);
    }
    this.inflight = null;
  }

  buildLocalFallbackState() {
    const D = this.D;
    const nations = JSON.parse(JSON.stringify(D.DEFAULT_NATIONS));
    const profs = {};
    for (const p of (D.PROFESSIONS || [])) profs[p.id] = p.def;
    const txInit = str => {
      let out = String(str || '');
      const tokens = {
        '{MYTH}': nations.myth.player,
        '{SCAD}': nations.scad.player,
        '{NMYTH}': nations.myth.nation,
        '{NSCAD}': nations.scad.nation,
        '{DR}': nations.myth.symbol,
        '{CU}': nations.scad.symbol,
        '{OE}': D.DEFAULT_BASKET?.symbol || 'OE',
        '{BANK}': D.DEFAULT_BANK_NAME || 'La Gran Cámara del Ender'
      };
      for (const [k, v] of Object.entries(tokens)) out = out.split(k).join(v);
      return out;
    };
    const laws = [
      ...(D.DEFAULT_LAWS || []).map((l, idx) => ({
        id: `loc-ooc-${idx + 1}`,
        kind: 'servidor',
        docType: 'servidor',
        trdCode: '160-01',
        num: idx + 1,
        title: l.title,
        text: txInit(l.text),
        sanction: txInit(l.sanction || ''),
        signs: { myth: true, scad: true },
        repealed: false
      })),
      ...[...(D.DEFAULT_RP_LAWS || []), ...(D.DEFAULT_PENAL_PACK || [])].map((l, idx) => ({
        id: `loc-ic-${idx + 1}`,
        kind: 'rol',
        docType: l.docType || 'ley',
        trdCode: l.trdCode || '100-01',
        num: idx + 1,
        title: l.title,
        text: txInit(l.text),
        sanction: txInit(l.sanction || ''),
        signs: { myth: true, scad: true },
        review: { status: 'none', notes: [] },
        repealed: false
      }))
    ];
    const baseIssue = 100;
    return {
      settings: {
        nations,
        bankName: D.DEFAULT_BANK_NAME,
        basket: JSON.parse(JSON.stringify(D.DEFAULT_BASKET)),
        baseIssue,
        sharesTotal: 100,
        fxInertia: 200,
        bankRate: 10,
        bankCollateralPct: 30,
        bankLiquidityPct: 50
      },
      professions: profs,
      tasks: {},
      guestTasks: {},
      guests: [],
      villagers: [],
      laws,
      economy: {
        holdings: { myth: { M: baseIssue, S: 0 }, scad: { M: 0, S: baseIssue } },
        bank: { M: 0, S: 0 },
        works: [],
        loans: [],
        prices: (D.PRICE_GUIDE || []).map((g, i) => ({
          id: `pg-${i}`,
          seller: g.seller,
          name: g.name,
          unit: g.unit,
          price: g.price
        })),
        shares: { myth: { myth: 100 }, scad: { scad: 100 } },
        ledger: [],
        fxHistory: []
      }
    };
  }

  async fetchWorld(force = false) {
    const now = Date.now();
    if (!force && this.cache.row && (now - this.cache.at) < CACHE_TTL_MS) {
      return this.cache.row;
    }
    // Varias partes del bot piden el mundo a la vez (Aduana, eventos, NPCs): una sola descarga para todas
    if (this.inflight) return this.inflight;
    this.inflight = this._fetchWorldNow(now).finally(() => { this.inflight = null; });
    return this.inflight;
  }

  async _fetchWorldNow(now) {
    try {
      const q = `/rest/v1/fw_worlds?id=eq.${encodeURIComponent(this.cfg.worldId || 'main')}&select=id,rev,updated_at,state`;
      const res = await fetch(`${this.cfg.url}${q}`, {
        headers: {
          apikey: this.cfg.anonKey,
          Authorization: `Bearer ${this.cfg.anonKey}`
        },
        // Sin límite, un Supabase colgado dejaba a la Aduana esperando para siempre
        signal: AbortSignal.timeout(10_000)
      });
      if (!res.ok) {
        throw new Error(`Supabase HTTP ${res.status}: ${await res.text()}`);
      }
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length || !rows[0].state) {
        throw new Error(`Mundo '${this.cfg.worldId}' no encontrado en Supabase.`);
      }
      const out = { ...rows[0], offlineFallback: false };
      this.cache = { at: now, row: out };
      return out;
    } catch (err) {
      if (this.cache.row) {
        console.warn('[Supabase offline] Usando última copia en caché:', err.message);
        return { ...this.cache.row, offlineFallback: true };
      }
      console.warn('[Supabase offline] Usando base local del repositorio:', err.message);
      const fallbackRow = {
        id: 'local-fallback',
        rev: 0,
        updated_at: now,
        state: this.buildLocalFallbackState(),
        offlineFallback: true
      };
      this.cache = { at: now, row: fallbackRow };
      return fallbackRow;
    }
  }

  nat(state, s) {
    return state?.settings?.nations?.[s] || this.D.DEFAULT_NATIONS[s];
  }

  sym(state, cur) {
    if (cur === 'M') return this.nat(state, 'myth').symbol;
    if (cur === 'S') return this.nat(state, 'scad').symbol;
    if (cur === 'U') return state?.settings?.basket?.symbol || 'OE';
    return cur;
  }

  money(state, n, cur) {
    return `${this.E.fmt(n)} ${this.sym(state, cur)}`;
  }

  makeTx(state) {
    const m = this.nat(state, 'myth');
    const s = this.nat(state, 'scad');
    const tokens = {
      '{MYTH}': m.player || 'Mythstorm',
      '{SCAD}': s.player || 'Scadrial',
      '{NMYTH}': m.nation || 'Nueva Alejandría',
      '{NSCAD}': s.nation || 'Luthadel',
      '{DR}': m.symbol || 'DR',
      '{CU}': s.symbol || 'CU',
      '{OE}': state?.settings?.basket?.symbol || 'OE',
      '{BANK}': state?.settings?.bankName || 'La Gran Cámara del Ender'
    };
    return str => {
      let out = String(str || '');
      for (const [k, v] of Object.entries(tokens)) out = out.split(k).join(v);
      return out;
    };
  }

  isTaskDone(state, task) {
    const v = state?.tasks?.[task.id];
    if (task.who === 'ambos') {
      if (v && typeof v === 'object') return Boolean(v.myth && v.scad);
      return Boolean(v);
    }
    return v && typeof v === 'object' ? Boolean(v[task.who]) : Boolean(v);
  }

  getCurrentEra(state) {
    const ERAS = this.D.ERAS || [];
    const tx = this.makeTx(state);
    let idx = ERAS.findIndex(era => {
      const req = (era.tasks || []).filter(t => t.req);
      return req.some(t => !this.isTaskDone(state, t));
    });
    if (idx === -1) idx = Math.max(0, ERAS.length - 1);
    const era = ERAS[idx] || ERAS[0];
    const reqTasks = (era.tasks || []).filter(t => t.req);
    const reqDone = reqTasks.filter(t => this.isTaskDone(state, t)).length;
    return {
      index: idx,
      code: era.code,
      name: tx(era.name),
      focus: tx(era.focus),
      economy: tx(era.economy),
      allowed: (era.allowed || []).map(tx),
      banned: (era.banned || []).map(tx),
      reqDone,
      reqTotal: reqTasks.length
    };
  }

  getPactSummary(state, query = '') {
    const tx = this.makeTx(state);
    const qN = normalizeText(query).trim();
    const mData = this.D.MONOPOLIES || {};
    const rules = (this.D.PACT_RULES || []).map(r => ({ t: tx(r.t), d: tx(r.d) }));
    const profMap = state?.professions || {};
    const profs = (this.D.PROFESSIONS || []).map(p => {
      const owner = profMap[p.id] || p.def;
      return {
        id: p.id,
        name: p.name,
        owner,
        nation: this.nat(state, owner).nation
      };
    });

    const filteredProfs = qN
      ? profs.filter(p => normalizeText(`${p.name} ${p.nation}`).includes(qN))
      : profs;
    const filteredRules = qN
      ? rules.filter(r => normalizeText(`${r.t} ${r.d}`).includes(qN))
      : rules;

    return {
      myth: {
        nation: this.nat(state, 'myth').nation,
        sectors: (mData.myth?.sectors || []).map(s => `${s.name}: ${tx(s.items)}`)
      },
      scad: {
        nation: this.nat(state, 'scad').nation,
        sectors: (mData.scad?.sectors || []).map(s => `${s.name}: ${tx(s.items)}`)
      },
      rules: filteredRules.length ? filteredRules : rules,
      professions: filteredProfs.length ? filteredProfs : profs
    };
  }

  getBriefing(state) {
    const E = this.E;
    const CATS = this.D.WORK_CATEGORIES || [];
    const r = E.rate(state);
    const oeM = E.uiValue(state, 'M');
    const oeS = E.uiValue(state, 'S');
    const pendingWorks = (state.economy?.works || []).filter(w => w.status === 'pendiente').length;
    const laws = state.laws || [];
    const icLaws = laws.filter(l => (l.kind || 'servidor') === 'rol' && !l.repealed);
    const noAvalCount = icLaws.filter(l => !(l.review && l.review.status === 'approved')).length;
    const activeLoans = (state.economy?.loans || []).filter(l => l.status !== 'pagado');
    const moras = activeLoans.filter(l => l.status === 'mora').length;
    const mythEx = E.excess(state, 'M');
    const scadEx = E.excess(state, 'S');
    const era = this.getCurrentEra(state);
    return {
      eraCode: era.code,
      eraName: era.name,
      eraProgress: `${era.reqDone}/${era.reqTotal}`,
      fxText: `1 ${this.sym(state, 'M')} = ${r.toFixed(3)} ${this.sym(state, 'S')} (1 ${this.sym(state, 'U')} = ${oeM.toFixed(2)} ${this.sym(state, 'M')} / ${oeS.toFixed(2)} ${this.sym(state, 'S')})`,
      bankReserves: `${this.money(state, state.economy?.bank?.M || 0, 'M')} · ${this.money(state, state.economy?.bank?.S || 0, 'S')}`,
      pendingWorks,
      icTotal: icLaws.length,
      noAvalCount,
      activeLoans: activeLoans.length,
      moras,
      mythEx,
      scadEx,
      mythBal: this.money(state, E.holdings(state, 'myth').M, 'M'),
      scadBal: this.money(state, E.holdings(state, 'scad').S, 'S'),
      mythNat: this.nat(state, 'myth').nation,
      scadNat: this.nat(state, 'scad').nation
    };
  }

  getBalances(state) {
    const E = this.E;
    const CATS = this.D.WORK_CATEGORIES || [];
    const states = ['myth', 'scad'].map(s => {
      const nat = this.nat(state, s);
      const c = E.curOfState(s);
      const oc = E.otherCur(c);
      const h = E.holdings(state, s);
      const cap = E.capitalization(state, s, CATS);
      const iss = E.issued(state, c);
      const ex = E.excess(state, c);
      const mora = E.inDefault(state, s);
      const tag = mora ? 'EN MORA' : ex > 0 ? `INFLACION (+${E.fmt(ex)})` : 'Sana';
      return `${nat.nation} (${nat.player}): ${this.money(state, h[c], c)}${h[oc] > 0 ? ` + ${this.money(state, h[oc], oc)}` : ''} | Techo ${E.fmt(iss)}/${E.fmt(cap)} | ${tag}`;
    });
    const guests = (state.guests || []).map(g => {
      const h = E.holdings(state, g.id);
      return `${g.nick}: ${this.money(state, h.M, 'M')} + ${this.money(state, h.S, 'S')}`;
    });
    return {
      states,
      guests,
      bank: `${state.settings?.bankName || 'Cámara'}: ${this.money(state, state.economy?.bank?.M || 0, 'M')} / ${this.money(state, state.economy?.bank?.S || 0, 'S')}`
    };
  }

  pname(state, pid) {
    if (pid === 'bank') return state.settings?.bankName || 'La Gran Cámara del Ender';
    if (pid === 'myth' || pid === 'scad') return this.nat(state, pid).player;
    const g = (state.guests || []).find(x => x.id === pid);
    return g ? g.nick : String(pid || '(desconocido)');
  }

  searchPrices(state, query) {
    const q = normalizeText(query).trim();
    const prices = state.economy?.prices || [];
    const matches = q
      ? prices.filter(p => normalizeText(`${p.name} ${p.unit || ''} ${this.pname(state, p.seller)}`).includes(q))
      : prices.slice(0, 8);
    return matches.slice(0, 8).map(p => {
      const hasExplicitCur = p.cur === 'M' || p.cur === 'S' || p.cur === 'U';
      const cur = hasExplicitCur ? p.cur : (this.E.isState(p.seller) ? this.E.curOfState(p.seller) : 'M');
      let priceOther = '';
      if (cur === 'U') {
        const cM = this.E.convert(state, p.price, 'U', 'M');
        const cS = this.E.convert(state, p.price, 'U', 'S');
        priceOther = `${this.money(state, cM, 'M')} / ${this.money(state, cS, 'S')}`;
      } else {
        const oCur = this.E.otherCur(cur);
        const conv = this.E.convert(state, p.price, cur, oCur);
        priceOther = this.money(state, conv, oCur);
      }
      return {
        seller: this.E.isState(p.seller) ? this.nat(state, p.seller).nation : this.pname(state, p.seller),
        name: p.name,
        unit: p.unit || 'u',
        priceMain: this.money(state, p.price, cur),
        priceOther
      };
    });
  }

  findCedula(state, query) {
    const q = normalizeText(query).trim();
    const list = state.villagers || [];
    const matches = q
      ? list.filter(v => normalizeText(`${v.name || ''} ${v.cedula || ''} ${v.home || ''} ${v.prof || ''} ${v.species || ''}`).includes(q))
      : list.slice(0, 6);
    return matches.slice(0, 6).map(v => {
      // Folio provisional según su posición en el censo completo (igual que la web), no en la búsqueda
      const i = Math.max(0, list.indexOf(v));
      const isAnim = v.kind === 'animal';
      const owner = isAnim ? (v.owner || 'myth') : (v.owner || state.professions?.[v.prof] || 'myth');
      const natName = this.E.isState(owner) ? this.nat(state, owner).nation : this.pname(state, owner);
      const profObj = !isAnim ? (this.D.PROFESSIONS || []).find(p => p.id === v.prof) : null;
      const specObj = isAnim ? (this.D.ANIMAL_SPECIES || []).find(a => a.id === v.species) : null;
      const ser = isAnim ? 'CA' : 'CC';
      const org = owner === 'scad' ? 'LUT' : (owner === 'myth' ? 'NA' : 'MIS');
      return {
        cedula: v.cedula || `${ser}-${org}-${String(i + 1).padStart(4, '0')}`,
        name: v.name,
        kindLabel: isAnim ? (specObj?.name || v.species || 'Animal') : (profObj?.name || v.prof || 'Aldeano'),
        nation: natName,
        home: v.home || 'Sin morada',
        tagged: Boolean(v.tagged),
        deceased: Boolean(v.deceased)
      };
    });
  }

  findRelevantNorms(state, query, { limit = 6, isJuez = false, includeOoc = false } = {}) {
    const tx = this.makeTx(state);
    const tokens = tokenize(query);
    const rawLaws = (state.laws || []).filter(l => {
      if (l.repealed) return false;
      return includeOoc ? true : (l.kind || 'servidor') === 'rol';
    });
    const haveTitles = new Set((state.laws || []).map(l => String(l.title || '').toLowerCase()));
    const canonicalAuditTitle = 'Manual 003 · Manual Oficial del Archivista Auditor y Auditoría de Obras (TRD 120-01)';
    const allCanonical = [...(this.D.DEFAULT_RP_LAWS || []), ...(this.D.DEFAULT_PENAL_PACK || [])];
    const fallbackManual = allCanonical.find(
      d => d.title === canonicalAuditTitle && !haveTitles.has(d.title.toLowerCase())
    );
    const pool = fallbackManual
      ? [...rawLaws, { ...fallbackManual, kind: 'rol', num: 3, review: { status: 'approved', notes: [] } }]
      : rawLaws;

    const isAuditQuery = /(?:audit\w*|obra\w*|reliquia\w*|punt\w*|catastro|120-01|manual\s*0*3)/i.test(normalizeText(query));
    const scored = pool.map(l => {
      const titleN = normalizeText(l.title);
      const bodyN = normalizeText(`${l.text || ''} ${l.sanction || ''} ${l.trdCode || ''}`);
      let score = 0;
      for (const tok of tokens) {
        if (titleN.includes(tok)) score += 4;
        if (bodyN.includes(tok)) score += 1.5;
        const stem = tok.length >= 5 ? tok.slice(0, tok.length - 1) : tok;
        if (stem !== tok) {
          if (titleN.includes(stem)) score += 2.5;
          if (bodyN.includes(stem)) score += 1;
        }
      }
      if (isJuez && (titleN.includes('ley 001') || titleN.includes('libro iv') || titleN.includes('resolucion 005'))) {
        score += 3;
      }
      if (isAuditQuery && (titleN.includes('manual 003') || titleN.includes('ley 006') || titleN.includes('ley 013'))) {
        score += 5;
      }
      return { l, score };
    });

    scored.sort((a, b) => b.score - a.score || (a.l.num || 0) - (b.l.num || 0));
    const chosen = scored.filter(x => x.score > 0).slice(0, limit);
    const fallback = chosen.length ? chosen : scored.slice(0, Math.min(4, scored.length));

    const results = fallback.map(({ l }) => {
      const meta = (this.D.DOC_TYPES || {})[l.docType || 'ley'] || { prefix: 'LEY' };
      const revSt = l.review?.status === 'approved' ? 'Avalada/Sellada' : 'Vigente bilateral (pendiente de aval)';
      return `[${meta.prefix} ${l.num} · TRD ${l.trdCode || '100-01'} · ${revSt}] ${l.title}\n${tx(l.text || '').slice(0, 2400)}${l.sanction ? `\nMedida/Sanción: ${tx(l.sanction)}` : ''}`;
    });

    if (isAuditQuery) {
      const cats = (this.D.WORK_CATEGORIES || []).map(c => `${c.name}: ${c.pts} pts`).join(' | ');
      const rels = (this.D.RELICS || []).slice(0, 6).map(r => `${r.name} (${r.pts} pts)`).join(', ');
      results.unshift(`[REFERENCIA DE AUDITORÍA TRD 120-01]: Audita oficialmente el Archivista Nacional (NotOutContext / Revisor designado; supletoriamente el Estado socio).\nCategorías: ${cats}.\nReliquias principales (solo 1.ª por tipo): ${rels}.`);
    }

    if (/(era|granja|nether|end|encant|villager|aldean|portal|beacon|elytra|metro|tren|riel|vagoneta|piston|tolva|cobre|trial|hierro|wither|warden|shulker|ancient|ciudad|city|deep|sculk|fortaleza|fortress|bastion|mansion|monumento|monument|stronghold|estructura|lootear|loot|botin|saquear|explorar)/i.test(normalizeText(query))) {
      const era = this.getCurrentEra(state);
      results.unshift(this.getErasRoadmapText(state, query));
      results.unshift(`[Referencia Técnica de Era Actual: ${era.code} — ${era.name}]\nPermitido: ${era.allowed.join(' | ')}\nProhibido: ${era.banned.join(' | ')}`);
    }
    if (/(lore|historia|cronica|origen|separo|pueblo|mundo|miscolandia|nacion|temporada|estacion|portal|megaobra)/i.test(normalizeText(query))) {
      const loreTxt = this.getLoreAndChroniclesContext(state, query, { compact: true });
      if (loreTxt) results.unshift(loreTxt);
    }
    return results;
  }

  getChroniclesSummary(state, limit = 4) {
    const tx = this.makeTx(state);
    const D = this.D;
    const worldLines = [];
    for (const p of (D.WORLD_PROMPTS || [])) {
      const v = String(state?.world?.[p.id] || '').trim();
      if (v) worldLines.push(`${p.label}: ${tx(v)}`);
    }
    for (const e of (D.ERAS || [])) {
      const ans = state?.lore?.[e.id] || {};
      for (const [qi, val] of Object.entries(ans)) {
        const clean = String(val || '').trim();
        if (clean && clean.toUpperCase() !== 'N/A') {
          const qText = tx(e.lore?.[Number(qi)] || `${e.code}`);
          worldLines.push(`${e.code} (${qText}): ${tx(clean)}`);
        }
      }
    }
    const chrons = (state?.chronicles || []).slice(0, limit).map(c => {
      const authorLabel = c.author === 'myth' || c.author === 'scad'
        ? `${this.nat(state, c.author).player} (${this.nat(state, c.author).nation})`
        : (c.author || 'Invitado');
      return {
        era: c.era || 'ERA',
        type: c.type || 'Historia',
        author: authorLabel,
        title: c.title || 'Sin título',
        body: tx(c.body || '')
      };
    });
    return { worldLines, chronList: chrons };
  }

  getLoreAndChroniclesContext(state, query = '', { compact = false } = {}) {
    const tx = this.makeTx(state);
    const D = this.D;
    const blocks = [];

    const worldParts = [];
    for (const p of (D.WORLD_PROMPTS || [])) {
      const v = String(state?.world?.[p.id] || '').trim();
      if (v) worldParts.push(`- ${p.label}: ${tx(v).slice(0, compact ? 160 : 320)}`);
    }
    if (worldParts.length) {
      blocks.push(`El Mundo:\n${worldParts.join('\n')}`);
    }

    for (const s of ['myth', 'scad']) {
      const natName = this.nat(state, s).nation;
      const nLore = state?.nationLore?.[s] || {};
      const nParts = [];
      for (const p of (D.NATION_PROMPTS || [])) {
        const v = String(nLore[p.id] || '').trim();
        if (v) nParts.push(`${p.label}: ${tx(v).slice(0, compact ? 120 : 240)}`);
      }
      if (nParts.length) {
        blocks.push(`[Lore de ${natName}]: ${nParts.join(' | ')}`);
      }
    }

    const eraLore = [];
    for (const e of (D.ERAS || [])) {
      const ans = state?.lore?.[e.id] || {};
      for (const [qi, val] of Object.entries(ans)) {
        const clean = String(val || '').trim();
        if (clean) {
          const qText = tx(e.lore?.[Number(qi)] || `Pregunta ${qi}`);
          eraLore.push(`- ${e.code} — ${qText}: ${tx(clean)}`);
        }
      }
    }
    if (eraLore.length) {
      blocks.push(`Respuestas de Lore por Era:\n${eraLore.slice(0, compact ? 6 : 16).join('\n')}`);
    }

    const chrons = Array.isArray(state?.chronicles) ? state.chronicles : [];
    if (chrons.length) {
      const qTokens = expandQueryTokens(query);
      const scored = chrons.map((c, idx) => {
        const hay = normalizeText(`${c.title || ''} ${c.body || ''} ${c.type || ''} ${c.era || ''}`);
        let score = 0;
        for (const tok of qTokens) {
          if (hay.includes(tok)) score += 2;
        }
        return { c, idx, score };
      });
      scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
      const maxCh = compact ? 3 : 6;
      const picks = scored.slice(0, maxCh).map(({ c }) => {
        const authorLabel = c.author === 'myth' || c.author === 'scad'
          ? `${this.nat(state, c.author).player} / ${this.nat(state, c.author).nation}`
          : String(c.author || 'Invitado');
        const bodySlice = tx(c.body || '').trim().replace(/\s+/g, ' ').slice(0, compact ? 180 : 380);
        return `[Crónica ${c.era || ''} · ${c.type || ''} · ${authorLabel}] ${c.title || 'Sin título'}: ${bodySlice}`;
      });
      blocks.push(`Crónicas (TRD 140-01):\n${picks.join('\n')}`);
    }

    const infra = [];
    if (Array.isArray(state?.stations) && state.stations.length) {
      infra.push(`Estaciones ferroviarias: ${state.stations.map(x => x.name || x.id).filter(Boolean).slice(0, 8).join(', ')}`);
    }
    if (Array.isArray(state?.portals) && state.portals.length) {
      infra.push(`Portales registrados: ${state.portals.map(x => x.label || x.name || x.id).filter(Boolean).slice(0, 8).join(', ')}`);
    }
    if (state?.mega?.name) {
      infra.push(`Megaobra: ${state.mega.name}`);
    }
    if (Number(state?.seasons?.current) > 0) {
      infra.push(`Temporada activa: ${state.seasons.current}`);
    }
    if (infra.length) {
      blocks.push(infra.join(' | '));
    }

    if (!blocks.length) return '';
    return `[LORE OFICIAL Y CRÓNICAS DE LA WEB FOREVER WORLD]\n${blocks.join('\n\n')}`;
  }

  getErasRoadmapText(state, query = '') {
    const ERAS = this.D.ERAS || [];
    const cur = this.getCurrentEra(state);
    const tx = this.makeTx(state);
    const lines = [
      '[HOJA DE RUTA DE ERAS — TODO LO DE ERAS [BLOQUEADA / FUTURA] ESTÁ PROHIBIDO / NO DISPONIBLE EN LA ERA ACTUAL]'
    ];
    for (let i = 0; i < ERAS.length; i++) {
      const e = ERAS[i];
      const tag = i < cur.index ? 'COMPLETADA' : i === cur.index ? 'ERA ACTUAL' : 'BLOQUEADA / FUTURA';
      const allowTxt = (e.allowed || []).map(tx).join('; ');
      const banTxt = i === cur.index && e.banned?.length ? ` | Prohibido: ${e.banned.map(tx).join('; ')}` : '';
      lines.push(`- ${e.code} (${tx(e.name)}) [${tag}]: Enfoque: ${tx(e.focus)} | Desbloquea/Permitido: ${allowTxt}${banTxt}`);
    }

    const qTokens = expandQueryTokens(query);
    if (qTokens.length) {
      const futureMatches = [];
      for (let i = cur.index + 1; i < ERAS.length; i++) {
        const e = ERAS[i];
        for (const t of (e.tasks || [])) {
          const hay = normalizeText(`${t.title} ${t.desc}`);
          let hits = 0;
          for (const tok of qTokens) {
            if (hay.includes(tok)) hits++;
          }
          if (hits > 0) {
            futureMatches.push({ hits, idx: i, text: `[Hito futuro bloqueado · ${e.code}] ${tx(t.title)}: ${tx(t.desc)}` });
          }
        }
      }
      futureMatches.sort((a, b) => b.hits - a.hits || a.idx - b.idx);
      for (const m of futureMatches.slice(0, 5)) {
        lines.push(m.text);
      }
    }
    return lines.join('\n');
  }

  getEraExpectationsSummary(state) {
    const cur = this.getCurrentEra(state);
    const tx = this.makeTx(state);
    const ERAS = this.D.ERAS || [];
    const eraObj = ERAS[cur.index] || {};
    const tasks = eraObj.tasks || [];
    const doneTitles = [];
    const todoTitles = [];
    for (const t of tasks) {
      const title = tx(t.title);
      if (this.isTaskDone(state, t)) doneTitles.push(title);
      else if (t.req) todoTitles.push(title);
    }
    const works = state?.economy?.works || [];
    const mythWorks = works.filter(w => w.status === 'auditada' && w.owner === 'myth').length;
    const scadWorks = works.filter(w => w.status === 'auditada' && w.owner === 'scad').length;
    const futureHints = [];
    for (let i = cur.index + 1; i < Math.min(ERAS.length, cur.index + 5); i++) {
      const fe = ERAS[i];
      futureHints.push(`${fe.code} (${tx(fe.name)}): ${tx(fe.focus)}`);
    }
    return [
      `[ESTRUCTURAS Y METAS REALES DE LA ${cur.code} (${cur.name}) — NO EXIJAS COSAS DE ERAS FUTURAS]`,
      `Avance actual: ${cur.reqDone}/${cur.reqTotal} hitos obligatorios | Obras auditadas aprobadas: ${this.nat(state, 'myth').nation}=${mythWorks}, ${this.nat(state, 'scad').nation}=${scadWorks}.`,
      `Permitido ahora: ${cur.allowed.join(' ; ')}`,
      `Prohibido / Todavía NO disponible: ${cur.banned.join(' ; ')}`,
      doneTitles.length ? `Ya completado en ${cur.code}: ${doneTitles.join(', ')}` : `Ya completado en ${cur.code}: nada aún (están arrancando esta Era).`,
      todoTitles.length ? `Estructuras/hitos que sí tocan en ${cur.code}: ${todoTitles.slice(0, 12).join(', ')}` : `Todos los hitos de ${cur.code} completados.`,
      futureHints.length ? `Próximas Eras (aún bloqueadas, no las pidas todavía): ${futureHints.join(' | ')}` : ''
    ].filter(Boolean).join('\n');
  }

  findOocContext(state, query) {
    const tx = this.makeTx(state);
    const era = this.getCurrentEra(state);
    const pact = this.getPactSummary(state, query);
    const mythNat = this.nat(state, 'myth').nation;
    const scadNat = this.nat(state, 'scad').nation;
    const oocRules = (state.laws || [])
      .filter(l => (l.kind || 'servidor') === 'servidor' && !l.repealed)
      .map(l => `[REG ${l.num} · TRD ${l.trdCode || '160-01'}] ${l.title}\n${tx(l.text || '')}${l.sanction ? `\nSanción: ${tx(l.sanction)}` : ''}`);

    const identitiesSection = `[IDENTIDADES OFICIALES]: MythStorm = Gobernante de ${mythNat} | Scadrial0523 = Gobernante de ${scadNat} | NotOutContext = Archivista Nacional, Revisor de normas y Auditor Oficial de Obras (TRD 120-01, sin Estado propio).`;

    const eraSection = [
      `[ERA ACTUAL DEL MUNDO: ${era.code} · ${era.name} (${era.reqDone}/${era.reqTotal} obligatorios)]`,
      `Enfoque: ${era.focus}`,
      `Economía de Era: ${era.economy}`,
      `Permitido: ${era.allowed.join(' | ')}`,
      `Prohibido: ${era.banned.join(' | ')}`
    ].join('\n');

    const roadmapSection = this.getErasRoadmapText(state, query);

    const pactSection = [
      '[PACTO DE MONOPOLIOS Y PROFESIONES]',
      `${pact.myth.nation}: ${pact.myth.sectors.join(' ; ')}`,
      `${pact.scad.nation}: ${pact.scad.sectors.join(' ; ')}`,
      `Reglas del Pacto: ${pact.rules.map(r => `${r.t}: ${r.d}`).join(' | ')}`,
      `Reparto de Aldeanos: ${pact.professions.map(p => `${p.name}=${p.nation}`).join(', ')}`
    ].join('\n');

    return [identitiesSection, eraSection, roadmapSection, pactSection, ...oocRules];
  }

  getEconomyManualExcerpts(state, query) {
    const tx = this.makeTx(state);
    const m = this.D.ECONOMY_MANUAL;
    if (!m) return [];
    const tokens = tokenize(query);
    const scored = (m.chapters || []).map(ch => {
      const hay = normalizeText(`${ch.title} ${ch.summary} ${(ch.articles || []).join(' ')} ${ch.trd}`);
      let score = 0;
      for (const tok of tokens) {
        if (hay.includes(tok)) score += 2;
      }
      return { ch, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const picks = scored.filter(x => x.score > 0).slice(0, 3);
    const list = picks.length ? picks : scored.slice(0, 3);
    return list.map(({ ch }) => `${ch.num} (${ch.trd}): ${tx(ch.title)}\n${(ch.articles || []).map(tx).join('\n')}`);
  }

  getPendingEraMilestones(state) {
    const ERAS = this.D.ERAS || [];
    const tx = this.makeTx(state);
    const cur = this.getCurrentEra(state);
    const era = ERAS[cur.index] || ERAS[0];
    const allTasks = ERAS.flatMap(e => e.tasks || []);
    const totalDone = allTasks.filter(t => this.isTaskDone(state, t)).length;
    const totalAll = allTasks.length;
    const pendingReq = [];
    for (const t of (era?.tasks || [])) {
      if (!t.req || this.isTaskDone(state, t)) continue;
      let missing = [t.who];
      if (t.who === 'ambos') {
        const v = state?.tasks?.[t.id];
        const mythDone = v && typeof v === 'object' ? Boolean(v.myth) : Boolean(v);
        const scadDone = v && typeof v === 'object' ? Boolean(v.scad) : Boolean(v);
        missing = [];
        if (!mythDone) missing.push('myth');
        if (!scadDone) missing.push('scad');
      }
      pendingReq.push({ id: t.id, title: tx(t.title), who: t.who, missing });
    }
    return {
      eraIndex: cur.index,
      eraCode: cur.code,
      eraName: cur.name,
      reqDone: cur.reqDone,
      reqTotal: cur.reqTotal,
      totalDone,
      totalAll,
      totalPct: totalAll ? Math.round((totalDone / totalAll) * 100) : 0,
      pendingReq,
      nextEraCode: ERAS[cur.index + 1] ? ERAS[cur.index + 1].code : 'ERA ∞'
    };
  }

  // Religiones escritas en la web (Lore → Religiones y fe). Solo cuenta una fe si le dieron nombre a su dios.
  getReligions(state) {
    const rel = state?.religions && typeof state.religions === 'object' ? state.religions : {};
    const tx = this.makeTx(state);
    const out = [];
    for (const [pid, r] of Object.entries(rel)) {
      if (!r || typeof r !== 'object') continue;
      const names = String(r.names || '').split(/[,;\n]/).map(x => x.trim()).filter(x => normalizeText(x).replace(/[^a-z0-9]/g, '').length >= 2).slice(0, 8);
      if (!names.length) continue;
      const believer = this.pname(state, pid);
      const people = (pid === 'myth' || pid === 'scad') ? this.nat(state, pid).nation : `${believer} (invitado)`;
      const field = k => tx(String(r[k] || '').trim()).slice(0, 500);
      out.push({ pid, believer, people, faith: field('faith'), names, nature: field('nature'), pleases: field('pleases'), angers: field('angers'), prayer: field('prayer'), rites: field('rites') });
    }
    return out;
  }

  // Convicción de un participante (web → Religiones y fe → Convicción): fe que profesa o la Razón, y sus hitos
  getDevotion(state, pid) {
    if (!pid) return { path: null, creed: null, level: 0, total: 0 };
    const d = state?.devotion?.[pid] || {};
    const rel = state?.religions || {};
    const hasNames = rp => Boolean(String(rel?.[rp]?.names || '').trim());
    let creed = d.creed || null;
    if (!creed && hasNames(pid)) creed = pid; // quien fundó una fe con dios nombrado es su fiel aunque no lo declare
    const path = creed === 'razon' ? 'razon' : (creed && hasNames(creed) ? 'fe' : null);
    const list = path === 'razon' ? (this.D.REASON_MILESTONES || []) : path === 'fe' ? (this.D.FAITH_MILESTONES || []) : [];
    const marks = d.marks || {};
    return { path, creed: path ? creed : null, level: list.filter(m => marks[m.id] === true).length, total: list.length };
  }

  getSacredTexts(state, limit = 4) {
    const tx = this.makeTx(state);
    const chrons = (Array.isArray(state?.chronicles) ? state.chronicles : [])
      .filter(c => /^(mito|religi[oó]n)$/i.test(String(c.type || '').trim()))
      .slice(0, limit)
      .map(c => `[${c.type} · ${this.pname(state, c.author) || c.author}] ${c.title || ''}: ${tx(c.body || '').replace(/\s+/g, ' ').slice(0, 400)}`);
    const beliefs = ['myth', 'scad']
      .map(s => ({ s, b: String(state?.nationLore?.[s]?.beliefs || '').trim() }))
      .filter(x => x.b)
      .map(x => `[Creencias de ${this.nat(state, x.s).nation}] ${tx(x.b).slice(0, 300)}`);
    const origin = String(state?.world?.origin || '').trim();
    return [...beliefs, ...(origin ? [`[Mito de origen del mundo] ${tx(origin).slice(0, 400)}`] : []), ...chrons];
  }

  // Datos de territorio para el Cartógrafo: solo lo que la web tiene registrado (nada inventado)
  getMapContext(state, query = '') {
    const tokens = expandQueryTokens(query);
    const rank = (txt) => {
      const hay = normalizeText(txt);
      return tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    };
    const pick = (list, toText, max) => list
      .map((x, i) => ({ x, i, s: rank(toText(x)) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .slice(0, max)
      .map(({ x }) => toText(x));
    const ownerName = o => (o === 'myth' || o === 'scad') ? this.nat(state, o).nation : (o ? this.pname(state, o) : 'sin dueño');
    const stations = Array.isArray(state?.stations) ? state.stations : [];
    const portals = Array.isArray(state?.portals) ? state.portals : [];
    const works = (state?.economy?.works || []).filter(w => String(w.coords || '').trim());
    const homes = (state?.villagers || []).filter(v => !v.deceased && String(v.home || '').trim());
    const blocks = [];
    blocks.push(stations.length
      ? `[ESTACIONES REGISTRADAS EN LA WEB]\n${pick(stations, s => `- ${s.name || 'Estación'}${s.line ? ` (línea ${s.line})` : ''}${s.coords ? ` · coords ${s.coords}` : ''} · ${ownerName(s.owner)}`, 12).join('\n')}`
      : '[ESTACIONES]: ninguna registrada todavía en la web.');
    blocks.push(portals.length
      ? `[PORTALES REGISTRADOS (Overworld ↔ Nether, X,Z)]\n${pick(portals, p => `- ${p.label || p.name || 'Portal'}: Overworld ${p.ow || '?'} ↔ Nether ${p.nh || '?'}`, 12).join('\n')}`
      : '[PORTALES]: ninguno registrado todavía en la web.');
    blocks.push(works.length
      ? `[OBRAS CON COORDENADAS]\n${pick(works, w => `- ${w.name} (${ownerName(w.owner)}, ${w.status || 'pendiente'}) · coords ${w.coords}`, 12).join('\n')}`
      : '[OBRAS CON COORDENADAS]: ninguna obra tiene coordenadas anotadas en la web.');
    if (homes.length) {
      blocks.push(`[MORADAS DEL CENSO]\n${pick(homes, v => `- ${v.name}${v.cedula ? ` (${v.cedula})` : ''}: ${v.home}`, 8).join('\n')}`);
    }
    const rail = Number(state?.railBlocks) || 0;
    if (rail > 0) blocks.push(`[RED FERROVIARIA]: ${rail} bloques de riel registrados en la web.`);
    blocks.push('Regla del Nether: 1 bloque en el Nether = 8 en el Overworld (X y Z se dividen entre 8; Y no cambia).');
    return blocks.join('\n\n');
  }

  getWorksSummary(state) {
    const works = state?.economy?.works || [];
    const cats = this.D.WORK_CATEGORIES || [];
    const effPts = this.E.effectiveWorkPoints(state, cats);
    const auditedByOwner = { myth: { count: 0, pts: 0 }, scad: { count: 0, pts: 0 } };
    const audited = [];
    const pending = [];
    for (const w of works) {
      const ownerLabel = w.owner === 'myth' || w.owner === 'scad'
        ? this.nat(state, w.owner).nation
        : String(w.owner || 'Invitado');
      if (w.status === 'auditada') {
        const eff = Number(effPts[w.id] ?? w.final ?? 0);
        if (auditedByOwner[w.owner]) {
          auditedByOwner[w.owner].count += 1;
          auditedByOwner[w.owner].pts += eff;
        }
        audited.push({ id: w.id, name: w.name, owner: w.owner, ownerLabel, final: Number(w.final) || 0, eff });
      } else if (w.status === 'pendiente') {
        pending.push({
          id: w.id,
          name: w.name,
          owner: w.owner,
          ownerLabel,
          coords: String(w.coords || '').trim(),
          proposed: Number(w.proposed) || 0
        });
      }
    }
    return {
      auditedByOwner,
      pending,
      recentAudited: audited.slice(-5).reverse()
    };
  }

  mutateWorld(mutatorFn, updatedBy = 'Bot', opts = {}) {
    const run = () => this._mutateWorldUnlocked(mutatorFn, updatedBy, opts);
    const queued = this.writeQueue.then(run, run);
    this.writeQueue = queued.catch(() => {});
    return queued;
  }

  async _mutateWorldUnlocked(mutatorFn, updatedBy = 'Bot', { maxRetries = 4 } = {}) {
    const row = await this.fetchWorld(true);
    if (!row || row.offlineFallback || !row.state) {
      return { ok: false, msg: 'Supabase no está disponible ahora mismo.' };
    }
    let curRev = Number(row.rev) || 1;
    let curState = row.state;
    const tries = Math.max(1, Number(maxRetries) || 4);

    for (let attempt = 0; attempt < tries; attempt++) {
      const draft = JSON.parse(JSON.stringify(curState));
      const mutRes = mutatorFn(draft, { rev: curRev });
      if (mutRes && mutRes.ok === false) return mutRes;

      const now = Date.now();
      draft.updatedAt = now;
      draft.updatedBy = String(updatedBy || 'Bot');

      try {
        const res = await fetch(`${this.cfg.url}/rest/v1/rpc/fw_save_world`, {
          method: 'POST',
          headers: {
            apikey: this.cfg.anonKey,
            Authorization: `Bearer ${this.cfg.anonKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            p_id: this.cfg.worldId || 'main',
            p_state: draft,
            p_updated_at: now,
            p_updated_by: draft.updatedBy,
            p_expected_rev: curRev,
            p_force: false
          })
        });
        if (!res.ok) {
          return { ok: false, msg: `Supabase RPC HTTP ${res.status}: ${await res.text()}` };
        }
        const rpc = await res.json();
        if (rpc && rpc.ok) {
          this.cache = {
            at: now,
            row: {
              id: this.cfg.worldId || 'main',
              rev: Number(rpc.rev),
              updated_at: Number(rpc.updated_at) || now,
              updated_by: rpc.updated_by || draft.updatedBy,
              state: draft,
              offlineFallback: false
            }
          };
          return { ok: true, rev: Number(rpc.rev), state: draft, meta: mutRes || {} };
        }
        if (rpc && rpc.reason === 'conflict' && rpc.state) {
          curRev = Number(rpc.rev) || (curRev + 1);
          curState = rpc.state;
          this.cache = {
            at: now,
            row: { id: this.cfg.worldId || 'main', rev: curRev, updated_at: Number(rpc.updated_at) || now, state: curState, offlineFallback: false }
          };
          continue;
        }
        return { ok: false, msg: rpc?.reason ? `Conflicto al guardar (${rpc.reason}).` : 'No se pudo guardar en Supabase.' };
      } catch (err) {
        return { ok: false, msg: `Error de red con Supabase: ${err.message}` };
      }
    }
    return { ok: false, msg: 'Demasiados cambios simultáneos en la nube; intenta de nuevo en unos segundos.' };
  }

  resolveParticipantId(state, query) {
    const q = normalizeText(query).trim();
    if (!q) return null;
    if (q === 'bank' || q === 'banco' || q === 'camara') return 'bank';
    const m = this.nat(state, 'myth');
    const s = this.nat(state, 'scad');
    const mKeys = ['myth', 'mythstorm', normalizeText(m.player), normalizeText(m.nation), 'alejandria', 'dracma', 'dr'].filter(Boolean);
    const sKeys = ['scad', 'scadrial', 'scadrial0523', normalizeText(s.player), normalizeText(s.nation), 'luthadel', 'cuarto', 'cu'].filter(Boolean);
    if (mKeys.some(k => k === q || (q.length >= 3 && k.startsWith(q)))) return 'myth';
    if (sKeys.some(k => k === q || (q.length >= 3 && k.startsWith(q)))) return 'scad';
    const qCompact = q.replace(/of/g, '');
    const guests = Array.isArray(state?.guests) ? state.guests : [];
    for (const g of guests) {
      const gId = normalizeText(g.id);
      const gNick = normalizeText(g.nick);
      if (q === gId || q === gNick || (q.length >= 3 && gNick.replace(/of/g, '') === qCompact) || (q === 'noc' && gNick.includes('notout'))) {
        return g.id;
      }
    }
    for (const g of guests) {
      const gNick = normalizeText(g.nick);
      if (q.length >= 3 && (gNick.startsWith(q) || gNick.includes(q))) return g.id;
    }
    return null;
  }

  parseCoords(raw) {
    const nums = String(raw || '').match(/-?\d+(?:[.,]\d+)?/g);
    if (!nums || nums.length < 2) return null;
    const toN = s => Math.round(Number(String(s).replace(',', '.')));
    if (nums.length >= 3) return { x: toN(nums[0]), y: toN(nums[1]), z: toN(nums[2]) };
    return { x: toN(nums[0]), y: null, z: toN(nums[1]) };
  }

  getHolidaysContext(state, now = Date.now()) {
    const cal = this.D.getHolidayCalendar ? this.D.getHolidayCalendar(now) : { active: [], upcoming: null, year: new Date(now).getFullYear() };
    const lines = [];
    for (const h of cal.active) {
      const node = state?.holidays?.[h.seasonYear]?.[h.id] || {};
      const tDone = h.tasks.map(t => {
        const who = Object.entries(node[t.id] || {}).filter(([, ok]) => ok === true).map(([pid]) => this.pname(state, pid));
        return `${t.title}${who.length ? ` (✔ ${who.join(', ')})` : ''}`;
      }).join(' · ');
      lines.push(`[ACTIVA HOY] ${h.emoji} ${h.name} (${h.dateLabel}): ${tDone}`);
    }
    if (cal.upcoming) {
      lines.push(`[PRÓXIMA FESTIVIDAD] ${cal.upcoming.holiday?.name || cal.upcoming.name} en ${cal.upcoming.daysLeft} día(s) (${cal.upcoming.dateLabel}).`);
    }
    return { cal, text: lines.join('\n') };
  }
}
