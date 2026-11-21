import fs from 'node:fs';
import path from 'node:path';

const MAX_RECENT_CHAT = 18;
const MAX_PENDING_LOG = 180;
const MAX_SESSION_MEMORIES = 20;
const MAX_PINNED_NOTES = 30;
const MAX_PERMITS = 60;
const MAX_INFRACTIONS = 150;

// Permisos y prohibiciones expresas sobre monopolios (persisten entre reinicios).
export const PERMIT_SCOPES = {
  agro: { label: 'agricultura, flores, cactus, tintes y abejas', owner: 'myth' },
  ganado: { label: 'ganadería, pesca y subproductos animales', owner: 'scad' },
  aldeanos: { label: 'comercio con aldeanos estatales', owner: 'any' }
};
// Permisos finos: un solo cultivo, planta/tinte o un solo tipo de animal (ej. "agro:trigo", "agro:flores", "ganado:gallinas")
export const PERMIT_SUBSCOPES = {
  agro: {
    trigo: 'trigo y sus semillas',
    zanahoria: 'zanahorias',
    papa: 'papas',
    remolacha: 'remolacha y sus semillas',
    cana: 'caña de azúcar',
    sandia: 'sandías y sus semillas',
    calabaza: 'calabazas y sus semillas',
    bayas: 'bayas dulces',
    verrugas: 'verrugas del Nether',
    abejas: 'abejas, miel y panales',
    flores: 'flores (todas)',
    cactus: 'cactus (planta y flor)',
    tintes: 'tintes derivados (todos los colores)'
  },
  ganado: { vacas: 'vacas, champiñacas y cuero', cerdos: 'cerdos', ovejas: 'ovejas', gallinas: 'gallinas, huevos y plumas', conejos: 'conejos', calamares: 'calamares y tinta', pesca: 'pesca (peces y caña)', cria: 'criar animales' }
};
for (const [parent, subs] of Object.entries(PERMIT_SUBSCOPES)) {
  for (const [id, label] of Object.entries(subs)) {
    PERMIT_SCOPES[`${parent}:${id}`] = { label: `solo ${label}`, owner: PERMIT_SCOPES[parent].owner };
  }
}

function defaultData() {
  return {
    recentChat: [],
    pendingSessionLog: [],
    sessionMemories: [],
    pinnedNotes: [],
    permits: [],
    prohibitions: [],
    infractions: []
  };
}

export class SessionMemory {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.compacting = false;
    this.eventHook = null;
    this.data = this.load();
  }

  setEventHook(fn) {
    this.eventHook = typeof fn === 'function' ? fn : null;
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        return {
          recentChat: Array.isArray(parsed?.recentChat) ? parsed.recentChat.slice(-MAX_RECENT_CHAT) : [],
          pendingSessionLog: Array.isArray(parsed?.pendingSessionLog) ? parsed.pendingSessionLog.slice(-MAX_PENDING_LOG) : [],
          sessionMemories: Array.isArray(parsed?.sessionMemories) ? parsed.sessionMemories.slice(-MAX_SESSION_MEMORIES) : [],
          pinnedNotes: Array.isArray(parsed?.pinnedNotes) ? parsed.pinnedNotes.slice(-MAX_PINNED_NOTES) : [],
          permits: Array.isArray(parsed?.permits) ? parsed.permits.slice(-MAX_PERMITS) : [],
          prohibitions: Array.isArray(parsed?.prohibitions) ? parsed.prohibitions.slice(-MAX_PERMITS) : [],
          infractions: Array.isArray(parsed?.infractions) ? parsed.infractions.slice(-MAX_INFRACTIONS) : []
        };
      }
    } catch (err) {
      console.warn('[Memoria] Error leyendo bot-memory.json:', err.message);
    }
    return defaultData();
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.warn('[Memoria] Error guardando bot-memory.json:', err.message);
    }
  }

  _pushRecent(speaker, role, text) {
    const clean = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 260);
    if (!clean) return '';
    this.data.recentChat.push({ ts: Date.now(), speaker, role, text: clean });
    while (this.data.recentChat.length > MAX_RECENT_CHAT) this.data.recentChat.shift();
    return clean;
  }

  _pushPending(type, text) {
    const clean = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 260);
    if (!clean) return;
    this.data.pendingSessionLog.push({ ts: Date.now(), type, text: clean });
    while (this.data.pendingSessionLog.length > MAX_PENDING_LOG) this.data.pendingSessionLog.shift();
  }

  recordPlayerChat(player, text) {
    const clean = this._pushRecent(player, 'player', text);
    if (!clean) return;
    this._pushPending('chat', `${player}: ${clean}`);
    this.save();
  }

  recordBotMessage(speaker, text) {
    const clean = this._pushRecent(speaker, 'bot', text);
    if (!clean) return;
    this._pushPending('bot', `${speaker}: ${clean}`);
    this.save();
  }

  recordEvent(type, text) {
    this._pushPending(type || 'event', text);
    this.save();
    try { this.eventHook?.(type || 'event', text); } catch {}
  }

  /* ---------- Expediente de infracciones (persiste entre sesiones, para !expediente y el Juez) ---------- */
  recordInfraction(player, text, seized = '') {
    const clean = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 160);
    if (!player || !clean) return null;
    if (!Array.isArray(this.data.infractions)) this.data.infractions = [];
    const entry = { ts: Date.now(), player: String(player), text: clean, seized: String(seized || '').slice(0, 120) };
    this.data.infractions.push(entry);
    while (this.data.infractions.length > MAX_INFRACTIONS) this.data.infractions.shift();
    this.save();
    return entry;
  }

  getInfractions(player = null, limit = 8) {
    const low = player ? String(player).toLowerCase() : null;
    const list = (this.data.infractions || []).filter(e => !low || e.player.toLowerCase() === low);
    return list.slice(-Math.max(1, limit)).reverse();
  }

  countInfractions(player, sinceMs = 0) {
    const low = String(player || '').toLowerCase();
    return (this.data.infractions || []).filter(e => e.player.toLowerCase() === low && e.ts >= sinceMs).length;
  }

  addPinnedNote(by, note) {
    const clean = String(note || '').trim().replace(/\s+/g, ' ').slice(0, 160);
    if (!clean) return null;
    const entry = { ts: Date.now(), by: String(by || 'Desconocido'), note: clean };
    this.data.pinnedNotes.push(entry);
    while (this.data.pinnedNotes.length > MAX_PINNED_NOTES) this.data.pinnedNotes.shift();
    this.save();
    return entry;
  }

  /* ---------- Permisos y prohibiciones expresas ---------- */
  _pruneList(listName) {
    const now = Date.now();
    const list = Array.isArray(this.data[listName]) ? this.data[listName] : [];
    const filtered = list.filter(p => !p.until || p.until > now);
    if (filtered.length !== list.length) {
      this.data[listName] = filtered;
      this.save();
    }
    return filtered;
  }

  _upsertRule(listName, oppositeName, { player, scope, actor, grantorRole, minutes = null, note = '', label = '', verb }) {
    this._pruneList(listName);
    this._pruneList(oppositeName);
    const low = String(player || '').toLowerCase();
    this.data[listName] = (this.data[listName] || []).filter(p => !(p.player.toLowerCase() === low && p.scope === scope));
    // Al autorizar un alcance se levanta cualquier prohibición opuesta (y viceversa)
    this.data[oppositeName] = (this.data[oppositeName] || []).filter(p => !(p.player.toLowerCase() === low && p.scope === scope));
    const entry = {
      ts: Date.now(),
      player: String(player),
      scope,
      grantedBy: String(actor || ''),
      grantorRole: grantorRole || '',
      label: String(label || PERMIT_SCOPES[scope]?.label || scope),
      until: minutes ? Date.now() + minutes * 60_000 : null,
      note: String(note || '').trim().replace(/\s+/g, ' ').slice(0, 120)
    };
    this.data[listName].push(entry);
    while (this.data[listName].length > MAX_PERMITS) this.data[listName].shift();
    const timeLabel = entry.until ? ` por ${minutes < 1 ? Math.round(minutes * 60) + ' s' : Math.round(minutes) + ' min'}` : ' (permanente)';
    this._pushPending('event', `${entry.grantedBy} ${verb} ${entry.label} a ${entry.player}${timeLabel}${entry.note ? `: ${entry.note}` : ''}`);
    this.save();
    return entry;
  }

  _removeRule(listName, { player, scope = null, by = '', verb }) {
    this._pruneList(listName);
    const low = String(player || '').toLowerCase();
    const before = (this.data[listName] || []).length;
    this.data[listName] = (this.data[listName] || []).filter(p => !(p.player.toLowerCase() === low && (!scope || p.scope === scope)));
    const removed = before - this.data[listName].length;
    if (removed) {
      this._pushPending('event', `${by} ${verb} ${removed} registro(s) de ${player}${scope ? ` (${PERMIT_SCOPES[scope]?.label || scope})` : ''}`);
      this.save();
    }
    return removed;
  }

  _hasActiveRule(listName, player, scope) {
    const now = Date.now();
    const low = String(player || '').toLowerCase();
    return (this.data[listName] || []).some(p => p.player.toLowerCase() === low && p.scope === scope && (!p.until || p.until > now));
  }

  _describeRule(p, verbLabel) {
    const ms = p.until ? Math.max(0, p.until - Date.now()) : 0;
    const left = !p.until ? '' : ms < 60_000 ? `${Math.max(1, Math.ceil(ms / 1000))} s` : ms < 3_600_000 ? `${Math.ceil(ms / 60_000)} min` : `${+(ms / 3_600_000).toFixed(1)} h`;
    return `${p.player}: ${p.label || PERMIT_SCOPES[p.scope]?.label || p.scope} (${verbLabel} ${p.grantedBy}${left ? `, quedan ${left}` : ', permanente'})${p.note ? ` — ${p.note}` : ''}`;
  }

  grantPermit({ player, scope, grantedBy, grantorRole, minutes = null, note = '', label = '' }) {
    return this._upsertRule('permits', 'prohibitions', { player, scope, actor: grantedBy, grantorRole, minutes, note, label, verb: 'dio permiso de' });
  }

  revokePermit({ player, scope = null, by = '' }) {
    return this._removeRule('permits', { player, scope, by, verb: 'retiró' });
  }

  getActivePermits(player = null) {
    const list = this._pruneList('permits');
    const low = player ? String(player).toLowerCase() : null;
    return list.filter(p => !low || p.player.toLowerCase() === low);
  }

  hasPermit(player, scope) {
    return this._hasActiveRule('permits', player, scope);
  }

  describePermit(p) {
    return this._describeRule(p, 'lo dio');
  }

  grantProhibition({ player, scope, prohibitedBy, grantorRole, minutes = null, note = '', label = '' }) {
    return this._upsertRule('prohibitions', 'permits', { player, scope, actor: prohibitedBy, grantorRole, minutes, note, label, verb: 'prohibió' });
  }

  revokeProhibition({ player, scope = null, by = '' }) {
    return this._removeRule('prohibitions', { player, scope, by, verb: 'levantó prohibición a' });
  }

  getActiveProhibitions(player = null) {
    const list = this._pruneList('prohibitions');
    const low = player ? String(player).toLowerCase() : null;
    return list.filter(p => !low || p.player.toLowerCase() === low);
  }

  hasProhibition(player, scope) {
    return this._hasActiveRule('prohibitions', player, scope);
  }

  describeProhibition(p) {
    return this._describeRule(p, 'lo prohibió');
  }

  getRecentChatForSocial(limit = 10) {
    return this.data.recentChat
      .slice(-Math.max(1, limit))
      .map(m => ({ player: m.speaker, message: m.text }));
  }

  getRecentChatText(limit = 10) {
    return this.data.recentChat
      .slice(-Math.max(1, limit))
      .map(m => `${m.speaker}: ${m.text}`)
      .join('\n');
  }

  getPersistentMemoryText({ maxSessions = 6, maxNotes = 12 } = {}) {
    const sections = [];
    const permits = this.getActivePermits();
    if (permits.length) {
      sections.push([
        '[PERMISOS EXPRESOS VIGENTES — quien tiene uno NO comete infracción al hacer eso; no lo regañes por ello]',
        ...permits.map(p => `- ${this.describePermit(p)}`)
      ].join('\n'));
    }
    const prohibs = this.getActiveProhibitions();
    if (prohibs.length) {
      sections.push([
        '[PROHIBICIONES EXPRESAS VIGENTES — quien tiene una NO puede tocar eso ni por autoconsumo]',
        ...prohibs.map(p => `- ${this.describeProhibition(p)}`)
      ].join('\n'));
    }
    const notes = this.data.pinnedNotes.slice(-maxNotes);
    if (notes.length) {
      sections.push([
        '[NOTAS RECORDADAS POR LOS JUGADORES]',
        ...notes.map(n => `- (${n.by}): ${n.note}`)
      ].join('\n'));
    }

    const sessions = this.data.sessionMemories.slice(-maxSessions);
    if (sessions.length) {
      sections.push([
        '[MEMORIA DE SESIONES ANTERIORES]',
        ...sessions.map(s => {
          const day = String(s.endedAt || '').slice(0, 10) || 'Reciente';
          const hitosTxt = Array.isArray(s.hitos) && s.hitos.length ? ` (Hitos: ${s.hitos.join('; ')})` : '';
          return `- [${day} · ${s.era || 'ERA'}] ${s.summary}${hitosTxt}`;
        })
      ].join('\n'));
    }

    const notables = this.data.pendingSessionLog
      .filter(e => e.type === 'infraction' || e.type === 'death' || e.type === 'event')
      .slice(-6);
    if (notables.length) {
      sections.push([
        '[EVENTOS NOTABLES DE ESTA SESIÓN]',
        ...notables.map(e => `- [${e.type}] ${e.text}`)
      ].join('\n'));
    }

    return sections.join('\n\n');
  }

  getStats() {
    return {
      recentCount: this.data.recentChat.length,
      pendingCount: this.data.pendingSessionLog.length,
      sessionsCount: this.data.sessionMemories.length,
      notesCount: this.data.pinnedNotes.length,
      permitsCount: this.getActivePermits().length,
      prohibitionsCount: this.getActiveProhibitions().length,
      latestSessions: this.data.sessionMemories.slice(-2)
    };
  }

  clearPending() {
    this.data.pendingSessionLog = [];
    this.save();
  }

  clearAll() {
    this.data = defaultData();
    this.save();
  }

  async compactNow({ reason = 'server_stop', eraLabel = 'ERA I', compactorFn }) {
    if (this.compacting) return { compacted: false, reason: 'busy' };
    const len = this.data.pendingSessionLog.length;
    if (len < 3) {
      console.log(`[Memoria] Sesión muy corta (${len} eventos); sin compactación necesaria.`);
      return { compacted: false, reason: 'too_short' };
    }
    this.compacting = true;
    try {
      const snapshot = [...this.data.pendingSessionLog];
      const existing = this.data.sessionMemories.slice(-4);
      const res = await compactorFn({
        reason,
        eraLabel,
        sessionEvents: snapshot,
        existingMemories: existing
      });
      const entry = {
        endedAt: new Date().toISOString(),
        era: eraLabel,
        summary: String(res?.resumen || '').trim(),
        hitos: Array.isArray(res?.hitos) ? res.hitos.map(String).filter(Boolean).slice(0, 4) : []
      };
      if (entry.summary) {
        this.data.sessionMemories.push(entry);
        while (this.data.sessionMemories.length > MAX_SESSION_MEMORIES) {
          this.data.sessionMemories.shift();
        }
      }
      this.data.pendingSessionLog = [];
      this.save();
      return { compacted: true, entry };
    } finally {
      this.compacting = false;
    }
  }
}
