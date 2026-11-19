import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateSocialMessage } from './ollama.mjs';

/* ==========================================================================
   Eventos espontáneos del mundo (solo comandos vanilla, nada destructivo,
   nada de fuego ni explosiones, y nada que regale ítems y descuadre la economía).

   "Clave dinámica": el día se parte en franjas (30 min por defecto). Para cada franja
   se calcula sha256(mundo | fecha | franja). De ese número salen, sin que nadie lo decida:
     - si hay evento en esa franja (probabilidad chancePct),
     - el minuto exacto en que empieza dentro de la franja,
     - cuál evento toca, entre los que ya permite la era actual (y la hora del día en el juego).
   Reglas: un evento a la vez, una pausa mínima entre eventos y solo con jugadores conectados.

   Cada evento: id, name, minEra, weight (frecuencia), durationMin (0 = instantáneo),
   tickSec (refuerzos periódicos), night/day (solo de noche / de día en el juego),
   desc, start(ctx) → comandos, tick(ctx, n) → comandos, end(ctx) → comandos.
   ctx = { era, rcon, data } (data se guarda en disco por si el bot se reinicia a mitad).
   ========================================================================== */

// Jugadores en supervivencia (los efectos no molestan a quien esté en creativo o espectador)
const SV = '@a[gamemode=!spectator,gamemode=!creative]';
const inOW = cmd => `execute as ${SV} at @s if dimension minecraft:overworld run ${cmd}`;
const inNether = cmd => `execute as ${SV} at @s if dimension minecraft:the_nether run ${cmd}`;
// Solo jugadores a cielo abierto del Overworld (no bajo techo ni en cuevas)
const exposed = cmd => `execute as ${SV} at @s if dimension minecraft:overworld positioned over motion_blocking if entity @s[distance=..2] run ${cmd}`;
// Jugadores bajo tierra (Y < 40), en cualquier lado del Overworld
const UNDER = '@a[gamemode=!spectator,gamemode=!creative,y=-64,dy=103]';
const under = cmd => `execute as ${UNDER} at @s if dimension minecraft:overworld run ${cmd}`;
// "cmd" en la superficie a cierta distancia de cada jugador del Overworld
const ringAt = (dx, dz, cmd) => `execute as ${SV} at @s if dimension minecraft:overworld positioned ~${dx} ~ ~${dz} positioned over motion_blocking_no_leaves run ${cmd}`;
const title = (t, color, sub) => [
  'title @a times 10 60 20',
  `title @a subtitle ${JSON.stringify({ text: sub, color: 'gray' })}`,
  `title @a title ${JSON.stringify({ text: t, color, bold: true })}`
];
const sound = (id, vol = 0.8, pitch = 1) => `execute as @a at @s run playsound ${id} master @s ~ ~ ~ ${vol} ${pitch}`;
const say = (text, color = 'gray') => `tellraw @a ${JSON.stringify({ text, color, italic: true })}`;
const TAG = '{Tags:["fw_evento"]}';
const buffMobs = (effect, secs = 400) => `effect give @e[tag=fw_evento,type=!minecraft:player] minecraft:${effect} ${secs} 0 true`;

// Posiciones alrededor del jugador (a 9–14 bloques) para que no aparezcan encima
const RING = [[12, 4], [-10, 9], [6, -12], [-9, -9], [13, -3], [-13, 2], [3, 13], [-4, -13]];
// Qué mobs puede traer una horda según la era: más variados y duros con el tiempo
function hordeMobs(era) {
  const m = ['zombie', 'skeleton', 'spider'];
  if (era >= 2) m.push('husk', 'zombie_villager');
  if (era >= 3) m.push('cave_spider');
  if (era >= 5) m.push('pillager', 'witch');
  if (era >= 7) m.push('vindicator');
  if (era >= 9) m.push('stray', 'bogged');
  if (era >= 11) m.push('enderman');
  if (era >= 12) m.push('wither_skeleton');
  return m;
}
// Al invocar un mob con datos (la etiqueta del evento), Minecraft NO le da su equipo normal:
// por eso se le da a mano. tier 0 = sin armadura, 1 = algo, 2 = blindado. Nunca suelta el equipo
// (drop 0) para que nadie haga "farm" de hierro con los eventos.
const WEAPON = { skeleton: 'bow', stray: 'bow', bogged: 'bow', pillager: 'crossbow', vindicator: 'iron_axe', wither_skeleton: 'stone_sword' };
const MELEE = ['zombie', 'husk', 'zombie_villager', 'drowned'];
const HUMANOID = [...MELEE, 'skeleton', 'stray', 'bogged', 'wither_skeleton', 'pillager', 'vindicator'];
function mobNbt(mob, tier = 1, extra = '') {
  const eq = {};
  if (WEAPON[mob]) eq.mainhand = WEAPON[mob];
  else if (MELEE.includes(mob) && tier >= 1) eq.mainhand = tier >= 2 ? 'iron_sword' : 'stone_sword';
  if (HUMANOID.includes(mob) && tier >= 1) eq.head = tier >= 2 ? 'iron_helmet' : 'chainmail_helmet';
  if (HUMANOID.includes(mob) && tier >= 2) Object.assign(eq, { chest: 'iron_chestplate', legs: 'chainmail_leggings', feet: 'iron_boots' });
  const slots = Object.keys(eq);
  const equipment = slots.map(k => `${k}:{id:"minecraft:${eq[k]}",count:1}`).join(',');
  const drops = slots.map(k => `${k}:0.0f`).join(',');
  return `{Tags:["fw_evento"]${slots.length ? `,equipment:{${equipment}},drop_chances:{${drops}}` : ''}${extra}}`;
}
const spawn = (mob, dx, dz, tier = 1) => ringAt(dx, dz, `summon minecraft:${mob} ~ ~ ~ ${mobNbt(mob, tier)}`);
// Jinete araña: araña con un esqueleto con arco encima
const jockey = (dx, dz) => ringAt(dx, dz, `summon minecraft:spider ~ ~ ~ {Tags:["fw_evento"],Passengers:[${'{id:"minecraft:skeleton",' + mobNbt('skeleton', 1).slice(1)}]}`);
// Posición i alrededor del jugador: anillos cada vez más anchos si son muchos
const spot = i => { const [dx, dz] = RING[i % RING.length]; const k = 1 + Math.floor(i / RING.length) * 0.45; return [Math.round(dx * k), Math.round(dz * k)]; };
function horde(era, count, offset = 0, tier = 1, mobs = hordeMobs(era)) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const [dx, dz] = spot(i + offset);
    out.push(spawn(mobs[Math.floor(Math.random() * mobs.length)], dx, dz, tier));
  }
  return out;
}
// Horda de luna de sangre: 30 mobs en total, repartidos entre los jugadores conectados
const BLOOD_HORDE = 30;
const MAX_ALIVE = 200;
const perPlayer = (ctx, total) => Math.max(1, Math.ceil(total / Math.max(1, ctx.players || 1)));
// Tope de seguridad contra el lag: si ya hay demasiados mobs del evento vivos, se salta la oleada
async function tooMany(ctx) {
  try { const r = String(await ctx.rcon.send('execute if entity @e[tag=fw_evento]')); const n = Number((r.match(/count:\s*(\d+)/i) || [])[1] || 0); return n >= MAX_ALIVE; } catch { return false; }
}
// Para la luna de sangre: lo de la era + husks y creepers desde el principio
const bloodMobs = era => [...new Set([...hordeMobs(era), 'husk', 'creeper', 'zombie', 'skeleton'])];
const hordeSize = era => 3 + Math.floor(era / 2);
// Jugadores veteranos: los mobs de evento pegan más, aguantan más y no se queman al sol
const tough = (secs = 400) => ['strength', 'resistance', 'fire_resistance'].map(e => buffMobs(e, secs));

// Velocidad de crecimiento de cultivos (el nombre de la regla cambió entre versiones)
async function readTickRule(rcon) {
  for (const name of ['randomTickSpeed', 'minecraft:random_tick_speed', 'random_tick_speed']) {
    try {
      const res = String(await rcon.send(`gamerule ${name}`));
      const m = res.match(/(-?\d+)\s*\.?\s*$/);
      if (m && !/unknown|incorrect|invalid|expected/i.test(res)) return { name, value: Number(m[1]) };
    } catch {}
  }
  return null;
}
const tickRuleEvent = (factor, label) => ({
  start: async ctx => {
    const rule = await readTickRule(ctx.rcon);
    if (!rule) return [say(`(${label}: esta versión no deja cambiar el crecimiento; solo es ambiente.)`)];
    ctx.data.rule = rule;
    return [`gamerule ${rule.name} ${Math.max(0, Math.round(rule.value * factor))}`];
  },
  end: ctx => (ctx.data.rule ? [`gamerule ${ctx.data.rule.name} ${ctx.data.rule.value}`] : [])
});
const fireworks = (colors = [16711680, 16776960, 65535], n = 3) => {
  const fw = `{LifeTime:22,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:1,explosions:[{shape:"large_ball",has_twinkle:true,colors:[I;${colors.join(',')}]}]}}}}`;
  return RING.slice(0, n).map(([dx, dz]) => `execute as @a at @s if dimension minecraft:overworld run summon minecraft:firework_rocket ~${dx} ~12 ~${dz} ${fw}`);
};

export const WORLD_EVENTS = [
  /* ===================== ERA I · Asentamiento (aquí van a pasar mucho tiempo) ===================== */
  { id: 'lluvia_acida', name: 'Lluvia ácida', minEra: 1, weight: 3, durationMin: 4, tickSec: 6,
    desc: 'Lluvia ácida durante 4 minutos: quien esté a cielo abierto se marchita (wither y veneno: SÍ puede matar). Busquen techo ya.',
    start: () => ['weather rain', ...title('LLUVIA ÁCIDA', 'green', 'Busquen techo: el cielo quema'), sound('minecraft:weather.rain.above', 1, 0.6)],
    tick: () => [exposed('effect give @s minecraft:wither 5 1 true'), exposed('effect give @s minecraft:poison 4 1 true')],
    end: () => ['weather clear'] },
  { id: 'tormenta', name: 'Tormenta eléctrica', minEra: 1, weight: 2, durationMin: 3,
    desc: 'Tormenta eléctrica de 3 minutos: rayos naturales y creepers cargados posibles. Mejor no estar en lo alto.',
    start: () => ['weather thunder', ...title('TORMENTA', 'dark_aqua', 'Los rayos buscan lo más alto')],
    end: () => ['weather clear'] },
  { id: 'viento', name: 'Viento favorable', minEra: 1, weight: 3, durationMin: 0,
    desc: 'Viento favorable: todos corren y saltan más durante 3 minutos.',
    start: () => [`effect give ${SV} minecraft:speed 180 0 true`, `effect give ${SV} minecraft:jump_boost 180 0 true`, ...title('VIENTO FAVORABLE', 'aqua', 'Tres minutos con el viento a favor')] },
  { id: 'viento_contra', name: 'Viento en contra', minEra: 1, weight: 2, durationMin: 0,
    desc: 'Viento en contra: quien esté a cielo abierto camina lento 90 segundos.',
    start: () => [exposed('effect give @s minecraft:slowness 90 1 true'), exposed('effect give @s minecraft:weakness 60 0 true'), sound('minecraft:item.elytra.flying', 0.6, 0.6), ...title('VIENTO EN CONTRA', 'gray', 'Cada paso cuesta el doble')] },
  { id: 'neblina', name: 'Neblina', minEra: 1, weight: 2, durationMin: 0, day: true,
    desc: 'Neblina espesa: quien esté afuera ve poco y avanza despacio un minuto.',
    start: () => [exposed('effect give @s minecraft:blindness 25 0 true'), exposed('effect give @s minecraft:slowness 60 1 true'), 'execute as @a at @s run particle minecraft:cloud ~ ~1 ~ 4 1 4 0.01 150', ...title('NEBLINA', 'white', 'No se ve ni la propia mano')] },
  { id: 'ola_calor', name: 'Ola de calor', minEra: 1, weight: 2, durationMin: 0, day: true,
    desc: 'Ola de calor: quien esté al sol se cansa (hambre y debilidad 40 segundos). A la sombra.',
    start: () => [exposed('effect give @s minecraft:hunger 60 2 true'), exposed('effect give @s minecraft:weakness 60 1 true'), exposed('effect give @s minecraft:mining_fatigue 40 0 true'), ...title('OLA DE CALOR', 'gold', 'El sol pega fuerte en la plaza')] },
  { id: 'helada', name: 'Helada', minEra: 1, weight: 2, durationMin: 0,
    desc: 'Helada repentina: quien esté a la intemperie queda entumido 90 segundos.',
    start: () => [exposed('effect give @s minecraft:slowness 90 2 true'), exposed('effect give @s minecraft:mining_fatigue 60 1 true'), exposed('effect give @s minecraft:weakness 60 0 true'), 'execute as @a at @s run particle minecraft:snowflake ~ ~2 ~ 5 2 5 0.02 250', ...title('HELADA', 'aqua', 'Se congelan hasta las ideas')] },
  { id: 'sol_bendito', name: 'Sol bendito', minEra: 1, weight: 2, durationMin: 0, day: true,
    desc: 'Sol bendito: quien esté al sol se cura poco a poco 30 segundos.',
    start: () => [exposed('effect give @s minecraft:regeneration 30 0 true'), exposed('particle minecraft:happy_villager ~ ~1 ~ 1 1 1 0 20'), ...title('SOL BENDITO', 'yellow', 'Un rayo tibio que sana')] },
  { id: 'buena_racha', name: 'Buena racha', minEra: 1, weight: 2, durationMin: 0,
    desc: 'Buena racha: suerte y manos rápidas para todos durante 2 minutos.',
    start: () => [`effect give ${SV} minecraft:luck 120 0 true`, `effect give ${SV} minecraft:haste 120 0 true`, ...title('BUENA RACHA', 'green', 'Hoy todo sale a la primera')] },
  { id: 'animo', name: 'Ánimo del pueblo', minEra: 1, weight: 2, durationMin: 0,
    desc: 'Ánimo del pueblo: corazones extra (absorción) durante 2 minutos.',
    start: () => [`effect give ${SV} minecraft:absorption 120 1 true`, ...title('ÁNIMO DEL PUEBLO', 'gold', 'La plaza los aplaude')] },
  { id: 'mal_estomago', name: 'Mal de estómago', minEra: 1, weight: 2, durationMin: 0,
    desc: 'Mal de estómago: hambre fuerte y mareo un minuto. Buen momento para comprarle comida al vecino.',
    start: () => [`effect give ${SV} minecraft:hunger 60 2 true`, `effect give ${SV} minecraft:nausea 12 0 true`, ...title('MAL DE ESTÓMAGO', 'gold', 'Algo cayó mal en la plaza')] },
  { id: 'temblor', name: 'Temblor', minEra: 1, weight: 2, durationMin: 0,
    desc: 'Temblor: el suelo se mueve unos segundos y todo da vueltas.',
    start: () => [`effect give ${SV} minecraft:nausea 12 0 true`, `effect give ${SV} minecraft:mining_fatigue 30 1 true`, `effect give ${SV} minecraft:slowness 8 2 true`, sound('minecraft:block.deepslate.break', 1, 0.5), sound('minecraft:entity.iron_golem.hurt', 0.4, 0.5), ...title('TEMBLOR', 'dark_red', 'La tierra tose')] },
  { id: 'murcielagos', name: 'Nube de murciélagos', minEra: 1, weight: 2, durationMin: 0,
    desc: 'Una nube de murciélagos sale de alguna cueva y pasa volando (inofensivos).',
    start: () => [inOW('summon minecraft:bat ~ ~2 ~'), inOW('summon minecraft:bat ~1 ~2 ~'), inOW('summon minecraft:bat ~ ~2 ~1'), inOW('summon minecraft:bat ~-1 ~2 ~'), sound('minecraft:entity.bat.takeoff', 1, 0.8), ...title('MURCIÉLAGOS', 'dark_gray', 'Algo salió de la cueva')] },
  { id: 'plaga', name: 'Plaga de lepismas', minEra: 1, weight: 1, durationMin: 0,
    desc: 'Plaga: salen lepismas del suelo cerca de cada jugador.',
    start: ctx => [...[0, 1, 2, 3, 4, 5].map(i => ringAt(Math.round(RING[i][0] / 2), Math.round(RING[i][1] / 2), `summon minecraft:silverfish ~ ~ ~ ${mobNbt('silverfish')}`)), ...tough(120), ...(ctx.era >= 4 ? [ringAt(-3, 4, `summon minecraft:silverfish ~ ~ ~ ${mobNbt('silverfish')}`)] : []), ...title('PLAGA', 'gray', 'Algo se mueve entre las piedras')] },
  { id: 'fiesta', name: 'Fiesta en la plaza', minEra: 1, weight: 1, durationMin: 0,
    desc: 'Fuegos artificiales sobre cada jugador: alguien está celebrando algo.',
    start: () => [...fireworks([16711680, 16776960, 65535]), ...title('¡FIESTA!', 'light_purple', 'Nadie sabe qué se celebra')] },
  { id: 'chisme', name: 'Chisme de plaza', minEra: 1, weight: 2, durationMin: 0,
    desc: 'El Pregonero suelta un chisme jugoso sobre los Estados (inventado con lo que ha visto en el chat y la economía).',
    start: () => [sound('minecraft:entity.villager.ambient', 1, 1.3)] },
  { id: 'luna_sangre', name: 'Luna de sangre', minEra: 1, weight: 2, durationMin: 6, tickSec: 60, night: true,
    desc: 'LUNA DE SANGRE durante 6 minutos: es medianoche, hay tormenta y cada minuto llega una horda de 30 monstruos blindados repartida entre los jugadores (zombis con espada, esqueletos con arco, jinetes araña, creepers, brujas). No se queman. Peleen juntos o atrincherénse.',
    start: ctx => [
      'time set 18000', 'weather thunder',
      ...title('LUNA DE SANGRE', 'dark_red', 'Esto es un acabose'),
      sound('minecraft:entity.wither.spawn', 0.7, 0.6), sound('minecraft:entity.warden.heartbeat', 1, 0.6),
      `effect give ${SV} minecraft:darkness 6 0 true`,
      'execute as @a at @s run particle minecraft:dust{color:[0.8,0.0,0.0],scale:2.5} ~ ~8 ~ 10 4 10 0 400',
      ...horde(ctx.era, perPlayer(ctx, BLOOD_HORDE), 0, 2, bloodMobs(ctx.era)),
      jockey(-14, 5),
      ...tough(), buffMobs('speed', 400)
    ],
    tick: async (ctx, n) => (await tooMany(ctx) ? [say('La horda se reagrupa… (ya hay demasiados monstruos vivos)')] : [
      ...horde(ctx.era, perPlayer(ctx, BLOOD_HORDE), n * 5, 2, bloodMobs(ctx.era)),
      ...(n % 3 === 1 ? [jockey(12, -9)] : []),
      ...(n % 4 === 2 ? [spawn('witch', -11, -10, 0)] : []),
      'execute as @a at @s run particle minecraft:dust{color:[0.8,0.0,0.0],scale:2.5} ~ ~8 ~ 10 4 10 0 150',
      sound('minecraft:entity.warden.heartbeat', 0.8, 0.6),
      ...tough(), buffMobs('speed', 400)
    ]),
    end: () => ['weather clear', say('La luna vuelve a su color… pero los que quedan vivos siguen rondando, y con casco no se queman.')] },
  { id: 'aranas', name: 'Enjambre de arañas', minEra: 1, weight: 2, durationMin: 0, night: true,
    desc: 'Un enjambre de arañas baja del bosque hacia quienes estén afuera.',
    start: ctx => [...[0, 2, 4, 6].map(i => ringAt(RING[i][0], RING[i][1], `summon minecraft:${ctx.era >= 3 ? 'cave_spider' : 'spider'} ~ ~ ~ ${mobNbt('spider')}`)), ...tough(), sound('minecraft:entity.spider.ambient', 1, 0.7), ...title('ARAÑAS', 'dark_red', 'Ocho patas, muchas ganas')] },
  { id: 'silbido', name: 'Silbido en la oscuridad', minEra: 1, weight: 2, durationMin: 0, night: true,
    desc: 'Se oye un silbido… dos creepers andan sueltos cerca de cada uno.',
    start: () => [ringAt(14, 6, `summon minecraft:creeper ~ ~ ~ ${mobNbt('creeper')}`), ringAt(-12, -7, `summon minecraft:creeper ~ ~ ~ ${mobNbt('creeper')}`), ...tough(), sound('minecraft:entity.creeper.primed', 0.8, 0.7), ...title('SSSSS…', 'green', '¿Escucharon eso?')] },
  { id: 'francotiradores', name: 'Francotiradores', minEra: 1, weight: 2, durationMin: 0, night: true,
    desc: 'Tres esqueletos reforzados se apostaron cerca de cada jugador que esté afuera.',
    start: () => [ringAt(13, -3, `summon minecraft:skeleton ~ ~ ~ ${mobNbt('skeleton')}`), ringAt(-12, 5, `summon minecraft:skeleton ~ ~ ~ ${mobNbt('skeleton')}`), ringAt(2, 14, `summon minecraft:skeleton ~ ~ ~ ${mobNbt('skeleton')}`), ...tough(), sound('minecraft:entity.skeleton.ambient', 1, 0.8), ...title('FRANCOTIRADORES', 'white', 'Cuidado con las flechas')] },
  { id: 'bruja', name: 'La bruja del pantano', minEra: 1, weight: 1, durationMin: 0, night: true,
    desc: 'Una bruja apareció cerca de alguien. Sus pociones duelen.',
    start: () => ['execute as @r[gamemode=!spectator,gamemode=!creative] at @s if dimension minecraft:overworld positioned ~11 ~ ~7 positioned over motion_blocking_no_leaves run summon minecraft:witch ~ ~ ~ ' + mobNbt('witch'), sound('minecraft:entity.witch.celebrate', 1, 1), ...title('UNA BRUJA', 'dark_purple', 'Se ríe entre los árboles')] },
  { id: 'estrella', name: 'Estrella fugaz', minEra: 1, weight: 2, durationMin: 0, night: true,
    desc: 'Pasa una estrella fugaz: todos reciben un poco de experiencia (10 puntos).',
    start: () => ['xp add @a 10 points', 'execute as @a at @s run particle minecraft:end_rod ~ ~20 ~ 8 1 8 0.05 80', sound('minecraft:entity.firework_rocket.twinkle_far', 1, 1.4), ...title('ESTRELLA FUGAZ', 'yellow', 'Pidan un deseo (pequeño)')] },
  { id: 'luciernagas', name: 'Noche de luciérnagas', minEra: 1, weight: 2, durationMin: 0, night: true,
    desc: 'Luciérnagas por todas partes: visión nocturna 90 segundos.',
    start: () => [`effect give ${SV} minecraft:night_vision 90 0 true`, 'execute as @a at @s run particle minecraft:glow ~ ~1 ~ 6 2 6 0.02 200', ...title('LUCIÉRNAGAS', 'yellow', 'La noche se ilumina sola')] },

  /* ===================== ERA II · Raíces ===================== */
  { id: 'primavera', name: 'Primavera adelantada', minEra: 2, weight: 2, durationMin: 4, ...tickRuleEvent(3, 'Primavera'),
    desc: 'Primavera adelantada: durante 4 minutos todo crece el triple de rápido (cultivos, árboles, pasto).' },
  { id: 'sequia', name: 'Sequía', minEra: 2, weight: 1, durationMin: 5, ...tickRuleEvent(0.34, 'Sequía'),
    desc: 'Sequía: durante 5 minutos todo crece mucho más lento. Buen momento para comprar comida hecha.' },
  { id: 'caminantes', name: 'Caminantes del desierto', minEra: 2, weight: 2, durationMin: 0,
    desc: 'Husks que no se queman al sol vienen caminando hacia quienes estén afuera.',
    start: ctx => [...[0, 3, 5].slice(0, 2 + (ctx.era >= 5 ? 1 : 0)).map(i => ringAt(RING[i][0], RING[i][1], `summon minecraft:husk ~ ~ ~ ${mobNbt('husk')}`)), ...title('CAMINANTES', 'gold', 'Vienen del desierto, de día')] },
  { id: 'zombis_aldeanos', name: 'Aldeanos perdidos', minEra: 2, weight: 1, durationMin: 0, night: true,
    desc: 'Aparecen aldeanos zombi cerca. En la ERA V se pueden curar y censar.',
    start: () => [ringAt(10, 8, `summon minecraft:zombie_villager ~ ~ ~ ${mobNbt('zombie_villager')}`), ringAt(-11, -6, `summon minecraft:zombie_villager ~ ~ ~ ${mobNbt('zombie_villager')}`), ...title('ALDEANOS PERDIDOS', 'dark_green', 'Gimen algo sobre una aldea')] },
  { id: 'estampida', name: 'Estampida de la noche', minEra: 2, weight: 1, durationMin: 0, night: true,
    desc: 'Una horda grande llega de golpe cerca de quienes estén afuera.',
    start: ctx => [...horde(ctx.era, hordeSize(ctx.era) + 2), ...tough(), buffMobs('speed', 120), sound('minecraft:event.raid.horn', 0.6, 1.2), ...title('ESTAMPIDA', 'red', '¡Corran o peleen!')] },

  /* ===================== ERA III · Cobre y rieles ===================== */
  { id: 'veta_dorada', name: 'Veta dorada', minEra: 3, weight: 2, durationMin: 0,
    desc: 'Veta dorada: quien esté minando bajo tierra (Y menor a 40) pica más rápido 3 minutos.',
    start: () => [under('effect give @s minecraft:haste 180 1 true'), ...title('VETA DORADA', 'yellow', 'Las minas cantan: piquen ya')] },
  { id: 'derrumbe', name: 'Derrumbe', minEra: 3, weight: 1, durationMin: 0,
    desc: 'Derrumbe: quien esté bajo tierra queda aturdido (minería lenta y oscuridad breve).',
    start: () => [under('effect give @s minecraft:mining_fatigue 60 1 true'), under('effect give @s minecraft:darkness 8 0 true'), under('playsound minecraft:block.gravel.break master @s ~ ~ ~ 1 0.5'), ...title('DERRUMBE', 'dark_gray', 'Cayó parte del túnel')] },
  { id: 'gas', name: 'Bolsa de gas', minEra: 3, weight: 1, durationMin: 0,
    desc: 'Bolsa de gas en las minas: mareo y veneno leve para quien esté bajo tierra.',
    start: () => [under('effect give @s minecraft:nausea 10 0 true'), under('effect give @s minecraft:poison 5 0 true'), under('particle minecraft:entity_effect{color:[0.4,0.8,0.2,1.0]} ~ ~1 ~ 2 1 2 0 60'), ...title('GAS', 'green', 'Huele raro aquí abajo')] },
  { id: 'chispas', name: 'Chispas del cobre', minEra: 3, weight: 1, durationMin: 0,
    desc: 'El cobre zumba en el aire: velocidad y salto para todos 2 minutos.',
    start: () => [`effect give ${SV} minecraft:speed 120 1 true`, 'execute as @a at @s run particle minecraft:electric_spark ~ ~1 ~ 2 1 2 0.2 120', ...title('CHISPAS', 'gold', 'El aire huele a cobre')] },

  /* ===================== ERA IV · El Nether ===================== */
  { id: 'cielo_inquieto', name: 'Cielo inquieto', minEra: 4, weight: 2, durationMin: 0, night: true,
    desc: 'Cielo inquieto: bajan phantoms sobre quienes estén afuera esta noche.',
    start: () => [ringAt(0, 0, `summon minecraft:phantom ~ ~22 ~ ${mobNbt('phantom')}`), sound('minecraft:entity.phantom.ambient', 1, 0.8), ...title('CIELO INQUIETO', 'dark_purple', 'Algo aletea sobre ustedes')] },
  { id: 'bendicion_ignea', name: 'Bendición ígnea', minEra: 4, weight: 2, durationMin: 0,
    desc: 'Quien esté en el Nether recibe resistencia al fuego 3 minutos.',
    start: () => [inNether('effect give @s minecraft:fire_resistance 180 0 true'), ...title('BENDICIÓN ÍGNEA', 'gold', 'El Nether los perdona un rato')] },
  { id: 'ghast', name: 'Ghast errante', minEra: 4, weight: 1, durationMin: 0,
    desc: 'Un ghast llorón aparece cerca de quien esté en el Nether.',
    start: () => [inNether(`summon minecraft:ghast ~14 ~8 ~6 ${mobNbt('ghast')}`), inNether('playsound minecraft:entity.ghast.scream master @s ~ ~ ~ 1 0.8'), ...title('GHAST ERRANTE', 'white', 'Llora como si le debieran plata')] },
  { id: 'humo_infernal', name: 'Humo infernal', minEra: 4, weight: 1, durationMin: 0,
    desc: 'Sale humo del Nether por los portales: quien esté allá ve poco unos segundos.',
    start: () => [inNether('effect give @s minecraft:darkness 12 0 true'), inNether('particle minecraft:large_smoke ~ ~1 ~ 3 1 3 0.02 150'), ...title('HUMO INFERNAL', 'dark_red', 'Algo arde allá abajo')] },

  /* ===================== ERA V · Ciudadanía ===================== */
  { id: 'comerciante', name: 'Mercader errante', minEra: 5, weight: 2, durationMin: 0,
    desc: 'Llegó un mercader errante cerca de un jugador. Comerciar con él cuenta como comercio con aldeanos.',
    start: () => ['execute as @r[gamemode=!spectator] at @s if dimension minecraft:overworld positioned ~6 ~ ~6 positioned over motion_blocking_no_leaves run summon minecraft:wandering_trader ~ ~ ~', ...title('MERCADER ERRANTE', 'aqua', 'Alguien llegó con mercancía rara')] },
  { id: 'patrulla', name: 'Patrulla de saqueadores', minEra: 5, weight: 1, durationMin: 0,
    desc: 'Una patrulla de saqueadores ronda cerca de un jugador.',
    start: ctx => [
      `execute as @r[gamemode=!spectator] at @s if dimension minecraft:overworld positioned ~22 ~ ~8 positioned over motion_blocking_no_leaves run summon minecraft:pillager ~ ~ ~ ${mobNbt('pillager')}`,
      `execute as @r[gamemode=!spectator] at @s if dimension minecraft:overworld positioned ~23 ~ ~10 positioned over motion_blocking_no_leaves run summon minecraft:pillager ~ ~ ~ ${mobNbt('pillager')}`,
      `execute as @r[gamemode=!spectator] at @s if dimension minecraft:overworld positioned ~21 ~ ~11 positioned over motion_blocking_no_leaves run summon minecraft:${ctx.era >= 7 ? 'vindicator' : 'pillager'} ~ ~ ~ ${mobNbt(ctx.era >= 7 ? 'vindicator' : 'pillager')}`,
      sound('minecraft:event.raid.horn', 0.7, 1), ...title('SAQUEADORES', 'red', 'Se oye un cuerno a lo lejos')] },
  { id: 'feria', name: 'Día de feria', minEra: 5, weight: 2, durationMin: 0,
    desc: 'Día de feria: todos son "Héroes de la aldea" 5 minutos (descuentos con aldeanos).',
    start: () => [`effect give ${SV} minecraft:hero_of_the_village 300 0 true`, ...fireworks([16776960, 65280], 2), ...title('DÍA DE FERIA', 'green', 'Los aldeanos están de buenas')] },
  { id: 'asedio_zombi', name: 'Asedio zombi', minEra: 5, weight: 1, durationMin: 5, tickSec: 60, night: true,
    desc: 'Asedio zombi de 5 minutos: llegan oleadas de zombis y aldeanos zombi. Protejan a sus aldeanos.',
    start: ctx => [...horde(Math.min(ctx.era, 2), hordeSize(ctx.era) + 1), ringAt(4, 13, `summon minecraft:zombie_villager ~ ~ ~ ${mobNbt('zombie_villager')}`), sound('minecraft:entity.zombie.ambient', 1, 0.6), ...title('ASEDIO ZOMBI', 'dark_green', 'Cierren las puertas')],
    tick: (ctx, n) => horde(Math.min(ctx.era, 2), 2, n) },

  /* ===================== ERA VI · Gremios y mercados ===================== */
  { id: 'saber', name: 'Viento de saber', minEra: 6, weight: 2, durationMin: 0,
    desc: 'Viento de saber: todos reciben 30 puntos de experiencia.',
    start: () => ['xp add @a 30 points', 'execute as @a at @s run particle minecraft:enchant ~ ~1 ~ 1 1 1 0.6 120', ...title('VIENTO DE SABER', 'light_purple', 'Las letras flotan en el aire')] },
  { id: 'festival_gremial', name: 'Festival gremial', minEra: 6, weight: 1, durationMin: 0,
    desc: 'Festival de los gremios: fuegos artificiales, ánimo y descuentos con aldeanos 3 minutos.',
    start: () => [`effect give ${SV} minecraft:hero_of_the_village 180 0 true`, `effect give ${SV} minecraft:absorption 180 0 true`, ...fireworks([16753920, 16711935, 65535], 4), ...title('FESTIVAL GREMIAL', 'gold', 'Hoy no se trabaja (mentira)')] },

  /* ===================== ERA VII · Industria ===================== */
  { id: 'apagon', name: 'Apagón', minEra: 7, weight: 1, durationMin: 0,
    desc: 'Apagón: oscuridad para todos 15 segundos, como si se cayera la red de redstone.',
    start: () => [`effect give ${SV} minecraft:darkness 15 0 true`, sound('minecraft:block.beacon.deactivate', 1, 0.6), ...title('APAGÓN', 'dark_gray', 'Se fue la luz en todo Miscolandia')] },
  { id: 'vindicadores', name: 'Emboscada', minEra: 7, weight: 1, durationMin: 0,
    desc: 'Emboscada: vindicadores aparecen cerca de quienes estén afuera.',
    start: () => [ringAt(12, 4, `summon minecraft:vindicator ~ ~ ~ ${mobNbt('vindicator')}`), ringAt(-11, -7, `summon minecraft:vindicator ~ ~ ~ ${mobNbt('vindicator')}`), sound('minecraft:entity.vindicator.celebrate', 1, 0.8), ...title('EMBOSCADA', 'red', 'Hachas entre los árboles')] },

  /* ===================== ERA VIII · El Océano ===================== */
  { id: 'corriente', name: 'Corriente favorable', minEra: 8, weight: 2, durationMin: 0,
    desc: 'Corriente favorable: nado rápido y respiración bajo el agua 3 minutos.',
    start: () => [`effect give ${SV} minecraft:dolphins_grace 180 0 true`, `effect give ${SV} minecraft:water_breathing 180 0 true`, ...title('CORRIENTE FAVORABLE', 'aqua', 'El mar los empuja')] },
  { id: 'bendicion_mar', name: 'Bendición del mar', minEra: 8, weight: 1, durationMin: 0,
    desc: 'Bendición del mar: poder del conducto 3 minutos (ver, respirar y picar rápido bajo el agua).',
    start: () => [`effect give ${SV} minecraft:conduit_power 180 0 true`, ...title('BENDICIÓN DEL MAR', 'dark_aqua', 'El océano los adopta')] },
  { id: 'ahogados', name: 'Marea de ahogados', minEra: 8, weight: 1, durationMin: 0, night: true,
    desc: 'Suben ahogados cerca de quienes estén afuera.',
    start: () => [ringAt(10, 5, `summon minecraft:drowned ~ ~ ~ ${mobNbt('drowned')}`), ringAt(-9, 8, `summon minecraft:drowned ~ ~ ~ ${mobNbt('drowned')}`), ringAt(5, -11, `summon minecraft:drowned ~ ~ ~ ${mobNbt('drowned')}`), ...title('MAREA DE AHOGADOS', 'dark_aqua', 'Salen del agua caminando')] },

  /* ===================== ERA IX · Las Profundidades ===================== */
  { id: 'bruma', name: 'Bruma profunda', minEra: 9, weight: 1, durationMin: 0, night: true,
    desc: 'Bruma profunda: oscuridad de 30 segundos en el Overworld, como si el Warden respirara cerca.',
    start: () => [inOW('effect give @s minecraft:darkness 30 0 true'), sound('minecraft:entity.warden.heartbeat', 1, 0.8), ...title('BRUMA PROFUNDA', 'dark_gray', 'Algo late bajo la tierra')] },
  { id: 'latido', name: 'El latido', minEra: 9, weight: 1, durationMin: 0,
    desc: 'Quien esté bajo tierra siente el latido del Warden: oscuridad y lentitud breve.',
    start: () => [under('effect give @s minecraft:darkness 15 0 true'), under('effect give @s minecraft:slowness 15 0 true'), under('playsound minecraft:entity.warden.heartbeat master @s ~ ~ ~ 1 0.7'), ...title('EL LATIDO', 'dark_aqua', 'No hagan ruido')] },
  { id: 'esqueletos_helados', name: 'Esqueletos del frío', minEra: 9, weight: 1, durationMin: 0, night: true,
    desc: 'Esqueletos helados y del pantano aparecen cerca de quienes estén afuera.',
    start: () => [ringAt(12, -4, `summon minecraft:stray ~ ~ ~ ${mobNbt('stray')}`), ringAt(-10, 9, `summon minecraft:bogged ~ ~ ~ ${mobNbt('bogged')}`), ...title('ESQUELETOS DEL FRÍO', 'aqua', 'Flechas que congelan')] },

  /* ===================== ERA X · Soberanía ===================== */
  { id: 'desfile', name: 'Desfile nacional', minEra: 10, weight: 1, durationMin: 0,
    desc: 'Desfile nacional: fuegos artificiales y velocidad para todos 2 minutos.',
    start: () => [`effect give ${SV} minecraft:speed 120 0 true`, ...fireworks([255, 65280, 16711680, 16777215], 6), ...title('DESFILE NACIONAL', 'gold', 'Banderas al viento')] },
  { id: 'cumbre', name: 'Rumor de cumbre', minEra: 10, weight: 1, durationMin: 0,
    desc: 'El Pregonero "filtra" que habrá una cumbre secreta entre los Estados (chisme inventado).',
    start: () => [sound('minecraft:block.note_block.bell', 1, 0.8)] },

  /* ===================== ERA XI · El End ===================== */
  { id: 'aurora', name: 'Aurora del End', minEra: 11, weight: 2, durationMin: 0, night: true,
    desc: 'Aurora del End: visión nocturna 4 minutos y destellos en el cielo.',
    start: () => [`effect give ${SV} minecraft:night_vision 240 0 true`, 'execute as @a at @s run particle minecraft:end_rod ~ ~12 ~ 6 2 6 0.02 200', ...title('AURORA DEL END', 'light_purple', 'El cielo se abre por unos minutos')] },
  { id: 'visitantes_end', name: 'Visitantes del End', minEra: 11, weight: 1, durationMin: 0, night: true,
    desc: 'Endermans curiosos aparecen cerca. No los miren a los ojos.',
    start: () => [ringAt(9, 9, `summon minecraft:enderman ~ ~ ~ ${mobNbt('enderman')}`), ringAt(-12, 3, `summon minecraft:enderman ~ ~ ~ ${mobNbt('enderman')}`), ...title('VISITANTES', 'dark_purple', 'No los miren')] },
  { id: 'gravedad', name: 'Gravedad caprichosa', minEra: 11, weight: 1, durationMin: 0,
    desc: 'La gravedad se distrae: todos flotan 3 segundos y caen suave.',
    start: () => [`effect give ${SV} minecraft:levitation 3 0 true`, `effect give ${SV} minecraft:slow_falling 15 0 true`, ...title('GRAVEDAD CAPRICHOSA', 'light_purple', 'Agárrense de algo')] },

  /* ===================== ERA XII · Edad de Oro ===================== */
  { id: 'edad_dorada', name: 'Bendición dorada', minEra: 12, weight: 1, durationMin: 0,
    desc: 'Bendición dorada: regeneración y corazones extra 2 minutos.',
    start: () => [`effect give ${SV} minecraft:regeneration 60 0 true`, `effect give ${SV} minecraft:absorption 120 2 true`, ...fireworks([16766720], 3), ...title('BENDICIÓN DORADA', 'gold', 'Miscolandia brilla')] },
  { id: 'gran_asedio', name: 'Gran asedio', minEra: 12, weight: 1, durationMin: 6, tickSec: 60, night: true,
    desc: 'Gran asedio de 6 minutos: oleadas de los peores monstruos. Junten a los tres.',
    start: ctx => [...horde(ctx.era, hordeSize(ctx.era) + 2), ...tough(), sound('minecraft:event.raid.horn', 1, 0.6), ...title('GRAN ASEDIO', 'dark_red', 'Defiendan la capital')],
    tick: (ctx, n) => [...horde(ctx.era, 2, n), ...tough()] },

  /* ===================== ERA XIII · Leyenda ===================== */
  { id: 'prueba_leyenda', name: 'Prueba de leyenda', minEra: 13, weight: 1, durationMin: 0, night: true,
    desc: 'Prueba de leyenda: esqueletos wither con fuerza aparecen cerca de cada jugador.',
    start: () => [ringAt(11, 5, `summon minecraft:wither_skeleton ~ ~ ~ ${mobNbt('wither_skeleton')}`), ringAt(-10, -8, `summon minecraft:wither_skeleton ~ ~ ~ ${mobNbt('wither_skeleton')}`), ...tough(), ...title('PRUEBA DE LEYENDA', 'dark_gray', 'Solo los grandes la pasan')] },

  /* ===================== Solo programados a mano (no salen en el sorteo) ===================== */
  { id: 'furia_pregonero', name: 'La furia del Pregonero', minEra: 99, weight: 0, durationMin: 4, tickSec: 50,
    desc: 'El Pregonero se hartó de que no le hagan caso y les mandó una horda durante 4 minutos. Defiéndanse juntos.',
    start: () => [
      ...title('EL PREGONERO SE ENOJÓ', 'light_purple', 'y les mandó una horda'),
      sound('minecraft:event.raid.horn', 0.9, 0.8),
      ringAt(10, 4, `summon minecraft:husk ~ ~ ~ ${mobNbt('husk')}`),
      ringAt(-9, 7, `summon minecraft:husk ~ ~ ~ ${mobNbt('husk')}`),
      ringAt(6, -10, `summon minecraft:spider ~ ~ ~ ${mobNbt('spider')}`),
      ringAt(-8, -8, `summon minecraft:zombie ~ ~ ~ ${mobNbt('zombie')}`),
      buffMobs('fire_resistance', 600)
    ],
    tick: (ctx, n) => [
      n % 2 ? ringAt(-11, 3, `summon minecraft:husk ~ ~ ~ ${mobNbt('husk')}`) : ringAt(8, 9, `summon minecraft:zombie ~ ~ ~ ${mobNbt('zombie')}`),
      ...(n === 3 ? [ringAt(12, -5, `summon minecraft:vindicator ~ ~ ~ ${mobNbt('vindicator')}`)] : []),
      buffMobs('fire_resistance', 600)
    ],
    end: () => ['tellraw @a {"text":"[Pregonero] Ya, ya, se me pasó. Pero que conste que me deben una disculpa.","color":"light_purple"}'] }
];

const DEFAULTS = { enabled: true, slotMinutes: 30, chancePct: 35, minGapMinutes: 40 };

export class WorldEvents {
  constructor({ cfg, bridge, rcon, enforcer, memory, statePath }) {
    this.cfg = cfg;
    this.bridge = bridge;
    this.rcon = rcon;
    this.enforcer = enforcer;
    this.memory = memory;
    this.opts = { ...DEFAULTS, ...(cfg.events || {}) };
    this.enabled = this.opts.enabled !== false;
    this.statePath = statePath;
    this.saved = this.load();
    this.active = null; // { ev, endsAt, ticks, nextTickAt, ctx }
    this.timer = null;
  }

  load() {
    try { if (fs.existsSync(this.statePath)) return JSON.parse(fs.readFileSync(this.statePath, 'utf8')); } catch {}
    return { lastSlotKey: '', lastEndAt: 0, history: [] };
  }
  save() {
    try { fs.writeFileSync(this.statePath, JSON.stringify(this.saved, null, 2), 'utf8'); } catch (err) { console.warn('[Eventos]', err.message); }
  }

  // La "clave dinámica" de una franja: número de 32 bits derivado de mundo + fecha + franja
  slotInfo(now = Date.now()) {
    const slotMs = this.opts.slotMinutes * 60_000;
    const slot = Math.floor(now / slotMs);
    const d = new Date(slot * slotMs);
    const dateTxt = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const slotKey = `${this.bridge.cfg?.worldId || 'main'}|${dateTxt}|${slot}`;
    const hash = crypto.createHash('sha256').update(slotKey).digest();
    const roll = hash.readUInt32BE(0) % 100;                         // ¿hay evento?
    const offset = hash.readUInt32BE(4) % Math.floor(slotMs * 0.8);  // ¿a qué minuto?
    const pick = hash.readUInt32BE(8);                               // ¿cuál?
    return { slotKey, slotStart: slot * slotMs, startAt: slot * slotMs + offset, roll, pick, happens: roll < this.opts.chancePct };
  }

  async eraIndex() {
    const row = await this.bridge.fetchWorld(false);
    if (row.id === 'local-fallback') return null; // sin datos reales no se sabe la era: no hay eventos
    return this.bridge.getCurrentEra(row.state).index;
  }

  async timeOfDay() {
    try {
      const res = await this.rcon.send('time query daytime');
      const t = Number((String(res).match(/(\d+)/) || [])[1]);
      if (!Number.isFinite(t)) return 'unknown';
      return t >= 13000 && t <= 23000 ? 'night' : 'day';
    } catch { return 'unknown'; }
  }

  static eligibleFor(era, tod) {
    return WORLD_EVENTS.filter(e => e.weight > 0 && e.minEra <= era
      && (!e.night || tod === 'night') && (!e.day || tod === 'day'));
  }

  choose(list, pick) {
    const total = list.reduce((a, e) => a + e.weight, 0);
    let r = pick % total;
    for (const e of list) { if ((r -= e.weight) < 0) return e; }
    return list[0];
  }

  async run(cmds) {
    for (const c of (cmds || [])) {
      try {
        const res = await this.rcon.send(c);
        if (/Unknown|Incorrect argument|Invalid|Expected/i.test(String(res || ''))) console.warn('[Eventos] el servidor rechazó:', c.slice(0, 90), '→', String(res).slice(0, 120));
      } catch (err) { console.warn('[Eventos] comando falló:', c.slice(0, 80), err.message); }
    }
  }

  async startEvent(ev, by = 'clave dinámica') {
    const era = (await this.eraIndex().catch(() => null)) ?? 1;
    const ctx = { era, rcon: this.rcon, data: {}, players: Math.max(1, this.enforcer?.onlinePlayers?.size || 1) };
    this.active = { ev, ctx, endsAt: Date.now() + (ev.durationMin || 0) * 60_000, ticks: 0, nextTickAt: Date.now() + (ev.tickSec || 0) * 1000 };
    console.log(`[Eventos] Inicia "${ev.name}" (${by}, era ${era}).`);
    // Un evento nocturno programado o forzado de día: primero se oscurece el cielo
    if (ev.night && (await this.timeOfDay()) === 'day') {
      await this.run(['time set 18000', say('El cielo se oscurece de golpe, como si alguien hubiera apagado el sol…', 'dark_gray')]);
    }
    await this.rcon.tellraw('@a', ['', { text: '[Evento] ', color: 'gold', bold: true }, { text: `${ev.name}: `, color: 'yellow', bold: true }, { text: ev.desc, color: 'white' }]).catch(() => {});
    await this.run(ev.start ? await ev.start(ctx) : []);
    // Si el bot se cae a mitad, al volver deshace lo que haya que deshacer (clima, crecimiento…)
    if (ev.durationMin && ev.end) this.saved.pendingEnd = { id: ev.id, data: ctx.data, era };
    this.memory?.recordEvent('event', `Evento del mundo: ${ev.name} (${ev.desc})`);
    this.saved.history = [...(this.saved.history || []), { at: Date.now(), id: ev.id, by }].slice(-30);
    this.save();
    if (!ev.durationMin) await this.finish(true);
    // Narración del Pregonero (si la IA no responde, no pasa nada)
    generateSocialMessage({ config: this.cfg, kind: 'event', player: 'Miscolandia', role: 'guest', triggerMessage: `${ev.name}. ${ev.desc}`, memoryContext: this.memory?.getPersistentMemoryText?.({ maxSessions: 2, maxNotes: 4 }) || '' })
      .then(msg => msg && this.rcon.tellraw('@a', ['', { text: '[Pregonero] ', color: 'light_purple', bold: true }, { text: msg, color: 'white' }]))
      .catch(() => {});
  }

  async finish(quiet = false) {
    if (!this.active) return;
    const { ev, ctx } = this.active;
    this.active = null;
    if (ev.end) await this.run(await ev.end(ctx));
    delete this.saved.pendingEnd;
    this.saved.lastEndAt = Date.now();
    this.save();
    if (!quiet && ev.durationMin) {
      await this.rcon.tellraw('@a', ['', { text: '[Evento] ', color: 'gold', bold: true }, { text: `Terminó: ${ev.name}.`, color: 'gray' }]).catch(() => {});
    }
  }

  async recoverInterrupted() {
    const p = this.saved.pendingEnd;
    if (!p) return;
    const ev = WORLD_EVENTS.find(e => e.id === p.id);
    delete this.saved.pendingEnd;
    this.save();
    if (ev && ev.end) {
      console.log(`[Eventos] Cerrando "${ev.name}", que quedó a medias por un reinicio.`);
      await this.run(await ev.end({ era: p.era ?? 1, rcon: this.rcon, data: p.data || {} }));
    }
  }

  async loop() {
    try {
      if (this.saved.pendingEnd && !this.active) await this.recoverInterrupted();
      if (this.active) {
        const a = this.active;
        if (Date.now() >= a.endsAt) return await this.finish();
        if (a.ev.tick && a.ev.tickSec && Date.now() >= a.nextTickAt) {
          a.ticks += 1;
          a.nextTickAt = Date.now() + a.ev.tickSec * 1000;
          await this.run(await a.ev.tick(a.ctx, a.ticks));
        }
        return;
      }
      if (!this.enforcer.onlinePlayers.size) return;
      // Eventos programados a mano en moderator-config.json → events.scheduled: [{ "at": "AAAA-MM-DDTHH:MM", "id": "..." }]
      // Corren a su hora aunque los espontáneos estén pausados (hasta 15 min tarde si no había nadie conectado).
      // La lista se relee del archivo en cada vuelta: agregar uno no requiere reiniciar el bot.
      const done = new Set(this.saved.doneScheduled || []);
      let scheduled = this.opts.scheduled || [];
      try {
        const cfgPath = path.join(path.dirname(this.statePath), 'moderator-config.json');
        scheduled = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))?.events?.scheduled || scheduled;
      } catch {}
      for (const sch of scheduled) {
        const at = new Date(sch.at).getTime();
        const key = `${sch.at}|${sch.id}`;
        if (!at || done.has(key) || Date.now() < at || Date.now() - at > 15 * 60_000) continue;
        const ev = WORLD_EVENTS.find(e => e.id === sch.id);
        this.saved.doneScheduled = [...done, key].slice(-50);
        this.save();
        if (ev) return await this.startEvent(ev, `programado ${sch.at}`);
        console.warn(`[Eventos] Programado "${sch.id}" no existe en el catálogo.`);
      }
      if (!this.enabled) return;
      const s = this.slotInfo();
      if (!s.happens || Date.now() < s.startAt || this.saved.lastSlotKey === s.slotKey) return;
      if (Date.now() - (this.saved.lastEndAt || 0) < this.opts.minGapMinutes * 60_000) return;
      this.saved.lastSlotKey = s.slotKey; // esta franja ya se usó (haya o no evento elegible)
      this.save();
      const era = await this.eraIndex();
      if (era === null) return;
      const list = WorldEvents.eligibleFor(era, await this.timeOfDay());
      if (!list.length) return;
      await this.startEvent(this.choose(list, s.pick));
    } catch (err) {
      console.warn('[Eventos]', err.message);
    }
  }

  // Para !evento: cuándo podría tocar el próximo según la clave dinámica
  nextWindows(count = 6) {
    const out = [];
    const slotMs = this.opts.slotMinutes * 60_000;
    for (let i = 0, t = Date.now(); out.length < count && i < 96; i++, t += slotMs) {
      const s = this.slotInfo(t);
      if (s.happens && s.startAt > Date.now() && s.slotKey !== this.saved.lastSlotKey) out.push(s.startAt);
    }
    return out;
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => { this.loop(); }, 15_000);
    const counts = [1, 2, 5, 9].map(e => `${['', 'I', 'II', '', '', 'V', '', '', '', 'IX'][e]}: ${WorldEvents.eligibleFor(e, 'day').length + WorldEvents.eligibleFor(e, 'night').length - WorldEvents.eligibleFor(e, 'unknown').length}`).join(' · ');
    console.log(`[Eventos] ${this.enabled ? 'Activos' : 'Pausados'} · ${WORLD_EVENTS.length} en catálogo (por era → ${counts}) · franjas de ${this.opts.slotMinutes} min, ${this.opts.chancePct}%, pausa ${this.opts.minGapMinutes} min.`);
  }
}
