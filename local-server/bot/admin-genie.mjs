// Consola Admin IA de Miscolandia: interpreta deseos libres (!admin ...)
// desde consola/RCON y los ejecuta en Minecraft Java 26.4 con pasos diferidos y contadores.
// Si un comando falla, lee el error, consulta la sintaxis (help del servidor + Minecraft Wiki) y reintenta.

import fs from 'node:fs';

const BOSSBAR_ID = 'minecraft:admin_timer';

const VALID_TEXT_COLORS = new Set([
  'red', 'gold', 'yellow', 'green', 'aqua', 'blue', 'light_purple', 'dark_purple', 'white', 'gray'
]);

const BOSSBAR_COLOR_MAP = {
  red: 'red',
  gold: 'yellow',
  yellow: 'yellow',
  green: 'green',
  aqua: 'blue',
  blue: 'blue',
  light_purple: 'pink',
  dark_purple: 'purple',
  white: 'white',
  gray: 'white'
};

const CANCEL_RE = /\b(?:cancela|cancelar|aborta|abortar|deten|detén|detener|para|parar|anula|anular)\b.*\b(?:contador|cuenta|cierre|apagado|reinicio|timer|cron[oó]metro)\b|\b(?:cancela|cancelar|aborta)\b\s*$/i;
const SHUTDOWN_WISH_RE = /\b(?:cierr[aeo]|cerrar|cierre|apag[aeou]|apagar|apagado|deten(?:er)?\s+el\s+servidor|stop)\b/i;

const ADMIN_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    resumen: { type: 'string' },
    respuesta_consola: { type: 'string' },
    anuncio_chat: { type: 'string' },
    pasos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['command', 'countdown', 'broadcast', 'cancel_countdown'] },
          delay_sec: { type: 'number' },
          comando: { type: 'string' },
          segundos: { type: 'integer' },
          titulo: { type: 'string' },
          subtitulo: { type: 'string' },
          color: { type: 'string' },
          bossbar: { type: 'boolean' },
          sonido: { type: 'string' },
          mensaje_final: { type: 'string' },
          comandos_finales: {
            type: 'array',
            items: { type: 'string' }
          },
          texto: { type: 'string' },
          pantalla: { type: 'boolean' }
        },
        required: ['tipo']
      }
    }
  },
  required: ['resumen', 'respuesta_consola', 'anuncio_chat', 'pasos']
};

function toSnbtValue(v) {
  if (v === null || v === undefined) return '""';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `[${v.map(toSnbtValue).join(',')}]`;
  if (typeof v === 'object') {
    const entries = Object.entries(v)
      .filter(([, val]) => val !== undefined)
      .map(([k, val]) => `${/^[A-Za-z0-9_]+$/.test(k) ? k : JSON.stringify(k)}:${toSnbtValue(val)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(String(v));
}

function normalizeSnbtQuirks(cmd) {
  let out = cmd;
  // En Minecraft 1.21.5+ / 26.4 custom_name / item_name / lore esperan SNBT {text:...}, no string JSON '{...}'
  out = out.replace(/(minecraft:(?:custom_name|item_name)|(?:custom_name|item_name))=('(\{[^']*\})')/g, (full, key, _quoted, jsonBody) => {
    try {
      return `${key}=${toSnbtValue(JSON.parse(jsonBody))}`;
    } catch {
      return full;
    }
  });
  out = out.replace(/(CustomName):('(\{[^']*\})')/g, (full, key, _quoted, jsonBody) => {
    try {
      return `${key}:${toSnbtValue(JSON.parse(jsonBody))}`;
    } catch {
      return full;
    }
  });
  out = out.replace(/(minecraft:lore|lore)=\[([^\]]*)\]/g, (full, key, body) => {
    const fixedBody = body.replace(/'(\{[^']*\})'/g, (m, jsonBody) => {
      try {
        return toSnbtValue(JSON.parse(jsonBody));
      } catch {
        return m;
      }
    });
    return `${key}=[${fixedBody}]`;
  });
  // En Minecraft Vanilla /effect give <objetivo> <efecto> <segundos> NO lleva sufijo "s" (ej. 10, no 10s)
  out = out.replace(/(\beffect\s+give\s+\S+\s+\S+\s+)(\d+)s\b/gi, '$1$2');
  // Si /title recibe texto suelto sin llaves ni comillas, envuélvelo en SNBT {text:"..."}
  out = out.replace(/^((?:execute\b[\s\S]*?\brun\s+)?title\s+\S+\s+(?:title|subtitle|actionbar)\s+)(?!["'{])(.+)$/i, (_, head, txt) => `${head}${toSnbtValue({ text: txt.trim() })}`);
  // Si el LLM dejó llaves '}' sobrantes al final de SNBT, recórtalas para evitar error de sintaxis
  let open = 0;
  let inStr = null;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (inStr) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
    } else if (ch === '{') {
      open += 1;
    } else if (ch === '}') {
      open -= 1;
    }
  }
  while (open < 0 && out.endsWith('}')) {
    out = out.slice(0, -1);
    open += 1;
  }
  return out;
}

export function sanitizeRconCommand(raw) {
  let cmd = String(raw || '').replace(/[\r\n]+/g, ' ').trim();
  cmd = cmd.replace(/^\/+/, '').trim();
  cmd = normalizeSnbtQuirks(cmd);
  if (!cmd || cmd.length > 1400) return '';
  return cmd;
}

export function extractAdminWish(rawLine, prefix = '!') {
  const txt = String(rawLine || '').trim();
  if (!txt) return null;
  const esc = String(prefix || '!').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = txt.match(new RegExp(`^(?:${esc})?(?:admin|capricho|genio)\\b\\s*(.*)$`, 'i'));
  if (!m) return null;
  return String(m[1] || '').trim();
}

export function parseSecondsFromText(text, fallback = 10) {
  const s = String(text || '').toLowerCase();
  const m = s.match(/(\d{1,3})\s*(?:s|seg|segs|segundo|segundos|m|min|mins|minuto|minutos)\b/);
  if (!m) {
    const bare = s.match(/\ben\s+(\d{1,3})\b/);
    return bare ? Math.max(1, Math.min(600, Number(bare[1]))) : fallback;
  }
  const n = Number(m[1]);
  const unit = m[0];
  const secs = /(?:m|min)/.test(unit) ? n * 60 : n;
  return Math.max(1, Math.min(600, secs));
}

function normalizeColor(c, fallback = 'gold') {
  const clean = String(c || '').trim().toLowerCase();
  return VALID_TEXT_COLORS.has(clean) ? clean : fallback;
}

function deterministicFallbackPlan(wish) {
  const clean = String(wish || '').trim();
  if (CANCEL_RE.test(clean)) {
    return {
      resumen: 'Cancelar cuenta regresiva activa',
      respuesta_consola: 'Cancelando la cuenta regresiva activa.',
      anuncio_chat: '',
      pasos: [{ tipo: 'cancel_countdown', delay_sec: 0 }]
    };
  }
  if (SHUTDOWN_WISH_RE.test(clean)) {
    const secs = parseSecondsFromText(clean, 10);
    return {
      resumen: `Cuenta regresiva de ${secs}s y cierre seguro del servidor`,
      respuesta_consola: `Iniciando contador de ${secs}s para guardar y cerrar el servidor.`,
      anuncio_chat: '',
      pasos: [
        {
          tipo: 'countdown',
          delay_sec: 0,
          segundos: secs,
          titulo: '¡Cierre del servidor!',
          subtitulo: 'Guardando y cerrando en {s}s',
          color: 'red',
          bossbar: true,
          sonido: 'minecraft:block.note_block.pling',
          mensaje_final: '¡Guardando mundo y cerrando servidor!',
          comandos_finales: ['save-all', 'stop']
        }
      ]
    };
  }
  return null;
}

function normalizeSimple(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const CREATIVE_WISH_RE = /\b(castig\w*|trolle\w*|broma|susto|asust\w*|tortur\w*|humill\w*|premi\w*|bendic\w*|bendec\w*|sorprend\w*|show|espectaculo|caos|locura|lo\s+que\s+quieras|lo\s+que\s+se\s+te\s+de\s+la\s+gana)\b/i;
const DESTRUCTIVE_BLOCKS_RE = /\b(?:minecraft:)?(?:tnt|lava|fire|soul_fire|end_crystal|bedrock|command_block|chain_command_block|repeating_command_block|barrier|spawner|trial_spawner)\b/i;
const DESTRUCTIVE_MOBS_RE = /\b(?:minecraft:)?(?:wither|ender_dragon|warden|tnt|tnt_minecart|end_crystal|ghast|ravager|elder_guardian)\b/i;

// Resuelve nicks reales de Miscolandia a partir de alias comunes (noc, archivista, luthadel, alejandria, etc.)
export function resolveWishPlayers(wish, onlinePlayers = [], worldState = null, cfg = null) {
  const wNorm = normalizeSimple(wish);
  const NOC_RE = /^notout(?:of)?context$/i;
  const onlineNoc = (onlinePlayers || []).find(p => NOC_RE.test(String(p || '')));
  const cfgNoc = (cfg?.players?.guests || []).find(g => NOC_RE.test(String(g || '')));
  const nocGuest = (worldState?.guests || []).find(g => NOC_RE.test(String(g?.nick || '')));
  const mythNick = cfg?.players?.myth?.[0] || worldState?.nations?.myth?.player || 'MythStorm';
  const scadNick = cfg?.players?.scad?.[0] || worldState?.nations?.scad?.player || 'Scadrial0523';
  const nocNick = onlineNoc || cfgNoc || 'NotOutContext';

  const roster = new Map();
  const register = (canon, aliases) => {
    if (!canon || typeof canon !== 'string') return;
    const key = canon.toLowerCase();
    const cur = roster.get(key) || { canon, aliases: new Set([canon]) };
    for (const a of aliases) {
      const clean = String(a || '').trim();
      if (clean.length >= 2) cur.aliases.add(clean);
    }
    roster.set(key, cur);
  };

  register(mythNick, [mythNick, 'myth', 'mythstorm', 'alejandria', 'nueva alejandria', 'rey de alejandria', 'agricultor', ...(cfg?.players?.myth || [])]);
  register(scadNick, [scadNick, 'scad', 'scadrial', 'scadrial0523', 'luthadel', 'ganadero', ...(cfg?.players?.scad || [])]);
  register(nocNick, [
    nocNick, 'noc', 'nooc', 'notout', 'notoutcontext', 'notoutofcontext',
    'archivista', 'auditor', 'contralor', 'invitado',
    ...(nocGuest ? [nocGuest.nick, nocGuest.id, nocGuest.name] : []),
    ...(cfg?.players?.guests || []).filter(g => NOC_RE.test(String(g)))
  ]);

  for (const g of (worldState?.guests || [])) {
    if (g?.nick && !NOC_RE.test(String(g.nick))) register(g.nick, [g.nick, g.id, g.name]);
  }
  for (const g of (cfg?.players?.guests || [])) {
    if (g && !NOC_RE.test(String(g))) register(g, [g]);
  }
  for (const p of (onlinePlayers || [])) {
    if (/^[A-Za-z0-9_]{1,16}$/.test(p) && !NOC_RE.test(String(p))) register(p, [p]);
  }

  const targets = new Set();
  const canonical = [];
  const aliasNotes = [];
  for (const [key, entry] of roster.entries()) {
    let matchedAlias = null;
    for (const alias of entry.aliases) {
      const aNorm = normalizeSimple(alias);
      if (!aNorm) continue;
      const esc = aNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      if (new RegExp(`(?:^|[^a-z0-9_])${esc}(?:$|[^a-z0-9_])`, 'i').test(wNorm)) {
        matchedAlias = alias;
        if (aNorm === key) break; // prefiere coincidencia exacta si existe
      }
    }
    if (matchedAlias) {
      targets.add(key);
      canonical.push(entry.canon);
      if (normalizeSimple(matchedAlias) !== key) {
        aliasNotes.push(`"${matchedAlias}" -> ${entry.canon}`);
      }
    }
  }
  return { targets, canonical, aliasNotes };
}

// ¿Por qué un comando del plan NO debe ejecutarse? (null = se permite)
// 1) Graves (expulsar, banear, op, parar, matar a todos, mobs/bloques destructivos): solo si se piden.
// 2) Dar/quitar/teletransportar/efectos/daño/invocar sobre un jugador: solo a jugadores o alias nombrados;
//    a todos (@a/@e/@r) solo si la orden dice "todos"/"cada"; nunca a uno al azar.
export function riskyReason(cmd, wish, resolvedTargets = null) {
  const c = String(cmd || '').trim();
  const w = String(wish || '').toLowerCase();
  const wNorm = normalizeSimple(w);
  const isCreative = CREATIVE_WISH_RE.test(wNorm);
  const verb = (c.match(/^(\S+)/) || [])[1]?.toLowerCase() || '';
  const GRAVE = {
    kick: /\b(expuls|kick|saca(?:lo|la)?\s+del\s+servidor|echa(?:lo|la)?)/,
    ban: /\bban/, 'ban-ip': /\bban/, pardon: /\b(desban|pardon|perdona)/, 'pardon-ip': /\b(desban|pardon)/,
    op: /\b(op|operador|admin\s+a)\b/, deop: /\b(deop|quita(?:le)?\s+(?:el\s+)?op)\b/,
    stop: SHUTDOWN_WISH_RE, whitelist: /\bwhitelist|lista\s+blanca/, 'save-off': /a^/, difficulty: /\bdificultad|difficulty/,
    gamemode: /\b(modo|gamemode|creativo|espectador|supervivencia|aventura)\b/, defaultgamemode: /a^/,
    fill: /\b(llena|rellena|fill|construye|pon\s+bloques)\b/, setblock: /\b(bloque|setblock|pon)\b/, clone: /a^/, forceload: /a^/
  };
  if (GRAVE[verb]) {
    if (verb === 'setblock') {
      if (DESTRUCTIVE_BLOCKS_RE.test(c)) {
        const blk = (c.match(DESTRUCTIVE_BLOCKS_RE) || [])[0]?.replace(/^minecraft:/i, '').toLowerCase() || '';
        if (!blk || !wNorm.includes(blk)) return 'bloque destructivo no pedido';
      } else if (!GRAVE.setblock.test(wNorm) && !isCreative) {
        return '"setblock" no fue pedido explícitamente';
      }
    } else {
      if (verb === 'fill' && DESTRUCTIVE_BLOCKS_RE.test(c)) return 'bloque destructivo en fill no permitido';
      const re = GRAVE[verb] instanceof RegExp ? GRAVE[verb] : null;
      if (!re || (!re.test(w) && !re.test(wNorm))) return `"${verb}" no fue pedido explícitamente`;
    }
  }
  const mobMatch = c.match(/^(?:execute\b[\s\S]*?\brun\s+)?summon\s+(\S+)/i);
  if (mobMatch && DESTRUCTIVE_MOBS_RE.test(mobMatch[1])) {
    const mobId = mobMatch[1].replace(/^minecraft:/i, '').toLowerCase();
    const mobWords = { ender_dragon: /(?:ender_dragon|dragon)/, end_crystal: /(?:end_crystal|crystal|cristal)/, tnt_minecart: /tnt/, elder_guardian: /(?:elder_guardian|guardian)/ };
    const allowRe = mobWords[mobId] || new RegExp(`\\b${mobId}\\b`, 'i');
    if (!allowRe.test(wNorm)) return `entidad destructiva "${mobId}" no pedida`;
  }
  // Destino del comando (jugador o selector) para los que afectan a alguien
  let target = null;
  let m;
  if ((m = c.match(/^(?:give|clear|kill|kick|tp|teleport|xp|experience|gamemode|spawnpoint|damage|attribute)\s+(?:add\s+|set\s+|query\s+|creative\s+|survival\s+|adventure\s+|spectator\s+)?(\S+)/i))) target = m[1];
  else if ((m = c.match(/^effect\s+(?:give|clear)\s+(\S+)/i))) target = m[1];
  else if ((m = c.match(/^execute\s+(?:as|at)\s+(\S+)[\s\S]*\brun\s+(?!summon\s+(?:minecraft:)?firework_rocket\b)(?:give|clear|kill|summon|effect|tp|teleport|damage|attribute|setblock)\b/i))) target = m[1];
  if (/^kill\s+@e\b/i.test(c) && !/\b(mobs|monstruos|entidades|bichos)\b/.test(w)) return 'matar entidades no fue pedido';
  if (!target) return null;
  const sel = target.replace(/\[.*$/, '').toLowerCase();
  const ALL_RE = /\b(todos|todas|todo\s+el\s+mundo|cada\s+(?:uno|jugador)|a\s+todos|everyone|all|nosotros|nos)\b/;
  if (sel === '@a' || sel === '@e') return ALL_RE.test(wNorm) ? null : 'afecta a todos sin que la orden diga "todos"';
  if (sel === '@r') return 'jugador al azar no permitido';
  if (sel === '@s' || sel === '@p') return null;
  if (w.includes(sel) || wNorm.includes(sel)) return null;
  if (resolvedTargets && resolvedTargets.has(sel)) return null;
  return `"${target}" no aparece en la orden`;
}

// "un rayo sobre X por Y" / "pégale un rayo a X": solo a los jugadores nombrados (o a todos si lo dice)
export function lightningPlan(wish, onlinePlayers = [], worldState = null, cfg = null) {
  const w = String(wish || '');
  if (!/\brayos?\b/i.test(w)) return null;
  const low = w.toLowerCase();
  const all = /\b(todos|todo\s+el\s+mundo|a\s+todos|cada\s+jugador)\b/i.test(w);
  const resolved = resolveWishPlayers(w, onlinePlayers, worldState, cfg);
  const named = [...new Set([
    ...onlinePlayers.filter(p => /^[A-Za-z0-9_]{1,16}$/.test(p) && low.includes(p.toLowerCase())),
    ...resolved.canonical
  ])];
  if (!all && !named.length) return null; // no está claro a quién: que no caiga sobre nadie al azar
  const targets = all ? ['@a'] : named;
  const reason = (w.match(/\bpor\s+(.{3,80}?)(?:[.!]|$)/i) || [])[1];
  const sayMatch = w.match(/\b(?:y\s+)?(?:di|dile|diles|anuncia)\s*[:,]?\s+(.{3,160})$/i);
  const pasos = targets.map(t => ({ tipo: 'command', comando: `execute at ${t} run summon minecraft:lightning_bolt ~ ~ ~` }));
  const who = all ? 'todos' : named.join(' y ');
  pasos.push({ tipo: 'broadcast', texto: sayMatch ? sayMatch[1] : `Un rayo cayó sobre ${who}${reason ? ` por ${reason}` : ''}.`, color: 'yellow' });
  return { resumen: `Rayo sobre ${who}`, respuesta_consola: `Rayo sobre ${who}.`, anuncio_chat: '', pasos };
}

const FIREWORK_RE = /\b(?:fuegos?\s+artificial(?:es)?|cohetes?|rockets?|fireworks?|pirotecnia)\b/i;
const FIREWORK_SPOTS = [[3, 3], [-3, 3], [3, -3], [-3, -3], [0, 5]];
const FIREWORK_COLORS = [[16766720, 11141290], [16711680, 16777215], [65535, 16755200], [5636095, 16733695], [16777045, 65280]];
function fireworkCmd([dx, dz], colors, i) {
  const shape = ['large_ball', 'star', 'burst', 'large_ball', 'small_ball'][i % 5];
  return `execute as @a at @s run summon minecraft:firework_rocket ~${dx} ~1 ~${dz} {LifeTime:${22 + i * 4},FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:2,explosions:[{shape:"${shape}",colors:[I;${colors.join(',')}],has_twinkle:true,has_trail:true}]}}}}`;
}

// "anuncia (con título grande): <texto> [y lanza N fuegos artificiales]" → plan fijo, sin IA.
// Devuelve null si la orden pide otra cosa (la atiende la IA).
export function quickIntentPlan(wish) {
  const w = String(wish || '').trim();
  const wantsFw = FIREWORK_RE.test(w);
  const ann = w.match(/^(?:anuncia|anunciar|di|decir|avisa|mensaje|pon(?:er)?\s+(?:un\s+)?(?:t[ií]tulo|mensaje))\b[^:]*:\s*(.+)$/i);
  if (!ann && !wantsFw) return null;
  let text = ann ? ann[1] : '';
  // Quitar del texto la parte que pide los fuegos ("Y lanza 5 fuegos artificiales...")
  text = text.replace(/[.!]?\s*\b(?:y\s+)?(?:lanza|lanzar|tira|tirar|suelta|soltar|haz|hacer|con)\b[^.!]*\b(?:fuegos?\s+artificial(?:es)?|cohetes?|rockets?|fireworks?|pirotecnia)\b.*$/i, '').trim();
  const rest = ann ? ann[1].slice(text.length) : w;
  // Si además pide algo que no sea anuncio/fuegos (dar ítems, clima, tp...), mejor que lo planee la IA
  if (/\b(?:da|dale|dales|regala|give|tp|teletransporta|clima|lluvia|d[ií]a|noche|efecto|kick|ban|op)\b/i.test(rest.replace(/sin\s+dar\s+items?/i, ''))) return null;
  const big = /t[ií]tulo|pantalla|grande/i.test(w.slice(0, ann ? w.length - ann[1].length : w.length));
  const pasos = [];
  if (text) {
    const [titleTxt, ...subParts] = text.split(/(?<=[!.?])\s+/);
    pasos.push({ tipo: 'broadcast', texto: text, color: 'gold', pantalla: false });
    if (big) {
      pasos.push({ tipo: 'command', comando: 'title @a times 10 70 20' });
      if (subParts.length) pasos.push({ tipo: 'command', comando: `title @a subtitle ${JSON.stringify({ text: subParts.join(' ').slice(0, 80), color: 'yellow' })}` });
      pasos.push({ tipo: 'command', comando: `title @a title ${JSON.stringify({ text: titleTxt.slice(0, 50), color: 'gold', bold: true })}` });
    }
  }
  if (wantsFw) {
    const n = Math.max(1, Math.min(5, Number((w.match(/(\d+)\s*(?:fuegos?|cohetes?|rockets?|fireworks?)/i) || [])[1]) || 4));
    for (let i = 0; i < n; i++) pasos.push({ tipo: 'command', delay_sec: i * 0.6, comando: fireworkCmd(FIREWORK_SPOTS[i], FIREWORK_COLORS[i], i) });
    pasos.push({ tipo: 'command', comando: 'execute as @a at @s run playsound minecraft:entity.firework_rocket.launch master @s ~ ~ ~ 1 1' });
  }
  return {
    resumen: [text && (big ? 'Anuncio con título' : 'Anuncio'), wantsFw && 'fuegos artificiales'].filter(Boolean).join(' + '),
    respuesta_consola: `Hecho: ${[text && 'anuncio', wantsFw && 'fuegos artificiales'].filter(Boolean).join(' y ')}.`,
    anuncio_chat: '',
    pasos
  };
}

// ===== Intérprete "a prueba de Homero": las órdenes frecuentes se entienden por palabras clave, sin IA =====
const SCREEN_RE = /\b(pantalla|t[ií]tulo|titular|grande|en\s+grande|letras?\s+grandes?)\b/i;
const CELEBRATE_RE = /\b(celebr\w*|fiesta|festej\w*|festiv\w*|felicit\w*)\b/i;
const CHAT_RE = /\b(di|dile|diles|decir|dec[ií]|anuncia\w*|avisa\w*|escrib\w*|mensaje|chat|pon\s+(?:en|por)\s+(?:el\s+)?chat|grita|proclama)\b/i;
const WEATHER_RULES = [
  [/\b(no\s+llueva|sin\s+lluvia|deje\s+de\s+llover|pare\s+de\s+llover|para\s+la\s+lluvia|quita\s+la\s+lluvia|no\s+m[aá]s\s+lluvia)\b/i, 'weather clear'],
  [/\b(tormenta|truenos?|rel[aá]mpagos)\b/i, 'weather thunder'],
  [/\b(lluvia|llueva|lluev\w*|que\s+llueva)\b/i, 'weather rain'],
  [/\b(despej\w*|buen\s+clima|sol(?:ecito)?|quita\s+la\s+lluvia|para\s+la\s+lluvia|cielo\s+despejado)\b/i, 'weather clear']
];
const TIME_RULES = [
  [/\b(medianoche)\b/i, 'time set 18000'],
  [/\b(mediod[ií]a)\b/i, 'time set 6000'],
  [/\b(amanec\w*|ma[ñn]ana|de\s+d[ií]a|hazlo\s+de\s+d[ií]a|que\s+sea\s+de\s+d[ií]a)\b/i, 'time set day'],
  [/\b(de\s+noche|que\s+sea\s+de\s+noche|anochec\w*|atardec\w*)\b/i, 'time set night']
];
// palabra -> [efecto, nivel, positivo]
const EFFECT_WORDS = [
  [/\b(velocidad|r[aá]pid\w*|corr\w+\s+m[aá]s)\b/i, 'speed', 1, true],
  [/\b(salto|salt\w+\s+m[aá]s|saltar\s+alto)\b/i, 'jump_boost', 1, true],
  [/\b(cur\w*|sana\w*|regenera\w*|vida)\b/i, 'regeneration', 1, true],
  [/\b(fuerza|fuertes?)\b/i, 'strength', 0, true],
  [/\b(visi[oó]n\s+nocturna|ver\s+de\s+noche|ver\s+en\s+la\s+oscuridad)\b/i, 'night_vision', 0, true],
  [/\b(resistencia|protecci[oó]n|prot[eé]ge\w*)\b/i, 'resistance', 0, true],
  [/\b(prisa|minar\s+r[aá]pido|picar\s+r[aá]pido)\b/i, 'haste', 1, true],
  [/\b(suerte)\b/i, 'luck', 0, true],
  [/\b(brill\w*|resplandec\w*|ilumin\w*|que\s+se\s+vean)\b/i, 'glowing', 0, true],
  [/\b(invisib\w*)\b/i, 'invisibility', 0, true],
  [/\b(levit\w*|flot\w*|volar)\b/i, 'levitation', 0, false],
  [/\b(lent\w*|despacio)\b/i, 'slowness', 1, false],
  [/\b(ceg\w*|ciegos?|oscuridad)\b/i, 'blindness', 0, false],
  [/\b(mare\w*|n[aá]usea)\b/i, 'nausea', 0, false]
];
// Lo que el intérprete NO sabe hacer: si aparece, se usa la IA (con parche de lo que olvide)
const COMPLEX_RE = /\b(da|dale|dales|darle|darles|regal\w*|entreg\w*|quit\w*|qu[ií]tale\w*|borr\w*|limpi\w*|tp|teletransport\w*|lleva\w*|trae\w*|constru\w*|invoc\w*|spawn\w*|aparece\w*|mata\w*|mat[aá]\w*|explot\w*|cambia\w*|modo|gamemode|kick|ban\w*|op|deop|whitelist|dificultad|bloque\w*|cofre\w*|cuenta\s+regresiva|contador|cierra|apaga|reinicia|guarda\w*|castig\w*|trolle\w*|broma|susto|asust\w*|tortur\w*|humill\w*|premi\w*|bendic\w*|bendec\w*|sorprend\w*|show|espect[aá]culo|caos|locura|gana|quieras)\b/i;

function ownMessage(w) {
  // 1) Entre comillas  2) Después de ":"  3) Después del verbo de decir/pantalla/celebrar
  const q = w.match(/["“«']([^"”»']{2,160})["”»']/);
  if (q) return q[1].trim();
  const colon = w.match(/:\s*(.+)$/);
  let txt = colon ? colon[1] : '';
  if (!txt) {
    const v = w.match(/\b(?:di|dile|diles|anuncia|avisa|escribe|grita|proclama|pon(?:\s+(?:en|por)\s+(?:la\s+)?pantalla)?(?:\s+(?:en|por)\s+(?:el\s+)?chat)?|celebra(?:\s+(?:que|porque|con\s+un\s+mensaje\s+de))?)\s+(?:que\s+|un\s+mensaje\s+(?:de|que\s+diga)\s+|un\s+t[ií]tulo\s+(?:de|que\s+diga)\s+)?(.{3,})$/i);
    txt = v ? v[1] : '';
  }
  // Cortar lo que ya son otras órdenes ("... y lanza fuegos", "... y que llueva")
  txt = txt.replace(/[,.!]?\s*\b(?:y\s+)?(?:lanza|tira|suelta|haz|hacer|pon|ponle|que\s+llueva|que\s+sea|dales?|con\s+fuegos|con\s+cohetes)\b.*$/i, '').trim();
  txt = txt.replace(/^(?:en|por)\s+(?:la\s+)?pantalla\s*/i, '').replace(/^(?:en\s+grande|grande)\s*/i, '').trim();
  return txt.length >= 2 ? txt.slice(0, 200) : '';
}

// Limpia el mensaje: sin comas/puntos sueltos al inicio y con mayúscula inicial
function tidyMessage(txt) {
  const t = String(txt || '').replace(/^[\s,;:.\-–—]+/, '').replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}
// Título corto + subtítulo: corta en el primer signo o coma; si sigue largo, por palabras (~40 letras)
function splitTitle(msg) {
  const parts = msg.split(/(?<=[!.?])\s+|,\s+/).filter(Boolean);
  let head = parts.shift() || msg;
  let tail = parts.join(' ');
  if (head.length > 42) {
    const cut = head.lastIndexOf(' ', 40);
    tail = `${head.slice(cut + 1)} ${tail}`.trim();
    head = head.slice(0, cut > 10 ? cut : 40);
  }
  return [tidyMessage(head), ...(tail ? [tidyMessage(tail)] : [])];
}

function namedPlayers(w, onlinePlayers) {
  const low = w.toLowerCase();
  const resolved = resolveWishPlayers(w, onlinePlayers);
  return [...new Set([
    ...(onlinePlayers || []).filter(p => /^[A-Za-z0-9_]{1,16}$/.test(p) && low.includes(p.toLowerCase())),
    ...resolved.canonical
  ])];
}

// Devuelve { plan, complex } — plan null si no se reconoce nada; complex=true si hay partes que necesita la IA
export function homerIntents(wish, onlinePlayers = []) {
  const w = String(wish || '').trim();
  const msgRaw = ownMessage(w);
  // Las órdenes se buscan FUERA del texto del mensaje ("di: mañana hay feria" no debe hacerlo de día)
  const cmdPart = msgRaw ? w.replace(msgRaw, ' ') : w;
  const hasEffectWord = EFFECT_WORDS.some(([re]) => re.test(cmdPart));
  const complex = COMPLEX_RE.test(cmdPart
    .replace(/sin\s+dar\s+items?/gi, '')
    .replace(/\bpon(?:le)?\s+(?:en|por)\s+(?:la\s+)?pantalla\b/gi, '')
    .replace(hasEffectWord ? /\b(dale|dales|darle|darles|ponle|ponles)\b/gi : /a^/, ''));
  const named = namedPlayers(w, onlinePlayers);
  const all = /\b(todos|todas|todo\s+el\s+mundo|cada\s+jugador|nosotros|nos|a\s+todos)\b/i.test(w);
  const pasos = [];
  const done = [];
  const celebrate = CELEBRATE_RE.test(cmdPart);
  const screen = SCREEN_RE.test(cmdPart) || celebrate;
  const msg = tidyMessage(msgRaw) || (celebrate ? '¡A celebrar, Miscolandia!' : '');
  if (msg && (CHAT_RE.test(cmdPart) || screen || celebrate)) {
    pasos.push({ tipo: 'broadcast', texto: msg, color: 'gold', pantalla: false });
    done.push('mensaje');
    if (screen) {
      const [head, ...tail] = splitTitle(msg);
      pasos.push({ tipo: 'command', comando: 'title @a times 10 70 20' });
      if (tail.length) pasos.push({ tipo: 'command', comando: `title @a subtitle ${JSON.stringify({ text: tail.join(' ').slice(0, 80), color: 'yellow' })}` });
      pasos.push({ tipo: 'command', comando: `title @a title ${JSON.stringify({ text: head.slice(0, 50), color: 'gold', bold: true })}` });
      done.push('título en pantalla');
    }
  }
  if (FIREWORK_RE.test(cmdPart) || celebrate) {
    const n = Math.max(1, Math.min(5, Number((w.match(/(\d+)\s*(?:fuegos?|cohetes?|rockets?|fireworks?)/i) || [])[1]) || 4));
    for (let i = 0; i < n; i++) pasos.push({ tipo: 'command', delay_sec: i * 0.6, comando: fireworkCmd(FIREWORK_SPOTS[i], FIREWORK_COLORS[i], i) });
    pasos.push({ tipo: 'command', comando: 'execute as @a at @s run playsound minecraft:entity.firework_rocket.launch master @s ~ ~ ~ 1 1' });
    if (celebrate) pasos.push({ tipo: 'command', delay_sec: 1, comando: 'execute as @a at @s run playsound minecraft:ui.toast.challenge_complete master @s ~ ~ ~ 0.8 1' });
    done.push('fuegos artificiales');
  }
  if (/\brayos?\b/i.test(cmdPart) && (named.length || all)) {
    for (const t of (all ? ['@a'] : named)) pasos.push({ tipo: 'command', comando: `execute at ${t} run summon minecraft:lightning_bolt ~ ~ ~` });
    done.push('rayo');
  }
  for (const [re, cmd] of WEATHER_RULES) if (re.test(cmdPart)) { pasos.push({ tipo: 'command', comando: cmd }); done.push('clima'); break; }
  for (const [re, cmd] of TIME_RULES) if (re.test(cmdPart)) { pasos.push({ tipo: 'command', comando: cmd }); done.push('hora'); break; }
  const secs = Math.max(5, Math.min(300, Number((w.match(/(\d{1,3})\s*(?:s\b|seg\w*)/i) || [])[1]) || (Number((w.match(/(\d{1,2})\s*min\w*/i) || [])[1]) || 0) * 60 || 30));
  for (const [re, effect, amp, positive] of EFFECT_WORDS) {
    if (!re.test(cmdPart)) continue;
    // Efectos buenos: a quien nombres o a todos. Malos: solo a quien nombres (o "todos" explícito)
    const targets = named.length ? named : ((all || positive) ? ['@a'] : []);
    for (const t of targets) pasos.push({ tipo: 'command', comando: `effect give ${t} minecraft:${effect} ${secs} ${amp}` });
    if (targets.length) done.push(`efecto ${effect}`);
  }
  if (!pasos.length) return { plan: null, complex };
  return {
    complex,
    plan: { resumen: `Hecho sin IA: ${done.join(', ')}`, respuesta_consola: `Hecho: ${done.join(', ')}.`, anuncio_chat: '', pasos }
  };
}

// Si la IA planeó, se le agrega lo que olvidó de lo pedido (título en pantalla, fuegos, mensaje)
export function patchForgotten(plan, wish, onlinePlayers = []) {
  const { plan: homer } = homerIntents(wish, onlinePlayers);
  if (!homer) return plan;
  const cmds = plan.pasos.map(p => p.comando || '').join('\n');
  const has = {
    title: /^title\s+@a\s+title/m.test(cmds) || plan.pasos.some(p => p.tipo === 'broadcast' && p.pantalla),
    fw: /firework_rocket/.test(cmds),
    chat: plan.pasos.some(p => p.tipo === 'broadcast') || Boolean(plan.anuncio_chat)
  };
  const add = homer.pasos.filter(p =>
    (p.tipo === 'broadcast' && !has.chat) ||
    (p.tipo === 'command' && /^title\s/.test(p.comando) && !has.title) ||
    (p.tipo === 'command' && /firework|challenge_complete/.test(p.comando) && !has.fw));
  if (add.length) {
    plan.pasos.push(...add);
    plan.respuesta_consola = `${plan.respuesta_consola} (+ agregado lo que la IA olvidó: ${[...new Set(add.map(p => p.tipo === 'broadcast' ? 'mensaje' : /^title/.test(p.comando) ? 'título' : 'fuegos'))].join(', ')})`;
  }
  return plan;
}

function normalizePlan(rawPlan, wish, resolvedTargets = null) {
  const plan = rawPlan && typeof rawPlan === 'object' ? { ...rawPlan } : {};
  const wantsShutdown = SHUTDOWN_WISH_RE.test(String(wish || ''));
  const rawSteps = Array.isArray(plan.pasos) ? plan.pasos.slice(0, 25) : [];
  const pasos = [];

  for (const s of rawSteps) {
    if (!s || typeof s !== 'object') continue;
    const delaySec = Math.max(0, Math.min(3600, Number(s.delay_sec) || 0));
    const tipo = String(s.tipo || '').toLowerCase();

    if (tipo === 'cancel_countdown') {
      pasos.push({ tipo: 'cancel_countdown', delay_sec: delaySec });
      continue;
    }

    if (tipo === 'countdown') {
      // Una cuenta regresiva solo si la orden habla de tiempo o contador (el modelo chico a veces la inventa)
      if (!/(contador|cuenta|regresiv|segundo|minuto|cierr|apag|reinici|\d)/i.test(String(wish || ''))) continue;
      const segundos = Math.max(1, Math.min(600, Math.round(Number(s.segundos) || parseSecondsFromText(wish, 10))));
      let finales = Array.isArray(s.comandos_finales)
        ? s.comandos_finales.map(sanitizeRconCommand).filter(Boolean)
        : [];
      if (wantsShutdown && !finales.some(c => /^stop\b/i.test(c))) {
        finales.push('stop');
      }
      if (finales.some(c => /^stop\b/i.test(c)) && !finales.some(c => /^save-all\b/i.test(c))) {
        const stopIdx = finales.findIndex(c => /^stop\b/i.test(c));
        finales.splice(stopIdx, 0, 'save-all');
      }
      pasos.push({
        tipo: 'countdown',
        delay_sec: delaySec,
        segundos,
        titulo: String(s.titulo || (wantsShutdown ? '¡Cierre del servidor!' : 'Cuenta regresiva')).trim().slice(0, 60),
        subtitulo: String(s.subtitulo || 'En {s}s').trim().slice(0, 90),
        color: normalizeColor(s.color, wantsShutdown ? 'red' : 'gold'),
        bossbar: s.bossbar !== false,
        sonido: sanitizeRconCommand(s.sonido || 'minecraft:block.note_block.pling') || 'minecraft:block.note_block.pling',
        mensaje_final: String(s.mensaje_final || (wantsShutdown ? '¡Cerrando el servidor!' : '¡Tiempo cumplido!')).trim().slice(0, 120),
        comandos_finales: finales.slice(0, 8)
      });
      continue;
    }

    if (tipo === 'broadcast') {
      const texto = String(s.texto || '').trim().slice(0, 220);
      if (texto) {
        pasos.push({
          tipo: 'broadcast',
          delay_sec: delaySec,
          texto,
          color: normalizeColor(s.color, 'gold'),
          pantalla: Boolean(s.pantalla)
        });
      }
      continue;
    }

    if (tipo === 'command') {
      const comando = sanitizeRconCommand(s.comando);
      if (comando) {
        pasos.push({ tipo: 'command', delay_sec: delaySec, comando });
      }
    }
  }

  // Modelos chicos a veces escriben los comandos en respuesta_consola en vez de en pasos: se rescatan
  // (solo comandos vanilla reconocibles, nunca stop/op/ban por esta vía)
  if (!pasos.length) {
    const SALVAGE_RE = /^(?:title|tellraw|execute|summon|effect|weather|time|playsound|particle|xp|bossbar|say|gamerule|give|tp|damage)\b/i;
    const raw = String(plan.respuesta_consola || '').replace(/\}(?=\s*(?:execute|title|summon|tellraw|playsound|particle|effect|give|tp)\b)/g, '}\n');
    for (const line of raw.split(/\n+/)) {
      const comando = sanitizeRconCommand(line);
      if (comando && SALVAGE_RE.test(comando) && pasos.length < 12) pasos.push({ tipo: 'command', delay_sec: 0, comando });
    }
    if (pasos.length) plan.respuesta_consola = plan.resumen || 'Hecho.';
  }

  // Candados: la IA no puede tocar a quien no nombraste ni hacer cosas graves que no pediste
  const blocked = [];
  const safe = cmd => {
    const why = riskyReason(cmd, wish, resolvedTargets);
    if (why) blocked.push(`${cmd.slice(0, 60)} (${why})`);
    return !why;
  };
  for (let k = pasos.length - 1; k >= 0; k--) {
    const p = pasos[k];
    if (p.tipo === 'command' && !safe(p.comando)) pasos.splice(k, 1);
    if (p.tipo === 'countdown') p.comandos_finales = p.comandos_finales.filter(safe);
  }
  if (blocked.length) {
    plan.respuesta_consola = `${plan.respuesta_consola || ''} [Bloqueado por seguridad: ${blocked.join('; ')}]`.trim();
  }

  // Asegura save-all antes de un stop suelto si no iba dentro de un countdown
  const hasStopCommand = pasos.some(p => p.tipo === 'command' && /^stop\b/i.test(p.comando));
  if (hasStopCommand && !pasos.some(p => p.tipo === 'command' && /^save-all\b/i.test(p.comando))) {
    const stopStep = pasos.find(p => p.tipo === 'command' && /^stop\b/i.test(p.comando));
    pasos.unshift({ tipo: 'command', delay_sec: Math.max(0, stopStep.delay_sec - 0.5), comando: 'save-all' });
  }

  return {
    resumen: String(plan.resumen || wish || 'Orden ejecutada').trim().slice(0, 160),
    respuesta_consola: String(plan.respuesta_consola || 'Hecho.').trim().slice(0, 240),
    anuncio_chat: String(plan.anuncio_chat || '').trim().slice(0, 220),
    pasos
  };
}

function parseJsonSafe(raw) {
  const txt = String(raw || '').trim();
  try {
    return JSON.parse(txt);
  } catch {}
  const stripped = txt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = stripped.indexOf('{');
  const last = stripped.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(stripped.slice(first, last + 1));
    } catch {}
  }
  // Rescate seguro si la respuesta JSON quedó truncada dentro de "pasos": [...]
  if (first >= 0) {
    const sliceSrc = stripped.slice(first);
    const pasosMatch = sliceSrc.match(/"pasos"\s*:\s*\[/);
    if (pasosMatch) {
      const arrStart = sliceSrc.indexOf('[', pasosMatch.index);
      let inStr = false;
      let escaped = false;
      let depth = 0;
      let lastCompleteObjEnd = -1;
      for (let i = arrStart + 1; i < sliceSrc.length; i++) {
        const ch = sliceSrc[i];
        if (escaped) { escaped = false; continue; }
        if (inStr) {
          if (ch === '\\') { escaped = true; continue; }
          if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{') depth += 1;
        else if (ch === '}') {
          if (depth > 0) {
            depth -= 1;
            if (depth === 0) lastCompleteObjEnd = i;
          }
        } else if (ch === ']' && depth === 0) {
          break;
        }
      }
      if (lastCompleteObjEnd > arrStart) {
        try {
          return JSON.parse(`${sliceSrc.slice(0, lastCompleteObjEnd + 1)}]}`);
        } catch {}
      }
    }
  }
  throw new Error(`No se pudo parsear plan admin JSON: ${txt.slice(0, 140)}`);
}

/* ---------- Autocorrección: si un comando falla, se lee el error y se reintenta corregido ---------- */

// Respuestas de RCON que significan "el comando no se ejecutó"
export const RCON_ERROR_RE = /^(?:Unknown|Incorrect|Expected|Malformed|Invalid|No entity|No player|Can't|Could not|Failed|Unparseable|Not a valid|That position|Nothing changed|Data tag parsing failed|Unknown or incomplete)/i;

// Sintaxis oficial de la Minecraft Wiki (sección Java + ejemplos), en caché 7 días en disco
const WIKI_TTL_MS = 7 * 86_400_000;
const wikiMem = new Map();
let wikiCachePath = null;
export function setWikiCachePath(p) { wikiCachePath = p; }
function loadWikiCache() {
  if (wikiMem.size || !wikiCachePath) return;
  try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(wikiCachePath, 'utf8')))) wikiMem.set(k, v); } catch { /* sin caché */ }
}
function saveWikiCache() {
  if (!wikiCachePath) return;
  try { fs.writeFileSync(wikiCachePath, JSON.stringify(Object.fromEntries(wikiMem)), 'utf8'); } catch { /* no crítico */ }
}
export function extractWikiSyntax(wikitext) {
  const t = String(wikitext || '');
  const section = name => {
    const i = t.search(new RegExp(`^==\\s*${name}\\s*==`, 'm'));
    if (i < 0) return '';
    const rest = t.slice(i).split('\n').slice(1).join('\n');
    const end = rest.search(/^==[^=]/m);
    return end < 0 ? rest : rest.slice(0, end);
  };
  const clean = s => s
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<\/?code>|'''|''/g, '')
    .replace(/\n{2,}/g, '\n').trim();
  const syntax = section('Syntax');
  const java = syntax.split(/\*\s*'''Bedrock Edition'''/i)[0];
  const examples = section('Examples').split(/\*\s*'''Bedrock Edition'''|\{\{el\|be/i)[0];
  return `${clean(java).slice(0, 1200)}${examples ? `\nEjemplos:\n${clean(examples).slice(0, 900)}` : ''}`.trim();
}
export async function fetchWikiSyntax(verb) {
  const v = String(verb || '').toLowerCase().replace(/[^a-z_-]/g, '');
  if (!v) return '';
  loadWikiCache();
  const hit = wikiMem.get(v);
  if (hit && Date.now() - hit.at < WIKI_TTL_MS) return hit.text;
  try {
    const url = `https://minecraft.wiki/api.php?action=parse&page=Commands/${encodeURIComponent(v)}&prop=wikitext&format=json&redirects=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MiscolandiaBot/1.0 (servidor privado de Minecraft)' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return hit?.text || '';
    const data = await res.json();
    const text = extractWikiSyntax(data?.parse?.wikitext?.['*']);
    wikiMem.set(v, { at: Date.now(), text });
    saveWikiCache();
    return text;
  } catch {
    return hit?.text || ''; // sin internet: lo último que se guardó
  }
}

// Pide a la IA una versión corregida del comando, con el error real del servidor, la ayuda del servidor
// (la sintaxis exacta de ESTA versión) y la sintaxis de la wiki
export async function repairCommand({ config, wish, failedCmd, error, serverHelp, wikiSyntax, previous = [] }) {
  const systemPrompt = [
    'Eres un experto en comandos de Minecraft Java Edition (servidor 26.4 snapshot, vanilla, sin plugins).',
    'Un comando acaba de FALLAR. Devuelve el comando corregido que cumpla la misma intención.',
    'REGLAS: 1) La sintaxis de <ayuda_del_servidor> manda: es la de ESTA versión exacta; la wiki es solo apoyo. 2) Componentes de ítems: item[minecraft:componente=valor], textos en SNBT {text:"...",color:"gold"}. 3) Sin "/" inicial. 4) No cambies a quién afecta el comando ni amplíes su alcance (nada de @a si era un jugador). 5) Si no tiene arreglo, devuelve comando vacío "". 6) JSON {"comando": "...", "explicacion": "..."}.'
  ].join('\n');
  const userPrompt = [
    `<orden_original>\n${wish}\n</orden_original>`,
    `<comando_fallido>\n${failedCmd}\n</comando_fallido>`,
    `<error_del_servidor>\n${error}\n</error_del_servidor>`,
    serverHelp ? `<ayuda_del_servidor>\n${serverHelp.slice(0, 1500)}\n</ayuda_del_servidor>` : '',
    wikiSyntax ? `<wiki>\n${wikiSyntax}\n</wiki>` : '',
    previous.length ? `<intentos_que_tambien_fallaron>\n${previous.join('\n')}\n</intentos_que_tambien_fallaron>` : ''
  ].filter(Boolean).join('\n\n');
  const res = await fetch(`${config.ollamaUrl.replace(/\/+$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      model: config.adminModel || config.ollamaModel,
      stream: false,
      think: false,
      keep_alive: config.ollamaKeepAlive || '10m',
      format: { type: 'object', properties: { comando: { type: 'string' }, explicacion: { type: 'string' } }, required: ['comando'] },
      options: { temperature: 0.1, num_predict: 900, num_ctx: 8192 },
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
    })
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  const parsed = parseJsonSafe(data?.message?.content ?? '');
  return { comando: sanitizeRconCommand(parsed?.comando || ''), explicacion: String(parsed?.explicacion || '').slice(0, 200) };
}

// Contexto compacto de Miscolandia para que !admin entienda roles, naciones, religiones, aduana y chat reciente.
export async function buildAdminWorldContext({ bridge = null, memory = null, cfg = null, onlinePlayers = [], worldState = null } = {}) {
  let state = worldState;
  if (!state && bridge) {
    try {
      const res = await bridge.fetchWorld(false);
      state = res?.state || null;
    } catch {}
  }

  const lines = [];
  if (state && bridge) {
    try {
      const era = bridge.getCurrentEra(state);
      const myth = bridge.nat(state, 'myth');
      const scad = bridge.nat(state, 'scad');
      lines.push(`Era actual: ${era.code} (${era.name}).`);
      lines.push(`Gobernantes y naciones: ${myth.player} (rey/gobernante de ${myth.nation}; monopolios: agricultura/flores/abejas, encantamientos, redstone) · ${scad.player} (rey/gobernante de ${scad.nation}; monopolios: ganadería/pesca, metalurgia/forja, alquimia, rieles, construcción).`);
      const NOC_RE = /^notout(?:of)?context$/i;
      const noc = (onlinePlayers || []).find(p => NOC_RE.test(String(p || '')))
        || (cfg?.players?.guests || []).find(g => NOC_RE.test(String(g || '')))
        || 'NotOutContext';
      const otherGuests = (state.guests || [])
        .filter(g => g?.nick && !NOC_RE.test(String(g.nick)))
        .map(g => `${g.nick}${g.name && g.name !== g.nick ? ` (${g.name})` : ''}`);
      lines.push(`Archivista Nacional / Auditor Oficial (nick exacto: ${noc}; alias: "noc", "archivista", "auditor", "notoutofcontext").${otherGuests.length ? ` Otros invitados: ${otherGuests.join(', ')}.` : ''}`);
      const rels = bridge.getReligions(state) || [];
      if (rels.length) {
        lines.push(`Religiones y deidades activas: ${rels.map(r => `${r.faith || r.names[0]} -> dios/es [${r.names.join(', ')}] (${r.people})`).join(' | ')}.`);
      }
    } catch {}
  } else {
    const mythNick = cfg?.players?.myth?.[0] || 'MythStorm';
    const scadNick = cfg?.players?.scad?.[0] || 'Scadrial0523';
    const nocNick = cfg?.players?.guests?.[0] || 'NotOutContext';
    lines.push(`Jugadores principales: ${mythNick} (Nueva Alejandría), ${scadNick} (Luthadel), ${nocNick} (Archivista/Auditor, alias: noc).`);
  }

  if (onlinePlayers.length) {
    lines.push(`Conectados en este instante: ${onlinePlayers.join(', ')}.`);
  }

  if (memory) {
    try {
      const permits = memory.getActivePermits?.() || [];
      if (permits.length) lines.push(`Permisos vigentes: ${permits.slice(0, 4).map(p => memory.describePermit(p)).join('; ')}.`);
      const prohibs = memory.getActiveProhibitions?.() || [];
      if (prohibs.length) lines.push(`Prohibiciones vigentes: ${prohibs.slice(0, 4).map(p => memory.describeProhibition(p)).join('; ')}.`);
      const infr = memory.getInfractions?.(null, 4) || [];
      if (infr.length) lines.push(`Últimas infracciones de Aduana: ${infr.map(e => `${e.player}: ${e.text}`).join(' | ')}.`);
      const chat = memory.getRecentChatText?.(8);
      if (chat) lines.push(`Chat reciente:\n${chat}`);
    } catch {}
  }

  return lines.join('\n').slice(0, 1600);
}

export async function planAdminWish({ config, wish, onlinePlayers = [], worldContext = '', worldState = null }) {
  const clean = String(wish || '').trim();
  if (!clean) {
    return {
      resumen: 'Sin instrucción',
      respuesta_consola: 'Escribe lo que quieras después de !admin (ej. "!admin cierra el servidor en 10 segundos con contador").',
      anuncio_chat: '',
      pasos: []
    };
  }

  const resolved = resolveWishPlayers(clean, onlinePlayers, worldState, config);

  // Cancelación inmediata sin esperar al LLM
  if (CANCEL_RE.test(clean)) {
    return deterministicFallbackPlan(clean);
  }

  // Órdenes comunes (anuncio, título, fuegos artificiales) se resuelven sin IA: instantáneo y siempre igual
  const homer = homerIntents(clean, onlinePlayers);
  if (homer.plan && !homer.complex) return normalizePlan(homer.plan, clean, resolved.targets);

  const systemPrompt = [
    'Eres el Genio Administrador omnipotente del servidor Minecraft Java Edition 26.4-snapshot-10 (Miscolandia).',
    'Traduce las órdenes libres del dueño a un plan JSON con comandos 100% válidos de Minecraft Vanilla 26.4 y total libertad creativa.',
    'CONTEXTO Y ALIAS: Usa SIEMPRE los nicks exactos del jugador indicado en <contexto_miscolandia> o <alias_detectados> (ej. "noc"/"archivista" -> NotOutContext, "luthadel"/"scad" -> Scadrial0523, "alejandria"/"myth" -> MythStorm).',
    'ÓRDENES ABIERTAS Y CREATIVIDAD ("castiga a X", "trollea a X", "hazle una broma", "premia a X", "haz un show", "haz lo que se te dé la gana"):',
    '- NO te limites a un simple mensaje de texto: ejecuta 3 a 6 pasos espectaculares combinando comandos nativos 26.4.',
    '- Para CASTIGOS / BROMAS creativas sobre un jugador J: combina título/subtítulo dramático (title J title ...), sonidos tensos (execute at J run playsound minecraft:entity.elder_guardian.curse master @a ~ ~ ~ 1 0.6), partículas (execute at J run particle minecraft:witch ~ ~1 ~ 1 1 1 0.08 80), rayos teatrales (execute at J run summon minecraft:lightning_bolt ~ ~ ~), efectos temporales divertidos con ENTERO en segundos SIN letra "s" (ej: effect give J minecraft:levitation 4 1, effect give J minecraft:slow_falling 10 0, effect give J minecraft:nausea 10 0, effect give J minecraft:glowing 45 0, effect give J minecraft:blindness 5 0, effect give J minecraft:slowness 15 1), daño leve no letal (damage J 2 minecraft:magic), teletransporte vertical corto (execute as J at @s run tp @s ~ ~6 ~), o invocación cómica de mobs inofensivos con nombre SNBT (execute at J run summon minecraft:chicken ~1 ~ ~ {CustomName:{text:"Inspector de Aduana",color:"gold"}}) y objetos broma (give J minecraft:rotten_flesh[minecraft:custom_name={text:"Multa Divina",color:"red",italic:false}] 1) con delay_sec escalonado (0, 1.5, 3...).',
    '- Para PREMIOS / CELEBRACIONES: combina fuegos artificiales, title, xp add, efectos positivos cortos (luck, speed, regeneration, haste) y regalos temáticos con minecraft:custom_name y minecraft:lore en SNBT.',
    'REGLAS DE SINTAXIS VANILLA 26.4:',
    '1. Sin "/" inicial en "comando" (ej: "time set day", nunca "/time set day").',
    '2. Servidor 100% Vanilla sin plugins (NO existen /fly, /god, /home, /tpa, /broadcast, /countdown, /mute, /jail). Usa comandos reales: time, weather, tp, give, effect, summon, damage, attribute, title, tellraw, playsound, particle, gamerule, difficulty, gamemode, xp, clear, bossbar, setblock, save-all, stop, whitelist, ban, pardon, kick. Recuerda: en effect give el tiempo es un entero SIN "s" (ej. 15 0, nunca 15s).',
    '3. Componentes y nombres en 26.4 usan SNBT compuesto sin comillas simples alrededor (CustomName:{text:"...",color:"gold"}, minecraft:custom_name={text:"...",color:"gold",italic:false}). NUNCA uses CustomName:\'{...}\' ni {display:{Name:...}}.',
    '4. Fuegos artificiales en 26.4 (usa has_twinkle:true,has_trail:true, nunca "flicker"): execute as @a at @s run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:20,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:1,explosions:[{shape:"large_ball",colors:[I;16755200,5636095],has_twinkle:true,has_trail:true}]}}}}',
    '5. Cuentas regresivas ("en N segundos con contador"): usa UN SOLO paso tipo:"countdown" con segundos, titulo, subtitulo con "{s}", color, bossbar:true, mensaje_final y comandos_finales (["save-all","stop"] si cierra el servidor).',
    '6. Cancelar contador: tipo:"cancel_countdown". Anuncio solo chat/pantalla: tipo:"broadcast" (pantalla:true para título grande).',
    '7. LÍMITES ANTI-GRIEF: salvo que el admin lo pida con esas palabras exactas, NUNCA uses ban/kick/op/stop/whitelist/clear completo ni invoques wither/ender_dragon/warden/tnt/lava.',
    '8. Devuelve JSON válido con resumen, respuesta_consola, anuncio_chat y entre 3 y 8 pasos concisos como máximo (no repitas comandos ni llenes campos opcionales vacíos).'
  ].join('\n');

  const userPrompt = [
    worldContext ? `<contexto_miscolandia>\n${worldContext}\n</contexto_miscolandia>` : `Jugadores conectados: ${onlinePlayers.length ? onlinePlayers.join(', ') : 'desconocidos'}`,
    resolved.aliasNotes.length ? `<alias_detectados>\n${resolved.aliasNotes.join(', ')}\n</alias_detectados>` : '',
    `Petición del administrador: ${clean}`
  ].filter(Boolean).join('\n\n');

  const temps = [0.25, 0.1];
  try {
    let parsed = null;
    let lastParseErr = null;
    for (const temperature of temps) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      let data;
      try {
        const res = await fetch(`${config.ollamaUrl.replace(/\/+$/, '')}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: config.adminModel || config.ollamaModel, // el genio puede usar un modelo más capaz (se usa poco y desde consola)
            stream: false,
            think: false,
            keep_alive: config.adminModel ? '2m' : (config.ollamaKeepAlive || '10m'),
            format: ADMIN_PLAN_SCHEMA,
            options: {
              temperature,
              num_predict: 2600,
              num_ctx: 8192
            },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ]
          })
        });
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        data = await res.json();
      } finally {
        clearTimeout(timer);
      }
      try {
        parsed = parseJsonSafe(data?.message?.content ?? '');
        break;
      } catch (err) {
        lastParseErr = err;
      }
    }
    if (!parsed) throw lastParseErr || new Error('No se pudo parsear plan admin JSON');
    const normalized = patchForgotten(normalizePlan(parsed, clean, resolved.targets), clean, onlinePlayers);
    if (!normalized.pasos.length) {
      const fb = deterministicFallbackPlan(clean);
      if (fb) return normalizePlan(fb, clean, resolved.targets);
    }
    return normalized;
  } catch (err) {
    const fb = deterministicFallbackPlan(clean);
    if (fb) return normalizePlan(fb, clean, resolved.targets);
    // Si la IA falló pero había partes que el intérprete sí entendió, al menos se hacen esas
    if (homer.plan) return normalizePlan(homer.plan, clean, resolved.targets);
    throw err;
  }
}

export class AdminGenie {
  constructor({ cfg, rcon, bridge = null, memory = null, onLog = console.log, onBeforeStop = null, tickMs = 1000 } = {}) {
    this.cfg = cfg;
    this.rcon = rcon;
    this.bridge = bridge;
    this.memory = memory;
    this.onLog = onLog;
    this.onBeforeStop = onBeforeStop;
    this.tickMs = Math.max(10, Number(tickMs) || 1000);
    this.activeCountdown = null;
    this.pendingTimers = new Set();
    this.currentTargets = null;
  }

  hasActiveCountdown() {
    return Boolean(this.activeCountdown);
  }

  _trackTimer(id) {
    this.pendingTimers.add(id);
    return id;
  }

  _clearTimer(id) {
    clearTimeout(id);
    clearInterval(id);
    this.pendingTimers.delete(id);
  }

  async _safeSend(cmd, errors) {
    const clean = sanitizeRconCommand(cmd);
    if (!clean) return '';
    try {
      if (/^stop\b/i.test(clean) && typeof this.onBeforeStop === 'function') {
        await this.onBeforeStop();
      }
      const res = await this.rcon.send(clean);
      if (RCON_ERROR_RE.test(String(res || '').trim())) {
        errors?.push(`${clean} -> ${res}`);
        this.onLog(`[Admin RCON aviso] "${clean}": ${res}`);
      } else if (res && String(res).trim()) {
        this.onLog(`[Admin RCON] ${clean} -> ${String(res).trim()}`);
      }
      return res;
    } catch (err) {
      errors?.push(`${clean} -> ${err.message}`);
      this.onLog(`[Admin RCON error] "${clean}": ${err.message}`);
      return '';
    }
  }

  async cancelCountdown({ announce = true } = {}) {
    if (!this.activeCountdown) return false;
    const cur = this.activeCountdown;
    this.activeCountdown = null;
    cur.cancelled = true;
    this._clearTimer(cur.intervalId);
    try { await this.rcon.send(`bossbar remove ${BOSSBAR_ID}`); } catch {}
    if (announce) {
      try {
        await this.rcon.tellraw('@a', [
          '',
          { text: '[Admin] ', color: 'gold', bold: true },
          { text: 'Cuenta regresiva cancelada desde consola.', color: 'yellow' }
        ]);
        await this.rcon.send(`title @a actionbar ${JSON.stringify({ text: 'Cuenta regresiva cancelada', color: 'yellow' })}`);
      } catch {}
    }
    cur.resolve();
    this.onLog('[Admin] Cuenta regresiva cancelada.');
    return true;
  }

  stopAll() {
    if (this.activeCountdown) {
      const cur = this.activeCountdown;
      this.activeCountdown = null;
      cur.cancelled = true;
      this._clearTimer(cur.intervalId);
      cur.resolve();
    }
    for (const id of [...this.pendingTimers]) {
      this._clearTimer(id);
    }
  }

  async _runCountdown(step, errors) {
    await this.cancelCountdown({ announce: false });

    const total = Math.max(1, Math.min(600, Math.round(step.segundos || 10)));
    const textColor = normalizeColor(step.color, 'red');
    const barColor = BOSSBAR_COLOR_MAP[textColor] || 'red';
    const rawTitle = step.titulo || 'Cuenta regresiva';
    const rawSub = step.subtitulo || 'En {s}s';

    const renderTick = async s => {
      const titleHasS = rawTitle.includes('{s}');
      const subHasS = rawSub.includes('{s}');
      const titleText = titleHasS ? rawTitle.replaceAll('{s}', String(s)) : rawTitle;
      const subText = subHasS ? rawSub.replaceAll('{s}', String(s)) : `${rawSub} (${s}s)`;
      const barText = `${titleText.replaceAll(`${s}s`, '').trim() || 'Admin'} — ${s}s`;

      await this._safeSend(`title @a times 0 25 5`, errors);
      await this._safeSend(`title @a subtitle ${JSON.stringify({ text: subText, color: 'yellow' })}`, errors);
      await this._safeSend(`title @a title ${JSON.stringify({ text: titleHasS ? titleText : `${s}`, color: textColor, bold: true })}`, errors);
      await this._safeSend(`title @a actionbar ${JSON.stringify({ text: `${titleText} · ${s}s`, color: 'gold', bold: true })}`, errors);

      if (step.bossbar) {
        await this._safeSend(`bossbar set ${BOSSBAR_ID} name ${JSON.stringify({ text: barText, color: textColor, bold: true })}`, errors);
        await this._safeSend(`bossbar set ${BOSSBAR_ID} value ${s}`, errors);
      }

      if (s === total || s === 10 || s === 5 || s <= 3) {
        await this.rcon.tellraw('@a', [
          '',
          { text: '[Admin] ', color: 'gold', bold: true },
          { text: `${titleText}: ${s}s`, color: s <= 3 ? 'red' : 'white', bold: s <= 3 }
        ]).catch(() => {});
      }

      if (step.sonido) {
        const pitch = s <= 3 ? '1.5' : '1.0';
        const snd = s <= 3 ? step.sonido : 'minecraft:block.note_block.hat';
        await this._safeSend(`execute as @a at @s run playsound ${snd} master @s ~ ~ ~ 0.85 ${pitch}`, errors);
      }
    };

    if (step.bossbar) {
      try { await this.rcon.send(`bossbar remove ${BOSSBAR_ID}`); } catch {}
      await this._safeSend(`bossbar add ${BOSSBAR_ID} ${JSON.stringify({ text: rawTitle.replaceAll('{s}', String(total)), color: textColor })}`, errors);
      await this._safeSend(`bossbar set ${BOSSBAR_ID} color ${barColor}`, errors);
      await this._safeSend(`bossbar set ${BOSSBAR_ID} style progress`, errors);
      await this._safeSend(`bossbar set ${BOSSBAR_ID} max ${total}`, errors);
      await this._safeSend(`bossbar set ${BOSSBAR_ID} players @a`, errors);
    }

    let remaining = total;
    await renderTick(remaining);

    return new Promise(resolve => {
      const state = {
        cancelled: false,
        intervalId: null,
        resolve
      };
      this.activeCountdown = state;

      state.intervalId = this._trackTimer(setInterval(async () => {
        if (state.cancelled) return;
        remaining -= 1;
        if (remaining > 0) {
          await renderTick(remaining);
          return;
        }

        // Llegó a 0
        this._clearTimer(state.intervalId);
        if (this.activeCountdown === state) this.activeCountdown = null;

        if (step.bossbar) {
          try { await this.rcon.send(`bossbar remove ${BOSSBAR_ID}`); } catch {}
        }
        const finalMsg = step.mensaje_final || '¡Tiempo cumplido!';
        await this._safeSend(`title @a times 5 40 15`, errors);
        await this._safeSend(`title @a title ${JSON.stringify({ text: finalMsg, color: textColor, bold: true })}`, errors);
        await this.rcon.tellraw('@a', [
          '',
          { text: '[Admin] ', color: 'gold', bold: true },
          { text: finalMsg, color: textColor, bold: true }
        ]).catch(() => {});
        await this._safeSend(`execute as @a at @s run playsound minecraft:block.note_block.pling master @s ~ ~ ~ 1.0 1.8`, errors);

        for (const cmd of step.comandos_finales || []) {
          await this._safeSend(cmd, errors);
        }
        resolve();
      }, this.tickMs));
    });
  }

  async _executeStep(step, errors) {
    if (step.tipo === 'cancel_countdown') {
      await this.cancelCountdown({ announce: true });
      return;
    }
    if (step.tipo === 'broadcast') {
      await this.rcon.tellraw('@a', [
        '',
        { text: '[Admin] ', color: 'gold', bold: true },
        { text: step.texto, color: normalizeColor(step.color, 'white') }
      ]);
      if (step.pantalla) {
        await this._safeSend(`title @a times 10 50 15`, errors);
        await this._safeSend(`title @a title ${JSON.stringify({ text: step.texto.slice(0, 60), color: normalizeColor(step.color, 'gold'), bold: true })}`, errors);
      }
      return;
    }
    if (step.tipo === 'command') {
      await this._sendWithRepair(step.comando, errors);
      return;
    }
    if (step.tipo === 'countdown') {
      await this._runCountdown(step, errors);
    }
  }

  // Ejecuta; si el servidor lo rechaza, consulta la sintaxis real y pide a la IA un arreglo (máx. 2 intentos).
  // Cada arreglo vuelve a pasar por los candados de seguridad con la orden original.
  // "Quítale los diamantes" NO puede vaciar el inventario: un clear solo quita (a) lo que el propio genio
  // le dio hace poco, (b) una cantidad que la orden dice con número, o (c) todo si la orden dice "todos los".
  _guardClear(cmd) {
    const m = cmd.match(/^(clear\s+)(\S+)(?:\s+(\S+?))?(?:\s+(\d+))?\s*$/i);
    if (!m) return { cmd };
    const [, head, target, item, countTxt] = m;
    const w = String(this.currentWish || '').toLowerCase();
    if (/\b(todos|todas|todo)\s+(?:los|las|el|su|sus)\b|\bvac[ií]a\b|\btodo\s+el\s+inventario\b/.test(w)) return { cmd };
    if (!item) return { blocked: 'clear sin ítem vaciaría todo el inventario' };
    const itemId = item.replace(/\[.*$/, '').replace(/^minecraft:/, '');
    const recent = (this.given || []).filter(g => g.player.toLowerCase() === target.toLowerCase() && g.item === itemId && Date.now() - g.ts < 3 * 3_600_000);
    const givenCount = recent.reduce((a, g) => a + g.count, 0);
    const wishNumber = Number((w.match(/\b(\d{1,4})\b/) || [])[1]) || 0;
    if (givenCount > 0) {
      const n = Math.min(givenCount, Number(countTxt) || givenCount);
      return { cmd: `${head}${target} ${item} ${n}`, note: `solo los ${n} que el genio le dio` };
    }
    if (countTxt && wishNumber && Number(countTxt) <= wishNumber) return { cmd };
    return { blocked: `quitar ${itemId} sin cantidad borraría TODO lo que tiene; di cuántos ("quítale 3 diamantes") o "todos los diamantes"` };
  }

  _recordGive(cmd, res) {
    const m = cmd.match(/^give\s+(\S+)\s+(\S+?)(?:\[.*\])?(?:\s+(\d+))?\s*$/i);
    if (!m || !/\bGave\b/i.test(res)) return;
    const players = m[1].startsWith('@') ? [] : [m[1]];
    this.given = [...(this.given || []), ...players.map(p => ({ ts: Date.now(), player: p, item: m[2].replace(/^minecraft:/, ''), count: Number(m[3]) || 1 }))].slice(-100);
  }

  async _sendWithRepair(cmd, errors, maxTries = 2) {
    let current = cmd;
    const guard = this._guardClear(current);
    if (guard.blocked) {
      errors.push(`${current} -> bloqueado: ${guard.blocked}`);
      this.onLog(`[Admin] Bloqueado: ${guard.blocked}`);
      return '';
    }
    if (guard.note) this.onLog(`[Admin] Ajustado (${guard.note}): ${guard.cmd}`);
    current = guard.cmd;
    const tried = [];
    for (let attempt = 0; attempt <= maxTries; attempt++) {
      const before = errors.length;
      const res = String(await this._safeSend(current, errors) || '');
      if (errors.length === before) {
        this._recordGive(current, res);
        if (attempt > 0) this.onLog(`[Admin] Corregido al intento ${attempt + 1}: ${current}`);
        return res;
      }
      if (attempt === maxTries || !this.currentWish) break;
      tried.push(`${current} -> ${res.slice(0, 160)}`);
      const verb = (current.match(/^(?:execute\s+.*?\brun\s+)?([a-z_-]+)/i) || [])[1] || '';
      let serverHelp = '';
      try { serverHelp = String(await this.rcon.send(`help ${verb}`)); } catch { /* sin ayuda */ }
      const wikiSyntax = await fetchWikiSyntax(verb);
      let fixed;
      try {
        fixed = await repairCommand({ config: this.cfg, wish: this.currentWish, failedCmd: current, error: res, serverHelp, wikiSyntax, previous: tried });
      } catch (err) {
        this.onLog(`[Admin] No se pudo pedir corrección: ${err.message}`);
        break;
      }
      const why = fixed.comando ? riskyReason(fixed.comando, this.currentWish, this.currentTargets) : 'sin arreglo';
      if (why || fixed.comando === current) {
        this.onLog(`[Admin] Corrección descartada (${why || 'igual al anterior'}).`);
        break;
      }
      this.onLog(`[Admin] Reintentando: ${fixed.comando}${fixed.explicacion ? ` (${fixed.explicacion})` : ''}`);
      errors.pop(); // el error queda como "en corrección"; si el reintento falla se vuelve a anotar
      current = fixed.comando;
    }
    return '';
  }

  async fulfill(wish, { dryRun = false, onlinePlayers = null, worldContext = null, worldState = null } = {}) {
    this.currentWish = wish;
    let players = Array.isArray(onlinePlayers) ? onlinePlayers : [];
    if (!onlinePlayers && !dryRun) {
      try {
        const listRes = await this.rcon.send('list');
        const m = String(listRes || '').match(/online:\s*(.*)$/i);
        if (m && m[1].trim()) {
          players = m[1].split(',').map(s => s.trim()).filter(Boolean);
        }
      } catch {}
    }

    let state = worldState;
    if (!state && this.bridge) {
      try {
        const res = await this.bridge.fetchWorld(false);
        state = res?.state || null;
      } catch {}
    }

    this.currentTargets = resolveWishPlayers(wish, players, state, this.cfg).targets;
    const contextStr = worldContext !== null
      ? String(worldContext || '')
      : await buildAdminWorldContext({ bridge: this.bridge, memory: this.memory, cfg: this.cfg, onlinePlayers: players, worldState: state });

    const plan = await planAdminWish({ config: this.cfg, wish, onlinePlayers: players, worldContext: contextStr, worldState: state });
    this.onLog(`[Admin] Plan: ${plan.resumen} (${plan.pasos.length} paso(s))`);

    if (dryRun) {
      return { ...plan, ok: true, errors: [], completionPromise: Promise.resolve() };
    }

    const errors = [];
    if (plan.anuncio_chat) {
      await this.rcon.tellraw('@a', [
        '',
        { text: '[Admin] ', color: 'gold', bold: true },
        { text: plan.anuncio_chat, color: 'white' }
      ]).catch(err => errors.push(err.message));
    }

    const bgTasks = [];
    for (const step of plan.pasos) {
      const delayMs = Math.max(0, Math.round((Number(step.delay_sec) || 0) * this.tickMs));
      if (delayMs > 0) {
        const p = new Promise(resolve => {
          const tid = this._trackTimer(setTimeout(async () => {
            this.pendingTimers.delete(tid);
            // Un paso diferido que falla (RCON caído) no debe tumbar el bot con un rechazo sin atrapar
            try {
              await this._executeStep(step, errors);
            } catch (err) {
              errors.push(`${step.tipo}: ${err.message}`);
              this.onLog(`[Admin error] paso diferido: ${err.message}`);
            }
            resolve();
          }, delayMs));
        });
        bgTasks.push(p);
      } else if (step.tipo === 'countdown') {
        bgTasks.push(this._executeStep(step, errors).catch(err => { errors.push(`countdown: ${err.message}`); }));
      } else {
        await this._executeStep(step, errors);
      }
    }

    const completionPromise = Promise.all(bgTasks).then(() => {
      if (errors.length) {
        this.onLog(`[Admin] Finalizado con ${errors.length} aviso(s).`);
      }
      return { ok: errors.length === 0, errors };
    });

    return {
      ...plan,
      ok: errors.length === 0,
      errors,
      completionPromise
    };
  }
}
