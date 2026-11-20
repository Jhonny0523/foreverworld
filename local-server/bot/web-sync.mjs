// Puente en vivo Web (Supabase) -> Servidor Minecraft (RCON):
// anuncia en tiempo real nuevas Eras desbloqueadas, obras auditadas, leyes avaladas e hitos completados.

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
  return {
    eraIndex: era.index,
    eraCode: era.code,
    eraName: tx(era.name),
    reqDone: era.reqDone,
    reqTotal: era.reqTotal,
    doneTaskIds,
    auditedWorkIds,
    approvedLawIds
  };
}

export function diffWorldSnapshots(prevSnap, nextSnap, nextState, bridge) {
  if (!prevSnap || !nextSnap) {
    return { eraUnlocked: null, auditedWorks: [], approvedLaws: [], completedTasks: [] };
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
        : String(w.owner || 'Invitado'),
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

  return { eraUnlocked, auditedWorks, approvedLaws, completedTasks };
}

export class WebSyncAnnouncer {
  constructor({ bridge, rcon, enforcer, memory, intervalMs = 30_000 } = {}) {
    this.bridge = bridge;
    this.rcon = rcon;
    this.enforcer = enforcer;
    this.memory = memory;
    this.intervalMs = Math.max(10_000, Number(intervalMs) || 30_000);
    this.lastSnap = null;
    this.timer = null;
    this.busy = false;
  }

  async _sendLine(badge, badgeColor, parts) {
    await this.rcon.tellraw('@a', ['', { text: `[${badge}] `, color: badgeColor, bold: true }, ...parts]);
  }

  async start() {
    try {
      const res = await this.bridge.fetchWorld(true);
      if (!res.offlineFallback) {
        this.lastSnap = snapshotWorld(res.state, this.bridge);
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

      if (diff.eraUnlocked) {
        this.memory?.recordEvent('event', `Nueva Era desbloqueada: ${diff.eraUnlocked.code} (${diff.eraUnlocked.name})`);
        if (hasOnline) {
          await this.rcon.send('title @a times 10 70 20').catch(() => {});
          await this.rcon.send(`title @a subtitle ${JSON.stringify({ text: diff.eraUnlocked.name, color: 'green' })}`).catch(() => {});
          await this.rcon.send(`title @a title ${JSON.stringify({ text: `¡${diff.eraUnlocked.code} DESBLOQUEADA!`, color: 'gold', bold: true })}`).catch(() => {});
          await this.rcon.send('execute as @a at @s run playsound minecraft:entity.player.levelup master @s ~ ~ ~ 0.9 1').catch(() => {});
          await this.rcon.send('execute as @a at @s run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:18,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:1,explosions:[{shape:"large_ball",colors:[I;16755200,5636095],flicker:true}]}}}}').catch(() => {});
          await this._sendLine('Roadmap', 'gold', [
            { text: `¡Nueva Era alcanzada desde la web! `, color: 'yellow', bold: true },
            { text: `${diff.eraUnlocked.code}: ${diff.eraUnlocked.name}. Usa !era para ver qué se desbloqueó.`, color: 'white' }
          ]).catch(() => {});
        }
      }

      for (const w of diff.auditedWorks) {
        this.memory?.recordEvent('event', `Obra auditada en web: ${w.name} (${w.ownerLabel}, +${w.eff} pts)`);
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
        if (hasOnline) {
          await this._sendLine('Archivo', 'light_purple', [
            { text: `Norma avalada y sellada: `, color: 'white' },
            { text: `${l.code}`, color: 'gold', bold: true },
            { text: ` — ${l.title}`, color: 'aqua' }
          ]).catch(() => {});
          await this.rcon.send('execute as @a at @s run playsound minecraft:ui.toast.challenge_complete master @s ~ ~ ~ 0.7 1').catch(() => {});
        }
      }

      if (diff.completedTasks.length && !diff.eraUnlocked) {
        const label = diff.completedTasks.length > 2
          ? `${diff.completedTasks.length} hitos nuevos (${diff.completedTasks.slice(0, 2).map(t => t.title).join(', ')}…)`
          : diff.completedTasks.map(t => t.title).join(' + ');
        this.memory?.recordEvent('event', `Hitos marcados en web: ${label}`);
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
      this.busy = false;
    }
  }
}
