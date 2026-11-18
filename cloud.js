/* ==========================================================================
   FOREVER WORLD — Sincronización en tiempo real y merge 3-way con Supabase
   ========================================================================== */

window.FW_CLOUD = (() => {
  'use strict';

  const CFG_KEY = 'forever_world_supabase_cfg';
  const REV_PREFIX = 'forever_world_cloud_rev_';
  const BASE_PREFIX = 'forever_world_cloud_base_';
  const WORLD_UI_KEYS = ['rpLawsSeeded', 'foodRuleV1', 'guestSeedV1'];

  let client = null;
  let channel = null;
  let activeCfg = { url: '', anonKey: '', worldId: 'main' };
  let status = 'unconfigured'; // unconfigured | connecting | synced | syncing | conflict | error | offline
  let statusDetail = '';
  let lastSyncAt = 0;
  let lastSyncBy = '';
  let currentRev = null;
  let baseState = null;
  let conflictRow = null;
  let pushTimer = null;
  let heartbeatTimer = null;
  let pushing = false;
  let pushQueued = false;
  let bufferedRealtimeRow = null;
  let handlers = {};
  let onlinePlayers = [];
  let currentPresence = { id: '', name: 'Visitante', at: Date.now() };

  const clientId = (() => {
    try {
      let id = sessionStorage.getItem('fw_client_id');
      if (!id) {
        id = 'c-' + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem('fw_client_id', id);
      }
      return id;
    } catch {
      return 'c-' + Math.random().toString(36).slice(2, 10);
    }
  })();

  const cloneObj = o => JSON.parse(JSON.stringify(o));
  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch { /* noop */ } }

  function revKey(worldId) { return REV_PREFIX + (worldId || 'main'); }
  function baseKey(worldId) { return BASE_PREFIX + (worldId || 'main'); }

  function readSavedRev(worldId) {
    const raw = safeGet(revKey(worldId));
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function writeSavedRev(worldId, rev) {
    currentRev = rev;
    if (rev) safeSet(revKey(worldId), String(rev));
    else safeDel(revKey(worldId));
  }

  function readSavedBase(worldId) {
    try {
      const raw = safeGet(baseKey(worldId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function writeSavedBase(worldId, cloudState) {
    baseState = cloudState ? cloneObj(cloudState) : null;
    if (baseState) safeSet(baseKey(worldId), JSON.stringify(baseState));
    else safeDel(baseKey(worldId));
  }

  function cleanUrl(u) {
    return String(u || '').trim().replace(/\/+$/, '');
  }

  function sanitizeWorldId(id) {
    const s = String(id || 'main').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return s || 'main';
  }

  function absorbUrlParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const sbUrl = cleanUrl(params.get('sb_url'));
      const sbKey = String(params.get('sb_key') || '').trim();
      const sbWorld = params.get('world');
      if (!sbUrl && !sbKey && !sbWorld) return;

      const prev = readLocalConfig();
      const next = {
        url: sbUrl || prev.url || '',
        anonKey: sbKey || prev.anonKey || '',
        worldId: sanitizeWorldId(sbWorld || prev.worldId || 'main')
      };
      if (next.url && next.anonKey) safeSet(CFG_KEY, JSON.stringify(next));

      ['sb_url', 'sb_key', 'world'].forEach(k => params.delete(k));
      const rest = params.toString();
      const cleanHref = window.location.pathname + (rest ? '?' + rest : '') + window.location.hash;
      window.history.replaceState({}, '', cleanHref);
    } catch { /* noop */ }
  }

  function readLocalConfig() {
    try {
      const raw = safeGet(CFG_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }

  function resolveConfig() {
    const fileCfg = window.FW_SUPABASE_CONFIG || {};
    const localCfg = readLocalConfig();
    const url = cleanUrl(localCfg.url || fileCfg.url || '');
    const anonKey = String(localCfg.anonKey || fileCfg.anonKey || '').trim();
    const worldId = sanitizeWorldId(localCfg.worldId || fileCfg.worldId || 'main');
    const source = (localCfg.url && localCfg.anonKey) ? 'local' : ((fileCfg.url && fileCfg.anonKey) ? 'file' : 'none');
    return { url, anonKey, worldId, source };
  }

  function emitStatus() {
    if (typeof handlers.onStatus === 'function') handlers.onStatus(getInfo());
  }

  function setStatus(next, detail = '') {
    status = next;
    statusDetail = detail;
    emitStatus();
  }

  // Solo sincronizamos los flags globales del mundo dentro de `ui`; las vistas abiertas son por navegador
  function prepareStateForCloud(state) {
    const clone = cloneObj(state);
    const worldUi = {};
    WORLD_UI_KEYS.forEach(k => {
      if (clone.ui && clone.ui[k] !== undefined) worldUi[k] = clone.ui[k];
    });
    clone.ui = worldUi;
    return clone;
  }

  function mergeCloudUiWithLocal(remoteState, localUi) {
    const out = cloneObj(remoteState || {});
    const remoteUi = (out.ui && typeof out.ui === 'object') ? out.ui : {};
    const keptLocal = (localUi && typeof localUi === 'object') ? { ...localUi } : {};
    WORLD_UI_KEYS.forEach(k => {
      if (remoteUi[k] !== undefined) keptLocal[k] = remoteUi[k];
    });
    out.ui = keptLocal;
    return out;
  }

  /* ======================== Merge 3-way para edición concurrente ======================== */

  function isPlainObj(x) {
    return Boolean(x) && typeof x === 'object' && !Array.isArray(x);
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    if (typeof a === 'object') {
      const ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (const k of ka) {
        if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEqual(a[k], b[k])) return false;
      }
      return true;
    }
    return false;
  }

  function itemKeyProp(arrA, arrB) {
    const sample = [...(arrA || []), ...(arrB || [])].find(x => isPlainObj(x));
    if (!sample) return null;
    if ('id' in sample) return 'id';
    if ('code' in sample) return 'code';
    return null;
  }

  function mergeKeyedArrays(baseArr, localArr, remoteArr, keyProp, path) {
    const bMap = new Map((Array.isArray(baseArr) ? baseArr : []).map(x => [x[keyProp], x]));
    const lMap = new Map((Array.isArray(localArr) ? localArr : []).map(x => [x[keyProp], x]));
    const rMap = new Map((Array.isArray(remoteArr) ? remoteArr : []).map(x => [x[keyProp], x]));

    const order = [];
    const seen = new Set();
    const pushKey = k => { if (!seen.has(k)) { seen.add(k); order.push(k); } };
    (Array.isArray(remoteArr) ? remoteArr : []).forEach(x => pushKey(x[keyProp]));
    (Array.isArray(localArr) ? localArr : []).forEach(x => pushKey(x[keyProp]));

    const out = [];
    for (const k of order) {
      const inB = bMap.has(k), b = bMap.get(k);
      const inL = lMap.has(k), l = lMap.get(k);
      const inR = rMap.has(k), r = rMap.get(k);

      if (inL && inR) {
        out.push(threeWayMerge(b, l, r, `${path}[]`));
      } else if (inL && !inR) {
        // Conserva si es nuevo en local o si se modificó localmente mientras otro lo borró
        if (!inB || !deepEqual(l, b)) out.push(cloneObj(l));
      } else if (inR && !inL) {
        // Conserva si es nuevo en remoto o si se modificó remotamente mientras local lo borró
        if (!inB || !deepEqual(r, b)) out.push(cloneObj(r));
      }
    }

    if (path === 'economy.ledger' || path.endsWith('.notes')) {
      out.sort((a, b) => (Number(b.t || b.at) || 0) - (Number(a.t || a.at) || 0));
    }
    return out;
  }

  function mergeFxHistory(localArr, remoteArr) {
    const seen = new Set();
    const all = [...(Array.isArray(remoteArr) ? remoteArr : []), ...(Array.isArray(localArr) ? localArr : [])]
      .filter(x => x && Number.isFinite(Number(x.t)))
      .sort((a, b) => Number(a.t) - Number(b.t))
      .filter(x => {
        const k = `${x.t}|${x.r}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    return all.length > 300 ? all.slice(all.length - 300) : all;
  }

  function isAdditivePath(path) {
    return /^economy\.holdings\.[^.]+\.(M|S)$/.test(path)
      || path === 'economy.bank.M'
      || path === 'economy.bank.S'
      || path === 'railBlocks';
  }

  function threeWayMerge(base, local, remote, path = '') {
    if (deepEqual(local, remote)) return cloneObj(remote);
    if (deepEqual(local, base)) return cloneObj(remote);
    if (deepEqual(remote, base)) return cloneObj(local);

    if (path === 'updatedAt') {
      return Math.max(Number(local) || 0, Number(remote) || 0);
    }
    if (path === 'updatedBy') {
      return local || remote || '';
    }

    if (isAdditivePath(path) && typeof base === 'number' && typeof local === 'number' && typeof remote === 'number') {
      const sum = Math.round((base + (local - base) + (remote - base)) * 100) / 100;
      return local >= 0 && remote >= 0 ? Math.max(0, sum) : sum;
    }

    if (Array.isArray(local) && Array.isArray(remote)) {
      if (path === 'economy.fxHistory') return mergeFxHistory(local, remote);
      const keyProp = itemKeyProp(local, remote) || itemKeyProp(base, []);
      if (keyProp) return mergeKeyedArrays(base, local, remote, keyProp, path);
      return !deepEqual(local, base) ? cloneObj(local) : cloneObj(remote);
    }

    if (isPlainObj(local) && isPlainObj(remote)) {
      const bObj = isPlainObj(base) ? base : {};
      const keys = new Set([...Object.keys(bObj), ...Object.keys(remote), ...Object.keys(local)]);
      const out = {};
      for (const k of keys) {
        const inB = Object.prototype.hasOwnProperty.call(bObj, k);
        const inL = Object.prototype.hasOwnProperty.call(local, k);
        const inR = Object.prototype.hasOwnProperty.call(remote, k);
        const childPath = path ? `${path}.${k}` : k;
        if (inL && inR) {
          out[k] = threeWayMerge(bObj[k], local[k], remote[k], childPath);
        } else if (inL && !inR) {
          if (!inB || !deepEqual(local[k], bObj[k])) out[k] = cloneObj(local[k]);
        } else if (inR && !inL) {
          if (!inB || !deepEqual(remote[k], bObj[k])) out[k] = cloneObj(remote[k]);
        }
      }
      return out;
    }

    return !deepEqual(local, base) ? cloneObj(local) : cloneObj(remote);
  }

  function hasLibrary() {
    return Boolean(window.supabase && typeof window.supabase.createClient === 'function');
  }

  async function disconnect() {
    clearTimeout(pushTimer);
    pushTimer = null;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    bufferedRealtimeRow = null;
    if (channel && client) {
      try { await client.removeChannel(channel); } catch { /* noop */ }
    }
    channel = null;
    client = null;
    onlinePlayers = [];
  }

  async function fetchRemoteRow() {
    if (!client) return { data: null, error: new Error('Sin cliente Supabase') };
    const { data, error } = await client
      .from('fw_worlds')
      .select('id, state, updated_at, updated_by, rev')
      .eq('id', activeCfg.worldId)
      .maybeSingle();
    return { data, error };
  }

  async function checkForUpdates() {
    if (!client || pushing || pushTimer || status === 'unconfigured' || status === 'offline') return;
    if (channel && (channel.state === 'closed' || channel.state === 'errored')) {
      subscribeRealtime();
    }
    try {
      const { data, error } = await client
        .from('fw_worlds')
        .select('rev')
        .eq('id', activeCfg.worldId)
        .maybeSingle();
      if (error || !data) return;
      if (currentRev === null || Number(data.rev) > Number(currentRev)) {
        await pullNow();
      }
    } catch { /* noop */ }
  }

  function startHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      checkForUpdates();
    }, 15000);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdates();
    });
  }

  function subscribeRealtime() {
    if (!client) return;
    if (channel) {
      try { client.removeChannel(channel); } catch { /* noop */ }
      channel = null;
    }
    channel = client
      .channel(`fw-world-${activeCfg.worldId}`, {
        config: { presence: { key: clientId } }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fw_worlds',
          filter: `id=eq.${activeCfg.worldId}`
        },
        payload => {
          const row = payload && payload.new;
          if (!row || !row.state) return;
          if (pushing) {
            if (!bufferedRealtimeRow || Number(row.rev) > Number(bufferedRealtimeRow.rev)) {
              bufferedRealtimeRow = row;
            }
            return;
          }
          if (currentRev !== null && Number(row.rev) <= Number(currentRev)) return;
          applyIncomingRow(row, true);
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const stateMap = channel ? channel.presenceState() : {};
        const list = [];
        Object.values(stateMap).forEach(arr => {
          if (Array.isArray(arr) && arr.length) list.push(arr[0]);
        });
        onlinePlayers = list;
        if (typeof handlers.onPresence === 'function') handlers.onPresence(onlinePlayers);
        emitStatus();
      })
      .subscribe(async stateName => {
        if (stateName === 'SUBSCRIBED') {
          try { await channel.track(currentPresence); } catch { /* noop */ }
        } else if (stateName === 'CHANNEL_ERROR' || stateName === 'TIMED_OUT') {
          if (status === 'synced') setStatus('error', 'Realtime desconectado; sincronizando cada 15s.');
        }
      });
  }

  async function setPresence(info) {
    currentPresence = {
      id: (info && info.id) || '',
      name: (info && info.name) || 'Visitante',
      at: Date.now()
    };
    if (channel) {
      try { await channel.track(currentPresence); } catch { /* noop */ }
    }
  }

  function applyIncomingRow(row, fromRealtime) {
    if (!row || !row.state) return;
    conflictRow = null;
    const prevBase = baseState;
    writeSavedRev(activeCfg.worldId, Number(row.rev));
    writeSavedBase(activeCfg.worldId, row.state);
    lastSyncAt = Number(row.updated_at) || Date.now();
    lastSyncBy = row.updated_by || '';
    setStatus('synced', '');

    // Si hay cambios locales en cola (por debounce), fusionarlos con el remoto antes de renderizar
    if (fromRealtime && pushTimer && typeof handlers.getState === 'function' && typeof handlers.onMergedState === 'function') {
      const localCloud = prepareStateForCloud(handlers.getState());
      const merged = threeWayMerge(prevBase || row.state, localCloud, row.state);
      handlers.onMergedState(merged, row);
      return;
    }

    if (typeof handlers.onRemoteState === 'function') {
      handlers.onRemoteState(row, { fromRealtime });
    }
  }

  async function init(opts = {}) {
    handlers = opts || {};
    absorbUrlParams();
    await disconnect();

    activeCfg = resolveConfig();
    currentRev = readSavedRev(activeCfg.worldId);
    baseState = readSavedBase(activeCfg.worldId);
    conflictRow = null;

    if (!activeCfg.url || !activeCfg.anonKey) {
      setStatus('unconfigured', 'Configura Supabase en el modal de la nube.');
      return getInfo();
    }

    if (!hasLibrary()) {
      setStatus('offline', 'Sin conexión para cargar el cliente de Supabase.');
      return getInfo();
    }

    setStatus('connecting', 'Conectando con Supabase...');
    try {
      client = window.supabase.createClient(activeCfg.url, activeCfg.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data: row, error } = await fetchRemoteRow();
      if (error) {
        setStatus('error', error.message || 'No se pudo leer fw_worlds.');
        return getInfo();
      }

      const localState = typeof handlers.getState === 'function' ? handlers.getState() : null;
      const isFresh = Boolean(handlers.isFreshStart && handlers.isFreshStart());

      if (row && row.state) {
        const remoteRev = Number(row.rev);
        const remoteAt = Number(row.updated_at) || 0;
        const localAt = Number(localState && localState.updatedAt) || 0;

        if (isFresh) {
          applyIncomingRow(row, false);
        } else if (currentRev !== null && remoteRev === currentRev) {
          writeSavedBase(activeCfg.worldId, row.state);
          lastSyncAt = remoteAt;
          lastSyncBy = row.updated_by || '';
          setStatus('synced', '');
          if (localAt > remoteAt && localState) {
            await pushState(localState, false);
          }
        } else if (currentRev !== null && remoteRev !== currentRev) {
          if (baseState && localState && typeof handlers.onMergedState === 'function') {
            const merged = threeWayMerge(baseState, prepareStateForCloud(localState), row.state);
            writeSavedRev(activeCfg.worldId, remoteRev);
            writeSavedBase(activeCfg.worldId, row.state);
            lastSyncAt = remoteAt;
            lastSyncBy = row.updated_by || '';
            handlers.onMergedState(merged, row);
            if (!deepEqual(merged, row.state)) {
              await pushState(handlers.getState(), false);
            } else {
              setStatus('synced', '');
            }
          } else if (remoteAt >= localAt) {
            applyIncomingRow(row, false);
          } else {
            conflictRow = row;
            setStatus('conflict', 'Tu copia local es más nueva que la nube.');
            if (typeof handlers.onConflict === 'function') handlers.onConflict(row);
          }
        } else {
          if (typeof handlers.onInitialMismatch === 'function') {
            lastSyncAt = remoteAt;
            lastSyncBy = row.updated_by || '';
            setStatus('conflict', 'Hay partida en la nube y datos locales.');
            handlers.onInitialMismatch(row);
          } else {
            applyIncomingRow(row, false);
          }
        }
      } else {
        writeSavedRev(activeCfg.worldId, null);
        writeSavedBase(activeCfg.worldId, null);
        if (!isFresh && localState) {
          await pushState(localState, true);
        } else {
          setStatus('synced', 'Sala vacía lista. Haz un cambio para crear la partida.');
        }
      }

      subscribeRealtime();
      startHeartbeat();
      return getInfo();
    } catch (err) {
      setStatus('error', err && err.message ? err.message : 'Error al conectar.');
      return getInfo();
    }
  }

  async function pushState(state, force = false, attempt = 0) {
    if (!client || !activeCfg.url || !activeCfg.anonKey) return { ok: false, reason: 'unconfigured' };
    if (pushing && attempt === 0) {
      pushQueued = true;
      return { ok: false, reason: 'queued' };
    }
    if (attempt === 0) pushing = true;
    setStatus('syncing', 'Guardando en Supabase...');

    try {
      const payload = prepareStateForCloud(state);
      const { data, error } = await client.rpc('fw_save_world', {
        p_id: activeCfg.worldId,
        p_state: payload,
        p_updated_at: Number(state.updatedAt) || Date.now(),
        p_updated_by: String(state.updatedBy || ''),
        p_expected_rev: force ? null : currentRev,
        p_force: Boolean(force)
      });

      if (error) {
        setStatus('error', error.message || 'Error al guardar en Supabase.');
        return { ok: false, reason: 'error', error };
      }

      if (data && data.ok) {
        conflictRow = null;
        writeSavedRev(activeCfg.worldId, Number(data.rev));
        writeSavedBase(activeCfg.worldId, payload);
        lastSyncAt = Number(data.updated_at) || Date.now();
        lastSyncBy = data.updated_by || '';
        setStatus('synced', '');
        return { ok: true, rev: data.rev };
      }

      if (data && data.reason === 'conflict') {
        const remoteRow = {
          id: activeCfg.worldId,
          state: data.state,
          updated_at: data.updated_at,
          updated_by: data.updated_by,
          rev: data.rev
        };
        if (!force && attempt < 4 && data.state && typeof handlers.onMergedState === 'function') {
          const mergedCloud = threeWayMerge(baseState || data.state, payload, data.state);
          writeSavedRev(activeCfg.worldId, Number(data.rev));
          writeSavedBase(activeCfg.worldId, data.state);
          handlers.onMergedState(mergedCloud, remoteRow);
          const nextState = typeof handlers.getState === 'function' ? handlers.getState() : mergedCloud;
          return await pushState(nextState, false, attempt + 1);
        }
        conflictRow = remoteRow;
        setStatus('conflict', `Conflicto: ${data.updated_by || 'otro jugador'} guardó antes.`);
        if (typeof handlers.onConflict === 'function') handlers.onConflict(conflictRow);
        return { ok: false, reason: 'conflict', row: conflictRow };
      }

      setStatus('error', 'Respuesta inesperada de Supabase.');
      return { ok: false, reason: 'unknown' };
    } catch (err) {
      setStatus('error', err && err.message ? err.message : 'Error de red.');
      return { ok: false, reason: 'network', error: err };
    } finally {
      if (attempt === 0) {
        pushing = false;
        const buffered = bufferedRealtimeRow;
        bufferedRealtimeRow = null;
        if (buffered && (currentRev === null || Number(buffered.rev) > Number(currentRev))) {
          applyIncomingRow(buffered, true);
        }
        if (pushQueued) {
          pushQueued = false;
          if (typeof handlers.getState === 'function' && status !== 'conflict') {
            pushState(handlers.getState(), false, 0);
          }
        }
      }
    }
  }

  function schedulePush(getStateFn) {
    if (!client || status === 'unconfigured' || status === 'offline' || status === 'conflict') return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      const st = typeof getStateFn === 'function' ? getStateFn() : (handlers.getState ? handlers.getState() : null);
      if (st) pushState(st, false);
    }, 320);
  }

  async function pullNow() {
    if (!client) return { ok: false, reason: 'unconfigured' };
    setStatus('connecting', 'Descargando de Supabase...');
    const { data: row, error } = await fetchRemoteRow();
    if (error) {
      setStatus('error', error.message || 'No se pudo descargar.');
      return { ok: false, error };
    }
    if (!row || !row.state) {
      writeSavedRev(activeCfg.worldId, null);
      writeSavedBase(activeCfg.worldId, null);
      setStatus('synced', 'No hay partida guardada todavía en esta sala.');
      return { ok: true, empty: true };
    }
    applyIncomingRow(row, false);
    return { ok: true, row };
  }

  async function saveSnapshot(label, state, savedBy) {
    if (!client) return { ok: false, reason: 'unconfigured' };
    if (currentRev === null) {
      const pushed = await pushState(state, true);
      if (!pushed.ok) return pushed;
    }
    const { data, error } = await client
      .from('fw_snapshots')
      .insert({
        world_id: activeCfg.worldId,
        state: prepareStateForCloud(state),
        label: String(label || 'Punto manual').slice(0, 120),
        saved_by: String(savedBy || '').slice(0, 60)
      })
      .select('id, label, saved_by, created_at')
      .single();
    if (error) return { ok: false, error };
    return { ok: true, snapshot: data };
  }

  async function listSnapshots(limit = 12) {
    if (!client) return { ok: false, items: [] };
    const { data, error } = await client
      .from('fw_snapshots')
      .select('id, label, saved_by, created_at')
      .eq('world_id', activeCfg.worldId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { ok: false, error, items: [] };
    return { ok: true, items: data || [] };
  }

  async function fetchSnapshot(id) {
    if (!client) return { ok: false };
    const { data, error } = await client
      .from('fw_snapshots')
      .select('id, state, label, saved_by, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return { ok: false, error };
    return { ok: true, snapshot: data };
  }

  function saveConfig(newCfg) {
    const url = cleanUrl(newCfg.url);
    const anonKey = String(newCfg.anonKey || '').trim();
    const worldId = sanitizeWorldId(newCfg.worldId || 'main');
    if (!url || !anonKey) {
      safeDel(CFG_KEY);
    } else {
      safeSet(CFG_KEY, JSON.stringify({ url, anonKey, worldId }));
    }
    return init(handlers);
  }

  function clearLocalConfig() {
    safeDel(CFG_KEY);
    return init(handlers);
  }

  function buildInviteUrl() {
    const base = window.location.origin + window.location.pathname;
    if (!activeCfg.url || !activeCfg.anonKey) return base;
    if (activeCfg.source === 'file') {
      return activeCfg.worldId && activeCfg.worldId !== 'main'
        ? `${base}?world=${encodeURIComponent(activeCfg.worldId)}`
        : base;
    }
    const p = new URLSearchParams({
      sb_url: activeCfg.url,
      sb_key: activeCfg.anonKey,
      world: activeCfg.worldId
    });
    return `${base}?${p.toString()}`;
  }

  function buildConfigFileSnippet() {
    return [
      'window.FW_SUPABASE_CONFIG = {',
      `  url: '${activeCfg.url.replace(/'/g, "\\'")}',`,
      `  anonKey: '${activeCfg.anonKey.replace(/'/g, "\\'")}',`,
      `  worldId: '${activeCfg.worldId.replace(/'/g, "\\'")}'`,
      '};'
    ].join('\n');
  }

  function getInfo() {
    return {
      status,
      statusDetail,
      configured: Boolean(activeCfg.url && activeCfg.anonKey),
      config: { ...activeCfg },
      rev: currentRev,
      lastSyncAt,
      lastSyncBy,
      conflictRow,
      onlinePlayers: [...onlinePlayers]
    };
  }

  return {
    init,
    pushState,
    schedulePush,
    pullNow,
    setPresence,
    saveSnapshot,
    listSnapshots,
    fetchSnapshot,
    saveConfig,
    clearLocalConfig,
    buildInviteUrl,
    buildConfigFileSnippet,
    mergeCloudUiWithLocal,
    threeWayMerge,
    getInfo
  };
})();
