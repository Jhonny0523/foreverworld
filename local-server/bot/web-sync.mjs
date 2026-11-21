// Puente en vivo Web (Supabase) <-> Servidor Minecraft (RCON):
// 1. Web -> Juego: anuncia nuevas Eras, obras auditadas, leyes avaladas, hitos, encargos y premios de festividades.
// 2. Juego -> Web: publica pulso ligero `state.live` con jugadores online, evento activo, feed e infracciones de Aduana.

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

export function snapshotWorld(state, bridge) {
  const era = bridge.getCurrentEra(state);
  const tx = bridge.makeTx(state);
  const doneTaskIds = new Set();
  for (const e of (bridge.D.ERAS || [])) {
    for (const t of (e.tasks || [])) {
      if (bridge.isTaskDone(state, t)) doneTaskIds.add(t.id);
    }
  }
  const auditedWorkIds = new Set(
    (state?.economy?.works || [])
      .filter(w => w.status === 'auditada' && w.id)
      .map(w => w.id)
  );
  const approvedLawIds = new Set(
    (state?.laws || [])
      .filter(l => l.id && !l.repealed && (
        l.review?.status === 'approved' ||
        (!l.review && l.signs?.myth && l.signs?.scad)
      ))
      .map(l => l.id)
  );
  const contractIds = new Set(
    (state?.contracts || [])
      .filter(c => c && c.id)
      .map(c => c.id)
  );
  return {
    eraIndex: era.index,
    eraCode: era.code,
    eraName: tx(era.name),
    reqDone: era.reqDone,
    reqTotal: era.reqTotal,
    doneTaskIds,
    auditedWorkIds,
    approvedLawIds,
    contractIds,
    holidayMarks: holidayMarksOf(state)
  };
}

export function diffWorldSnapshots(prevSnap, nextSnap, nextState, bridge) {
  if (!prevSnap || !nextSnap) {
    return {
      eraUnlocked: null,
      auditedWorks: [],
      approvedLaws: [],
      completedTasks: [],
      newContracts: [],
      completedHolidayTasks: []
    };
  }
  const tx = bridge.makeTx(nextState);
  const eraUnlocked = nextSnap.eraIndex > prevSnap.eraIndex
    ? { code: nextSnap.eraCode, name: nextSnap.eraName }
    : null;

  const effPts = bridge.E.effectiveWorkPoints(nextState, bridge.D.WORK_CATEGORIES || []);
  const auditedWorks = (nextState?.economy?.works || [])
    .filter(w => w.id && w.status === 'auditada' && !prevSnap.auditedWorkIds.has(w.id))
    .map(w => ({
      id: w.id,
      name: w.name,
      owner: w.owner,
      ownerLabel: w.owner === 'myth' || w.owner === 'scad'
        ? bridge.nat(nextState, w.owner).nation
        : String(bridge.pname(nextState, w.owner) || w.owner || 'Invitado'),
      eff: Number(effPts[w.id] ?? w.final ?? 0),
      final: Number(w.final) || 0
    }));

  const approvedLaws = (nextState?.laws || [])
    .filter(l => l.id && nextSnap.approvedLawIds.has(l.id) && !prevSnap.approvedLawIds.has(l.id))
    .map(l => {
      const meta = (bridge.D.DOC_TYPES || {})[l.docType || 'ley'] || { prefix: 'LEY' };
      return {
        id: l.id,
        code: `${meta.prefix} ${String(l.num || '').padStart(3, '0')}`,
        title: l.title
      };
    });

  const completedTasks = [];
  for (const e of (bridge.D.ERAS || [])) {
    for (const t of (e.tasks || [])) {
      if (nextSnap.doneTaskIds.has(t.id) && !prevSnap.doneTaskIds.has(t.id)) {
        completedTasks.push({ id: t.id, title: tx(t.title), eraCode: e.code, req: Boolean(t.req) });
      }
    }
  }

  const prevC = prevSnap.contractIds || new Set();
  const newContracts = (nextState?.contracts || [])
    .filter(c => c && c.id && !prevC.has(c.id))
    .map(c => ({
      id: c.id,
      title: c.title,
      author: c.author,
      authorLabel: bridge.pname(nextState, c.author),
      reward: Number(c.reward) || 0,
      cur: c.cur || 'M'
    }));

  const prevH = prevSnap.holidayMarks || new Set();
  const completedHolidayTasks = [];
  for (const key of (nextSnap.holidayMarks || [])) {
    if (!prevH.has(key)) {
      const [year, holidayId, taskId, pid] = key.split('|');
      completedHolidayTasks.push({ year, holidayId, taskId, pid });
    }
  }

  return { eraUnlocked, auditedWorks, approvedLaws, completedTasks, newContracts, completedHolidayTasks };
}

export class WebSyncAnnouncer {
  constructor({ bridge, rcon, enforcer, memory, deity = null, events = null, intervalMs = 30_000 } = {}) {
    this.bridge = bridge;
    this.rcon = rcon;
    this.enforcer = enforcer;
    this.memory = memory;
    this.deity = deity;
    this.events = events;
    this.intervalMs = Math.max(10_000, Number(intervalMs) || 30_000);
    this.lastSnap = null;
    this.timer = null;
    this.busy = false;
    this.liveFeed = [];
    this.liveTimer = null;
    this.lastLiveFingerprint = '';
    this.lastLivePushAt = 0;
  }

  async _sendLine(badge, badgeColor, parts) {
    await this.rcon.tellraw('@a', ['', { text: `[${badge}] `, color: badgeColor, bold: true }, ...parts]);
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

  async _processHolidayCompletions(items, state) {
    const holidays = this.bridge.D.HOLIDAYS || [];
    const checkedPairs = new Map();
    const hasOnline = (this.enforcer?.onlinePlayers?.size || 0) > 0;

    for (const item of items) {
      const hol = holidays.find(h => h.id === item.holidayId);
      if (!hol) continue;
      const tObj = (hol.tasks || []).find(t => t.id === item.taskId);
      const pName = this.bridge.pname(state, item.pid);
      if (tObj && hasOnline) {
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
        this.lastSnap = snapshotWorld(wr.state, this.bridge);
      }
    }
  }

  async pollOnce() {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await this.bridge.fetchWorld(true);
      if (res.offlineFallback) return;
      const nextSnap = snapshotWorld(res.state, this.bridge);
      if (!this.lastSnap) {
        this.lastSnap = nextSnap;
        return;
      }

      const diff = diffWorldSnapshots(this.lastSnap, nextSnap, res.state, this.bridge);
      this.lastSnap = nextSnap;

      const hasOnline = (this.enforcer?.onlinePlayers?.size || 0) > 0;
      const brief = this.bridge.getBriefing(res.state);

      this._suppressMemoryFeed = true;
      try {
        if (diff.eraUnlocked) {
          this.memory?.recordEvent('event', `Nueva Era desbloqueada: ${diff.eraUnlocked.code} (${diff.eraUnlocked.name})`);
          this.addFeed('era', `¡${diff.eraUnlocked.code} (${diff.eraUnlocked.name}) desbloqueada!`);
          if (hasOnline) {
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

        for (const w of diff.auditedWorks) {
          this.memory?.recordEvent('event', `Obra auditada en web: ${w.name} (${w.ownerLabel}, +${w.eff} pts)`);
          this.addFeed('obra', `Obra auditada: ${w.name} (${w.ownerLabel}, +${w.eff} pts)`);
          if (hasOnline) {
            await this._sendLine('Archivo', 'aqua', [
              { text: `Obra auditada: `, color: 'white' },
              { text: `${w.name}`, color: 'gold', bold: true },
              { text: ` (${w.ownerLabel}, +${w.eff} pts). Tasa actual: ${brief.fxText}`, color: 'gray' }
            ]).catch(() => {});
            await this.rcon.send('execute as @a at @s run playsound minecraft:block.note_block.chime master @s ~ ~ ~ 0.8 1.2').catch(() => {});
          }
        }

        for (const l of diff.approvedLaws) {
          this.memory?.recordEvent('event', `Acto avalado en web: ${l.code} — ${l.title}`);
          this.addFeed('ley', `Norma avalada: ${l.code} — ${l.title}`);
          if (hasOnline) {
            await this._sendLine('Archivo', 'light_purple', [
              { text: `Norma avalada y sellada: `, color: 'white' },
              { text: `${l.code}`, color: 'gold', bold: true },
              { text: ` — ${l.title}`, color: 'aqua' }
            ]).catch(() => {});
            await this.rcon.send('execute as @a at @s run playsound minecraft:ui.toast.challenge_complete master @s ~ ~ ~ 0.7 1').catch(() => {});
          }
        }

        for (const c of diff.newContracts) {
          const amt = this.bridge.money(res.state, c.reward, c.cur);
          this.memory?.recordEvent('event', `Nuevo encargo publicado: ${c.title} (${amt} por ${c.authorLabel})`);
          this.addFeed('encargo', `Nuevo encargo: "${c.title}" (${amt} · ${c.authorLabel})`);
          if (hasOnline) {
            await this._sendLine('Encargos', 'gold', [
              { text: `${c.authorLabel} publicó encargo: `, color: 'white' },
              { text: `"${c.title}"`, color: 'yellow', bold: true },
              { text: ` (paga ${amt}). Usa !contratos`, color: 'aqua' }
            ]).catch(() => {});
          }
        }

        if (diff.completedHolidayTasks.length) {
          await this._processHolidayCompletions(diff.completedHolidayTasks, res.state);
        }

        if (diff.completedTasks.length && !diff.eraUnlocked) {
          const label = diff.completedTasks.length > 2
            ? `${diff.completedTasks.length} hitos nuevos (${diff.completedTasks.slice(0, 2).map(t => t.title).join(', ')}…)`
            : diff.completedTasks.map(t => t.title).join(' + ');
          this.memory?.recordEvent('event', `Hitos marcados en web: ${label}`);
          this.addFeed('hito', `Hito completado: ${label}`);
          if (hasOnline) {
            const left = Math.max(0, nextSnap.reqTotal - nextSnap.reqDone);
            await this._sendLine('Roadmap', 'green', [
              { text: `Progreso web: `, color: 'white' },
              { text: label, color: 'green', bold: true },
              { text: ` · ${nextSnap.eraCode}: ${nextSnap.reqDone}/${nextSnap.reqTotal} obligatorios${left ? ` (faltan ${left})` : ''}.`, color: 'gray' }
            ]).catch(() => {});
            await this.rcon.send('execute as @a at @s run playsound minecraft:entity.experience_orb.pickup master @s ~ ~ ~ 0.7 1.1').catch(() => {});
          }
        }
      } finally {
        this._suppressMemoryFeed = false;
      }

      await this.syncLiveTelemetry({ force: false });
    } finally {
      this.busy = false;
    }
  }
}
