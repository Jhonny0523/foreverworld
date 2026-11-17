/* ==========================================================================
   FOREVER WORLD — Sincronización en la nube con Supabase
   ========================================================================== */

window.FW_CLOUD = (() => {
  'use strict';

  const CFG_KEY = 'forever_world_supabase_cfg';
  const REV_PREFIX = 'forever_world_cloud_rev_';
  const WORLD_UI_KEYS = ['rpLawsSeeded', 'foodRuleV1', 'guestSeedV1'];

  let client = null;
  let channel = null;
  let activeCfg = { url: '', anonKey: '', worldId: 'main' };
  let status = 'unconfigured'; // unconfigured | connecting | synced | syncing | conflict | error | offline
  let statusDetail = '';
  let lastSyncAt = 0;
  let lastSyncBy = '';
  let currentRev = null;
  let conflictRow = null;
  let pushTimer = null;
  let pushing = false;
  let pushQueued = false;
  let handlers = {};

  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch { /* noop */ } }

  function revKey(worldId) { return REV_PREFIX + (worldId || 'main'); }
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
    const clone = JSON.parse(JSON.stringify(state));
    const worldUi = {};
    WORLD_UI_KEYS.forEach(k => {
      if (clone.ui && clone.ui[k] !== undefined) worldUi[k] = clone.ui[k];
    });
    clone.ui = worldUi;
    return clone;
  }

  function mergeCloudUiWithLocal(remoteState, localUi) {
    const out = JSON.parse(JSON.stringify(remoteState || {}));
    const remoteUi = (out.ui && typeof out.ui === 'object') ? out.ui : {};
    const keptLocal = (localUi && typeof localUi === 'object') ? { ...localUi } : {};
    WORLD_UI_KEYS.forEach(k => {
      if (remoteUi[k] !== undefined) keptLocal[k] = remoteUi[k];
    });
    out.ui = keptLocal;
    return out;
  }

  function hasLibrary() {
    return Boolean(window.supabase && typeof window.supabase.createClient === 'function');
  }

  async function disconnect() {
    clearTimeout(pushTimer);
    pushTimer = null;
    if (channel && client) {
      try { await client.removeChannel(channel); } catch { /* noop */ }
    }
    channel = null;
    client = null;
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

  function subscribeRealtime() {
    if (!client) return;
    if (channel) {
      try { client.removeChannel(channel); } catch { /* noop */ }
      channel = null;
    }
    channel = client
      .channel(`fw-world-${activeCfg.worldId}`)
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
          if (currentRev !== null && Number(row.rev) <= Number(currentRev)) return;
          applyIncomingRow(row, true);
        }
      )
      .subscribe(stateName => {
        if (stateName === 'CHANNEL_ERROR' || stateName === 'TIMED_OUT') {
          if (status === 'synced') setStatus('error', 'Realtime desconectado; usa Sincronizar ahora.');
        }
      });
  }

  function applyIncomingRow(row, fromRealtime) {
    if (!row || !row.state) return;
    conflictRow = null;
    writeSavedRev(activeCfg.worldId, Number(row.rev));
    lastSyncAt = Number(row.updated_at) || Date.now();
    lastSyncBy = row.updated_by || '';
    setStatus('synced', '');
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
    conflictRow = null;

    if (!activeCfg.url || !activeCfg.anonKey) {
      setStatus('unconfigured', 'Configura Supabase en Guardar / Cargar.');
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
          lastSyncAt = remoteAt;
          lastSyncBy = row.updated_by || '';
          setStatus('synced', '');
          if (localAt > remoteAt && localState) {
            await pushState(localState, false);
          }
        } else if (currentRev !== null && remoteRev !== currentRev) {
          if (remoteAt >= localAt) {
            applyIncomingRow(row, false);
          } else {
            conflictRow = row;
            setStatus('conflict', 'Tu copia local es más nueva que la nube.');
            if (typeof handlers.onConflict === 'function') handlers.onConflict(row);
          }
        } else {
          // Navegador con datos previos sin historial de revisión en la nube
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
        if (!isFresh && localState) {
          await pushState(localState, true);
        } else {
          setStatus('synced', 'Sala vacía lista. Haz un cambio para crear la partida.');
        }
      }

      subscribeRealtime();
      return getInfo();
    } catch (err) {
      setStatus('error', err && err.message ? err.message : 'Error al conectar.');
      return getInfo();
    }
  }

  async function pushState(state, force = false) {
    if (!client || !activeCfg.url || !activeCfg.anonKey) return { ok: false, reason: 'unconfigured' };
    if (pushing) {
      pushQueued = true;
      return { ok: false, reason: 'queued' };
    }
    pushing = true;
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
        lastSyncAt = Number(data.updated_at) || Date.now();
        lastSyncBy = data.updated_by || '';
        setStatus('synced', '');
        return { ok: true, rev: data.rev };
      }

      if (data && data.reason === 'conflict') {
        conflictRow = {
          id: activeCfg.worldId,
          state: data.state,
          updated_at: data.updated_at,
          updated_by: data.updated_by,
          rev: data.rev
        };
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
      pushing = false;
      if (pushQueued) {
        pushQueued = false;
        if (typeof handlers.getState === 'function' && status !== 'conflict') {
          pushState(handlers.getState(), false);
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
    }, 450);
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
      conflictRow
    };
  }

  return {
    init,
    pushState,
    schedulePush,
    pullNow,
    saveSnapshot,
    listSnapshots,
    fetchSnapshot,
    saveConfig,
    clearLocalConfig,
    buildInviteUrl,
    buildConfigFileSnippet,
    mergeCloudUiWithLocal,
    getInfo
  };
})();
