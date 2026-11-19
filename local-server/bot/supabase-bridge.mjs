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
  return [...tokens];
}

export class SupabaseBridge {
  constructor(repoRoot) {
    this.repoRoot = path.resolve(repoRoot);
    this.cfg = null;
    this.D = null;
    this.E = null;
    this.cache = { at: 0, row: null };
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
    this.E.setCategories(this.D.WORK_CATEGORIES || []);
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
    try {
      const q = `/rest/v1/fw_worlds?id=eq.${encodeURIComponent(this.cfg.worldId || 'main')}&select=id,rev,updated_at,state`;
      const res = await fetch(`${this.cfg.url}${q}`, {
        headers: {
          apikey: this.cfg.anonKey,
          Authorization: `Bearer ${this.cfg.anonKey}`
        }
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
    const mythEx = E.excess(state, 'myth', CATS);
    const scadEx = E.excess(state, 'scad', CATS);
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
      const ex = E.excess(state, s, CATS);
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

  searchPrices(state, query) {
    const q = normalizeText(query).trim();
    const prices = state.economy?.prices || [];
    const matches = q
      ? prices.filter(p => normalizeText(`${p.name} ${p.unit || ''}`).includes(q))
      : prices.slice(0, 8);
    return matches.slice(0, 8).map(p => {
      const cur = this.E.curOfState(p.seller);
      const oCur = this.E.otherCur(cur);
      const conv = this.E.convert(state, p.price, cur, oCur);
      return {
        seller: this.nat(state, p.seller).nation,
        name: p.name,
        unit: p.unit || 'u',
        priceMain: this.money(state, p.price, cur),
        priceOther: this.money(state, conv, oCur)
      };
    });
  }

  findCedula(state, query) {
    const q = normalizeText(query).trim();
    const list = state.villagers || [];
    const matches = q
      ? list.filter(v => normalizeText(`${v.name || ''} ${v.cedula || ''} ${v.home || ''} ${v.prof || ''} ${v.species || ''}`).includes(q))
      : list.slice(0, 6);
    return matches.slice(0, 6).map((v, i) => {
      const isAnim = v.kind === 'animal';
      const owner = isAnim ? (v.owner || 'myth') : (v.owner || state.professions?.[v.prof] || 'myth');
      const natName = this.nat(state, owner).nation;
      const profObj = !isAnim ? (this.D.PROFESSIONS || []).find(p => p.id === v.prof) : null;
      const specObj = isAnim ? (this.D.ANIMAL_SPECIES || []).find(a => a.id === v.species) : null;
      return {
        cedula: v.cedula || `${isAnim ? 'CA' : 'CC'}-${owner === 'scad' ? 'LUT' : 'NA'}-${String(i + 1).padStart(4, '0')}`,
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
    const pool = (state.laws || []).filter(l => {
      if (l.repealed) return false;
      return includeOoc ? true : (l.kind || 'servidor') === 'rol';
    });

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
      return { l, score };
    });

    scored.sort((a, b) => b.score - a.score || (a.l.num || 0) - (b.l.num || 0));
    const chosen = scored.filter(x => x.score > 0).slice(0, limit);
    const fallback = chosen.length ? chosen : scored.slice(0, Math.min(4, scored.length));

    const results = fallback.map(({ l }) => {
      const meta = (this.D.DOC_TYPES || {})[l.docType || 'ley'] || { prefix: 'LEY' };
      const revSt = l.review?.status === 'approved' ? 'Avalada/Sellada' : 'Vigente bilateral (pendiente de aval)';
      return `[${meta.prefix} ${l.num} · TRD ${l.trdCode || '100-01'} · ${revSt}] ${l.title}\n${tx(l.text || '').slice(0, 1400)}${l.sanction ? `\nMedida/Sanción: ${tx(l.sanction)}` : ''}`;
    });

    if (/(era|granja|nether|end|encant|villager|aldean|portal|beacon|elytra|metro|tren|riel|vagoneta|piston|tolva|cobre|trial|hierro|wither|warden|shulker)/i.test(normalizeText(query))) {
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
      infra.push(`Portales registrados: ${state.portals.map(x => x.name || x.id).filter(Boolean).slice(0, 8).join(', ')}`);
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

    const identitiesSection = `[IDENTIDADES OFICIALES]: MythStorm = Gobernante de ${mythNat} | Scadrial0523 = Gobernante de ${scadNat} | NotOutContext = Visitante sin nación (invitado).`;

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
}
