// La deidad de Miscolandia: no tiene nombre, carácter ni dogma propios. Existe solo si alguna fe
// (web → Lore → Religiones y fe) le dio nombre, y es exactamente lo que sus fieles escribieron.
// Responde casi nunca; sus favores salen de un catálogo amplio pero medido: cada favor tiene un costo
// de "gracia", la gracia de la semana es poca, y lo que puede dar depende de la Era (no adelanta progresión).

import fs from 'node:fs';
import { buildOllamaOptions, sanitizeChatText, smartTruncate } from './ollama.mjs';

const SAFE_PLAYER_RE = /^[A-Za-z0-9_]{1,16}$/;
const BANNED_TERM_RE = /(?:colomb|ollama|gemma|qwen|token|inteligencia artificial|modelo de lenguaje)/i;

const fx = (id, secs, amp = 0) => p => [`effect give ${p} minecraft:${id} ${secs} ${amp} true`];
const give = (item, n = 1) => p => [`give ${p} ${item} ${n}`];
const both = (...fns) => p => fns.flatMap(f => f(p));

// Catálogo de favores. cost = gracia que consume (la semana trae poca); minEra = desde qué Era existe.
// Criterios: efectos cortos; objetos en cantidades de "un empujón", nunca stacks; herramientas siempre
// gastadas; nada de comida (monopolios del día cero), encantamientos, tótems, élitros ni netherite hecho.
// spont = puede llegar también como bendición/hallazgo espontáneo (sin pedirlo).
export const FAVORS = {
  // ---- Efectos (al jugador) ----
  salud: { label: 'sanarle', kind: 'efecto', cost: 1, spont: true, cmds: both(fx('instant_health', 1, 1), fx('regeneration', 30)) },
  fortuna: { label: 'darle buena fortuna', kind: 'efecto', cost: 1, spont: true, cmds: fx('luck', 600) },
  prisa: { label: 'darle manos rápidas', kind: 'efecto', cost: 1, spont: true, cmds: fx('haste', 300) },
  vista: { label: 'dejarle ver en la oscuridad', kind: 'efecto', cost: 1, spont: true, cmds: fx('night_vision', 300) },
  agilidad: { label: 'aligerar sus pasos', kind: 'efecto', cost: 1, spont: true, cmds: both(fx('speed', 180), fx('jump_boost', 180)) },
  proteccion: { label: 'protegerle un rato', kind: 'efecto', cost: 1, spont: true, cmds: fx('resistance', 180) },
  branquias: { label: 'dejarle respirar bajo el agua', kind: 'efecto', cost: 1, cmds: fx('water_breathing', 300) },
  ignifugo: { label: 'hacerle inmune al fuego un rato', kind: 'efecto', cost: 2, cmds: fx('fire_resistance', 180) },
  pluma: { label: 'que caiga como una pluma', kind: 'efecto', cost: 1, cmds: fx('slow_falling', 120) },
  coraza: { label: 'cubrirle de corazones extra', kind: 'efecto', cost: 1, spont: true, cmds: fx('absorption', 120, 1) },
  fuerza: { label: 'darle fuerza para pelear', kind: 'efecto', cost: 2, cmds: fx('strength', 90) },
  sigilo: { label: 'volverle invisible un momento', kind: 'efecto', cost: 2, cmds: fx('invisibility', 60) },
  heroe: { label: 'que los aldeanos le traten como héroe', kind: 'efecto', cost: 2, minEra: 5, cmds: fx('hero_of_the_village', 300) },
  mar: { label: 'darle el poder del mar', kind: 'efecto', cost: 2, minEra: 8, cmds: fx('conduit_power', 300) },
  // ---- Sobre el mundo (afecta a todos) ----
  despejar: { label: 'despejar el cielo', kind: 'mundo', global: true, cost: 1, cmds: () => ['weather clear'] },
  lluvia: { label: 'traer la lluvia', kind: 'mundo', global: true, cost: 1, cmds: () => ['weather rain'] },
  amanecer: { label: 'adelantar el amanecer', kind: 'mundo', global: true, nightOnly: true, cost: 2, cmds: () => ['time set 0'] },
  // ---- Saber ----
  sabiduria: { label: 'darle un poco de saber', kind: 'objeto', cost: 1, spont: true, cmds: p => [`xp add ${p} 50 points`] },
  frascos: { label: 'regalarle frascos de experiencia', kind: 'objeto', cost: 2, minEra: 2, spont: true, cmds: give('minecraft:experience_bottle', 3) },
  // ---- Objetos pequeños (un empujón, no un atajo) ----
  antorchas: { label: 'regalarle antorchas', kind: 'objeto', cost: 1, spont: true, cmds: give('minecraft:torch', 16) },
  carbon: { label: 'regalarle carbón', kind: 'objeto', cost: 1, spont: true, cmds: give('minecraft:coal', 8) },
  hierro: { label: 'regalarle hierro para un pico', kind: 'objeto', cost: 2, spont: true, cmds: give('minecraft:iron_ingot', 3) },
  cobre: { label: 'regalarle cobre', kind: 'objeto', cost: 1, minEra: 3, spont: true, cmds: give('minecraft:copper_ingot', 8) },
  oro: { label: 'regalarle oro', kind: 'objeto', cost: 2, spont: true, cmds: give('minecraft:gold_ingot', 3) },
  lapislazuli: { label: 'regalarle lapislázuli', kind: 'objeto', cost: 2, minEra: 2, spont: true, cmds: give('minecraft:lapis_lazuli', 6) },
  esmeraldas: { label: 'regalarle esmeraldas', kind: 'objeto', cost: 3, minEra: 5, spont: true, cmds: give('minecraft:emerald', 2) },
  perla: { label: 'regalarle una perla de ender', kind: 'objeto', cost: 3, minEra: 4, cmds: give('minecraft:ender_pearl', 1) },
  vara: { label: 'regalarle una vara de blaze', kind: 'objeto', cost: 4, minEra: 4, cmds: give('minecraft:blaze_rod', 1) },
  diamante: { label: 'regalarle un diamante', kind: 'objeto', cost: 4, spont: true, cmds: give('minecraft:diamond', 1) },
  etiqueta: { label: 'regalarle una etiqueta de nombre', kind: 'objeto', cost: 2, cmds: give('minecraft:name_tag', 1) },
  montura: { label: 'regalarle una montura', kind: 'objeto', cost: 2, cmds: give('minecraft:saddle', 1) },
  cota: { label: 'regalarle una cota de malla', kind: 'objeto', cost: 3, cmds: give('minecraft:chainmail_chestplate[minecraft:damage=120]', 1) },
  espada: { label: 'dejarle una espada de hierro gastada', kind: 'objeto', cost: 2, cmds: give('minecraft:iron_sword[minecraft:damage=200]', 1) },
  pico: { label: 'dejarle un pico de diamante gastado', kind: 'objeto', cost: 5, minEra: 2, cmds: give('minecraft:diamond_pickaxe[minecraft:damage=1450]', 1) },
  escombro: { label: 'regalarle un escombro ancestral', kind: 'objeto', cost: 6, minEra: 4, cmds: give('minecraft:ancient_debris', 1) },
  tridente: { label: 'dejarle un tridente muy gastado', kind: 'objeto', cost: 6, minEra: 8, cmds: give('minecraft:trident[minecraft:damage=230]', 1) },
  caparazon: { label: 'regalarle un caparazón de shulker', kind: 'objeto', cost: 6, minEra: 11, cmds: give('minecraft:shulker_shell', 1) },
  // ---- Señal (sin efecto mecánico) ----
  senal: {
    label: 'mostrar una señal', kind: 'mundo', cost: 0,
    cmds: p => [
      `execute at ${p} run particle minecraft:end_rod ~ ~2 ~ 1.5 2 1.5 0.02 120`,
      `execute at ${p} run summon minecraft:firework_rocket ~ ~3 ~ {LifeTime:16,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:1,explosions:[{shape:"star",has_twinkle:true,colors:[I;16777215,16766720]}]}}}}`
    ]
  }
};
export const WISHES = FAVORS; // nombre anterior

// Catálogo de escarmientos por burla o blasfemia: dramáticos e inocuos para el mundo (sin borrar inventario ni romper bloques).
export const SMITES = {
  trueno: {
    label: 'fulminarle con un rayo y entumecerle',
    cmds: p => [
      `execute at ${p} run summon minecraft:lightning_bolt ~ ~ ~`,
      `effect give ${p} minecraft:weakness 30 0 true`,
      `effect give ${p} minecraft:slowness 15 1 true`
    ]
  },
  oscuridad: {
    label: 'envolverle en tinieblas',
    cmds: p => [
      `effect give ${p} minecraft:darkness 25 0 true`,
      `effect give ${p} minecraft:blindness 10 0 true`,
      `execute at ${p} run playsound minecraft:entity.warden.heartbeat master @a ~ ~ ~ 0.9 0.6`,
      `execute at ${p} run particle minecraft:large_smoke ~ ~1 ~ 1.5 1.5 1.5 0.02 90`
    ]
  },
  hambre: {
    label: 'dejarle con hambre voraz y mareo',
    cmds: p => [
      `effect give ${p} minecraft:hunger 35 2 true`,
      `effect give ${p} minecraft:nausea 12 0 true`,
      `execute at ${p} run playsound minecraft:entity.elder_guardian.curse master ${p} ~ ~ ~ 0.8 0.7`
    ]
  },
  levitacion: {
    label: 'alzarle por los aires en vergüenza',
    cmds: p => [
      `effect give ${p} minecraft:levitation 5 1 true`,
      `effect give ${p} minecraft:slow_falling 14 0 true`,
      `effect give ${p} minecraft:glowing 30 0 true`,
      `execute at ${p} run playsound minecraft:entity.shulker.shoot master @a ~ ~ ~ 0.9 0.7`,
      `execute at ${p} run particle minecraft:witch ~ ~1 ~ 1 1 1 0.1 80`
    ]
  },
  plomo: {
    label: 'cargarle los pasos como plomo',
    cmds: p => [
      `effect give ${p} minecraft:slowness 35 2 true`,
      `effect give ${p} minecraft:mining_fatigue 35 1 true`,
      `effect give ${p} minecraft:weakness 35 1 true`,
      `execute at ${p} run playsound minecraft:block.anvil.land master @a ~ ~ ~ 0.6 0.5`
    ]
  },
  marca: {
    label: 'marcarle como blasfemo con mala fortuna',
    cmds: p => [
      `effect give ${p} minecraft:glowing 90 0 true`,
      `effect give ${p} minecraft:unluck 180 1 true`,
      `effect give ${p} minecraft:nausea 8 0 true`,
      `execute at ${p} run playsound minecraft:block.bell.resonate master @a ~ ~ ~ 0.9 0.5`,
      `execute at ${p} run particle minecraft:soul_fire_flame ~ ~1 ~ 1 1.5 1 0.03 80`
    ]
  },
  escarmiento: {
    label: 'darle un escarmiento fugaz',
    cmds: p => [
      `execute at ${p} run playsound minecraft:entity.lightning_bolt.thunder master @a ~ ~ ~ 1 0.7`,
      `effect give ${p} minecraft:wither 6 0 true`,
      `effect give ${p} minecraft:darkness 10 0 true`,
      `execute at ${p} run particle minecraft:angry_villager ~ ~1.5 ~ 1 1 1 0.1 40`
    ]
  }
};

// Qué favores existen ahora: Era alcanzada, gracia que queda y (si aplica) que sea de noche
export function favorsFor({ era, budgetLeft, night = false, spontOnly = false }) {
  return Object.entries(FAVORS)
    .filter(([, f]) => (f.minEra || 0) <= era && f.cost <= budgetLeft && (!f.nightOnly || night) && (!spontOnly || f.spont))
    .map(([id]) => id);
}

const DEFAULTS = {
  enabled: true,
  answerChance: 0.05,       // 5 % de las invocaciones (que pasen los enfriamientos)
  believerBonus: 2,         // a sus propios fieles los escucha el doble
  minGapMinutes: 120,       // entre una respuesta y otra, para todos
  rollCooldownMinutes: 10,  // repetir el nombre en bucle no sirve: cada jugador "tira" una vez cada 10 min
  signChance: 0.12,         // a veces, en vez de hablar, solo se oye algo lejano
  gracePerWeek: 8,          // gracia divina por semana (todas las fes juntas): p. ej. 2 efectos + 1 diamante + 1 hierro
  reasonPerWeek: 8,         // lo mismo para la Razón (hallazgos), así ningún camino sale ganando
  playerWishDays: 7,        // un mismo jugador, como mucho un favor cada 7 días (pedido o espontáneo)
  answerPerLevel: 0.15,     // cada hito de fe cumplido sube un 15 % la probabilidad de respuesta
  // Ayuda pasiva (solo fieles de esa fe, o seguidores de la Razón como "temple"):
  rescueBase: 0.04,         // 4 % por apuro…
  rescuePerLevel: 0.03,     // …+3 % por hito cumplido…
  rescueMax: 0.25,          // …hasta 25 %
  rescueCooldownHours: 6,   // como mucho un rescate cada 6 h reales por jugador
  // Bendiciones (fieles) y hallazgos (Razón) espontáneos, sin pedirlos:
  findIntervalMinutes: 10,  // una tirada cada 10 min conectado
  findBase: 0.01,           // 1 % por tirada…
  findPerLevel: 0.005,      // …+0,5 % por hito cumplido
  // Castigos por burla o blasfemia contra una deidad con nombre (La Razón nunca castiga):
  smiteChance: 0.75,
  smiteCooldownMinutes: 5,
  smiteGlobalGapMinutes: 1
};

// Lo que cada apuro pide, en efectos cortos
const RESCUES = {
  fuego: { cmds: p => [`effect give ${p} minecraft:fire_resistance 30 0 true`, `effect give ${p} minecraft:regeneration 5 1 true`], what: 'del fuego' },
  agua: { cmds: p => [`effect give ${p} minecraft:water_breathing 45 0 true`, `effect give ${p} minecraft:regeneration 5 1 true`], what: 'del agua' },
  golpes: { cmds: p => [`effect give ${p} minecraft:regeneration 6 1 true`, `effect give ${p} minecraft:resistance 6 1 true`], what: 'de la muerte' }
};

const MOCKERY_RE = /\b(?:burl\w*|ridicul\w*|estupid\w*|idiot\w*|imbecil\w*|pendej\w*|bob[oa]s?|tont[oa]s?|basura|porqueria|mierd\w*|put[oa]s?|maldit[oa]s?|inutil\w*|patetic[oa]s?|fals[oa]s?|mentira\w*|invento\w*|cuento\w*|payas\w*|chiste\w*|mediocre\w*|debil\w*|cobarde\w*|fraude\w*|estafa\w*|no\s+existe\w*|no\s+sirve\w*|vale\s+(?:huevo|verga|nada|monda)|me\s+cago|me\s+rio|ja{2,}|je{2,}|xd+|lmao|que\s+asco|asco\s+de|horrible\w*|perdedor\w*|fracasad\w*|blasfemi\w*|herej\w*|malparid\w*|gonorre\w*|hpta|\bhp\b|vendehumo\w*|sobrevalorad\w*|da\s+risa|que\s+risa|puro\s+humo|no\s+hace\s+nada)\b/i;
const REASON_ONLY_RE = /\b(?:la\s+razon|razonamiento|ateo|ateos|ateismo|ciencia)\b/i;
const GENERIC_GOD_RE = /\b(?:dios|dioses|deidad|deidades|religion|religiones|fe|iglesia|culto|templo|profeta)\b/i;

export function normalizeName(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function nameRegex(name) {
  const n = normalizeName(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|[^a-z0-9])${n}(?:$|[^a-z0-9])`, 'i');
}

function describeReligion(x) {
  return [
    `Fe: ${x.faith || '(sin nombre)'} — la profesan ${x.people} (escrita por ${x.believer})`,
    `Nombres con que la invocan: ${x.names.join(', ')}`,
    x.nature && `Cómo es: ${x.nature}`,
    x.pleases && `Qué le agrada: ${x.pleases}`,
    x.angers && `Qué la ofende: ${x.angers}`,
    x.prayer && `Cómo se le reza: ${x.prayer}`,
    x.rites && `Ritos, templos y fiestas: ${x.rites}`
  ].filter(Boolean).join('\n');
}

export class Deity {
  constructor({ cfg, bridge, rcon, memory, statePath }) {
    this.cfg = cfg;
    this.bridge = bridge;
    this.rcon = rcon;
    this.memory = memory;
    this.statePath = statePath;
    this.opts = { ...DEFAULTS, ...(cfg.deity || {}) };
    this.saved = this.load();
    this.rolls = new Map(); // jugador -> última tirada
    this.smiteOmenRolls = new Map(); // jugador -> último augurio por enfriamiento de castigo
    this.offeringBoostUntil = new Map(); // jugador -> empujón sutil por !ofrenda / !estudio
    this.pendingSmiteAt = 0;
  }

  load() {
    try {
      if (this.statePath && fs.existsSync(this.statePath)) {
        const p = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
        return {
          lastAnswerAt: Number(p.lastAnswerAt) || 0,
          wishes: Array.isArray(p.wishes) ? p.wishes : [],
          log: Array.isArray(p.log) ? p.log : [],
          rescues: Array.isArray(p.rescues) ? p.rescues : [],
          finds: Array.isArray(p.finds) ? p.finds : [],
          smites: Array.isArray(p.smites) ? p.smites : [],
          offerings: Array.isArray(p.offerings) ? p.offerings : [],
          pendingHolidayRewards: Array.isArray(p.pendingHolidayRewards) ? p.pendingHolidayRewards : []
        };
      }
    } catch (err) {
      console.warn('[Deidad] Error leyendo estado:', err.message);
    }
    return { lastAnswerAt: 0, wishes: [], log: [], rescues: [], finds: [], smites: [], offerings: [], pendingHolidayRewards: [] };
  }

  save() {
    if (!this.statePath) return;
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(this.saved, null, 2), 'utf8');
    } catch (err) {
      console.warn('[Deidad] Error guardando estado:', err.message);
    }
  }

  // ¿A qué fe pertenece quien habla? (id de Estado o de invitado en la web)
  playerPid(player, role, state) {
    if (role === 'myth' || role === 'scad') return role;
    const low = String(player || '').toLowerCase();
    const g = (state?.guests || []).find(x => String(x.nick || '').toLowerCase() === low
      || (/^notout(?:of)?context$/.test(low) && /^notout(?:of)?context$/i.test(String(x.nick || ''))));
    return g ? g.id : null;
  }

  // ¿El mensaje invoca a algún dios con nombre? Devuelve la fe principal (la del propio jugador si comparte nombre)
  findInvocation(text, state, playerPid = null) {
    if (!this.opts.enabled) return null;
    const religions = this.bridge.getReligions(state);
    if (!religions.length) return null;
    const msg = normalizeName(text);
    const hits = [];
    for (const r of religions) {
      for (const name of r.names) {
        if (nameRegex(name).test(msg)) { hits.push({ religion: r, name }); break; }
      }
    }
    if (!hits.length) return null;
    const main = hits.find(h => h.religion.pid === playerPid) || hits[0];
    return { ...main, religions, alsoNamedBy: hits.filter(h => h !== main).map(h => h.religion) };
  }

  // Detecta burla/blasfemia contra cualquier fe con deidad nombrada; burlarse de La Razón/ateísmo NUNCA dispara castigo divino.
  detectMockery(text, state, playerPid = null) {
    if (!this.opts.enabled) return null;
    const religions = this.bridge.getReligions(state);
    if (!religions.length) return null;
    const msg = normalizeName(text);
    if (!MOCKERY_RE.test(msg)) return null;

    const hits = [];
    for (const r of religions) {
      let matched = null;
      for (const name of r.names) {
        if (nameRegex(name).test(msg)) { matched = { religion: r, name, matchedBy: 'name' }; break; }
      }
      if (!matched) {
        const faithNorm = normalizeName(r.faith).trim();
        if (faithNorm.length >= 3 && nameRegex(r.faith).test(msg)) {
          matched = { religion: r, name: r.names[0], matchedBy: 'faith' };
        }
      }
      if (matched) hits.push(matched);
    }

    if (hits.length) {
      const main = hits.find(h => h.religion.pid !== playerPid) || hits[0];
      return { ...main, religions, alsoNamedBy: hits.filter(h => h !== main).map(h => h.religion) };
    }

    if (REASON_ONLY_RE.test(msg) && !GENERIC_GOD_RE.test(msg)) return null;
    if (GENERIC_GOD_RE.test(msg)) {
      const chosen = religions.find(r => r.pid !== playerPid) || religions[0];
      return { religion: chosen, name: chosen.names[0], matchedBy: 'generic', religions, alsoNamedBy: [] };
    }
    return null;
  }

  rollSmite(player, rand = Math.random) {
    const now = Date.now();
    const low = String(player || '').toLowerCase();
    const smites = this.saved.smites || [];
    const lastGlobal = smites.reduce((mx, s) => Math.max(mx, Number(s.ts) || 0), this.pendingSmiteAt || 0);
    const lastPlayer = smites.reduce((mx, s) => (String(s.player || '').toLowerCase() === low ? Math.max(mx, Number(s.ts) || 0) : mx), 0);
    const onPlayerCooldown = now - lastPlayer < this.opts.smiteCooldownMinutes * 60_000;
    const onGlobalCooldown = now - lastGlobal < this.opts.smiteGlobalGapMinutes * 60_000;

    if (!onPlayerCooldown && !onGlobalCooldown && rand() < this.opts.smiteChance) {
      this.pendingSmiteAt = now;
      return 'smite';
    }
    if (now - (this.smiteOmenRolls.get(low) || 0) >= 60_000) {
      this.smiteOmenRolls.set(low, now);
      return 'omen';
    }
    return 'silence';
  }

  // Gracia que queda esta semana en un camino ('fe' = favores divinos, 'razon' = hallazgos)
  budgetLeft(path = 'fe') {
    const now = Date.now();
    const list = path === 'razon' ? (this.saved.finds || []) : (this.saved.wishes || []);
    const spent = list.filter(w => now - w.ts < 7 * 86_400_000).reduce((a, w) => a + (Number(w.cost) || FAVORS[w.id]?.cost || 0), 0);
    return Math.max(0, (path === 'razon' ? this.opts.reasonPerWeek : this.opts.gracePerWeek) - spent);
  }

  // Un mismo jugador recibe como mucho un favor por semana, sea pedido o espontáneo, de dios o de la Razón
  playerCanReceive(player) {
    const now = Date.now();
    const low = String(player).toLowerCase();
    return ![...(this.saved.wishes || []), ...(this.saved.finds || [])]
      .some(w => w.player.toLowerCase() === low && now - w.ts < this.opts.playerWishDays * 86_400_000);
  }

  wishesAvailable(player) {
    return this.playerCanReceive(player) && this.budgetLeft('fe') > 0;
  }

  async grant(player, id, path, extra = {}) {
    const f = FAVORS[id];
    for (const c of f.cmds(player)) await this.rcon.send(c).catch(() => {});
    const key = path === 'razon' ? 'finds' : 'wishes';
    this.saved[key] = [...(this.saved[key] || []), { ts: Date.now(), player, id, cost: f.cost, ...extra }].slice(-80);
    this.save();
  }

  // Tirada: 'answer' (habla), 'sign' (solo una señal sonora) o 'silence'. Se llama una vez por invocación.
  roll(player, isBeliever, rand = Math.random, level = 0) {
    const now = Date.now();
    const low = String(player).toLowerCase();
    if (now - (this.rolls.get(low) || 0) < this.opts.rollCooldownMinutes * 60_000) return 'silence';
    this.rolls.set(low, now);
    if (now - (this.saved.lastAnswerAt || 0) < this.opts.minGapMinutes * 60_000) {
      return rand() < this.opts.signChance ? 'sign' : 'silence';
    }
    const hasBoost = (this.offeringBoostUntil?.get(low) || 0) > now;
    const chance = Math.min(1, (this.opts.answerChance + (hasBoost ? 0.06 : 0)) * (isBeliever ? this.opts.believerBonus : 1) * (1 + this.opts.answerPerLevel * (isBeliever ? level : 0)));
    if (rand() < chance) {
      // Se reserva ya: si otro invoca mientras la IA piensa, no debe colarse una segunda respuesta
      this.prevAnswerAt = this.saved.lastAnswerAt || 0;
      this.saved.lastAnswerAt = now;
      return 'answer';
    }
    return rand() < this.opts.signChance ? 'sign' : 'silence';
  }

  async sign(player) {
    if (!SAFE_PLAYER_RE.test(player)) return;
    const sounds = ['minecraft:ambient.cave', 'minecraft:block.bell.resonate', 'minecraft:block.beacon.ambient'];
    const s = sounds[Math.floor(Math.random() * sounds.length)];
    await this.rcon.send(`execute at ${player} run playsound ${s} master ${player} ~ ~ ~ 0.35 0.6`).catch(() => {});
  }

  async isNight() {
    try {
      const t = Number((String(await this.rcon.send('time query daytime')).match(/(\d+)/) || [])[1]);
      return Number.isFinite(t) && t >= 13000 && t <= 23000;
    } catch {
      return false;
    }
  }

  buildPrompt({ inv, player, playerIdentity, message, wishIds, recentLog, state }) {
    const r = inv.religion;
    const others = inv.religions.filter(x => x !== r);
    const sacred = this.bridge.getSacredTexts(state || {}, 4);
    const systemPrompt = [
      `Eres la deidad que los fieles de Miscolandia invocan como «${inv.name}». Acabas de romper un silencio larguísimo: casi nunca hablas.`,
      'NO tienes identidad, historia ni dogma propios: eres EXACTAMENTE lo que tus fieles escribieron en <escrituras>, ni más ni menos.',
      'REGLAS ESTRICTAS:',
      '1. Toma tu carácter, tono y valores SOLO de <escrituras>. Si algo no está escrito, no lo afirmes: sé breve y enigmática en vez de inventar.',
      '2. JAMÁS inventes mandamientos, profecías concretas, nombres de dioses, lugares, personajes, milagros pasados ni historia nueva. El lore lo escriben los jugadores, no tú.',
      '3. Un solo mensaje en español, solemne y breve (máximo 180 caracteres). Háblale al jugador por su nombre. Puedes ser críptica, tierna, severa o burlona según tu naturaleza escrita.',
      '4. Si otras fes te conocen con otros nombres (ver <otras_fes>), puedes darte cuenta, pero responde como la fe con la que te llamaron.',
      '5. Si el jugador te reza con respeto pero hace algo que te desagrada según <escrituras>, adviértele con palabras (los castigos se reservan para burlas y blasfemias).',
      '6. DESEOS: casi nunca concedes. Solo pon un deseo distinto de "ninguno" si el jugador pidió EXPLÍCITAMENTE algo y encaja con lo que te agrada según <escrituras>. Elige de <deseos_posibles> el favor MÁS PEQUEÑO que responda a lo pedido (si pide algo enorme, como un stack de netherite, niégalo o dale algo mucho menor y simbólico). Si la lista dice "ninguno", deseo="ninguno". Ante la duda, "ninguno".',
      '7. No tienes ojos en el mundo: no describas lo que el jugador está viendo o construyendo.',
      '8. JAMÁS menciones a Colombia, IA, modelos, tokens ni algoritmos. Devuelve JSON {"mensaje": "...", "deseo": "..."}.'
    ].join('\n');
    const userPrompt = [
      `<escrituras>\n${describeReligion(r)}${sacred.length ? `\n\nTextos sagrados y mitos registrados:\n${sacred.join('\n')}` : ''}\n</escrituras>`,
      others.length ? `<otras_fes>\n${others.map(describeReligion).join('\n\n')}\n</otras_fes>` : '',
      recentLog.length ? `<lo_que_ya_dijiste>\n${recentLog.map(l => `- A ${l.player} (como ${l.name}): ${l.msg}`).join('\n')}\n</lo_que_ya_dijiste>` : '',
      `<deseos_posibles>\n${wishIds.length ? wishIds.map(id => `${id}: ${FAVORS[id].label} (${FAVORS[id].kind}, valor ${FAVORS[id].cost})`).join('\n') : 'ninguno'}\n</deseos_posibles>`,
      `<quien_te_invoca>\n${playerIdentity}\n</quien_te_invoca>`,
      `<oracion>\n${String(message).slice(0, 400)}\n</oracion>`
    ].filter(Boolean).join('\n\n');
    return { systemPrompt, userPrompt };
  }

  buildSmitePrompt({ inv, player, playerIdentity, message, state }) {
    const r = inv.religion;
    const sacred = this.bridge.getSacredTexts(state || {}, 4);
    const smiteList = Object.entries(SMITES).map(([id, s]) => `${id}: ${s.label}`).join('\n');
    const systemPrompt = [
      `Eres la deidad invocada como «${inv.name}» (fe: ${r.faith || r.names[0]}). Un mortal acaba de burlarse de ti o blasfemar contra tu nombre o tu fe.`,
      'NO inventes lore, historia ni nombres nuevos fuera de <escrituras>.',
      'REGLAS ESTRICTAS:',
      '1. Reprueba la burla en español con autoridad o ironía acorde a <escrituras> (máximo 180 caracteres), llamando al jugador por su nombre.',
      '2. Funciona igual sin importar si quien se burla es fiel tuyo, fiel de otra religión o no cree en dioses (seguidor de La Razón).',
      '3. Elige el id exacto de <castigos_posibles> que mejor cuadre con la ofensa.',
      '4. JAMÁS menciones a Colombia, IA, modelos, tokens ni algoritmos. Devuelve JSON {"mensaje": "...", "castigo": "..."}.'
    ].join('\n');
    const userPrompt = [
      `<escrituras>\n${describeReligion(r)}${sacred.length ? `\n\nTextos sagrados:\n${sacred.join('\n')}` : ''}\n</escrituras>`,
      `<castigos_posibles>\n${smiteList}\n</castigos_posibles>`,
      `<quien_se_burlo>\n${playerIdentity}\n</quien_se_burlo>`,
      `<blasfemia>\n${String(message).slice(0, 400)}\n</blasfemia>`
    ].filter(Boolean).join('\n\n');
    return { systemPrompt, userPrompt };
  }

  async _askJson({ systemPrompt, userPrompt, format, temperature = 0.8, numPredict = 180 }) {
    const res = await fetch(`${this.cfg.ollamaUrl.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(Number(this.cfg.ollamaTimeoutMs) || 60_000),
      body: JSON.stringify({
        model: this.cfg.ollamaModel,
        stream: false,
        think: false,
        keep_alive: this.cfg.ollamaKeepAlive || '10m',
        format,
        options: buildOllamaOptions(this.cfg, { temperature, num_predict: numPredict, num_ctx: 8192 }),
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      })
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const raw = String(data?.message?.content || '');
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    return JSON.parse(first >= 0 && last > first ? raw.slice(first, last + 1) : raw);
  }

  async ask({ systemPrompt, userPrompt, wishIds }) {
    return this._askJson({
      systemPrompt,
      userPrompt,
      temperature: 0.8,
      numPredict: 180,
      format: {
        type: 'object',
        properties: { mensaje: { type: 'string' }, deseo: { type: 'string', enum: ['ninguno', ...wishIds] } },
        required: ['mensaje', 'deseo']
      }
    });
  }

  async askSmite({ systemPrompt, userPrompt }) {
    return this._askJson({
      systemPrompt,
      userPrompt,
      temperature: 0.75,
      numPredict: 180,
      format: {
        type: 'object',
        properties: { mensaje: { type: 'string' }, castigo: { type: 'string', enum: Object.keys(SMITES) } },
        required: ['mensaje', 'castigo']
      }
    });
  }

  // Escarmiento divino por burla o blasfemia (si la IA falla, cae un castigo determinista: la burla no queda impune)
  async punish({ inv, player, playerIdentity, message, state }) {
    let reply = null;
    try {
      reply = await this.askSmite(this.buildSmitePrompt({ inv, player, playerIdentity, message, state }));
    } catch (err) {
      console.warn('[Deidad castigo] La IA no respondió; usando escarmiento directo:', err.message);
    }
    let msg = sanitizeChatText(reply?.mensaje);
    msg = smartTruncate(msg, 220);
    if (!msg || BANNED_TERM_RE.test(msg)) {
      msg = `${player}, la lengua ligera siempre encuentra el trueno.`;
    }
    const smiteId = SMITES[reply?.castigo] ? reply.castigo : 'trueno';
    const smite = SMITES[smiteId];
    const now = Date.now();
    this.pendingSmiteAt = 0;

    if (SAFE_PLAYER_RE.test(player)) {
      for (const c of smite.cmds(player)) await this.rcon.send(c).catch(() => {});
      await this.rcon.send(`title ${player} actionbar ${JSON.stringify({ text: `⚡ Ira de ${inv.name}`, color: 'red', bold: true })}`).catch(() => {});
    }
    await this.rcon.tellraw('@a', [
      '',
      { text: `[${inv.name}] `, color: 'dark_purple', bold: true },
      { text: msg, color: 'red', italic: true }
    ]).catch(() => {});
    await this.rcon.tellraw('@a', [
      '',
      { text: '⚡ ', color: 'red' },
      { text: `${inv.name} castigó a ${player} por burlarse: ${smite.label}.`, color: 'gold', italic: true }
    ]).catch(() => {});

    this.saved.smites = [...(this.saved.smites || []), { ts: now, player, name: inv.name, smiteId }].slice(-60);
    this.saved.log = [...(this.saved.log || []), { ts: now, player, name: inv.name, msg, smiteId }].slice(-30);
    this.save();
    this.memory?.recordEvent('event', `${inv.name} castigó a ${player} por burlarse (${smite.label}): "${msg}"`);
    return { msg, smiteId };
  }

  // La deidad habla (ya pasó la tirada). Si la IA falla, guarda silencio: los dioses no piden disculpas.
  async speak({ inv, player, playerIdentity, message, state }) {
    const era = this.bridge.getCurrentEra(state).index;
    const wishIds = this.wishesAvailable(player)
      ? favorsFor({ era, budgetLeft: this.budgetLeft('fe'), night: await this.isNight() })
      : [];
    const recentLog = (this.saved.log || []).slice(-4);
    let reply;
    try {
      reply = await this.ask({ ...this.buildPrompt({ inv, player, playerIdentity, message, wishIds, recentLog, state }), wishIds });
    } catch (err) {
      console.warn('[Deidad] La IA no respondió; la deidad calla:', err.message);
      this.saved.lastAnswerAt = this.prevAnswerAt || 0; // no gastó su turno
      return null;
    }
    let msg = sanitizeChatText(reply?.mensaje);
    msg = smartTruncate(msg, 260);
    if (!msg || BANNED_TERM_RE.test(msg)) {
      this.saved.lastAnswerAt = this.prevAnswerAt || 0;
      return null;
    }
    const wishId = wishIds.includes(reply?.deseo) ? reply.deseo : null;

    this.saved.lastAnswerAt = Date.now();
    this.saved.log = [...(this.saved.log || []), { ts: Date.now(), player, name: inv.name, msg }].slice(-30);

    await this.rcon.send('execute as @a at @s run playsound minecraft:block.beacon.power_select master @s ~ ~ ~ 0.5 0.5').catch(() => {});
    await this.rcon.tellraw('@a', [
      '',
      { text: `[${inv.name}] `, color: 'light_purple', bold: true },
      { text: msg, color: 'white', italic: true }
    ]).catch(() => {});

    if (wishId && SAFE_PLAYER_RE.test(player)) {
      const w = FAVORS[wishId];
      await this.grant(player, wishId, 'fe', { name: inv.name, asked: true });
      await this.rcon.tellraw('@a', [
        '',
        { text: '✦ ', color: 'gold' },
        { text: `${inv.name} decidió ${w.label}${w.global ? '' : ` a ${player}`}.`, color: 'gold', italic: true }
      ]).catch(() => {});
    }
    this.save();
    this.memory?.recordEvent('event', `${inv.name} (fe de ${inv.religion.people}) respondió a ${player}: "${msg}"${wishId ? ` y concedió: ${FAVORS[wishId].label}` : ''}`);
    return { msg, wishId };
  }

  /* ---------- Ayuda pasiva y hallazgos (sin IA: cuando hay un apuro, cada segundo cuenta) ---------- */
  startGuardian(enforcer, tickMs = 4000) {
    this.enforcer = enforcer;
    this.episodes = new Map(); // jugador -> último apuro evaluado
    this.findRolls = new Map(); // jugador -> última tirada de hallazgo
    if (this.guardTimer) clearInterval(this.guardTimer);
    this.guardTimer = setInterval(() => { this.guardTick().catch(err => console.warn('[Deidad guardián]', err.message)); }, tickMs);
  }

  stopGuardian() {
    if (this.guardTimer) clearInterval(this.guardTimer);
    this.guardTimer = null;
  }

  async readNum(player, path) {
    const res = String(await this.rcon.send(`data get entity ${player} ${path}`));
    const m = res.match(/entity data:\s*(-?[\d.]+)/i);
    return m ? Number(m[1]) : null;
  }

  async guardTick(rand = Math.random) {
    if (!this.opts.enabled || this.guarding || !this.enforcer?.onlinePlayers?.size) return;
    this.guarding = true;
    try {
      const { state } = await this.bridge.fetchWorld(false);
      for (const player of [...this.enforcer.onlinePlayers]) {
        if (!SAFE_PLAYER_RE.test(player)) continue;
        const pid = this.playerPid(player, this.enforcer.getPlayerRole(player, state), state);
        const dev = this.bridge.getDevotion(state, pid);
        if (!dev.path) continue; // sin convicción declarada, nadie vela por él
        await this.checkDanger(player, dev, state, rand);
        await this.maybeFind(player, dev, state, rand);
      }
    } finally {
      this.guarding = false;
    }
  }

  async checkDanger(player, dev, state, rand = Math.random) {
    const now = Date.now();
    const low = player.toLowerCase();
    const health = await this.readNum(player, 'Health').catch(() => null);
    if (health === null || health > 8 || health <= 0) return; // solo con 4 corazones o menos
    if (now - (this.episodes.get(low) || 0) < 90_000) return; // un apuro = una sola tirada
    this.episodes.set(low, now);
    if ((this.saved.rescues || []).some(r => r.player.toLowerCase() === low && now - r.ts < this.opts.rescueCooldownHours * 3_600_000)) return;
    const fire = await this.readNum(player, 'Fire').catch(() => null);
    const air = await this.readNum(player, 'Air').catch(() => null);
    const kind = fire > 0 ? 'fuego' : (air !== null && air <= 0) ? 'agua' : (health <= 5 ? 'golpes' : null);
    if (!kind) return;
    const chance = Math.min(this.opts.rescueMax, this.opts.rescueBase + this.opts.rescuePerLevel * dev.level);
    if (rand() >= chance) return;
    for (const c of RESCUES[kind].cmds(player)) await this.rcon.send(c).catch(() => {});
    this.saved.rescues = [...(this.saved.rescues || []), { ts: now, player, kind, path: dev.path }].slice(-60);
    this.save();
    if (dev.path === 'fe') {
      const r = (this.bridge.getReligions(state) || []).find(x => x.pid === dev.creed);
      const name = r?.names?.[0] || 'Lo divino';
      await this.rcon.send(`execute at ${player} run playsound minecraft:block.beacon.activate master @a ~ ~ ~ 0.6 1.4`).catch(() => {});
      await this.rcon.tellraw('@a', ['', { text: `[${name}] `, color: 'light_purple', bold: true }, { text: `apartó a ${player} ${RESCUES[kind].what}.`, color: 'white', italic: true }]).catch(() => {});
      this.memory?.recordEvent('event', `${name} salvó a ${player} ${RESCUES[kind].what} sin que se lo pidiera`);
    } else {
      await this.rcon.send(`execute at ${player} run playsound minecraft:item.totem.use master ${player} ~ ~ ~ 0.3 1.6`).catch(() => {});
      await this.rcon.tellraw('@a', ['', { text: '[Temple] ', color: 'aqua', bold: true }, { text: `${player} sacó fuerzas de donde no había y se salvó ${RESCUES[kind].what}.`, color: 'white', italic: true }]).catch(() => {});
      this.memory?.recordEvent('event', `${player} (la Razón) se salvó ${RESCUES[kind].what} por puro temple`);
    }
  }

  // Bendición (fiel) o hallazgo (Razón) espontáneo: misma probabilidad y mismo presupuesto semanal por camino
  async maybeFind(player, dev, state, rand = Math.random) {
    const now = Date.now();
    const low = player.toLowerCase();
    if (now - (this.findRolls.get(low) || 0) < this.opts.findIntervalMinutes * 60_000) return;
    this.findRolls.set(low, now);
    if (!this.playerCanReceive(player)) return;
    if (rand() >= this.opts.findBase + this.opts.findPerLevel * dev.level) return;
    const path = dev.path === 'razon' ? 'razon' : 'fe';
    const era = this.bridge.getCurrentEra(state).index;
    const ids = favorsFor({ era, budgetLeft: this.budgetLeft(path), spontOnly: true });
    if (!ids.length) return;
    // Lo pequeño es mucho más frecuente que lo valioso (peso = 1 / costo²)
    const weights = ids.map(id => 1 / Math.max(1, FAVORS[id].cost) ** 2);
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    let id = ids[ids.length - 1];
    for (let k = 0; k < ids.length; k++) { r -= weights[k]; if (r <= 0) { id = ids[k]; break; } }
    const f = FAVORS[id];
    if (path === 'fe') {
      const rel = (this.bridge.getReligions(state) || []).find(x => x.pid === dev.creed);
      const name = rel?.names?.[0] || 'Lo divino';
      await this.grant(player, id, 'fe', { name, spont: true });
      await this.rcon.send(`execute at ${player} run playsound minecraft:block.amethyst_block.resonate master ${player} ~ ~ ~ 0.6 1.2`).catch(() => {});
      await this.rcon.tellraw('@a', ['', { text: `[${name}] `, color: 'light_purple', bold: true }, { text: `sin que nadie se lo pidiera, decidió ${f.label}${f.global ? '' : ` a ${player}`}.`, color: 'white', italic: true }]).catch(() => {});
      this.memory?.recordEvent('event', `${name} bendijo a ${player} sin que lo pidiera: ${f.label}`);
    } else {
      await this.grant(player, id, 'razon', { spont: true });
      await this.rcon.send(`execute at ${player} run playsound minecraft:entity.player.levelup master ${player} ~ ~ ~ 0.5 1.2`).catch(() => {});
      await this.rcon.tellraw('@a', ['', { text: '[Hallazgo] ', color: 'aqua', bold: true }, { text: `la fortuna del método decidió ${f.label}${f.global ? '' : ` a ${player}`}.`, color: 'white', italic: true }]).catch(() => {});
      this.memory?.recordEvent('event', `${player} (la Razón) tuvo un hallazgo: ${f.label}`);
    }
  }

  /* ---------- Festividades de temporada + !ofrenda / !estudio ---------- */
  resolveHolidayAnnouncer(state, pid, holiday) {
    const dev = this.bridge.getDevotion(state, pid);
    if (dev.path === 'fe' && dev.creed) {
      const rel = (this.bridge.getReligions(state) || []).find(x => x.pid === dev.creed);
      const deityName = rel?.names?.[0];
      if (deityName) {
        return {
          path: 'fe',
          badge: deityName,
          badgeColor: 'light_purple',
          msg: String(holiday?.reward?.deityMsg || '{DEITY} celebra esta festividad contigo.').replace(/\{DEITY\}/g, deityName)
        };
      }
    }
    return {
      path: dev.path || 'razon',
      badge: dev.path === 'razon' ? 'Academia' : 'Festividad',
      badgeColor: dev.path === 'razon' ? 'aqua' : 'gold',
      msg: String(holiday?.reward?.reasonMsg || '¡Feliz festividad en Miscolandia!')
    };
  }

  async grantHolidayReward({ player, pid, holiday, year, state, isOnline = null, queueIfOffline = true }) {
    if (!holiday || !player) return { ok: false, reason: 'missing_args' };
    const onlineNow = isOnline !== null
      ? Boolean(isOnline)
      : Boolean(this.enforcer?.onlinePlayers?.has(player));

    if (!onlineNow && queueIfOffline) {
      if (!Array.isArray(this.saved.pendingHolidayRewards)) this.saved.pendingHolidayRewards = [];
      const dup = this.saved.pendingHolidayRewards.some(r =>
        String(r.player).toLowerCase() === String(player).toLowerCase() && r.holidayId === holiday.id && Number(r.year) === Number(year)
      );
      if (!dup) {
        this.saved.pendingHolidayRewards.push({ ts: Date.now(), player, pid, holidayId: holiday.id, year: Number(year) });
        this.saved.pendingHolidayRewards = this.saved.pendingHolidayRewards.slice(-40);
        this.save();
      }
      return { ok: true, queued: true };
    }

    if (!SAFE_PLAYER_RE.test(player)) return { ok: false, reason: 'invalid_player' };
    const ann = this.resolveHolidayAnnouncer(state, pid, holiday);
    const items = Array.isArray(holiday.reward?.items) ? holiday.reward.items : [];
    const fxList = Array.isArray(holiday.reward?.fx) ? holiday.reward.fx : [];

    for (const it of items) {
      if (it?.id && Number(it.count) > 0) {
        await this.rcon.send(`give ${player} ${it.id} ${Math.min(32, Math.floor(Number(it.count)))}`).catch(() => {});
      }
    }
    for (const rawFx of fxList) {
      const [id, secs = 180, amp = 0] = String(rawFx).split(':');
      if (id) await this.rcon.send(`effect give ${player} minecraft:${id} ${Number(secs) || 180} ${Number(amp) || 0} true`).catch(() => {});
    }
    await this.rcon.send(`execute at ${player} run particle minecraft:end_rod ~ ~1.5 ~ 0.9 0.9 0.9 0.03 50`).catch(() => {});
    await this.rcon.send(`execute at ${player} run playsound minecraft:ui.toast.challenge_complete master @a ~ ~ ~ 0.8 1.05`).catch(() => {});
    await this.rcon.tellraw('@a', [
      '',
      { text: `[${ann.badge}] `, color: ann.badgeColor, bold: true },
      { text: `${ann.msg} `, color: 'white', italic: true },
      { text: `(${holiday.emoji} ${holiday.name} · Premio para ${player}: ${holiday.reward?.label || 'regalo festivo'})`, color: 'gold' }
    ]).catch(() => {});

    this.memory?.recordEvent('event', `${ann.badge} entregó premio de ${holiday.name} a ${player}: ${holiday.reward?.label || ''}`);
    return { ok: true, delivered: true, badge: ann.badge, path: ann.path };
  }

  async deliverPendingHolidayRewards(player, state) {
    if (!SAFE_PLAYER_RE.test(player) || !Array.isArray(this.saved.pendingHolidayRewards) || !this.saved.pendingHolidayRewards.length) {
      return 0;
    }
    const low = String(player).toLowerCase();
    const keep = [];
    const toDeliver = [];
    for (const r of this.saved.pendingHolidayRewards) {
      if (String(r.player || '').toLowerCase() === low) toDeliver.push(r);
      else keep.push(r);
    }
    if (!toDeliver.length) return 0;
    this.saved.pendingHolidayRewards = keep;
    this.save();

    const holidays = this.bridge.D.HOLIDAYS || [];
    let count = 0;
    for (const item of toDeliver) {
      const hol = holidays.find(h => h.id === item.holidayId);
      if (!hol) continue;
      await this.grantHolidayReward({
        player,
        pid: item.pid,
        holiday: hol,
        year: item.year,
        state,
        isOnline: true,
        queueIfOffline: false
      });
      count++;
    }
    return count;
  }

  offeringCooldownLeftMs(player, kind) {
    const now = Date.now();
    const low = String(player || '').toLowerCase();
    const cooldownMs = 6 * 3_600_000;
    const hit = (this.saved.offerings || []).slice().reverse()
      .find(o => String(o.player || '').toLowerCase() === low && o.kind === kind && (now - o.ts) < cooldownMs);
    return hit ? Math.max(0, cooldownMs - (now - hit.ts)) : 0;
  }

  async processOffering({ player, pid, kind, itemId, itemLabel, state }) {
    if (!SAFE_PLAYER_RE.test(player)) return { ok: false, msg: 'Jugador inválido.' };
    const now = Date.now();
    const low = player.toLowerCase();
    if (!Array.isArray(this.saved.offerings)) this.saved.offerings = [];
    this.saved.offerings = [...this.saved.offerings, { ts: now, player, pid, kind, itemId }].slice(-80);
    this.offeringBoostUntil.set(low, now + 2 * 3_600_000);
    this.save();

    if (kind === 'fe') {
      const dev = this.bridge.getDevotion(state, pid);
      const rel = (this.bridge.getReligions(state) || []).find(x => x.pid === dev.creed);
      const name = rel?.names?.[0] || 'Lo divino';
      await this.rcon.send(`execute at ${player} run particle minecraft:end_rod ~ ~1.3 ~ 0.7 0.7 0.7 0.02 45`).catch(() => {});
      await this.rcon.send(`execute at ${player} run playsound minecraft:block.beacon.activate master @a ~ ~ ~ 0.6 1.3`).catch(() => {});
      await this.rcon.tellraw('@a', [
        '',
        { text: `[${name}] `, color: 'light_purple', bold: true },
        { text: `recibió en silencio la ofrenda de ${player} (${itemLabel}).`, color: 'white', italic: true }
      ]).catch(() => {});
      this.memory?.recordEvent('event', `${player} presentó ofrenda (${itemLabel}) ante ${name}`);
      return { ok: true, badge: name };
    }

    await this.rcon.send(`execute at ${player} run particle minecraft:enchant ~ ~1.5 ~ 0.8 0.8 0.8 0.3 60`).catch(() => {});
    await this.rcon.send(`execute at ${player} run playsound minecraft:entity.player.levelup master @a ~ ~ ~ 0.5 1.35`).catch(() => {});
    await this.rcon.tellraw('@a', [
      '',
      { text: '[Academia] ', color: 'aqua', bold: true },
      { text: `${player} dedicó ${itemLabel} al estudio metódico de Miscolandia.`, color: 'white', italic: true }
    ]).catch(() => {});
    this.memory?.recordEvent('event', `${player} (La Razón) dedicó ${itemLabel} al estudio`);
    return { ok: true, badge: 'Academia' };
  }
}
