// Puente en vivo Web (Supabase) <-> Servidor Minecraft (RCON):
// 1. Web -> Juego (poll ligero rev cada 10s): anuncia nuevas Eras, hitos (y partes de ambos),
//    misiones de invitados, obras pendientes/auditadas, leyes/avales, cédulas, crónicas, portales,
//    estaciones, préstamos, pagos, convicción, encargos y premios de festividades.
// 2. Juego -> Web: publica pulso ligero `state.live` con jugadores online, evento activo, feed e infracciones de Aduana.

const BOT_WRITE_RE = /\(pulso\)|\(!pagar\)|\(!cronica\)|\(!portal\)|\(!estacion\)|\(!contrato|\(!ofrenda\)|\(!estudio\)|\(!resumen\)/i;

function holidayMarksOf(state) {
  const out = new Set();
  const hols = state?.holidays;
  if (!hols || typeof hols !== 'object') return out;
  for (const [year, yearObj] of Object.entries(hols)) {
    if (!yearObj || typeof yearObj !== 'object') continue;
    for (const [hid, hObj] of Object.entries(yearObj)) {
      if (!hObj || typeof hObj !== 'object') continue;
      for (const [tid, marks] of Object.entries(hObj)) {
        if (tid === 'claimed' || !marks || typeof marks !== 'object') continue;
        for (const [pid, ok] of Object.entries(marks)) {
          if (ok === true) out.add(`${year}|${hid}|${tid}|${pid}`);
        }
      }
    }
  }
  return out;
}

function guestQuestsDoneSet(state, bridge) {
  const out = new Set();
  const quests = bridge.D.GUEST_QUESTS || [];
  const gt = state?.guestTasks || {};
  for (const g of (Array.isArray(state?.guests) ? state.guests : [])) {
    const book = gt[g.id] || {};
    for (const q of quests) {
      const v = book[q.id];
      const ok = q.who === '3'
        ? Boolean(v && typeof v === 'object' && v.myth && v.scad && v.guest)
        : Boolean(v && typeof v === 'object' ? v.guest : v);
      if (ok) out.add(`${q.id}|${g.id}`);
    }
  }
  return out;
}

function devotionMarksSet(state) {
  const out = new Set();
  const dev = state?.devotion;
  if (!dev || typeof dev !== 'object') return out;
  for (const [pid, node] of Object.entries(dev)) {
    const marks = node?.marks;
    if (!marks || typeof marks !== 'object') continue;
    for (const [mid, val] of Object.entries(marks)) {
      if (val === true) out.add(`${pid}|${mid}`);
    }
  }
  return out;
}

export function snapshotWorld(state, bridge) {
  const era = bridge.getCurrentEra(state);
  const tx = bridge.makeTx(state);
  const doneTaskIds = new Set();
  const partialTaskHalves = new Set();

  for (const e of (bridge.D.ERAS || [])) {
    for (const t of (e.tasks || [])) {
      const done = bridge.isTaskDone(state, t);
      if (done) {
        doneTaskIds.add(t.id);
      } else if (t.who === 'ambos') {
        const v = state?.tasks?.[t.id];
        if (v && typeof v === 'object') {
          if (v.myth) partialTaskHalves.add(`${t.id}|myth`);
          if (v.scad) partialTaskHalves.add(`${t.id}|scad`);
        }
      }
    }
  }

  const works = Array.isArray(state?.economy?.works) ? state.economy.works : [];
  const auditedWorkIds = new Set(works.filter(w => w?.status === 'auditada' && w.id).map(w => w.id));
  const pendingWorkIds = new Set(works.filter(w => w?.status === 'pendiente' && w.id).map(w => w.id));

  const laws = Array.isArray(state?.laws) ? state.laws : [];
  const lawIds = new Set(laws.filter(l => l?.id).map(l => l.id));
  const approvedLawIds = new Set(
    laws.filter(l => l?.id && !l.repealed && (
      l.review?.status === 'approved' ||
      (!l.review && l.signs?.myth && l.signs?.scad)
    )).map(l => l.id)
  );

  const contractIds = new Set((Array.isArray(state?.contracts) ? state.contracts : []).filter(c => c?.id).map(c => c.id));
  const cedulaIds = new Set((Array.isArray(state?.villagers) ? state.villagers : []).filter(v => v?.id).map(v => v.id));
  const chronicleIds = new Set((Array.isArray(state?.chronicles) ? state.chronicles : []).filter(c => c?.id).map(c => c.id));
  const portalIds = new Set((Array.isArray(state?.portals) ? state.portals : []).filter(p => p?.id).map(p => p.id));
  const stationIds = new Set((Array.isArray(state?.stations) ? state.stations : []).filter(s => s?.id).map(s => s.id));
  const loanIds = new Set((Array.isArray(state?.economy?.loans) ? state.economy.loans : []).filter(l => l?.id).map(l => l.id));
  const ledgerIds = new Set((Array.isArray(state?.economy?.ledger) ? state.economy.ledger : []).filter(l => l?.id).map(l => l.id));

  return {
    eraIndex: era.index,
    eraCode: era.code,
    eraName: tx(era.name),
    reqDone: era.reqDone,
    reqTotal: era.reqTotal,
    doneTaskIds,
    partialTaskHalves,
    guestQuestMarks: guestQuestsDoneSet(state, bridge),
    auditedWorkIds,
    pendingWorkIds,
    lawIds,
    approvedLawIds,
    contractIds,
    cedulaIds,
    chronicleIds,
    portalIds,
    stationIds,
    loanIds,
    ledgerIds,
    devotionMarks: devotionMarksSet(state),
    holidayMarks: holidayMarksOf(state)
  };
}

export function diffWorldSnapshots(prevSnap, nextSnap, nextState, bridge) {
  const empty = {
    eraUnlocked: null,
    auditedWorks: [],
    newPendingWorks: [],
    approvedLaws: [],
    newLaws: [],
    completedTasks: [],
    partialTasks: [],
    completedGuestQuests: [],
    newContracts: [],
    completedHolidayTasks: [],
    newCedulas: [],
    newChronicles: [],
    newPortals: [],
    newStations: [],
    newLoans: [],
    newWebLedger: [],
    newDevotionMarks: []
  };
  if (!prevSnap || !nextSnap) return empty;

  const tx = bridge.makeTx(nextState);
  const ownerOf = id => (id === 'myth' || id === 'scad') ? bridge.nat(nextState, id).nation : String(bridge.pname(nextState, id) || id || 'Invitado');
  const eraUnlocked = nextSnap.eraIndex > prevSnap.eraIndex
    ? { code: nextSnap.eraCode, name: nextSnap.eraName }
    : null;

  const works = Array.isArray(nextState?.economy?.works) ? nextState.economy.works : [];
  const effPts = bridge.E.effectiveWorkPoints(nextState, bridge.D.WORK_CATEGORIES || []);
  const auditedWorks = works
    .filter(w => w?.id && w.status === 'auditada' && !prevSnap.auditedWorkIds.has(w.id))
    .map(w => ({
      id: w.id,
      name: w.name,
      owner: w.owner,
      ownerLabel: ownerOf(w.owner),
      eff: Number(effPts[w.id] ?? w.final ?? 0),
      final: Number(w.final) || 0
    }));

  const prevPend = prevSnap.pendingWorkIds || new Set();
  const newPendingWorks = works
    .filter(w => w?.id && w.status === 'pendiente' && !prevPend.has(w.id))
    .map(w => ({ id: w.id, name: w.name, ownerLabel: ownerOf(w.owner), proposed: Number(w.proposed) || 0 }));

  const laws = Array.isArray(nextState?.laws) ? nextState.laws : [];
  const docCode = l => {
    const meta = (bridge.D.DOC_TYPES || {})[l.docType || 'ley'] || { prefix: 'LEY' };
    return `${meta.prefix} ${String(l.num || '').padStart(3, '0')}`;
  };
  const approvedLaws = laws
    .filter(l => l?.id && nextSnap.approvedLawIds.has(l.id) && !prevSnap.approvedLawIds.has(l.id))
    .map(l => ({ id: l.id, code: docCode(l), title: l.title }));

  const prevLaws = prevSnap.lawIds || new Set();
  const newLaws = laws
    .filter(l => l?.id && !prevLaws.has(l.id) && !nextSnap.approvedLawIds.has(l.id))
    .map(l => ({ id: l.id, code: docCode(l), title: l.title }));

  const completedTasks = [];
  const partialTasks = [];
  const prevPartial = prevSnap.partialTaskHalves || new Set();
  for (const e of (bridge.D.ERAS || [])) {
    for (const t of (e.tasks || [])) {
      if (nextSnap.doneTaskIds.has(t.id) && !prevSnap.doneTaskIds.has(t.id)) {
        completedTasks.push({ id: t.id, title: tx(t.title), eraCode: e.code, req: Boolean(t.req), who: t.who });
      } else if (!nextSnap.doneTaskIds.has(t.id) && t.who === 'ambos') {
        for (const actor of ['myth', 'scad']) {
          const key = `${t.id}|${actor}`;
          if ((nextSnap.partialTaskHalves?.has(key)) && !prevPartial.has(key)) {
            const other = actor === 'myth' ? 'scad' : 'myth';
            partialTasks.push({
              id: t.id,
              title: tx(t.title),
              eraCode: e.code,
              actorName: bridge.nat(nextState, actor).player,
              missingName: bridge.nat(nextState, other).player
            });
          }
        }
      }
    }
  }

  const prevGq = prevSnap.guestQuestMarks || new Set();
  const completedGuestQuests = [];
  for (const key of (nextSnap.guestQuestMarks || [])) {
    if (!prevGq.has(key)) {
      const [qid, gid] = key.split('|');
      const qObj = (bridge.D.GUEST_QUESTS || []).find(q => q.id === qid);
      if (qObj) {
        completedGuestQuests.push({ id: qid, gid, player: bridge.pname(nextState, gid), title: tx(qObj.title) });
      }
    }
  }

  const prevC = prevSnap.contractIds || new Set();
  const newContracts = (Array.isArray(nextState?.contracts) ? nextState.contracts : [])
    .filter(c => c?.id && !prevC.has(c.id))
    .map(c => ({ id: c.id, title: c.title, author: c.author, authorLabel: bridge.pname(nextState, c.author), reward: Number(c.reward) || 0, cur: c.cur || 'M' }));

  const prevH = prevSnap.holidayMarks || new Set();
  const completedHolidayTasks = [];
  for (const key of (nextSnap.holidayMarks || [])) {
    if (!prevH.has(key)) {
      const [year, holidayId, taskId, pid] = key.split('|');
      completedHolidayTasks.push({ year, holidayId, taskId, pid });
    }
  }

  const prevCed = prevSnap.cedulaIds || new Set();
  const newCedulas = (Array.isArray(nextState?.villagers) ? nextState.villagers : [])
    .filter(v => v?.id && !prevCed.has(v.id))
    .map(v => ({ id: v.id, name: v.name, cedula: v.cedula || '', kind: v.kind === 'animal' ? 'CA' : 'CC', ownerLabel: ownerOf(v.owner) }));

  const prevChr = prevSnap.chronicleIds || new Set();
  const newChronicles = (Array.isArray(nextState?.chronicles) ? nextState.chronicles : [])
    .filter(c => c?.id && !prevChr.has(c.id))
    .map(c => ({ id: c.id, title: c.title || 'Crónica', authorLabel: bridge.pname(nextState, c.author), type: c.type || 'Crónica' }));

  const prevPrt = prevSnap.portalIds || new Set();
  const newPortals = (Array.isArray(nextState?.portals) ? nextState.portals : [])
    .filter(p => p?.id && !prevPrt.has(p.id))
    .map(p => ({ id: p.id, label: p.label || 'Portal', ow: p.ow || '?', nh: p.nh || '?' }));

  const prevSt = prevSnap.stationIds || new Set();
  const newStations = (Array.isArray(nextState?.stations) ? nextState.stations : [])
    .filter(s => s?.id && !prevSt.has(s.id))
    .map(s => ({ id: s.id, name: s.name || 'Estación', coords: s.coords || '', line: s.line || '' }));

  const prevLn = prevSnap.loanIds || new Set();
  const newLoans = (Array.isArray(nextState?.economy?.loans) ? nextState.economy.loans : [])
    .filter(l => l?.id && !prevLn.has(l.id))
    .map(l => ({ id: l.id, lender: bridge.pname(nextState, l.lender), borrower: bridge.pname(nextState, l.borrower), amount: Number(l.principal || l.amount || 0), cur: l.cur || 'M' }));

  const prevLed = prevSnap.ledgerIds || new Set();
  const newWebLedger = (Array.isArray(nextState?.economy?.ledger) ? nextState.economy.ledger : [])
    .filter(l => l?.id && !prevLed.has(l.id) && /^(Compra|Transferencia|Cambio|Encargo)/i.test(String(l.type || '')))
    .map(l => ({ id: l.id, type: l.type, text: l.text }));

  const prevDev = prevSnap.devotionMarks || new Set();
  const newDevotionMarks = [];
  for (const key of (nextSnap.devotionMarks || [])) {
    if (!prevDev.has(key)) {
      const [pid, mid] = key.split('|');
      const mObj = [...(bridge.D.FAITH_MILESTONES || []), ...(bridge.D.REASON_MILESTONES || [])].find(m => m.id === mid);
      newDevotionMarks.push({ pid, mid, player: bridge.pname(nextState, pid), title: mObj?.title || mid, isReason: String(mid).startsWith('r') });
    }
  }

  return {
    eraUnlocked,
    auditedWorks,
    newPendingWorks,
    approvedLaws,
    newLaws,
    completedTasks,
    partialTasks,
    completedGuestQuests,
    newContracts,
    completedHolidayTasks,
    newCedulas,
    newChronicles,
    newPortals,
    newStations,
    newLoans,
    newWebLedger,
    newDevotionMarks
  };
}

export class WebSyncAnnouncer {
  constructor({ bridge, rcon, enforcer, memory, deity = null, events = null, intervalMs = 10_000 } = {}) {
    this.bridge = bridge;
    this.rcon = rcon;
    this.enforcer = enforcer;
    this.memory = memory;
    this.deity = deity;
    this.events = events;
    this.intervalMs = Math.max(5_000, Number(intervalMs) || 10_000);
    this.lastSnap = null;
    this.lastRev = null;
    this.lastFullFetchAt = 0;
    this.timer = null;
    this.busy = false;
    this.announcementsEnabled = true;
    this.liveFeed = [];
    this.recentHighlights = [];
    this.liveTimer = null;
    this.lastLiveFingerprint = '';
    this.lastLivePushAt = 0;
  }

  async _sendLine(badge, badgeColor, parts) {
    await this.rcon.tellraw('@a', ['', { text: `[${badge}] `, color: badgeColor, bold: true }, ...parts]);
  }

  recordHighlight(text) {
    const clean = String(text || '').trim().slice(0, 140);
    if (!clean) return;
    this.recentHighlights.unshift({ ts: Date.now(), text: clean });
    const cutoff = Date.now() - 12 * 3_600_000;
    this.recentHighlights = this.recentHighlights.filter(h => h.ts >= cutoff).slice(0, 5);
  }

  getRecentHighlights() {
    const cutoff = Date.now() - 12 * 3_600_000;
    return this.recentHighlights.filter(h => h.ts >= cutoff).map(h => h.text);
  }

  addFeed(kind, text) {
    const clean = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 180);
    if (!clean) return;
    this.liveFeed.unshift({
      id: `lf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      t: Date.now(),
      kind: String(kind || 'evento'),
      text: clean
    });
    if (this.liveFeed.length > 12) this.liveFeed.length = 12;
    this.scheduleLiveSync(3500);
  }

  scheduleLiveSync(delayMs = 4000) {
    if (this.liveTimer) return;
    this.liveTimer = setTimeout(() => {
      this.liveTimer = null;
      this.syncLiveTelemetry({ force: false }).catch(err => console.warn('[WebSync live]', err.message));
    }, Math.max(500, delayMs));
  }

  buildLivePayload(state) {
    const online = [...(this.enforcer?.onlinePlayers || [])].sort();
    const act = this.events?.activeInfo?.() || null;
    const hCtx = this.bridge?.getHolidaysContext ? this.bridge.getHolidaysContext(state) : { cal: { active: [], upcoming: null } };
    const topHol = hCtx.cal?.active?.[0] || hCtx.cal?.upcoming || null;
    const infractions = (this.memory?.getInfractions?.(null, 8) || []).map(e => ({
      ts: Number(e.ts) || 0,
      player: String(e.player || ''),
      text: String(e.text || '').slice(0, 140),
      seized: String(e.seized || '').slice(0, 100)
    }));
    const payload = {
      at: Date.now(),
      online,
      activeEvent: act ? { id: act.id || '', name: act.name || '', minsLeft: Number(act.minsLeft) || 0 } : null,
      holiday: topHol ? {
        id: topHol.id,
        name: topHol.name,
        emoji: topHol.emoji,
        dateLabel: topHol.dateLabel,
        active: Boolean(topHol.active),
        daysLeft: Number(topHol.daysLeft) || 0
      } : null,
      feed: this.liveFeed.slice(0, 12),
      infractions
    };
    const fingerprint = JSON.stringify({
      online: payload.online,
      activeEvent: payload.activeEvent,
      holidayId: payload.holiday?.id || '',
      holidayActive: payload.holiday?.active || false,
      topFeed: payload.feed[0]?.id || '',
      topInfr: payload.infractions[0]?.ts || 0
    });
    return { payload, fingerprint };
  }

  async syncLiveTelemetry({ force = false } = {}) {
    try {
      const res = await this.bridge.fetchWorld(false);
      if (!res || res.offlineFallback || !res.state) return false;
      const { payload, fingerprint } = this.buildLivePayload(res.state);
      const now = Date.now();
      const onlineCount = payload.online.length;
      const periodicRefresh = onlineCount > 0 && (now - this.lastLivePushAt) >= 90_000;
      if (!force && fingerprint === this.lastLiveFingerprint && !periodicRefresh) {
        return false;
      }
      const wr = await this.bridge.mutateWorld(draft => {
        draft.live = payload;
      }, 'Bot (pulso)', { maxRetries: 2 });
      if (wr.ok) {
        this.lastLiveFingerprint = fingerprint;
        this.lastLivePushAt = now;
        this.lastRev = Number(wr.rev) || this.lastRev;
        if (this.lastSnap) {
          this.lastSnap = snapshotWorld(wr.state, this.bridge);
        }
        return true;
      }
    } catch (err) {
      console.warn('[WebSync live err]', err.message);
    }
    return false;
  }

  async start() {
    try {
      const res = await this.bridge.fetchWorld(true);
      if (!res.offlineFallback) {
        this.lastSnap = snapshotWorld(res.state, this.bridge);
        this.lastRev = Number(res.rev) || null;
        this.lastFullFetchAt = Date.now();
        await this.syncLiveTelemetry({ force: true });
      }
    } catch (err) {
      console.warn('[WebSync init]', err.message);
    }
    this.timer = setInterval(() => {
      this.pollOnce().catch(err => console.warn('[WebSync poll]', err.message));
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.liveTimer) {
      clearTimeout(this.liveTimer);
      this.liveTimer = null;
    }
  }

  async _processHolidayCompletions(items, state, canAnnounce) {
    const holidays = this.bridge.D.HOLIDAYS || [];
    const checkedPairs = new Map();

    for (const item of items) {
      const hol = holidays.find(h => h.id === item.holidayId);
      if (!hol) continue;
      const tObj = (hol.tasks || []).find(t => t.id === item.taskId);
      const pName = this.bridge.pname(state, item.pid);
      if (tObj && canAnnounce) {
        await this._sendLine(hol.name, 'gold', [
          { text: `${pName} completó `, color: 'white' },
          { text: tObj.title, color: 'yellow', bold: true },
          { text: ` (${hol.emoji}).`, color: 'gray' }
        ]).catch(() => {});
      }
      checkedPairs.set(`${item.year}|${item.holidayId}|${item.pid}`, { year: item.year, hol, pid: item.pid });
    }

    for (const { year, hol, pid } of checkedPairs.values()) {
      const node = state?.holidays?.[year]?.[hol.id];
      if (!node) continue;
      const allDone = (hol.tasks || []).every(t => node?.[t.id]?.[pid] === true);
      const alreadyClaimed = Boolean(node?.claimed?.[pid]);
      if (!allDone || alreadyClaimed) continue;

      const wr = await this.bridge.mutateWorld(draft => {
        if (!draft.holidays || typeof draft.holidays !== 'object') draft.holidays = {};
        if (!draft.holidays[year]) draft.holidays[year] = {};
        if (!draft.holidays[year][hol.id]) draft.holidays[year][hol.id] = {};
        if (!draft.holidays[year][hol.id].claimed) draft.holidays[year][hol.id].claimed = {};
        if (draft.holidays[year][hol.id].claimed[pid]) return { ok: false, msg: 'already_claimed' };
        draft.holidays[year][hol.id].claimed[pid] = Date.now();
        return { ok: true };
      }, `Bot (${hol.name})`);

      if (wr.ok && this.deity) {
        const player = this.bridge.pname(wr.state, pid);
        const rewardRes = await this.deity.grantHolidayReward({
          player,
          pid,
          holiday: hol,
          year: Number(year),
          state: wr.state,
          queueIfOffline: true
        });
        if (rewardRes?.ok) {
          this.addFeed('festividad', `${player} completó ${hol.name} (${rewardRes.queued ? 'premio en espera' : rewardRes.badge})`);
        }
        this.lastRev = Number(wr.rev) || this.lastRev;
        this.lastSnap = snapshotWorld(wr.state, this.bridge);
      }
    }
  }

  async _announceAll(diff, nextSnap, state, brief, isBotOrigin) {
    const canAnnounce = (this.enforcer?.onlinePlayers?.size || 0) > 0 && this.announcementsEnabled;
    let titleShown = false;

    if (diff.eraUnlocked) {
      this.memory?.recordEvent('event', `Nueva Era desbloqueada: ${diff.eraUnlocked.code} (${diff.eraUnlocked.name})`);
      this.addFeed('era', `¡${diff.eraUnlocked.code} (${diff.eraUnlocked.name}) desbloqueada!`);
      this.recordHighlight(`Nueva Era: ${diff.eraUnlocked.code} (${diff.eraUnlocked.name})`);
      if (canAnnounce) {
        titleShown = true;
        await this.rcon.send('title @a times 10 70 20').catch(() => {});
        await this.rcon.send(`title @a subtitle ${JSON.stringify({ text: diff.eraUnlocked.name, color: 'green' })}`).catch(() => {});
        await this.rcon.send(`title @a title ${JSON.stringify({ text: `¡${diff.eraUnlocked.code} DESBLOQUEADA!`, color: 'gold', bold: true })}`).catch(() => {});
        await this.rcon.send('execute as @a at @s run playsound minecraft:entity.player.levelup master @s ~ ~ ~ 0.9 1').catch(() => {});
        await this.rcon.send('execute as @a at @s run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:18,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:1,explosions:[{shape:"large_ball",colors:[I;16755200,5636095],has_twinkle:true,has_trail:true}]}}}}').catch(() => {});
        await this._sendLine('Roadmap', 'gold', [
          { text: `¡Nueva Era alcanzada desde la web! `, color: 'yellow', bold: true },
          { text: `${diff.eraUnlocked.code}: ${diff.eraUnlocked.name}. Pregunta al Arquitecto qué se desbloqueó.`, color: 'white' }
        ]).catch(() => {});
      }
    }

    if (diff.completedTasks.length && !diff.eraUnlocked) {
      const label = diff.completedTasks.length > 2
        ? `${diff.completedTasks.length} hitos nuevos (${diff.completedTasks.slice(0, 2).map(t => t.title).join(', ')}…)`
        : diff.completedTasks.map(t => t.title).join(' + ');
      this.memory?.recordEvent('event', `Hitos marcados en web: ${label}`);
      this.addFeed('hito', `Hito completado: ${label}`);
      this.recordHighlight(`Hito completado: ${label}`);
      if (canAnnounce) {
        const left = Math.max(0, nextSnap.reqTotal - nextSnap.reqDone);
        const first = diff.completedTasks[0];
        if (!titleShown) {
          titleShown = true;
          await this.rcon.send('title @a times 10 55 15').catch(() => {});
          await this.rcon.send(`title @a subtitle ${JSON.stringify({ text: first.title.slice(0, 75), color: 'gold' })}`).catch(() => {});
          await this.rcon.send(`title @a title ${JSON.stringify({ text: diff.completedTasks.length > 1 ? `★ ${diff.completedTasks.length} HITOS COMPLETADOS` : '★ HITO COMPLETADO', color: 'green', bold: true })}`).catch(() => {});
        }
        await this.rcon.send(`title @a actionbar ${JSON.stringify({ text: `${nextSnap.eraCode}: ${nextSnap.reqDone}/${nextSnap.reqTotal} obligatorios${left ? ` · faltan ${left}` : ' · ¡ERA LISTA!'}`, color: 'yellow' })}`).catch(() => {});
        await this.rcon.send('execute as @a at @s run particle minecraft:happy_villager ~ ~1.4 ~ 0.8 0.6 0.8 0.05 24').catch(() => {});
        await this.rcon.send(`execute as @a at @s run playsound ${first.req ? 'minecraft:ui.toast.challenge_complete' : 'minecraft:entity.experience_orb.pickup'} master @s ~ ~ ~ 0.8 1.1`).catch(() => {});
        await this._sendLine('Roadmap', 'green', [
          { text: `Hito completado: `, color: 'white' },
          { text: label, color: 'green', bold: true },
          { text: ` · ${nextSnap.eraCode}: ${nextSnap.reqDone}/${nextSnap.reqTotal}${left ? ` (faltan ${left})` : ''}.`, color: 'gray' }
        ]).catch(() => {});
      }
    }

    for (const pt of diff.partialTasks) {
      this.addFeed('hito', `${pt.actorName} avanzó su parte en "${pt.title}"`);
      if (canAnnounce) {
        await this.rcon.send(`title @a actionbar ${JSON.stringify({ text: `✔ ${pt.actorName}: ${pt.title} (falta ${pt.missingName})`, color: 'aqua' })}`).catch(() => {});
        await this.rcon.send('execute as @a at @s run playsound minecraft:block.note_block.pling master @s ~ ~ ~ 0.6 1.25').catch(() => {});
        await this._sendLine('Roadmap', 'aqua', [
          { text: `${pt.actorName} marcó su parte de `, color: 'white' },
          { text: `"${pt.title}"`, color: 'gold' },
          { text: ` (falta ${pt.missingName}).`, color: 'gray' }
        ]).catch(() => {});
      }
    }

    for (const gq of diff.completedGuestQuests) {
      this.memory?.recordEvent('event', `${gq.player} completó misión de invitado: ${gq.title}`);
      this.addFeed('invitado', `${gq.player}: ${gq.title}`);
      this.recordHighlight(`Misión de ${gq.player}: ${gq.title}`);
      if (canAnnounce) {
        if (!titleShown) {
          await this.rcon.send('title @a times 10 45 15').catch(() => {});
          await this.rcon.send(`title @a subtitle ${JSON.stringify({ text: `${gq.player}: ${gq.title}`.slice(0, 75), color: 'aqua' })}`).catch(() => {});
          await this.rcon.send(`title @a title ${JSON.stringify({ text: 'MISIÓN DE INVITADO', color: 'gold', bold: true })}`).catch(() => {});
        }
        await this.rcon.send('execute as @a at @s run playsound minecraft:entity.player.levelup master @s ~ ~ ~ 0.7 1.2').catch(() => {});
        await this._sendLine('Invitados', 'aqua', [{ text: `${gq.player} completó "${gq.title}".`, color: 'white' }]).catch(() => {});
      }
    }

    for (const w of diff.auditedWorks) {
      this.memory?.recordEvent('event', `Obra auditada en web: ${w.name} (${w.ownerLabel}, +${w.eff} pts)`);
      this.addFeed('obra', `Obra auditada: ${w.name} (${w.ownerLabel}, +${w.eff} pts)`);
      this.recordHighlight(`Obra auditada: ${w.name} (+${w.eff} pts)`);
      if (canAnnounce) {
        if (!titleShown) {
          titleShown = true;
          await this.rcon.send('title @a times 10 50 15').catch(() => {});
          await this.rcon.send(`title @a subtitle ${JSON.stringify({ text: `${w.name} (${w.ownerLabel}, +${w.eff} pts)`.slice(0, 75), color: 'gold' })}`).catch(() => {});
          await this.rcon.send(`title @a title ${JSON.stringify({ text: 'OBRA AUDITADA', color: 'aqua', bold: true })}`).catch(() => {});
        }
        await this._sendLine('Archivo', 'aqua', [
          { text: `Obra auditada: `, color: 'white' },
          { text: `${w.name}`, color: 'gold', bold: true },
          { text: ` (${w.ownerLabel}, +${w.eff} pts). Tasa actual: ${brief.fxText}`, color: 'gray' }
        ]).catch(() => {});
        await this.rcon.send('execute as @a at @s run playsound minecraft:block.note_block.chime master @s ~ ~ ~ 0.8 1.2').catch(() => {});
      }
    }

    for (const w of diff.newPendingWorks) {
      this.addFeed('obra', `Obra radicada por auditar: ${w.name} (${w.ownerLabel})`);
      if (canAnnounce) {
        await this._sendLine('Archivo', 'gold', [
          { text: `Nueva obra radicada para auditoría: `, color: 'white' },
          { text: `"${w.name}"`, color: 'yellow', bold: true },
          { text: ` de ${w.ownerLabel}. (Archivista: revisar en Economía → Obras)`, color: 'gray' }
        ]).catch(() => {});
        await this.rcon.send('execute as @a at @s run playsound minecraft:block.bell.use master @s ~ ~ ~ 0.5 1.1').catch(() => {});
      }
    }

    for (const l of diff.approvedLaws) {
      this.memory?.recordEvent('event', `Acto avalado en web: ${l.code} — ${l.title}`);
      this.addFeed('ley', `Norma avalada: ${l.code} — ${l.title}`);
      this.recordHighlight(`Norma sellada: ${l.code} (${l.title})`);
      if (canAnnounce) {
        if (!titleShown) {
          titleShown = true;
          await this.rcon.send('title @a times 10 50 15').catch(() => {});
          await this.rcon.send(`title @a subtitle ${JSON.stringify({ text: `${l.code} — ${l.title}`.slice(0, 75), color: 'aqua' })}`).catch(() => {});
          await this.rcon.send(`title @a title ${JSON.stringify({ text: 'NORMA SELLADA', color: 'light_purple', bold: true })}`).catch(() => {});
        }
        await this._sendLine('Archivo', 'light_purple', [
          { text: `Norma avalada y sellada: `, color: 'white' },
          { text: `${l.code}`, color: 'gold', bold: true },
          { text: ` — ${l.title}`, color: 'aqua' }
        ]).catch(() => {});
        await this.rcon.send('execute as @a at @s run playsound minecraft:ui.toast.challenge_complete master @s ~ ~ ~ 0.7 1').catch(() => {});
      }
    }

    for (const l of diff.newLaws) {
      this.addFeed('ley', `Nueva propuesta normativa: ${l.code} — ${l.title}`);
      if (canAnnounce) {
        await this._sendLine('Legislación', 'light_purple', [
          { text: `Nueva norma redactada en la web: `, color: 'white' },
          { text: `${l.code} — ${l.title}`, color: 'aqua' }
        ]).catch(() => {});
      }
    }

    for (const c of diff.newCedulas) {
      this.addFeed('censo', `Cédula ${c.cedula || c.kind} expedida a ${c.name} (${c.ownerLabel})`);
      if (canAnnounce) {
        await this._sendLine('TRD 150-01', 'emerald', [
          { text: `Nueva cédula expedida: `, color: 'white' },
          { text: `${c.name}${c.cedula ? ` [${c.cedula}]` : ''}`, color: 'gold', bold: true },
          { text: ` (${c.ownerLabel}).`, color: 'gray' }
        ]).catch(() => {});
        await this.rcon.send('execute as @a at @s run playsound minecraft:entity.villager.celebrate master @s ~ ~ ~ 0.6 1.1').catch(() => {});
      }
    }

    if (!isBotOrigin) {
      for (const cr of diff.newChronicles) {
        this.addFeed('cronica', `Crónica "${cr.title}" (${cr.authorLabel})`);
        if (canAnnounce) {
          await this._sendLine('TRD 140-01', 'aqua', [
            { text: `${cr.authorLabel} publicó ${cr.type.toLowerCase()}: `, color: 'white' },
            { text: `"${cr.title}"`, color: 'gold', bold: true }
          ]).catch(() => {});
          await this.rcon.send('execute as @a at @s run playsound minecraft:item.book.page_turn master @s ~ ~ ~ 0.8 1').catch(() => {});
        }
      }
      for (const p of diff.newPortals) {
        this.addFeed('mapa', `Nuevo portal en mapa: ${p.label} (OW ${p.ow})`);
        if (canAnnounce) {
          await this._sendLine('Cartografía', 'dark_aqua', [
            { text: `Portal registrado en mapa: `, color: 'white' },
            { text: `${p.label}`, color: 'light_purple', bold: true },
            { text: ` · OW (${p.ow}) ↔ NE (${p.nh}).`, color: 'gray' }
          ]).catch(() => {});
        }
      }
      for (const s of diff.newStations) {
        this.addFeed('mapa', `Nueva estación: ${s.name}`);
        if (canAnnounce) {
          await this._sendLine('Cartografía', 'dark_aqua', [
            { text: `Estación ferroviaria añadida: `, color: 'white' },
            { text: `${s.name}`, color: 'gold', bold: true },
            { text: `${s.coords ? ` (${s.coords})` : ''}.`, color: 'gray' }
          ]).catch(() => {});
        }
      }
      for (const c of diff.newContracts) {
        const amt = this.bridge.money(state, c.reward, c.cur);
        this.memory?.recordEvent('event', `Nuevo encargo publicado: ${c.title} (${amt} por ${c.authorLabel})`);
        this.addFeed('encargo', `Nuevo encargo: "${c.title}" (${amt} · ${c.authorLabel})`);
        this.recordHighlight(`Encargo: "${c.title}" (${amt})`);
        if (canAnnounce) {
          await this._sendLine('Encargos', 'gold', [
            { text: `${c.authorLabel} publicó encargo: `, color: 'white' },
            { text: `"${c.title}"`, color: 'yellow', bold: true },
            { text: ` (paga ${amt}). Usa !contratos`, color: 'aqua' }
          ]).catch(() => {});
          await this.rcon.send('execute as @a at @s run playsound minecraft:block.amethyst_block.chime master @s ~ ~ ~ 0.8 1.2').catch(() => {});
        }
      }
      for (const l of diff.newLoans) {
        this.addFeed('banco', `Préstamo: ${l.lender} -> ${l.borrower}`);
        if (canAnnounce) {
          await this._sendLine('Banco', 'gold', [{ text: `Nuevo préstamo registrado: ${l.lender} → ${l.borrower} (${this.bridge.money(state, l.amount, l.cur)}).`, color: 'white' }]).catch(() => {});
        }
      }
      for (const le of diff.newWebLedger) {
        this.addFeed('economia', le.text);
        if (canAnnounce) {
          await this._sendLine('Economía', 'yellow', [{ text: `${le.type}: `, color: 'gold', bold: true }, { text: le.text, color: 'white' }]).catch(() => {});
        }
      }
    }

    for (const dm of diff.newDevotionMarks) {
      this.addFeed('conviccion', `${dm.player} avanzó en ${dm.isReason ? 'La Razón' : 'Fe'}: ${dm.title}`);
      if (canAnnounce) {
        await this._sendLine(dm.isReason ? 'Academia' : 'Convicción', dm.isReason ? 'aqua' : 'light_purple', [
          { text: `${dm.player} alcanzó un nuevo peldaño (${dm.isReason ? 'La Razón' : 'Fe'}): `, color: 'white' },
          { text: dm.title, color: 'gold', bold: true }
        ]).catch(() => {});
      }
    }

    if (diff.completedHolidayTasks.length) {
      await this._processHolidayCompletions(diff.completedHolidayTasks, state, canAnnounce);
    }
  }

  async pollOnce() {
    if (this.busy) return;
    this.busy = true;
    try {
      const now = Date.now();
      if (this.lastRev !== null && (now - (this.lastFullFetchAt || 0)) < 60_000) {
        const peeked = await this.bridge.peekRev();
        if (peeked !== null && peeked === this.lastRev) {
          await this.syncLiveTelemetry({ force: false });
          return;
        }
      }

      const res = await this.bridge.fetchWorld(true);
      if (res.offlineFallback) return;
      this.lastFullFetchAt = now;
      if (res.rev) this.lastRev = Number(res.rev);

      const nextSnap = snapshotWorld(res.state, this.bridge);
      if (!this.lastSnap) {
        this.lastSnap = nextSnap;
        return;
      }

      const diff = diffWorldSnapshots(this.lastSnap, nextSnap, res.state, this.bridge);
      this.lastSnap = nextSnap;

      const updatedBy = String(res.updated_by || res.state?.updatedBy || '');
      const isBotOrigin = BOT_WRITE_RE.test(updatedBy);
      const brief = this.bridge.getBriefing(res.state);

      this._suppressMemoryFeed = true;
      try {
        await this._announceAll(diff, nextSnap, res.state, brief, isBotOrigin);
      } finally {
        this._suppressMemoryFeed = false;
      }

      await this.syncLiveTelemetry({ force: false });
    } finally {
      this.busy = false;
    }
  }
}
