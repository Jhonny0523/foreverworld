/* ==========================================================================
   FOREVER WORLD — Interfaz, estado y persistencia
   ========================================================================== */

(() => {
  'use strict';

  const D = window.FW_DATA;
  const E = window.FW_ENGINE;
  const ICONS = window.FW_ICONS || {};
  const CLOUD = window.FW_CLOUD || null;
  const CATS = D.WORK_CATEGORIES;
  E.setCategories(CATS);
  const STORAGE_KEY = 'forever_world_v6';
  const ME_KEY = 'forever_world_me';
  const STATES = ['myth', 'scad'];

  /* ======================== Estado ======================== */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaultState() {
    const nations = clone(D.DEFAULT_NATIONS);
    const professions = {};
    D.PROFESSIONS.forEach(p => { professions[p.id] = p.def; });
    return {
      version: 6,
      updatedAt: Date.now(),
      updatedBy: '',
      settings: {
        nations,
        bankName: D.DEFAULT_BANK_NAME,
        basket: clone(D.DEFAULT_BASKET),
        baseIssue: 100,
        sharesTotal: 100,
        fxInertia: 200,
        bankRate: 10,
        bankCollateralPct: 30,
        bankLiquidityPct: 50,
        reviewerId: ''
      },
      guests: [],
      professions,
      tasks: {},
      guestTasks: {},
      lore: {},
      world: {},
      nationLore: { myth: {}, scad: {} },
      economy: {
        holdings: { myth: { M: 100, S: 0 }, scad: { M: 0, S: 100 } },
        bank: { M: 0, S: 0 },
        fxHistory: [{ t: Date.now(), r: 1 }],
        prices: [],
        works: [],
        loans: [],
        shares: { myth: { myth: 100 }, scad: { scad: 100 } },
        ledger: [],
        sealed: { item: '', seller: 'myth', attempt: 1, last: null }
      },
      laws: [],
      trd: clone(D.DEFAULT_TRD || []),
      chronicles: [],
      stations: [],
      portals: [],
      villagers: [],
      railBlocks: 0,
      seasons: { current: 0, checks: {}, roll: null, history: [] },
      mega: { name: '', stages: [] },
      ui: { tab: 'roadmap', ecoTab: 'overview', stateTab: 'laws', advanced: true, filter: 'all', track: '', open: {}, ledgerQ: '' }
    };
  }

  // Mezcla profunda: lo guardado gana, pero se rellenan claves nuevas
  function merge(def, saved) {
    if (Array.isArray(def)) return Array.isArray(saved) ? saved : def;
    if (def && typeof def === 'object') {
      const out = { ...(saved && typeof saved === 'object' ? saved : {}) };
      Object.keys(def).forEach(k => { out[k] = merge(def[k], saved ? saved[k] : undefined); });
      return out;
    }
    return saved === undefined || saved === null ? def : saved;
  }

  function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function safeSet(key, val) { try { localStorage.setItem(key, val); return true; } catch { return false; } }
  function safeDel(key) { try { localStorage.removeItem(key); } catch { /* sin almacenamiento */ } }

  function loadState() {
    const raw = safeGet(STORAGE_KEY);
    if (!raw) return defaultState();
    try { return merge(defaultState(), JSON.parse(raw)); } catch { return defaultState(); }
  }

  let state = loadState();
  const isFreshStart = !safeGet(STORAGE_KEY);
  let me = safeGet(ME_KEY) || '';
  let preferredMe = me;

  function save(skipCloud = false) {
    state.updatedAt = Date.now();
    state.updatedBy = me ? pname(me) : '';
    if (!safeSet(STORAGE_KEY, JSON.stringify(state))) {
      toast('Sin guardado', 'Este navegador no permite guardar. Exporta el archivo para no perder datos.', 'redstone');
    }
    autoBackup(false);
    if (!skipCloud && CLOUD) CLOUD.schedulePush(() => state);
  }

  /* ---------- Copias automáticas (últimas 10, una cada 10 minutos de uso) ---------- */
  const AUTO_KEY = 'forever_world_autobackup';
  function readAutoBackups() { try { return JSON.parse(safeGet(AUTO_KEY) || '[]'); } catch { return []; } }
  function autoBackup(force, label) {
    const list = readAutoBackups();
    const last = list[list.length - 1];
    if (!force && last && Date.now() - last.t < 10 * 60 * 1000) return;
    const data = JSON.stringify(state);
    if (last && last.data === data) return;
    list.push({ t: Date.now(), label: label || 'Automática', data });
    while (list.length > 10) list.shift();
    // si no cabe, ir soltando las más viejas
    while (list.length && !safeSet(AUTO_KEY, JSON.stringify(list))) list.shift();
  }

  /* ======================== Utilidades ======================== */

  const $ = id => document.getElementById(id);
  const fmt = E.fmt;
  const uid = E.uid;
  const num = (v, d = 0) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : d; };
  const val = id => ($(id) ? $(id).value.trim() : '');
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  const nat = s => state.settings.nations[s];
  const curOf = E.curOfState;
  const sym = c => (c === 'M' ? nat('myth').symbol : c === 'S' ? nat('scad').symbol : state.settings.basket.symbol);
  const curName = c => (c === 'M' ? nat('myth').currency : c === 'S' ? nat('scad').currency : state.settings.basket.name);
  const money = (n, c) => `${fmt(n)} ${sym(c)}`;
  const stateColor = s => (s === 'myth' ? 'royal' : 'emerald');
  const stateBorder = s => (s === 'myth' ? '#3d5ad6' : '#2f8a2b');
  function pname(pid) {
    if (pid === 'bank') return state.settings.bankName;
    if (pid === 'myth' || pid === 'scad') return nat(pid).player;
    const g = state.guests.find(x => x.id === pid);
    return g ? g.nick : '(desconocido)';
  }
  function ptag(pid) {
    if (pid === 'bank') return `<span class="mc-tag tag-amethyst">${esc(pname(pid))}</span>`;
    if (E.isState(pid)) return `<span class="mc-tag tag-${stateColor(pid)}">${esc(pname(pid))}</span>`;
    return `<span class="mc-tag tag-cyan">${esc(pname(pid))} · invitado</span>`;
  }
  const participants = () => ['myth', 'scad', ...state.guests.map(g => g.id)];
  const opts = (list, sel) => list.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const peopleOpts = (sel, list = participants()) => opts(list.map(p => [p, pname(p) + (E.isState(p) ? '' : ' (invitado)')]), sel);
  const stateOpts = sel => opts(STATES.map(s => [s, `${nat(s).nation} (${nat(s).player})`]), sel);
  const curOpts = (sel, withU) => opts([['M', `${nat('myth').currency} (${sym('M')})`], ['S', `${nat('scad').currency} (${sym('S')})`], ...(withU ? [['U', `${state.settings.basket.name} (${sym('U')})`]] : [])], sel);

  // Reemplaza los nombres en el contenido del roadmap
  function tx(str) {
    return String(str ?? '')
      .replace(/\{BANK\}/g, state.settings.bankName)
      .replace(/\{NMYTH\}/g, nat('myth').nation)
      .replace(/\{NSCAD\}/g, nat('scad').nation)
      .replace(/\{MYTH\}/g, nat('myth').player)
      .replace(/\{SCAD\}/g, nat('scad').player)
      .replace(/\{DRN\}/g, nat('myth').currency)
      .replace(/\{CUN\}/g, nat('scad').currency)
      .replace(/\{OE_NAME\}/g, state.settings.basket.name)
      .replace(/\{OE\}/g, state.settings.basket.symbol)
      .replace(/\{DR\}/g, nat('myth').symbol)
      .replace(/\{CU\}/g, nat('scad').symbol);
  }

  E.label = k => {
    if (k === 'M' || k === 'S' || k === 'U') return sym(k);
    return pname(k);
  };

  function log(type, text) {
    state.economy.ledger.unshift({ id: uid('led'), t: Date.now(), type, text, by: me ? pname(me) : '' });
  }
  function recordFx() {
    const r = E.rate(state);
    const h = state.economy.fxHistory;
    if (!h.length || Math.abs(h[h.length - 1].r - r) > 1e-6) h.push({ t: Date.now(), r });
    if (h.length > 300) h.splice(0, h.length - 300);
  }
  const when = t => new Date(t).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  function toast(title, sub, icon = 'emerald') {
    const box = $('toast-container');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'mc-toast';
    el.innerHTML = `<div>${ICONS[icon] || ICONS.emerald || ''}</div><div><div class="font-pixel text-gold" style="font-size:11px;">${esc(title)}</div><div class="text-xs text-white" style="margin-top:2px;">${esc(sub)}</div></div>`;
    box.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; setTimeout(() => el.remove(), 260); }, 3800);
  }
  const fail = msg => toast('No se pudo', msg, 'redstone');

  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    keys.slice(0, -1).forEach(k => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    o[keys[keys.length - 1]] = value;
  }

  const panel = (inner, extra = '') => `<div class="mc-panel p-lg" ${extra}>${inner}</div>`;
  const head = (tag, tagColor, title, sub = '') => `
    <div class="panel-head">
      <span class="mc-tag tag-${tagColor}">${tag}</span>
      <h2 class="font-pixel text-white text-base" style="margin:6px 0 0 0;">${title}</h2>
      ${sub ? `<p class="text-xs text-muted" style="margin:4px 0 0 0;line-height:1.55;">${sub}</p>` : ''}
    </div>`;
  // Botón "?" con explicación en lenguaje simple
  const tip = key => ((D.GLOSSARY || {})[key] ? `<button type="button" class="help-tip" data-action="tip" data-k="${key}" aria-label="¿Qué es ${esc(tx(D.GLOSSARY[key].t))}?">?</button>` : '');
  // Sección plegable que recuerda si quedó abierta
  const fold = (id, title, inner, openByDefault = false) => {
    const open = (state.ui.folds || {})[id] ?? openByDefault;
    return `<details class="fold" data-fold="${id}" ${open ? 'open' : ''}><summary class="fold-summary mc-panel">${title}</summary><div class="fold-body">${inner}</div></details>`;
  };
  const empty = msg => `<div class="mc-panel-dark p-md text-xs text-muted" style="text-align:center;grid-column:1/-1;">${msg}</div>`;
  const field = (label, html) => `<div><label class="text-xs text-muted font-mono">${label}</label><div style="margin-top:4px;">${html}</div></div>`;

  /* ======================== Progreso y eras ======================== */

  function taskActorDone(t, actor) {
    const v = state.tasks[t.id];
    if (v && typeof v === 'object') return Boolean(v[actor]);
    return Boolean(v);
  }
  function isTaskDone(t) {
    if (t.who === 'ambos') return taskActorDone(t, 'myth') && taskActorDone(t, 'scad');
    return taskActorDone(t, t.who);
  }
  function guestActorDone(q, gid, actorKey) {
    const v = (state.guestTasks[gid] || {})[q.id];
    if (v && typeof v === 'object') return Boolean(v[actorKey]);
    return Boolean(v);
  }
  function isGuestQuestDone(q, gid) {
    if (q.who === '3') return guestActorDone(q, gid, 'myth') && guestActorDone(q, gid, 'scad') && guestActorDone(q, gid, 'guest');
    return guestActorDone(q, gid, 'guest');
  }

  function eraStats(era) {
    const done = era.tasks.filter(isTaskDone).length;
    const req = era.tasks.filter(t => t.req);
    const reqDone = req.filter(isTaskDone).length;
    return { done, total: era.tasks.length, reqDone, reqTotal: req.length, complete: reqDone === req.length };
  }
  // Era actual = primera era con obligatorios pendientes (D.ERAS.length = Era ∞)
  function currentEraIndex() {
    const i = D.ERAS.findIndex(e => !eraStats(e).complete);
    return i === -1 ? D.ERAS.length : i;
  }
  const eraLabel = i => (i >= D.ERAS.length ? 'ERA ∞' : D.ERAS[i].code);

  const RAIL_GOALS = [{ era: 3, goal: 500 }, { era: 10, goal: 3000 }];
  function railGoal() {
    const cur = currentEraIndex();
    const g = RAIL_GOALS.find(x => x.era >= cur) || { goal: Math.max(3000, Math.ceil((state.railBlocks + 1) / 1000) * 1000) };
    return g.goal;
  }

  /* ======================== HUD ======================== */

  function renderHUD() {
    const all = D.ERAS.flatMap(e => e.tasks);
    const done = all.filter(isTaskDone).length;
    const pct = Math.round((done / all.length) * 100);
    $('hud-title').textContent = (state.world.worldName || 'Forever World').toUpperCase();
    $('hud-sub').innerHTML = `<strong class="text-royal">${esc(nat('myth').nation)}</strong> (${esc(nat('myth').player)}) &times; <strong class="text-emerald">${esc(nat('scad').nation)}</strong> (${esc(nat('scad').player)})`;
    $('hud-era').textContent = eraLabel(currentEraIndex());
    $('hud-xp-text').textContent = `${done} / ${all.length} hitos (${pct}%)`;
    $('hud-xp-bar').style.width = `${pct}%`;
    const r = E.rate(state);
    $('hud-fx-rate').textContent = `1 ${sym('M')} = ${r.toFixed(3)} ${sym('S')}`;
    $('hud-fx-status').textContent = state.economy.bank.M + state.economy.bank.S > 0
      ? (Math.abs(r - 1) < 0.02 ? 'Paridad' : r > 1 ? `${nat('myth').currency} fuerte` : `${nat('scad').currency} fuerte`)
      : `${state.settings.bankName}: sin fundar`;
    const sel = $('me-select');
    sel.innerHTML = `<option value="">— elegir —</option>` + peopleOpts(me) + `<option value="__new__">+ Agregar invitado...</option>`;
    document.title = `${state.world.worldName || 'Forever World'} — ${nat('myth').nation} & ${nat('scad').nation}`;
    const revAlerts = (state.laws || []).filter(l => l.repealed || (l.review && (l.review.status === 'pending' || l.review.status === 'returned'))).length;
    const badge = $('badge-state-rev');
    if (badge) {
      badge.style.display = revAlerts ? 'inline-flex' : 'none';
      badge.textContent = String(revAlerts);
    }
    renderCloudPill();
  }

  function renderCloudPill() {
    const label = $('hud-cloud-label');
    const sub = $('hud-cloud-sub');
    if (!label || !sub) return;
    if (!CLOUD) {
      label.textContent = 'Local';
      label.className = 'font-mono text-muted';
      sub.textContent = 'Sin nube';
      return;
    }
    const info = CLOUD.getInfo();
    const onlineCount = (info.onlinePlayers || []).length;
    const onlineTxt = onlineCount > 0 ? `${onlineCount} en línea` : (info.lastSyncAt ? when(info.lastSyncAt) : 'En línea');
    const map = {
      unconfigured: ['Nube', 'text-muted', 'Sin configurar'],
      connecting: ['Supabase', 'text-gold', 'Conectando...'],
      synced: ['Supabase', 'text-emerald', onlineTxt],
      syncing: ['Supabase', 'text-diamond', 'Guardando...'],
      conflict: ['Conflicto', 'text-redstone', 'Revisar copia'],
      error: ['Error nube', 'text-redstone', 'Toca para ver'],
      offline: ['Offline', 'text-gold', 'Solo local']
    };
    const [t, cls, s] = map[info.status] || map.unconfigured;
    label.textContent = t;
    label.className = `font-mono ${cls}`;
    sub.textContent = s;
  }

  /* ======================== Vista: Roadmap ======================== */

  function whoTag(who) {
    if (who === 'ambos') return `<span class="mc-tag tag-neutral">Ambos</span>`;
    return `<span class="mc-tag tag-${stateColor(who)}">${esc(nat(who).player)}</span>`;
  }

  function taskVisible(t) {
    const f = state.ui.filter;
    if (state.ui.track && t.track !== state.ui.track) return false;
    if (f === 'all') return true;
    if (f === 'guests') return false;
    if (f === 'pending') return !isTaskDone(t);
    if (f === 'req') return t.req;
    if (f === 'ambos') return t.who === 'ambos';
    return t.who === f || t.who === 'ambos';
  }

  function guestQuestCard(q, gid, locked) {
    const checked = isGuestQuestDone(q, gid);
    const track = D.TRACKS[q.track] || { tag: 'slate', name: q.track };
    const eraCode = D.ERAS[q.era] ? D.ERAS[q.era].code : '';
    const actors = q.who === '3'
      ? [{ pid: 'myth', key: 'myth' }, { pid: 'scad', key: 'scad' }, { pid: gid, key: 'guest' }]
      : [{ pid: gid, key: 'guest' }];
    const checksHtml = actors.map(a => {
      const aDone = guestActorDone(q, gid, a.key);
      const canToggle = !locked && me === a.pid;
      const tip = locked ? 'Era bloqueada' : canToggle ? `Marcar por ${pname(a.pid)}` : `Solo ${pname(a.pid)} puede marcar su casilla (selecciona en "Soy:")`;
      return `<label class="flex-row-wrap" style="gap:6px;align-items:center;cursor:${canToggle ? 'pointer' : 'not-allowed'};opacity:${canToggle || aDone ? '1' : '.62'};" title="${esc(tip)}">
        <div class="mc-check-wrap"><input type="checkbox" class="guest-check" data-g="${gid}" data-q="${q.id}" data-actor="${a.key}" data-pid="${a.pid}" ${aDone ? 'checked' : ''} ${canToggle ? '' : 'disabled'}/>
          <div class="mc-check-box"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="#ffffff" stroke-width="2.5" stroke-linecap="square"/></svg></div></div>
        ${actors.length > 1 ? `<span class="mc-tag ${aDone ? 'tag-emerald' : 'tag-slate'}" style="font-size:10px;">${esc(pname(a.pid))}</span>` : ''}
      </label>`;
    }).join('');
    return `<div class="task-card p-md ${checked ? 'completed enchanted-glint' : ''} ${locked ? 'locked' : ''}" style="display:flex;flex-direction:column;gap:8px;border-left:4px solid ${q.who === '3' ? '#ffaa00' : '#23a3b0'};" ${locked ? 'title="Era bloqueada"' : ''}>
      <div style="display:flex;gap:12px;align-items:flex-start;">
        ${actors.length === 1 ? checksHtml : ''}
        <div style="flex:1;min-width:0;">
          <div class="flex-row-wrap" style="gap:5px;margin-bottom:5px;">
            ${locked ? '<span class="mc-tag tag-slate">🔒</span>' : ''}
            <span class="mc-tag tag-cyan">${esc(pname(gid))}</span>
            <span class="mc-tag tag-slate">${esc(eraCode)}</span>
            ${q.who === '3' ? '<span class="mc-tag tag-gold">Los 3 (3 casillas)</span>' : ''}
            <span class="mc-tag tag-${track.tag}">${esc(track.name)}</span>
          </div>
          <div class="task-title text-sm text-white" style="font-weight:700;margin-bottom:4px;">${esc(tx(q.title))}</div>
          <p class="text-xs text-muted" style="margin:0 0 6px 0;line-height:1.45;">${esc(tx(q.desc))}</p>
          <div class="text-xs text-dim"><strong class="text-diamond">Prueba:</strong> ${esc(tx(q.proof))}</div>
          ${actors.length > 1 ? `<div class="flex-row-wrap" style="gap:10px;margin-top:8px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.12);">${checksHtml}</div>` : ''}
        </div>
      </div></div>`;
  }

  function renderRoadmap() {
    const curIdx = currentEraIndex();
    const activeGid = state.guests.length
      ? (state.guests.some(g => g.id === state.ui.guestSel) ? state.ui.guestSel : state.guests[0].id)
      : '';
    const guestLabel = activeGid ? pname(activeGid) : 'Invitados';
    const filters = [
      ['all', 'Todos'],
      ['myth', nat('myth').player],
      ['scad', nat('scad').player],
      ...(activeGid ? [['guests', guestLabel]] : []),
      ['ambos', 'Ambos / Los 3'],
      ['pending', 'Pendientes']
    ];
    const guestQuestVisible = q => {
      if (!activeGid) return false;
      const f = state.ui.filter;
      if (state.ui.track && q.track !== state.ui.track) return false;
      if (f === 'all' || f === 'guests') return true;
      if (f === 'pending') return !isGuestQuestDone(q, activeGid);
      if (f === 'ambos' || f === 'myth' || f === 'scad') return q.who === '3';
      return false;
    };
    const eraStrip = `<div class="era-strip">
      ${D.ERAS.map((e, idx) => {
        const s = eraStats(e);
        const cls = s.complete ? 'done' : idx === curIdx ? 'current' : '';
        const ico = s.complete ? '✔' : idx === curIdx ? '▶' : '🔒';
        return `<button class="era-chip ${cls}" data-action="jump-era" data-era="${e.id}" title="${esc(tx(e.name))}">${ico} ${e.code}</button>`;
      }).join('')}
      <button class="era-chip ${curIdx >= D.ERAS.length ? 'current' : ''}" data-action="jump-era" data-era="era-inf">∞ Temporadas</button>
    </div>`;

    const intro = panel(`
      ${head('CÓMO SE USA', 'cyan', 'ROADMAP DEL FOREVER WORLD',
        `Cada era tiene <strong>reglas técnicas</strong>, <strong>hitos</strong> y <strong>preguntas de lore</strong>. Para pasar de era solo cuentan los <strong class="text-gold">hitos obligatorios de ambos Estados</strong> (las misiones de <em>Extra</em> y las de <em>Invitados</em> son opcionales y no bloquean eras).`)}
      <div class="flex-between">
        <div class="flex-row-wrap" style="gap:6px;">
          ${filters.map(([v, t]) => `<button class="filter-pill ${state.ui.filter === v ? 'active' : ''}" data-action="filter" data-v="${v}">${esc(t)}</button>`).join('')}
        </div>
        <select class="mc-select font-mono" style="width:auto;" data-action-change="track">
          <option value="">Todas las áreas</option>
          ${opts(Object.entries(D.TRACKS).map(([k, v]) => [k, v.name]), state.ui.track)}
        </select>
      </div>
      ${eraStrip}`);

    const eras = D.ERAS.map((era, i) => {
      const s = eraStats(era);
      const status = s.complete ? `<span class="mc-tag tag-emerald">✔ COMPLETADA</span>` : i === curIdx ? `<span class="mc-tag tag-gold">▶ ERA ACTUAL</span>` : `<span class="mc-tag tag-slate">🔒 BLOQUEADA</span>`;
      const open = state.ui.open[era.id] ?? (i === curIdx);
      const tasks = era.tasks.filter(taskVisible);
      const eraGuestsAll = activeGid ? (D.GUEST_QUESTS || []).filter(q => q.era === i) : [];
      const eraGuests = eraGuestsAll.filter(guestQuestVisible);
      const eraGuestDone = activeGid ? eraGuestsAll.filter(q => isGuestQuestDone(q, activeGid)).length : 0;
      const pct = Math.round((s.done / s.total) * 100);
      const loreAns = state.lore[era.id] || {};
      const stateCardsHtml = tasks.map(t => taskCard(t, i > curIdx)).join('');
      const guestSectionHtml = eraGuests.length ? `
        <div class="guest-era-box">
          <div class="flex-between" style="margin-bottom:8px;">
            <span class="font-mono text-xs text-diamond" style="font-weight:700;">🧭 MISIONES OPCIONALES DE INVITADO (${esc(guestLabel)}: ${eraGuestDone}/${eraGuestsAll.length})</span>
            <span class="mc-tag tag-slate">No cuentan para desbloquear Era</span>
          </div>
          <div class="grid-2" style="gap:10px;">${eraGuests.map(q => guestQuestCard(q, activeGid, i > curIdx)).join('')}</div>
        </div>` : '';
      return `
      <details id="${era.id}" class="mc-panel p-lg era-card ${s.complete ? 'era-done' : i > curIdx ? 'era-locked' : ''}" data-era="${era.id}" ${open ? 'open' : ''}>
        <summary class="flex-between" style="cursor:pointer;list-style:none;">
          <div class="flex-row-wrap" style="gap:10px;">
            <div class="mc-slot" style="width:38px;height:38px;display:flex;align-items:center;justify-content:center;">${ICONS[era.icon] || ''}</div>
            <div>
              <div class="flex-row-wrap" style="gap:8px;"><span class="mc-tag tag-slate">${era.code}</span><h2 class="font-pixel text-white text-base" style="margin:0;">${esc(tx(era.name))}</h2>${status}</div>
              <p class="text-xs text-muted" style="margin:3px 0 0 0;">Obligatorios de Era: <strong class="text-white">${s.reqDone}/${s.reqTotal}</strong> · Total Estados: ${s.done}/${s.total}${eraGuestsAll.length ? ` · Invitado (opcional): ${eraGuestDone}/${eraGuestsAll.length}` : ''}</p>
            </div>
          </div>
          <div style="min-width:160px;"><div class="boss-bar-track"><div class="boss-bar-fill" style="width:${pct}%;background:${s.complete ? '#55ff55' : i === curIdx ? '#ffaa00' : '#8c8c8c'};"></div></div></div>
        </summary>
        <div style="margin-top:14px;">
          <p class="text-xs text-muted" style="margin:0 0 12px 0;line-height:1.55;"><strong class="text-white">Enfoque:</strong> ${esc(tx(era.focus))}</p>
          <div class="mc-panel-dark p-md" style="margin-bottom:14px;">
            <div class="text-xs" style="margin-bottom:10px;"><strong class="text-emerald font-mono">Economía:</strong> <span class="text-muted">${esc(tx(era.economy))}</span></div>
            <div class="grid-2">
              <ul class="mc-list">${era.allowed.map(x => `<li><span class="text-emerald">✔</span><span class="text-muted">${esc(tx(x))}</span></li>`).join('')}</ul>
              <ul class="mc-list">${era.banned.map(x => `<li><span class="text-redstone">✖</span><span class="text-muted">${esc(tx(x))}</span></li>`).join('')}</ul>
            </div>
          </div>
          ${i > curIdx ? `<div class="mc-slot p-sm text-xs text-gold" style="margin-bottom:10px;">🔒 Era bloqueada: completen los obligatorios de ${D.ERAS[curIdx] ? D.ERAS[curIdx].code : 'la era actual'} para poder marcar estos hitos.</div>` : ''}${stateCardsHtml ? `<div class="grid-2" style="gap:10px;">${stateCardsHtml}</div>` : (!guestSectionHtml ? empty('Ningún hito coincide con el filtro en esta era.') : '')}
          ${guestSectionHtml}
          <details class="mc-details" style="margin-top:14px;" ${Object.values(loreAns).some(Boolean) ? '' : ''}>
            <summary class="font-mono text-xs text-amethyst" style="font-weight:700;">▸ Preguntas de lore de ${era.code} (las responden ustedes)</summary>
            <div class="section-stack" style="margin-top:10px;">
              ${era.lore.map((q, qi) => `
                <div><label class="text-xs text-white">${esc(tx(q))}</label>
                <textarea class="mc-textarea" rows="2" style="margin-top:4px;" data-bind-live="lore.${era.id}.${qi}" placeholder="Su respuesta…">${esc(loreAns[qi] || '')}</textarea></div>`).join('')}
            </div>
          </details>
        </div>
      </details>`;
    }).join('');

    $('view-roadmap').innerHTML = intro + eras + renderGuestQuests(curIdx) + renderSeasons(curIdx);
  }

  function taskCard(t, locked) {
    const checked = isTaskDone(t);
    const track = D.TRACKS[t.track];
    const actors = t.who === 'ambos' ? ['myth', 'scad'] : [t.who];
    const checksHtml = actors.map(a => {
      const aDone = taskActorDone(t, a);
      const canToggle = !locked && me === a;
      const tip = locked ? 'Era bloqueada' : canToggle ? `Marcar por ${pname(a)}` : `Solo ${pname(a)} puede marcar su casilla (selecciona en "Soy:")`;
      return `<label class="flex-row-wrap" style="gap:6px;align-items:center;cursor:${canToggle ? 'pointer' : 'not-allowed'};opacity:${canToggle || aDone ? '1' : '.62'};" title="${esc(tip)}">
        <div class="mc-check-wrap">
          <input type="checkbox" class="task-check" data-task="${t.id}" data-actor="${a}" ${aDone ? 'checked' : ''} ${canToggle ? '' : 'disabled'} />
          <div class="mc-check-box"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke="#ffffff" stroke-width="2.5" stroke-linecap="square"/></svg></div>
        </div>
        ${actors.length > 1 ? `<span class="mc-tag ${aDone ? `tag-${stateColor(a)}` : 'tag-slate'}" style="font-size:10px;">${esc(nat(a).player)}</span>` : ''}
      </label>`;
    }).join('');
    return `
      <div class="task-card p-md ${checked ? 'completed enchanted-glint' : ''} ${locked ? 'locked' : ''}" style="display:flex;gap:12px;border-left:4px solid ${t.who === 'ambos' ? '#8b8b8b' : stateBorder(t.who)};" ${locked ? 'title="Era bloqueada"' : ''}>
        ${actors.length === 1 ? checksHtml : ''}
        <div style="flex:1;min-width:0;">
          <div class="flex-row-wrap" style="gap:5px;margin-bottom:5px;">
            ${locked ? '<span class="mc-tag tag-slate">🔒</span>' : ''}${whoTag(t.who)}${actors.length > 1 ? '<span class="mc-tag tag-slate">2 casillas</span>' : ''}<span class="mc-tag tag-${track.tag}">${esc(track.name)}</span>${t.req ? '' : '<span class="mc-tag tag-neutral">Extra</span>'}
          </div>
          <div class="task-title text-sm text-white" style="font-weight:700;margin-bottom:4px;">${esc(tx(t.title))}</div>
          <p class="text-xs text-muted" style="margin:0 0 6px 0;line-height:1.45;">${esc(tx(t.desc))}</p>
          <div class="text-xs font-mono text-dim"><strong class="text-diamond">Prueba:</strong> ${esc(tx(t.proof))}</div>
          ${actors.length > 1 ? `<div class="flex-row-wrap" style="gap:10px;margin-top:8px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.12);">${checksHtml}</div>` : ''}
        </div>
      </div>`;
  }

  // Misiones para invitados (jugadores sin Estado)
  function guestDone(gid) { return (D.GUEST_QUESTS || []).filter(q => isGuestQuestDone(q, gid)).length; }
  function renderGuestQuests(curIdx) {
    const Q = D.GUEST_QUESTS || [];
    const addForm = `<div class="flex-row-wrap" style="gap:6px;"><input id="guest-nick-rm" class="mc-input" style="flex:1;min-width:160px;" placeholder="Nick del invitado"/><button class="mc-btn mc-btn-diamond" data-action="guest-add" data-input="guest-nick-rm">+ Agregar invitado</button></div>`;
    const intro = head('INVITADOS (OPCIONAL)', 'cyan', 'MISIONES DE INVITADOS',
      `Para quien juega sin Estado: <strong>construir</strong> por encargo, <strong>pelear</strong> (purgas, raids y jefes), <strong>explorar</strong> y <strong>archivar</strong>. <strong>Sus misiones no cuentan ni bloquean el paso de Era de los Estados</strong>; solo se desbloquean al ritmo del mundo. Las marcadas <span class="mc-tag tag-gold">Los 3</span> llevan una casilla por jugador.`);
    if (!state.guests.length) return panel(`${intro}${empty('Todavía no hay invitados.')}<div style="margin-top:10px;">${addForm}</div>`);
    const gid = state.guests.some(g => g.id === state.ui.guestSel) ? state.ui.guestSel : state.guests[0].id;
    const n = guestDone(gid);
    const pct = Math.round((n / Q.length) * 100);
    const cards = Q.map(q => guestQuestCard(q, gid, q.era > curIdx)).join('');
    return panel(`${intro}
      <div class="flex-between" style="margin-bottom:12px;">
        <div class="flex-row-wrap" style="gap:8px;">
          <select class="mc-select" style="width:auto;" data-action-change="guest-sel">${opts(state.guests.map(g => [g.id, `${g.nick} · ${guestDone(g.id)}/${Q.length}`]), gid)}</select>
          <span class="text-xs text-muted">${n}/${Q.length} misiones (${pct}%)</span>
        </div>
        <div style="min-width:200px;"><div class="boss-bar-track"><div class="boss-bar-fill" style="width:${pct}%;background:#55ffff;"></div></div></div>
      </div>
      ${fold('guest-quests', `📜 Ver las misiones de ${esc(pname(gid))}`, `<div class="grid-2" style="gap:10px;">${cards}</div>`, true)}
      <details class="mc-details" style="margin-top:12px;"><summary class="text-xs text-diamond">+ Agregar otro invitado</summary><div style="margin-top:8px;">${addForm}</div></details>`);
  }

  function renderSeasons(curIdx) {
    const S = state.seasons;
    const unlocked = curIdx >= D.ERAS.length;
    const checks = D.SEASON_CHECKLIST.map(c => `
      <label class="flex-row-wrap text-xs" style="gap:8px;cursor:pointer;">
        <input type="checkbox" data-action-change="season-check" data-id="${c.id}" ${S.checks[c.id] ? 'checked' : ''} ${S.current ? '' : 'disabled'} />
        <span class="${S.checks[c.id] ? 'text-emerald' : 'text-muted'}">${esc(c.t)}</span>
      </label>`).join('');
    const roll = S.roll;
    const mega = state.mega;
    return `<div id="era-inf" style="scroll-margin-top: 135px;">${panel(`
      ${head('ERA ∞', 'emerald', 'LA ERA PERPETUA: TEMPORADAS',
        `Lo que hace que el mundo sea realmente <em>forever</em>. Cada temporada (la duración la deciden ustedes, sugerido 1 mes real) tiene una lista fija de cosas por hacer y tres sorteos: un reto cruzado, una expedición y una restricción. ${unlocked ? '' : `<strong class="text-gold">Se desbloquea al completar la ${D.ERAS[D.ERAS.length - 1].code} (${esc(D.ERAS[D.ERAS.length - 1].name)})</strong>, pero pueden mirarla desde ya.`}`)}
      <div class="grid-2">
        <div class="mc-panel-dark p-md">
          <div class="flex-between" style="margin-bottom:10px;">
            <strong class="font-pixel text-white text-sm">${S.current ? `TEMPORADA ${S.current}` : 'SIN TEMPORADA ACTIVA'}</strong>
            <div class="flex-row-wrap" style="gap:6px;">
              ${S.current ? `<button class="mc-btn" data-action="season-roll">🎲 Sortear</button><button class="mc-btn mc-btn-emerald" data-action="season-close">Cerrar temporada</button>`
                : `<button class="mc-btn mc-btn-emerald" data-action="season-start" ${unlocked ? '' : 'title="Aún no desbloqueada, pero se puede probar"'}>Iniciar temporada 1</button>`}
            </div>
          </div>
          ${roll ? `<div class="section-stack" style="gap:6px;margin-bottom:12px;">
            <div class="mc-slot p-sm text-xs"><strong class="text-diamond">Reto:</strong> <span class="text-muted">${esc(roll.reto)}</span></div>
            <div class="mc-slot p-sm text-xs"><strong class="text-gold">Expedición:</strong> <span class="text-muted">${esc(roll.exped)}</span></div>
            <div class="mc-slot p-sm text-xs"><strong class="text-redstone">Restricción:</strong> <span class="text-muted">${esc(roll.restr)}</span></div>
          </div>` : ''}
          <div class="section-stack" style="gap:6px;">${checks}</div>
          ${S.history.length ? `<hr class="mc-divider"/><div class="text-xs font-mono text-muted" style="margin-bottom:6px;">Temporadas cerradas</div>
            <ul class="mc-list">${S.history.map(h => `<li><span class="mc-tag tag-slate">T${h.n}</span><span class="text-muted">${esc(h.summary)} · ${when(h.t)}</span></li>`).join('')}</ul>` : ''}
        </div>
        <div class="mc-panel-dark p-md">
          <strong class="font-pixel text-white text-sm">MEGAPROYECTO ACTIVO</strong>
          <div style="margin:10px 0;">
            <input class="mc-input" data-bind="mega.name" value="${esc(mega.name)}" placeholder="Nombre del megaproyecto" />
          </div>
          <div class="section-stack" style="gap:6px;margin-bottom:10px;">
            ${mega.stages.length ? mega.stages.map((st, i) => `
              <div class="flex-between mc-slot p-sm">
                <label class="flex-row-wrap text-xs" style="gap:8px;cursor:pointer;"><input type="checkbox" data-action-change="mega-stage" data-i="${i}" ${st.done ? 'checked' : ''}/><span class="${st.done ? 'text-emerald' : 'text-white'}">${i + 1}. ${esc(st.t)}</span></label>
                <button class="mc-btn" style="padding:2px 6px;" data-action="mega-del" data-i="${i}">✕</button>
              </div>`).join('') : '<div class="text-xs text-dim">Sin etapas todavía.</div>'}
          </div>
          <div class="flex-row-wrap" style="gap:6px;"><input id="mega-stage" class="mc-input" style="flex:1;" placeholder="Nueva etapa (ej. cimientos y plano)"/><button class="mc-btn mc-btn-emerald" data-action="mega-add">+ Etapa</button></div>
          <details class="mc-details" style="margin-top:12px;">
            <summary class="text-xs font-mono text-diamond">▸ Ideas de megaproyectos</summary>
            <ul class="mc-list" style="margin-top:8px;">${D.MEGAPROJECTS.map(m => `<li><span class="text-gold">◆</span><span class="text-muted">${esc(m)}</span></li>`).join('')}</ul>
          </details>
        </div>
      </div>`)}</div>`;
  }

  /* ======================== Vista: Economía ======================== */

  function treasuryCard(s) {
    const c = curOf(s);
    const oc = E.otherCur(c);
    const h = E.holdings(state, s);
    const cap = E.capitalization(state, s, CATS);
    const iss = E.issued(state, c);
    const room = Math.max(0, E.r4(cap - iss));
    const over = Math.max(0, E.r4(iss - cap));
    const pctUsed = Math.min(100, Math.round((iss / Math.max(1, cap)) * 100));
    const debt = E.bankDebt(state, s);
    const mora = E.inDefault(state, s);
    const book = E.shareBook(state, s);
    const outside = Object.entries(book).filter(([p]) => p !== s).reduce((a, [, n]) => a + n, 0);
    const color = stateColor(s);
    const healthTag = mora
      ? `<span class="mc-tag tag-redstone">⚠ En mora</span>`
      : over > 0
        ? `<span class="mc-tag tag-redstone">⚠ Inflación</span>`
        : `<span class="mc-tag tag-emerald">✔ Sana</span>`;
    const quickAmounts = [10, 25, 50];
    return `
      <div class="mc-panel-dark p-md" style="border-color:${stateBorder(s)};display:flex;flex-direction:column;gap:10px;">
        <div class="flex-between">
          <div>
            <strong class="font-mono text-${color} text-sm">${esc(nat(s).nation.toUpperCase())}</strong>
            <div class="text-xs text-dim">${esc(nat(s).player)} · ${esc(nat(s).currency)} (${esc(sym(c))})</div>
          </div>
          ${healthTag}
        </div>
        <div class="mc-slot p-sm">
          <div class="text-xs text-muted">Disponible en tesoro ${tip('tesoro')}</div>
          <div class="eco-treasury-big" style="margin-top:2px;">${fmt(h[c])} <span class="text-${color}" style="font-size:1rem;">${esc(sym(c))}</span></div>
          ${h[oc] > 0 ? `<div class="text-xs font-mono text-dim" style="margin-top:2px;">+ ${money(h[oc], oc)} en reserva extranjera</div>` : `<div class="text-xs font-mono text-dim" style="margin-top:2px;">Sin divisas del socio</div>`}
        </div>
        <div class="eco-mini-grid text-xs">
          <div class="eco-stat-cell"><div class="text-dim">Respaldo ${tip('respaldo')}</div><strong class="font-mono text-emerald">${fmt(cap)}</strong></div>
          <div class="eco-stat-cell"><div class="text-dim">Emitido / Techo ${tip('techo')}</div><strong class="font-mono ${over > 0 ? 'text-redstone' : 'text-gold'}">${fmt(iss)} / ${fmt(cap)}</strong></div>
          <div class="eco-stat-cell"><div class="text-dim">Acción ${tip('precioAccion')}</div><strong class="font-mono text-white">${money(E.sharePrice(state, s, CATS), c)}</strong> <span class="text-dim">(${outside}/${state.settings.sharesTotal})</span></div>
          <div class="eco-stat-cell"><div class="text-dim">Deuda Cámara ${tip('prestamo')}</div><strong class="font-mono ${mora ? 'text-redstone' : 'text-white'}">${money(debt, c)}</strong></div>
        </div>
        <div>
          <div class="flex-between text-xs font-mono" style="margin-bottom:4px;">
            <span class="text-muted">Uso de techo (${pctUsed}%)</span>
            ${over > 0 ? `<span class="text-redstone">Exceso ${money(over, c)}</span>` : `<span class="text-emerald">Margen +${money(room, c)}</span>`}
          </div>
          <div class="boss-bar-track"><div class="boss-bar-fill" style="width:${pctUsed}%;background:${over > 0 ? '#ff5555' : pctUsed > 85 ? '#ffaa00' : '#55ff55'};"></div></div>
          ${over > 0 ? `<div class="text-xs text-redstone font-mono" style="margin-top:5px;">⚠ Inflación ${tip('inflacion')}: quema ${money(over, c)} o audita obras para restaurar paridad.</div>` : ''}
        </div>
        <div style="margin-top:auto;">
          <div class="flex-between text-xs text-muted font-mono" style="margin-bottom:5px;">
            <span>Casa de moneda ${tip('imprimir')} ${tip('quemar')}</span>
            <span class="flex-row-wrap" style="gap:4px;">
              ${quickAmounts.map(n => `<button type="button" class="eco-quick-chip" data-action="mint-fill" data-s="${s}" data-v="${n}">+${n}</button>`).join('')}
              ${room > 0 ? `<button type="button" class="eco-quick-chip" data-action="mint-fill" data-s="${s}" data-v="${room}" title="Llenar margen imprimible">Máx</button>` : ''}
            </span>
          </div>
          <div class="flex-row-wrap" style="gap:6px;">
            <input id="mint-${s}" type="number" step="0.01" min="1" value="10" class="mc-input font-mono" style="width:86px;"/>
            <button class="mc-btn mc-btn-${color}" data-action="mint" data-s="${s}" style="flex:1;">Imprimir</button>
            <button class="mc-btn" data-action="burn" data-s="${s}" style="flex:1;">Quemar</button>
          </div>
        </div>
      </div>`;
  }

  function sparkline() {
    const h = state.economy.fxHistory.slice(-60);
    if (h.length < 2) return '<div class="text-xs text-dim" style="text-align:center;">El gráfico aparece con el primer movimiento cambiario.</div>';
    const rs = h.map(p => p.r);
    const min = Math.min(...rs, 1) * 0.98, max = Math.max(...rs, 1) * 1.02;
    const W = 260, H = 56;
    const coords = rs.map((r, i) => [((i / (rs.length - 1)) * W).toFixed(1), (H - ((r - min) / (max - min)) * H).toFixed(1)]);
    const pts = coords.map(c => c.join(',')).join(' ');
    const area = `0,${H} ${pts} ${W},${H}`;
    const y1 = H - ((1 - min) / (max - min)) * H;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" aria-label="Historial del tipo de cambio">
      <line x1="0" y1="${y1}" x2="${W}" y2="${y1}" stroke="#64748b" stroke-dasharray="3 3"/>
      <polygon points="${area}" fill="rgba(85,255,85,0.12)"/>
      <polyline points="${pts}" fill="none" stroke="#55ff55" stroke-width="2"/></svg>`;
  }

  function bankCard() {
    const b = state.economy.bank;
    const r = E.rate(state);
    const founded = b.M + b.S > 0;
    const drift = Math.abs(r - 1);
    const statusLabel = !founded ? 'Sin fundar' : drift < 0.02 ? 'En paridad' : r > 1 ? `${nat('myth').currency} fuerte` : `${nat('scad').currency} fuerte`;
    return `
      <div class="mc-panel-dark p-md" style="border-color:#6b1f6b;display:flex;flex-direction:column;gap:10px;">
        <div class="flex-between">
          <div>
            <strong class="font-mono text-amethyst text-sm">${esc(state.settings.bankName.toUpperCase())} ${tip('camara')}</strong>
            <div class="text-xs text-dim">${esc(statusLabel)} · ${tip('cambio')} flotante</div>
          </div>
          ${ICONS.ender_eye || ''}
        </div>
        <div class="mc-slot p-md" style="text-align:center;">
          <div class="font-pixel text-emerald" style="font-size:1.25rem;">1 ${esc(sym('M'))} = ${r.toFixed(3)} ${esc(sym('S'))}</div>
          <div class="font-pixel text-gold" style="font-size:.95rem;margin-top:3px;">1 ${esc(sym('S'))} = ${(1 / r).toFixed(3)} ${esc(sym('M'))}</div>
          <div class="text-xs text-muted font-mono" style="margin-top:6px;">${tip('oe')} 1 ${esc(sym('U'))} = ${E.uiValue(state, 'M').toFixed(3)} ${esc(sym('M'))} = ${E.uiValue(state, 'S').toFixed(3)} ${esc(sym('S'))}</div>
          <div style="margin-top:8px;">${sparkline()}</div>
        </div>
        <div class="eco-mini-grid text-xs">
          <div class="eco-stat-cell"><div class="text-dim">Reserva ${esc(sym('M'))} ${tip('reservas')}</div><strong class="font-mono text-royal">${money(b.M, 'M')}</strong></div>
          <div class="eco-stat-cell"><div class="text-dim">Reserva ${esc(sym('S'))} ${tip('reservas')}</div><strong class="font-mono text-emerald">${money(b.S, 'S')}</strong></div>
        </div>
        ${founded ? '' : `<div class="mc-panel-dark p-sm text-xs text-gold" style="border-color:var(--c-gold);">
          Sin reservas activas. Realicen el aporte inicial conjunto para habilitar conversiones:
          <button class="mc-btn mc-btn-amethyst" style="margin-top:6px;width:100%;" data-action="deposit-quick">⚡ Fundar con 40 ${esc(sym('M'))} + 40 ${esc(sym('S'))}</button>
        </div>`}
        <div>
          <div class="text-xs text-muted font-mono" style="margin-bottom:4px;">Aporte conjunto de liquidez ${tip('aporte')}</div>
          <div class="flex-row-wrap" style="gap:6px;">
            <input id="deposit-m" type="number" step="0.01" min="1" value="40" class="mc-input font-mono" style="width:80px;"/>
            <span class="text-xs text-muted">${esc(sym('M'))} + equiv. ${esc(sym('S'))}</span>
            <button class="mc-btn mc-btn-amethyst" data-action="deposit" style="flex:1;">Aportar</button>
          </div>
        </div>
        <div style="margin-top:auto;">
          <div class="text-xs text-muted font-mono" style="margin-bottom:4px;">Convertir moneda ${tip('deslizamiento')}</div>
          <div class="grid-3" style="gap:6px;">
            <select id="swap-who" class="mc-select font-mono">${peopleOpts(me || 'myth')}</select>
            <select id="swap-from" class="mc-select font-mono">${curOpts('M')}</select>
            <input id="swap-amt" type="number" step="0.01" min="1" value="10" class="mc-input font-mono"/>
          </div>
          <div class="flex-between" style="margin-top:6px;"><span id="swap-preview" class="text-xs font-mono text-diamond"></span><button class="mc-btn" data-action="swap">Cambiar</button></div>
        </div>
      </div>`;
  }

  function priceRows(s, shopQ = '') {
    const q = (shopQ || '').trim().toLowerCase();
    const allItems = state.economy.prices.filter(p => p.seller === s);
    const items = q ? allItems.filter(p => (p.name + ' ' + (p.unit || '')).toLowerCase().includes(q)) : allItems;
    if (!allItems.length) return empty('Sin productos. Agreguen lo que este Estado vende.');
    if (!items.length) return empty('Sin coincidencias para esa búsqueda.');
    const c = curOf(s);
    return `<table class="mc-table"><thead><tr><th>Producto</th><th>Precio</th><th>En ${esc(sym(E.otherCur(c)))}</th><th></th></tr></thead><tbody>
      ${items.map(p => `<tr>
        <td><div class="text-white" style="font-weight:700;">${esc(p.name)}</div><div class="text-xs text-dim">${esc(p.unit || '')}</div></td>
        <td><div class="flex-row-wrap" style="gap:4px;flex-wrap:nowrap;"><input type="number" min="0" step="0.01" value="${p.price}" class="mc-input font-mono" style="width:70px;padding:3px 5px;" id="price-${p.id}"/><span class="text-xs">${esc(sym(c))}</span></div></td>
        <td class="font-mono text-xs text-emerald">${fmt(E.convert(state, p.price, c, E.otherCur(c)))}</td>
        <td><div class="flex-row-wrap" style="gap:4px;flex-wrap:nowrap;">
          <button class="mc-btn" style="padding:3px 6px;" data-action="price-set" data-id="${p.id}" title="Guardar nuevo precio">✔</button>
          <button class="mc-btn mc-btn-emerald" style="padding:3px 6px;" data-action="price-buy" data-id="${p.id}" title="Comprar">🛒</button>
          <button class="mc-btn mc-btn-amethyst" style="padding:3px 6px;" data-action="price-challenge" data-id="${p.id}" title="Impugnar con oferta sellada">⚖</button>
          <button class="mc-btn" style="padding:3px 6px;" data-action="price-del" data-id="${p.id}">✕</button>
        </div></td></tr>`).join('')}
      </tbody></table>`;
  }

  function renderEconomy() {
    const eco = state.economy;
    const sealed = eco.sealed;
    const effPts = E.effectiveWorkPoints(state, CATS);
    const worksF = state.ui.worksFilter || 'all';
    const works = eco.works.filter(w => worksF === 'all' || (worksF === 'pendiente' ? w.status === 'pendiente' : w.owner === worksF));
    const ledgerQ = (state.ui.ledgerQ || '').toLowerCase();
    const ledgerTypeF = state.ui.ledgerType || 'all';
    const matchesLedgerType = l => {
      if (ledgerTypeF === 'all') return true;
      if (ledgerTypeF === 'void') return Boolean(l.void);
      const lt = (l.type || '').toLowerCase();
      if (ledgerTypeF === 'compra') return lt.includes('compra') || lt.includes('transfer');
      if (ledgerTypeF === 'cambio') return lt.includes('cambio') || lt.includes('banco');
      if (ledgerTypeF === 'emision') return lt.includes('emisión') || lt.includes('quema') || lt.includes('ajuste');
      if (ledgerTypeF === 'credito') return lt.includes('préstamo') || lt.includes('pago') || lt.includes('acció') || lt.includes('dividendo') || lt.includes('mora');
      return true;
    };
    const ledger = eco.ledger.filter(l => matchesLedgerType(l) && (!ledgerQ || (l.type + ' ' + l.text + ' ' + l.by).toLowerCase().includes(ledgerQ)));

    const quickBanner = `
      <div class="mc-panel-dark p-sm flex-between" style="margin-bottom:12px;border-left:3px solid var(--c-gold);gap:10px;">
        <div class="text-xs text-muted">
          <strong class="text-gold">📘 Sistema Económico de Miscolandia:</strong> el tipo de cambio flota en ${esc(state.settings.bankName)}; las obras auditadas (<span class="font-mono text-diamond">TRD 120-01</span>) suben el techo; todo asiento queda en <span class="font-mono text-diamond">TRD 130-01</span> sin borrarse.
        </div>
        <button class="mc-btn mc-btn-gold" style="padding:4px 9px;white-space:nowrap;" data-action="eco-tab" data-v="manual">📘 Abrir Manual Económico</button>
      </div>`;

    const guestWalletCards = state.guests.length
      ? state.guests.map(g => {
          const gh = E.holdings(state, g.id);
          const sh = STATES.map(s => `${E.shareBook(state, s)[g.id] || 0} acc. ${nat(s).nation}`).join(' · ');
          return `<div class="mc-slot p-sm">
            <div class="flex-between"><strong class="text-diamond text-xs">${esc(g.nick)}</strong><span class="mc-tag tag-slate">Invitado</span></div>
            <div class="font-mono text-xs text-white" style="margin-top:4px;">${money(gh.M, 'M')} · ${money(gh.S, 'S')}</div>
            <div class="text-xs text-dim" style="margin-top:2px;">${esc(sh)}</div>
          </div>`;
        }).join('')
      : '<div class="text-xs text-dim">Sin invitados registrados todavía.</div>';

    const recentLedgerRows = eco.ledger.slice(0, 5);
    const overviewFooter = panel(`
      <div class="grid-2" style="gap:14px;">
        <div>
          <div class="flex-between" style="margin-bottom:8px;">
            <strong class="font-mono text-diamond text-xs">🧭 BOLSILLOS DE INVITADOS</strong>
            <span class="text-xs text-dim">${state.guests.length} participante(s)</span>
          </div>
          <div class="section-stack" style="gap:6px;">${guestWalletCards}</div>
        </div>
        <div>
          <div class="flex-between" style="margin-bottom:8px;">
            <strong class="font-mono text-gold text-xs">📒 ÚLTIMOS ASIENTOS (TRD 130-01)</strong>
            <button class="mc-btn" style="padding:2px 8px;font-size:11px;" data-action="eco-tab" data-v="finance">Ver Libro Mayor (${eco.ledger.length}) →</button>
          </div>
          ${recentLedgerRows.length ? `<div class="section-stack" style="gap:5px;">${recentLedgerRows.map(l => `<div class="mc-slot p-sm flex-between" style="gap:8px;opacity:${l.void ? '.55' : '1'};">
            <div style="min-width:0;flex:1;">
              <span class="mc-tag ${l.void ? 'tag-redstone' : 'tag-slate'}" style="font-size:10px;">${l.void ? 'ANULADO' : esc(l.type)}</span>
              <span class="text-xs text-muted" style="margin-left:5px;${l.void ? 'text-decoration:line-through;' : ''}">${esc(l.text)}</span>
            </div>
            <span class="font-mono text-xs text-dim" style="white-space:nowrap;">${when(l.t)}</span>
          </div>`).join('')}</div>` : empty('Sin movimientos contables todavía.')}
        </div>
      </div>`);

    const top = panel(`
      ${head('TESORERÍA Y BANCO', 'emerald', 'TESOROS, RESPALDO Y TIPO DE CAMBIO',
        `Moneda sana respaldada por obras verificadas (<span class="font-mono">TRD 120-01</span>) e intercambio neutral en ${esc(state.settings.bankName)}.`)}
      ${quickBanner}
      <div data-undo-slot style="margin-bottom:12px;"></div>
      <div class="grid-3" style="align-items:stretch;">${treasuryCard('myth')}${bankCard()}${treasuryCard('scad')}</div>`);

    // Compra y transferencia
    const buySeller = state.ui.buySeller || 'scad';
    const sellerItems = eco.prices.filter(p => p.seller === buySeller);
    const buyInner = `
        <div class="grid-2" style="gap:8px;">
          ${field('Vendedor', `<select id="buy-seller" class="mc-select font-mono" data-action-change="buy-seller">${stateOpts(buySeller)}</select>`)}
          ${field('Comprador', `<select id="buy-buyer" class="mc-select font-mono">${peopleOpts(state.ui.buyBuyer && state.ui.buyBuyer !== buySeller ? state.ui.buyBuyer : E.otherState(buySeller), participants().filter(p => p !== buySeller))}</select>`)}
          ${field('Producto', `<select id="buy-item" class="mc-select" data-action-change="buy-item">${opts([...sellerItems.map(p => [p.id, `${p.name} — ${fmt(p.price)} ${sym(curOf(buySeller))}`]), ['__otro', 'Otro (precio acordado)']], state.ui.buyItem)}</select>`)}
          ${field('Cantidad', `<input id="buy-qty" type="number" min="1" value="1" class="mc-input font-mono"/>`)}
          ${field(`Precio unitario (${esc(sym(curOf(buySeller)))})`, `<input id="buy-price" type="number" min="0" step="0.01" class="mc-input font-mono"/>`)}
          ${field('Concepto', `<input id="buy-note" class="mc-input" placeholder="Ej. 2 stacks de hierro"/>`)}
        </div>
        <div id="buy-preview" class="mc-slot p-sm text-xs font-mono" style="margin:10px 0;"></div>
        <button class="mc-btn mc-btn-emerald" data-action="buy" style="width:100%;">Registrar compra en Libro Mayor</button>`;
    const payInner = `
        <div class="grid-2" style="gap:8px;">
          ${field('De', `<select id="tr-from" class="mc-select font-mono">${peopleOpts(me || 'myth')}</select>`)}
          ${field('Para', `<select id="tr-to" class="mc-select font-mono">${peopleOpts('scad')}</select>`)}
          ${field('Moneda', `<select id="tr-cur" class="mc-select font-mono">${curOpts('M')}</select>`)}
          ${field('Monto', `<input id="tr-amt" type="number" step="0.01" min="0" value="10" class="mc-input font-mono"/>`)}
        </div>
        <div style="margin:8px 0;">${field('Concepto', `<input id="tr-note" class="mc-input" placeholder="Ej. Contrato obra norte / Reparación Ley 001"/>`)}</div>
        <button class="mc-btn mc-btn-diamond" data-action="transfer" style="width:100%;">Transferir y asentar</button>
        <p class="text-xs text-dim" style="margin:8px 0 0 0;">Si quien paga no tiene esa moneda, la Cámara convierte automáticamente el faltante.</p>`;
    const trade = `<div class="grid-2">
      ${panel(`${head('COMPRAR', 'emerald', 'REGISTRAR UNA COMPRA', 'Se liquida en la moneda del vendedor y deja asiento contable automático en TRD 130-01.')}${buyInner}`)}
      ${panel(`${head('TRANSFERIR', 'cyan', 'PAGOS, CONTRATOS Y SANCIONES', 'Contratos de obra, nómina de invitados, recompensas o reparaciones económicas.')}${payInner}`)}
    </div>`;

    // Listas de precios + oferta sellada
    const shopQ = state.ui.shopQ || '';
    const prices = panel(`
      ${head('PRECIOS', 'gold', `LISTAS OFICIALES DE PRECIOS ${tip('tarifa')}`,
        `Precio público único en la moneda del vendedor. <strong>Regla del minuto</strong>: 1 moneda ≈ 1 minuto de ahorro. Pulsa 🛒 para comprar o ⚖ para impugnar con Oferta Sellada.`)}
      <div style="margin-bottom:10px;"><input class="mc-input" data-bind-live="ui.shopQ" data-rerender="economy" value="${esc(shopQ)}" placeholder="🔍 Filtrar producto en ambas tiendas…"/></div>
      <div class="grid-2">
        ${STATES.map(s => `<div class="mc-panel-dark p-md">
          <div class="flex-between" style="margin-bottom:8px;"><strong class="font-mono text-${stateColor(s)} text-sm">${esc(nat(s).nation)} vende</strong><span class="mc-tag tag-${stateColor(s)}">${esc(sym(curOf(s)))} · ${eco.prices.filter(p => p.seller === s).length} ítems</span></div>
          <div style="overflow-x:auto;">${priceRows(s, shopQ)}</div>
          <div class="grid-3" style="gap:6px;margin-top:10px;">
            <input id="np-name-${s}" class="mc-input" placeholder="Producto"/>
            <input id="np-unit-${s}" class="mc-input" placeholder="Unidad (ej. stack)"/>
            <div class="flex-row-wrap" style="gap:4px;flex-wrap:nowrap;"><input id="np-price-${s}" type="number" min="0" step="0.01" class="mc-input font-mono" placeholder="Precio"/><button class="mc-btn mc-btn-emerald" data-action="price-add" data-s="${s}">+</button></div>
          </div>
        </div>`).join('')}
      </div>`);

    const guideOpen = eco.prices.length === 0;
    const guide = `
      <details class="mc-panel p-lg" ${guideOpen ? 'open' : ''}>
        <summary class="flex-between" style="cursor:pointer;list-style:none;">
          <div>
            <span class="mc-tag tag-gold">REFERENCIA</span>
            <strong class="font-pixel text-gold text-base" style="margin-left:8px;">GUÍA DE PRECIOS SUGERIDOS (REGLA DEL MINUTO)</strong>
            <span class="text-xs text-muted" style="margin-left:8px;">(${D.PRICE_GUIDE.length} productos base para iniciar tiendas)</span>
          </div>
          <span class="text-xs font-mono text-dim">▸ Desplegar / ocultar</span>
        </summary>
        <div class="grid-2" style="margin-top:14px;">
          ${STATES.map(s => `<div class="mc-panel-dark p-md"><div class="flex-between"><strong class="font-mono text-${stateColor(s)} text-sm">${esc(nat(s).nation)}</strong>
              <button class="mc-btn mc-btn-${stateColor(s)}" style="padding:3px 8px;" data-action="guide-add-all" data-s="${s}">+ Agregar todos a su tienda</button></div>
            <div style="overflow-x:auto;margin-top:8px;"><table class="mc-table"><thead><tr><th>Producto</th><th>Precio</th><th></th></tr></thead><tbody>
            ${D.PRICE_GUIDE.map((g, i) => ({ g, i })).filter(x => x.g.seller === s).map(({ g, i }, k, arr) => {
              const listed = eco.prices.some(p => p.seller === s && p.name === g.name);
              const header = k === 0 || arr[k - 1].g.group !== g.group ? `<tr><td colspan="3" class="font-mono text-xs text-gold" style="padding-top:12px;font-weight:700;">${esc(g.group.toUpperCase())}</td></tr>` : '';
              return header + `<tr><td><div class="text-white text-xs" style="font-weight:700;">${esc(g.name)}</div><div class="text-xs text-dim">${esc(g.unit)}${g.note ? ' · ' + esc(tx(g.note)) : ''}</div></td>
                <td class="font-mono text-xs" style="white-space:nowrap;">${fmt(g.price)} ${esc(sym(curOf(s)))}</td>
                <td>${listed ? '<span class="text-xs text-emerald">✔</span>' : `<button class="mc-btn" style="padding:2px 7px;" data-action="guide-add" data-i="${i}" title="Agregar a la lista">+</button>`}</td></tr>`;
            }).join('')}</tbody></table></div></div>`).join('')}
        </div>
      </details>`;

    const sealedRes = sealed.last;
    const sealedPanel = panel(`
      ${head('OFERTA SELLADA', 'amethyst', `CUANDO NO SE PONEN DE ACUERDO EN UN PRECIO ${tip('ofertaSellada')}`,
        `El vendedor escribe en secreto lo mínimo que acepta; el comprador, lo máximo que pagaría. Si la oferta alcanza al pedido, el precio es el <strong>punto medio</strong>. Si no, hay un segundo intento; si vuelve a fallar, se impone el punto medio. Si están en PCs distintos, envíense el número por mensaje privado al mismo tiempo.`)}
      <div class="grid-4" style="gap:8px;align-items:end;">
        ${field('Qué se negocia', `<input id="sb-item" class="mc-input" value="${esc(sealed.item)}" placeholder="Ej. Libro de Mending"/>`)}
        ${field('Vendedor', `<select id="sb-seller" class="mc-select font-mono">${stateOpts(sealed.seller)}</select>`)}
        ${field('Pedido del vendedor', `<input id="sb-ask" type="password" inputmode="decimal" class="mc-input font-mono" placeholder="•••"/>`)}
        ${field('Oferta del comprador', `<input id="sb-bid" type="password" inputmode="decimal" class="mc-input font-mono" placeholder="•••"/>`)}
      </div>
      <div class="flex-between" style="margin-top:10px;">
        <span class="text-xs font-mono text-muted">Intento ${sealed.attempt} de 2</span>
        <div class="flex-row-wrap" style="gap:6px;"><button class="mc-btn" data-action="sb-reset">Reiniciar</button><button class="mc-btn mc-btn-amethyst" data-action="sb-reveal">Revelar</button></div>
      </div>
      ${sealedRes ? `<div class="mc-slot p-md text-sm" style="margin-top:10px;">
        Pedido <strong class="font-mono">${fmt(sealedRes.ask)}</strong> · Oferta <strong class="font-mono">${fmt(sealedRes.bid)}</strong> →
        ${sealedRes.deal ? `<strong class="text-emerald">Precio: ${fmt(sealedRes.price)} ${esc(sym(curOf(sealedRes.seller)))}</strong>${sealedRes.forced ? ' <span class="text-gold">(impuesto tras 2 intentos)</span>' : ''}
          ${sealedRes.priceId ? ` <button class="mc-btn mc-btn-emerald" style="margin-left:8px;" data-action="sb-apply">Aplicar a la lista</button>` : ''}`
          : `<strong class="text-redstone">Sin acuerdo</strong> (diferencia ${fmt(sealedRes.gap)}). Segundo intento.`}
      </div>` : ''}`);

    // Obras (TRD 120-01)
    const auditedWorks = eco.works.filter(w => w.status === 'auditada');
    const mythWorkPts = auditedWorks.filter(w => w.owner === 'myth').reduce((a, w) => a + (effPts[w.id] || 0), 0);
    const scadWorkPts = auditedWorks.filter(w => w.owner === 'scad').reduce((a, w) => a + (effPts[w.id] || 0), 0);
    const workForm = `
      <div class="mc-panel-dark p-md" style="margin-bottom:14px;">
        <div class="grid-4" style="gap:8px;align-items:end;">
          ${field('Dueño', `<select id="w-owner" class="mc-select font-mono">${stateOpts(E.isState(me) ? me : 'myth')}</select>`)}
          ${field('Categoría', `<select id="w-cat" class="mc-select" data-action-change="w-cat">${opts(CATS.map(c => [c.id, `${c.name} (${c.pts})`]), 'edif')}</select>`)}
          ${field('Nombre en el mundo', `<input id="w-name" class="mc-input" placeholder="Ej. Siderúrgica del Norte"/>`)}
          ${field('Producto (granja) o reliquia', `<input id="w-product" class="mc-input" list="relic-list" placeholder="Ej. hierro / Tridente"/><datalist id="relic-list">${(D.FARM_LOCKS || []).map(l => `<option value="${esc(l.aliases[0])}">Granja: ${esc(l.label)} (bloquea a mano al auditarse)</option>`).join('')}${D.RELICS.map(r => `<option value="${esc(r.name)}"></option>`).join('')}</datalist>`)}
          ${field('Coordenadas', `<input id="w-coords" class="mc-input font-mono" placeholder="X, Y, Z"/>`)}
          ${field('Puntos propuestos', `<input id="w-pts" type="number" min="1" value="10" class="mc-input font-mono"/>`)}
          <div style="grid-column:span 2;display:flex;align-items:end;"><button class="mc-btn mc-btn-emerald" data-action="work-add" style="width:100%;">+ Registrar obra (TRD 120-01)</button></div>
        </div>
      </div>`;
    // Bloqueo automático por granjas: lo que el moderador del servidor ya no deja conseguir a mano
    const locksNow = typeof D.activeFarmLocks === 'function' ? D.activeFarmLocks(state) : [];
    const lockedIds = new Set(locksNow.map(x => x.lock.id));
    const farmLocksCard = `
      <div class="mc-panel-dark p-md" style="margin-bottom:14px;">
        <div class="flex-between" style="margin-bottom:8px;">
          <strong class="font-mono text-gold text-sm">🔒 BLOQUEOS ACTIVOS POR GRANJA</strong>
          <span class="text-xs text-muted">${locksNow.length} de ${(D.FARM_LOCKS || []).length} productos</span>
        </div>
        <p class="text-xs text-muted" style="margin:0 0 10px 0;line-height:1.5;">Cuando auditan una obra de categoría <strong>Granja automática</strong> cuyo producto está en esta lista, conseguir ese producto <strong>a mano</strong> queda bloqueado para todos menos el dueño de la granja: se compra en su tienda. El moderador del servidor lo vigila y le entrega al dueño lo que otros consigan a mano. Excepciones: <span class="font-mono text-diamond">!permiso &lt;jugador&gt; &lt;producto&gt; [tiempo]</span>, que solo puede dar el dueño. Si la granja se marca como perdida, el bloqueo se levanta.</p>
        ${locksNow.length ? `<div class="section-stack" style="gap:6px;margin-bottom:10px;">${locksNow.map(x => `
          <div class="flex-between mc-slot p-sm">
            <div><strong class="text-white text-sm">${esc(x.lock.label)}</strong> <span class="text-xs text-muted">· granja «${esc(x.work.name)}» de</span> ${ptag(x.owner)}</div>
            <span class="text-xs text-dim">desde ${x.since ? when(x.since) : '—'}</span>
          </div>`).join('')}</div>` : `<div class="text-xs text-dim" style="margin-bottom:10px;">Ningún bloqueo todavía: fuera de la comida, todo se puede conseguir a mano para uso propio.</div>`}
        <details class="mc-details"><summary class="text-xs text-diamond">▸ Productos que se bloquean al auditar su granja</summary>
          <div class="flex-row-wrap" style="gap:6px;margin-top:8px;">${(D.FARM_LOCKS || []).map(l => `<span class="mc-tag ${lockedIds.has(l.id) ? 'tag-redstone' : `tag-${stateColor(l.owner)}`}" title="Palabras que lo reconocen: ${esc(l.aliases.join(', '))}">${lockedIds.has(l.id) ? '🔒 ' : ''}${esc(l.label)} · ${esc(nat(l.owner).nation)}</span>`).join('')}</div>
          <div class="text-xs text-dim" style="margin-top:6px;">Para que cuente, escriban el producto en «Producto (granja)» al registrar la obra (ej. «hierro», «slime», «madera»).</div>
        </details>
      </div>`;

    const worksPanel = panel(`
      ${head('TRD 120-01 · CATASTRO', 'emerald', `OBRAS, RELIQUIAS Y AUDITORÍA ${tip('obra')} ${tip('reliquia')}`,
        `Cada obra respalda emisión monetaria y valor de acciones tras auditoría del Archivista Auditor (o verificación supletoria del Estado socio, Manual 003). Repetir granjas del mismo producto aplica rendimiento decreciente (100%, 50%, 25%…).`)}
      <div class="kpi-strip" style="margin-bottom:14px;">
        <div class="kpi-box"><div class="kpi-label">Por auditar</div><div class="kpi-val ${eco.works.some(w => w.status === 'pendiente') ? 'text-gold' : 'text-white'}">${eco.works.filter(w => w.status === 'pendiente').length}</div></div>
        <div class="kpi-box"><div class="kpi-label">Auditadas vigentes</div><div class="kpi-val text-emerald">${auditedWorks.length}</div></div>
        <div class="kpi-box"><div class="kpi-label">Respaldo obras ${esc(nat('myth').nation)}</div><div class="kpi-val text-royal">+${fmt(mythWorkPts)} pts</div></div>
        <div class="kpi-box"><div class="kpi-label">Respaldo obras ${esc(nat('scad').nation)}</div><div class="kpi-val text-emerald">+${fmt(scadWorkPts)} pts</div></div>
      </div>
      ${farmLocksCard}
      ${workForm}
      <div class="flex-row-wrap" style="gap:6px;margin-bottom:10px;">
        ${[['all', `Todas (${eco.works.length})`], ['myth', nat('myth').nation], ['scad', nat('scad').nation], ['pendiente', `Sin auditar (${eco.works.filter(w => w.status === 'pendiente').length})`]].map(([v, t]) => `<button class="filter-pill ${worksF === v ? 'active' : ''}" data-action="works-filter" data-v="${v}">${esc(t)}</button>`).join('')}
      </div>
      <div style="overflow-x:auto;">
        ${works.length ? `<table class="mc-table"><thead><tr><th>Dueño</th><th>Obra</th><th>Puntos</th><th>Estado</th><th></th></tr></thead><tbody>
          ${works.map(w => {
            const cat = CATS.find(c => c.id === w.cat) || CATS[CATS.length - 1];
            const eff = effPts[w.id];
            return `<tr>
              <td>${ptag(w.owner)}</td>
              <td><div class="text-white" style="font-weight:700;">${esc(w.name)}</div><div class="text-xs text-dim">${esc(cat.name)}${w.product ? ' · ' + esc(w.product) : ''}${w.coords ? ' · ' + esc(w.coords) : ''}</div></td>
              <td class="font-mono text-xs">${w.status === 'perdida' ? `<span class="text-dim" style="text-decoration:line-through;">${fmt(w.final)}</span>` : w.status === 'auditada' ? `<strong class="text-emerald">${fmt(eff)}</strong>${eff !== Number(w.final) ? ` <span class="text-dim">(de ${fmt(w.final)}${cat.unique ? ', repetida' : ''})</span>` : ''}` : `<input id="wpts-${w.id}" type="number" min="0" value="${w.proposed}" class="mc-input font-mono" style="width:70px;padding:3px 5px;"/>`}</td>
              <td class="text-xs">${w.status === 'perdida' ? '<span class="text-redstone">💀 Perdida</span>' : w.status === 'auditada' ? `<span class="text-emerald">✔ Auditada por ${esc(pname(w.auditedBy))}</span>` : w.status === 'rechazada' ? `<span class="text-redstone">✖ Rechazada</span>` : '<span class="text-gold">⏳ Pendiente</span>'}</td>
              <td><div class="flex-row-wrap" style="gap:4px;flex-wrap:nowrap;">
                ${w.status === 'pendiente' ? `<button class="mc-btn mc-btn-emerald" style="padding:3px 6px;" data-action="work-approve" data-id="${w.id}">Aprobar</button><button class="mc-btn" style="padding:3px 6px;" data-action="work-reject" data-id="${w.id}">Rechazar</button>`
                  : w.status === 'perdida' ? `<button class="mc-btn" style="padding:3px 6px;" data-action="work-reopen" data-id="${w.id}" title="La recuperaron: vuelve a auditoría">Recuperada</button>`
                  : `${w.status === 'auditada' && cat.unique ? `<button class="mc-btn mc-btn-redstone" style="padding:3px 6px;" data-action="work-lost" data-id="${w.id}">Se perdió</button>` : ''}<button class="mc-btn" style="padding:3px 6px;" data-action="work-reopen" data-id="${w.id}">Reabrir</button>`}
                <button class="mc-btn mc-btn-redstone" style="padding:3px 6px;" data-action="work-del" data-id="${w.id}">✕</button>
              </div></td></tr>`;
          }).join('')}</tbody></table>` : empty(`Ambos Estados empiezan con ${fmt(state.settings.baseIssue)} de capitalización fundacional. Registren obras para crecer.`)}
      </div>`);

    // Préstamos
    const lenderSel = state.ui.loanLender || 'bank';
    const loansPanel = panel(`
      ${head('CRÉDITO', 'amethyst', `PRÉSTAMOS ${tip('prestamo')} ${tip('mora')}`,
        `${esc(state.settings.bankName)} presta solo a Estados: máximo ${state.settings.bankCollateralPct}% de su capitalización y ${state.settings.bankLiquidityPct}% de sus reservas, a un ${state.settings.bankRate}% de interés. Quien cae en mora no puede imprimir ni pedir más. Para préstamos largos usen <strong>${esc(state.settings.basket.plural)}</strong> (${esc(sym('U'))}): se devuelve al cambio del día y el riesgo queda repartido.`)}
      <div class="mc-panel-dark p-md" style="margin-bottom:12px;">
        <div class="grid-2" style="gap:8px;align-items:end;">
          ${field('Prestamista', `<select id="ln-lender" class="mc-select font-mono" data-action-change="ln-lender">${opts([['bank', state.settings.bankName], ...participants().map(p => [p, pname(p)])], lenderSel)}</select>`)}
          ${field('Deudor', `<select id="ln-borrower" class="mc-select font-mono">${peopleOpts(lenderSel === 'bank' ? (E.isState(me) ? me : 'myth') : 'scad', lenderSel === 'bank' ? STATES : participants())}</select>`)}
          ${field('Denominación', `<select id="ln-cur" class="mc-select font-mono">${curOpts('U', true)}</select>`)}
          ${field('Monto', `<input id="ln-amt" type="number" step="0.01" min="1" value="20" class="mc-input font-mono"/>`)}
          ${field('Interés total %', lenderSel === 'bank' ? `<input class="mc-input font-mono" value="${state.settings.bankRate}" disabled/>` : `<input id="ln-int" type="number" min="0" value="5" class="mc-input font-mono"/>`)}
          ${field('Vence', `<input id="ln-due" class="mc-input" placeholder="Ej. fin de Temporada 2"/>`)}
          ${field('Condiciones', `<input id="ln-terms" class="mc-input" placeholder="Ej. para el Nether Hub"/>`)}
          <button class="mc-btn mc-btn-amethyst" data-action="loan-add" style="height:36px;">Otorgar préstamo</button>
        </div>
        <div id="ln-limit" class="text-xs font-mono text-dim" style="margin-top:8px;"></div>
      </div>
      <div class="section-stack" style="gap:8px;">
        ${eco.loans.length ? eco.loans.map(l => {
          const due = E.loanDue(l);
          const sc = E.settleCur(l);
          const now = E.convert(state, due, l.cur, sc);
          return `<div class="mc-panel-dark p-sm flex-between" style="opacity:${l.status === 'pagado' ? '.6' : '1'};${l.status === 'mora' ? 'border-color:#aa0000;' : ''}">
            <div>
              <div class="flex-row-wrap" style="gap:6px;">
                <span class="mc-tag ${l.status === 'pagado' ? 'tag-emerald' : l.status === 'mora' ? 'tag-redstone' : 'tag-amethyst'}">${l.status.toUpperCase()}</span>
                ${ptag(l.lender)}<span class="text-xs text-muted">→</span>${ptag(l.borrower)}
              </div>
              <div class="text-xs text-white" style="margin-top:4px;">${money(l.principal, l.cur)} + ${l.interest}% = <strong>${money(due, l.cur)}</strong>${l.cur === 'U' ? ` <span class="text-muted">(hoy ≈ ${money(now, sc)})</span>` : ''}</div>
              <div class="text-xs text-dim">${esc(l.terms || '')}${l.due ? ' · vence: ' + esc(l.due) : ''}${l.status === 'pagado' ? ` · pagado ${money(l.paidAmount, l.paidCur)}` : ''}</div>
            </div>
            <div class="flex-row-wrap" style="gap:4px;">
              ${l.status !== 'pagado' ? `<button class="mc-btn mc-btn-emerald" style="padding:3px 7px;" data-action="loan-pay" data-id="${l.id}">Pagar</button>
                <button class="mc-btn" style="padding:3px 7px;" data-action="loan-default" data-id="${l.id}">${l.status === 'mora' ? 'Quitar mora' : 'Declarar mora'}</button>` : ''}
            </div>
          </div>`;
        }).join('') : empty('Sin préstamos.')}
      </div>`);

    // Acciones
    const sharesPanel = panel(`
      ${head('INVERSIÓN', 'cyan', `ACCIONES Y DIVIDENDOS ${tip('acciones')} ${tip('dividendo')}`,
        `Cada Estado emite ${state.settings.sharesTotal} acciones (valor = capitalización ÷ ${state.settings.sharesTotal}). Los dividendos recompensan a socios e invitados accionistas.`)}
      <div class="grid-2">
        ${STATES.map(s => {
          const book = E.shareBook(state, s);
          const outside = Object.entries(book).filter(([p]) => p !== s).reduce((a, [, n]) => a + n, 0);
          const pctOut = Math.round((outside / Math.max(1, state.settings.sharesTotal)) * 100);
          return `<div class="mc-panel-dark p-md">
            <div class="flex-between" style="margin-bottom:6px;"><strong class="font-mono text-${stateColor(s)} text-sm">${esc(nat(s).nation)}</strong><span class="font-mono text-xs text-white">${money(E.sharePrice(state, s, CATS), curOf(s))} / acc.</span></div>
            <div class="boss-bar-track" style="height:7px;margin-bottom:8px;" title="${pctOut}% en manos externas"><div class="boss-bar-fill" style="width:${pctOut}%;background:var(--c-aqua);"></div></div>
            <ul class="mc-list" style="margin-bottom:10px;">${Object.entries(book).map(([pid, n]) => `<li>${ptag(pid)}<span class="font-mono text-xs text-white">${n} acc.${pid === s ? ' (tesoro)' : ''}</span></li>`).join('')}</ul>
            ${field('Inversor', `<select id="sh-who-${s}" class="mc-select font-mono">${peopleOpts(participants().find(p => p !== s), participants().filter(p => p !== s))}</select>`)}
            <div class="grid-3" style="gap:6px;margin-top:8px;align-items:end;">
              ${field('Cantidad', `<input id="sh-n-${s}" type="number" min="1" value="5" class="mc-input font-mono"/>`)}
              <button class="mc-btn mc-btn-emerald" data-action="sh-buy" data-s="${s}">Comprar</button>
              <button class="mc-btn" data-action="sh-sell" data-s="${s}">Vender</button>
            </div>
            <div class="grid-3" style="gap:6px;margin-top:8px;align-items:end;">
              ${field('Dividendo / acc.', `<input id="sh-div-${s}" type="number" step="0.01" min="0" value="0.1" class="mc-input font-mono"/>`)}
              <button class="mc-btn mc-btn-gold" data-action="sh-div" data-s="${s}" style="grid-column:span 2;">Repartir dividendo</button>
            </div>
          </div>`;
        }).join('')}
      </div>`);

    // Libro mayor (TRD 130-01)
    const ledgerPanel = panel(`
      ${head('TRD 130-01 · CT', 'slate', `LIBRO MAYOR CONTABLE ${tip('libroMayor')}`,
        'Conservación Total (CT): todo movimiento queda registrado y los billetes físicos deben coincidir con estos saldos. Nunca se elimina historia; solo se anula en reversa (<span class="font-mono">void</span>).')}
      <div data-undo-slot style="margin-bottom:10px;"></div>
      <div class="flex-between" style="gap:8px;margin-bottom:10px;">
        <div class="flex-row-wrap" style="gap:5px;">
          ${[['all', `Todos (${eco.ledger.length})`], ['compra', 'Compras / Pagos'], ['cambio', 'Cámara / Cambio'], ['emision', 'Emisión / Quema'], ['credito', 'Crédito / Acciones'], ['void', `Anulados (${eco.ledger.filter(x => x.void).length})`]].map(([v, t]) => `<button class="filter-pill ${ledgerTypeF === v ? 'active' : ''}" data-action="ledger-filter" data-v="${v}">${esc(t)}</button>`).join('')}
        </div>
        <input class="mc-input" style="max-width:260px;" data-bind-live="ui.ledgerQ" data-rerender="economy" value="${esc(state.ui.ledgerQ || '')}" placeholder="🔍 Buscar asiento…"/>
      </div>
      <div style="max-height:430px;overflow-y:auto;">
        ${ledger.length ? `<table class="mc-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle contable</th><th></th></tr></thead><tbody>
          ${ledger.map(l => `<tr style="${l.void ? 'opacity:.5;' : ''}"><td class="font-mono text-xs text-dim" style="white-space:nowrap;">${when(l.t)}</td>
            <td><span class="mc-tag ${l.void ? 'tag-redstone' : 'tag-slate'}">${l.void ? 'ANULADO' : esc(l.type)}</span></td>
            <td class="text-xs text-muted" style="${l.void ? 'text-decoration:line-through;' : ''}">${esc(l.text)}${l.edited ? ' <span class="text-dim">(editado)</span>' : ''}${l.by ? ` <span class="text-dim">· ${esc(l.by)}</span>` : ''}</td>
            <td><div class="flex-row-wrap" style="gap:4px;flex-wrap:nowrap;">
              <button class="mc-btn" style="padding:2px 6px;" data-action="led-edit" data-id="${l.id}" title="Editar nota del asiento">✎</button>
              ${!l.void && VOIDABLE.has(l.type) ? `<button class="mc-btn mc-btn-redstone" style="padding:2px 6px;" data-action="led-void" data-id="${l.id}" title="Revertir contablemente este movimiento">Anular</button>` : ''}
            </div></td></tr>`).join('')}
        </tbody></table>` : empty('Sin asientos contables que coincidan.')}
      </div>`);

    // Manual Económico y Contable (exclusivo de Economía, ligado a TRD 120-01 y TRD 130-01)
    const ecoManualData = D.ECONOMY_MANUAL || { chapters: [], considerando: [] };
    const ecoManualQ = (state.ui.ecoManualQ || '').trim().toLowerCase();
    const ecoGlossaryItems = Object.values(D.GLOSSARY || {}).filter(g => !ecoManualQ || (tx(g.t) + ' ' + tx(g.d) + ' ' + tx(g.ex || '')).toLowerCase().includes(ecoManualQ));
    const ecoManualPanel = panel(`
      ${head('MANUAL ECONÓMICO · TRD 120-01 / 130-01', 'gold', esc(ecoManualData.title || 'MANUAL ECONÓMICO DE MISCOLANDIA'),
        'Manual operativo y contable exclusivo del módulo Económico (separado de Estados y Leyes; articulado con las series archivísticas <strong>TRD 120-01</strong> y <strong>TRD 130-01</strong> de Miscolandia).')}
      <div class="flex-between" style="margin-bottom:12px;gap:8px;">
        <div class="flex-row-wrap" style="gap:6px;">
          <span class="mc-tag tag-gold">${esc(ecoManualData.code || 'MNL-ECO-01')}</span>
          <span class="mc-tag tag-cyan">${esc(ecoManualData.trd || 'TRD 120-01 · 130-01')}</span>
          <span class="mc-tag tag-emerald">Economía &amp; Archivística Contable</span>
        </div>
        <button class="mc-btn mc-btn-diamond" data-action="eco-manual-copy">📖 Copiar Manual para Libro / Archivo</button>
      </div>
      <div class="mc-panel-dark p-md" style="margin-bottom:14px;">
        ${ecoManualData.epigraph ? `<div class="norm-epigraph">${esc(tx(ecoManualData.epigraph))}</div>` : ''}
        <div class="norm-dispone" style="color:var(--c-aqua);margin-top:6px;">CONSIDERANDO:</div>
        ${(ecoManualData.considerando || []).map(c => `<div class="norm-considerando">${esc(tx(c))}</div>`).join('')}
      </div>
      <div class="section-stack" style="gap:12px;">
        ${(ecoManualData.chapters || []).map(ch => `
          <div class="eco-book-chapter ${esc(ch.tone || '')}">
            <div class="flex-between" style="margin-bottom:6px;">
              <div class="flex-row-wrap" style="gap:6px;">
                <span class="mc-tag tag-${ch.tone === 'archival' ? 'cyan' : ch.tone || 'gold'}">${esc(ch.num)}</span>
                <strong class="text-white text-sm">${esc(tx(ch.title))}</strong>
              </div>
              <span class="mc-tag tag-slate">${esc(ch.trd)}</span>
            </div>
            <p class="text-xs text-diamond" style="margin:0 0 8px 0;">${esc(tx(ch.summary))}</p>
            <div class="norm-body">${(ch.articles || []).map(art => {
              const m = esc(tx(art)).match(/^(Art[íi]culo\s+\d+\.[^.]+\.)(.*)$/);
              return `<div class="norm-art">${m ? `<strong class="text-white">${m[1]}</strong>${m[2]}` : esc(tx(art))}</div>`;
            }).join('')}</div>
            ${ch.concordancias ? `<div class="norm-concordancias" style="margin-top:8px;"><strong class="text-diamond">🔗 Archivo y Concordancias:</strong> ${esc(tx(ch.concordancias))}</div>` : ''}
          </div>`).join('')}
      </div>
      ${ecoManualData.vigencia ? `<div class="norm-vigencia" style="margin-top:12px;"><strong class="text-emerald">Alcance:</strong> ${esc(tx(ecoManualData.vigencia))}</div>` : ''}
      <div class="mc-panel-dark p-md" style="margin-top:16px;">
        <div class="flex-between" style="margin-bottom:10px;gap:8px;">
          <div>
            <strong class="font-pixel text-emerald text-sm">GLOSARIO ECONÓMICO EN LENGUAJE CLARO</strong>
            <div class="text-xs text-dim">Los mismos conceptos de los botones "?" explicados con ejemplos de Miscolandia.</div>
          </div>
          <input class="mc-input" style="max-width:240px;" data-bind-live="ui.ecoManualQ" data-rerender="economy" value="${esc(state.ui.ecoManualQ || '')}" placeholder="🔍 Buscar concepto…"/>
        </div>
        <div class="grid-2" style="gap:10px;">
          ${ecoGlossaryItems.length ? ecoGlossaryItems.map(g => `<div class="mc-slot p-sm"><strong class="text-gold text-xs">${esc(tx(g.t))}</strong>
            <div class="text-xs text-white" style="margin-top:4px;line-height:1.5;">${esc(tx(g.d))}</div>
            ${g.ex ? `<div class="text-xs text-muted" style="margin-top:4px;"><strong class="text-emerald">Ejemplo:</strong> ${esc(tx(g.ex))}</div>` : ''}</div>`).join('') : empty('Sin términos que coincidan con esa búsqueda.')}
        </div>
      </div>`);

    const ecoTab = state.ui.ecoTab || 'overview';
    const pendingWorks = eco.works.filter(w => w.status === 'pendiente').length;
    const activeLoans = eco.loans.filter(l => l.status !== 'pagado').length;
    const rNow = E.rate(state);
    const mythCap = E.capitalization(state, 'myth', CATS), mythIss = E.issued(state, 'M'), mythH = E.holdings(state, 'myth');
    const scadCap = E.capitalization(state, 'scad', CATS), scadIss = E.issued(state, 'S'), scadH = E.holdings(state, 'scad');
    const kpiStrip = `
      <div class="kpi-strip">
        <div class="kpi-box">
          <div class="kpi-label">Tipo de Cambio Vivo</div>
          <div class="kpi-val text-emerald">1 ${esc(sym('M'))} = ${rNow.toFixed(3)} ${esc(sym('S'))}</div>
          <div class="kpi-sub"><span>1 ${esc(sym('U'))} = ${E.uiValue(state, 'M').toFixed(2)} ${esc(sym('M'))}</span><span>${Math.abs(rNow - 1) < 0.02 ? 'Paridad' : rNow > 1 ? sym('M') + ' ↑' : sym('S') + ' ↑'}</span></div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">${esc(nat('myth').nation)} (${esc(sym('M'))})</div>
          <div class="kpi-val text-royal">${fmt(mythH.M)} <span class="text-xs text-dim">tesoro</span></div>
          <div class="kpi-sub"><span>Techo ${fmt(mythIss)}/${fmt(mythCap)}</span>${mythIss > mythCap + 1e-6 ? '<span class="text-redstone">⚠ Inflación</span>' : '<span class="text-emerald">✔ Sana</span>'}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">${esc(nat('scad').nation)} (${esc(sym('S'))})</div>
          <div class="kpi-val text-emerald">${fmt(scadH.S)} <span class="text-xs text-dim">tesoro</span></div>
          <div class="kpi-sub"><span>Techo ${fmt(scadIss)}/${fmt(scadCap)}</span>${scadIss > scadCap + 1e-6 ? '<span class="text-redstone">⚠ Inflación</span>' : '<span class="text-emerald">✔ Sana</span>'}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-label">${esc(state.settings.bankName)} · TRD</div>
          <div class="kpi-val text-amethyst">${fmt(eco.bank.M)} ${esc(sym('M'))} · ${fmt(eco.bank.S)} ${esc(sym('S'))}</div>
          <div class="kpi-sub"><span>${eco.ledger.length} asientos (130-01)</span><span>${auditedWorks.length} obras</span></div>
        </div>
      </div>`;

    const ecoNav = `
      <div class="subnav-wrap">
        <button class="subnav-btn ${ecoTab === 'overview' ? 'active' : ''}" data-action="eco-tab" data-v="overview">📊 Tesoros, Cambio &amp; Comercio</button>
        <button class="subnav-btn ${ecoTab === 'shops' ? 'active' : ''}" data-action="eco-tab" data-v="shops">🏪 Tiendas &amp; Oferta Sellada</button>
        <button class="subnav-btn ${ecoTab === 'works' ? 'active' : ''}" data-action="eco-tab" data-v="works">🏗️ Obras &amp; Auditoría ${pendingWorks ? `<span class="mc-tag tag-gold">${pendingWorks}</span>` : ''}</button>
        <button class="subnav-btn ${ecoTab === 'finance' ? 'active' : ''}" data-action="eco-tab" data-v="finance">🏦 Crédito, Acciones &amp; Libro Mayor ${activeLoans ? `<span class="mc-tag tag-amethyst">${activeLoans}</span>` : ''}</button>
        <button class="subnav-btn ${ecoTab === 'manual' ? 'active' : ''}" data-action="eco-tab" data-v="manual">📘 Manual Económico <span class="mc-tag tag-cyan">TRD 130-01</span></button>
      </div>`;

    const views = {
      overview: top + trade + overviewFooter,
      shops: prices + sealedPanel + guide,
      works: worksPanel,
      finance: `<div class="grid-2">${loansPanel}${sharesPanel}</div>` + ledgerPanel,
      manual: ecoManualPanel
    };
    $('view-economy').innerHTML = kpiStrip + ecoNav + (views[ecoTab] || views.overview);
    syncBuyForm();
    updateSwapPreview();
    updateLoanLimit();
  }

  function syncBuyForm() {
    const itemSel = $('buy-item');
    if (!itemSel) return;
    const p = state.economy.prices.find(x => x.id === itemSel.value);
    const priceEl = $('buy-price');
    if (p) { priceEl.value = p.price; priceEl.disabled = true; if (!val('buy-note')) $('buy-note').value = p.name; }
    else { priceEl.disabled = false; }
    updateBuyPreview();
  }

  function readBuy() {
    const seller = val('buy-seller');
    const buyer = val('buy-buyer');
    const qty = Math.max(1, num(val('buy-qty'), 1));
    const unit = num($('buy-price').value, 0);
    return { seller, buyer, qty, unit, total: E.r4(qty * unit), cur: curOf(seller) };
  }

  function updateBuyPreview() {
    const box = $('buy-preview');
    if (!box) return;
    const b = readBuy();
    if (!(b.total > 0)) { box.innerHTML = '<span class="text-dim">Indica un precio.</span>'; return; }
    const res = E.pay(clone(state), b.buyer, b.seller, b.cur, b.total, true);
    if (!res.ok) { box.innerHTML = `Total: <strong class="text-white">${money(b.total, b.cur)}</strong><br><span class="text-redstone">${esc(res.msg)}</span>`; return; }
    box.innerHTML = `Total: <strong class="text-white">${money(b.total, b.cur)}</strong><br>
      ${res.direct > 0 ? `Pago directo: ${money(res.direct, b.cur)}<br>` : ''}
      ${res.short > 0 ? `Conversión en el banco: ${money(res.cost, res.costCur)} → ${money(res.short, b.cur)}` : ''}`;
  }

  function updateSwapPreview() {
    const el = $('swap-preview');
    if (!el) return;
    const from = val('swap-from');
    const amt = num(val('swap-amt'));
    const out = amt > 0 ? E.quoteForIn(state, from, amt) : 0;
    el.textContent = amt > 0 ? `${money(amt, from)} → ${money(out, E.otherCur(from))}` : '';
  }

  function updateLoanLimit() {
    const el = $('ln-limit');
    if (!el) return;
    if (val('ln-lender') !== 'bank') { el.textContent = ''; return; }
    const s = val('ln-borrower');
    const c = val('ln-cur');
    if (!E.isState(s)) { el.textContent = ''; return; }
    const lim = E.bankLoanLimits(state, s, c, CATS);
    el.textContent = `Máximo que ${pname('bank')} puede prestar ahora a ${nat(s).nation}: ${money(lim.max, c)}`;
  }

  /* ======================== Vista: Estados y Leyes ======================== */

  function renderStatePage() {
    const set = state.settings;
    const nationForm = s => `
      <div class="mc-panel-dark p-md" style="border-color:${stateBorder(s)};">
        <div class="grid-2" style="gap:8px;">
          ${field('Jugador (nick)', `<input class="mc-input" data-bind="settings.nations.${s}.player" value="${esc(nat(s).player)}"/>`)}
          ${field('Estado', `<input class="mc-input" data-bind="settings.nations.${s}.nation" value="${esc(nat(s).nation)}"/>`)}
          ${field('Moneda', `<input class="mc-input" data-bind="settings.nations.${s}.currency" value="${esc(nat(s).currency)}"/>`)}
          ${field('Símbolo', `<input class="mc-input font-mono" maxlength="4" data-bind="settings.nations.${s}.symbol" value="${esc(nat(s).symbol)}"/>`)}
        </div>
      </div>`;
    const numField = (label, path, help, k) => field(`${label} ${k ? tip(k) : ''}${help ? ` <span class="text-dim">— ${help}</span>` : ''}`, `<input type="number" min="0" class="mc-input font-mono" data-bind="${path}" data-type="number" value="${esc(getPath(state, path))}"/>`);

    const config = panel(`
      ${head('CONFIGURACIÓN', 'slate', 'JUGADORES, ESTADOS Y MONEDAS', 'Todo nombre que aparece en la app sale de aquí.')}
      <div class="grid-2">${nationForm('myth')}${nationForm('scad')}</div>
      <div class="mc-panel-dark p-md" style="margin-top:14px;">
        <div class="grid-3" style="gap:10px;">
          ${field('Nombre del banco neutral', `<input class="mc-input" data-bind="settings.bankName" value="${esc(set.bankName)}"/>`)}
          ${field('Unidad neutral (singular)', `<input class="mc-input" data-bind="settings.basket.name" value="${esc(set.basket.name)}"/>`)}
          ${field('Unidad neutral (plural / símbolo)', `<div class="grid-2" style="gap:6px;"><input class="mc-input" data-bind="settings.basket.plural" value="${esc(set.basket.plural)}"/><input class="mc-input font-mono" maxlength="4" data-bind="settings.basket.symbol" value="${esc(set.basket.symbol)}"/></div>`)}
          ${numField('Emisión fundacional', 'settings.baseIssue', 'dinero inicial de cada país', 'fundacional')}
          ${numField('Acciones por Estado', 'settings.sharesTotal', '', 'acciones')}
          ${numField('Inercia del cambio', 'settings.fxInertia', 'más alto = cambio más estable', 'inercia')}
          ${numField('Interés del banco %', 'settings.bankRate', '', 'interes')}
          ${numField('Garantía máx. %', 'settings.bankCollateralPct', 'deuda máx. sobre el respaldo', 'garantia')}
          ${numField('Liquidez prestable %', 'settings.bankLiquidityPct', 'de las reservas', 'liquidez')}
        </div>
      </div>`);

    const guests = panel(`
      ${head('INVITADOS', 'cyan', 'JUGADORES OCASIONALES',
        'Un invitado no tiene Estado ni moneda. Puede cobrar por trabajos, vender materiales recolectados a mano o botín de exploración, prestar dinero y comprar acciones de cualquier Estado. Sus reglas exactas las fijan ustedes por ley.')}
      <div class="flex-row-wrap" style="gap:6px;margin-bottom:12px;"><input id="guest-nick" class="mc-input" style="flex:1;" placeholder="Nick del invitado"/><button class="mc-btn mc-btn-diamond" data-action="guest-add">+ Agregar invitado</button></div>
      <div class="grid-3" style="gap:10px;">
        ${state.guests.length ? state.guests.map(g => {
          const h = E.holdings(state, g.id);
          const sh = STATES.map(s => `${E.shareBook(state, s)[g.id] || 0} acc. ${nat(s).nation}`).join(' · ');
          return `<div class="mc-panel-dark p-md"><div class="flex-between"><strong class="text-white">${esc(g.nick)}</strong><button class="mc-btn" style="padding:2px 6px;" data-action="guest-del" data-id="${g.id}">✕</button></div>
            <div class="text-xs font-mono text-muted" style="margin-top:6px;">${money(h.M, 'M')} · ${money(h.S, 'S')}</div>
            <div class="text-xs font-mono text-dim" style="margin-top:2px;">${esc(sh)}</div>
            <div class="text-xs text-diamond" style="margin-top:2px;">Misiones: ${guestDone(g.id)}/${(D.GUEST_QUESTS || []).length}</div></div>`;
        }).join('') : empty('Sin invitados.')}
      </div>`);

    const pact = panel(`
      ${head('PACTO', 'emerald', 'MONOPOLIOS Y DEPENDENCIA MUTUA', 'Cada Estado produce a escala lo suyo y le compra al otro lo demás. Ajusten lo que no les parezca justo y regístrenlo como ley.')}
      <div class="grid-2" style="margin-bottom:14px;">
        ${STATES.map(s => `<div class="mc-panel-dark p-md">
          <strong class="font-pixel text-sm text-${stateColor(s)}">${esc(nat(s).nation)}</strong>
          <div class="section-stack" style="gap:6px;margin:10px 0;">${D.MONOPOLIES[s].sectors.map(x => `<div class="mc-slot p-sm"><div class="text-xs text-white" style="font-weight:700;">${esc(x.name)}</div><div class="text-xs text-muted">${esc(tx(x.items))}</div></div>`).join('')}</div>
          <div class="text-xs font-mono text-diamond" style="margin-bottom:6px;">Necesita comprarle al socio:</div>
          <ul class="mc-list">${D.MONOPOLIES[s].needs.map(n => `<li><span class="text-gold">→</span><span class="text-muted">${esc(tx(n))}</span></li>`).join('')}</ul>
        </div>`).join('')}
      </div>
      <div class="grid-2">
        <div class="mc-panel-dark p-md">
          <div class="text-xs font-mono text-white" style="margin-bottom:8px;font-weight:700;">Reglas del pacto</div>
          <ul class="mc-list">${D.PACT_RULES.map(r => `<li><span class="text-emerald">§</span><span><strong class="text-white">${esc(r.t)}:</strong> <span class="text-muted">${esc(tx(r.d))}</span></span></li>`).join('')}</ul>
        </div>
        <div class="mc-panel-dark p-md">
          <div class="text-xs font-mono text-white" style="margin-bottom:8px;font-weight:700;">Reparto de profesiones de aldeano</div>
          <table class="mc-table"><tbody>${D.PROFESSIONS.map(p => `<tr><td class="text-xs text-white">${esc(p.name)}</td><td><select class="mc-select font-mono" style="padding:3px 6px;" data-bind="professions.${p.id}">${stateOpts(state.professions[p.id])}</select></td></tr>`).join('')}</tbody></table>
          <div class="text-xs font-mono text-dim" style="margin-top:8px;">${STATES.map(s => `${nat(s).nation}: ${D.PROFESSIONS.filter(p => state.professions[p.id] === s).length}`).join(' · ')}</div>
        </div>
      </div>`);

    const docTypeOf = l => l.docType || ((l.kind || 'servidor') === 'servidor' ? 'servidor' : 'ley');
    const docMeta = l => (D.DOC_TYPES || {})[docTypeOf(l)] || { id: 'ley', label: 'Ley del Mundo', prefix: 'LEY', tag: 'amethyst', trd: '100-01' };
    const trdList = () => (Array.isArray(state.trd) && state.trd.length ? state.trd : (D.DEFAULT_TRD || []));
    const trdInfo = code => trdList().find(x => x.code === code) || { code: code || '100-01', series: 'Archivo General', disp: 'CT' };
    const trdCodeOf = l => l.trdCode || docMeta(l).trd;
    const trdDispTag = disp => ({ CT: 'tag-emerald', S: 'tag-gold', M: 'tag-cyan', E: 'tag-redstone' }[disp] || 'tag-slate');
    const formatNormBody = text => {
      const lines = String(text || '').split('\n').filter(x => x.trim() !== '');
      if (!lines.length) return '';
      return `<div class="norm-body">${lines.map(line => {
        const s = esc(line);
        const trimmed = line.trim();
        if (/^ep[íi]grafe\s*:/i.test(trimmed)) {
          return `<div class="norm-epigraph">${s.replace(/^(Ep[íi]grafe\s*:)/i, '<strong class="text-diamond">$1</strong>')}</div>`;
        }
        if (/^considerando\s*:?/i.test(trimmed)) {
          return `<div class="norm-dispone" style="color:var(--c-aqua);margin-top:6px;">${s}</div>`;
        }
        if (/^\d+\.\s+Que\b/i.test(trimmed) || /^Que\b/.test(trimmed)) {
          return `<div class="norm-considerando">${s}</div>`;
        }
        if (/^(dispone|resuelve|decreta|acuerda)\s*:?$/i.test(trimmed)) {
          return `<div class="norm-dispone">${s.toUpperCase()}</div>`;
        }
        if (/^concordancias\b/i.test(trimmed)) {
          return `<div class="norm-concordancias">${s.replace(/^(Concordancias\s*:?)/i, '<strong class="text-diamond">🔗 $1</strong>')}</div>`;
        }
        if (/^[áa]mbito\b/i.test(trimmed)) {
          return `<div class="norm-considerando" style="border-left-color:var(--c-slate);">${s.replace(/^([ÁA]mbito\s*:?)/i, '<strong class="text-white">$1</strong>')}</div>`;
        }
        if (/^vigencia\b/i.test(trimmed)) {
          return `<div class="norm-vigencia">${s.replace(/^(Vigencia\s*:?)/i, '<strong class="text-emerald">$1</strong>')}</div>`;
        }
        if (/^par[áa]grafo\b/i.test(trimmed)) {
          const m = s.match(/^(Par[áa]grafo[^:.\n]*[.:])(.*)$/i);
          return `<div class="norm-para">${m ? `<strong class="text-gold">${m[1]}</strong>${m[2]}` : s}</div>`;
        }
        const m = s.match(/^(Art[íi]culo\s+[\w°º()\s-]+?[.:])(.*)$/i);
        return `<div class="norm-art">${m ? `<strong class="text-white">${m[1]}</strong>${m[2]}` : s}</div>`;
      }).join('')}</div>`;
    };
    const trdCounts = () => {
      const c = {};
      const add = (code, n = 1) => { c[code] = (c[code] || 0) + n; };
      state.laws.forEach(l => add(trdCodeOf(l), 1));
      add('120-01', state.economy.works.length);
      add('130-01', state.economy.ledger.length + state.economy.loans.length);
      add('140-01', state.chronicles.length);
      add('150-01', state.villagers.length + state.guests.length);
      return c;
    };

    const reviewOf = l => (l.review && typeof l.review === 'object' ? { status: l.review.status || 'none', notes: Array.isArray(l.review.notes) ? l.review.notes : [] } : { status: 'none', notes: [] });
    const rid = reviewerId();
    const revName = rid ? pname(rid) : 'Revisor';
    const isRev = Boolean(rid && me === rid);
    const revTag = rev => {
      if (rev.status === 'pending') return `<span class="mc-tag tag-cyan">⏳ En revisión (${esc(revName)})</span>`;
      if (rev.status === 'returned') return `<span class="mc-tag tag-redstone">↩ Devuelta con anotaciones</span>`;
      if (rev.status === 'approved') return `<span class="mc-tag tag-emerald" title="Sellada por aval: solo modificable o derogable mediante acto superior">🔒 Avalada y Sellada (${esc(revName)})</span>`;
      return '';
    };
    const revActLabel = a => ({
      submitted: 'Enviada a revisión',
      resubmitted: 'Reenviada tras correcciones',
      returned: 'Devuelta con anotaciones',
      approved: 'Avalada por revisor',
      edited: 'Norma editada',
      repealed: 'Derogada',
      restored: 'Restaurada tras edición'
    }[a] || a);
    const renderReviewBox = rev => {
      if (rev.status === 'none' && !rev.notes.length) return '';
      const latest = rev.notes[0];
      const cls = rev.status === 'returned' ? 'rev-returned' : rev.status === 'approved' ? 'rev-approved' : '';
      const hist = rev.notes.length > 1
        ? `<details style="margin-top:6px;"><summary class="text-xs font-mono text-muted" style="cursor:pointer;">Historial de trámite (${rev.notes.length})</summary>
            <div style="margin-top:4px;">${rev.notes.map(n => `<div class="text-xs text-muted" style="padding:2px 0;">
              <strong class="text-white">${esc(revActLabel(n.action))}</strong> · ${esc(n.by || 'Sistema')} (${when(n.at)})${n.text ? `: <span class="text-gold">"${esc(n.text)}"</span>` : ''}
            </div>`).join('')}</div></details>`
        : '';
      return `<div class="norm-review-box ${cls}">
        ${latest ? `<div><strong class="text-white">${esc(revActLabel(latest.action))}</strong> · <span class="text-muted">${esc(latest.by || 'Sistema')} (${when(latest.at)})</span>${latest.text ? `<div class="text-gold" style="margin-top:2px;white-space:pre-wrap;">"${esc(latest.text)}"</div>` : ''}</div>`
          : `<div class="text-muted">Estado de revisión: ${esc(rev.status)}</div>`}
        ${hist}
      </div>`;
    };

    const lawCard = l => {
      const status = l.repealed ? 'derogada' : l.signs.myth && l.signs.scad ? 'vigente' : 'borrador';
      const rp = l.kind === 'rol';
      const meta = docMeta(l);
      const tCode = trdCodeOf(l);
      const tInfo = trdInfo(tCode);
      const rev = reviewOf(l);
      const sealed = Boolean(rp && !l.repealed && rev.status === 'approved');
      return `<div class="mc-panel-dark p-md law-card" style="opacity:${status === 'derogada' ? '.88' : '1'};${l.repealed ? 'border-left:4px solid var(--c-red);' : sealed ? 'border-left:4px solid var(--c-green);' : ''}">
        <div class="law-card-head">
          <div class="flex-row-wrap law-card-meta" style="gap:6px;">
            <span class="mc-tag tag-${meta.tag}">${esc(meta.prefix)} ${l.num}</span>
            <span class="mc-tag ${rp ? 'tag-emerald' : 'tag-slate'}" title="${rp ? 'Norma dentro del rol (In Character)' : 'Regla técnica fuera de rol (Out of Character)'}">${rp ? 'IC · En Rol' : 'OOC · Fuera de Rol'}</span>
            <strong class="text-white text-sm">${esc(l.title)}</strong>
            <span class="mc-tag ${status === 'vigente' ? 'tag-emerald' : status === 'derogada' ? 'tag-slate' : 'tag-gold'}">${status}</span>
            ${rp && !l.repealed ? revTag(rev) : ''}
            <span class="mc-tag ${trdDispTag(tInfo.disp)}" title="${esc(tInfo.series || '')}">TRD ${esc(tCode)} · ${esc(tInfo.disp)}</span>
          </div>
          <div class="flex-row-wrap law-card-actions" style="gap:6px;">
            ${isRev ? `
              ${STATES.map(s => `<span class="mc-tag ${l.signs[s] ? 'tag-emerald' : 'tag-slate'}">${l.signs[s] ? '✔' : '·'} ${esc(nat(s).player)}</span>`).join('')}
              ${rp && !l.repealed && !sealed ? `
                <button class="mc-btn mc-btn-emerald" style="padding:3px 7px;" data-action="law-approve-rev" data-id="${l.id}" title="Avalar y sellar como ${esc(revName)}">✔ Avalar</button>
                <button class="mc-btn mc-btn-gold" style="padding:3px 7px;" data-action="law-return" data-id="${l.id}" title="Devolver con anotaciones como ${esc(revName)}">↩ Devolver con anotaciones</button>
              ` : ''}
              ${sealed ? '<span class="mc-tag tag-gold" title="Requiere nuevo acto superior para modificar o derogar">🔒 Solo acto superior</span>' : `<button class="mc-btn ${l.repealed ? '' : 'mc-btn-redstone'}" style="padding:3px 7px;" data-action="law-repeal" data-id="${l.id}">${l.repealed ? '♻ Restaurar' : '🚫 Derogar'}</button>`}
              <button class="mc-btn" style="padding:3px 7px;" data-action="law-book" data-id="${l.id}" title="Copiar texto formateado para Libro de Minecraft">📖 Libro</button>
            ` : `
              ${STATES.map(s => `<button class="mc-btn ${l.signs[s] ? 'mc-btn-emerald' : ''}" style="padding:3px 7px;" data-action="law-sign" data-id="${l.id}" data-s="${s}">${l.signs[s] ? '✔' : '✍'} ${esc(nat(s).player)}</button>`).join('')}
              ${rp && !l.repealed && (rev.status === 'none' || rev.status === 'returned') ? `<button class="mc-btn mc-btn-diamond" style="padding:3px 7px;" data-action="law-submit" data-id="${l.id}">${rev.status === 'returned' ? '📤 Reenviar a revisión' : '📤 Enviar a revisión'}</button>` : ''}
              ${sealed ? `
                <span class="mc-tag tag-gold" title="Norma sellada por Aval del Archivista: solo se modifica o deroga radicando un acto superior o modificatorio">🔒 Sellada (requiere acto superior)</span>
                <button class="mc-btn" style="padding:3px 7px;" data-action="law-book" data-id="${l.id}" title="Copiar texto formateado para Libro de Minecraft">📖 Libro</button>
              ` : `
                <button class="mc-btn" style="padding:3px 7px;" data-action="law-edit" data-id="${l.id}" title="Editar artículos o agregar parágrafo">✎ Editar</button>
                <button class="mc-btn" style="padding:3px 7px;" data-action="law-book" data-id="${l.id}" title="Copiar texto formateado para Libro de Minecraft">📖 Libro</button>
                <button class="mc-btn" style="padding:3px 7px;" data-action="law-move" data-id="${l.id}" title="${rp ? 'Mover a reglas del servidor' : 'Mover a leyes del mundo'}">${rp ? '→ Reglas' : '→ Leyes'}</button>
                <button class="mc-btn" style="padding:3px 7px;" data-action="law-repeal" data-id="${l.id}">${l.repealed ? '♻ Restaurar' : '🚫 Derogar'}</button>
                <button class="mc-btn mc-btn-redstone" style="padding:3px 7px;" data-action="law-del" data-id="${l.id}" title="Borrar esta norma">🗑 Borrar</button>
              `}
            `}
          </div>
        </div>
        ${formatNormBody(l.text)}
        ${l.sanction ? `<div class="text-xs font-mono text-gold" style="margin-top:6px;">${rp ? 'Pena / Sanción' : 'Sanción'}: ${esc(l.sanction)}</div>` : ''}
        ${l.repealed ? `<div class="norm-review-box rev-returned">
          <div><strong class="text-white">🚫 Norma derogada</strong>${l.repealedBy ? ` · <span class="text-muted">${esc(l.repealedBy)}${l.repealedAt ? ' (' + when(l.repealedAt) + ')' : ''}</span>` : ''}</div>
          ${l.repealReason ? `<div class="text-gold" style="margin-top:2px;white-space:pre-wrap;">"${esc(l.repealReason)}"</div>` : ''}
          <div class="text-xs ${l.repealEdited ? 'text-emerald' : 'text-muted'}" style="margin-top:4px;">${l.repealEdited ? '✔ Modificada tras derogación — ya se puede restaurar como borrador.' : '🔒 No se puede restaurar sin modificarla primero con "✎ Editar".'}</div>
        </div>` : ''}
        ${rp ? renderReviewBox(rev) : ''}
      </div>`;
    };
    const docFilter = state.ui.lawDocFilter || 'all';
    const revFilter = state.ui.lawRevFilter || 'all';
    const matchesRevFilter = l => {
      if (revFilter === 'all') return true;
      if (revFilter === 'repealed') return Boolean(l.repealed);
      if (revFilter === 'vigente') return !l.repealed && l.signs.myth && l.signs.scad;
      return !l.repealed && reviewOf(l).status === revFilter;
    };
    const lawList = kind => {
      let list = state.laws.filter(l => (l.kind || 'servidor') === kind);
      if (kind === 'rol') {
        if (docFilter !== 'all') list = list.filter(l => docTypeOf(l) === docFilter);
        if (revFilter !== 'all') list = list.filter(matchesRevFilter);
      }
      const order = { ley: 1, codigo_penal: 2, decreto: 3, resolucion: 4, acuerdo: 5, circular: 6, manual: 7, servidor: 8 };
      list.sort((x, y) => (order[docTypeOf(x)] || 9) - (order[docTypeOf(y)] || 9) || x.num - y.num);
      return list.length ? list.map(lawCard).join('') : empty(kind === 'rol' ? 'Sin normas en esta categoría.' : 'Sin reglas todavía.');
    };
    const rolCount = dt => state.laws.filter(l => (l.kind || 'servidor') === 'rol' && (dt === 'all' || docTypeOf(l) === dt)).length;
    const revCount = rf => {
      if (rf === 'repealed') return state.laws.filter(l => (l.kind || 'servidor') === 'rol' && l.repealed).length;
      return state.laws.filter(l => (l.kind || 'servidor') === 'rol' && !l.repealed && (rf === 'vigente' ? (l.signs.myth && l.signs.scad) : reviewOf(l).status === rf)).length;
    };
    const docFilters = [
      ['all', `Todas (${rolCount('all')})`],
      ['ley', `Leyes (${rolCount('ley')})`],
      ['codigo_penal', `Código de Convivencia (${rolCount('codigo_penal')})`],
      ['decreto', `Decretos (${rolCount('decreto')})`],
      ['resolucion', `Resoluciones (${rolCount('resolucion')})`],
      ['acuerdo', `Acuerdos (${rolCount('acuerdo')})`],
      ['circular', `Circulares (${rolCount('circular')})`],
      ['manual', `Manuales y Guías (${rolCount('manual')})`]
    ];
    const revFilters = [
      ['all', 'Todo trámite'],
      ['pending', `⏳ En revisión (${revCount('pending')})`],
      ['returned', `↩ Devueltas (${revCount('returned')})`],
      ['repealed', `🚫 Derogadas (${revCount('repealed')})`],
      ['approved', `✔ Avaladas (${revCount('approved')})`],
      ['vigente', `Vigentes (${revCount('vigente')})`]
    ];
    const inboxItems = state.laws
      .map(l => ({ l, rev: reviewOf(l), meta: docMeta(l) }))
      .filter(({ l, rev }) => l.repealed || rev.status !== 'none' || rev.notes.length > 0)
      .sort((a, b) => {
        const pri = x => (x.l.repealed ? 0 : x.rev.status === 'returned' ? 1 : x.rev.status === 'pending' ? 2 : 3);
        const pa = pri(a), pb = pri(b);
        if (pa !== pb) return pa - pb;
        const ta = Math.max(a.l.repealedAt || 0, (a.rev.notes[0] && a.rev.notes[0].at) || 0);
        const tb = Math.max(b.l.repealedAt || 0, (b.rev.notes[0] && b.rev.notes[0].at) || 0);
        return tb - ta;
      });
    const inboxPanel = panel(`
      ${head('BUZÓN DE TRÁMITE', 'redstone', `COMENTARIOS DE REVISIÓN Y DEROGACIONES (${inboxItems.length})`,
        `Aquí quedan visibles para <strong>todos</strong> las anotaciones de ${esc(revName)}, las normas enviadas a revisión y los motivos de derogación.`)}
      ${inboxItems.length ? `<div class="section-stack" style="gap:8px;">
        ${inboxItems.map(({ l, rev, meta }) => {
          const latest = rev.notes[0];
          const badge = l.repealed
            ? `<span class="mc-tag tag-redstone">🚫 Derogada</span>`
            : rev.status === 'returned' ? `<span class="mc-tag tag-redstone">↩ Devuelta</span>`
              : rev.status === 'pending' ? `<span class="mc-tag tag-cyan">⏳ En revisión</span>`
                : `<span class="mc-tag tag-emerald">✔ Avalada</span>`;
          const commentTxt = l.repealed ? (l.repealReason || (latest && latest.text) || '') : ((latest && latest.text) || '');
          const whoAt = l.repealed
            ? `${esc(l.repealedBy || 'Sistema')}${l.repealedAt ? ' · ' + when(l.repealedAt) : ''}`
            : (latest ? `${esc(revActLabel(latest.action))} por ${esc(latest.by || 'Sistema')} · ${when(latest.at)}` : '');
          return `<div class="mc-panel-dark p-sm" style="border-left:3px solid ${l.repealed || rev.status === 'returned' ? 'var(--c-red)' : rev.status === 'pending' ? 'var(--c-aqua)' : 'var(--c-green)'};">
            <div class="flex-between" style="gap:8px;">
              <div class="flex-row-wrap" style="gap:6px;">
                <span class="mc-tag tag-${meta.tag}">${esc(meta.prefix)} ${l.num}</span>
                <strong class="text-white text-xs">${esc(l.title)}</strong>
                ${badge}
              </div>
              <div class="flex-row-wrap" style="gap:4px;">
                ${!isRev && !l.repealed && rev.status === 'returned' ? `<button class="mc-btn" style="padding:2px 7px;" data-action="law-edit" data-id="${l.id}">✎ Editar</button><button class="mc-btn mc-btn-diamond" style="padding:2px 7px;" data-action="law-submit" data-id="${l.id}">📤 Reenviar</button>` : ''}
                ${!isRev && l.repealed ? `<button class="mc-btn" style="padding:2px 7px;" data-action="law-edit" data-id="${l.id}">✎ Editar</button><button class="mc-btn" style="padding:2px 7px;" data-action="law-repeal" data-id="${l.id}">♻ Restaurar</button>` : ''}
                ${isRev && !l.repealed && rev.status !== 'approved' ? `<button class="mc-btn mc-btn-emerald" style="padding:2px 7px;" data-action="law-approve-rev" data-id="${l.id}">✔ Avalar</button><button class="mc-btn mc-btn-gold" style="padding:2px 7px;" data-action="law-return" data-id="${l.id}">↩ Devolver</button>` : ''}
              </div>
            </div>
            ${whoAt ? `<div class="text-xs text-muted" style="margin-top:4px;">${whoAt}</div>` : ''}
            ${commentTxt ? `<div class="text-xs text-gold" style="margin-top:3px;white-space:pre-wrap;">"${esc(commentTxt)}"</div>` : ''}
          </div>`;
        }).join('')}
      </div>` : `<div class="text-xs text-muted">Todavía no hay comentarios de revisión ni normas derogadas.</div>`}`);
    const lawsRol = panel(`
      ${head('NORMATIVA IC · DENTRO DEL ROL', 'amethyst', 'LEYES, CÓDIGO DE CONVIVENCIA, DECRETOS Y MANUALES',
        `Ordenamiento interno (<strong>In Character</strong>) de ${esc(nat('myth').nation)} y ${esc(nat('scad').nation)} en lenguaje claro e inclusivo. Incluye <strong>Artículos</strong>, <strong>Parágrafos</strong>, <strong>Concordancias</strong> entre actos, <strong>Manuales/Guías</strong>, serie <strong>TRD</strong> y revisión por <strong>${esc(revName)}</strong>.`)}
      <div class="flex-between" style="margin-bottom:10px;gap:8px;">
        <div class="flex-row-wrap" style="gap:6px;">
          ${docFilters.map(([v, t]) => `<button class="filter-pill ${docFilter === v ? 'active' : ''}" data-action="law-doc-filter" data-v="${v}">${esc(t)}</button>`).join('')}
        </div>
        <label class="text-xs font-mono text-muted" style="display:flex;align-items:center;gap:6px;">
          Revisor designado:
          <select class="mc-select font-mono" style="width:auto;padding:3px 6px;" data-bind="settings.reviewerId" ${E.isState(me) ? '' : 'disabled'}>${peopleOpts(rid)}</select>
        </label>
      </div>
      ${isRev ? `<div class="mc-panel-dark p-sm text-xs text-diamond" style="margin-bottom:10px;border-left:3px solid var(--c-aqua);">🔍 <strong>Modo Revisor (${esc(revName)}):</strong> revisa las normas, devuelve con anotaciones o dales aval para firma.</div>` : ''}
      <div class="flex-row-wrap" style="gap:6px;margin-bottom:12px;">
        ${revFilters.map(([v, t]) => `<button class="filter-pill ${revFilter === v ? 'active' : ''}" data-action="law-rev-filter" data-v="${v}">${esc(t)}</button>`).join('')}
      </div>
      <details class="mc-panel-dark p-md" style="margin-bottom:12px;">
        <summary class="font-mono text-xs text-emerald" style="cursor:pointer;font-weight:700;">+ Radicar ley, código, decreto, resolución, acuerdo, circular o manual</summary>
        <div style="margin-top:10px;">
          <div class="grid-4" style="gap:8px;margin-bottom:8px;">
            <select id="law-doc-type" class="mc-select font-mono">${opts([['ley', 'Ley del mundo (IC)'], ['codigo_penal', 'Código de Convivencia (IC)'], ['decreto', 'Decreto Ejecutivo (IC)'], ['resolucion', 'Resolución Administrativa (IC)'], ['acuerdo', 'Acuerdo Bilateral (IC)'], ['circular', 'Circular / Instructivo (IC)'], ['manual', 'Manual / Guía Oficial (IC)'], ['servidor', 'Regla del servidor (OOC)']], 'ley')}</select>
            <select id="law-trd" class="mc-select font-mono">${opts(trdList().map(t => [t.code, `TRD ${t.code} · ${t.series}`]), '100-01')}</select>
            <input id="law-title" class="mc-input" placeholder="Título claro (ej. Decreto 003 · Ferias)"/>
            <input id="law-sanction" class="mc-input" placeholder="Medida / sanción (opcional)"/>
          </div>
          <div class="flex-between" style="margin-bottom:6px;">
            <span class="text-xs text-muted">Estructura: Epígrafe → Considerando → Dispone → Artículos/Parágrafos → Concordancias → Vigencia</span>
            <button type="button" class="mc-btn" style="padding:3px 8px;font-size:11px;" data-action="law-template" data-target="law-text">📋 Plantilla Acto de Miscolandia</button>
          </div>
          <textarea id="law-text" rows="5" class="mc-textarea" placeholder="EPÍGRAFE: Por medio de la cual se...&#10;CONSIDERANDO:&#10;1. Que...&#10;DISPONE:&#10;Artículo 1. ...&#10;Concordancias: Ley 001 (TRD 100-01).&#10;Vigencia: Rige desde su firma bilateral." style="margin-bottom:8px;"></textarea>
          <button class="mc-btn mc-btn-redstone" data-action="law-add">Radicar y proponer</button>
        </div>
      </details>
      <div class="section-stack" style="gap:8px;">${lawList('rol')}</div>
      <div class="flex-row-wrap" style="gap:8px;margin-top:12px;">
        <button class="mc-btn" data-action="law-defaults" data-kind="rol">📜 Cargar leyes del mundo (IC)</button>
        <button class="mc-btn mc-btn-gold" data-action="law-defaults" data-kind="penal">⚖️ Cargar Código, Decretos, Resoluciones y Manuales (IC)</button>
        <button class="mc-btn mc-btn-emerald" data-action="law-upgrade-pack" title="Actualiza todas las normas y manuales (IC y OOC) a lenguaje claro, citas cruzadas, reactiva derogadas y deja todo vigente con ambas firmas">🏛️ Actualizar todo a lenguaje claro y firmar</button>
      </div>`);
    const lawsSrv = panel(`
      ${head('OOC · FUERA DE ROL (TRD 160-01)', 'slate', 'REGLAS TÉCNICAS DEL SERVIDOR (OOC)',
        'Acuerdos estrictamente fuera de rol (<strong>Out of Character</strong>): dificultad de juego, respaldos diarios, uso de la aplicación web, <code>Name Tag</code> y pausas por fallos técnicos. <strong>Separadas por completo de la historia IC.</strong>')}
      <div class="section-stack" style="gap:8px;">${lawList('servidor')}</div>
      <div style="margin-top:10px;"><button class="mc-btn" data-action="law-defaults" data-kind="servidor">Cargar reglas OOC sugeridas</button></div>`);

    const counts = trdCounts();
    const trdPanel = panel(`
      ${head('ARCHIVO OFICIAL', 'cyan', 'TABLA DE RETENCIÓN DOCUMENTAL (TRD)',
        'Control archivístico de series documentales, tiempos de retención, disposición final (<strong>CT</strong> Conservación Total, <strong>S</strong> Selección, <strong>M</strong> Copia en Libro, <strong>E</strong> Eliminación) y folios vivos.')}
      <div style="overflow-x:auto;margin-bottom:12px;">
        <table class="mc-table">
          <thead><tr><th>Código</th><th>Serie y Subserie</th><th>Soporte</th><th>Gestión</th><th>Central</th><th>Disp.</th><th>Folios</th><th>Procedimiento</th><th></th></tr></thead>
          <tbody>
            ${trdList().map(t => `<tr>
              <td class="font-mono text-gold">${esc(t.code)}</td>
              <td><strong class="text-white text-xs">${esc(t.series)}</strong><div class="text-xs text-muted">${esc(t.subseries || '')}</div></td>
              <td class="text-xs text-muted">${esc(t.support || '')}</td>
              <td class="text-xs text-muted">${esc(t.gestion || '')}</td>
              <td class="text-xs text-muted">${esc(t.central || '')}</td>
              <td><span class="mc-tag ${trdDispTag(t.disp)}">${esc(t.disp)}</span></td>
              <td class="font-mono text-white" style="text-align:center;">${counts[t.code] || 0}</td>
              <td class="text-xs text-muted">${esc(t.proc || '')}</td>
              <td><button class="mc-btn" style="padding:2px 6px;" data-action="trd-del" data-code="${esc(t.code)}" title="Eliminar serie TRD">🗑</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <details class="mc-panel-dark p-md">
        <summary class="font-mono text-xs text-diamond" style="cursor:pointer;font-weight:700;">+ Agregar serie documental a la TRD</summary>
        <div class="grid-4" style="gap:8px;margin-top:10px;">
          <input id="trd-code" class="mc-input font-mono" placeholder="Código (ej. 170-01)"/>
          <input id="trd-series" class="mc-input" placeholder="Nombre de la serie"/>
          <input id="trd-sub" class="mc-input" placeholder="Subserie / contenido"/>
          <select id="trd-disp" class="mc-select font-mono">${opts([['CT', 'CT · Conservación Total'], ['S', 'S · Selección'], ['M', 'M · Copia en Libro'], ['E', 'E · Eliminación']], 'CT')}</select>
          <input id="trd-support" class="mc-input" placeholder="Soporte (App + Libro...)"/>
          <input id="trd-gestion" class="mc-input" placeholder="Archivo gestión"/>
          <input id="trd-central" class="mc-input" placeholder="Archivo central"/>
          <input id="trd-proc" class="mc-input" placeholder="Procedimiento / nota"/>
        </div>
        <button class="mc-btn mc-btn-diamond" style="margin-top:8px;" data-action="trd-add">Agregar serie TRD</button>
      </details>`);

    const adjRows = [...participants(), 'bank'].map(pid => {
      const h = pid === 'bank' ? state.economy.bank : E.holdings(state, pid);
      return `<tr><td>${ptag(pid)}</td>
        <td><input type="number" min="0" step="0.01" class="mc-input font-mono" style="padding:3px 6px;" data-adj="${pid}|M" value="${E.r4(h.M)}"/></td>
        <td><input type="number" min="0" step="0.01" class="mc-input font-mono" style="padding:3px 6px;" data-adj="${pid}|S" value="${E.r4(h.S)}"/></td></tr>`;
    }).join('');
    const adjust = panel(`
      ${head('CORRECCIONES', 'gold', 'AJUSTE MANUAL DE SALDOS',
        'Para corregir errores que ya no se pueden deshacer. Cambia los números que estén mal, escribe el motivo y aplica. Queda registrado en el Libro Mayor. Úsenlo de común acuerdo: no es para crear dinero.')}
      <div style="overflow-x:auto;"><table class="mc-table"><thead><tr><th>Quién</th><th>${esc(sym('M'))}</th><th>${esc(sym('S'))}</th></tr></thead><tbody>${adjRows}</tbody></table></div>
      <div class="flex-row-wrap" style="gap:6px;margin-top:10px;"><input id="adj-note" class="mc-input" style="flex:1;" placeholder="Motivo (ej. revertir transferencia equivocada del día X)"/><button class="mc-btn mc-btn-gold" data-action="adjust-apply">Aplicar ajuste</button></div>`);

    const vigentes = k => state.laws.filter(l => (l.kind || 'servidor') === k && !l.repealed && l.signs.myth && l.signs.scad).length;
    const total = k => state.laws.filter(l => (l.kind || 'servidor') === k).length;
    const stateTab = state.ui.stateTab || 'laws';
    const stateNav = `
      <div class="subnav-wrap">
        <button class="subnav-btn ${stateTab === 'laws' ? 'active' : ''}" data-action="state-tab" data-v="laws">⚖️ Normativa &amp; Buzón ${inboxItems.length ? `<span class="mc-tag tag-redstone">${inboxItems.length}</span>` : ''}</button>
        <button class="subnav-btn ${stateTab === 'trd' ? 'active' : ''}" data-action="state-tab" data-v="trd">📚 Archivo TRD (${trdList().length})</button>
        <button class="subnav-btn ${stateTab === 'pact' ? 'active' : ''}" data-action="state-tab" data-v="pact">🤝 Pacto &amp; Invitados (${state.guests.length})</button>
        <button class="subnav-btn ${stateTab === 'config' ? 'active' : ''}" data-action="state-tab" data-v="config">🔧 Config, Saldos &amp; Reglas OOC (${vigentes('servidor')}/${total('servidor')})</button>
      </div>`;
    const stateViews = {
      laws: inboxPanel + lawsRol,
      trd: trdPanel,
      pact: pact + guests,
      config: lawsSrv + config + adjust
    };
    $('view-state').innerHTML = `<div data-undo-slot style="margin-bottom:12px;"></div>`
      + stateNav
      + (stateViews[stateTab] || stateViews.laws);
  }

  /* ======================== Vista: Lore y Crónicas ======================== */

  function renderLore() {
    const world = panel(`
      ${head('LORE', 'amethyst', 'EL MUNDO', 'Espacio en blanco a propósito: la historia es suya. Se guarda mientras escriben.')}
      <div class="grid-2">${D.WORLD_PROMPTS.map(p => `<div><label class="text-xs text-white">${esc(p.label)}</label>
        ${p.id === 'worldName' ? `<input class="mc-input" style="margin-top:4px;" data-bind="world.worldName" value="${esc(state.world.worldName || '')}" placeholder="${esc(p.ph)}"/>`
          : `<textarea class="mc-textarea" rows="3" style="margin-top:4px;" data-bind-live="world.${p.id}" placeholder="${esc(p.ph)}">${esc(state.world[p.id] || '')}</textarea>`}</div>`).join('')}</div>`);

    const nations = `<div class="grid-2">${STATES.map(s => panel(`
      ${head(nat(s).player.toUpperCase(), stateColor(s), esc(nat(s).nation.toUpperCase()))}
      <div class="section-stack" style="gap:10px;">${D.NATION_PROMPTS.map(p => `<div><label class="text-xs text-white">${esc(p.label)}</label>
        <textarea class="mc-textarea" rows="2" style="margin-top:4px;" data-bind-live="nationLore.${s}.${p.id}" placeholder="${esc(p.ph)}">${esc((state.nationLore[s] || {})[p.id] || '')}</textarea></div>`).join('')}</div>`)).join('')}</div>`;

    const answered = D.ERAS.map(e => ({ e, ans: Object.entries(state.lore[e.id] || {}).filter(([, v]) => v && v.trim()) })).filter(x => x.ans.length);
    const eraAnswers = panel(`
      ${head('POR ERAS', 'amethyst', 'RESPUESTAS DE LAS ERAS', 'Lo que han respondido en las preguntas de cada era (se editan en el Roadmap).')}
      ${answered.length ? answered.map(({ e, ans }) => `<div class="mc-panel-dark p-md" style="margin-bottom:8px;"><span class="mc-tag tag-slate">${e.code}</span>
        ${ans.map(([qi, v]) => `<div style="margin-top:8px;"><div class="text-xs text-dim">${esc(tx(e.lore[qi]))}</div><div class="text-xs text-white" style="white-space:pre-wrap;">${esc(v)}</div></div>`).join('')}</div>`).join('')
        : empty('Aún no hay respuestas.')}`);

    const eraOptions = [...D.ERAS.map(e => [e.code, e.code]), ['ERA ∞', 'ERA ∞']];
    const chron = panel(`
      ${head('ARCHIVO', 'gold', 'CRÓNICAS', 'Lo que pasó, contado por ustedes. Cada uno puede contar el mismo evento desde su Estado.')}
      <details class="mc-panel-dark p-md" style="margin-bottom:12px;"><summary class="font-mono text-sm text-gold" style="cursor:pointer;font-weight:700;">✍️ Escribir una crónica</summary><div style="margin-top:10px;">
        <div class="grid-4" style="gap:8px;margin-bottom:8px;">
          <select id="ch-era" class="mc-select font-mono">${opts(eraOptions, eraLabel(currentEraIndex()))}</select>
          <select id="ch-type" class="mc-select font-mono">${opts(['Historia', 'Comercio', 'Tratado', 'Hazaña', 'Disputa', 'Evento', 'Temporada'].map(x => [x, x]), 'Historia')}</select>
          <select id="ch-author" class="mc-select font-mono">${peopleOpts(me || 'myth')}</select>
          <input id="ch-title" class="mc-input" placeholder="Título"/>
        </div>
        <textarea id="ch-body" rows="3" class="mc-textarea" placeholder="Relato…" style="margin-bottom:8px;"></textarea>
        <button class="mc-btn mc-btn-amethyst" data-action="chron-add">Guardar en el archivo</button>
      </div></details>
      <div class="section-stack" style="gap:8px;">
        ${state.chronicles.length ? state.chronicles.map(c => `<div class="mc-panel-dark p-sm">
          <div class="flex-between"><div class="flex-row-wrap" style="gap:6px;"><span class="mc-tag tag-slate">${esc(c.era)}</span><span class="mc-tag tag-amethyst">${esc(c.type)}</span><span class="mc-tag tag-emerald">TRD 140-01 · CT</span>${ptag(c.author)}<span class="text-xs font-mono text-dim">${when(c.t)}</span></div>
          <button class="mc-btn" style="padding:2px 6px;" data-action="chron-del" data-id="${c.id}">✕</button></div>
          <div class="text-sm text-white" style="font-weight:700;margin-top:6px;">${esc(c.title)}</div>
          <p class="text-xs text-muted" style="margin:4px 0 0 0;white-space:pre-wrap;">${esc(c.body)}</p></div>`).join('') : empty('El archivo está vacío.')}
      </div>`);

    $('view-lore').innerHTML = `<div data-undo-slot style="margin-bottom:12px;"></div>` + chron + world
      + fold('nations', `🏛️ Ficha de ${esc(nat('myth').nation)} y ${esc(nat('scad').nation)}`, nations)
      + fold('eraAnswers', '📜 Respuestas a las preguntas de cada era', eraAnswers);
  }

  /* ======================== Vista: Territorio y Cédulas (TRD 150-01) ======================== */

  function censusOwnerOf(v) {
    if (!v) return 'myth';
    if (v.kind === 'animal') return v.owner || 'myth';
    return (v.owner || (state.professions && state.professions[v.prof]) || 'myth');
  }
  function cedulaSeriesPrefix(kind, owner) {
    const ser = kind === 'animal' ? 'CA' : 'CC';
    const org = owner === 'scad' ? 'LUT' : 'NA';
    return `${ser}-${org}-`;
  }
  function nextCedulaCode(kind, owner) {
    const prefix = cedulaSeriesPrefix(kind, owner);
    const max = state.villagers.reduce((m, x) => {
      const code = String(x.cedula || '');
      if (!code.startsWith(prefix)) return m;
      const n = Number(code.slice(prefix.length)) || 0;
      return Math.max(m, n);
    }, 0);
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }
  function displayCedula(v, idx) {
    if (v.cedula) return v.cedula;
    const owner = censusOwnerOf(v);
    return `${cedulaSeriesPrefix(v.kind === 'animal' ? 'animal' : 'villager', owner)}${String(idx + 1).padStart(4, '0')}`;
  }
  function formatCedulaCard(v, idx) {
    const isAnim = v.kind === 'animal';
    const owner = censusOwnerOf(v);
    const code = displayCedula(v, idx);
    const profObj = !isAnim ? (D.PROFESSIONS || []).find(p => p.id === v.prof) : null;
    const specObj = isAnim ? (D.ANIMAL_SPECIES || []).find(a => a.id === v.species) : null;
    const roleLabel = isAnim ? (specObj ? specObj.name : (v.species || 'Animal')) : (profObj ? profObj.name : (v.prof || 'Sin oficio'));
    const issued = v.issuedAt ? new Date(v.issuedAt).toLocaleDateString('es-CO') : 'Registro vigente';
    return [
      `╔══════════════════════════════════════╗`,
      `  REPÚBLICA / ARCHIVO NACIONAL · TRD 150-01`,
      `  ${isAnim ? 'CÉDULA ANIMAL Y DE COMPAÑÍA (CA)' : 'CÉDULA DE CIUDADANÍA ALDEANA (CC)'}`,
      `╚══════════════════════════════════════╝`,
      `Número Oficial : ${code}`,
      `Nombre Propio  : ${v.name}`,
      `Rótulo Yunque  : ${v.name} [${code}]`,
      `${isAnim ? 'Especie / Clase' : 'Oficio / Gremio'}: ${roleLabel}`,
      `Jurisdicción   : ${nat(owner).nation} (${nat(owner).player})`,
      `Morada / Sede  : ${v.home || 'Por asignar'}`,
      `Detalle / Nota : ${v.offer || (isAnim ? 'Ejemplar protegido' : 'Comercio estándar')}`,
      isAnim ? `Estado Vital   : ${v.deceased ? '† Archivo Histórico (Deceso)' : '♥ Vivo y Protegido'}` : `Curación Zombi : ${v.cured ? '1/1 Curado' : '0/1'} · ${v.deceased ? '† Archivo Histórico' : '♥ Vivo'}`,
      `Etiqueta Física: ${v.tagged ? '✔ Portada en juego (Name Tag)' : '⚠ Pendiente de colocar en juego'}`,
      `Expedición     : ${issued} · Sin costo (Ley 002 / Cir. 002)`,
      ``,
      `--- Texto compacto para Libro Firmado Original ---`,
      `CEDULA ${code} | ${v.name} | ${roleLabel} | Estado: ${nat(owner).nation} | Morada: ${v.home || 'N/A'} | Tag: ${v.name} [${code}]`
    ].join('\n');
  }

  function renderTerritory() {
    const goal = railGoal();
    const pct = Math.min(100, Math.round((state.railBlocks / goal) * 100));
    const rail = panel(`
      ${head('TRANSPORTE', 'gold', 'RED FERROVIARIA')}
      <div class="flex-between" style="margin-bottom:10px;">
        <div class="font-pixel text-gold text-lg">${state.railBlocks.toLocaleString('es-CO')} <span class="text-xs text-muted font-mono">/ ${goal.toLocaleString('es-CO')} bloques (meta actual)</span></div>
        <div class="flex-row-wrap" style="gap:6px;">
          ${[-100, 100, 500].map(d => `<button class="mc-btn ${d > 0 ? 'mc-btn-gold' : ''}" data-action="rail" data-d="${d}">${d > 0 ? '+' : ''}${d}</button>`).join('')}
          <input id="rail-set" type="number" min="0" class="mc-input font-mono" style="width:100px;" placeholder="Exacto"/><button class="mc-btn" data-action="rail-set">Fijar</button>
        </div>
      </div>
      <div class="boss-bar-track" style="height:12px;margin-bottom:16px;"><div class="boss-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#ffaa00,#ff5555);"></div></div>
      <details class="mc-panel-dark p-md" style="margin-bottom:12px;"><summary class="font-mono text-sm text-gold" style="cursor:pointer;font-weight:700;">+ Agregar estación</summary><div style="margin-top:10px;">
        <div class="grid-4" style="gap:8px;align-items:end;">
          ${field('Estación', '<input id="st-name" class="mc-input" placeholder="Nombre"/>')}
          ${field('Línea', '<input id="st-line" class="mc-input" placeholder="Línea / ramal"/>')}
          ${field('Coordenadas', '<input id="st-coords" class="mc-input font-mono" placeholder="X, Z"/>')}
          <div class="grid-2" style="gap:6px;"><select id="st-owner" class="mc-select font-mono">${opts([...STATES.map(s => [s, nat(s).nation]), ['ambos', 'Conjunta']], 'scad')}</select><button class="mc-btn mc-btn-gold" data-action="st-add">+ Estación</button></div>
        </div>
      </div></details>
      <div class="grid-3" style="gap:10px;">
        ${state.stations.length ? state.stations.map(s => `<div class="mc-panel-dark p-md"><div class="flex-between"><span class="mc-tag tag-gold">${esc(s.line || 'Sin línea')}</span><button class="mc-btn" style="padding:2px 6px;" data-action="st-del" data-id="${s.id}">✕</button></div>
          <div class="text-sm text-white" style="font-weight:700;margin-top:6px;">${esc(s.name)}</div>
          <div class="text-xs font-mono text-muted">${esc(s.coords || 'sin coords')} · ${esc(s.owner === 'ambos' ? 'Conjunta' : nat(s.owner).nation)}</div></div>`).join('') : empty('Sin estaciones.')}
      </div>`);

    const portals = panel(`
      ${head('NETHER', 'redstone', 'CALCULADORA DE PORTALES (÷8)', 'Escribe en cualquiera de los dos lados. Coordenadas de bloque (redondeo hacia abajo, como el juego).')}
      <div class="grid-2" style="margin-bottom:12px;">
        <div class="mc-panel-dark p-md"><div class="font-mono text-xs text-emerald" style="margin-bottom:6px;">Overworld X, Z</div><div class="grid-2" style="gap:6px;"><input id="ow-x" type="number" class="mc-input font-mono" value="0"/><input id="ow-z" type="number" class="mc-input font-mono" value="0"/></div></div>
        <div class="mc-panel-dark p-md"><div class="font-mono text-xs text-redstone" style="margin-bottom:6px;">Nether X, Z</div><div class="grid-2" style="gap:6px;"><input id="nh-x" type="number" class="mc-input font-mono" value="0"/><input id="nh-z" type="number" class="mc-input font-mono" value="0"/></div></div>
      </div>
      <div class="flex-row-wrap" style="gap:6px;margin-bottom:12px;"><input id="pt-label" class="mc-input" style="flex:1;" placeholder="Destino (ej. Fortaleza)"/><button class="mc-btn mc-btn-redstone" data-action="pt-add">+ Guardar portal</button></div>
      <div class="grid-3" style="gap:10px;">
        ${state.portals.length ? state.portals.map(p => `<div class="mc-panel-dark p-md flex-between"><div><div class="text-sm text-white" style="font-weight:700;">${esc(p.label)}</div>
          <div class="text-xs font-mono text-emerald">OW ${esc(p.ow)}</div><div class="text-xs font-mono text-redstone">NE ${esc(p.nh)}</div></div>
          <button class="mc-btn" style="padding:2px 6px;" data-action="pt-del" data-id="${p.id}">✕</button></div>`).join('') : empty('Sin portales guardados.')}
      </div>`);

    const cFilter = state.ui.censusFilter || 'all';
    const vgKind = state.ui.vgAddKind || 'villager';
    const isAnimForm = vgKind === 'animal';
    const villCount = state.villagers.filter(v => v.kind !== 'animal').length;
    const animCount = state.villagers.filter(v => v.kind === 'animal').length;
    const untaggedCount = state.villagers.filter(v => !v.tagged && !v.deceased).length;
    const missingCodeCount = state.villagers.filter(v => !v.cedula).length;
    const filteredCensus = state.villagers.map((v, idx) => ({ v, idx })).filter(({ v }) => {
      if (cFilter === 'villager') return v.kind !== 'animal';
      if (cFilter === 'animal') return v.kind === 'animal';
      if (cFilter === 'untagged') return !v.tagged && !v.deceased;
      return true;
    });

    const census = panel(`
      ${head('TRD 150-01 · REGISTRO CIVIL', 'emerald', 'CÉDULAS DE ALDEANOS (CC) Y ANIMALES (CA)',
        'Identificación oficial de ciudadanía aldeana (<strong>CC</strong>) y animales, mascotas o monturas (<strong>CA</strong>). Gratuita según la <strong>Ley 002</strong> y la <strong>Circular 002</strong>; copia el rótulo exacto para tu Name Tag artesanal en el yunque.')}
      <details class="mc-panel-dark p-md" style="margin-bottom:12px;" ${state.ui.vgFormOpen ? 'open' : ''}><summary class="font-mono text-sm text-emerald" style="cursor:pointer;font-weight:700;">+ Expedir nueva Cédula (Aldeano CC o Animal/Mascota CA)</summary><div style="margin-top:10px;">
        <div class="flex-row-wrap" style="gap:6px;margin-bottom:10px;">
          <button type="button" class="filter-pill ${!isAnimForm ? 'active' : ''}" data-action="vg-kind-btn" data-v="villager">🧑‍🌾 Ciudadano Aldeano (Cédula CC)</button>
          <button type="button" class="filter-pill ${isAnimForm ? 'active' : ''}" data-action="vg-kind-btn" data-v="animal">🐾 Animal / Mascota / Montura (Cédula CA)</button>
        </div>
        <div class="grid-4" style="gap:8px;align-items:end;">
          ${field('Nombre propio', `<input id="vg-name" class="mc-input" placeholder="${isAnimForm ? 'Ej. Ceniza / Relámpago' : 'Ej. Mercurio'}"/>`)}
          ${isAnimForm
            ? field('Especie / Clase', `<select id="vg-species" class="mc-select">${opts((D.ANIMAL_SPECIES || []).map(a => [a.id, a.name]), 'lobo')}</select>`)
            : field('Profesión (define Estado)', `<select id="vg-prof" class="mc-select">${opts(D.PROFESSIONS.map(p => [p.id, `${p.name} · ${nat(state.professions[p.id]).nation}`]), 'librarian')}</select>`)}
          ${isAnimForm
            ? field('Jurisdicción / Tutor', `<select id="vg-owner" class="mc-select">${opts(STATES.map(s => [s, `${nat(s).nation} (${nat(s).player})`]), 'myth')}</select>`)
            : field('Morada / Edificio', '<input id="vg-home" class="mc-input" placeholder="Ej. Biblioteca Norte"/>')}
          ${isAnimForm
            ? field('Establo / Morada y Nota', '<div class="grid-2" style="gap:6px;"><input id="vg-home" class="mc-input" placeholder="Establo"/><input id="vg-offer" class="mc-input" placeholder="Rol / nota"/></div>')
            : field('Oferta clave / Nota', '<input id="vg-offer" class="mc-input" placeholder="Ej. Mending 14 esm."/>')}
        </div>
        <div class="flex-row-wrap" style="gap:12px;margin-top:8px;">
          ${!isAnimForm ? '<label class="text-xs text-muted"><input id="vg-cured" type="checkbox"/> Ya curado (1/1)</label>' : ''}
          <label class="text-xs text-diamond"><input id="vg-tagged" type="checkbox"/> Ya tiene Name Tag colocada</label>
          <button class="mc-btn mc-btn-emerald" data-action="vg-add" style="margin-left:auto;">🪪 Expedir Cédula ${isAnimForm ? 'CA' : 'CC'}</button>
        </div>
      </div></details>

      <div class="flex-between" style="margin-bottom:10px;gap:8px;">
        <div class="flex-row-wrap" style="gap:6px;">
          <button class="filter-pill ${cFilter === 'all' ? 'active' : ''}" data-action="vg-filter" data-v="all">Todos (${state.villagers.length})</button>
          <button class="filter-pill ${cFilter === 'villager' ? 'active' : ''}" data-action="vg-filter" data-v="villager">🧑‍🌾 Aldeanos CC (${villCount})</button>
          <button class="filter-pill ${cFilter === 'animal' ? 'active' : ''}" data-action="vg-filter" data-v="animal">🐾 Animales CA (${animCount})</button>
          <button class="filter-pill ${cFilter === 'untagged' ? 'active' : ''}" data-action="vg-filter" data-v="untagged">⚠ Sin Tag puesta (${untaggedCount})</button>
        </div>
        <div class="flex-row-wrap" style="gap:6px;">
          <span class="text-xs font-mono text-muted">${STATES.map(s => `${nat(s).nation}: ${state.villagers.filter(v => censusOwnerOf(v) === s).length}`).join(' · ')}</span>
          ${missingCodeCount ? `<button class="mc-btn mc-btn-gold" style="padding:3px 8px;font-size:11px;" data-action="vg-issue-all">🪪 Asignar códigos (${missingCodeCount})</button>` : ''}
        </div>
      </div>

      <div style="overflow-x:auto;">
        ${filteredCensus.length ? `<table class="mc-table"><thead><tr><th>Cédula</th><th>Nombre y Clase</th><th>Estado</th><th>Morada / Establo</th><th>Detalle</th><th>Name Tag</th><th>Vital</th><th>Ficha</th></tr></thead><tbody>
          ${filteredCensus.map(({ v, idx }) => {
            const isAnim = v.kind === 'animal';
            const owner = censusOwnerOf(v);
            const code = displayCedula(v, idx);
            const prof = !isAnim ? D.PROFESSIONS.find(p => p.id === v.prof) : null;
            const spec = isAnim ? (D.ANIMAL_SPECIES || []).find(a => a.id === v.species) : null;
            const classLabel = isAnim ? `🐾 ${spec ? spec.name : (v.species || 'Animal')}` : `🧑‍🌾 ${prof ? prof.name : v.prof}`;
            return `<tr style="${v.deceased ? 'opacity:.65;' : ''}">
              <td class="font-mono"><span class="mc-tag ${isAnim ? 'tag-copper' : 'tag-emerald'}">${esc(code)}</span></td>
              <td><div class="text-white" style="font-weight:700;">${esc(v.name)}</div><div class="text-xs text-muted">${esc(classLabel)}</div></td>
              <td>${owner ? ptag(owner) : ''}</td>
              <td class="text-xs text-muted">${esc(v.home || '—')}</td>
              <td class="text-xs font-mono text-emerald">${esc(v.offer || '—')}</td>
              <td><button class="mc-btn ${v.tagged ? 'mc-btn-emerald' : 'mc-btn-gold'}" style="padding:2px 6px;" data-action="vg-tag" data-id="${v.id}" title="Marcar si ya lleva Name Tag física">${v.tagged ? '🏷️ Puesta' : '⚠ Falta'}</button></td>
              <td><div class="flex-row-wrap" style="gap:4px;">
                ${!isAnim ? `<button class="mc-btn ${v.cured ? 'mc-btn-gold' : ''}" style="padding:2px 6px;" data-action="vg-cure" data-id="${v.id}" title="Única cura zombi">${v.cured ? '1/1' : '0/1'}</button>` : ''}
                <button class="mc-btn ${v.deceased ? 'mc-btn-redstone' : ''}" style="padding:2px 6px;" data-action="vg-vital" data-id="${v.id}" title="Alternar estado vital / archivo histórico">${v.deceased ? '† Archivo' : '♥ Vivo'}</button>
              </div></td>
              <td><div class="flex-row-wrap" style="gap:4px;">
                <button class="mc-btn" style="padding:2px 6px;" data-action="vg-copy-tag" data-id="${v.id}" title="Copiar rótulo para yunque">🪪</button>
                <button class="mc-btn" style="padding:2px 6px;" data-action="vg-card" data-id="${v.id}" title="Ver ficha completa de Cédula (TRD 150-01)">📖</button>
                <button class="mc-btn mc-btn-redstone" style="padding:2px 6px;" data-action="vg-del" data-id="${v.id}">✕</button>
              </div></td></tr>`;
          }).join('')}</tbody></table>` : empty(state.villagers.length ? 'Sin registros en este filtro.' : 'Sin cédulas expedidas todavía (se activan desde la ERA V o antes con papel + pepita).')}
      </div>`);

    $('view-territory').innerHTML = rail + census + fold('portals', '🔥 Calculadora de portales del Nether (÷8)', portals);
  }

  /* ======================== Vista: Manual ======================== */

  function renderManual() {
    const M = nat('myth'), S = nat('scad'), b = state.settings.bankName, u = state.settings.basket;
    const card = (title, color, body) => `<div class="mc-panel-dark p-md"><strong class="font-mono text-${color} text-xs">${title}</strong><div class="text-xs text-muted" style="margin-top:6px;line-height:1.6;">${body}</div></div>`;
    const money1 = panel(`
      ${head('MANUAL', 'gold', 'CÓMO FUNCIONA EL DINERO', 'Tres preguntas, tres mecanismos separados.')}
      <div class="grid-3">
        ${card('1. ¿Cuánto dinero puede existir?', 'emerald', `Cada Estado puede tener en circulación como máximo su <strong>capitalización</strong>: emisión fundacional (${fmt(state.settings.baseIssue)}) + puntos de obras auditadas por el socio. Una granja de hierro AFK que llena 30.000 shulkers no suma nada; construir la siderúrgica sí, una vez. Se puede imprimir por encima del techo, pero ese dinero es <strong>sin respaldo</strong>: causa inflación inmediata (la moneda cae en proporción al exceso) y bloquea el crédito de la Cámara hasta corregirlo.`)}
        ${card('2. ¿Cuánto vale una moneda frente a la otra?', 'diamond', `Lo decide ${esc(b)} con sus reservas. Si ${esc(M.player)} necesita ${esc(S.currency)}s, mete ${esc(M.currency)}s y saca ${esc(S.currency)}s: hay más ${esc(M.currency)}s en el banco y el ${esc(M.currency)} baja. Cuando ${esc(S.player)} compra a ${esc(M.player)}, ocurre al revés. Con comercio equilibrado el cambio vuelve solo a ~1.`)}
        ${card('3. ¿Cuánto cuesta cada cosa?', 'gold', `Cada Estado publica su lista en su moneda. Precio único para todos, obligación de vender a ese precio, cambios solo en Sesión de Tarifas. Si un precio parece abusivo, se impugna con Oferta Sellada. Si el vendedor no entrega a tiempo: licencia forzosa (el comprador lo produce pagando 50% de regalía).`)}
      </div>
      <div class="mc-panel-dark p-md" style="margin-top:14px;">
        <strong class="font-mono text-white text-xs">Ejemplo: ¿y si ${esc(M.player)} cobra carísimo?</strong>
        <p class="text-xs text-muted" style="margin:6px 0 0 0;line-height:1.6;">${esc(M.player)} pone Mending a 200 ${esc(M.symbol)}. ${esc(S.player)} lo impugna: escribe en secreto que pagaría 20 y ${esc(M.player)} que acepta mínimo 60. No hay acuerdo. Segundo intento: 30 contra 45, tampoco. Se impone el punto medio: 37,5 ${esc(M.symbol)}. Y si ${esc(M.player)} sube todos sus precios, ${esc(S.player)} hace lo mismo con el hierro, que ${esc(M.player)} necesita para todas sus máquinas. A nadie le conviene abusar.</p>
      </div>
      <div class="mc-panel-dark p-md" style="margin-top:10px;">
        <strong class="font-mono text-white text-xs">Cómo arrancar (los 100 de cada uno)</strong>
        <ol class="text-xs text-muted" style="margin:6px 0 0 0;padding-left:18px;line-height:1.7;">
          <li>Cada Estado empieza con ${fmt(state.settings.baseIssue)} de su moneda en el tesoro: los dos empiezan iguales.</li>
          <li>Fundan ${esc(b)} con un aporte conjunto (sugerido 40 y 40). El cambio arranca 1:1.</li>
          <li>Primera Sesión de Tarifas con la regla del minuto: 1 moneda ≈ 1 minuto de juego que le ahorras al otro. Como ambos tienen los mismos minutos, los precios nacen comparables.</li>
          <li>Comercian. El cambio se mueve con el comercio.</li>
          <li>Para tener más dinero: construir y auditar obras. Para conseguir dinero rápido: préstamo de ${esc(b)} o vender acciones.</li>
        </ol>
      </div>`);

    const money2 = `<div class="grid-2">
      ${panel(`${head('PRÉSTAMOS', 'amethyst', `${esc(u.plural.toUpperCase())} (${esc(u.symbol)})`)}
        <p class="text-xs text-muted" style="margin:0;line-height:1.6;">No es una moneda física y nadie la emite. Es una canasta: <strong>1 ${esc(u.symbol)} = ½ ${esc(M.currency)} + ½ ${esc(S.currency)}</strong>, valorada al cambio del día. Sirve para préstamos y contratos largos: si se prestan 100 ${esc(u.symbol)} y luego una moneda cae, la diferencia se reparte por mitades en vez de caerle entera a uno. Se entrega y se devuelve en moneda real.</p>`)}
      ${panel(`${head('INVITADOS', 'cyan', 'ACCIONISTAS E INVERSORES')}
        <p class="text-xs text-muted" style="margin:0;line-height:1.6;">Un invitado gana dinero trabajando (le pagan por transferencia) o vendiendo lo que recolecta a mano. Con ese dinero puede <strong>comprar acciones</strong> de un Estado: el precio es capitalización ÷ acciones. Si el Estado construye y audita obras, la acción sube y el invitado puede revenderla al tesoro con ganancia. También puede <strong>prestar</strong> a un Estado con interés. Así, aunque juegue poco, tiene algo en juego cada vez que vuelve.</p>`)}
    </div>`;

    const bills = panel(`
      ${head('EN EL JUEGO', 'gold', 'BILLETES EN MINECRAFT VANILLA')}
      <div class="grid-2">
        ${card('Billetes = libros firmados ORIGINALES', 'emerald', `Escribe en un libro y pluma la denominación y la serie (ej. "50 ${esc(M.currency)} · Serie A-007") y fírmalo. El juego guarda el autor y no deja falsificar la firma. <strong>Ojo:</strong> quien tiene un original puede craftear copias que también dicen el autor. Por eso <strong>solo valen los que dicen "Original"</strong> en la descripción (Java muestra la generación del libro). Las copias no valen nada.`)}
        ${card('Imprimir cuesta', 'gold', `Cada billete necesita un libro (papel de ${esc(M.nation)} + cuero de ${esc(S.nation)}), una pluma y tinta. Usen denominaciones altas (10, 50, 100) para no gastar demasiado. Que imprimir cueste materiales del otro Estado es intencional.`)}
        ${card('El papel renombrado no sirve', 'redstone', 'Cualquiera puede renombrar papel con el mismo nombre en un yunque, así que no es seguro como dinero. Úsenlo solo para boletos de tren o recibos.')}
        ${card('La app es el registro oficial', 'diamond', 'Los saldos de esta app mandan. Los billetes físicos son la representación en el juego y deben coincidir. Imprimir o quemar billetes = registrarlo aquí en el mismo momento.')}
      </div>`);

    const shop = panel(`
      ${head('INGENIERÍA', 'redstone', 'TIENDA AUTOMÁTICA QUE ACEPTA BILLETES')}
      <p class="text-xs text-muted" style="margin:0 0 10px 0;line-height:1.6;">Idea general (prueben el diseño en creativo antes de construirlo):</p>
      <ol class="text-xs text-muted" style="margin:0;padding-left:18px;line-height:1.7;">
        <li>El comprador deposita el billete en una tolva de entrada.</li>
        <li>Un <strong>clasificador de ítems</strong> (filtro con tolva y comparador) calibrado con billetes idénticos al aceptado deja pasar solo ese billete. Como los libros firmados se agrupan de a 16 y no de a 64, la calibración cambia respecto a un filtro normal: búsquenla para libros.</li>
        <li>Cuando el billete pasa, el pulso del filtro activa un dispensador o un crafter que entrega el producto.</li>
        <li>Los billetes van a un cofre cerrado del dueño; el dueño lo registra como venta en la app.</li>
      </ol>`);

    const sync = panel(`
      ${head('USO', 'slate', 'SINCRONIZAR CON SUPABASE')}
      <ol class="text-xs text-muted" style="margin:0;padding-left:18px;line-height:1.7;">
        <li><strong>Todo va directo a Supabase:</strong> ya no hace falta descargar ni pasarse archivos JSON. Cada cambio se guarda en la nube y le llega en vivo al otro jugador.</li>
        <li><strong>Elijan "Soy:" arriba en cada PC:</strong> así la app registra en Supabase quién está conectado en línea, quién audita, quién firma y quién hizo el último cambio.</li>
        <li><strong>Invitados nuevos:</strong> puedes agregarlos desde "Soy: → + Agregar invitado..." o en Estados y Leyes; se sincronizan para todos.</li>
        <li><strong>Puntos de restauración:</strong> en el botón de Supabase arriba a la derecha puedes guardar snapshots en la nube y volver atrás si hace falta.</li>
      </ol>`);

    const glossary = panel(`
      ${head('GLOSARIO', 'emerald', 'TODAS LAS PALABRAS RARAS, EN SIMPLE', 'Lo mismo que sale al tocar los botones "?".')}
      <div class="grid-2" style="gap:10px;">
        ${Object.values(D.GLOSSARY || {}).map(g => `<div class="mc-panel-dark p-md"><strong class="text-gold text-sm">${esc(tx(g.t))}</strong>
          <div class="text-xs text-white" style="margin-top:4px;line-height:1.55;">${esc(tx(g.d))}</div>
          ${g.ex ? `<div class="text-xs text-muted" style="margin-top:4px;"><strong class="text-emerald">Ejemplo:</strong> ${esc(tx(g.ex))}</div>` : ''}</div>`).join('')}
      </div>`);

    $('view-manual').innerHTML = glossary
      + fold('m-money', '💰 Cómo funciona el dinero (explicado)', money1 + money2)
      + fold('m-bills', '📖 Billetes en Minecraft vanilla', bills)
      + fold('m-shop', '⚙️ Tienda automática que acepta billetes', shop)
      + fold('m-sync', '🔄 Usar la app en dos PCs', sync);
  }

  /* ======================== Render global ======================== */

  const RENDER = { roadmap: renderRoadmap, economy: renderEconomy, state: renderStatePage, lore: renderLore, territory: renderTerritory, manual: renderManual };

  function renderAll() {
    renderHUD();
    Object.values(RENDER).forEach(fn => fn());
    renderUndoButtons();
    showTab(state.ui.tab, false);
  }

  function showTab(tab, persist = true) {
    if (!RENDER[tab]) tab = 'roadmap';
    state.ui.tab = tab;
    document.querySelectorAll('.hotbar-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-view').forEach(v => v.classList.toggle('active', v.id === `view-${tab}`));
    if (persist) save(true);
  }

  function commit(...views) {
    recordFx(); // obras, reliquias y quemas también mueven el cambio (por el dinero sin respaldo)
    save();
    renderHUD();
    (views.length ? views : Object.keys(RENDER)).forEach(v => RENDER[v]());
    renderUndoButtons();
  }

  /* ======================== Acciones ======================== */

  function reviewerId() {
    const cfg = state.settings && state.settings.reviewerId;
    if (cfg && participants().includes(cfg)) return cfg;
    const notOut = state.guests.find(g => /^notout(?:of)?context$/i.test(String(g.nick || '').trim()));
    return notOut ? notOut.id : '';
  }
  function requireReviewer(why) {
    const rid = reviewerId();
    if (!rid) { fail('No hay un revisor asignado. Agrega un invitado o elige el Revisor en Estados y Leyes.'); return false; }
    return requireMe(rid, why);
  }
  function requireWorkAuditor(w, why) {
    const rid = reviewerId();
    const other = E.otherState(w.owner);
    if ((rid && me === rid) || me === other) return true;
    const allowed = rid ? `${pname(rid)} (Archivista Auditor) o ${pname(other)}` : pname(other);
    fail(`Para ${why} elige "Soy: ${allowed}" arriba.`);
    return false;
  }
  function ensureLawReview(l) {
    if (!l.review || typeof l.review !== 'object') l.review = { status: 'none', notes: [] };
    if (!Array.isArray(l.review.notes)) l.review.notes = [];
    if (!l.review.status) l.review.status = 'none';
    return l.review;
  }
  function pushReviewNote(l, action, text) {
    const r = ensureLawReview(l);
    r.notes.unshift({ id: uid('rev'), at: Date.now(), by: me ? pname(me) : 'Sistema', action, text: String(text || '').trim() });
    if (r.notes.length > 25) r.notes.length = 25;
  }

  function requireMe(target, why) {
    if (me === target) return true;
    fail(`Para ${why} elige "Soy: ${pname(target)}" arriba.`);
    return false;
  }
  function requireIdentified(why) {
    if (me && participants().includes(me)) return true;
    fail(`Para ${why} elige quién eres en "Soy:" arriba.`);
    return false;
  }
  function requireFounder(why) {
    if (E.isState(me)) return true;
    fail(`Solo un Estado fundador (${pname('myth')} o ${pname('scad')}) puede ${why}.`);
    return false;
  }
  function isLawSealed(l) {
    return Boolean(l && (l.kind || 'servidor') === 'rol' && !l.repealed && l.review && l.review.status === 'approved');
  }

  const ACTIONS = {
    filter: el => { state.ui.filter = el.dataset.v; commit('roadmap'); },
    'eco-tab': el => { state.ui.ecoTab = el.dataset.v || 'overview'; save(true); renderEconomy(); },
    'mint-fill': el => {
      const inp = $(`mint-${el.dataset.s}`);
      if (inp) { inp.value = el.dataset.v; inp.focus(); }
    },
    'ledger-filter': el => { state.ui.ledgerType = el.dataset.v || 'all'; save(true); renderEconomy(); },
    'eco-manual-copy': () => {
      const m = D.ECONOMY_MANUAL;
      if (!m) return;
      const lines = [
        `[${m.code} · ${m.trd}]`,
        tx(m.title),
        '',
        `EPÍGRAFE: ${tx(m.epigraph)}`,
        'CONSIDERANDO:',
        ...(m.considerando || []).map(tx),
        '',
        ...(m.chapters || []).flatMap(ch => [
          `=== ${ch.num}: ${tx(ch.title)} (${ch.trd}) ===`,
          ...(ch.articles || []).map(tx),
          ch.concordancias ? `Concordancias: ${tx(ch.concordancias)}` : '',
          ''
        ]),
        `Vigencia: ${tx(m.vigencia || '')}`
      ].join('\n');
      copyText(lines);
      toast('Manual Económico copiado', 'Listo para pegar en Libro Firmado o Archivo (TRD 130-01).', 'book');
    },
    'state-tab': el => { state.ui.stateTab = el.dataset.v || 'laws'; save(true); renderStatePage(); },
    'jump-era': el => {
      const id = el.dataset.era;
      if (!id) return;
      if (id !== 'era-inf') state.ui.open[id] = true;
      save(true);
      renderRoadmap();
      const target = $(id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    form: el => { state.ui.form = state.ui.form === el.dataset.f ? '' : el.dataset.f; commit('economy'); },
    'shop-edit': () => { state.ui.shopEdit = !state.ui.shopEdit; commit('economy'); },
    'deposit-quick': () => {
      if (!requireFounder('hacer aportes conjuntos a la Cámara')) return;
      const r = E.jointDeposit(state, 40);
      if (!r.ok) return fail(r.msg);
      log('Banco', `Fundación de ${pname('bank')}: ${money(r.amountM, 'M')} + ${money(r.amountS, 'S')}.`);
      toast(pname('bank'), 'Fundada. Ya pueden pagarse en la moneda del otro.', 'ender_eye');
      commit('economy');
    },
    'mode-simple': () => { state.ui.ecoTab = 'overview'; state.ui.advanced = true; save(true); renderEconomy(); window.scrollTo({ top: 0 }); },
    'mode-advanced': () => { state.ui.ecoTab = 'finance'; state.ui.advanced = true; save(true); renderEconomy(); },

    'season-start': () => { state.seasons.current = 1; state.seasons.checks = {}; rollSeason(); commit('roadmap'); },
    'season-roll': () => { rollSeason(); commit('roadmap'); },
    'season-close': () => {
      const S = state.seasons;
      const done = D.SEASON_CHECKLIST.filter(c => S.checks[c.id]).length;
      S.history.unshift({ n: S.current, t: Date.now(), summary: `${done}/${D.SEASON_CHECKLIST.length} cumplidos` });
      S.current += 1; S.checks = {}; rollSeason();
      toast('Temporada cerrada', `Comienza la temporada ${S.current}`, 'beacon');
      commit('roadmap');
    },
    'mega-add': () => {
      const t = val('mega-stage');
      if (!t) return;
      state.mega.stages.push({ t, done: false });
      commit('roadmap');
    },
    'mega-del': el => { state.mega.stages.splice(Number(el.dataset.i), 1); commit('roadmap'); },

    mint: async el => {
      const s = el.dataset.s;
      if (!requireMe(s, `operar tesorería de ${nat(s).nation}`)) return;
      const amt = num(val(`mint-${s}`));
      let r = E.mint(state, s, amt, CATS);
      if (!r.ok && r.needConfirm) {
        const before = E.rate(state);
        if (!await askConfirm(`${r.msg}

El dinero sin respaldo causa inflación: tu moneda se devaluará en el acto, ${pname('bank')} no te prestará y se recupera construyendo obras auditadas o quemando el exceso.

¿Imprimir igual?`)) return;
        r = E.mint(state, s, amt, CATS, true);
        if (r.ok) {
          recordFx();
          const after = E.rate(state);
          const drop = s === 'myth' ? (1 - after / before) : (1 - before / after);
          log('Emisión sin respaldo', `${nat(s).nation} imprimió ${money(amt, curOf(s))} (${money(r.over, curOf(s))} sin respaldo). Su moneda cae ${fmt(drop * 100)}%.`);
          toast('Inflación', `${nat(s).currency} −${fmt(drop * 100)}%`, 'redstone');
          return commit();
        }
      }
      if (!r.ok) return fail(r.msg);
      log('Emisión', `${nat(s).nation} imprimió ${money(amt, curOf(s))}.`);
      toast('Casa de moneda', `+${money(amt, curOf(s))}`, s === 'myth' ? 'redstone' : 'gold');
      commit('economy');
    },
    burn: el => {
      const s = el.dataset.s;
      if (!requireMe(s, `operar tesorería de ${nat(s).nation}`)) return;
      const amt = num(val(`mint-${s}`));
      const r = E.burn(state, s, amt);
      if (!r.ok) return fail(r.msg);
      recordFx();
      log('Quema', `${nat(s).nation} destruyó ${money(amt, curOf(s))}.`);
      commit();
    },
    deposit: () => {
      if (!requireFounder('hacer aportes conjuntos a la Cámara')) return;
      const r = E.jointDeposit(state, num(val('deposit-m')));
      if (!r.ok) return fail(r.msg);
      recordFx();
      log('Banco', `Aporte conjunto a ${pname('bank')}: ${money(r.amountM, 'M')} + ${money(r.amountS, 'S')}.`);
      toast(pname('bank'), 'Reservas aumentadas', 'ender_eye');
      commit('economy');
    },
    swap: () => {
      const who = val('swap-who'), from = val('swap-from'), amt = num(val('swap-amt'));
      if (!requireMe(who, 'cambiar divisas de esta cuenta')) return;
      const r = E.swap(state, who, from, amt);
      if (!r.ok) return fail(r.msg);
      recordFx();
      log('Cambio', `${pname(who)} cambió ${money(amt, from)} por ${money(r.out, r.toCur)}.`);
      commit('economy');
    },
    buy: () => {
      const b = readBuy();
      if (!requireMe(b.buyer, 'registrar una compra con esta cuenta')) return;
      if (!(b.total > 0)) return fail('Indica un precio mayor a 0.');
      const r = E.pay(state, b.buyer, b.seller, b.cur, b.total);
      if (!r.ok) return fail(r.msg);
      recordFx();
      const note = val('buy-note') || 'Compra';
      log('Compra', `${pname(b.buyer)} compró a ${nat(b.seller).nation}: ${note} ×${b.qty} = ${money(b.total, b.cur)}${r.short > 0 ? ` (convirtió ${money(r.cost, r.costCur)})` : ''}.`);
      toast('Compra registrada', `${note}: ${money(b.total, b.cur)}`, 'emerald');
      state.ui.form = '';
      commit('economy');
    },
    transfer: () => {
      const from = val('tr-from'), to = val('tr-to'), cur = val('tr-cur'), amt = num(val('tr-amt'));
      if (!requireMe(from, 'transferir dinero desde esta cuenta')) return;
      const r = E.pay(state, from, to, cur, amt);
      if (!r.ok) return fail(r.msg);
      recordFx();
      log('Transferencia', `${pname(from)} → ${pname(to)}: ${money(amt, cur)}. ${val('tr-note')}`);
      toast('Transferencia', `${money(amt, cur)} a ${pname(to)}`, 'emerald');
      state.ui.form = '';
      commit('economy', 'state');
    },

    'price-add': el => {
      const s = el.dataset.s;
      if (!requireMe(s, 'modificar la tienda de este Estado')) return;
      const name = val(`np-name-${s}`);
      const price = num(val(`np-price-${s}`), -1);
      if (!name || price < 0) return fail('Escribe producto y precio.');
      state.economy.prices.push({ id: uid('prc'), seller: s, name, unit: val(`np-unit-${s}`), price, history: [{ t: Date.now(), price, via: 'alta' }] });
      log('Tarifa', `${nat(s).nation} publica: ${name} a ${money(price, curOf(s))}.`);
      commit('economy');
    },
    'price-set': el => {
      const p = state.economy.prices.find(x => x.id === el.dataset.id);
      if (!p || !requireMe(p.seller, 'modificar precios de este Estado')) return;
      const np = num(val(`price-${el.dataset.id}`), -1);
      if (np < 0 || np === p.price) return;
      log('Tarifa', `${nat(p.seller).nation} cambia ${p.name}: ${money(p.price, curOf(p.seller))} → ${money(np, curOf(p.seller))}.`);
      p.history.push({ t: Date.now(), price: np, via: 'sesión' });
      p.price = np;
      commit('economy');
    },
    'price-del': el => {
      const p = state.economy.prices.find(x => x.id === el.dataset.id);
      if (!p || !requireMe(p.seller, 'modificar precios de este Estado')) return;
      state.economy.prices = state.economy.prices.filter(x => x.id !== el.dataset.id);
      commit('economy');
    },
    'price-buy': el => {
      const p = state.economy.prices.find(x => x.id === el.dataset.id);
      if (!p) return;
      state.ui.buySeller = p.seller; state.ui.buyItem = p.id; state.ui.ecoTab = 'overview';
      commit('economy');
      $('buy-qty').focus();
      $('buy-seller').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    'price-challenge': el => {
      const p = state.economy.prices.find(x => x.id === el.dataset.id);
      if (!p) return;
      state.economy.sealed = { item: p.name, seller: p.seller, attempt: 1, last: null, priceId: p.id };
      state.ui.sealOpen = true;
      commit('economy');
      $('sb-ask').scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    'sb-reveal': () => {
      const sealed = state.economy.sealed;
      const ask = num(val('sb-ask')), bid = num(val('sb-bid'));
      const r = E.sealedBid(ask, bid, sealed.attempt);
      if (!r.ok) return fail(r.msg);
      sealed.item = val('sb-item');
      sealed.seller = val('sb-seller');
      sealed.last = { ask, bid, seller: sealed.seller, ...r, priceId: sealed.priceId };
      log('Oferta sellada', `${sealed.item || 'Negociación'} (vende ${nat(sealed.seller).nation}): pedido ${fmt(ask)}, oferta ${fmt(bid)} → ${r.deal ? `precio ${money(r.price, curOf(sealed.seller))}${r.forced ? ' (impuesto)' : ''}` : 'sin acuerdo'}.`);
      sealed.attempt = r.deal ? 1 : sealed.attempt + 1;
      commit('economy');
    },
    'sb-reset': () => { state.economy.sealed = { item: '', seller: 'myth', attempt: 1, last: null }; commit('economy'); },
    'sb-apply': () => {
      const last = state.economy.sealed.last;
      const p = last && state.economy.prices.find(x => x.id === last.priceId);
      if (!p) return;
      log('Tarifa', `${p.name} queda en ${money(last.price, curOf(p.seller))} por oferta sellada.`);
      p.history.push({ t: Date.now(), price: last.price, via: 'oferta sellada' });
      p.price = last.price;
      state.economy.sealed.last = null;
      commit('economy');
    },

    'works-filter': el => { state.ui.worksFilter = el.dataset.v; commit('economy'); },
    'work-add': () => {
      const owner = val('w-owner');
      if (!requireMe(owner, 'registrar obras de este Estado')) return;
      const name = val('w-name');
      if (!name) return fail('Ponle nombre a la obra.');
      state.economy.works.unshift({ id: uid('obr'), owner, cat: val('w-cat'), name, product: val('w-product'), coords: val('w-coords'), proposed: num(val('w-pts'), 0), status: 'pendiente', createdAt: Date.now() });
      log('Obra', `${nat(owner).nation} registra "${name}" (pendiente de auditoría).`);
      const rid = reviewerId();
      toast('Obra registrada', `Falta que ${rid ? `${pname(rid)} (Archivista) o ` : ''}${pname(E.otherState(owner))} la audite.`, 'gold');
      state.ui.form = '';
      commit('economy');
    },
    'work-approve': el => {
      const w = state.economy.works.find(x => x.id === el.dataset.id);
      if (!w || !requireWorkAuditor(w, 'auditar esta obra')) return;
      w.final = num(val(`wpts-${w.id}`), w.proposed);
      w.status = 'auditada'; w.auditedBy = me; w.auditedAt = Date.now();
      log('Auditoría', `${pname(me)} aprueba "${w.name}" de ${nat(w.owner).nation}: ${fmt(w.final)} puntos.`);
      toast('Obra auditada', `${w.name}: +${fmt(w.final)}`, 'beacon');
      commit('economy');
    },
    'work-reject': el => {
      const w = state.economy.works.find(x => x.id === el.dataset.id);
      if (!w || !requireWorkAuditor(w, 'auditar esta obra')) return;
      w.status = 'rechazada'; w.auditedBy = me;
      log('Auditoría', `${pname(me)} rechaza "${w.name}".`);
      commit('economy');
    },
    'work-lost': async el => {
      const w = state.economy.works.find(x => x.id === el.dataset.id);
      if (!w) return;
      const rid = reviewerId();
      if (me !== w.owner && !(rid && me === rid)) {
        const who = rid ? `${pname(w.owner)} o ${pname(rid)} (Archivista)` : pname(w.owner);
        return fail(`Para marcar pérdida de "${w.name}" elige "Soy: ${who}" arriba.`);
      }
      if (!await askConfirm(`¿${w.name} se perdió? Deja de contar para la capitalización de ${nat(w.owner).nation}.`)) return;
      w.status = 'perdida'; w.lostAt = Date.now();
      const s = w.owner, c = curOf(s);
      const over = E.issued(state, c) - E.capitalization(state, s, CATS);
      log('Reliquia perdida', `${nat(s).nation} perdió "${w.name}" (−${fmt(w.final)} de capitalización).${over > 0 ? ` Queda con ${money(over, c)} sin respaldo: su moneda se devalúa.` : ''}`);
      toast('Reliquia perdida', `${w.name}: F`, 'redstone');
      commit('economy');
    },
    'work-reopen': el => {
      const w = state.economy.works.find(x => x.id === el.dataset.id);
      if (!w || !requireWorkAuditor(w, 'reabrir esta auditoría')) return;
      w.status = 'pendiente'; w.proposed = w.final ?? w.proposed;
      log('Auditoría', `"${w.name}" vuelve a revisión.`);
      commit('economy');
    },
    'work-del': async el => {
      const w = state.economy.works.find(x => x.id === el.dataset.id);
      if (!w) return;
      if (w.status === 'pendiente') {
        if (!requireMe(w.owner, 'eliminar esta obra pendiente')) return;
      } else if (!requireWorkAuditor(w, 'eliminar una obra ya auditada')) {
        return;
      }
      if (w.status === 'auditada' && !await askConfirm('Esta obra está auditada; borrarla baja la capitalización. ¿Seguro?')) return;
      state.economy.works = state.economy.works.filter(x => x.id !== w.id);
      log('Obra', `Se elimina "${w.name}".`);
      commit('economy');
    },

    'loan-add': () => {
      const lender = val('ln-lender');
      const borrower = val('ln-borrower');
      if (lender === 'bank') {
        if (!requireMe(borrower, 'solicitar un préstamo a la Cámara')) return;
      } else if (!requireMe(lender, 'otorgar este préstamo')) {
        return;
      }
      const r = E.createLoan(state, {
        lender, borrower, cur: val('ln-cur'), principal: num(val('ln-amt')),
        interest: lender === 'bank' ? state.settings.bankRate : num(val('ln-int')), due: val('ln-due'), terms: val('ln-terms')
      }, CATS);
      if (!r.ok) return fail(r.msg);
      recordFx();
      const l = r.loan;
      log('Préstamo', `${pname(l.lender)} presta ${money(l.principal, l.cur)} a ${pname(l.borrower)} (entregado ${money(r.out, l.payCur)}, ${l.interest}%).`);
      toast('Préstamo otorgado', `${money(l.principal, l.cur)} a ${pname(l.borrower)}`, 'enchanted_book');
      commit('economy', 'state');
    },
    'loan-pay': el => {
      const existing = state.economy.loans.find(x => x.id === el.dataset.id);
      if (!existing || !requireMe(existing.borrower, 'pagar este préstamo')) return;
      const r = E.repayLoan(state, el.dataset.id);
      if (!r.ok) return fail(r.msg);
      recordFx();
      const l = state.economy.loans.find(x => x.id === el.dataset.id);
      log('Préstamo', `${pname(l.borrower)} paga ${money(r.amount, r.cur)} a ${pname(l.lender)}.`);
      toast('Préstamo saldado', money(r.amount, r.cur), 'emerald');
      commit('economy', 'state');
    },
    'loan-default': el => {
      const l = state.economy.loans.find(x => x.id === el.dataset.id);
      if (!l) return;
      if (l.lender === 'bank') {
        const rid = reviewerId();
        if (!E.isState(me) && !(rid && me === rid)) {
          return fail('Solo un Estado fundador o el Archivista puede cambiar el estado de mora con la Cámara.');
        }
      } else if (!requireMe(l.lender, 'cambiar el estado de mora de este préstamo')) {
        return;
      }
      l.status = l.status === 'mora' ? 'activo' : 'mora';
      log('Préstamo', `${pname(l.borrower)} ${l.status === 'mora' ? 'entra en mora' : 'sale de mora'} con ${pname(l.lender)}.`);
      commit('economy');
    },

    'sh-buy': el => {
      const s = el.dataset.s, who = val(`sh-who-${s}`), n = num(val(`sh-n-${s}`));
      if (!requireMe(who, 'operar acciones con esta cuenta')) return;
      const r = E.buyShares(state, who, s, n, CATS);
      if (!r.ok) return fail(r.msg);
      recordFx();
      log('Acciones', `${pname(who)} compra ${n} acciones de ${nat(s).nation} por ${money(r.total, curOf(s))}.`);
      commit('economy', 'state');
    },
    'sh-sell': el => {
      const s = el.dataset.s, who = val(`sh-who-${s}`), n = num(val(`sh-n-${s}`));
      if (!requireMe(who, 'operar acciones con esta cuenta')) return;
      const r = E.sellShares(state, who, s, n, CATS);
      if (!r.ok) return fail(r.msg);
      log('Acciones', `${pname(who)} vende ${n} acciones a ${nat(s).nation} por ${money(r.total, curOf(s))}.`);
      commit('economy', 'state');
    },
    'sh-div': el => {
      const s = el.dataset.s, per = num(val(`sh-div-${s}`));
      if (!requireMe(s, 'repartir dividendos de este Estado')) return;
      const r = E.payDividend(state, s, per);
      if (!r.ok) return fail(r.msg);
      log('Dividendo', `${nat(s).nation} paga ${money(per, curOf(s))} por acción (${money(r.total, curOf(s))} a ${r.holders} accionistas).`);
      commit('economy', 'state');
    },

    'guest-add': el => {
      const nick = val(el.dataset.input || 'guest-nick');
      if (!nick) return;
      const id = uid('inv');
      state.guests.push({ id, nick });
      E.holdings(state, id);
      log('Invitado', `${nick} se une como invitado.`);
      commit();
    },
    'guest-del': async el => {
      if (!requireFounder('eliminar participantes invitados')) return;
      const g = state.guests.find(x => x.id === el.dataset.id);
      if (!g) return;
      const h = E.holdings(state, g.id);
      const hasShares = STATES.some(s => E.shareBook(state, s)[g.id]);
      if ((h.M > 0 || h.S > 0 || hasShares) && !await askConfirm(`${g.nick} tiene dinero o acciones. Si lo borras, su dinero desaparece de la circulación y sus acciones vuelven a los Estados. ¿Seguro?`)) return;
      STATES.forEach(s => { const book = E.shareBook(state, s); if (book[g.id]) { book[s] += book[g.id]; delete book[g.id]; } });
      delete state.economy.holdings[g.id];
      delete state.guestTasks[g.id];
      state.guests = state.guests.filter(x => x.id !== g.id);
      if (me === g.id) { me = ''; safeSet(ME_KEY, ''); }
      commit();
    },

    'law-doc-filter': el => {
      state.ui.lawDocFilter = el.dataset.v || 'all';
      save(true);
      renderStatePage();
    },
    'law-rev-filter': el => {
      state.ui.lawRevFilter = el.dataset.v || 'all';
      save(true);
      renderStatePage();
    },
    'law-add': () => {
      if (!requireFounder('radicar normas nuevas')) return;
      const title = val('law-title');
      if (!title) return fail('La norma necesita título.');
      const docType = val('law-doc-type') || 'ley';
      const kind = docType === 'servidor' ? 'servidor' : 'rol';
      const trdCode = val('law-trd') || ((D.DOC_TYPES || {})[docType] || {}).trd || '100-01';
      state.laws.push({ id: uid('ley'), kind, docType, trdCode, num: nextLawNum(kind, docType), title, text: val('law-text'), sanction: val('law-sanction'), signs: { myth: false, scad: false }, review: { status: 'none', notes: [] }, repealed: false, t: Date.now() });
      commit('state');
    },
    'law-defaults': el => {
      if (!requireFounder('cargar packs de normas base')) return;
      const k = el.dataset.kind;
      const added = addDefaultLaws(k);
      const label = k === 'penal' ? 'Código de Convivencia, Decretos, Resoluciones y Manuales' : k === 'rol' ? 'Leyes del mundo (IC)' : 'Reglas del servidor (OOC)';
      toast(label, added ? `${added} documentos agregados. Rigen cuando firmen ambos.` : 'Ya estaban todos cargados.', 'gavel');
      commit('state');
    },
    'law-submit': async el => {
      if (!requireFounder('enviar normas a revisión')) return;
      const l = state.laws.find(x => x.id === el.dataset.id);
      if (!l) return;
      const rev = ensureLawReview(l);
      if (rev.status === 'approved') return fail('Esta norma ya está avalada y sellada.');
      const isResubmit = rev.status === 'returned';
      const note = await askText(isResubmit ? `Nota de correcciones al reenviar "${l.title}" (opcional):` : `Comentario para el revisor sobre "${l.title}" (opcional):`, '');
      if (note === null) return;
      rev.status = 'pending';
      pushReviewNote(l, isResubmit ? 'resubmitted' : 'submitted', note);
      commit('state');
      const rid = reviewerId();
      toast(isResubmit ? 'Reenviada a revisión' : 'Enviada a revisión', `${l.title} → esperando a ${rid ? pname(rid) : 'Revisor'}.`, 'compass');
    },
    'law-return': async el => {
      const l = state.laws.find(x => x.id === el.dataset.id);
      if (!l || !requireReviewer('devolver normas con anotaciones')) return;
      if (isLawSealed(l)) return fail('Esta norma ya está avalada y sellada; no puede devolverse.');
      const obs = await askText(`Anotaciones / correcciones para devolver "${l.title}":`, '');
      if (obs === null) return;
      if (!obs.trim()) return fail('Escribe al menos una anotación para devolver la norma.');
      const rev = ensureLawReview(l);
      rev.status = 'returned';
      l.signs = { myth: false, scad: false };
      pushReviewNote(l, 'returned', obs);
      commit('state');
      toast('Devuelta con anotaciones', `${l.title} requiere ajustes antes de aprobarse.`, 'gold');
    },
    'law-approve-rev': async el => {
      const l = state.laws.find(x => x.id === el.dataset.id);
      if (!l || !requireReviewer('avalar la revisión de esta norma')) return;
      const rev = ensureLawReview(l);
      if (rev.status === 'approved') return fail('Esta norma ya cuenta con el aval del Archivista.');
      const obs = await askText(`Concepto / aval favorable para "${l.title}" (opcional):`, '');
      if (obs === null) return;
      rev.status = 'approved';
      pushReviewNote(l, 'approved', obs);
      commit('state');
      toast('Avalada por Revisor', `${l.title} ya puede ser firmada por ambos Estados.`, 'emerald');
    },
    'law-template': el => {
      const target = $(el.dataset.target || 'law-text');
      if (!target) return;
      const tpl = [
        'EPÍGRAFE: Por medio de la cual se...',
        'CONSIDERANDO:',
        '1. Que es deber de los Estados garantizar...',
        '2. Que resulta necesario regular...',
        'DISPONE:',
        'Artículo 1. Objeto y ámbito de aplicación.',
        'Artículo 2. Competencia y responsables.',
        'Parágrafo 1 (Excepciones y fuerza mayor):',
        'Artículo 3. Registro y custodia archivística (TRD).',
        'Concordancias: Ley 001 (TRD 100-01); Manual 001 (TRD 110-05).',
        'Vigencia: Rige a partir de su firma bilateral y deroga las disposiciones contrarias.'
      ].join('\n');
      if (target.value.trim() && !confirm('¿Reemplazar el borrador actual por la plantilla formal de Miscolandia?')) return;
      target.value = tpl;
      target.focus();
    },
    'law-upgrade-pack': async () => {
      if (!requireFounder('aplicar la actualización integral de normas')) return;
      if (!await askConfirm('Se actualizarán todas las leyes, códigos, decretos, resoluciones, manuales y reglas OOC a lenguaje claro e inclusivo con Concordancias y TRD, reactivando lo derogado y conservando los avales ya emitidos. ¿Continuar?')) return;
      const icPacks = [
        ...(D.DEFAULT_RP_LAWS || []),
        ...(D.DEFAULT_PENAL_PACK || [])
      ];
      const oocPacks = (D.DEFAULT_LAWS || []).map((d, idx) => ({ ...d, oocIdx: idx + 1 }));
      let updated = 0;
      let added = 0;
      const matchMap = {
        'ley de penas': 'Ley 001 · Régimen de Convivencia, Sanciones y Reparación Bilateral',
        'ley de penas y régimen sancionatorio bilateral': 'Ley 001 · Régimen de Convivencia, Sanciones y Reparación Bilateral',
        'ley de ciudadanía': 'Ley 002 · Ciudadanía, Cédulas (CC/CA) y Protección de Aldeanos y Animales',
        'ley de ciudadanía y protección aldeana': 'Ley 002 · Ciudadanía, Cédulas (CC/CA) y Protección de Aldeanos y Animales',
        'ley 002 · ciudadanía, vivienda digna y protección aldeana': 'Ley 002 · Ciudadanía, Cédulas (CC/CA) y Protección de Aldeanos y Animales',
        'ley de extranjería': 'Ley 003 · Movilidad, Hospitalidad y Residencia para Visitantes',
        'ley de extranjería, residencia y permisos': 'Ley 003 · Movilidad, Hospitalidad y Residencia para Visitantes',
        'ley de aduana y tránsito': 'Ley 004 · Fronteras Abiertas, Aduanas y Servidumbres de Paso',
        'ley de aduana, fronteras y tránsito': 'Ley 004 · Fronteras Abiertas, Aduanas y Servidumbres de Paso',
        'ley de hallazgos y patrimonio': 'Ley 005 · Hallazgos, Reliquias y Patrimonio Histórico Nacional',
        'ley de hallazgos, reliquias y patrimonio nacional': 'Ley 005 · Hallazgos, Reliquias y Patrimonio Histórico Nacional',
        'ley de obras públicas': 'Ley 006 · Obras Públicas, Infraestructura y Servidumbres Comunes',
        'ley de obras públicas y servidumbres': 'Ley 006 · Obras Públicas, Infraestructura y Servidumbres Comunes',
        'ley de sabotaje': 'Ley 007 · Cuidado de Infraestructura, Ingeniería y Creaciones Propias',
        'ley de protección contra sabotaje y propiedad intelectual': 'Ley 007 · Cuidado de Infraestructura, Ingeniería y Creaciones Propias',
        'ley de deudas y embargos': 'Ley 008 · Contratos de Crédito, Obligaciones y Cobro Proporcional',
        'ley de obligaciones, deudas y embargos': 'Ley 008 · Contratos de Crédito, Obligaciones y Cobro Proporcional',
        'ley de duelos de honor': 'Ley 009 · Torneos, Justas y Duelos de Honor',
        'ley de la mesa compartida': 'Ley 010 · Seguridad Alimentaria, Canasta Básica y Mesa Compartida',
        'ley de seguridad alimentaria y mesa compartida': 'Ley 010 · Seguridad Alimentaria, Canasta Básica y Mesa Compartida',
        'ley del archivo': 'Ley 011 · Ley Orgánica del Archivo Nacional, TRD y Memoria Plural',
        'ley orgánica del archivo nacional y memoria histórica': 'Ley 011 · Ley Orgánica del Archivo Nacional, TRD y Memoria Plural',
        'código penal · libro i: propiedad, bóvedas y saqueo': 'Libro I · Protección del Patrimonio, Bóvedas y Bienes Comunes',
        'código penal · libro i: patrimonio, bóvedas y saqueo': 'Libro I · Protección del Patrimonio, Bóvedas y Bienes Comunes',
        'código penal · libro ii: tesoro, moneda y fe pública': 'Libro II · Transparencia Fiscal, Moneda y Contratos Limpios',
        'código penal · libro iii: sabotaje, aldeanos y obras': 'Libro III · Cuidado de Infraestructura, Habitantes y Creaciones',
        'código penal · libro iii: infraestructura, aldeanos y patentes': 'Libro III · Cuidado de Infraestructura, Habitantes y Creaciones',
        'código penal · libro iv: dosimetría penal, prescripción e indultos': 'Libro IV · Dosimetría Clara, Prescripción, Revisión e Indultos',
        'código penal · libro iv: dosimetría, prescripción, apelación e indultos': 'Libro IV · Dosimetría Clara, Prescripción, Revisión e Indultos',
        'decreto 001 · gastos reservados, viáticos y caja menor': 'Decreto 001 · Régimen de Viáticos, Representación y Caja Menor',
        'decreto 002 · estado de excepción aduanera y decomiso': 'Decreto 002 · Control Aduanero, Custodia Preventiva y Remate',
        'decreto 002 · control aduanero, retención preventiva y decomiso': 'Decreto 002 · Control Aduanero, Custodia Preventiva y Remate',
        'resolución 001 · radicación, foliado y tabla de retención (trd)': 'Resolución 001 · Estándares de Radicación, Foliado y TRD',
        'resolución 001 · manual de radicación, foliado y trd': 'Resolución 001 · Estándares de Radicación, Foliado y TRD',
        'resolución 002 · arancel de trámites, permisos y peajes': 'Resolución 002 · Tarifas Claras de Trámites, Residencia y Certificaciones',
        'resolución 002 · aranceles de trámites, permisos y certificaciones': 'Resolución 002 · Tarifas Claras de Trámites, Residencia y Certificaciones',
        'circular 001 · lineamientos de revisión jurídica y subsanación': 'Circular 001 · Lineamientos de Revisión Jurídica y Lenguaje Claro'
      };
      const applyDef = (existing, def, isIc) => {
        existing.title = def.title;
        existing.text = tx(def.text);
        existing.sanction = tx(def.sanction || '');
        existing.docType = def.docType || existing.docType || (isIc ? 'ley' : 'servidor');
        existing.kind = isIc ? 'rol' : 'servidor';
        existing.trdCode = def.trdCode || existing.trdCode || (isIc ? '100-01' : '160-01');
        existing.repealed = false;
        delete existing.repealedAt;
        delete existing.repealedBy;
        delete existing.repealReason;
        delete existing.repealEdited;
        existing.signs = { myth: true, scad: true };
        existing.editedAt = Date.now();
        if (isIc && !existing.review) {
          existing.review = { status: 'none', notes: [] };
        }
      };
      icPacks.forEach(def => {
        const defLower = def.title.toLowerCase();
        const existing = state.laws.find(l => {
          const lt = (l.title || '').toLowerCase();
          return lt === defLower || matchMap[lt] === def.title;
        });
        if (existing) {
          applyDef(existing, def, true);
          updated++;
        } else {
          const docType = def.docType || 'ley';
          const trdCode = def.trdCode || ((D.DOC_TYPES || {})[docType] || {}).trd || '100-01';
          const created = {
            id: uid('ley'), kind: 'rol', docType, trdCode, num: nextLawNum('rol', docType),
            title: def.title, text: tx(def.text), sanction: tx(def.sanction || ''),
            signs: { myth: true, scad: true }, review: { status: 'none', notes: [] },
            repealed: false, t: Date.now()
          };
          state.laws.push(created);
          added++;
        }
      });
      const obsoleteOoc = new Set(['pvp y bromas', 'invitados', 'resolución de disputas', 'integridad de la oferta sellada', 'multas y reforma']);
      state.laws = state.laws.filter(l => !((l.kind || 'servidor') === 'servidor' && obsoleteOoc.has((l.title || '').trim().toLowerCase())));
      oocPacks.forEach(def => {
        const defLower = def.title.toLowerCase();
        const existing = state.laws.find(l => (l.kind || 'servidor') === 'servidor' && ((l.title || '').toLowerCase() === defLower || Number(l.num) === def.oocIdx));
        if (existing) {
          applyDef(existing, def, false);
          updated++;
        } else {
          state.laws.push({ id: uid('ley'), kind: 'servidor', docType: 'servidor', trdCode: '160-01', num: def.oocIdx, title: def.title, text: tx(def.text), sanction: tx(def.sanction || ''), signs: { myth: true, scad: true }, repealed: false, t: Date.now() });
          added++;
        }
      });
      // Sincronizar también serie y lenguaje claro de la TRD
      (D.DEFAULT_TRD || []).forEach(t => {
        const cur = state.trd.find(x => x.code === t.code);
        if (cur) Object.assign(cur, clone(t));
        else state.trd.push(clone(t));
      });
      commit('state');
      toast('Reforma Integral Aplicada', `${updated} actos actualizados y ${added} agregados — vigentes y pendientes de aval del Archivista.`, 'gavel');
    },
    'law-edit': el => {
      if (!requireFounder('editar actos o leyes')) return;
      const l = state.laws.find(x => x.id === el.dataset.id);
      if (!l) return;
      if (isLawSealed(l)) {
        return fail('Esta norma ya fue avalada y sellada por el Archivista. Para modificarla debes radicar un nuevo acto de jerarquía igual o superior.');
      }
      editingLawId = l.id;
      const dt = l.docType || ((l.kind || 'servidor') === 'servidor' ? 'servidor' : 'ley');
      const trdList = (Array.isArray(state.trd) && state.trd.length ? state.trd : (D.DEFAULT_TRD || []));
      $('edit-law-title').value = l.title || '';
      $('edit-law-doctype').innerHTML = opts([['ley', 'Ley del mundo (IC)'], ['codigo_penal', 'Código de Convivencia (IC)'], ['decreto', 'Decreto Ejecutivo (IC)'], ['resolucion', 'Resolución Administrativa (IC)'], ['acuerdo', 'Acuerdo Bilateral (IC)'], ['circular', 'Circular / Instructivo (IC)'], ['manual', 'Manual / Guía Oficial (IC)'], ['servidor', 'Regla del servidor (OOC)']], dt);
      $('edit-law-num').value = l.num || 1;
      $('edit-law-trd').innerHTML = opts(trdList.map(t => [t.code, `TRD ${t.code} · ${t.series}`]), l.trdCode || ((D.DOC_TYPES || {})[dt] || {}).trd || '100-01');
      $('edit-law-text').value = l.text || '';
      $('edit-law-sanction').value = l.sanction || '';
      $('modal-law-edit').classList.add('open');
      setTimeout(() => $('edit-law-title').focus(), 30);
    },
    'law-edit-save': () => {
      if (!requireFounder('guardar cambios en normas')) return;
      const l = state.laws.find(x => x.id === editingLawId);
      if (!l) return closeModals();
      if (isLawSealed(l)) {
        closeModals();
        return fail('Norma sellada por Aval del Archivista: radica un acto superior para modificarla.');
      }
      const nextTitle = val('edit-law-title');
      const nextDocType = val('edit-law-doctype') || 'ley';
      const nextNum = Math.max(1, Math.round(num(val('edit-law-num'), l.num || 1)));
      const nextTrd = val('edit-law-trd') || '100-01';
      const nextText = ($('edit-law-text') && $('edit-law-text').value) || '';
      const nextSanction = val('edit-law-sanction');
      if (!nextTitle) return fail('El acto administrativo necesita título.');
      const changed = nextTitle.trim() !== (l.title || '').trim()
        || nextDocType !== (l.docType || ((l.kind || 'servidor') === 'servidor' ? 'servidor' : 'ley'))
        || nextNum !== Number(l.num)
        || nextTrd !== (l.trdCode || '')
        || nextText.trim() !== (l.text || '').trim()
        || nextSanction.trim() !== (l.sanction || '').trim();
      if (!changed) {
        if (l.repealed) fail('Para poder restaurar una norma derogada debes modificar su contenido o título.');
        closeModals();
        return;
      }
      l.title = nextTitle;
      l.docType = nextDocType;
      l.kind = nextDocType === 'servidor' ? 'servidor' : 'rol';
      l.num = nextNum;
      l.trdCode = nextTrd;
      l.text = nextText;
      l.sanction = nextSanction;
      l.editedAt = Date.now();
      const rev = ensureLawReview(l);
      if (l.repealed) {
        l.repealEdited = true;
        pushReviewNote(l, 'edited', 'Modificada tras derogación; lista para restaurar.');
      } else if (l.signs.myth || l.signs.scad || rev.status === 'approved') {
        l.signs = { myth: false, scad: false };
        if (rev.status === 'approved') rev.status = 'pending';
        pushReviewNote(l, 'edited', 'Acto modificado; requiere nueva revisión/firmas.');
      } else if (rev.status === 'returned') {
        pushReviewNote(l, 'edited', 'Acto subsanado; listo para reenviar a revisión.');
      }
      editingLawId = null;
      closeModals();
      commit('state');
      toast('Acto actualizado', l.repealed ? 'Editado. Ya puedes pulsar "♻ Restaurar".' : (rev.status === 'returned' ? 'Subsanado. Pulsa "📤 Reenviar a revisión".' : l.title), 'gavel');
    },
    'law-book': el => {
      const l = state.laws.find(x => x.id === el.dataset.id);
      if (!l) return;
      const dt = l.docType || ((l.kind || 'servidor') === 'servidor' ? 'servidor' : 'ley');
      const meta = (D.DOC_TYPES || {})[dt] || { prefix: 'LEY', trd: '100-01' };
      const trd = l.trdCode || meta.trd;
      const out = `[${meta.prefix}-${String(l.num).padStart(3, '0')} · TRD ${trd}]\n${l.title}\n\n${l.text}${l.sanction ? `\n\nPena / Sanción: ${l.sanction}` : ''}`;
      copyText(out);
      toast('Copiado para Libro', `${meta.prefix}-${String(l.num).padStart(3, '0')} listo para pegar en Minecraft.`, 'book');
    },
    'law-sign': el => {
      const l = state.laws.find(x => x.id === el.dataset.id);
      const s = el.dataset.s;
      if (!l || !requireMe(s, 'firmar como este jugador')) return;
      const rev = ensureLawReview(l);
      if (!l.signs[s] && l.kind === 'rol') {
        if (rev.status === 'returned') return fail('Norma devuelta con anotaciones. Edítala y reenvíala a revisión antes de firmar.');
        if (rev.status === 'pending') {
          const rid = reviewerId();
          return fail(`Norma en revisión. Espera el aval de ${rid ? pname(rid) : 'Revisor'} antes de firmar.`);
        }
      }
      if (l.signs[s] && isLawSealed(l) && l.signs.myth && l.signs.scad) {
        return fail('Norma vigente y sellada por Aval del Archivista: no puede retirarse la firma sin acto modificatorio.');
      }
      l.signs[s] = !l.signs[s];
      if (l.signs.myth && l.signs.scad) toast('Norma vigente', `${l.title}`, 'gavel');
      commit('state');
    },
    'law-move': el => {
      if (!requireFounder('mover normas entre categorías')) return;
      const l = state.laws.find(x => x.id === el.dataset.id);
      if (!l) return;
      if (isLawSealed(l)) {
        return fail('Norma sellada por Aval del Archivista: no puede reasignarse sin acto modificatorio.');
      }
      l.kind = (l.kind || 'servidor') === 'rol' ? 'servidor' : 'rol';
      l.docType = l.kind === 'servidor' ? 'servidor' : (l.docType && l.docType !== 'servidor' ? l.docType : 'ley');
      l.num = nextLawNum(l.kind, l.docType);
      commit('state');
    },
    'trd-add': () => {
      const rid = reviewerId();
      if (!E.isState(me) && !(rid && me === rid)) {
        return fail('Solo un Estado fundador o el Archivista puede agregar series TRD.');
      }
      const code = val('trd-code');
      const series = val('trd-series');
      if (!code || !series) return fail('La serie TRD necesita código y nombre.');
      if (!Array.isArray(state.trd) || !state.trd.length) state.trd = clone(D.DEFAULT_TRD || []);
      if (state.trd.some(t => t.code === code)) return fail(`Ya existe la serie TRD ${code}.`);
      state.trd.push({
        code,
        series,
        subseries: val('trd-sub'),
        support: val('trd-support') || 'App + Libro',
        gestion: val('trd-gestion') || 'Temporada en curso',
        central: val('trd-central') || 'Permanente',
        disp: val('trd-disp') || 'CT',
        proc: val('trd-proc') || ''
      });
      toast('Serie TRD agregada', `${code} · ${series}`, 'book');
      commit('state');
    },
    'trd-del': async el => {
      const rid = reviewerId();
      if (!E.isState(me) && !(rid && me === rid)) {
        return fail('Solo un Estado fundador o el Archivista puede eliminar series TRD.');
      }
      const code = el.dataset.code;
      if (!Array.isArray(state.trd) || !state.trd.length) state.trd = clone(D.DEFAULT_TRD || []);
      if (!await askConfirm(`¿Eliminar la serie TRD ${code} de la tabla? (Puedes recuperarla con Deshacer.)`)) return;
      state.trd = state.trd.filter(t => t.code !== code);
      commit('state');
    },
    'law-repeal': async el => {
      const rid = reviewerId();
      if (!E.isState(me) && !(rid && me === rid)) {
        return fail('Solo un Estado fundador o el Archivista puede derogar o restaurar normas.');
      }
      const l = state.laws.find(x => x.id === el.dataset.id);
      if (!l) return;
      if (!l.repealed && isLawSealed(l)) {
        return fail('Esta norma ya fue avalada y sellada por el Archivista. Para derogarla o sustituirla debes radicar un nuevo acto de rango igual o superior.');
      }
      if (!l.repealed) {
        const reason = await askText(`Motivo / comentario obligatorio para derogar "${l.title}":`, '');
        if (reason === null) return;
        if (!reason.trim()) return fail('Para derogar una norma es obligatorio escribir el motivo.');
        l.repealed = true;
        l.repealReason = reason.trim();
        l.repealedBy = me ? pname(me) : 'Sistema';
        l.repealedAt = Date.now();
        l.repealEdited = false;
        l.signs = { myth: false, scad: false };
        const rev = ensureLawReview(l);
        if (reviewerId() && me === reviewerId()) rev.status = 'returned';
        pushReviewNote(l, 'repealed', l.repealReason);
        commit('state');
        toast('Norma derogada', `${l.title} dejó de estar vigente.`, 'gold');
        return;
      }
      if (!l.repealEdited) {
        return fail('No se puede restaurar sin hacer cambios. Edita la norma primero con "✎ Editar".');
      }
      l.repealed = false;
      l.repealEdited = false;
      l.signs = { myth: false, scad: false };
      const rev = ensureLawReview(l);
      if (rev.status === 'approved') rev.status = 'pending';
      pushReviewNote(l, 'restored', 'Restaurada tras edición; vuelve como borrador.');
      commit('state');
      toast('Norma restaurada', `${l.title} volvió como borrador para aprobación.`, 'emerald');
    },
    'law-del': async el => {
      if (!requireFounder('borrar normas')) return;
      const l = state.laws.find(x => x.id === el.dataset.id);
      if (!l) return;
      if (isLawSealed(l)) {
        return fail('Norma sellada por Aval del Archivista: no puede borrarse directamente; requiere acto superior.');
      }
      if (await askConfirm(`¿Seguro que quieres BORRAR "${l.title}"?\n\nSi solo quieres que deje de aplicar sin perderla, pulsa Cancelar y usa "Derogar".\n(También puedes recuperarla luego con el botón Deshacer de arriba.)`)) {
        state.laws = state.laws.filter(x => x.id !== el.dataset.id);
        commit('state');
        toast('Ley borrada', `Se borró "${l.title}". Puedes recuperarla con Deshacer.`, 'gold');
      }
    },

    'chron-add': () => {
      if (!requireIdentified('publicar una crónica')) return;
      const title = val('ch-title');
      if (!title) return fail('La crónica necesita título.');
      state.chronicles.unshift({ id: uid('cro'), era: val('ch-era'), type: val('ch-type'), author: val('ch-author'), title, body: val('ch-body'), t: Date.now() });
      commit('lore');
    },
    'chron-del': async el => {
      const rid = reviewerId();
      if (!E.isState(me) && !(rid && me === rid)) {
        return fail('Solo un Estado fundador o el Archivista puede borrar crónicas.');
      }
      if (await askConfirm('¿Borrar la crónica?')) { state.chronicles = state.chronicles.filter(x => x.id !== el.dataset.id); commit('lore'); }
    },

    rail: el => { state.railBlocks = Math.max(0, state.railBlocks + Number(el.dataset.d)); commit('territory'); },
    'rail-set': () => { const v = num(val('rail-set'), -1); if (v >= 0) { state.railBlocks = Math.round(v); commit('territory'); } },
    'st-add': () => {
      const name = val('st-name');
      if (!name) return;
      state.stations.unshift({ id: uid('est'), name, line: val('st-line'), coords: val('st-coords'), owner: val('st-owner') });
      commit('territory');
    },
    'st-del': el => { state.stations = state.stations.filter(x => x.id !== el.dataset.id); commit('territory'); },
    'pt-add': () => {
      state.portals.unshift({ id: uid('prt'), label: val('pt-label') || 'Portal', ow: `${val('ow-x') || 0}, ${val('ow-z') || 0}`, nh: `${val('nh-x') || 0}, ${val('nh-z') || 0}` });
      commit('territory');
    },
    'pt-del': el => { state.portals = state.portals.filter(x => x.id !== el.dataset.id); commit('territory'); },
    'vg-filter': el => {
      state.ui.censusFilter = el.dataset.v || 'all';
      save(true);
      renderTerritory();
    },
    'vg-kind-btn': el => {
      state.ui.vgAddKind = el.dataset.v === 'animal' ? 'animal' : 'villager';
      state.ui.vgFormOpen = true;
      save(true);
      renderTerritory();
    },
    'vg-add': () => {
      const name = val('vg-name');
      if (!name) return fail('Toda cédula necesita un nombre propio.');
      const kind = (state.ui.vgAddKind || 'villager') === 'animal' ? 'animal' : 'villager';
      const prof = kind === 'villager' ? val('vg-prof') : '';
      const species = kind === 'animal' ? val('vg-species') : '';
      const owner = kind === 'animal' ? (val('vg-owner') || 'myth') : ((state.professions && state.professions[prof]) || 'myth');
      const cedula = nextCedulaCode(kind, owner);
      const tagged = Boolean($('vg-tagged') && $('vg-tagged').checked);
      const cured = kind === 'villager' ? Boolean($('vg-cured') && $('vg-cured').checked) : false;
      state.villagers.unshift({
        id: uid(kind === 'animal' ? 'ani' : 'ald'),
        kind,
        cedula,
        name,
        prof,
        species,
        owner,
        home: val('vg-home'),
        offer: val('vg-offer'),
        cured,
        tagged,
        deceased: false,
        issuedAt: Date.now()
      });
      state.ui.vgFormOpen = false;
      log('Registro Civil (TRD 150-01)', `Cédula ${cedula} expedida para ${name}.`);
      commit('territory');
      toast('Cédula Expedida', `${name} · ${cedula}`, 'emerald');
    },
    'vg-issue-all': () => {
      let issued = 0;
      state.villagers.forEach(v => {
        if (!v.cedula) {
          const kind = v.kind === 'animal' ? 'animal' : 'villager';
          v.kind = kind;
          const owner = censusOwnerOf(v);
          v.cedula = nextCedulaCode(kind, owner);
          if (!v.issuedAt) v.issuedAt = Date.now();
          issued++;
        }
      });
      commit('territory');
      toast('Cédulas Asignadas', `${issued} registros actualizados en TRD 150-01.`, 'emerald');
    },
    'vg-tag': el => {
      const v = state.villagers.find(x => x.id === el.dataset.id);
      if (v) { v.tagged = !v.tagged; commit('territory'); }
    },
    'vg-vital': el => {
      const v = state.villagers.find(x => x.id === el.dataset.id);
      if (v) { v.deceased = !v.deceased; commit('territory'); }
    },
    'vg-cure': el => { const v = state.villagers.find(x => x.id === el.dataset.id); if (v) { v.cured = !v.cured; commit('territory'); } },
    'vg-copy-tag': el => {
      const idx = state.villagers.findIndex(x => x.id === el.dataset.id);
      if (idx < 0) return;
      const v = state.villagers[idx];
      const code = displayCedula(v, idx);
      const tagStr = `${v.name} [${code}]`;
      copyText(tagStr);
      toast('Rótulo para Yunque copiado', `${tagStr} (listo para Ctrl+V en Name Tag).`, 'emerald');
    },
    'vg-card': el => {
      const idx = state.villagers.findIndex(x => x.id === el.dataset.id);
      if (idx < 0) return;
      const v = state.villagers[idx];
      if ($('report-modal-title')) $('report-modal-title').textContent = `🪪 CÉDULA OFICIAL · ${displayCedula(v, idx)}`;
      $('report-area').value = formatCedulaCard(v, idx);
      $('modal-report').classList.add('open');
    },
    'vg-del': el => { state.villagers = state.villagers.filter(x => x.id !== el.dataset.id); commit('territory'); },

    'open-reset': () => {
      if ($('reset-confirm-input')) $('reset-confirm-input').value = '';
      $('modal-reset').classList.add('open');
      setTimeout(() => { if ($('reset-confirm-input')) $('reset-confirm-input').focus(); }, 30);
    },
    'confirm-reset': async () => {
      if (!requireFounder('reiniciar todo el mundo')) return;
      if (val('reset-confirm-input').toUpperCase() !== 'BORRAR') {
        return fail('Escribe BORRAR en el cuadro para confirmar el reinicio.');
      }
      autoBackup(true, 'Antes de reiniciar');
      if (CLOUD && CLOUD.getInfo().configured) {
        await CLOUD.saveSnapshot('Antes de reiniciar', state, me ? pname(me) : '');
      }
      safeDel(STORAGE_KEY);
      state = defaultState();
      addDefaultLaws('servidor');
      addDefaultLaws('rol');
      state.ui.rpLawsSeeded = true;
      closeModals();
      commit();
      if (CLOUD && CLOUD.getInfo().configured) {
        CLOUD.pushState(state, true);
      }
      showTab('roadmap');
      toast('Mundo reiniciado', 'Todo volvió al día 0.', 'redstone');
    },
    'open-backup': () => {
      renderCloudPanel(true);
      $('modal-backup').classList.add('open');
    },
    'cloud-pull': async () => {
      if (!CLOUD) return;
      const info = CLOUD.getInfo();
      if (info.status === 'conflict' && !await askConfirm('¿Descargar la copia de la nube y reemplazar los cambios locales no subidos? (Se guardará copia automática local antes.)')) return;
      const res = await CLOUD.pullNow();
      if (!res.ok) return fail(res.error ? res.error.message : 'No se pudo sincronizar.');
      if (res.empty) toast('Nube vacía', 'Todavía no hay partida guardada en esta sala.', 'compass');
      postNewLaws();
      renderCloudPanel(true);
    },
    'cloud-push-force': async () => {
      if (!CLOUD || !requireFounder('forzar la subida a Supabase')) return;
      const info = CLOUD.getInfo();
      if (info.rev && !await askConfirm('¿Subir tu copia local actual a Supabase como la copia oficial de la nube?')) return;
      const res = await CLOUD.pushState(state, true);
      if (!res.ok) return fail(res.error ? res.error.message : 'No se pudo subir a la nube.');
      toast('Subido a Supabase', `Revisión #${res.rev} guardada.`, 'emerald');
      renderCloudPanel(true);
    },
    'cloud-snapshot': async () => {
      if (!CLOUD) return;
      const label = await askText('Nombre para este punto de restauración en la nube:', `Sesión ${when(Date.now())}`);
      if (label === null) return;
      const res = await CLOUD.saveSnapshot(label.trim() || 'Punto manual', state, me ? pname(me) : '');
      if (!res.ok) return fail(res.error ? res.error.message : 'No se pudo guardar el punto.');
      toast('Punto guardado', res.snapshot.label, 'emerald');
      loadCloudSnapshots();
    },
    'cloud-restore-snap': async el => {
      if (!CLOUD || !requireFounder('restaurar puntos de restauración en la nube')) return;
      const id = Number(el.dataset.id);
      if (!await askConfirm('¿Restaurar este punto de restauración en la nube para todos los jugadores? (Se guarda copia local antes.)')) return;
      const res = await CLOUD.fetchSnapshot(id);
      if (!res.ok || !res.snapshot) return fail('No se pudo cargar ese punto.');
      autoBackup(true, 'Antes de restaurar nube');
      const keptUi = state.ui;
      state = merge(defaultState(), CLOUD.mergeCloudUiWithLocal(res.snapshot.state, keptUi));
      save(true);
      await CLOUD.pushState(state, true);
      closeModals();
      renderAll();
      toast('Punto restaurado', res.snapshot.label, 'emerald');
    },
    'cloud-save-cfg': async () => {
      if (!CLOUD) return;
      const url = val('sb-url');
      const anonKey = val('sb-key');
      const worldId = val('sb-world') || 'main';
      if (!url || !anonKey) return fail('Ingresa la URL del proyecto y la Anon Key de Supabase.');
      const info = await CLOUD.saveConfig({ url, anonKey, worldId });
      renderCloudPanel(true);
      if (info.status === 'synced') toast('Supabase conectado', `Sala: ${info.config.worldId}`, 'emerald');
      else if (info.status === 'error') fail(info.statusDetail || 'Error al conectar con Supabase.');
    },
    'cloud-reset-cfg': async () => {
      if (!CLOUD) return;
      await CLOUD.clearLocalConfig();
      renderCloudPanel(true);
      toast('Configuración local borrada', 'Se usa supabase-config.js.', 'compass');
    },
    'cloud-copy-link': () => {
      if (!CLOUD) return;
      copyText(CLOUD.buildInviteUrl());
      toast('Enlace copiado', 'Compártelo para conectar otro navegador al mismo mundo.', 'diamond');
    },
    'cloud-copy-snippet': () => {
      if (!CLOUD) return;
      copyText(CLOUD.buildConfigFileSnippet());
      toast('Código copiado', 'Pégalo en supabase-config.js y súbelo al repo.', 'emerald');
    },
    'open-report': () => { if ($('report-modal-title')) $('report-modal-title').textContent = 'RESUMEN PARA DISCORD'; $('report-area').value = buildReport(); $('modal-report').classList.add('open'); },
    'copy-report': () => { copyText($('report-area').value); toast('Copiado al portapapeles', 'Texto listo para pegar.', 'emerald'); },
    'close-modal': () => closeModals()
  };

  // Agrega las leyes, código penal, decretos o resoluciones base que falten (como borradores sin firmar)
  const nextLawNum = (kind, docType) => {
    const dt = docType || (kind === 'servidor' ? 'servidor' : 'ley');
    return state.laws.filter(l => (l.kind || 'servidor') === kind && (l.docType || ((l.kind || 'servidor') === 'servidor' ? 'servidor' : 'ley')) === dt)
      .reduce((m, l) => Math.max(m, l.num), 0) + 1;
  };
  // Leyes nuevas que se postulan solas como BORRADOR (sin firmas). Se hace después de sincronizar
  // con la nube y se compara por título, para que no queden duplicadas si ambos abren la página.
  const POSTED_LAWS = [
    'Ley 012 · Honra, Buen Nombre, Calumnia e Injuria',
    'Ley 013 · Reserva de Estado y Construcciones Confidenciales',
    'Manual 003 · Manual Oficial del Archivista Auditor y Auditoría de Obras (TRD 120-01)'
  ];
  function dedupePostedLaws() {
    if (!Array.isArray(state.laws) || state.laws.length < 2) return false;
    const rank = l => {
      let s = 0;
      if (l.review && l.review.status === 'approved') s += 100;
      else if (l.review && l.review.status && l.review.status !== 'none') s += 20;
      if (l.signs && l.signs.myth) s += 10;
      if (l.signs && l.signs.scad) s += 10;
      if (l.review && Array.isArray(l.review.notes)) s += l.review.notes.length;
      return s;
    };
    const bestByKey = new Map();
    for (const l of state.laws) {
      const k = String(l.title || '').trim().toLowerCase();
      if (!k) continue;
      const prev = bestByKey.get(k);
      if (!prev || rank(l) > rank(prev) || (rank(l) === rank(prev) && (l.t || 0) < (prev.t || 0))) {
        bestByKey.set(k, l);
      }
    }
    const before = state.laws.length;
    const keepIds = new Set([...bestByKey.values()].map(x => x.id));
    state.laws = state.laws.filter(l => !String(l.title || '').trim() || keepIds.has(l.id));
    return state.laws.length !== before;
  }

  function postNewLaws() {
    const deduped = dedupePostedLaws();
    const have = new Set(state.laws.map(l => String(l.title || '').trim().toLowerCase()));
    const allPack = [...(D.DEFAULT_RP_LAWS || []), ...(D.DEFAULT_PENAL_PACK || [])];
    const fresh = [];
    for (const d of allPack) {
      const k = String(d.title || '').trim().toLowerCase();
      if (POSTED_LAWS.includes(d.title) && !have.has(k)) {
        have.add(k);
        fresh.push(d);
      }
    }
    if (!fresh.length && !deduped) return;
    fresh.forEach(d => {
      const docType = d.docType || 'ley';
      const trdCode = d.trdCode || ((D.DOC_TYPES || {})[docType] || {}).trd || '100-01';
      const stableId = 'ley-post-' + String(d.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      state.laws.push({ id: stableId, kind: 'rol', docType, trdCode, num: nextLawNum('rol', docType), title: d.title, text: tx(d.text), sanction: tx(d.sanction), signs: { myth: false, scad: false }, review: { status: 'none', notes: [] }, repealed: false, t: Date.now() });
    });
    save();
    renderAll();
    if (fresh.length) toast('Leyes postuladas', `${fresh.length} documento(s) nuevos en Estados y Leyes. Rigen cuando firmen ambos.`, 'gavel');
  }

  function addDefaultLaws(kind = 'servidor') {
    const source = kind === 'penal' ? (D.DEFAULT_PENAL_PACK || []) : kind === 'rol' ? (D.DEFAULT_RP_LAWS || []) : D.DEFAULT_LAWS;
    const targetKind = kind === 'servidor' ? 'servidor' : 'rol';
    const have = new Set(state.laws.map(l => l.title.toLowerCase()));
    let added = 0;
    source.forEach(d => {
      if (have.has(d.title.toLowerCase())) return;
      added += 1;
      const docType = d.docType || (targetKind === 'servidor' ? 'servidor' : 'ley');
      const trdCode = d.trdCode || ((D.DOC_TYPES || {})[docType] || {}).trd || '100-01';
      state.laws.push({ id: uid('ley'), kind: targetKind, docType, trdCode, num: nextLawNum(targetKind, docType), title: d.title, text: tx(d.text), sanction: tx(d.sanction), signs: { myth: false, scad: false }, repealed: false, t: Date.now() });
    });
    return added;
  }

  ACTIONS.tip = el => {
    const g = (D.GLOSSARY || {})[el.dataset.k];
    const pop = $('tip-pop');
    if (!g || !pop) return;
    if (pop.dataset.k === el.dataset.k && pop.classList.contains('open')) { pop.classList.remove('open'); pop.dataset.k = ''; return; }
    pop.dataset.k = el.dataset.k;
    pop.innerHTML = `<div class="font-pixel text-gold" style="font-size:11px;margin-bottom:6px;">${esc(tx(g.t))}</div>
      <div class="text-xs text-white" style="line-height:1.55;">${esc(tx(g.d))}</div>
      ${g.ex ? `<div class="text-xs text-muted" style="margin-top:6px;line-height:1.5;"><strong class="text-emerald">Ejemplo:</strong> ${esc(tx(g.ex))}</div>` : ''}`;
    pop.classList.add('open');
    const r = el.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 24);
    pop.style.width = w + 'px';
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    const below = r.bottom + 8 + pop.offsetHeight < window.innerHeight;
    pop.style.left = left + 'px';
    pop.style.top = (below ? r.bottom + 8 : r.top - pop.offsetHeight - 8) + 'px';
  };
  function closeTip() { const p = $('tip-pop'); if (p) { p.classList.remove('open'); p.dataset.k = ''; } }

  /* ---------- Ventana de confirmación propia (el panel del navegador bloquea confirm/prompt) ---------- */
  function ask(message, withInput, initial) {
    return new Promise(resolve => {
      let box = $('modal-ask');
      if (!box) {
        box = document.createElement('div');
        box.id = 'modal-ask';
        box.className = 'mc-modal-backdrop';
        box.innerHTML = `<div class="mc-panel mc-modal p-lg"><p id="ask-msg" class="text-sm text-white" style="margin:0 0 12px 0;white-space:pre-wrap;line-height:1.5;"></p>
          <textarea id="ask-input" rows="3" class="mc-textarea" style="margin-bottom:12px;display:none;"></textarea>
          <div class="flex-row-wrap" style="justify-content:flex-end;gap:8px;"><button class="mc-btn" id="ask-no">Cancelar</button><button class="mc-btn mc-btn-emerald" id="ask-yes">Aceptar</button></div></div>`;
        document.body.appendChild(box);
      }
      $('ask-msg').textContent = message;
      const input = $('ask-input');
      input.style.display = withInput ? 'block' : 'none';
      input.value = initial || '';
      box.classList.add('open');
      setTimeout(() => (withInput ? input : $('ask-no')).focus(), 30);
      const done = v => { box.classList.remove('open'); $('ask-yes').onclick = $('ask-no').onclick = null; box.onkeydown = null; resolve(v); };
      $('ask-yes').onclick = ev => { ev.stopPropagation(); done(withInput ? input.value : true); };
      $('ask-no').onclick = ev => { ev.stopPropagation(); done(withInput ? null : false); };
      box.onkeydown = ev => { if (ev.key === 'Escape') done(withInput ? null : false); if (ev.key === 'Enter' && !withInput) { ev.preventDefault(); done(ev.target.id === 'ask-yes'); } };
    });
  }
  const askConfirm = msg => ask(msg, false);
  const askText = (msg, initial) => ask(msg, true, initial);

  /* ---------- Deshacer (guarda copias del estado antes de cada acción) ---------- */
  let editingLawId = null;
  const UNDO_KEY = 'forever_world_undo';
  const NO_UNDO = new Set(['form', 'shop-edit', 'mode-simple', 'mode-advanced', 'eco-tab', 'mint-fill', 'ledger-filter', 'eco-manual-copy', 'state-tab', 'jump-era', 'law-template', 'law-edit', 'tip', 'filter', 'works-filter', 'law-doc-filter', 'law-rev-filter', 'law-book', 'vg-filter', 'vg-kind-btn', 'vg-copy-tag', 'vg-card', 'price-buy', 'price-challenge', 'open-reset', 'confirm-reset', 'open-backup',
    'open-report', 'copy-report', 'close-modal', 'undo',
    'law-approve-rev', 'law-return', 'law-submit', 'law-sign', 'law-repeal', 'law-upgrade-pack', 'law-defaults',
    'work-approve', 'work-reject', 'work-reopen', 'work-lost', 'guest-del',
    'cloud-pull', 'cloud-push-force', 'cloud-snapshot', 'cloud-restore-snap', 'cloud-save-cfg', 'cloud-reset-cfg', 'cloud-copy-link', 'cloud-copy-snippet']);
  const UNDO_LABELS = {
    'law-add': 'Nueva norma', 'law-edit': 'Editar norma', 'law-edit-save': 'Editar acto', 'law-submit': 'Enviar a revisión', 'law-return': 'Devolver norma', 'law-approve-rev': 'Avalar norma', 'law-sign': 'Firma de norma', 'law-repeal': 'Derogar norma', 'law-del': 'Borrar norma', 'law-defaults': 'Normas sugeridas', 'law-upgrade-pack': 'Actualización archivística', 'law-move': 'Mover norma',
    'trd-add': 'Nueva serie TRD', 'trd-del': 'Borrar serie TRD',
    'chron-add': 'Nueva crónica', 'chron-del': 'Borrar crónica', 'guest-add': 'Nuevo invitado', 'guest-del': 'Borrar invitado',
    rail: 'Contador de vía', 'rail-set': 'Contador de vía', 'st-add': 'Nueva estación', 'st-del': 'Borrar estación',
    'pt-add': 'Nuevo portal', 'pt-del': 'Borrar portal', 'vg-add': 'Expedir cédula', 'vg-issue-all': 'Asignar cédulas', 'vg-tag': 'Estado Name Tag', 'vg-vital': 'Estado vital', 'vg-cure': 'Cura de aldeano', 'vg-del': 'Borrar cédula',
    'season-start': 'Iniciar temporada', 'season-roll': 'Sorteo de temporada', 'season-close': 'Cerrar temporada',
    'mega-add': 'Etapa de megaproyecto', 'mega-del': 'Borrar etapa', 'sb-reveal': 'Oferta sellada', 'sb-reset': 'Reiniciar oferta sellada'
  };
  let undoStack = [];
  try { undoStack = JSON.parse(safeGet(UNDO_KEY) || '[]'); } catch { undoStack = []; }

  function snapshot() {
    const { ui, ...rest } = state;
    return JSON.stringify(rest);
  }
  function clearUndoStack() {
    if (!undoStack.length) return;
    undoStack = [];
    safeDel(UNDO_KEY);
    renderUndoButtons();
  }
  function pushUndo(label, snap) {
    undoStack.push({ label: String(label).slice(0, 140), snap, actor: me || '', rev: CLOUD ? CLOUD.getInfo().rev : null, t: Date.now() });
    if (undoStack.length > 20) undoStack.shift();
    if (!safeSet(UNDO_KEY, JSON.stringify(undoStack))) undoStack.splice(0, undoStack.length - 5);
    renderUndoButtons();
  }
  function renderUndoButtons() {
    const raw = undoStack[undoStack.length - 1];
    const last = raw && me && raw.actor === me ? raw : null;
    document.querySelectorAll('[data-undo-slot]').forEach(el => {
      el.innerHTML = last
        ? `<button class="mc-btn mc-btn-gold" data-action="undo" title="${esc(last.label)}">↶ Deshacer: ${esc(last.label.length > 60 ? last.label.slice(0, 60) + '…' : last.label)}</button>`
        : '<span class="text-xs text-dim">Nada que deshacer.</span>';
    });
  }
  ACTIONS.undo = () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    if (!me || last.actor !== me) {
      return fail('Solo quien realizó esa acción puede deshacerla.');
    }
    undoStack.pop();
    safeSet(UNDO_KEY, JSON.stringify(undoStack));
    const ui = state.ui;
    state = merge(defaultState(), JSON.parse(last.snap));
    state.ui = ui;
    log('Deshacer', `Se deshizo: ${last.label}`);
    commit();
    toast('Deshecho', last.label, 'compass');
  };

  /* ---------- Anular / editar movimientos individuales del Libro Mayor ---------- */
  // Diferencia de saldos (de todos y del banco) que produjo un movimiento
  function balanceDelta(a, b) {
    const d = {};
    const ids = new Set([...Object.keys(a.holdings || {}), ...Object.keys(b.holdings || {}), 'bank']);
    ids.forEach(pid => {
      const x = pid === 'bank' ? a.bank : (a.holdings[pid] || { M: 0, S: 0 });
      const y = pid === 'bank' ? b.bank : (b.holdings[pid] || { M: 0, S: 0 });
      const dm = E.r4((y.M || 0) - (x.M || 0)), ds = E.r4((y.S || 0) - (x.S || 0));
      if (Math.abs(dm) > 1e-6 || Math.abs(ds) > 1e-6) d[pid] = { M: dm, S: ds };
    });
    return Object.keys(d).length ? d : null;
  }
  // Tipos donde anular = devolver el dinero (préstamos, acciones y obras se corrigen en su propia sección)
  const VOIDABLE = new Set(['Compra', 'Transferencia', 'Emisión', 'Quema', 'Cambio', 'Banco', 'Dividendo', 'Ajuste manual']);
  ACTIONS['led-void'] = async el => {
    const l = state.economy.ledger.find(x => x.id === el.dataset.id);
    if (!l || l.void) return;
    if (!l.delta) return voidLegacy(l);
    if (!VOIDABLE.has(l.type)) return fail('Este tipo se corrige en su sección (préstamos, acciones u obras) o con Deshacer.');
    for (const [pid, d] of Object.entries(l.delta)) {
      const h = pid === 'bank' ? state.economy.bank : E.holdings(state, pid);
      if (h.M - d.M < -1e-6 || h.S - d.S < -1e-6) return fail(`No se puede anular: ${pname(pid)} ya gastó ese dinero. Usa el Ajuste manual.`);
    }
    if (!await askConfirm(`¿Anular este movimiento?\n\n${l.text}`)) return;
    Object.entries(l.delta).forEach(([pid, d]) => {
      const h = pid === 'bank' ? state.economy.bank : E.holdings(state, pid);
      h.M = E.r4(h.M - d.M); h.S = E.r4(h.S - d.S);
    });
    l.void = true;
    recordFx();
    log('Anulación', `Se anuló: ${l.text}`);
    commit('economy', 'state');
  };
  // Movimientos viejos sin cifras guardadas: se lee el texto y se hace el pago inverso
  async function voidLegacy(l) {
    const parseNum = s => num(String(s).replace(/\./g, '').replace(',', '.'), NaN);
    const pidByName = n => participants().find(p => pname(p).toLowerCase() === n.trim().toLowerCase());
    const stateByNation = n => STATES.find(s => nat(s).nation.toLowerCase() === n.trim().toLowerCase());
    const curBySym = x => ['M', 'S'].find(c => sym(c).toLowerCase() === x.trim().toLowerCase());
    let from, to, amount, cur;
    let m;
    if (l.type === 'Transferencia' && (m = l.text.match(/^(.+?) → (.+?): ([\d.,]+) (\S+?)\./))) {
      [, from, to, amount, cur] = m; from = pidByName(from); to = pidByName(to);
    } else if (l.type === 'Compra' && (m = l.text.match(/^(.+?) compró a (.+?): .* = ([\d.,]+) (\S+?)[\s.(]/))) {
      [, from, to, amount, cur] = m; from = pidByName(from); to = stateByNation(to);
    } else {
      return fail('Este movimiento es anterior a esta versión y no se puede leer automáticamente. Corrígelo con el Ajuste manual de saldos (Estados y Leyes).');
    }
    amount = parseNum(amount); cur = curBySym(cur);
    if (!from || !to || !cur || !(amount > 0)) return fail('No pude leer quién, a quién o cuánto. Usa el Ajuste manual de saldos.');
    const dry = E.pay(clone(state), to, from, cur, amount, true);
    if (!dry.ok) return fail(`No se puede revertir: ${dry.msg} Usa el Ajuste manual de saldos.`);
    const extra = dry.short > 0 ? `\n\nOjo: ${pname(to)} ya no tiene todos esos ${sym(cur)}; se convertirán ${money(dry.cost, dry.costCur)} en el banco.` : '';
    if (!await askConfirm(`Movimiento antiguo. Se hará el pago inverso:\n${pname(to)} devuelve ${money(amount, cur)} a ${pname(from)}.${extra}\n\n¿Continuar?`)) return;
    E.pay(state, to, from, cur, amount);
    l.void = true;
    recordFx();
    log('Anulación', `Se anuló (pago inverso): ${l.text}`);
    commit('economy', 'state');
  }

  ACTIONS['led-edit'] = async el => {
    const l = state.economy.ledger.find(x => x.id === el.dataset.id);
    if (!l) return;
    const t = await askText('Editar el texto del movimiento (los montos no cambian; para eso usa Anular):', l.text);
    if (t === null || !t.trim() || t === l.text) return;
    l.text = t.trim();
    l.edited = true;
    commit('economy');
  };

  /* ---------- Ajuste manual de saldos (para corregir errores viejos) ---------- */
  ACTIONS['adjust-apply'] = () => {
    const note = val('adj-note');
    if (!note) return fail('Escribe el motivo del ajuste (queda en el Libro Mayor).');
    const changes = [];
    document.querySelectorAll('[data-adj]').forEach(inp => {
      const [pid, c] = inp.dataset.adj.split('|');
      const v = E.r4(num(inp.value, NaN));
      if (!Number.isFinite(v) || v < 0) return;
      const target = pid === 'bank' ? state.economy.bank : E.holdings(state, pid);
      if (Math.abs(target[c] - v) > 1e-6) { changes.push(`${pname(pid)} ${money(target[c], c)} → ${money(v, c)}`); target[c] = v; }
    });
    if (!changes.length) return fail('No cambiaste ningún saldo.');
    recordFx();
    log('Ajuste manual', `${changes.join('; ')}. Motivo: ${note}`);
    toast('Saldos ajustados', `${changes.length} cambio(s)`, 'anvil');
    commit();
  };

  ACTIONS['guide-add-all'] = async el => {
    const s0 = el.dataset.s;
    if (!requireMe(s0, 'agregar productos a la tienda de este Estado')) return;
    const missing = D.PRICE_GUIDE.filter(g => g.seller === s0 && !state.economy.prices.some(p => p.seller === s0 && p.name === g.name));
    if (!missing.length) return toast('Tienda', 'Ya tiene todos los productos de la guía.', 'emerald');
    if (!await askConfirm(`¿Agregar ${missing.length} productos a la tienda de ${nat(s0).nation} con los precios sugeridos? Después se pueden cambiar o borrar.`)) return;
    missing.forEach(g => state.economy.prices.push({ id: uid('prc'), seller: s0, name: g.name, unit: g.unit, price: g.price, history: [{ t: Date.now(), price: g.price, via: 'guía' }] }));
    log('Tarifa', `${nat(s0).nation} publica ${missing.length} productos con los precios de la guía.`);
    commit('economy');
  };
  // Guía de precios → lista oficial (precio = punto medio del rango)
  ACTIONS['guide-add'] = el => {
    const g = D.PRICE_GUIDE[Number(el.dataset.i)];
    if (!g || !requireMe(g.seller, 'publicar precios en esta tienda')) return;
    const price = g.price;
    state.economy.prices.push({ id: uid('prc'), seller: g.seller, name: g.name, unit: g.unit, price, history: [{ t: Date.now(), price, via: 'guía' }] });
    log('Tarifa', `${nat(g.seller).nation} publica (desde la guía): ${g.name} a ${money(price, curOf(g.seller))}.`);
    commit('economy');
  };

  function rollSeason() {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    state.seasons.roll = { reto: pick(D.SEASON_POOLS.reto), exped: pick(D.SEASON_POOLS.exped), restr: pick(D.SEASON_POOLS.restr) };
  }

  function closeModals() {
    const ask = $('modal-ask');
    if (ask && ask.classList.contains('open')) { $('ask-no').click(); return; }
    document.querySelectorAll('.mc-modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
  }

  let pendingRemoteRow = null;

  function isEditingField() {
    const el = document.activeElement;
    return Boolean(el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && el.closest('#view-roadmap, #view-economy, #view-state, #view-lore, #view-territory'));
  }

  function applyRemoteRow(row, meta = {}) {
    if (!row || !row.state) return;
    if (meta.fromRealtime && isEditingField()) {
      pendingRemoteRow = { row, meta };
      return;
    }
    pendingRemoteRow = null;
    autoBackup(false, 'Antes de sincronizar nube');
    const keptUi = state.ui;
    const mergedRemote = CLOUD ? CLOUD.mergeCloudUiWithLocal(row.state, keptUi) : row.state;
    state = merge(defaultState(), mergedRemote);
    let needCloudRename = false;
    if (!state.ui.luthadelV1) {
      if (state.settings?.nations?.scad?.nation === 'Gotham') {
        state.settings.nations.scad.nation = 'Luthadel';
        needCloudRename = true;
      }
      state.ui.luthadelV1 = true;
    }
    state.updatedAt = Number(row.updated_at) || state.updatedAt || Date.now();
    state.updatedBy = row.updated_by || state.updatedBy || '';
    if (preferredMe && participants().includes(preferredMe)) me = preferredMe;
    else if (me && !participants().includes(me)) me = '';
    safeSet(STORAGE_KEY, JSON.stringify(state));
    if (needCloudRename && CLOUD) CLOUD.schedulePush(() => state);
    if (CLOUD) CLOUD.setPresence({ id: me, name: me ? pname(me) : 'Visitante' });
    if (meta.fromRealtime) clearUndoStack();
    if (dedupePostedLaws() && CLOUD) CLOUD.schedulePush(() => state);
    renderAll();
    if ($('modal-backup') && $('modal-backup').classList.contains('open')) renderCloudPanel(false);
    if (meta.fromRealtime) {
      toast('Sincronizado', `Actualizado${row.updated_by ? ' por ' + row.updated_by : ' desde Supabase'}.`, 'compass');
    }
  }

  function applyMergedCloudState(mergedCloud, row) {
    if (!mergedCloud) return;
    const keptUi = state.ui;
    const merged = CLOUD ? CLOUD.mergeCloudUiWithLocal(mergedCloud, keptUi) : mergedCloud;
    state = merge(defaultState(), merged);
    state.updatedAt = Math.max(Number(state.updatedAt) || 0, Number(row && row.updated_at) || 0) || Date.now();
    state.updatedBy = (me ? pname(me) : '') || (row && row.updated_by) || state.updatedBy || '';
    if (preferredMe && participants().includes(preferredMe)) me = preferredMe;
    else if (me && !participants().includes(me)) me = '';
    safeSet(STORAGE_KEY, JSON.stringify(state));
    if (!isEditingField()) renderAll();
    if ($('modal-backup') && $('modal-backup').classList.contains('open')) renderCloudPanel(false);
  }

  async function loadCloudSnapshots() {
    const box = $('cloud-snapshots-list');
    if (!box || !CLOUD) return;
    const info = CLOUD.getInfo();
    if (!info.configured || info.status === 'offline') {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = '<span class="text-xs text-muted">Cargando puntos en la nube...</span>';
    const res = await CLOUD.listSnapshots(10);
    if (!res.ok) {
      box.innerHTML = '<span class="text-xs text-dim">Aún no se pueden leer los puntos de restauración.</span>';
      return;
    }
    if (!res.items.length) {
      box.innerHTML = '<span class="text-xs text-dim">Sin puntos guardados en la nube todavía.</span>';
      return;
    }
    box.innerHTML = res.items.map(s => `<div class="flex-between text-xs" style="padding:3px 0;gap:8px;">
      <span class="text-muted">${when(new Date(s.created_at).getTime())} · ${esc(s.label)}${s.saved_by ? ' (' + esc(s.saved_by) + ')' : ''}</span>
      <button class="mc-btn" style="padding:2px 7px;" data-action="cloud-restore-snap" data-id="${s.id}">Restaurar</button>
    </div>`).join('');
  }

  function renderCloudPanel(fetchSnaps = false) {
    const box = $('cloud-backup-panel');
    if (!box || !CLOUD) return;
    const info = CLOUD.getInfo();
    const cfg = info.config || {};
    const statusMap = {
      unconfigured: ['tag-slate', 'Sin configurar'],
      connecting: ['tag-gold', 'Conectando...'],
      synced: ['tag-emerald', `Conectado${info.rev ? ' · rev #' + info.rev : ''}`],
      syncing: ['tag-cyan', 'Guardando...'],
      conflict: ['tag-redstone', 'Conflicto de versión'],
      error: ['tag-redstone', 'Error de conexión'],
      offline: ['tag-gold', 'Sin conexión']
    };
    const [tagCls, tagText] = statusMap[info.status] || statusMap.unconfigured;

    const online = (info.onlinePlayers || []).map(p => p.name || 'Visitante');
    const onlineTxt = online.length ? online.join(', ') : (me ? pname(me) : 'Solo tú');

    box.innerHTML = `
      <div class="flex-between" style="margin-bottom:6px;">
        <div class="flex-row-wrap" style="gap:6px;">
          <strong class="text-xs text-white">ESTADO DE LA NUBE</strong>
          <span class="mc-tag ${tagCls}">${esc(tagText)}</span>
        </div>
        ${info.configured ? `<span class="text-xs font-mono text-muted">Sala: ${esc(cfg.worldId || 'main')}</span>` : ''}
      </div>
      ${info.statusDetail ? `<div class="text-xs text-gold" style="margin-bottom:6px;">${esc(info.statusDetail)}</div>` : ''}
      ${info.configured && info.lastSyncAt ? `<div class="text-xs text-muted" style="margin-bottom:4px;">Última actualización: ${when(info.lastSyncAt)}${info.lastSyncBy ? ' por ' + esc(info.lastSyncBy) : ''}.</div>` : ''}
      ${info.configured ? `<div class="text-xs text-emerald" style="margin-bottom:8px;">En línea ahora: ${esc(onlineTxt)}</div>` : ''}
      ${info.configured ? `
        <div class="flex-row-wrap" style="gap:6px;margin-bottom:10px;">
          <button class="mc-btn mc-btn-diamond" style="padding:4px 8px;" data-action="cloud-pull">🔄 Sincronizar</button>
          <button class="mc-btn mc-btn-emerald" style="padding:4px 8px;" data-action="cloud-snapshot">📸 Guardar punto</button>
          <button class="mc-btn mc-btn-gold" style="padding:4px 8px;" data-action="cloud-push-force">⬆ Forzar subida</button>
          <button class="mc-btn" style="padding:4px 8px;" data-action="cloud-copy-link">🔗 Copiar enlace</button>
        </div>
        <div style="margin-bottom:8px;">
          <div class="text-xs text-white" style="font-weight:700;margin-bottom:4px;">Puntos de restauración en Supabase</div>
          <div id="cloud-snapshots-list"></div>
        </div>
      ` : `<p class="text-xs text-muted" style="margin:0 0 8px 0;">Conecta tu proyecto de Supabase para sincronizar automáticamente entre jugadores.</p>`}
      <details class="mc-details" ${info.configured ? '' : 'open'}>
        <summary class="text-xs font-mono">Configurar Supabase</summary>
        <div class="section-stack" style="margin-top:8px;">
          <div>
            <label class="text-xs font-mono">Project URL</label>
            <input id="sb-url" class="mc-input font-mono" style="font-size:11px;margin-top:3px;" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url || '')}" />
          </div>
          <div>
            <label class="text-xs font-mono">Anon / Publishable Key</label>
            <input id="sb-key" class="mc-input font-mono" style="font-size:11px;margin-top:3px;" placeholder="eyJ..." value="${esc(cfg.anonKey || '')}" />
          </div>
          <div>
            <label class="text-xs font-mono">ID de sala / mundo</label>
            <input id="sb-world" class="mc-input font-mono" style="font-size:11px;margin-top:3px;" placeholder="main" value="${esc(cfg.worldId || 'main')}" />
          </div>
          <div class="flex-row-wrap" style="gap:6px;">
            <button class="mc-btn mc-btn-emerald" style="padding:4px 8px;" data-action="cloud-save-cfg">Guardar y conectar</button>
            ${cfg.source === 'local' ? `<button class="mc-btn" style="padding:4px 8px;" data-action="cloud-reset-cfg">Usar config del repo</button>` : ''}
            ${info.configured ? `<button class="mc-btn" style="padding:4px 8px;" data-action="cloud-copy-snippet">Copiar para supabase-config.js</button>` : ''}
          </div>
        </div>
      </details>
    `;
    if (fetchSnaps && info.configured) loadCloudSnapshots();
  }

  function buildReport() {
    const all = D.ERAS.flatMap(e => e.tasks);
    const done = all.filter(isTaskDone).length;
    const r = E.rate(state);
    const line = s => {
      const c = curOf(s), h = E.holdings(state, s);
      return `**${nat(s).nation}** (${nat(s).player}): tesoro ${money(h[c], c)} + ${money(h[E.otherCur(c)], E.otherCur(c))} · capitalización ${fmt(E.capitalization(state, s, CATS))} · acción ${money(E.sharePrice(state, s, CATS), c)}`;
    };
    const vigentes = state.laws.filter(l => !l.repealed && l.signs.myth && l.signs.scad).length;
    return [
      `🏛️ **${state.world.worldName || 'Forever World'}** — resumen ${when(Date.now())}`,
      `📈 ${eraLabel(currentEraIndex())} · ${done}/${all.length} hitos`,
      `💱 1 ${sym('M')} = ${r.toFixed(3)} ${sym('S')} · ${pname('bank')}: ${money(state.economy.bank.M, 'M')} / ${money(state.economy.bank.S, 'S')}`,
      line('myth'),
      line('scad'),
      `📜 Leyes vigentes: ${vigentes} · Préstamos activos: ${state.economy.loans.filter(l => l.status !== 'pagado').length} · Obras sin auditar: ${state.economy.works.filter(w => w.status === 'pendiente').length}`,
      `🚂 Vía: ${state.railBlocks.toLocaleString('es-CO')} bloques · ${state.stations.length} estaciones · 🧑‍🌾 ${state.villagers.length} aldeanos`,
      ...state.guests.map(g => `🧭 ${g.nick} (invitado): ${guestDone(g.id)}/${(D.GUEST_QUESTS || []).length} misiones`),
      state.seasons.current ? `🔁 Temporada ${state.seasons.current}` : ''
    ].filter(Boolean).join('\n');
  }

  /* ======================== Eventos ======================== */

  function bindEvents() {
    document.querySelectorAll('.hotbar-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('hud-fx-pill').addEventListener('click', () => showTab('economy'));

    document.addEventListener('keydown', e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target && e.target.tagName) || '')) return;
      if (e.key === 'Escape') { closeTip(); return closeModals(); }
      const map = { 1: 'roadmap', 2: 'economy', 3: 'state', 4: 'lore', 5: 'territory', 6: 'manual' };
      if (map[e.key]) showTab(map[e.key]);
    });

    document.addEventListener('click', async e => {
      const el = e.target.closest('[data-action]');
      if (el && ACTIONS[el.dataset.action]) {
        e.preventDefault();
        const act = el.dataset.action;
        const tracked = !NO_UNDO.has(act);
        const before = tracked ? snapshot() : null;
        const ledgerTop = state.economy.ledger[0] && state.economy.ledger[0].id;
        try { await ACTIONS[act](el); } catch (err) { console.error(err); fail('Algo salió mal: ' + err.message); }
        if (tracked && snapshot() !== before) {
          const top = state.economy.ledger[0];
          if (top && top.id !== ledgerTop && !top.delta) top.delta = balanceDelta(JSON.parse(before).economy, state.economy);
          pushUndo(top && top.id !== ledgerTop ? top.text : (UNDO_LABELS[act] || act), before);
        }
        return;
      }
      if (!e.target.closest('#tip-pop')) closeTip();
      if (e.target.classList.contains('mc-modal-backdrop')) closeModals();
    });

    document.addEventListener('change', async e => {
      const t = e.target;
      if (t.id === 'me-select') {
        if (t.value === '__new__') {
          const nickRaw = await askText('¿Cómo te llamas en el servidor? (Se guarda en Supabase para todos):');
          const nick = (nickRaw || '').trim();
          if (!nick) { t.value = me; return; }
          const existing = participants().find(pid => pname(pid).toLowerCase() === nick.toLowerCase());
          if (existing) {
            me = existing;
          } else {
            const id = uid('inv');
            state.guests.push({ id, nick });
            E.holdings(state, id);
            log('Invitado', `${nick} se une como invitado.`);
            me = id;
            preferredMe = me;
            safeSet(ME_KEY, me);
            commit();
          }
          preferredMe = me;
          safeSet(ME_KEY, me);
          if (CLOUD) CLOUD.setPresence({ id: me, name: pname(me) });
          toast('Identidad', `Ahora eres ${pname(me)} (sincronizado en Supabase).`, 'compass');
          renderAll();
          return;
        }
        me = t.value;
        preferredMe = me;
        safeSet(ME_KEY, me);
        if (CLOUD) CLOUD.setPresence({ id: me, name: me ? pname(me) : 'Visitante' });
        toast('Identidad', me ? `Ahora eres ${pname(me)} en Supabase.` : 'Sin identidad.', 'compass');
        renderAll();
        return;
      }
      if (t.classList.contains('task-check')) {
        const eraIdx = D.ERAS.findIndex(er => er.tasks.some(x => x.id === t.dataset.task));
        const taskObj = eraIdx >= 0 ? D.ERAS[eraIdx].tasks.find(x => x.id === t.dataset.task) : null;
        if (eraIdx > currentEraIndex() || !taskObj) { t.checked = !t.checked; return fail('Esa era está bloqueada todavía.'); }
        const actor = t.dataset.actor || taskObj.who;
        if (!requireMe(actor, 'marcar este hito')) { t.checked = !t.checked; return; }
        if (taskObj.who === 'ambos') {
          const prev = state.tasks[taskObj.id];
          const cur = (prev && typeof prev === 'object') ? { ...prev } : { myth: Boolean(prev), scad: Boolean(prev) };
          cur[actor] = t.checked;
          if (!cur.myth && !cur.scad) delete state.tasks[taskObj.id];
          else state.tasks[taskObj.id] = cur;
        } else {
          if (t.checked) state.tasks[taskObj.id] = true;
          else delete state.tasks[taskObj.id];
        }
        const before = $('hud-era').textContent;
        commit('roadmap');
        if (t.checked) toast('Hito marcado', `${pname(actor)}: ${isTaskDone(taskObj) ? 'hito completado.' : 'tu parte quedó lista.'}`, 'emerald');
        if ($('hud-era').textContent !== before) toast('¡Nueva era!', $('hud-era').textContent, 'beacon');
        return;
      }
      if (t.classList.contains('guest-check')) {
        const q = (D.GUEST_QUESTS || []).find(x => x.id === t.dataset.q);
        if (!q || q.era > currentEraIndex()) { t.checked = !t.checked; return fail('Esa misión se abre con una era posterior.'); }
        const gid = t.dataset.g;
        const pid = t.dataset.pid || gid;
        const actorKey = t.dataset.actor || 'guest';
        if (!requireMe(pid, 'marcar esta misión')) { t.checked = !t.checked; return; }
        const book = state.guestTasks[gid] = state.guestTasks[gid] || {};
        if (q.who === '3') {
          const prev = book[q.id];
          const cur = (prev && typeof prev === 'object') ? { ...prev } : { myth: Boolean(prev), scad: Boolean(prev), guest: Boolean(prev) };
          cur[actorKey] = t.checked;
          if (!cur.myth && !cur.scad && !cur.guest) delete book[q.id];
          else book[q.id] = cur;
        } else {
          if (t.checked) book[q.id] = true;
          else delete book[q.id];
        }
        commit('roadmap', 'state');
        if (t.checked) toast('Misión marcada', `${pname(pid)}: ${isGuestQuestDone(q, gid) ? q.title : 'tu parte quedó lista.'}`, 'compass');
        return;
      }
      if (t.dataset.bind) {
        if (t.dataset.bind.startsWith('settings.') && !E.isState(me)) {
          renderAll();
          return fail('Solo un Estado fundador puede cambiar la configuración general.');
        }
        let v = t.type === 'checkbox' ? t.checked : t.value;
        if (t.dataset.type === 'number') v = num(v, 0);
        setPath(state, t.dataset.bind, v);
        if (t.dataset.bind === 'settings.fxInertia') recordFx();
        commit();
        return;
      }
      const act = t.dataset.actionChange;
      if (!act) return;
      if (act === 'track') { state.ui.track = t.value; commit('roadmap'); }
      else if (act === 'season-check') { state.seasons.checks[t.dataset.id] = t.checked; commit('roadmap'); }
      else if (act === 'mega-stage') { state.mega.stages[Number(t.dataset.i)].done = t.checked; commit('roadmap'); }
      else if (act === 'buy-seller') { state.ui.buySeller = t.value; state.ui.buyItem = ''; commit('economy'); }
      else if (act === 'buy-item') { state.ui.buyItem = t.value; $('buy-note').value = ''; syncBuyForm(); }
      else if (act === 'guest-sel') { state.ui.guestSel = t.value; commit('roadmap'); }
      else if (act === 'ln-lender') { state.ui.loanLender = t.value; commit('economy'); }
      else if (act === 'w-cat') { const c = CATS.find(x => x.id === t.value); if (c) $('w-pts').value = c.pts; }
    });

    let liveTimer = null;
    document.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.bindLive) {
        if (t.dataset.bindLive.startsWith('settings.') && !E.isState(me)) {
          renderAll();
          return fail('Solo un Estado fundador puede cambiar la configuración general.');
        }
        setPath(state, t.dataset.bindLive, t.value);
        clearTimeout(liveTimer);
        if (t.dataset.rerender) {
          const pos = t.selectionStart;
          liveTimer = setTimeout(() => {
            save();
            RENDER[t.dataset.rerender]();
            const again = document.querySelector(`[data-bind-live="${t.dataset.bindLive}"]`);
            if (again) { again.focus(); again.setSelectionRange(pos, pos); }
          }, 250);
        } else {
          liveTimer = setTimeout(save, 400);
        }
        return;
      }
      if (['buy-qty', 'buy-price', 'buy-buyer'].includes(t.id)) updateBuyPreview();
      if (['swap-amt', 'swap-from', 'swap-who'].includes(t.id)) updateSwapPreview();
      if (['ln-borrower', 'ln-cur'].includes(t.id)) updateLoanLimit();
      if (t.id === 'ow-x' || t.id === 'ow-z') {
        $('nh-x').value = Math.floor(num($('ow-x').value) / 8);
        $('nh-z').value = Math.floor(num($('ow-z').value) / 8);
      }
      if (t.id === 'nh-x' || t.id === 'nh-z') {
        $('ow-x').value = Math.floor(num($('nh-x').value) * 8);
        $('ow-z').value = Math.floor(num($('nh-z').value) * 8);
      }
    });
    // selects que no disparan "input" en todos los navegadores
    document.addEventListener('change', e => {
      const id = e.target.id;
      if (id === 'law-doc-type' && $('law-trd')) {
        const meta = (D.DOC_TYPES || {})[e.target.value];
        if (meta && meta.trd) $('law-trd').value = meta.trd;
      }
      if (id === 'buy-buyer') updateBuyPreview();
      if (id === 'w-product') {
        const r = D.RELICS.find(x => x.name.toLowerCase() === e.target.value.trim().toLowerCase());
        if (r) { $('w-cat').value = 'reliquia'; $('w-pts').value = r.pts; if (!val('w-name')) $('w-name').value = r.name; }
      }
      if (id === 'swap-from' || id === 'swap-who') updateSwapPreview();
      if (id === 'ln-borrower' || id === 'ln-cur') updateLoanLimit();
    });

    // recordar qué eras están abiertas (solo local en este navegador)
    document.addEventListener('toggle', e => {
      const d = e.target;
      if (d.classList && d.classList.contains('era-card')) { state.ui.open[d.dataset.era] = d.open; save(true); }
      if (d.classList && d.classList.contains('seal-fold')) { state.ui.sealOpen = d.open; save(true); }
      if (d.classList && d.classList.contains('quick-guide')) { state.ui.guideClosed = !d.open; save(true); }
      if (d.classList && d.classList.contains('fold')) { state.ui.folds = { ...(state.ui.folds || {}), [d.dataset.fold]: d.open }; save(true); }
    }, true);

    document.addEventListener('focusout', () => {
      if (!pendingRemoteRow) return;
      setTimeout(() => {
        if (pendingRemoteRow && !isEditingField()) {
          const p = pendingRemoteRow;
          pendingRemoteRow = null;
          applyRemoteRow(p.row, p.meta);
        }
      }, 60);
    });
  }

  /* ======================== Actualización en vivo (anti-caché) ======================== */

  const CURRENT_APP_VER = (CLOUD && CLOUD.APP_VER) || '20261119092000';
  let detectedNewVer = '';

  function forceLiveReload(targetVer) {
    const ver = targetVer || String(Date.now());
    try { sessionStorage.setItem('fw_reloaded_ver', ver); } catch { /* noop */ }
    const u = new URL(window.location.href);
    u.searchParams.set('_v', ver);
    window.location.replace(u.toString());
  }

  function showUpdateBanner(remoteVer) {
    detectedNewVer = String(remoteVer || '');
    const bar = $('update-banner');
    if (bar) {
      bar.style.display = 'flex';
      bar.innerHTML = `<span>Nueva versión en vivo disponible (${esc(detectedNewVer)}).</span><button type="button" class="mc-btn mc-btn-emerald" id="btn-live-reload" style="padding:4px 10px;">🔄 Actualizar ahora</button>`;
      const btn = $('btn-live-reload');
      if (btn) btn.onclick = () => forceLiveReload(detectedNewVer);
    }
    try {
      if (sessionStorage.getItem('fw_reloaded_ver') !== detectedNewVer && !isEditingField()) {
        forceLiveReload(detectedNewVer);
      }
    } catch { /* noop */ }
  }

  async function checkAppVersion() {
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const remoteVer = String((data && data.v) || '').trim();
      if (remoteVer && remoteVer > CURRENT_APP_VER) {
        showUpdateBanner(remoteVer);
      }
    } catch { /* noop */ }
  }

  /* ======================== Arranque ======================== */

  window.addEventListener('DOMContentLoaded', () => {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has('_v')) {
        u.searchParams.delete('_v');
        window.history.replaceState({}, '', u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash);
      }
      if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
      }
    } catch { /* noop */ }
    const crest = $('hud-crest');
    if (crest) crest.innerHTML = ICONS.beacon || '';
    document.querySelectorAll('.tab-icon[data-icon]').forEach(el => { el.innerHTML = ICONS[el.dataset.icon] || ''; });
    if (me && !participants().includes(me)) me = '';
    // Las leyes viejas (sin tipo) eran reglas del servidor
    const lawsBefore = JSON.stringify(state.laws) + state.ui.rpLawsSeeded;
    const profsBefore = { ...state.professions };
    const rpTitles = new Set((D.DEFAULT_RP_LAWS || []).map(x => x.title.toLowerCase()));
    state.laws.forEach(l => { if (!l.kind) l.kind = rpTitles.has((l.title || '').toLowerCase()) ? 'rol' : 'servidor'; });
    if (state.laws.length === 0) addDefaultLaws('servidor');
    if (!state.ui.rpLawsSeeded) { addDefaultLaws('rol'); state.ui.rpLawsSeeded = true; }
    // Regla del día cero: agricultura solo Mythstorm, ganadería y pesca solo Scadrial
    if (!state.ui.foodRuleV1) {
      ['fisherman', 'shepherd'].forEach(id => { if (state.professions[id] === 'myth') state.professions[id] = 'scad'; });
      const pact = state.laws.find(l => l.title === 'Pacto de monopolios' && !l.signs.myth && !l.signs.scad && /corral pequeño/.test(l.text));
      const def = D.DEFAULT_LAWS.find(l => l.title === 'Pacto de monopolios');
      if (pact && def) { pact.text = tx(def.text); pact.sanction = tx(def.sanction); }
      const mesa = (D.DEFAULT_RP_LAWS || []).find(l => l.title === 'Ley de la Mesa Compartida');
      if (mesa && !state.laws.some(l => l.title === mesa.title)) {
        state.laws.push({ id: uid('ley'), kind: 'rol', num: nextLawNum('rol'), title: mesa.title, text: tx(mesa.text), sanction: tx(mesa.sanction), signs: { myth: false, scad: false }, repealed: false, t: Date.now() });
      }
      state.ui.foodRuleV1 = true;
    }
    // Invitado actual del mundo (una sola vez)
    let guestSeeded = false;
    if (!state.ui.guestSeedV1) {
      if (!state.guests.some(g => g.nick.toLowerCase() === 'notoutofcontext')) {
        const id = uid('inv');
        state.guests.push({ id, nick: 'notoutofcontext' });
        E.holdings(state, id);
      }
      state.ui.guestSeedV1 = true;
      guestSeeded = true;
    }
    // Renombrar Gotham -> Luthadel si aún conserva el nombre anterior
    let luthadelMigrated = false;
    if (!state.ui.luthadelV1) {
      if (state.settings?.nations?.scad?.nation === 'Gotham') {
        state.settings.nations.scad.nation = 'Luthadel';
      }
      state.ui.luthadelV1 = true;
      luthadelMigrated = true;
    }
    if (luthadelMigrated || guestSeeded || JSON.stringify(state.laws) + state.ui.rpLawsSeeded + JSON.stringify(state.professions) !== lawsBefore + JSON.stringify(profsBefore)) save(true);
    autoBackup(false, 'Al abrir');
    const pop = document.createElement('div'); pop.id = 'tip-pop'; pop.className = 'tip-pop mc-tooltip-box'; document.body.appendChild(pop);
    window.addEventListener('scroll', closeTip, { passive: true });
    bindEvents();
    renderAll();

    if (CLOUD) {
      CLOUD.setPresence({ id: me, name: me ? pname(me) : 'Visitante' });
      CLOUD.init({
        getState: () => state,
        isFreshStart: () => isFreshStart,
        onStatus: () => {
          renderCloudPill();
          if ($('modal-backup') && $('modal-backup').classList.contains('open')) renderCloudPanel(false);
        },
        onPresence: () => {
          renderCloudPill();
          if ($('modal-backup') && $('modal-backup').classList.contains('open')) renderCloudPanel(false);
        },
        onRemoteState: (row, meta) => applyRemoteRow(row, meta),
        onMergedState: (mergedCloud, row) => applyMergedCloudState(mergedCloud, row),
        onOutdatedApp: v => showUpdateBanner(v),
        onConflict: row => {
          renderCloudPill();
          toast('Conflicto en la nube', `${row.updated_by || 'Otro jugador'} guardó cambios. Toca Supabase arriba.`, 'redstone');
        },
        onInitialMismatch: async row => {
          renderCloudPill();
          const ok = await askConfirm(`Ya existe una partida en Supabase (guardada ${when(row.updated_at || Date.now())}${row.updated_by ? ' por ' + row.updated_by : ''}) y también tienes datos locales.\n\n¿Quieres cargar la partida de la nube?`);
          if (ok) {
            await CLOUD.pullNow();
            toast('Partida sincronizada', 'Se cargó la copia de Supabase.', 'emerald');
          } else {
            toast('Copia local conservada', 'Para subirla, toca Supabase arriba → Forzar subida.', 'gold');
          }
        }
      }).then(info => {
        // Ya con la partida de la nube cargada: postular leyes/manuales nuevos sin duplicarlos
        if (!info || info.status !== 'conflict') postNewLaws();
      }).catch(() => {});
    } else {
      postNewLaws();
    }
    setTimeout(checkAppVersion, 1200);
    setInterval(() => { if (!document.hidden) checkAppVersion(); }, 45000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkAppVersion(); });
  });
})();
