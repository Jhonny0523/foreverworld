import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { RconClient } from './rcon.mjs';
import { SupabaseBridge } from './supabase-bridge.mjs';
import { askModerator, askNpc, buildOllamaOptions, npcOfflineReply, generateRoast, generateSocialMessage, compactSessionMemory } from './ollama.mjs';
import { RuleEnforcer } from './enforcer.mjs';
import { SessionMemory, PERMIT_SCOPES } from './memory.mjs';
import { WorldEvents } from './events.mjs';
import { Deity, SMITES } from './deity.mjs';
import { WebSyncAnnouncer, snapshotWorld, diffWorldSnapshots } from './web-sync.mjs';
import { AdminGenie, buildPatchNotesPlan, extractAdminWish, parseCustomSlidesPlan, planAdminWish, resolveWishPlayers, riskyReason, sanitizeRconCommand, setWikiCachePath } from './admin-genie.mjs';
import {
  COLOR_PALETTE_LIST,
  parseFormattedText,
  extractAuthorOption,
  extractSelectedWritableBook,
  buildWrittenBookComponents,
  buildColoredPaperItemArg,
  buildCertificatePreset,
  deliverWrittenBook
} from './scribe.mjs';

// Palabras que entienden !permiso para cada alcance
const PERMIT_SCOPE_ALIASES = {
  // Generales: todo el monopolio
  agro: 'agro', agricultura: 'agro', semilla: 'agro', semillas: 'agro', cultivo: 'agro', cultivos: 'agro', cosecha: 'agro', huerta: 'agro',
  ganado: 'ganado', ganaderia: 'ganado', 'ganadería': 'ganado', animales: 'ganado', carne: 'ganado',
  aldeanos: 'aldeanos', aldeano: 'aldeanos', comercio: 'aldeanos', tradeo: 'aldeanos', tradear: 'aldeanos',
  // Finos: un solo cultivo, flor, cactus o tinte
  trigo: 'agro:trigo', zanahoria: 'agro:zanahoria', zanahorias: 'agro:zanahoria', papa: 'agro:papa', papas: 'agro:papa',
  remolacha: 'agro:remolacha', remolachas: 'agro:remolacha', 'caña': 'agro:cana', cana: 'agro:cana', azucar: 'agro:cana', 'azúcar': 'agro:cana',
  sandia: 'agro:sandia', 'sandía': 'agro:sandia', sandias: 'agro:sandia', 'sandías': 'agro:sandia', melon: 'agro:sandia', 'melón': 'agro:sandia',
  calabaza: 'agro:calabaza', calabazas: 'agro:calabaza', bayas: 'agro:bayas', baya: 'agro:bayas',
  verruga: 'agro:verrugas', verrugas: 'agro:verrugas', abejas: 'agro:abejas', abeja: 'agro:abejas', miel: 'agro:abejas', colmena: 'agro:abejas', panal: 'agro:abejas', panales: 'agro:abejas',
  flor: 'agro:flores', flores: 'agro:flores', floricultura: 'agro:flores', rosa: 'agro:flores', rosas: 'agro:flores', amapola: 'agro:flores', amapolas: 'agro:flores', margarita: 'agro:flores', margaritas: 'agro:flores', girasol: 'agro:flores', girasoles: 'agro:flores', tulipan: 'agro:flores', tulipanes: 'agro:flores', 'tulipán': 'agro:flores', clavel: 'agro:flores', orquidea: 'agro:flores', peonia: 'agro:flores', lila: 'agro:flores', diente: 'agro:flores',
  cactus: 'agro:cactus',
  tinte: 'agro:tintes', tintes: 'agro:tintes', colorante: 'agro:tintes', colorantes: 'agro:tintes',
  // Finos: un solo tipo de animal
  vaca: 'ganado:vacas', vacas: 'ganado:vacas', cuero: 'ganado:vacas', leche: 'ganado:vacas', 'champiñaca': 'ganado:vacas',
  cerdo: 'ganado:cerdos', cerdos: 'ganado:cerdos', oveja: 'ganado:ovejas', ovejas: 'ganado:ovejas', lana: 'ganado:ovejas',
  gallina: 'ganado:gallinas', gallinas: 'ganado:gallinas', pollo: 'ganado:gallinas', pollos: 'ganado:gallinas', huevo: 'ganado:gallinas', huevos: 'ganado:gallinas', plumas: 'ganado:gallinas', pluma: 'ganado:gallinas',
  conejo: 'ganado:conejos', conejos: 'ganado:conejos', calamar: 'ganado:calamares', calamares: 'ganado:calamares', tinta: 'ganado:calamares',
  pesca: 'ganado:pesca', pescar: 'ganado:pesca', peces: 'ganado:pesca', pescado: 'ganado:pesca', 'caña de pescar': 'ganado:pesca',
  cria: 'ganado:cria', 'cría': 'ganado:cria', criar: 'ganado:cria'
};
const PERMIT_OWNER_LABEL = { myth: 'MythStorm (Nueva Alejandría)', scad: 'Scadrial0523 (Luthadel)' };

// "30", "30m", "2h", "3d", "permanente" -> minutos (null = permanente, undefined = no es duración)
// Unidad de tiempo escrita aparte o pegada: s/seg/segundos, m/min/minutos, h/horas, d/días
const DURATION_UNIT_RE = /^(s|seg|segs|segundos?|m|min|mins|minutos?|h|hr|hrs|horas?|d|dias?|días?)$/;
function unitToMinutes(n, unit) {
  const u = String(unit || 'm');
  const mins = u.startsWith('s') ? n / 60 : u.startsWith('h') ? n * 60 : u.startsWith('d') ? n * 1440 : n;
  return Math.max(10 / 60, Math.min(30 * 1440, mins)); // mínimo 10 segundos, máximo 30 días
}
function parsePermitDuration(tok) {
  const t = String(tok || '').toLowerCase();
  if (['permanente', 'siempre', 'indefinido'].includes(t)) return null;
  const m = t.match(/^(\d{1,4})(s|seg|segs|segundos?|m|min|mins|minutos?|h|hr|hrs|horas?|d|dias?|días?)?$/);
  if (!m) return undefined;
  return unitToMinutes(Number(m[1]), m[2]);
}
// Minutos para !trato / !duelo / !pase: acepta "10", "10m", "1h"; si no se entiende, el valor por defecto
function parseWindowMinutes(tok, def = 5) {
  const m = parsePermitDuration(tok);
  return typeof m === 'number' ? m : def;
}
export function fmtMinutes(mins) {
  if (mins < 1) return `${Math.round(mins * 60)} s`;
  if (mins < 60) return `${Math.round(mins)} min`;
  if (mins < 1440) return `${+(mins / 60).toFixed(1)} h`;
  return `${+(mins / 1440).toFixed(1)} días`;
}
// Palabras de relleno que no deben quedar como nota ("flores y cactus y todos sus tintes derivados")
const PERMIT_FILLER = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'por', 'para', 'durante', 'un', 'una', 'unos', 'y', 'a', 'al', 'en', 'solo', 'sólo', 'nada', 'mas', 'más', 'todos', 'todas', 'todo', 'toda', 'sus', 'su', 'derivado', 'derivados', 'derivada', 'derivadas']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(SERVER_DIR, 'moderator-config.json');
const PID_PATH = path.join(SERVER_DIR, 'bot.pid');

function claimSingleInstanceLock() {
  try {
    if (fs.existsSync(PID_PATH)) {
      const oldPid = Number(fs.readFileSync(PID_PATH, 'utf8').trim());
      if (oldPid && oldPid !== process.pid) {
        try {
          process.kill(oldPid, 'SIGTERM');
          console.log(`[Bot] Reemplazando instancia previa (PID ${oldPid})...`);
        } catch {}
      }
    }
    fs.writeFileSync(PID_PATH, String(process.pid), 'utf8');
  } catch (err) {
    console.warn('[PID Lock]', err.message);
  }
}

function releaseSingleInstanceLock() {
  try {
    if (fs.existsSync(PID_PATH) && fs.readFileSync(PID_PATH, 'utf8').trim() === String(process.pid)) {
      fs.unlinkSync(PID_PATH);
    }
  } catch {}
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Falta ${CONFIG_PATH}`);
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  cfg.repoRootResolved = path.resolve(SERVER_DIR, cfg.repoRoot || '..');
  cfg.logPathResolved = path.resolve(SERVER_DIR, cfg.logPath || './logs/latest.log');
  return cfg;
}

// ---------- Formateo limpio para chat /tellraw de Minecraft ----------
function buildBadge(text, color = 'gold') {
  return { text: `[${text}] `, color, bold: true };
}

async function sendLine(rcon, target, badge, badgeColor, parts) {
  await rcon.tellraw(target, ['', buildBadge(badge, badgeColor), ...parts]);
}

const SOCIAL_KEYWORD_RE = /\b(ley|norma|pacto|monopolio|era|impuesto|multa|aldean\w*|semilla\w*|trigo|vaca\w*|cerdo\w*|pesc\w*|oe|om|plata|oro|banco|archivo|juez|alguacil|pregonero|miscolandia|luthadel|alejandr[ií]a|c[eé]dul\w*|obra\w*|pr[eé]stam\w*|lore|cr[oó]nica\w*|historia)\b/i;
let chatBanterRuntime = null;
let lastChatBanterAt = 0;

function isChatBanterEnabled(cfg) {
  return chatBanterRuntime === null
    ? cfg.social?.chatBanterEnabled !== false
    : chatBanterRuntime;
}

// Qué productos tienen la recolección manual bloqueada porque ya existe su granja auditada
function farmLocksText(state, bridge) {
  const locks = typeof bridge.D?.activeFarmLocks === 'function' ? bridge.D.activeFarmLocks(state) : [];
  if (!locks.length) return 'Bloqueos por granja: ninguno todavía (fuera de la comida, todo se puede conseguir a mano para uso propio).';
  return 'Bloqueos por granja vigentes (conseguirlo a mano está prohibido para todos menos el dueño; se compra en su tienda o el dueño da !permiso <jugador> <producto>): '
    + locks.map(x => `${x.lock.label} → granja de ${bridge.nat(state, x.owner)?.nation || x.owner}`).join('; ') + '.';
}

function buildSocialWorldContext(state, bridge, enforcer) {
  const b = bridge.getBriefing(state);
  const alerts = [];
  if (b.pendingWorks > 0) alerts.push(`${b.pendingWorks} obra(s) por auditar`);
  if (b.moras > 0) alerts.push(`${b.moras} préstamo(s) en mora`);
  if (b.noAvalCount > 0) alerts.push(`${b.noAvalCount} normas sin aval`);
  if (b.mythEx > 0) alerts.push(`${b.mythNat} con inflación`);
  if (b.scadEx > 0) alerts.push(`${b.scadNat} con inflación`);
  const online = enforcer?.onlinePlayers?.size ? [...enforcer.onlinePlayers].join(', ') : 'nadie más';
  return `${b.eraCode} (${b.eraName}, ${b.eraProgress}) | Cambio: ${b.fxText} | Alertas: ${alerts.join(', ') || 'sin moras'} | Conectados: ${online} | ${farmLocksText(state, bridge)}`;
}

function computePregoneroStance(state, bridge) {
  const E = bridge.E;
  const b = bridge.getBriefing(state);
  const rate = E.rate(state);
  const CATS = bridge.D.WORK_CATEGORIES || [];
  const mythCap = E.capitalization(state, 'myth', CATS);
  const scadCap = E.capitalization(state, 'scad', CATS);
  const mythDef = E.inDefault(state, 'myth');
  const scadDef = E.inDefault(state, 'scad');
  const works = state?.economy?.works || [];
  const mythWorks = works.filter(w => w.status === 'auditada' && w.owner === 'myth').length;
  const scadWorks = works.filter(w => w.status === 'auditada' && w.owner === 'scad').length;
  const eraIdx = bridge.getCurrentEra(state).index;
  const curTasks = (bridge.D.ERAS?.[eraIdx]?.tasks) || [];
  const mythTasks = curTasks.filter(t => t.who === 'myth' && bridge.isTaskDone(state, t)).length;
  const scadTasks = curTasks.filter(t => t.who === 'scad' && bridge.isTaskDone(state, t)).length;

  const mythScore = (rate > 1.04 ? 2 : 0) - (b.mythEx > 0 ? 3 : 0) - (mythDef ? 4 : 0)
    + (mythCap > scadCap + 10 ? 1 : 0) + (mythWorks > scadWorks ? 1 : 0) + (mythTasks > scadTasks + 1 ? 1 : 0);
  const scadScore = (rate < 0.96 ? 2 : 0) - (b.scadEx > 0 ? 3 : 0) - (scadDef ? 4 : 0)
    + (scadCap > mythCap + 10 ? 1 : 0) + (scadWorks > mythWorks ? 1 : 0) + (scadTasks > mythTasks + 1 ? 1 : 0);

  if (mythScore >= scadScore + 2) {
    return `POSTURA ACTUAL: A FAVOR DE ${b.mythNat} (por números reales: 1 DR = ${rate.toFixed(3)} CU, respaldo ${E.fmt(mythCap)} vs ${E.fmt(scadCap)}, obras aprobadas ${mythWorks} vs ${scadWorks}). Hoy reconoces que ${b.mythNat} lleva mejor la caja y le tiras pullas divertidas a ${b.scadNat} (aun si te habla Scadrial0523), sin adular a MythStorm.`;
  }
  if (scadScore >= mythScore + 2) {
    return `POSTURA ACTUAL: A FAVOR DE ${b.scadNat} (por números reales: 1 DR = ${rate.toFixed(3)} CU, respaldo ${E.fmt(scadCap)} vs ${E.fmt(mythCap)}, obras aprobadas ${scadWorks} vs ${mythWorks}). Hoy reconoces que ${b.scadNat} va mejor parado y le tiras pullas divertidas a ${b.mythNat} (aun si te habla MythStorm), sin adular a Scadrial0523.`;
  }
  const earlyHint = eraIdx <= 1 && b.reqDone < 4
    ? `Están apenas arrancando ${b.eraCode} (solo tocan casas, bóvedas, huerta, corrales y bancos; no esperes metros ni megaobras).`
    : `Llevan ${b.eraProgress} en ${b.eraCode} y ${b.pendingWorks} obra(s) por auditar.`;
  return `POSTURA ACTUAL: ORGULLOSAMENTE INDEPENDIENTE EN MISCOLANDIA. ${b.mythNat} y ${b.scadNat} van parejos (1 DR = ${rate.toFixed(3)} CU). ${earlyHint} Te mantienes neutral con humor callejero y, si cualquiera pregunta cuál Estado es mejor, dices que ninguno saca ventaja clara todavía y que prefieres ser libre en Miscolandia.`;
}

async function handleJoin(player, ctx) {
  const { cfg, bridge, rcon, enforcer, memory, deity, webSync } = ctx;
  try {
    memory?.recordEvent('event', `${player} se conectó al servidor`);
    webSync?.scheduleLiveSync?.(1500);
    await new Promise(r => setTimeout(r, 1800));
    const { state } = await bridge.fetchWorld(true);
    const b = bridge.getBriefing(state);
    if (deity) {
      await deity.deliverPendingHolidayRewards(player, state).catch(e => console.warn('[Join holiday]', e.message));
    }
    if (cfg.social?.joinAi !== false) {
      const role = enforcer.getPlayerRole(player, state);
      const greeting = await generateSocialMessage({
        config: cfg,
        kind: 'join',
        player,
        role,
        recentChat: memory?.getRecentChatForSocial(10) || [],
        worldContext: buildSocialWorldContext(state, bridge, enforcer),
        eraContext: bridge.getEraExpectationsSummary(state),
        stanceContext: computePregoneroStance(state, bridge),
        loreContext: bridge.getLoreAndChroniclesContext(state, player, { compact: true }),
        memoryContext: memory?.getPersistentMemoryText({ maxSessions: 4, maxNotes: 8 }) || ''
      });
      if (greeting) {
        memory?.recordBotMessage('Pregonero', greeting);
        await sendLine(rcon, '@a', 'Pregonero', 'light_purple', [
          { text: greeting, color: 'white' }
        ]);
      }
    }
    const alerts = [];
    if (b.pendingWorks > 0) alerts.push(`${b.pendingWorks} obra(s) por auditar`);
    if (b.noAvalCount > 0) alerts.push(`${b.noAvalCount}/${b.icTotal} sin aval`);
    if (b.moras > 0) alerts.push(`${b.moras} mora(s)`);
    if (b.mythEx > 0) alerts.push(`${b.mythNat} c/inflación`);
    if (b.scadEx > 0) alerts.push(`${b.scadNat} c/inflación`);
    await sendLine(rcon, player, 'Miscolandia', 'aqua', [
      { text: `${b.eraCode} (${b.eraProgress}) · ${b.fxText}`, color: 'gold' },
      ...(alerts.length ? [{ text: ` · ${alerts.join(' · ')}`, color: 'yellow' }] : []),
      { text: ' · Habla con un NPC o usa ', color: 'gray' },
      { text: '!ayuda', color: 'aqua', bold: true }
    ]);
    const recaps = webSync?.getRecentHighlights?.() || [];
    if (recaps.length) {
      await sendLine(rcon, player, 'Mientras no estabas', 'gold', [
        { text: recaps.slice(0, 3).join(' · '), color: 'white' }
      ]);
    }
  } catch (err) {
    console.error(`[Join ${player}]`, err.message);
  }
}

async function handleLeave(player, { cfg, bridge, rcon, enforcer, memory, webSync }) {
  try {
    memory?.recordEvent('event', `${player} se desconectó del servidor`);
    webSync?.scheduleLiveSync?.(1000);
    if (cfg.social?.leaveAi === false) return;
    if (!enforcer.onlinePlayers.size) return;
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    const farewell = await generateSocialMessage({
      config: cfg,
      kind: 'leave',
      player,
      role,
      recentChat: memory?.getRecentChatForSocial(10) || [],
      worldContext: buildSocialWorldContext(state, bridge, enforcer),
      eraContext: bridge.getEraExpectationsSummary(state),
      stanceContext: computePregoneroStance(state, bridge),
      loreContext: bridge.getLoreAndChroniclesContext(state, player, { compact: true }),
      memoryContext: memory?.getPersistentMemoryText({ maxSessions: 4, maxNotes: 8 }) || ''
    });
    if (farewell) {
      memory?.recordBotMessage('Pregonero', farewell);
      await sendLine(rcon, '@a', 'Pregonero', 'light_purple', [
        { text: farewell, color: 'white' }
      ]);
    }
  } catch (err) {
    console.error(`[Leave ${player}]`, err.message);
  }
}

async function handleDeathAlert(line, bridge, rcon) {
  const codeMatch = line.match(/\[(CC|CA)-[A-Z]+-\d+\]/i);
  if (!codeMatch) return;
  const code = codeMatch[0].slice(1, -1).toUpperCase();
  try {
    const { state } = await bridge.fetchWorld(false);
    const matches = bridge.findCedula(state, code);
    const entry = matches[0];
    const who = entry ? `${entry.name} (${entry.cedula} · ${entry.kindLabel} de ${entry.nation})` : code;
    await sendLine(rcon, '@a', 'TRD 150-01', 'red', [
      { text: `Alerta censal: baja detectada de `, color: 'white' },
      { text: who, color: 'gold', bold: true },
      { text: `. Documentar causa (Ley 002 / Circular 002) sin borrar el folio.`, color: 'gray' }
    ]);
  } catch (err) {
    console.error('[DeathAlert]', err.message);
  }
}

const COMMAND_DOCS = {
  duda: 'Pregunta libre a la IA sobre leyes, Eras, monopolios, economía o comandos. Uso: !duda <tu pregunta> (ej: !duda puedo hacer un metro?).',
  era: 'Muestra la Era actual (permitido/prohibido), o responde una pregunta sobre ella. Uso: !era  ó  !era <pregunta>.',
  hitos: 'Muestra qué hitos obligatorios faltan para pasar a la siguiente Era y el progreso global. Uso: !hitos.',
  obras: 'Muestra puntos de respaldo en obras auditadas y las obras pendientes para NotOutContext. Uso: !obras.',
  pacto: 'Muestra el Pacto de Monopolios y gremios, o responde dudas sobre sectores. Uso: !pacto [sector o pregunta].',
  trato: 'Pausa monopolios y PvP un rato para pasarse comida o ítems sin que interfiera. Uso: !trato [min] (ej: !trato 5) y !trato fin al acabar.',
  duelo: 'Autoriza PvP consensuado temporalmente sin regaños OOC. Uso: !duelo [min] y !duelo fin al acabar.',
  pase: 'Da salvoconducto temporal a 1 jugador (o a todos con !pase todos). Uso: !pase <jugador> [min].',
  permiso: 'Permiso o prohibición expresa que no se borra al reiniciar. MythStorm autoriza o prohíbe agricultura/semillas/flores/cactus/tintes/abejas; Scadrial0523 autoriza o prohíbe ganadería/pesca; cualquiera de los dos, aldeanos. Productos con granja (hierro, oro, blaze, slime, madera…): solo el dueño de la granja. Uso: !permiso <jugador> [semillas|flores|cactus|tintes|trigo|ganado|gallinas|aldeanos|hierro…] [30m|2h|3d|permanente] [nota] · !permiso prohibir <jugador> [recurso] [tiempo] [nota] · !permiso quitar <jugador> [recurso] · !permisos [jugador].',
  mod: 'Muestra si la vigilancia automática está activa o la pausa/reanuda. Uso: !mod [on|off].',
  chat: 'Activa o silencia los comentarios espontáneos de [Pregonero]. Uso: !chat [on|off].',
  tasa: 'Muestra la tasa cambiaria Dracma/Cuarto y reservas del Banco. Uso: !tasa.',
  saldo: 'Muestra los tesoros y saldos de Nueva Alejandría, Luthadel, invitados y Cámara. Uso: !saldo.',
  precio: 'Busca precios oficiales del catálogo de tiendas. Uso: !precio <producto> (ej: !precio trigo).',
  cedula: 'Consulta aldeanos o mascotas inscritos en TRD 150-01. Uso: !cedula <nombre o código>.',
  ley: 'Consulta leyes e historia IC de Miscolandia con citas exactas. Uso: !ley <tu pregunta>.',
  juez: 'Pide mediación imparcial de conflicto y sanción sugerida. Uso: !juez <relato del caso>.',
  manual: 'Explica reglas económicas, cambio, préstamos y respaldo del manual. Uso: !manual <tu pregunta>.',
  ooc: 'Responde dudas técnicas OOC, reglas de Eras o uso del bot. Uso: !ooc <tu pregunta>.',
  lore: 'Muestra el lore oficial del mundo y últimas crónicas de la web, o responde una pregunta de historia. Uso: !lore [pregunta].',
  memoria: 'Muestra los recuerdos de sesiones pasadas y notas guardadas. Fundadores: !memoria compactar | !memoria limpiar.',
  recuerda: 'Guarda un dato o acuerdo importante en la memoria permanente del Pregonero. Uso: !recuerda <dato>.',
  certificado: 'Exclusivo Archivista (NotOutContext): convierte tu Libro y Pluma en libro firmado con colores (&6, &a, &l, &#RRGGBB). Uso: !certificado <Título> (en mano) | !certificado <Título> | <Texto> | !certificado aval/obra/residencia/paz ... Añade autor: <NotOutContext y MythStorm> al final para 2 o más autores.',
  papel: 'Exclusivo Archivista (NotOutContext): sella 1 papel real de tu inventario con nombre/subtítulo en colores (&). Uso: !papel <&6&lNombre> [| &7Subtítulo].',
  colores: 'Muestra la paleta de códigos &0-&f, &l/&o/&n/&m/&r y &#RRGGBB para !certificado y !papel.',
  evento: 'Eventos del mundo: qué está pasando y cuándo podría tocar el próximo. Uso: !evento · !evento lista · fundadores: !evento lanzar <id> | !evento on|off.',
  yo: 'Tu ficha: rol, permisos y prohibiciones vigentes, infracciones recientes y, si eres fundador, el tesoro y la mercancía en custodia de tu Estado. Uso: !yo.',
  expediente: 'Expediente de la Fiscalía: últimas infracciones registradas por la Aduana (persisten entre sesiones). Uso: !expediente [jugador].',
  pagar: 'Transfiere dinero real al instante en Supabase y el Libro Mayor (TRD 130-01). Uso: !pagar <jugador> <monto> [DR|CU|OE].',
  cronica: 'Publica una crónica oficial en la web (Lore -> Crónicas). Uso: !cronica [Título |] <texto>.',
  portal: 'Guarda un portal usando tus coordenadas reales y calcula su par Nether (/8). Uso: !portal guardar <nombre>.',
  estacion: 'Guarda una estación ferroviaria con tus coordenadas exactas en Territorio. Uso: !estacion guardar <nombre> [| línea].',
  gps: 'Calcula distancia exacta, dirección cardinal y ruta por Nether hacia cualquier portal, estación u obra de la web. Uso: !gps <destino>.',
  contrato: 'Tablón de encargos de Economía: lista, acepta, entrega o liquida contratos. Uso: !contratos · !contrato aceptar <n> · !contrato entregar <n> · !contrato pagar <n>.',
  ofrenda: 'Presenta 1 ítem sagrado en mano ante tu dios (oro, diamante, flor, vela...). Uso: !ofrenda.',
  estudio: 'Para el camino de La Razón: entrega 1 libro, papel, mapa, brújula o catalejo en mano al estudio. Uso: !estudio.',
  fiesta: 'Muestra la festividad colombiana/internacional activa o próxima y tus tareas/premios pendientes. Uso: !fiesta.',
  resumen: 'Compila el diario de eventos de esta sesión. Usa !resumen publicar para guardarlo en Lore -> Crónicas.',
  novedades: 'Muestra las notas del parche de Miscolandia. Fundadores: !novedades show (o !patchnotes show) reproduce la presentación multi-pantalla para todos.',
  anuncios: 'Activa o pausa los anuncios instantáneos en Minecraft cuando alguien edita la web. Uso: !anuncios [on|off].',
  ranking: 'Marcador vivo de Miscolandia: Era actual, respaldo en obras, cédulas, crónicas, contratos y festividades. Uso: !ranking.'
};

const COMMAND_ALIASES = {
  pregunta: 'duda',
  preguntar: 'duda',
  ia: 'duda',
  bot: 'duda',
  alguacil: 'duda',
  eras: 'era',
  faltan: 'hitos',
  progreso: 'hitos',
  auditoria: 'obras',
  auditorias: 'obras',
  monopolio: 'pacto',
  monopolios: 'pacto',
  comercio: 'trato',
  libre: 'trato',
  tregua: 'trato',
  volver: 'trato',
  pvp: 'duelo',
  cambio: 'tasa',
  saldos: 'saldo',
  tesoro: 'saldo',
  precios: 'precio',
  'cédula': 'cedula',
  censo: 'cedula',
  reglas: 'ooc',
  pregonero: 'chat',
  cronicas: 'lore',
  'crónicas': 'lore',
  historia: 'lore',
  recuerdos: 'memoria',
  anota: 'recuerda',
  apunta: 'recuerda',
  permisos: 'permiso',
  autorizo: 'permiso',
  autorizar: 'permiso',
  sellar: 'certificado',
  cert: 'certificado',
  libro: 'certificado',
  color: 'colores',
  formato: 'colores',
  eventos: 'evento',
  perfil: 'yo',
  ficha: 'yo',
  multas: 'expediente',
  historial: 'expediente',
  infracciones: 'expediente',
  transferir: 'pagar',
  enviar: 'pagar',
  pay: 'pagar',
  'crónica': 'cronica',
  'estación': 'estacion',
  donde: 'gps',
  'dónde': 'gps',
  ruta: 'gps',
  contratos: 'contrato',
  encargo: 'contrato',
  encargos: 'contrato',
  festividad: 'fiesta',
  festividades: 'fiesta',
  temporada: 'fiesta',
  diario: 'resumen',
  patchnotes: 'novedades',
  patch: 'novedades',
  changelog: 'novedades',
  anuncio: 'anuncios',
  estadisticas: 'ranking',
  'estadísticas': 'ranking',
  stats: 'ranking',
  marcador: 'ranking',
  top: 'ranking'
};

const BOT_COMMANDS_DOC = [
  'Guía oficial de Miscolandia (habla con los NPCs en el chat + utilidades operativas):',
  '- NO recomiendes comandos de consulta viejos (!era, !ley, !tasa, !saldo, !lore, !duda); diles que hablen directo con el NPC:',
  '  * Arquitecto / Maestro de Obras / Ingeniero: Eras (ERA 0–XIII), qué construir ahora y qué mecánicas están prohibidas.',
  '  * Su Excelencia / Su Señoría / Señor Juez: leyes IC, disputas y multas (con "Excelencia" o "Su Señoría" se pone solemne; "juez" a secas también vale; solo se indigna si lo insultan).',
  '  * Fiscal / Policía / Alguacil / Aduana: pacto de monopolios, contrabando, PvP OOC, tratos y salvoconductos.',
  '  * Banquero / Don Tesoro / Contador: tasa cambiaria DR/CU, reservas de la Cámara, saldos y precios de catálogo.',
  '  * Archivista / Auditor / Cronista / Bibliotecario: auditoría oficial de obras (Manual 003, TRD 120-01), lore del mundo, crónicas (TRD 140-01), cédulas (TRD 150-01) y recuerdos pasados.',
  '  * Cartógrafo / Topógrafo: estaciones, portales (con su equivalencia Overworld↔Nether), obras con coordenadas y moradas del censo registradas en la web.',
  '  * Consejero / Filósofo / Guía / Sacerdote: voz imparcial que evoluciona por jugador (Consejero → Guía → Sacerdote de tu fe o Rector Filósofo) y ayuda a crear tu religión sin venderse al dinero.',
  '  * Pregonero: chismes de la plaza, opinión económica y libreta permanente ("pregonero recuerda que...").',
  '- Utilidades operativas que ejecutan acciones/permisos/registros reales en juego y web: !hitos, !obras, !duelo, !trato, !pase, !mod, !chat, !evento, !yo, !expediente, !memoria, !pagar, !cronica, !portal guardar, !estacion guardar, !gps, !contratos, !ofrenda, !estudio, !fiesta, !resumen, !ranking, !novedades, !anuncios y !ayuda.',
  '- Certificados y sellos oficiales (EXCLUSIVO Archivista NotOutContext): !certificado <Título> (sella en colores el Libro y Pluma en mano consumiéndolo, o !certificado <Título> | <Texto> / aval / obra / residencia / paz con 1 writable_book en inventario; admite autor: <Autor1 y Autor2> para coautoría), !papel <Nombre> [| <Lore>] (consume 1 papel real) y !colores.',
  '- Lo divino: si una fe de la web (Lore → Religiones y fe) le dio nombre a su dios, invocarlo en el chat puede, casi nunca, tener respuesta. NINGÚN NPC habla en nombre de los dioses ni inventa religión, dogmas o milagros.',
  '- Acuerdos en chat: "vamos a hacer un trato" o "pvp consensuado / vamos a hacer un duelo" pausan automáticamente al aduanero.',
  '- Permisos y prohibiciones expresas que no se borran: !permiso <jugador> [semillas|flores|cactus|tintes|ganado|aldeanos] [tiempo|permanente] [nota] · !permiso prohibir <jugador> [recurso] [tiempo] [nota] · !permiso quitar <jugador> [recurso] · !permisos [jugador]. Cada Estado solo autoriza o prohíbe su monopolio (MythStorm: agricultura, semillas, flores, cactus, tintes y abejas; Scadrial0523: ganadería y pesca); aldeanos, cualquiera de los dos; un producto con granja (hierro, oro, blaze, slime, madera…), solo su dueño. Si tiene permiso vigente en memoria, es legal; si tiene prohibición expresa, prevalece incluso sobre permisos generales.'
].join('\n');

const NPC_HELP_DOCS = {
  arquitecto: 'Arquitecto (o maestro de obras / ingeniero): Eras (ERA 0-XIII), que construir y permisos. Ej: "arquitecto que toca construir?"',
  juez: 'Juez (o Excelencia / Su Senoria / Senor Juez): leyes IC, disputas y multas. Ej: "excelencia que multa aplica?"',
  fiscal: 'Fiscal (o policia / alguacil / aduana): monopolios, contrabando, PvP, tratos y pases. Ej: "fiscal puedo pasar trigo?"',
  banquero: 'Banquero (o Don Tesoro / contador): tasa DR/CU, reservas, saldos y precios. Ej: "banquero cuanto vale el trigo?"',
  archivista: 'Archivista (o auditor / cronista / bibliotecario): auditoria de obras (Manual 003), lore, cronicas, cedulas y recuerdos. Ej: "auditor como audito una granja?"',
  cartografo: 'Cartografo (o topografo): estaciones, portales y su equivalencia Overworld/Nether, obras con coordenadas y moradas. Ej: "cartografo donde queda el portal de casa?"',
  consejero: 'Consejero (o filosofo / sabio / guia / sacerdote): voz imparcial personalizada que te ayuda a crear tu religion y evoluciona contigo (Consejero -> Guia -> Sacerdote). Ej: "filosofo ayudame a crear mi religion"',
  pregonero: 'Pregonero: chismes, economia y libreta de memoria. Ej: "pregonero recuerda que..."'
};

const NPC_HELP_ALIASES = {
  excelencia: 'juez',
  senoria: 'juez',
  'señoria': 'juez',
  'señoría': 'juez',
  magistrado: 'juez',
  magistrada: 'juez',
  tribunal: 'juez',
  policia: 'fiscal',
  'policía': 'fiscal',
  poli: 'fiscal',
  comisario: 'fiscal',
  patrulla: 'fiscal',
  alguacil: 'fiscal',
  aduana: 'fiscal',
  maestro: 'arquitecto',
  ingeniero: 'arquitecto',
  constructor: 'arquitecto',
  obras: 'arquitecto',
  eras: 'arquitecto',
  era: 'arquitecto',
  tesoro: 'banquero',
  tesorero: 'banquero',
  contador: 'banquero',
  economia: 'banquero',
  'economía': 'banquero',
  banco: 'banquero',
  auditor: 'archivista',
  auditoria: 'archivista',
  'auditoría': 'archivista',
  cronista: 'archivista',
  bibliotecario: 'archivista',
  lore: 'archivista',
  cronicas: 'archivista',
  'crónicas': 'archivista',
  cedulas: 'archivista',
  'cédulas': 'archivista',
  chisme: 'pregonero',
  plaza: 'pregonero',
  'cartógrafo': 'cartografo',
  topografo: 'cartografo',
  'topógrafo': 'cartografo',
  mapa: 'cartografo',
  portales: 'cartografo',
  estaciones: 'cartografo',
  consejera: 'consejero',
  filosofo: 'consejero',
  'filósofo': 'consejero',
  filosofa: 'consejero',
  'filósofa': 'consejero',
  sabio: 'consejero',
  sabia: 'consejero',
  pensador: 'consejero',
  pensadora: 'consejero',
  mentor: 'consejero',
  mentora: 'consejero',
  etica: 'consejero',
  'ética': 'consejero',
  filosofia: 'consejero',
  'filosofía': 'consejero',
  guia: 'consejero',
  'guía': 'consejero',
  sacerdote: 'consejero',
  sacerdotisa: 'consejero',
  clerigo: 'consejero',
  'clérigo': 'consejero',
  monje: 'consejero'
};

const HELP_QUESTION_RE = /^(?:\?|ayuda|help|info|uso|qu[eé]\s+es\s+esto\??|para\s+qu[eé]\s+sirve\??|c[oó]mo\s+(?:se\s+usa|funciona)\??)$/i;

function isHelpQuestion(arg) {
  return HELP_QUESTION_RE.test(String(arg || '').trim());
}

async function sendCommandHelpIfAsked(canonicalCmd, arg, rcon, player) {
  if (!isHelpQuestion(arg)) return false;
  const doc = COMMAND_DOCS[canonicalCmd] || 'Usa !ayuda para ver todos los comandos.';
  await sendLine(rcon, player, `Ayuda !${canonicalCmd}`, 'aqua', [{ text: doc, color: 'white' }]);
  return true;
}

function getKnownPlayers(cfg, enforcer) {
  const pc = cfg.players || {};
  const map = new Map();
  for (const name of [...enforcer.onlinePlayers, ...(pc.myth || []), ...(pc.scad || []), ...(pc.guests || [])]) {
    if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), name);
  }
  return map;
}

function resolveKnownPlayer(name, cfg, enforcer) {
  const clean = String(name || '').trim().toLowerCase();
  if (!clean) return null;
  return getKnownPlayers(cfg, enforcer).get(clean) || null;
}

function buildPlayerIdentity(player, role, state, bridge) {
  const mythNat = bridge.nat(state, 'myth').nation;
  const scadNat = bridge.nat(state, 'scad').nation;
  if (role === 'myth') {
    return `${player} — Gobernante de ${mythNat} (monopolios: Redstone/Automatización, Encantamientos, Agricultura/Madera/Abejas, Explosivos)`;
  }
  if (role === 'scad') {
    return `${player} — Gobernante de ${scadNat} (monopolios: Metalurgia/Forja/Hierro, Alquimia, Transporte/Rieles/Trenes, Ganadería/Pesca, Construcción)`;
  }
  if (/^notout(?:of)?context$/i.test(String(player || '').trim())) {
    return `${player} — Archivista Nacional, Revisor de normas y Auditor Oficial de Obras (sin Estado propio, no pertenece a ${mythNat} ni a ${scadNat})`;
  }
  return `${player} — Visitante sin Estado (no pertenece a ${mythNat} ni a ${scadNat})`;
}

function isArchivistaPlayer(player, state) {
  const clean = String(player || '').trim();
  if (!clean) return false;
  if (/^notout(?:of)?context$/i.test(clean)) return true;
  const revId = state?.settings?.reviewerId;
  if (revId) {
    const guest = (state?.guests || []).find(g => g.id === revId);
    if (guest && String(guest.nick || '').trim().toLowerCase() === clean.toLowerCase()) return true;
  }
  return false;
}

const aiCooldown = new Map();
let aiBusy = false;

// Cola de la IA: Ollama atiende una consulta a la vez. Antes, si dos jugadores le hablaban a un NPC
// casi al mismo tiempo, el segundo mensaje se perdía en silencio; ahora espera su turno (hasta 3 en fila).
const AI_QUEUE_MAX = 3;
let aiQueueLen = 0;
let aiChain = Promise.resolve();
function queueAi(task) {
  if (aiQueueLen >= AI_QUEUE_MAX) return null;
  aiQueueLen += 1;
  const run = aiChain.then(async () => {
    aiBusy = true;
    try {
      return await task();
    } finally {
      aiBusy = false;
      aiQueueLen -= 1;
    }
  });
  aiChain = run.catch(() => {});
  return run;
}
const aiIdle = () => !aiBusy && aiQueueLen === 0;

async function askSmartAi({ player, query, mode, cmdLabel, badgeOverride = null, badgeColorOverride = null, ctx }) {
  const { cfg, bridge, rcon, enforcer, memory } = ctx;
  const q = String(query || '').trim();
  if (!q) {
    await sendLine(rcon, player, 'Archivo', 'gold', [{ text: `Escribe tu consulta después de !${cmdLabel || mode} <texto>.`, color: 'yellow' }]);
    return;
  }
  const now = Date.now();
  const last = aiCooldown.get(player) || 0;
  if (now - last < 5000) {
    await sendLine(rcon, player, 'Archivo', 'yellow', [{ text: 'Espera unos segundos antes de hacer otra consulta.', color: 'gray' }]);
    return;
  }
  if (aiQueueLen >= AI_QUEUE_MAX) {
    await sendLine(rcon, player, 'Archivo', 'yellow', [{ text: 'Hay fila en el Archivo (varias consultas a la vez); intenta en un momento.', color: 'gray' }]);
    return;
  }

  if (badgeOverride !== 'Pregonero') {
    memory?.recordPlayerChat(player, `!${cmdLabel || mode} ${q}`);
  }

  aiCooldown.set(player, now);
  // No se espera aquí a la IA: así el lector del log sigue atendiendo joins, comandos y la Aduana
  const job = queueAi(() => runSmartAi({ player, q, mode, badgeOverride, badgeColorOverride, ctx }));
  job?.catch(err => console.error('[IA]', err.message));
}

async function runSmartAi({ player, q, mode, badgeOverride, badgeColorOverride, ctx }) {
  const { cfg, bridge, rcon, enforcer, memory } = ctx;
  {
    const { state } = await bridge.fetchWorld(false);
    const b = bridge.getBriefing(state);
    let contextParts = [];
    if (mode === 'manual') {
      contextParts.push(`Estado cambiario actual: ${b.fxText} | Reservas cámara: ${b.bankReserves}`);
      contextParts.push(...bridge.getEconomyManualExcerpts(state, q));
    } else if (mode === 'ooc') {
      contextParts = bridge.findOocContext(state, q);
    } else if (mode === 'auto') {
      contextParts = [
        ...bridge.findOocContext(state, q),
        ...bridge.findRelevantNorms(state, q, { limit: 4, isJuez: false, includeOoc: false }),
        `Estado cambiario actual: ${b.fxText} | Reservas cámara: ${b.bankReserves}`
      ];
      if (/(?:moneda|cambio|tasa|banco|pr[eé]stam|oe|dr|cu|manual|inflaci[oó]n|reservas|saldo)/i.test(q)) {
        contextParts.push(...bridge.getEconomyManualExcerpts(state, q));
      }
      const loreTxt = bridge.getLoreAndChroniclesContext(state, q, { compact: false });
      if (loreTxt) contextParts.push(loreTxt);
    } else {
      contextParts = bridge.findRelevantNorms(state, q, { limit: 6, isJuez: mode === 'juez', includeOoc: false });
    }

    if (mode !== 'auto') {
      const loreCompact = bridge.getLoreAndChroniclesContext(state, q, { compact: true });
      if (loreCompact) contextParts.push(loreCompact);
    }

    if (mode === 'auto' || mode === 'ooc' || /(?:comando|ayuda|!|pase|trato|duelo|chat|mod\b|bot\b|alguacil|pregonero|sirve|funciona|lore|memoria|recuerda)/i.test(q)) {
      contextParts.unshift(BOT_COMMANDS_DOC);
    }

    const role = enforcer.getPlayerRole(player, state);
    contextParts.push(farmLocksText(state, bridge));
    let reply;
    try {
      reply = await askModerator({
        config: cfg,
        mode,
        player,
        playerIdentity: buildPlayerIdentity(player, role, state, bridge),
        query: q,
        contextText: contextParts.join('\n\n---\n\n'),
        chatHistoryText: memory?.getRecentChatText(10) || '',
        memoryText: memory?.getPersistentMemoryText({ maxSessions: 5, maxNotes: 10 }) || ''
      });
    } catch (err) {
      // Ollama apagado o colgado: el jugador recibe una respuesta en vez de silencio
      console.error(`[IA ${mode}]`, err.message);
      reply = npcOfflineReply('archivista');
    }

    const target = '@a';
    const badge = badgeOverride || (mode === 'juez' ? 'Tribunal' : mode === 'manual' ? 'Economía' : mode === 'ooc' ? 'Técnico' : 'Archivo');
    const badgeColor = badgeColorOverride || (mode === 'juez' ? 'gold' : 'aqua');
    memory?.recordBotMessage(badgeOverride === 'Pregonero' ? 'Pregonero' : 'Archivo', reply.respuesta_corta);
    await sendLine(rcon, target, badge, badgeColor, [
      { text: reply.respuesta_corta, color: 'white' }
    ]);
    const metaLine = [
      reply.normas_citadas.length ? `Citas: ${reply.normas_citadas.join(', ')}` : '',
      reply.rango_oe && reply.rango_oe !== 'N/A' ? `Cuantía: ${reply.rango_oe}` : '',
      reply.requiere_confirmacion ? 'Requiere confirmación de Estados / acta' : ''
    ].filter(Boolean).join(' | ');
    if (metaLine) {
      await sendLine(rcon, target, 'Referencia', 'gold', [{ text: metaLine, color: 'yellow' }]);
    }
  }
}

const SACRED_OFFERING_RE = /^minecraft:(?:gold_ingot|gold_nugget|diamond|emerald|amethyst_shard|lapis_lazuli|glowstone_dust|quartz|lantern|soul_lantern|apple|golden_apple|lily_of_the_valley|rose_bush|oxeye_daisy|poppy|dandelion|cornflower|blue_orchid|allium|azure_bluet|pink_petals|candle|[a-z_]+_candle)$/;
const STUDY_OFFERING_RE = /^minecraft:(?:book|writable_book|written_book|paper|compass|filled_map|map|spyglass|ink_sac|glow_ink_sac|feather|clock|amethyst_shard)$/;

function resolveCurrencyCode(state, raw, fallback = 'M') {
  const clean = String(raw || '').trim().toLowerCase();
  if (!clean) return fallback;
  const m = state?.settings?.nations?.myth || {};
  const s = state?.settings?.nations?.scad || {};
  const b = state?.settings?.basket || {};
  if ([clean].some(x => x === 'm' || x === 'dr' || x === String(m.symbol || '').toLowerCase() || x === String(m.currency || '').toLowerCase())) return 'M';
  if ([clean].some(x => x === 's' || x === 'cu' || x === String(s.symbol || '').toLowerCase() || x === String(s.currency || '').toLowerCase())) return 'S';
  if ([clean].some(x => x === 'u' || x === 'oe' || x === String(b.symbol || '').toLowerCase() || x === String(b.name || '').toLowerCase())) return 'U';
  return null;
}

function computeGpsBearing(dx, dz) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const deg = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
  return dirs[Math.round(deg / 45) % 8];
}

async function readSelectedItem(player, rcon) {
  const res = String(await rcon.send(`data get entity ${player} SelectedItem`));
  const idMatch = res.match(/\bid:\s*"([a-z0-9_:.-]+)"/i);
  if (!idMatch) return null;
  const countMatch = res.match(/\bcount:\s*(\d+)/i);
  return { id: idMatch[1], count: countMatch ? Number(countMatch[1]) : 1 };
}

async function handlePayCommand({ player, arg, bridge, rcon, memory }) {
  const parts = String(arg || '').split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    await sendLine(rcon, player, 'Pago', 'gold', [{ text: COMMAND_DOCS.pagar, color: 'yellow' }]);
    return;
  }
  const [targetRaw, amtRaw, curRaw] = parts;
  const amount = Number(String(amtRaw).replace(',', '.'));
  if (!(amount > 0 && Number.isFinite(amount))) {
    await sendLine(rcon, player, 'Pago', 'red', [{ text: `Monto inválido: "${amtRaw}".`, color: 'yellow' }]);
    return;
  }

  let curState;
  try {
    ({ state: curState } = await bridge.fetchWorld(false));
  } catch (err) {
    await sendLine(rcon, player, 'Pago', 'red', [{ text: `No pude leer Supabase: ${err.message}`, color: 'yellow' }]);
    return;
  }
  const fromId = bridge.resolveParticipantId(curState, player);
  const toId = bridge.resolveParticipantId(curState, targetRaw);
  if (!fromId || fromId === 'bank') {
    await sendLine(rcon, player, 'Pago', 'red', [{ text: 'No apareces como participante en la web (regístrate primero).', color: 'yellow' }]);
    return;
  }
  if (!toId || toId === 'bank') {
    await sendLine(rcon, player, 'Pago', 'red', [{ text: `No encontré al destinatario "${targetRaw}" en la web.`, color: 'yellow' }]);
    return;
  }
  const defaultCur = bridge.E.isState(fromId) ? bridge.E.curOfState(fromId) : (bridge.E.isState(toId) ? bridge.E.curOfState(toId) : 'M');
  const curCode = resolveCurrencyCode(curState, curRaw, defaultCur);
  if (!curCode) {
    await sendLine(rcon, player, 'Pago', 'red', [{ text: `Moneda desconocida "${curRaw}". Usa DR, CU o OE.`, color: 'yellow' }]);
    return;
  }

  const wr = await bridge.mutateWorld(draft => {
    const res = bridge.E.pay(draft, fromId, toId, curCode, amount, false);
    if (!res.ok) return res;
    const pFrom = bridge.pname(draft, fromId);
    const pTo = bridge.pname(draft, toId);
    const convTxt = res.short > 0 ? ` (conversión ${bridge.money(draft, res.cost, res.costCur)})` : '';
    if (!Array.isArray(draft.economy.ledger)) draft.economy.ledger = [];
    draft.economy.ledger.unshift({
      id: bridge.E.uid('led'),
      t: Date.now(),
      type: 'Transferencia (MC)',
      text: `${pFrom} -> ${pTo}: ${bridge.money(draft, amount, curCode)}${convTxt}`,
      by: pFrom
    });
    if (res.short > 0) {
      if (!Array.isArray(draft.economy.fxHistory)) draft.economy.fxHistory = [];
      draft.economy.fxHistory.push({ t: Date.now(), r: Number(bridge.E.rate(draft).toFixed(4)) });
      if (draft.economy.fxHistory.length > 300) draft.economy.fxHistory = draft.economy.fxHistory.slice(-300);
    }
    return {
      ok: true,
      pFrom,
      pTo,
      amtLabel: bridge.money(draft, amount, curCode),
      convTxt
    };
  }, `${player} (!pagar)`);

  if (!wr.ok) {
    await sendLine(rcon, player, 'Pago', 'red', [{ text: wr.msg || 'No se pudo completar el pago.', color: 'yellow' }]);
    return;
  }
  const { pFrom, pTo, amtLabel, convTxt } = wr.meta;
  memory?.recordEvent('event', `Pago en MC: ${pFrom} -> ${pTo} (${amtLabel})`);
  await rcon.send('execute as @a at @s run playsound minecraft:entity.experience_orb.pickup master @s ~ ~ ~ 0.7 1.2').catch(() => {});
  await sendLine(rcon, '@a', 'Libro Mayor', 'gold', [
    { text: `${pFrom}`, color: 'aqua', bold: true },
    { text: ' transfirió ', color: 'white' },
    { text: amtLabel, color: 'gold', bold: true },
    { text: ` a ${pTo}${convTxt} · TRD 130-01.`, color: 'gray' }
  ]);
}

async function handleCronicaCommand({ player, arg, bridge, rcon, memory }) {
  if (!arg || isHelpQuestion(arg)) {
    await sendLine(rcon, player, 'Ayuda !cronica', 'aqua', [{ text: COMMAND_DOCS.cronica, color: 'white' }]);
    return;
  }
  const bar = arg.indexOf('|');
  const title = bar >= 0
    ? (arg.slice(0, bar).trim() || 'Crónica de Miscolandia').slice(0, 90)
    : (arg.length > 46 ? `${arg.slice(0, 42).trim()}…` : 'Crónica desde el juego');
  const body = (bar >= 0 ? arg.slice(bar + 1).trim() : arg).slice(0, 1200);
  if (!body) {
    await sendLine(rcon, player, 'Archivo', 'red', [{ text: 'Falta el texto de la crónica.', color: 'yellow' }]);
    return;
  }

  const wr = await bridge.mutateWorld(draft => {
    const pid = bridge.resolveParticipantId(draft, player) || player;
    const era = bridge.getCurrentEra(draft);
    if (!Array.isArray(draft.chronicles)) draft.chronicles = [];
    draft.chronicles.unshift({
      id: bridge.E.uid('cro'),
      era: era.code,
      type: 'Crónica',
      author: pid,
      title,
      body,
      t: Date.now()
    });
    return { ok: true, eraCode: era.code, authorName: bridge.pname(draft, pid) };
  }, `${player} (!cronica)`);

  if (!wr.ok) {
    await sendLine(rcon, player, 'Archivo', 'red', [{ text: wr.msg || 'No pude guardar la crónica.', color: 'yellow' }]);
    return;
  }
  memory?.recordEvent('event', `Nueva crónica de ${player}: "${title}"`);
  await sendLine(rcon, '@a', 'TRD 140-01', 'aqua', [
    { text: `${wr.meta.authorName} archivó crónica (${wr.meta.eraCode}): `, color: 'white' },
    { text: `"${title}"`, color: 'gold', bold: true }
  ]);
}

async function handleGeoSaveCommand({ kind, player, arg, bridge, rcon, memory }) {
  const parts = String(arg || '').trim().split(/\s+/);
  const sub = (parts[0] || '').toLowerCase();
  const rest = sub === 'guardar' || sub === 'agregar' || sub === 'crear' ? parts.slice(1).join(' ').trim() : String(arg || '').trim();
  if (!rest || isHelpQuestion(rest)) {
    await sendLine(rcon, player, 'Cartógrafo', 'dark_aqua', [{ text: COMMAND_DOCS[kind === 'portal' ? 'portal' : 'estacion'], color: 'white' }]);
    return;
  }
  const pos = await readPlayerPos(player, rcon).catch(() => null);
  if (!pos || pos.dim === 'End') {
    await sendLine(rcon, player, 'Cartógrafo', 'red', [{ text: 'Solo puedo registrar coordenadas en el Overworld o el Nether.', color: 'yellow' }]);
    return;
  }
  const owX = pos.dim === 'Nether' ? pos.x * 8 : pos.x;
  const owZ = pos.dim === 'Nether' ? pos.z * 8 : pos.z;
  const nhX = pos.dim === 'Nether' ? pos.x : Math.floor(pos.x / 8);
  const nhZ = pos.dim === 'Nether' ? pos.z : Math.floor(pos.z / 8);

  if (kind === 'portal') {
    const label = rest.slice(0, 60);
    const wr = await bridge.mutateWorld(draft => {
      if (!Array.isArray(draft.portals)) draft.portals = [];
      draft.portals.unshift({ id: bridge.E.uid('prt'), label, ow: `${owX}, ${owZ}`, nh: `${nhX}, ${nhZ}` });
      return { ok: true };
    }, `${player} (!portal)`);
    if (!wr.ok) {
      await sendLine(rcon, player, 'Cartógrafo', 'red', [{ text: wr.msg, color: 'yellow' }]);
      return;
    }
    memory?.recordEvent('event', `${player} registró portal "${label}" (OW ${owX},${owZ} ↔ NE ${nhX},${nhZ})`);
    await sendLine(rcon, '@a', 'Cartógrafo', 'dark_aqua', [
      { text: `Portal "${label}" guardado: `, color: 'white' },
      { text: `OW (${owX}, ${owZ})`, color: 'green' },
      { text: ' ↔ ', color: 'gray' },
      { text: `NE (${nhX}, ${nhZ})`, color: 'red' }
    ]);
    return;
  }

  const bar = rest.indexOf('|');
  const name = (bar >= 0 ? rest.slice(0, bar) : rest).trim().slice(0, 60);
  const line = bar >= 0 ? rest.slice(bar + 1).trim().slice(0, 40) : '';
  const wr = await bridge.mutateWorld(draft => {
    const pid = bridge.resolveParticipantId(draft, player);
    const owner = (pid === 'myth' || pid === 'scad') ? pid : 'ambos';
    if (!Array.isArray(draft.stations)) draft.stations = [];
    draft.stations.unshift({ id: bridge.E.uid('est'), name, line, coords: `${owX}, ${owZ}`, owner });
    return { ok: true };
  }, `${player} (!estacion)`);
  if (!wr.ok) {
    await sendLine(rcon, player, 'Cartógrafo', 'red', [{ text: wr.msg, color: 'yellow' }]);
    return;
  }
  memory?.recordEvent('event', `${player} registró estación "${name}" en (${owX}, ${owZ})`);
  await sendLine(rcon, '@a', 'Cartógrafo', 'dark_aqua', [
    { text: `Estación "${name}"${line ? ` (${line})` : ''} guardada en OW (${owX}, ${owZ}).`, color: 'white' }
  ]);
}

async function handleGpsCommand({ player, arg, bridge, rcon }) {
  const pos = await readPlayerPos(player, rcon).catch(() => null);
  if (!pos || pos.dim === 'End') {
    await sendLine(rcon, player, 'GPS', 'red', [{ text: 'El GPS funciona en Overworld y Nether (no tengo tu posición aquí).', color: 'yellow' }]);
    return;
  }
  const { state } = await bridge.fetchWorld(false);
  const points = [];
  for (const s of (state.stations || [])) {
    const c = bridge.parseCoords(s.coords);
    if (c) points.push({ kind: 'Estación', name: s.name, x: c.x, z: c.z, dim: 'Overworld' });
  }
  for (const p of (state.portals || [])) {
    const c = bridge.parseCoords(p.ow);
    if (c) points.push({ kind: 'Portal', name: p.label || 'Portal', x: c.x, z: c.z, dim: 'Overworld', nh: p.nh });
  }
  for (const w of (state.economy?.works || [])) {
    const c = bridge.parseCoords(w.coords);
    if (c) points.push({ kind: 'Obra', name: w.name, x: c.x, z: c.z, dim: 'Overworld' });
  }
  if (!points.length) {
    await sendLine(rcon, player, 'GPS', 'gold', [{ text: 'No hay portales, estaciones u obras con coordenadas guardadas en Territorio aún.', color: 'yellow' }]);
    return;
  }
  const myOwX = pos.dim === 'Nether' ? pos.x * 8 : pos.x;
  const myOwZ = pos.dim === 'Nether' ? pos.z * 8 : pos.z;
  const qNorm = String(arg || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const withDist = points.map(pt => {
    const dx = pt.x - myOwX;
    const dz = pt.z - myOwZ;
    const dist = Math.round(Math.hypot(dx, dz));
    const nMatch = qNorm ? pt.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(qNorm) : true;
    return { ...pt, dist, bearing: computeGpsBearing(dx, dz), match: nMatch };
  });
  const list = (qNorm ? withDist.filter(p => p.match) : withDist).sort((a, b) => a.dist - b.dist).slice(0, 3);
  if (!list.length) {
    await sendLine(rcon, player, 'GPS', 'gold', [{ text: `No hallé ningún destino con "${arg}" en el mapa web.`, color: 'yellow' }]);
    return;
  }
  const lines = list.map(p => {
    const nhDist = Math.round(p.dist / 8);
    return `• [${p.kind}] ${p.name}: ${p.dist}b al ${p.bearing} -> OW (${p.x}, ${p.z}) · Nether ~${nhDist}b (${Math.floor(p.x / 8)}, ${Math.floor(p.z / 8)})`;
  }).join('\n');
  await sendLine(rcon, player, 'GPS', 'dark_aqua', [{ text: lines, color: 'white' }]);
}

async function handleContractCommand({ player, arg, bridge, rcon, memory }) {
  const parts = String(arg || '').trim().split(/\s+/).filter(Boolean);
  const sub = (parts[0] || '').toLowerCase();
  const { state } = await bridge.fetchWorld(true);
  const active = (state.contracts || []).filter(c => c && c.status !== 'pagado');

  if (!sub || sub === 'lista' || sub === 'ver') {
    if (!active.length) {
      await sendLine(rcon, player, 'Encargos', 'gold', [{ text: 'No hay encargos abiertos ahorita. Publica uno en Economía -> Encargos.', color: 'gray' }]);
      return;
    }
    const text = active.slice(0, 6).map((c, i) => {
      const a = bridge.pname(state, c.author);
      const who = c.assignee ? ` -> toma ${bridge.pname(state, c.assignee)}` : '';
      return `[${i + 1}] ${c.title} (${bridge.money(state, c.reward, c.cur)} · ${a} · ${c.status}${who})`;
    }).join('\n');
    await sendLine(rcon, player, 'Encargos', 'gold', [
      { text: `${text}\n`, color: 'white' },
      { text: 'Usa !contrato aceptar <n> | entregar <n> | pagar <n>', color: 'gray' }
    ]);
    return;
  }

  const idx = Number(parts[1]) - 1;
  const target = Number.isInteger(idx) && idx >= 0 && idx < active.length ? active[idx] : null;
  if (!target) {
    await sendLine(rcon, player, 'Encargos', 'red', [{ text: 'Indica el número válido del encargo (mira con !contratos).', color: 'yellow' }]);
    return;
  }

  if (sub === 'aceptar' || sub === 'tomar') {
    const wr = await bridge.mutateWorld(draft => {
      const c = (draft.contracts || []).find(x => x.id === target.id);
      const pid = bridge.resolveParticipantId(draft, player);
      if (!c) return { ok: false, msg: 'Ese encargo ya no existe.' };
      if (!pid) return { ok: false, msg: 'No estás registrado en la web.' };
      if (c.author === pid) return { ok: false, msg: 'No puedes aceptar tu propio encargo.' };
      if (c.status !== 'abierto') return { ok: false, msg: `Ese encargo ya está ${c.status}.` };
      c.status = 'en_curso';
      c.assignee = pid;
      c.acceptedAt = Date.now();
      return { ok: true, title: c.title, who: bridge.pname(draft, pid) };
    }, `${player} (!contrato)`);
    if (!wr.ok) return sendLine(rcon, player, 'Encargos', 'red', [{ text: wr.msg, color: 'yellow' }]);
    memory?.recordEvent('event', `${wr.meta.who} aceptó el encargo "${wr.meta.title}"`);
    return sendLine(rcon, '@a', 'Encargos', 'gold', [{ text: `${wr.meta.who} aceptó el encargo "${wr.meta.title}".`, color: 'white' }]);
  }

  if (sub === 'entregar' || sub === 'listo') {
    const wr = await bridge.mutateWorld(draft => {
      const c = (draft.contracts || []).find(x => x.id === target.id);
      const pid = bridge.resolveParticipantId(draft, player);
      if (!c) return { ok: false, msg: 'Ese encargo ya no existe.' };
      if (c.assignee !== pid) return { ok: false, msg: 'Solo quien aceptó el encargo puede marcarlo como entregado.' };
      if (c.status !== 'en_curso') return { ok: false, msg: `El encargo está en estado "${c.status}".` };
      c.status = 'entregado';
      c.deliveredAt = Date.now();
      return { ok: true, title: c.title, author: bridge.pname(draft, c.author), who: bridge.pname(draft, pid) };
    }, `${player} (!contrato)`);
    if (!wr.ok) return sendLine(rcon, player, 'Encargos', 'red', [{ text: wr.msg, color: 'yellow' }]);
    memory?.recordEvent('event', `${wr.meta.who} entregó el encargo "${wr.meta.title}"`);
    return sendLine(rcon, '@a', 'Encargos', 'aqua', [{ text: `${wr.meta.who} entregó "${wr.meta.title}". ${wr.meta.author} puede aprobarlo con !contrato pagar ${idx + 1}.`, color: 'white' }]);
  }

  if (sub === 'pagar' || sub === 'aprobar') {
    const wr = await bridge.mutateWorld(draft => {
      const c = (draft.contracts || []).find(x => x.id === target.id);
      const pid = bridge.resolveParticipantId(draft, player);
      if (!c) return { ok: false, msg: 'Ese encargo ya no existe.' };
      if (c.author !== pid) return { ok: false, msg: 'Solo quien publicó el encargo puede aprobar y pagar.' };
      if (!c.assignee || c.status === 'abierto') return { ok: false, msg: 'Nadie lo ha aceptado todavía.' };
      const payRes = bridge.E.pay(draft, c.author, c.assignee, c.cur, c.reward, false);
      if (!payRes.ok) return payRes;
      c.status = 'pagado';
      c.paidAt = Date.now();
      if (!Array.isArray(draft.economy.ledger)) draft.economy.ledger = [];
      draft.economy.ledger.unshift({
        id: bridge.E.uid('led'),
        t: Date.now(),
        type: 'Encargo pagado',
        text: `${bridge.pname(draft, c.author)} -> ${bridge.pname(draft, c.assignee)}: ${bridge.money(draft, c.reward, c.cur)} por "${c.title}"`,
        by: bridge.pname(draft, c.author)
      });
      return { ok: true, title: c.title, to: bridge.pname(draft, c.assignee), amt: bridge.money(draft, c.reward, c.cur) };
    }, `${player} (!contrato pagar)`);
    if (!wr.ok) return sendLine(rcon, player, 'Encargos', 'red', [{ text: wr.msg, color: 'yellow' }]);
    memory?.recordEvent('event', `Encargo "${wr.meta.title}" pagado a ${wr.meta.to} (${wr.meta.amt})`);
    return sendLine(rcon, '@a', 'Encargos', 'green', [{ text: `¡Encargo "${wr.meta.title}" aprobado! Pagado ${wr.meta.amt} a ${wr.meta.to}.`, color: 'white' }]);
  }

  await sendLine(rcon, player, 'Encargos', 'gold', [{ text: COMMAND_DOCS.contrato, color: 'yellow' }]);
}

async function handleOfferingCommand({ kind, player, bridge, rcon, enforcer, deity }) {
  if (!deity) {
    return sendLine(rcon, player, 'Aviso', 'gold', [{ text: 'El sistema de convicción aún se está iniciando.', color: 'gray' }]);
  }
  const { state } = await bridge.fetchWorld(false);
  const role = enforcer.getPlayerRole(player, state);
  const pid = deity.playerPid(player, role, state);
  if (!pid) {
    return sendLine(rcon, player, 'Convicción', 'gold', [{ text: 'Primero regístrate o elige tu identidad en la web (Soy:).', color: 'yellow' }]);
  }
  const dev = bridge.getDevotion(state, pid);
  if (kind === 'fe' && dev.path !== 'fe') {
    const hint = dev.path === 'razon' ? 'Tu camino es La Razón: usa !estudio.' : 'Declara una fe con dios nombrado en la web (Lore -> Religiones y fe).';
    return sendLine(rcon, player, 'Ofrenda', 'gold', [{ text: hint, color: 'yellow' }]);
  }
  if (kind === 'razon' && dev.path === 'fe') {
    return sendLine(rcon, player, 'Academia', 'gold', [{ text: 'Tu convicción es religiosa: usa !ofrenda.', color: 'yellow' }]);
  }

  const leftMs = deity.offeringCooldownLeftMs(player, kind);
  if (leftMs > 0) {
    const mins = Math.ceil(leftMs / 60_000);
    return sendLine(rcon, player, kind === 'fe' ? 'Ofrenda' : 'Estudio', 'gray', [
      { text: `Aún es pronto para otro gesto tan seguido (espera ~${mins} min).`, color: 'gray' }
    ]);
  }

  const item = await readSelectedItem(player, rcon).catch(() => null);
  const rx = kind === 'fe' ? SACRED_OFFERING_RE : STUDY_OFFERING_RE;
  if (!item || !rx.test(item.id)) {
    const allowedHint = kind === 'fe'
      ? 'Sostén en la mano 1 vela, flor, amatista, lapislázuli, cuarzo, oro, esmeralda, diamante o farol.'
      : 'Sostén en la mano 1 libro, libro y pluma, papel, brújula, mapa, catalejo, pluma o tinta.';
    return sendLine(rcon, player, kind === 'fe' ? 'Ofrenda' : 'Estudio', 'gold', [{ text: allowedHint, color: 'yellow' }]);
  }

  const clrRes = String(await rcon.send(`clear ${player} ${item.id} 1`));
  if (/No items were found|nothing/i.test(clrRes) && !/Removed 1|Cleared 1/i.test(clrRes)) {
    return sendLine(rcon, player, 'Aviso', 'red', [{ text: 'No pude recoger el ítem de tu mano.', color: 'yellow' }]);
  }

  const itemLabel = item.id.replace(/^minecraft:/, '').replace(/_/g, ' ');
  await deity.processOffering({ player, pid, kind, itemId: item.id, itemLabel, state });

  await bridge.mutateWorld(draft => {
    if (!draft.devotion || typeof draft.devotion !== 'object') draft.devotion = {};
    if (!draft.devotion[pid] || typeof draft.devotion[pid] !== 'object') draft.devotion[pid] = { creed: '', marks: {} };
    const key = kind === 'fe' ? 'offerings' : 'studies';
    draft.devotion[pid][key] = (Number(draft.devotion[pid][key]) || 0) + 1;
    return { ok: true };
  }, `${player} (!${kind === 'fe' ? 'ofrenda' : 'estudio'})`).catch(() => {});
}

async function handleHolidayCommand({ player, bridge, rcon, deity, enforcer }) {
  const { state } = await bridge.fetchWorld(true);
  const role = enforcer.getPlayerRole(player, state);
  const pid = deity?.playerPid(player, role, state) || bridge.resolveParticipantId(state, player);
  if (deity) {
    await deity.deliverPendingHolidayRewards(player, state).catch(() => {});
  }
  const { cal } = bridge.getHolidaysContext(state);
  if (cal.active.length) {
    const parts = cal.active.map(h => {
      const node = state?.holidays?.[h.seasonYear]?.[h.id] || {};
      const tList = h.tasks.map(t => `${node?.[t.id]?.[pid] ? '✔' : '○'} ${t.title}`).join(' | ');
      const claimed = Boolean(pid && node?.claimed?.[pid]);
      return `${h.emoji} ${h.name} (${h.dateLabel}): ${tList}${claimed ? ' [Premio entregado ✔]' : ` -> Premio: ${h.reward.label}`}`;
    }).join('\n');
    return sendLine(rcon, player, 'Festividad activa', 'gold', [{ text: parts, color: 'white' }]);
  }
  if (cal.upcoming) {
    const u = cal.upcoming;
    return sendLine(rcon, player, 'Calendario festivo', 'gold', [
      { text: `Hoy no hay festividad activa. La próxima es ${u.emoji} ${u.name} (${u.dateLabel}, en ${u.daysLeft} día(s)). Premio: ${u.reward.label}`, color: 'white' }
    ]);
  }
}

async function handleSummaryCommand({ player, arg, bridge, rcon, memory, enforcer }) {
  const logs = memory?.data?.pendingSessionLog || [];
  if (!logs.length) {
    return sendLine(rcon, player, 'Diario', 'gray', [{ text: 'Aún no hay suficientes sucesos en esta sesión para resumir.', color: 'gray' }]);
  }
  const deaths = logs.filter(e => e.type === 'death').map(e => e.text);
  const infr = logs.filter(e => e.type === 'infraction').map(e => e.text);
  const evs = logs.filter(e => e.type === 'event').map(e => e.text);
  const head = `Resumen sesión (${logs.length} sucesos): ${evs.length} eventos, ${deaths.length} bajas, ${infr.length} avisos Aduana.`;
  const topLines = [...deaths.slice(-2), ...infr.slice(-2), ...evs.slice(-4)].map(s => `• ${s}`).join('\n');

  if (/^(?:publicar|guardar|web)$/i.test(String(arg || '').trim())) {
    const { state } = await bridge.fetchWorld(false);
    if (enforcer.getPlayerRole(player, state) === 'guest') {
      const pid = bridge.resolveParticipantId(state, player) || player;
      if (!pid) return sendLine(rcon, player, 'Diario', 'red', [{ text: 'No te encontré en la web.', color: 'yellow' }]);
    }
    const today = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
    const wr = await bridge.mutateWorld(draft => {
      const pid = bridge.resolveParticipantId(draft, player) || player;
      const era = bridge.getCurrentEra(draft);
      if (!Array.isArray(draft.chronicles)) draft.chronicles = [];
      draft.chronicles.unshift({
        id: bridge.E.uid('cro'),
        era: era.code,
        type: 'Crónica',
        author: pid,
        title: `Diario de sesión (${today})`,
        body: `${head}\n${topLines}`.slice(0, 1200),
        t: Date.now()
      });
      return { ok: true };
    }, `${player} (!resumen)`);
    if (!wr.ok) return sendLine(rcon, player, 'Diario', 'red', [{ text: wr.msg, color: 'yellow' }]);
    return sendLine(rcon, '@a', 'TRD 140-01', 'green', [{ text: `${player} publicó el Diario de sesión en Lore -> Crónicas.`, color: 'white' }]);
  }

  await sendLine(rcon, player, 'Resumen sesión', 'green', [{ text: `${head}\n${topLines}\n(Publicar en web: !resumen publicar)`, color: 'white' }]);
}

async function handleNovedadesCommand({ player, arg, bridge, rcon, enforcer, adminGenie }) {
  const pn = bridge.D.PATCH_NOTES;
  if (!pn || !Array.isArray(pn.slides) || !pn.slides.length) {
    return sendLine(rcon, player, 'Novedades', 'gray', [{ text: 'No hay notas del parche registradas todavía.', color: 'gray' }]);
  }
  const sub = String(arg || '').trim().toLowerCase();
  if (/^(?:show|todos|mostrar|play|pantalla|reproducir)$/i.test(sub)) {
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    if (role !== 'myth' && role !== 'scad') {
      return sendLine(rcon, player, 'Novedades', 'red', [{ text: 'Solo los fundadores pueden lanzar la presentación en pantalla para todos.', color: 'yellow' }]);
    }
    if (!adminGenie) {
      return sendLine(rcon, player, 'Novedades', 'red', [{ text: 'Genio !admin no disponible ahora.', color: 'yellow' }]);
    }
    adminGenie.fulfill('patchnotes').catch(e => console.warn('[Novedades show]', e.message));
    return;
  }
  const summary = pn.slides.map((s, i) => `${i + 1}. ${s.titulo}: ${s.subtitulo}`).join('\n');
  await sendLine(rcon, player, `Patch Notes ${pn.version}`, 'gold', [
    { text: `${summary}\n`, color: 'white' },
    { text: 'Fundadores: !novedades show (o en consola: say !admin patchnotes)', color: 'aqua' }
  ]);
}

async function handleRankingCommand({ player, bridge, rcon }) {
  const { state } = await bridge.fetchWorld(false);
  const era = bridge.getCurrentEra(state);
  const works = bridge.getWorksSummary(state);
  const mythNat = bridge.nat(state, 'myth');
  const scadNat = bridge.nat(state, 'scad');
  const bal = bridge.getBalances(state);
  const vil = Array.isArray(state.villagers) ? state.villagers.filter(v => !v.deceased) : [];
  const ccCount = vil.filter(v => v.kind !== 'animal').length;
  const caCount = vil.filter(v => v.kind === 'animal').length;
  const paidContracts = (Array.isArray(state.contracts) ? state.contracts : []).filter(c => c.status === 'pagado').length;
  const openContracts = (Array.isArray(state.contracts) ? state.contracts : []).filter(c => c.status !== 'pagado').length;
  const hCtx = bridge.getHolidaysContext(state);
  const nextH = hCtx.cal?.active?.[0] || hCtx.cal?.upcoming;

  await sendLine(rcon, player, 'Marcador Miscolandia', 'gold', [
    { text: `${era.code} (${era.name}): ${era.reqDone}/${era.reqTotal} obligatorios · Tasa ${bal.fxText}\n`, color: 'yellow' },
    { text: `• ${mythNat.nation}: ${works.auditedByOwner.myth.count} obras (${works.auditedByOwner.myth.pts} pts) · ${bal.states[0]}\n`, color: 'aqua' },
    { text: `• ${scadNat.nation}: ${works.auditedByOwner.scad.count} obras (${works.auditedByOwner.scad.pts} pts) · ${bal.states[1]}\n`, color: 'green' },
    { text: `• Censo: ${ccCount} CC + ${caCount} CA · Crónicas: ${(state.chronicles || []).length} · Encargos: ${paidContracts} pagados / ${openContracts} activos`, color: 'white' },
    ...(nextH ? [{ text: `\n• Festividad: ${nextH.emoji} ${nextH.name} (${nextH.active ? 'ACTIVA HOY' : `en ${nextH.daysLeft}d`})`, color: 'light_purple' }] : [])
  ]);
}

async function handleChatCommand(player, message, ctx) {
  const { cfg, bridge, rcon, enforcer } = ctx;
  const prefix = cfg.prefix || '!';
  if (!message.startsWith(prefix)) return;
  const body = message.slice(prefix.length).trim();
  if (!body) return;
  const space = body.indexOf(' ');
  const cmd = (space < 0 ? body : body.slice(0, space)).toLowerCase();
  const arg = space < 0 ? '' : body.slice(space + 1).trim();

  if (cmd === 'admin' || cmd === 'capricho' || cmd === 'genio') {
    await sendLine(rcon, player, 'Admin', 'red', [
      { text: 'Este comando solo se puede usar desde la consola del servidor (say !admin ...) o consola-admin.bat.', color: 'yellow' }
    ]);
    return;
  }

  if (cmd === 'ayuda' || cmd === 'fw' || cmd === 'help' || cmd === 'comandos') {
    if (arg) {
      const cleanKey = arg.replace(/^!+/, '').trim().toLowerCase().split(/\s+/)[0];
      const npcKey = NPC_HELP_ALIASES[cleanKey] || cleanKey;
      if (NPC_HELP_DOCS[npcKey]) {
        await sendLine(rcon, player, `NPC ${npcKey.toUpperCase()}`, 'aqua', [{ text: NPC_HELP_DOCS[npcKey], color: 'white' }]);
        return;
      }
      const canonical = COMMAND_ALIASES[cleanKey] || cleanKey;
      if (COMMAND_DOCS[canonical]) {
        await sendLine(rcon, player, `Ayuda !${canonical}`, 'aqua', [{ text: COMMAND_DOCS[canonical], color: 'white' }]);
        return;
      }
      await sendLine(rcon, player, 'Miscolandia', 'yellow', [
        { text: `No encontré "${cleanKey}". Usa `, color: 'gray' },
        { text: '!ayuda', color: 'aqua', bold: true },
        { text: ' o nombra un NPC en el chat.', color: 'gray' }
      ]);
      return;
    }
    await rcon.tellraw(player, [
      '',
      buildBadge('Miscolandia', 'aqua'),
      { text: 'Habla en chat por nombre:\n', color: 'gray' },
      { text: '  - ', color: 'gray' },
      { text: 'Juez', color: 'gold', bold: true },
      { text: ': leyes, disputas y multas\n', color: 'white' },
      { text: '  - ', color: 'gray' },
      { text: 'Fiscal', color: 'red', bold: true },
      { text: ': monopolios, PvP y aduana\n', color: 'white' },
      { text: '  - ', color: 'gray' },
      { text: 'Arquitecto', color: 'green', bold: true },
      { text: ': Eras y construcciones\n', color: 'white' },
      { text: '  - ', color: 'gray' },
      { text: 'Banquero', color: 'yellow', bold: true },
      { text: ': tasa, saldos y precios\n', color: 'white' },
      { text: '  - ', color: 'gray' },
      { text: 'Archivista', color: 'aqua', bold: true },
      { text: ': auditoria, lore, cronicas y cedulas\n', color: 'white' },
      { text: '  - ', color: 'gray' },
      { text: 'Cartografo', color: 'dark_aqua', bold: true },
      { text: ': portales, estaciones y coordenadas\n', color: 'white' },
      { text: '  - ', color: 'gray' },
      { text: 'Consejero', color: 'blue', bold: true },
      { text: ': filosofia, creacion de religion y sacerdote personal\n', color: 'white' },
      { text: '  - ', color: 'gray' },
      { text: 'Pregonero', color: 'light_purple', bold: true },
      { text: ': chismes y "recuerda <dato>"\n', color: 'white' },
      { text: 'Comandos: ', color: 'gray' },
      { text: '!hitos', color: 'green', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!obras', color: 'aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!duelo', color: 'aqua', bold: true },
      { text: ' (PvP) · ', color: 'gray' },
      { text: '!trato', color: 'aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!pase', color: 'aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!permiso', color: 'aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!mod', color: 'aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!chat', color: 'aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!memoria', color: 'aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!evento', color: 'gold', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!yo', color: 'green', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!expediente', color: 'red', bold: true },
      { text: '\nWeb & Mundo: ', color: 'gray' },
      { text: '!pagar', color: 'gold', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!cronica', color: 'aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!gps', color: 'dark_aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!portal', color: 'dark_aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!contratos', color: 'gold', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!fiesta', color: 'light_purple', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!ofrenda', color: 'light_purple', bold: true },
      { text: '/', color: 'gray' },
      { text: '!estudio', color: 'aqua', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!resumen', color: 'green', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!ranking', color: 'gold', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!novedades', color: 'aqua', bold: true },
      { text: '\nArchivo: ', color: 'gray' },
      { text: '!certificado', color: 'gold', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!papel', color: 'gold', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '!colores', color: 'aqua', bold: true }
    ]);
    return;
  }

  if (cmd === 'colores' || cmd === 'color' || cmd === 'formato') {
    const paletteParts = COLOR_PALETTE_LIST.flatMap((c, i) => [
      { text: i > 0 ? ' ' : '', color: 'gray' },
      { text: `${c.code} ${c.name}`, color: c.color }
    ]);
    await rcon.tellraw(player, [
      '',
      buildBadge('Archivo', 'aqua'),
      { text: 'Colores para !certificado y !papel:\n', color: 'white' },
      ...paletteParts,
      { text: '\nEstilos: ', color: 'gray' },
      { text: '&l Negrita', color: 'white', bold: true },
      { text: ' · ', color: 'gray' },
      { text: '&o Cursiva', color: 'white', italic: true },
      { text: ' · ', color: 'gray' },
      { text: '&n Subrayado', color: 'white', underlined: true },
      { text: ' · ', color: 'gray' },
      { text: '&m Tachado', color: 'white', strikethrough: true },
      { text: ' · ', color: 'gray' },
      { text: '&r Reset · &#RRGGBB Hex\n', color: 'aqua' },
      { text: 'Tip: escribe en tu Libro y Pluma con &6, &a, &l... y usa ', color: 'gray' },
      { text: '!certificado <Titulo>', color: 'gold', bold: true }
    ]);
    return;
  }

  if (cmd === 'certificado' || cmd === 'sellar' || cmd === 'cert' || cmd === 'libro') {
    const { state } = await bridge.fetchWorld(false);
    if (!isArchivistaPlayer(player, state)) {
      await sendLine(rcon, player, 'Archivo', 'red', [
        { text: 'Solo el Archivista Nacional (NotOutContext) puede expedir certificados y libros sellados.', color: 'yellow' }
      ]);
      return;
    }
    if (!arg || isHelpQuestion(arg)) {
      await rcon.tellraw(player, [
        '',
        buildBadge('Archivo', 'aqua'),
        { text: 'Uso de ', color: 'white' },
        { text: '!certificado', color: 'gold', bold: true },
        { text: ' (consume 1 Libro y Pluma real):\n', color: 'gray' },
        { text: '1) En mano: ', color: 'aqua', bold: true },
        { text: 'escribe un Libro y Pluma con &6, &a, &l... y pon ', color: 'white' },
        { text: '!certificado <&6Título>\n', color: 'gold' },
        { text: '2) Rápido: ', color: 'aqua', bold: true },
        { text: '!certificado <&6Título> | <&2Pág 1\\nLínea> || <&bPág 2>\n', color: 'gold' },
        { text: '3) Plantillas: ', color: 'aqua', bold: true },
        { text: '!certificado aval|obra|residencia|paz <datos>\n', color: 'white' },
        { text: '4) Coautores: ', color: 'aqua', bold: true },
        { text: 'añade al final autor: NotOutContext y MythStorm (o | autores: A, B y C) · Paleta: !colores', color: 'gold' }
      ]);
      return;
    }

    const { cleanArg, author: bookAuthor } = extractAuthorOption(arg, player);
    if (!cleanArg) {
      await sendLine(rcon, player, 'Archivo', 'yellow', [
        { text: 'Falta el título del certificado. Ej: !certificado <&6Título> autor: NotOutContext y MythStorm', color: 'white' }
      ]);
      return;
    }

    const firstToken = (cleanArg.split(/\s+/)[0] || '').toLowerCase();
    const restAfterToken = cleanArg.slice(firstToken.length).trim();
    const presetSpec = buildCertificatePreset(firstToken, restAfterToken, bookAuthor);

    let bookSpec = null;
    let modeUsed = '';

    if (presetSpec) {
      bookSpec = buildWrittenBookComponents({ ...presetSpec, author: bookAuthor, signer: player });
      modeUsed = 'preset';
    } else if (cleanArg.includes('|')) {
      const barIdx = cleanArg.indexOf('|');
      const titleRaw = cleanArg.slice(0, barIdx).trim();
      const bodyRaw = cleanArg.slice(barIdx + 1).trim();
      if (!titleRaw || !bodyRaw) {
        await sendLine(rcon, player, 'Archivo', 'yellow', [
          { text: 'Formato: !certificado <&6Título> | <&2Texto página 1> (usa || para cambiar de página).', color: 'white' }
        ]);
        return;
      }
      const pagesRaw = bodyRaw.split('||').map(s => s.trim()).filter(Boolean);
      bookSpec = buildWrittenBookComponents({ titleRaw, author: bookAuthor, signer: player, pagesRaw });
      modeUsed = 'inline';
    } else {
      const selRaw = await rcon.send(`data get entity ${player} SelectedItem`);
      const held = extractSelectedWritableBook(selRaw);
      const nonEmptyPages = (held.pages || []).filter(p => String(p || '').trim().length > 0);
      if (!held.isWritableBook || !nonEmptyPages.length) {
        await sendLine(rcon, player, 'Archivo', 'yellow', [
          { text: 'Sostén en tu mano principal un Libro y Pluma ya escrito (con códigos &6, &a, &l...) y repite !certificado <Título>, o usa !certificado <Título> | <Texto> con 1 Libro y Pluma en tu inventario.', color: 'white' }
        ]);
        return;
      }
      bookSpec = buildWrittenBookComponents({ titleRaw: cleanArg, author: bookAuthor, signer: player, pagesRaw: held.pages });
      const canReplaceHand = held.count === 1 && Buffer.byteLength(`item replace entity ${player} weapon.mainhand with ${bookSpec.giveItemArg} 1`, 'utf8') <= 1380;
      if (canReplaceHand) {
        await deliverWrittenBook(rcon, player, bookSpec, { replaceMainHand: true });
        await sendLine(rcon, player, 'Archivo', 'aqua', [
          { text: `Certificado "${bookSpec.plainTitle}" sellado (autor: ${bookSpec.author}; Libro y Pluma convertido).`, color: 'white' }
        ]);
        return;
      }
      modeUsed = 'hand';
    }

    const clr = await rcon.send(`clear ${player} minecraft:writable_book 1`);
    if (!/Removed\s+1\s+item/i.test(String(clr || ''))) {
      await sendLine(rcon, player, 'Archivo', 'red', [
        { text: 'Necesitas tener al menos 1 Libro y Pluma (minecraft:writable_book) en tu inventario para expedir el certificado.', color: 'yellow' }
      ]);
      return;
    }
    try {
      await deliverWrittenBook(rcon, player, bookSpec, { replaceMainHand: false });
    } catch (err) {
      await rcon.send(`give ${player} minecraft:writable_book 1`).catch(() => {});
      await sendLine(rcon, player, 'Archivo', 'red', [
        { text: `No se pudo sellar el libro (${err.message}); te devolví tu Libro y Pluma.`, color: 'yellow' }
      ]);
      return;
    }
    await sendLine(rcon, player, 'Archivo', 'aqua', [
      { text: `Certificado "${bookSpec.plainTitle}" expedido en colores (${modeUsed}, autor: ${bookSpec.author}; 1 Libro y Pluma consumido).`, color: 'white' }
    ]);
    return;
  }

  if (cmd === 'papel') {
    const { state } = await bridge.fetchWorld(false);
    if (!isArchivistaPlayer(player, state)) {
      await sendLine(rcon, player, 'Archivo', 'red', [
        { text: 'Solo el Archivista Nacional (NotOutContext) puede sellar papeles oficiales de colores.', color: 'yellow' }
      ]);
      return;
    }
    if (!arg || isHelpQuestion(arg)) {
      await sendLine(rcon, player, 'Archivo', 'aqua', [
        { text: 'Uso: !papel <&6&lNombre del documento> [| &7Subtítulo]. Consume 1 Papel real de tu inventario. Paleta: !colores', color: 'white' }
      ]);
      return;
    }
    const barIdx = arg.indexOf('|');
    const nameRaw = (barIdx >= 0 ? arg.slice(0, barIdx) : arg).trim();
    const loreRaw = barIdx >= 0 ? arg.slice(barIdx + 1).trim() : '';
    if (!nameRaw) {
      await sendLine(rcon, player, 'Archivo', 'yellow', [{ text: 'Escribe un nombre después de !papel.', color: 'white' }]);
      return;
    }
    const clr = await rcon.send(`clear ${player} minecraft:paper 1`);
    if (!/Removed\s+1\s+item/i.test(String(clr || ''))) {
      await sendLine(rcon, player, 'Archivo', 'red', [
        { text: 'Necesitas tener al menos 1 Papel (minecraft:paper) en tu inventario.', color: 'yellow' }
      ]);
      return;
    }
    const paperArg = buildColoredPaperItemArg({ nameRaw, loreRaw });
    try {
      const giveRes = await rcon.send(`give ${player} ${paperArg} 1`);
      if (/^(?:Unknown|Malformed|Expected|Incorrect|Invalid|No player)/i.test(String(giveRes || '').trim())) {
        throw new Error(giveRes);
      }
      await rcon.send(`execute at ${player} run playsound minecraft:block.enchantment_table.use master ${player} ~ ~ ~ 0.8 1.2`).catch(() => {});
    } catch (err) {
      await rcon.send(`give ${player} minecraft:paper 1`).catch(() => {});
      await sendLine(rcon, player, 'Archivo', 'red', [
        { text: `No se pudo sellar el papel (${err.message}); te devolví tu papel.`, color: 'yellow' }
      ]);
      return;
    }
    await sendLine(rcon, player, 'Archivo', 'aqua', [
      { text: `Papel oficial sellado y entregado (1 papel consumido).`, color: 'white' }
    ]);
    return;
  }

  if (cmd === 'pase') {
    if (await sendCommandHelpIfAsked('pase', arg, rcon, player)) return;
    const { state } = await bridge.fetchWorld(false);
    const senderRole = enforcer.getPlayerRole(player, state);
    if (senderRole === 'guest') {
      await sendLine(rcon, player, 'Fiscalía', 'red', [{ text: 'Solo un Estado fundador puede otorgar pases temporales de comercio.', color: 'yellow' }]);
      return;
    }
    const parts = arg.split(/\s+/).filter(Boolean);
    const first = (parts[0] || '').toLowerCase();
    if (!parts.length || ['todos', 'ambos', 'all', '@a'].includes(first)) {
      const mins = enforcer.startGlobalWindow(parseWindowMinutes(parts[1]), 'trato');
      await sendLine(rcon, '@a', 'Aduana', 'aqua', [
        { text: `Trato libre para todos activado por ${mins} min por ${player}. Usa !trato fin al terminar.`, color: 'white' }
      ]);
      return;
    }
    const canonicalTarget = resolveKnownPlayer(parts[0], cfg, enforcer);
    if (!canonicalTarget) {
      const knownList = [...getKnownPlayers(cfg, enforcer).values()].join(', ') || 'ninguno';
      await sendLine(rcon, player, 'Fiscalía', 'gold', [
        { text: `No veo al jugador "${parts[0]}". Conocidos: ${knownList}. Usa !pase <jugador> [min] o !trato [min] para todos.`, color: 'yellow' }
      ]);
      return;
    }
    const mins = enforcer.grantTradePass(canonicalTarget, parseWindowMinutes(parts[1]));
    await sendLine(rcon, '@a', 'Salvoconducto', 'aqua', [
      { text: `${player} otorgó a ${canonicalTarget} un pase diplomático de ${mins} min.`, color: 'white' }
    ]);
    return;
  }

  if (cmd === 'trato' || cmd === 'comercio' || cmd === 'libre' || cmd === 'tregua' || cmd === 'volver') {
    if (cmd !== 'volver' && await sendCommandHelpIfAsked('trato', arg, rcon, player)) return;
    const { state } = await bridge.fetchWorld(false);
    const senderRole = enforcer.getPlayerRole(player, state);
    if (senderRole === 'guest') {
      await sendLine(rcon, player, 'Aduana', 'red', [{ text: 'Solo un Estado fundador puede activar o cerrar una ventana de trato libre.', color: 'yellow' }]);
      return;
    }
    const sub = cmd === 'volver' ? 'fin' : arg.toLowerCase();
    if (sub === 'fin' || sub === 'off' || sub === 'cerrar') {
      enforcer.clearGlobalWindow('trato');
      await sendLine(rcon, '@a', 'Aduana', 'aqua', [
        { text: `Trato libre finalizado por ${player}. Vigilancia normal reanudada.`, color: 'white' }
      ]);
      return;
    }
    const mins = enforcer.startGlobalWindow(parseWindowMinutes(arg.split(/\s+/)[0]), 'trato');
    await sendLine(rcon, '@a', 'Aduana', 'aqua', [
      { text: `¡Entendido! Trato libre activado por ${mins} min por ${player} (no interfiero mientras se pasan ítems). Usa !trato fin al terminar.`, color: 'white' }
    ]);
    return;
  }

  if (cmd === 'duelo' || cmd === 'pvp') {
    if (await sendCommandHelpIfAsked('duelo', arg, rcon, player)) return;
    const { state } = await bridge.fetchWorld(false);
    const senderRole = enforcer.getPlayerRole(player, state);
    if (senderRole === 'guest') {
      await sendLine(rcon, player, 'Fiscalía', 'red', [{ text: 'Solo un Estado fundador puede declarar o cerrar un duelo consensuado.', color: 'yellow' }]);
      return;
    }
    const sub = arg.toLowerCase();
    if (sub === 'fin' || sub === 'off' || sub === 'cerrar') {
      enforcer.clearGlobalWindow('duelo');
      await sendLine(rcon, '@a', 'Fiscalía', 'gold', [
        { text: `Duelo finalizado por ${player}. Regla OOC de PvP activa de nuevo.`, color: 'white' }
      ]);
      return;
    }
    const mins = enforcer.startGlobalWindow(parseWindowMinutes(arg.split(/\s+/)[0]), 'duelo');
    await sendLine(rcon, '@a', 'Fiscalía', 'gold', [
      { text: `¡Duelo consensuado activo por ${mins} min (por ${player})! No interfiero en PvP. Usa !duelo fin al terminar.`, color: 'white' }
    ]);
    return;
  }

  if (cmd === 'mod') {
    if (await sendCommandHelpIfAsked('mod', arg, rcon, player)) return;
    const sub = arg.toLowerCase();
    const { state } = await bridge.fetchWorld(false);
    const senderRole = enforcer.getPlayerRole(player, state);
    if (sub === 'on' || sub === 'off') {
      if (senderRole === 'guest') {
        await sendLine(rcon, player, 'Fiscalía', 'red', [{ text: 'Solo los fundadores pueden pausar o activar la vigilancia automática.', color: 'yellow' }]);
        return;
      }
      enforcer.setEnabled(sub === 'on');
      await sendLine(rcon, '@a', 'Fiscalía', 'gold', [
        { text: `Vigilancia automática ${enforcer.enabled ? 'ACTIVADA (lo hecho durante la pausa no se sanciona)' : 'PAUSADA'} por ${player}.`, color: enforcer.enabled ? 'green' : 'yellow' }
      ]);
      return;
    }
    const { tradeMinsLeft, duelMinsLeft } = enforcer.getGlobalWindowStatus();
    const extra = [
      tradeMinsLeft > 0 ? `Trato libre (${tradeMinsLeft}m)` : '',
      duelMinsLeft > 0 ? `Duelo (${duelMinsLeft}m)` : ''
    ].filter(Boolean).join(' · ');
    await sendLine(rcon, player, 'Fiscalía', 'gold', [
      { text: `Vigilancia: ${enforcer.enabled ? 'ACTIVA' : 'PAUSADA'}${extra ? ` | ${extra}` : ''} | En línea: ${[...enforcer.onlinePlayers].join(', ') || 'nadie'}`, color: 'white' }
    ]);
    return;
  }

  if (cmd === 'chat' || cmd === 'pregonero') {
    if (await sendCommandHelpIfAsked('chat', arg, rcon, player)) return;
    const sub = arg.toLowerCase();
    const { state } = await bridge.fetchWorld(false);
    const senderRole = enforcer.getPlayerRole(player, state);
    if (sub === 'on' || sub === 'off') {
      if (senderRole === 'guest') {
        await sendLine(rcon, player, 'Pregonero', 'red', [{ text: 'Solo los fundadores pueden activar o silenciar los comentarios sociales.', color: 'yellow' }]);
        return;
      }
      chatBanterRuntime = sub === 'on';
      await sendLine(rcon, '@a', 'Pregonero', 'light_purple', [
        { text: `Comentarios espontáneos ${chatBanterRuntime ? 'ACTIVADOS' : 'SILENCIADOS'} por ${player}.`, color: chatBanterRuntime ? 'green' : 'yellow' }
      ]);
      return;
    }
    const active = isChatBanterEnabled(cfg);
    await sendLine(rcon, player, 'Pregonero', 'light_purple', [
      { text: `Comentarios en chat: ${active ? 'ACTIVOS' : 'SILENCIADOS'} | Uso: !chat on|off`, color: 'white' }
    ]);
    return;
  }

  if (cmd === 'era' || cmd === 'eras') {
    if (await sendCommandHelpIfAsked('era', arg, rcon, player)) return;
    if (arg) {
      await askSmartAi({ player, query: `Sobre la Era actual: ${arg}`, mode: 'ooc', cmdLabel: cmd, ctx });
      return;
    }
    const { state } = await bridge.fetchWorld(true);
    const era = bridge.getCurrentEra(state);
    await sendLine(rcon, player, `${era.code}`, 'gold', [
      { text: `${era.name} (${era.reqDone}/${era.reqTotal} oblig.) · `, color: 'white', bold: true },
      { text: era.focus, color: 'gray' }
    ]);
    await sendLine(rcon, player, 'Permitido', 'green', [{ text: era.allowed.join(' | ').slice(0, 320), color: 'white' }]);
    await sendLine(rcon, player, 'Prohibido', 'red', [{ text: era.banned.join(' | ').slice(0, 320), color: 'yellow' }]);
    return;
  }

  if (cmd === 'hitos' || cmd === 'faltan' || cmd === 'progreso') {
    if (await sendCommandHelpIfAsked('hitos', arg, rcon, player)) return;
    const { state } = await bridge.fetchWorld(true);
    const info = bridge.getPendingEraMilestones(state);
    const mythName = bridge.nat(state, 'myth').player || 'MythStorm';
    const scadName = bridge.nat(state, 'scad').player || 'Scadrial0523';
    const whoTxt = missing => {
      if (missing.length === 2) return `Ambos (${mythName} y ${scadName})`;
      return missing[0] === 'myth' ? mythName : scadName;
    };
    const lines = info.pendingReq.slice(0, 8).map(t => `• ${t.title} — falta: ${whoTxt(t.missing)}`);
    if (info.pendingReq.length > 8) {
      lines.push(`… y ${info.pendingReq.length - 8} hito(s) obligatorio(s) más.`);
    }
    await sendLine(rcon, player, `Roadmap ${info.eraCode}`, 'green', [
      { text: `${info.eraName} · Obligatorios: ${info.reqDone}/${info.reqTotal} (${info.totalDone}/${info.totalAll} globales, ${info.totalPct}%)\n`, color: 'white', bold: true },
      { text: lines.length ? lines.join('\n') : `¡Todos los obligatorios listos! Ya avanza a ${info.nextEraCode}.`, color: lines.length ? 'yellow' : 'green' }
    ]);
    return;
  }

  if (cmd === 'obras' || cmd === 'auditoria' || cmd === 'auditorias') {
    if (await sendCommandHelpIfAsked('obras', arg, rcon, player)) return;
    const { state } = await bridge.fetchWorld(true);
    const sum = bridge.getWorksSummary(state);
    const m = sum.auditedByOwner.myth;
    const s = sum.auditedByOwner.scad;
    const pendTxt = sum.pending.length
      ? sum.pending.slice(0, 6).map(w => `• ${w.name} (${w.ownerLabel}${w.coords ? ` · ${w.coords}` : ''}, prop. ${w.proposed} pts)`).join('\n')
      : 'Sin obras pendientes por auditar.';
    await sendLine(rcon, player, 'Catastro', 'gold', [
      {
        text: `Auditadas → ${bridge.nat(state, 'myth').nation}: ${m.count} (+${m.pts} pts) | ${bridge.nat(state, 'scad').nation}: ${s.count} (+${s.pts} pts)\n`,
        color: 'white',
        bold: true
      },
      { text: `Pendientes (${sum.pending.length}):\n${pendTxt}`, color: sum.pending.length ? 'aqua' : 'gray' }
    ]);
    return;
  }

  if (cmd === 'pacto' || cmd === 'monopolio' || cmd === 'monopolios') {
    if (await sendCommandHelpIfAsked('pacto', arg, rcon, player)) return;
    if (arg && (/\s/.test(arg) || arg.includes('?'))) {
      await askSmartAi({ player, query: `Sobre el Pacto de Monopolios: ${arg}`, mode: 'ooc', cmdLabel: cmd, ctx });
      return;
    }
    const { state } = await bridge.fetchWorld(false);
    const pact = bridge.getPactSummary(state, arg);
    await sendLine(rcon, player, pact.myth.nation, 'aqua', [{ text: pact.myth.sectors.join(' | ').slice(0, 320), color: 'white' }]);
    await sendLine(rcon, player, pact.scad.nation, 'green', [{ text: pact.scad.sectors.join(' | ').slice(0, 320), color: 'white' }]);
    if (arg) {
      await sendLine(rcon, player, 'Gremios', 'gold', [{ text: pact.professions.slice(0, 6).map(p => `${p.name}: ${p.nation}`).join(' · '), color: 'yellow' }]);
    } else {
      await sendLine(rcon, player, 'Reglas', 'gold', [{ text: pact.rules.slice(0, 2).map(r => `${r.t}: ${r.d}`).join(' | ').slice(0, 320), color: 'gray' }]);
    }
    return;
  }

  if (cmd === 'tasa' || cmd === 'cambio') {
    if (await sendCommandHelpIfAsked('tasa', arg, rcon, player)) return;
    if (arg && (arg.includes('?') || arg.split(/\s+/).length >= 3)) {
      await askSmartAi({ player, query: body, mode: 'auto', cmdLabel: cmd, ctx });
      return;
    }
    const { state } = await bridge.fetchWorld(true);
    const b = bridge.getBriefing(state);
    await sendLine(rcon, '@a', 'Cámara', 'light_purple', [
      { text: `${b.fxText} | Reservas: ${b.bankReserves}`, color: 'white' }
    ]);
    return;
  }

  if (cmd === 'saldo' || cmd === 'saldos' || cmd === 'tesoro') {
    if (await sendCommandHelpIfAsked('saldo', arg, rcon, player)) return;
    if (arg && (arg.includes('?') || arg.split(/\s+/).length >= 3)) {
      await askSmartAi({ player, query: body, mode: 'auto', cmdLabel: cmd, ctx });
      return;
    }
    const { state } = await bridge.fetchWorld(true);
    const bal = bridge.getBalances(state);
    for (const stLine of bal.states) {
      await sendLine(rcon, player, 'Tesoro', 'green', [{ text: stLine, color: 'white' }]);
    }
    if (bal.guests.length) {
      await sendLine(rcon, player, 'Invitados', 'aqua', [{ text: bal.guests.join(' | '), color: 'white' }]);
    }
    await sendLine(rcon, player, 'Banco', 'light_purple', [{ text: bal.bank, color: 'gray' }]);
    return;
  }

  if (cmd === 'precio' || cmd === 'precios') {
    if (await sendCommandHelpIfAsked('precio', arg, rcon, player)) return;
    if (arg && (arg.includes('?') || arg.split(/\s+/).length >= 3)) {
      await askSmartAi({ player, query: body, mode: 'auto', cmdLabel: cmd, ctx });
      return;
    }
    const { state } = await bridge.fetchWorld(false);
    const items = bridge.searchPrices(state, arg);
    if (!items.length) {
      await sendLine(rcon, player, 'Tienda', 'gold', [{ text: `Sin productos coincidentes${arg ? ` para "${arg}"` : ''}.`, color: 'gray' }]);
      return;
    }
    for (const it of items.slice(0, 4)) {
      await sendLine(rcon, player, it.seller, 'gold', [
        { text: `${it.name} (${it.unit}): `, color: 'white' },
        { text: it.priceMain, color: 'green', bold: true },
        { text: ` (~${it.priceOther})`, color: 'gray' }
      ]);
    }
    return;
  }

  if (cmd === 'cedula' || cmd === 'cédula' || cmd === 'censo') {
    if (await sendCommandHelpIfAsked('cedula', arg, rcon, player)) return;
    const { state } = await bridge.fetchWorld(false);
    const hits = bridge.findCedula(state, arg);
    if (!hits.length) {
      const msg = arg
        ? `Sin cédulas coincidentes para "${arg}".`
        : 'Aún no hay aldeanos ni mascotas cedulados en la web. Cuando registres alguno, búscalo con !cedula <nombre o código>.';
      await sendLine(rcon, player, 'TRD 150-01', 'aqua', [{ text: msg, color: 'gray' }]);
      return;
    }
    for (const c of hits.slice(0, 4)) {
      await sendLine(rcon, player, c.cedula, 'aqua', [
        { text: `${c.name} · ${c.kindLabel} (${c.nation}) · ${c.home} · `, color: 'white' },
        { text: c.deceased ? 'Archivo Histórico' : (c.tagged ? 'Tag puesta' : 'Sin Tag'), color: c.deceased ? 'red' : (c.tagged ? 'green' : 'yellow') }
      ]);
    }
    return;
  }

  if (cmd === 'lore' || cmd === 'cronicas' || cmd === 'crónicas' || cmd === 'historia') {
    if (await sendCommandHelpIfAsked('lore', arg, rcon, player)) return;
    if (arg) {
      await askSmartAi({ player, query: `Sobre el lore y crónicas de Miscolandia: ${arg}`, mode: 'auto', cmdLabel: cmd, ctx });
      return;
    }
    const { state } = await bridge.fetchWorld(true);
    const sum = bridge.getChroniclesSummary(state, 2);
    if (!sum.worldLines.length && !sum.chronList.length) {
      await sendLine(rcon, player, '📖 Lore', 'light_purple', [{ text: 'Aún no hay lore ni crónicas escritas en la web de Forever World.', color: 'gray' }]);
      return;
    }
    if (sum.worldLines.length) {
      await sendLine(rcon, player, '📖 Lore', 'light_purple', [{ text: sum.worldLines.slice(0, 2).join(' | ').slice(0, 320), color: 'white' }]);
    }
    if (!sum.chronList.length) {
      await sendLine(rcon, player, 'Crónicas', 'gold', [{ text: 'Sin crónicas publicadas aún; pueden escribirlas en Lore y Crónicas.', color: 'gray' }]);
    } else {
      for (const ch of sum.chronList) {
        await sendLine(rcon, player, `${ch.era} · ${ch.type}`, 'gold', [
          { text: `${ch.title} (${ch.author}): `, color: 'white', bold: true },
          { text: ch.body.slice(0, 180), color: 'gray' }
        ]);
      }
    }
    return;
  }

  if (cmd === 'permiso' || cmd === 'permisos' || cmd === 'autorizo' || cmd === 'autorizar') {
    if (await sendCommandHelpIfAsked('permiso', arg, rcon, player)) return;
    const mem = ctx.memory;
    if (!mem) return;
    const { state } = await bridge.fetchWorld(false);
    const senderRole = enforcer.getPlayerRole(player, state);
    const parts = arg.split(/\s+/).filter(Boolean);
    const first = (parts[0] || '').toLowerCase();

    // Ver permisos y prohibiciones: !permisos  |  !permiso ver [jugador]
    const PERMIT_ACTION_WORDS = ['quitar', 'retirar', 'revocar', 'anular', 'no', 'levantar', 'prohibir', 'vetar', 'bloquear', 'denegar', 'ban'];
    if ((cmd === 'permisos' && !PERMIT_ACTION_WORDS.includes(first)) || !parts.length || ['ver', 'lista', 'listar'].includes(first)) {
      const who = ['ver', 'lista', 'listar'].includes(first) ? parts[1] : (cmd === 'permisos' ? parts[0] : null);
      const target = who ? (resolveKnownPlayer(who, cfg, enforcer) || who) : null;
      const permits = mem.getActivePermits(target);
      const bans = mem.getActiveProhibitions(target);
      const lines = [
        ...permits.map(p => mem.describePermit(p)),
        ...bans.map(b => mem.describeProhibition(b))
      ];
      await sendLine(rcon, player, 'Permisos', 'aqua', [
        { text: lines.length ? lines.join('\n') : `Sin permisos ni prohibiciones vigentes${target ? ` para ${target}` : ''}.`, color: 'white' }
      ]);
      return;
    }

    if (senderRole !== 'myth' && senderRole !== 'scad') {
      await sendLine(rcon, player, 'Permisos', 'red', [{ text: 'Solo MythStorm o Scadrial0523 pueden dar, quitar o prohibir permisos.', color: 'yellow' }]);
      return;
    }

    const revoke = ['quitar', 'retirar', 'revocar', 'anular', 'no', 'levantar'].includes(first);
    const prohibit = !revoke && ['prohibir', 'vetar', 'bloquear', 'denegar', 'ban'].includes(first);
    if (revoke || prohibit) {
      parts.shift();
      if (revoke && ['prohibicion', 'prohibición', 'veto', 'bloqueo'].includes((parts[0] || '').toLowerCase())) {
        parts.shift();
      }
    }
    const target = resolveKnownPlayer(parts[0], cfg, enforcer);
    if (!target) {
      await sendLine(rcon, player, 'Permisos', 'gold', [{ text: `No conozco al jugador "${parts[0] || ''}". ${COMMAND_DOCS.permiso}`, color: 'yellow' }]);
      return;
    }
    if (target.toLowerCase() === player.toLowerCase()) {
      await sendLine(rcon, player, 'Permisos', 'gold', [{ text: 'No puedes darte permiso ni prohibirte algo a ti mismo.', color: 'yellow' }]);
      return;
    }

    // Alcance: monopolio (semillas, flores, cactus, tintes, ganado, aldeanos) o producto con granja
    const scopeInfo = sc => {
      if (sc && sc.startsWith('granja:')) {
        const lock = (bridge.D.FARM_LOCKS || []).find(l => l.id === sc.slice(7));
        return lock ? { owner: lock.owner, label: `${lock.label} (producto con granja)` } : null;
      }
      return PERMIT_SCOPES[sc] ? { owner: PERMIT_SCOPES[sc].owner, label: PERMIT_SCOPES[sc].label } : null;
    };
    const expandLegacy = list => {
      const out = [...list];
      if (out.includes('agro:cactus') && !out.includes('granja:cactus')) out.push('granja:cactus');
      return out;
    };
    let minutes = null;
    const noteParts = [];
    const rest = parts.slice(1);
    const scopes = [];
    for (let i = 0; i < rest.length; i++) {
      const tok = rest[i];
      const low = tok.toLowerCase();
      // "30 segundos", "2 horas": número y unidad por separado
      if (/^\d{1,4}$/.test(low) && DURATION_UNIT_RE.test((rest[i + 1] || '').toLowerCase()) && minutes === null) {
        minutes = unitToMinutes(Number(low), rest[i + 1].toLowerCase());
        i += 1;
        continue;
      }
      let sc = PERMIT_SCOPE_ALIASES[low];
      if (!sc && typeof bridge.D.findFarmLock === 'function') {
        const lock = bridge.D.findFarmLock(tok);
        if (lock) sc = `granja:${lock.id}`;
      }
      if (sc) { scopes.push(sc); continue; }
      const dur = parsePermitDuration(tok);
      if (dur !== undefined && minutes === null) { minutes = dur; continue; }
      if (!PERMIT_FILLER.has(low)) noteParts.push(tok);
    }

    const specific = [...new Set(scopes.filter(sc => sc.includes(':')))];
    const requestedScopes = specific.length ? specific : [...new Set(scopes)];
    const refused = [];

    if (revoke) {
      const revokeScopes = requestedScopes.length
        ? expandLegacy(requestedScopes)
        : [...new Set([
            senderRole === 'myth' ? 'agro' : 'ganado',
            'aldeanos',
            ...mem.getActivePermits(target).map(p => p.scope),
            ...mem.getActiveProhibitions(target).map(p => p.scope)
          ])];
      let removed = 0;
      const removedLabels = [];
      for (const sc of revokeScopes) {
        const info = scopeInfo(sc);
        if (!info) continue;
        if (info.owner !== 'any' && info.owner !== senderRole) {
          if (requestedScopes.length) refused.push(`${info.label} (solo ${PERMIT_OWNER_LABEL[info.owner]})`);
          continue;
        }
        const n = mem.revokePermit({ player: target, scope: sc, by: player })
          + mem.revokeProhibition({ player: target, scope: sc, by: player });
        if (n > 0) {
          removed += n;
          if (sc !== 'granja:cactus' || !removedLabels.some(l => l.includes('Cactus'))) removedLabels.push(info.label);
        }
      }
      if (refused.length && !removed) {
        await sendLine(rcon, player, 'Permisos', 'gold', [{ text: `No puedes quitar: ${refused.join('; ')}. Es monopolio del otro.`, color: 'yellow' }]);
        return;
      }
      const detail = removedLabels.length ? ` (${removedLabels.join(' + ')})` : '';
      await sendLine(rcon, removed ? '@a' : player, 'Permisos', 'aqua', [
        {
          text: removed
            ? `${player} retiró el permiso/prohibición de ${target}${detail}. La Aduana vuelve a aplicar la regla normal.`
            : `${target} no tenía permisos ni prohibiciones tuyas que quitar. Si quieres bloquear un recurso, usa: !permiso prohibir ${target} <recurso>.`,
          color: removed ? 'white' : 'yellow'
        }
      ]);
      return;
    }

    // Grant o Prohibit comparten validación de monopolio y soporte multi-alcance
    const toApply = requestedScopes.length ? requestedScopes : [senderRole === 'myth' ? 'agro' : 'ganado'];
    const applied = [];
    const note = noteParts.join(' ');
    for (const sc of toApply) {
      const info = scopeInfo(sc);
      if (!info) continue;
      if (info.owner !== 'any' && info.owner !== senderRole) {
        refused.push(`${info.label} (lo gestiona ${PERMIT_OWNER_LABEL[info.owner]})`);
        continue;
      }
      if (sc === 'agro:cactus') {
        mem.revokePermit({ player: target, scope: 'granja:cactus', by: player });
        mem.revokeProhibition({ player: target, scope: 'granja:cactus', by: player });
      }
      if (prohibit) {
        mem.grantProhibition({ player: target, scope: sc, prohibitedBy: player, grantorRole: senderRole, minutes, note, label: info.label });
      } else {
        mem.grantPermit({ player: target, scope: sc, grantedBy: player, grantorRole: senderRole, minutes, note, label: info.label });
      }
      applied.push(info.label);
    }
    if (refused.length) {
      await sendLine(rcon, player, 'Permisos', 'gold', [{ text: `No puedes ${prohibit ? 'prohibir' : 'dar'}: ${refused.join('; ')}. Es monopolio del otro.`, color: 'yellow' }]);
    }
    if (applied.length) {
      const durText = minutes ? `por ${fmtMinutes(minutes)}` : 'hasta nuevo aviso';
      await sendLine(rcon, '@a', prohibit ? 'Prohibición' : 'Permisos', prohibit ? 'red' : 'aqua', [
        {
          text: prohibit
            ? `${player} PROHÍBE a ${target}: ${applied.join(' + ')} ${durText}${note ? ` (${note})` : ''}. La Aduana confiscará de inmediato.`
            : `${player} autoriza a ${target}: ${applied.join(' + ')} ${durText}${note ? ` (${note})` : ''}. La Aduana no interfiere en eso.`,
          color: 'white'
        }
      ]);
    }
    return;
  }

  if (cmd === 'evento' || cmd === 'eventos') {
    if (await sendCommandHelpIfAsked('evento', arg, rcon, player)) return;
    const events = ctx.events;
    if (!events) {
      await sendLine(rcon, player, 'Evento', 'gold', [{ text: 'Los eventos del mundo aún no arrancan; intenta en unos segundos.', color: 'gray' }]);
      return;
    }
    const parts = arg.split(/\s+/).filter(Boolean);
    const sub = (parts[0] || '').toLowerCase();
    const { state } = await bridge.fetchWorld(false);
    const isFounder = ['myth', 'scad'].includes(enforcer.getPlayerRole(player, state));
    if (sub === 'lista' || sub === 'catalogo' || sub === 'catálogo') {
      const list = await events.catalogForEra();
      if (!list) {
        await sendLine(rcon, player, 'Evento', 'gold', [{ text: 'No sé en qué era están (la web no responde).', color: 'gray' }]);
        return;
      }
      await sendLine(rcon, player, `Eventos ${bridge.getCurrentEra(state).code}`, 'gold', [
        { text: list.map(e => `${e.id}${e.night ? '☾' : e.day ? '☀' : ''}`).join(' · ').slice(0, 900), color: 'white' },
        { text: `\n${list.length} desbloqueados (☾ solo de noche, ☀ solo de día). Fundadores: !evento lanzar <id>`, color: 'gray' }
      ]);
      return;
    }
    if (sub === 'lanzar' || sub === 'iniciar' || sub === 'forzar') {
      if (!isFounder) {
        await sendLine(rcon, player, 'Evento', 'red', [{ text: 'Solo MythStorm o Scadrial0523 pueden lanzar un evento a mano.', color: 'yellow' }]);
        return;
      }
      const id = (parts[1] || '').toLowerCase();
      if (!id) {
        await sendLine(rcon, player, 'Evento', 'gold', [{ text: 'Uso: !evento lanzar <id>. Mira los ids con !evento lista.', color: 'yellow' }]);
        return;
      }
      const res = await events.launchById(id, player);
      await sendLine(rcon, res.ok ? '@a' : player, 'Evento', res.ok ? 'gold' : 'red', [
        { text: res.ok ? `${player} invocó el evento "${res.ev.name}".` : res.msg, color: res.ok ? 'white' : 'yellow' }
      ]);
      return;
    }
    if (sub === 'on' || sub === 'off') {
      if (!isFounder) {
        await sendLine(rcon, player, 'Evento', 'red', [{ text: 'Solo los fundadores pueden pausar o reanudar los eventos espontáneos.', color: 'yellow' }]);
        return;
      }
      events.enabled = sub === 'on';
      await sendLine(rcon, '@a', 'Evento', 'gold', [
        { text: `Eventos espontáneos ${events.enabled ? 'ACTIVADOS' : 'PAUSADOS'} por ${player} (los programados en la config siguen corriendo).`, color: 'white' }
      ]);
      return;
    }
    const act = events.activeInfo();
    const hhmm = t => new Date(t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const next = events.nextWindows(3).map(hhmm);
    await sendLine(rcon, player, 'Evento', 'gold', [
      act
        ? { text: `En curso: ${act.name}${act.minsLeft ? ` (quedan ~${act.minsLeft} min)` : ''}. `, color: 'yellow', bold: true }
        : { text: 'Ningún evento en curso. ', color: 'white' },
      { text: events.enabled
          ? (next.length ? `Ventanas posibles: ${next.join(', ')} (puede no tocar nada si la era o la hora no cuadran).` : 'Sin ventanas próximas en las siguientes horas.')
          : 'Eventos espontáneos PAUSADOS.', color: 'gray' }
    ]);
    return;
  }

  if (cmd === 'yo' || cmd === 'perfil' || cmd === 'ficha') {
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    const mem = ctx.memory;
    const permits = mem?.getActivePermits(player) || [];
    const bans = mem?.getActiveProhibitions(player) || [];
    const weekAgo = Date.now() - 7 * 86_400_000;
    const infr = mem?.countInfractions?.(player, weekAgo) || 0;
    const lines = [
      { text: `${buildPlayerIdentity(player, role, state, bridge)}\n`, color: 'white', bold: true },
      { text: `Permisos: ${permits.length ? permits.map(p => p.label || p.scope).join(', ') : 'ninguno'}\n`, color: permits.length ? 'green' : 'gray' },
      { text: `Prohibiciones: ${bans.length ? bans.map(p => p.label || p.scope).join(', ') : 'ninguna'}\n`, color: bans.length ? 'red' : 'gray' },
      { text: `Infracciones (7 días): ${infr}${infr ? ' · detalle con !expediente' : ''}`, color: infr ? 'yellow' : 'gray' }
    ];
    if (role === 'myth' || role === 'scad') {
      const bal = bridge.getBalances(state).states[role === 'myth' ? 0 : 1];
      const custody = enforcer.formatItemCounts(new Map(Object.entries(enforcer.pendingCustody?.[role] || {}).map(([k, v]) => [k, Number(v) || 0])));
      lines.push({ text: `\nTesoro: ${bal}`, color: 'gold' });
      if (custody) lines.push({ text: `\nEn custodia de la Aduana para ti: ${custody}`, color: 'aqua' });
    }
    if (enforcer.hasTradePass(player)) lines.push({ text: '\nTienes un pase diplomático vigente.', color: 'aqua' });
    await sendLine(rcon, player, 'Ficha', 'green', lines);
    return;
  }

  if (cmd === 'expediente' || cmd === 'multas' || cmd === 'historial' || cmd === 'infracciones') {
    if (await sendCommandHelpIfAsked('expediente', arg, rcon, player)) return;
    const who = arg ? (resolveKnownPlayer(arg.split(/\s+/)[0], cfg, enforcer) || arg.split(/\s+/)[0]) : player;
    const list = ctx.memory?.getInfractions?.(who, 6) || [];
    const dd = t => new Date(t).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    await sendLine(rcon, player, `Expediente ${who}`, 'red', [
      {
        text: list.length
          ? list.map(e => `• ${dd(e.ts)} — ${e.text}${e.seized ? ` (incautado: ${e.seized})` : ''}`).join('\n')
          : `Expediente limpio: la Aduana no tiene infracciones registradas de ${who}.`,
        color: list.length ? 'yellow' : 'green'
      }
    ]);
    return;
  }

  if (cmd === 'pagar' || cmd === 'transferir' || cmd === 'enviar' || cmd === 'pay') {
    await handlePayCommand({ player, arg, bridge, rcon, memory: ctx.memory });
    return;
  }

  if (cmd === 'cronica' || cmd === 'crónica') {
    await handleCronicaCommand({ player, arg, bridge, rcon, memory: ctx.memory });
    return;
  }

  if (cmd === 'portal') {
    await handleGeoSaveCommand({ kind: 'portal', player, arg, bridge, rcon, memory: ctx.memory });
    return;
  }

  if (cmd === 'estacion' || cmd === 'estación') {
    await handleGeoSaveCommand({ kind: 'station', player, arg, bridge, rcon, memory: ctx.memory });
    return;
  }

  if (cmd === 'gps' || cmd === 'donde' || cmd === 'dónde' || cmd === 'ruta') {
    await handleGpsCommand({ player, arg, bridge, rcon });
    return;
  }

  if (cmd === 'contrato' || cmd === 'contratos' || cmd === 'encargo' || cmd === 'encargos') {
    await handleContractCommand({ player, arg, bridge, rcon, memory: ctx.memory });
    return;
  }

  if (cmd === 'ofrenda') {
    await handleOfferingCommand({ kind: 'fe', player, bridge, rcon, enforcer, deity: ctx.deity });
    return;
  }

  if (cmd === 'estudio') {
    await handleOfferingCommand({ kind: 'razon', player, bridge, rcon, enforcer, deity: ctx.deity });
    return;
  }

  if (cmd === 'fiesta' || cmd === 'festividad' || cmd === 'festividades' || cmd === 'temporada') {
    await handleHolidayCommand({ player, bridge, rcon, deity: ctx.deity, enforcer });
    return;
  }

  if (cmd === 'resumen' || cmd === 'diario') {
    await handleSummaryCommand({ player, arg, bridge, rcon, memory: ctx.memory, enforcer });
    return;
  }

  if (cmd === 'novedades' || cmd === 'patchnotes' || cmd === 'patch' || cmd === 'changelog') {
    await handleNovedadesCommand({ player, arg, bridge, rcon, enforcer, adminGenie: ctx.adminGenie });
    return;
  }

  if (cmd === 'ranking' || cmd === 'estadisticas' || cmd === 'estadísticas' || cmd === 'stats' || cmd === 'marcador' || cmd === 'top') {
    await handleRankingCommand({ player, bridge, rcon });
    return;
  }

  if (cmd === 'anuncios' || cmd === 'anuncio') {
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    if (role !== 'myth' && role !== 'scad') {
      return sendLine(rcon, player, 'Anuncios', 'red', [{ text: 'Solo los fundadores pueden pausar o reanudar los anuncios web->MC.', color: 'yellow' }]);
    }
    const sub = String(arg || '').trim().toLowerCase();
    if (sub === 'on' || sub === 'off') {
      if (ctx.webSync) ctx.webSync.announcementsEnabled = sub === 'on';
      return sendLine(rcon, '@a', 'Anuncios Web', sub === 'on' ? 'green' : 'gold', [
        { text: `Anuncios web -> Minecraft ${sub === 'on' ? 'ACTIVADOS' : 'PAUSADOS'} por ${player}.`, color: 'white' }
      ]);
    }
    return sendLine(rcon, player, 'Anuncios Web', 'aqua', [
      { text: `Estado: ${ctx.webSync?.announcementsEnabled === false ? 'PAUSADOS' : 'ACTIVOS'}. Usa !anuncios on | off.`, color: 'white' }
    ]);
  }

  if (cmd === 'recuerda' || cmd === 'anota' || cmd === 'apunta') {
    if (!arg || isHelpQuestion(arg)) {
      await sendLine(rcon, player, 'Ayuda !recuerda', 'aqua', [{ text: COMMAND_DOCS.recuerda, color: 'white' }]);
      return;
    }
    const entry = ctx.memory?.addPinnedNote(player, arg);
    if (entry) {
      await sendLine(rcon, '@a', 'Pregonero', 'light_purple', [
        { text: `¡Anotado en mi libreta, ${player}! No se me olvida: "${entry.note}".`, color: 'white' }
      ]);
    }
    return;
  }

  if (cmd === 'memoria' || cmd === 'recuerdos') {
    if (await sendCommandHelpIfAsked('memoria', arg, rcon, player)) return;
    const sub = arg.toLowerCase();
    const { state } = await bridge.fetchWorld(false);
    const senderRole = enforcer.getPlayerRole(player, state);
    if (sub === 'compactar' || sub === 'guardar') {
      if (senderRole === 'guest') {
        await sendLine(rcon, player, '🧠 Memoria', 'red', [{ text: 'Solo los fundadores pueden compactar la memoria manualmente.', color: 'yellow' }]);
        return;
      }
      const era = bridge.getCurrentEra(state);
      const res = await ctx.memory?.compactNow({
        reason: 'manual',
        eraLabel: era.code,
        compactorFn: args => compactSessionMemory({ config: cfg, ...args })
      });
      if (res?.compacted) {
        await sendLine(rcon, '@a', '🧠 Memoria', 'aqua', [
          { text: `¡Sesión compactada! ${res.entry.summary}`, color: 'white' }
        ]);
      } else {
        await sendLine(rcon, player, '🧠 Memoria', 'gold', [
          { text: 'Muy pocos eventos nuevos todavía para compactar (se compacta automático al hacer stop).', color: 'yellow' }
        ]);
      }
      return;
    }
    if (sub === 'limpiar' || sub === 'reset') {
      if (senderRole === 'guest') {
        await sendLine(rcon, player, '🧠 Memoria', 'red', [{ text: 'Solo los fundadores pueden limpiar el registro temporal.', color: 'yellow' }]);
        return;
      }
      ctx.memory?.clearPending();
      await sendLine(rcon, player, '🧠 Memoria', 'aqua', [
        { text: 'Registro temporal de esta sesión limpiado (se conservan resúmenes pasados y notas).', color: 'white' }
      ]);
      return;
    }
    const st = ctx.memory?.getStats() || { recentCount: 0, pendingCount: 0, sessionsCount: 0, notesCount: 0, latestSessions: [] };
    await sendLine(rcon, player, '🧠 Memoria', 'aqua', [
      { text: `${st.sessionsCount} sesiones compactadas · ${st.notesCount} notas · ${st.pendingCount} eventos en curso · ${st.recentCount} msgs en hilo`, color: 'white' }
    ]);
    for (const s of st.latestSessions) {
      await sendLine(rcon, player, String(s.endedAt || '').slice(0, 10) || s.era, 'gold', [
        { text: s.summary.slice(0, 240), color: 'gray' }
      ]);
    }
    return;
  }

  if (cmd === 'duda' || cmd === 'pregunta' || cmd === 'preguntar' || cmd === 'ia' || cmd === 'bot' || cmd === 'alguacil') {
    if (!arg || isHelpQuestion(arg)) {
      await sendLine(rcon, player, 'Archivo', 'aqua', [
        { text: 'Escribe !duda <tu pregunta> (ej. !duda puedo matar vacas? o !duda para que sirve !trato?).', color: 'white' }
      ]);
      return;
    }
    await askSmartAi({ player, query: arg, mode: 'auto', cmdLabel: cmd, ctx });
    return;
  }

  if (cmd === 'que' || cmd === 'como' || cmd === 'puedo') {
    await askSmartAi({ player, query: body, mode: 'auto', cmdLabel: cmd, ctx });
    return;
  }

  const aiCmd = cmd === 'reglas' ? 'ooc' : cmd;
  if (aiCmd === 'ley' || aiCmd === 'juez' || aiCmd === 'manual' || aiCmd === 'ooc') {
    await askSmartAi({ player, query: arg, mode: aiCmd, cmdLabel: cmd, ctx });
    return;
  }

  // Fallback para preguntas naturales con "!" (ej. "!puedo construir...") o comandos mal escritos
  if (arg || body.includes('?')) {
    await askSmartAi({ player, query: body, mode: 'auto', cmdLabel: cmd, ctx });
    return;
  }

  await sendLine(rcon, player, 'Miscolandia', 'yellow', [
    { text: `Habla directo con un NPC en el chat (ej. "arquitecto...", "excelencia...", "fiscal..."). Usa `, color: 'gray' },
    { text: '!ayuda', color: 'aqua', bold: true },
    { text: ' para ver NPCs y comandos útiles.', color: 'gray' }
  ]);
}

const TRADE_INTENT_RE = /(?:nos\s+vamos\s+a\s+(?:pasar|dar|intercambiar|comerciar)|vamos\s+a\s+(?:pasar(?:nos)?|intercambiar|comerciar|cambiar|hacer\s+un\s+trato)|(?:te|le)\s+voy\s+a\s+pasar|p[aá]sa(?:me|le)\s+(?:comida|cosas|papas|trigo|carne|semillas|huevos)|d[eé]janos\s+(?:pasar|comerciar|intercambiar)|trato\s+libre)/i;
// "no molestes", "no te metas", "déjanos en paz"... son frases normales entre jugadores:
// solo cuentan como pedir trato libre si van dirigidas al bot (Aduana, Fiscal, bot...).
const SOFT_TRADE_INTENT_RE = /(?:no\s+(?:interfieras|te\s+metas|molestes|confisques|quites)|no\s+necesitamos\s+que\s+interfieras|d[eé]janos\s+en\s+paz)/i;
const ADDRESS_BOT_RE = /\b(?:aduana|fiscal\w*|bot|moderador|polic[ií]a|alguacil|vigilancia)\b/i;
const DUEL_INTENT_RE = /(?:vamos\s+a\s+(?:hacer\s+(?:un\s+)?|tener\s+(?:un\s+)?)?(?:duelo|pvp)|(?:duelo|pvp|combate|pelea)\s+(?:pactad[oa]|consensuad[oa]|amistoso))/i;
const RESUME_INTENT_RE = /(?:ya\s+(?:terminamos|acabamos|puedes\s+(?:vigilar|volver|seguir))|listo\s+el\s+trato)/i;

async function maybeHandleChatTruce(player, clean, { bridge, rcon, enforcer }) {
  const isResume = RESUME_INTENT_RE.test(clean);
  const isDuel = DUEL_INTENT_RE.test(clean);
  const isTrade = TRADE_INTENT_RE.test(clean) || (SOFT_TRADE_INTENT_RE.test(clean) && ADDRESS_BOT_RE.test(clean));
  if (!isResume && !isDuel && !isTrade) return false;

  try {
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    if (role !== 'myth' && role !== 'scad') return false;

    if (isResume && (enforcer.isGlobalTradeActive() || enforcer.isGlobalDuelActive())) {
      enforcer.clearGlobalWindow('all');
      await sendLine(rcon, '@a', 'Aduana', 'aqua', [
        { text: `¡Perfecto, ${player}! Retomo la vigilancia normal de Miscolandia.`, color: 'white' }
      ]);
      return true;
    }
    const minMatch = clean.match(/(\d{1,2})\s*min/i);
    if (isDuel) {
      const mins = enforcer.startGlobalWindow(minMatch ? Number(minMatch[1]) : 5, 'duelo');
      await sendLine(rcon, '@a', 'Fiscalía', 'gold', [
        { text: `¡Duelo consensuado registrado por ${mins} min! No me meto en PvP (di "!duelo fin" al terminar).`, color: 'white' }
      ]);
      return true;
    }
    if (isTrade) {
      const mins = enforcer.startGlobalWindow(minMatch ? Number(minMatch[1]) : 5, 'trato');
      await sendLine(rcon, '@a', 'Aduana', 'aqua', [
        { text: `¡Copiado, ${player}! No interfiero durante ${mins} min mientras se pasan las cosas (di "!trato fin" o "ya terminamos" cuando acaben).`, color: 'white' }
      ]);
      return true;
    }
  } catch (err) {
    console.error('[ChatTruce]', err.message);
  }
  return false;
}

const DIRECT_PREGONERO_RE = /\bpregonero\b/i;
const JUDGE_HONORIFIC_RE = /\b(?:su\s+excelencia|excelencia|su\s+se[ñn]or[ií]a|se[ñn]or\s+juez|magistrad[oa]|vuestra\s+merced)\b/i;
// Insultos de verdad (no basta con decirle "juez" a secas)
const JUDGE_INSULT_RE = /\b(?:idiota|tont[oa]|est[uú]pid[oa]|imb[eé]cil|in[uú]til|payas[oa]|corrupt[oa]|vendid[oa]|bob[oa]|pendej[oa]|hu?ev[oó]n|guev[oó]n|malparid[oa]|gonorrea|mam[oó]n|ridícul[oa]|ridicul[oa]|ignorante|incompetente|ladr[oó]n|rata|basura|juececito|juecito|cállate|callate)\b|de\s+(?:pacotilla|mierda|quinta)/i;
const RULE_QUESTION_RE = /\b(?:puedo|puede|podemos|se\s+puede|permitid\w*|prohibid\w*|ley\w*|norma\w*|multa\w*|sanci[oó]n\w*|era\w*|pacto|monopolio\w*|aldean\w*|comando\w*|tasa|cambio|saldo\w*|precio\w*|c[eé]dula\w*|audit\w*|obra\w*|reliquia\w*|punt\w*|metro|tren\w*|riel\w*|granja\w*|nether|end|pvp|duelo|trato|pase|huevo\w*|semilla\w*|vaca\w*|pollo\w*|lore|cr[oó]nica\w*|historia)\b/i;
let lastDirectPregoneroAt = 0;
let lastDirectNpcAt = 0;
const npcCooldown = new Map(); // jugador -> último mensaje a un NPC

function resolveConsejeroProfile(state, player, role, bridge, deity = null) {
  const fallback = {
    stage: 'filosofo',
    pid: null,
    dev: { path: null, creed: null, level: 0, total: 0 },
    rel: null,
    rawRel: null,
    faithShort: '',
    badge: 'Consejero',
    badgeColor: 'blue',
    logName: 'Consejero'
  };
  if (!state || !bridge) return fallback;
  const pid = (role === 'myth' || role === 'scad')
    ? role
    : (deity?.playerPid?.(player, role, state)
      || (state?.guests || []).find(g => String(g?.nick || '').toLowerCase() === String(player || '').toLowerCase())?.id
      || null);
  const dev = pid ? bridge.getDevotion(state, pid) : fallback.dev;
  const rels = bridge.getReligions(state) || [];
  const rawRel = pid && state?.religions?.[pid] && typeof state.religions[pid] === 'object' ? state.religions[pid] : null;
  const rel = rels.find(r => r.pid === (dev.creed || pid)) || null;
  const faithShort = (rel?.faith || rawRel?.faith || '').trim().slice(0, 22);
  const hasDraft = Boolean(rawRel && ['faith', 'names', 'nature', 'pleases', 'angers', 'prayer', 'rites'].some(k => String(rawRel[k] || '').trim()));

  if (dev.path === 'razon') {
    const high = dev.level >= 3;
    return {
      stage: 'razon',
      pid,
      dev,
      rel,
      rawRel,
      faithShort: 'La Razón',
      badge: high ? 'Rector Filósofo' : 'Consejero',
      badgeColor: high ? 'aqua' : 'blue',
      logName: 'Consejero'
    };
  }
  if (dev.path === 'fe' && dev.level >= 2) {
    return {
      stage: 'sacerdote',
      pid,
      dev,
      rel,
      rawRel,
      faithShort,
      badge: faithShort ? `Sacerdote · ${faithShort}` : 'Sacerdote',
      badgeColor: 'dark_purple',
      logName: 'Sacerdote'
    };
  }
  if (dev.path === 'fe' || hasDraft) {
    return {
      stage: 'guia',
      pid,
      dev,
      rel,
      rawRel,
      faithShort,
      badge: faithShort ? `Guía · ${faithShort}` : 'Guía Espiritual',
      badgeColor: 'blue',
      logName: 'Guía'
    };
  }
  return { ...fallback, pid, dev, rawRel };
}

const NPC_CAST = [
  {
    id: 'juez',
    badge: 'Juez',
    badgeColor: 'gold',
    logName: 'Juez',
    re: /\b(?:su\s+excelencia|excelencia|su\s+se[ñn]or[ií]a|se[ñn]or\s+juez|juez|magistrad[oa]|tribunal)\b/i,
    stripRe: /\b(?:su\s+excelencia|excelencia|su\s+se[ñn]or[ií]a|se[ñn]or\s+juez|juez|magistrad[oa]|tribunal)\b[:,!\s]*/gi,
    // Tres tonos: con título de respeto se pone solemne y complacido; si solo le dicen "juez" responde
    // normal (antes lo tomaba como insolencia); solo se indigna si de verdad lo insultan.
    buildPersona(clean) {
      const polite = JUDGE_HONORIFIC_RE.test(clean);
      const insulted = JUDGE_INSULT_RE.test(clean);
      const base = 'Eres el Juez del Tribunal de Miscolandia.';
      return {
        polite: !insulted,
        insulted,
        selfIdentity: 'TÚ eres el Juez del Tribunal de Miscolandia (a ti, y solo a ti, te corresponden los títulos de Excelencia o Señoría).',
        roleDesc: insulted
          ? `${base} ¡El jugador te acaba de INSULTAR! Empieza poniéndolo en su sitio con indignación y drama judicial (sin groserías), y luego respóndele igual con precisión según <normativa_vigente>.`
          : polite
            ? `${base} El jugador te habló con el título de respeto (Excelencia / Su Señoría / Señor Juez): respóndele con porte solemne, complacido, justo y preciso, citando las leyes o normas pertinentes.`
            : `${base} Respóndele con seriedad, imparcialidad y precisión, citando las leyes o normas pertinentes. Llamarte simplemente "juez" es correcto y NO es una falta de respeto: no lo regañes por eso.`,
        temperature: 0.45,
        extraRules: insulted
          ? ['12. ¡OBLIGATORIO! Empieza tu respuesta reprochándole el insulto antes de darle la respuesta.']
          : []
      };
    },
    buildContext(state, q, { bridge, memory, player }) {
      const pact = bridge.getPactSummary(state, q);
      // El Juez conoce el expediente real de quien le habla (para multas y reincidencia)
      const record = player && memory?.getInfractions ? memory.getInfractions(player, 5) : [];
      const recordTxt = player
        ? (record.length
          ? `[EXPEDIENTE DE ${player} SEGÚN LA ADUANA]\n${record.map(e => `- ${new Date(e.ts).toISOString().slice(0, 10)}: ${e.text}`).join('\n')}`
          : `[EXPEDIENTE DE ${player}]: limpio, sin infracciones registradas por la Aduana.`)
        : '';
      return [
        BOT_COMMANDS_DOC,
        recordTxt,
        ...bridge.findRelevantNorms(state, q, { limit: 6, isJuez: true, includeOoc: true }),
        `Resumen Pacto: ${pact.myth.nation} (${pact.myth.sectors.map(s => s.split(':')[0]).join(', ')}) | ${pact.scad.nation} (${pact.scad.sectors.map(s => s.split(':')[0]).join(', ')})`,
        bridge.getEraExpectationsSummary(state)
      ].filter(Boolean);
    }
  },
  {
    id: 'fiscal',
    badge: 'Fiscal',
    badgeColor: 'red',
    logName: 'Fiscal',
    re: /\b(?:fiscal|polic[ií]a|poli|comisario|patrulla|alguacil|aduana)\b/i,
    stripRe: /\b(?:fiscal|polic[ií]a|poli|comisario|patrulla|alguacil|aduana)\b[:,!\s]*/gi,
    buildPersona() {
      return {
        polite: true,
        selfIdentity: 'TÚ eres el Fiscal y Policía de Aduanas de Miscolandia.',
        roleDesc: 'Eres el Fiscal y Policía de Aduanas de Miscolandia. Hablas como policía estricto, desconfiado, directo y un poco picante: sospechas de contrabando de semillas, huevos o cultivos en cada esquina, pero explicas con claridad las normas de monopolios, PvP y pases.',
        temperature: 0.45
      };
    },
    buildContext(state, q, { bridge, enforcer }) {
      const { tradeMinsLeft, duelMinsLeft } = enforcer.getGlobalWindowStatus();
      const statusTxt = `Estado policial actual: vigilancia=${enforcer.enabled ? 'ACTIVA' : 'PAUSADA'}, tratoLibre=${tradeMinsLeft}m, duelo=${duelMinsLeft}m.`;
      return [
        BOT_COMMANDS_DOC,
        statusTxt,
        ...bridge.findOocContext(state, q),
        ...bridge.findRelevantNorms(state, q, { limit: 4, isJuez: false, includeOoc: true })
      ].filter(Boolean);
    }
  },
  {
    id: 'arquitecto',
    badge: 'Arquitecto',
    badgeColor: 'green',
    logName: 'Arquitecto',
    re: /\b(?:arquitecto|maestro\s+de\s+obras|ingeniero|constructor)\b/i,
    stripRe: /\b(?:arquitecto|maestro\s+de\s+obras|ingeniero|constructor)\b[:,!\s]*/gi,
    buildPersona() {
      return {
        polite: true,
        selfIdentity: 'TÚ eres El Arquitecto, el Maestro de Eras y Obras de Miscolandia.',
        roleDesc: 'Eres El Arquitecto y Maestro de Obras de Miscolandia. Hablas como maestro constructor práctico, exigente con los planos y con humor seco cuando alguien quiere hacer metro o granjas automáticas antes de su Era; explicas con claridad qué toca construir en la Era actual y en cuál Era se desbloquea cada mecánica.',
        temperature: 0.45
      };
    },
    buildContext(state, q, { bridge }) {
      return [...new Set([
        BOT_COMMANDS_DOC,
        bridge.getEraExpectationsSummary(state),
        ...bridge.findOocContext(state, q),
        ...bridge.findRelevantNorms(state, q, { limit: 3, isJuez: false, includeOoc: true })
      ].filter(Boolean))];
    }
  },
  {
    id: 'banquero',
    badge: 'Banquero',
    badgeColor: 'yellow',
    logName: 'Banquero',
    re: /\b(?:don\s+tesoro|banquero|tesorero|contador)\b/i,
    stripRe: /\b(?:don\s+tesoro|banquero|tesorero|contador)\b[:,!\s]*/gi,
    buildPersona() {
      return {
        polite: true,
        selfIdentity: 'TÚ eres Don Tesoro, el Banquero de La Gran Cámara del Ender en Miscolandia.',
        roleDesc: 'Eres Don Tesoro, el Banquero de La Gran Cámara del Ender en Miscolandia. Hablas como contador tacaño, obsesionado con los decimales del cambio DR/CU, las reservas, la inflación y el respaldo; eres un poco cascarrabias con el gasto, pero das las cifras y reglas exactas del Manual Económico y de Auditoría.',
        temperature: 0.4
      };
    },
    buildContext(state, q, { bridge }) {
      const b = bridge.getBriefing(state);
      const bal = bridge.getBalances(state);
      const prices = bridge.searchPrices(state, q);
      const priceLines = prices.map(p => `- ${p.name} (${p.unit}, ${p.seller}): ${p.priceMain} (~${p.priceOther})`);
      return [
        BOT_COMMANDS_DOC,
        `[DATOS ECONÓMICOS EN VIVO]\nCambio: ${b.fxText}\nReservas Cámara: ${b.bankReserves}\nSaldos: ${bal.states.join(' ; ')}${bal.guests.length ? ` | Invitados: ${bal.guests.join(' ; ')}` : ''}`,
        priceLines.length ? `[CATÁLOGO DE PRECIOS COINCIDENTE]\n${priceLines.join('\n')}` : '',
        ...bridge.getEconomyManualExcerpts(state, q),
        ...bridge.findRelevantNorms(state, q, { limit: 2, isJuez: false, includeOoc: false })
      ].filter(Boolean);
    }
  },
  {
    id: 'archivista',
    badge: 'Archivista',
    badgeColor: 'aqua',
    logName: 'Archivista',
    re: /\b(?:archivista|auditor|cronista|bibliotecario)\b/i,
    stripRe: /\b(?:archivista|auditor|cronista|bibliotecario)\b[:,!\s]*/gi,
    buildPersona() {
      return {
        polite: true,
        selfIdentity: 'TÚ eres El Archivista Oficial y Auditor Nacional de Obras de Miscolandia.',
        roleDesc: 'Eres El Archivista Oficial y Auditor Nacional de Obras de Miscolandia (TRD 120-01, 140-01 y 150-01). Hablas como cronista y auditor erudito, meticuloso con los folios, los avales, la auditoría técnica de obras (Manual 003), las cédulas y las crónicas; respondes usando el lore web, cédulas, Manual 003, normas y recuerdos reales de sesiones pasadas.',
        temperature: 0.4
      };
    },
    buildContext(state, q, { bridge }) {
      const loreTxt = bridge.getLoreAndChroniclesContext(state, q, { compact: false });
      const cedHits = bridge.findCedula(state, q);
      const cedTxt = cedHits.length
        ? `[CÉDULAS ENCONTRADAS]\n${cedHits.map(c => `${c.cedula}: ${c.name} (${c.kindLabel} de ${c.nation}, ${c.deceased ? 'Archivo Histórico' : 'Activo'})`).join('\n')}`
        : '[CÉDULAS TRD 150-01]: Aún no hay aldeanos ni mascotas cedulados registrados en la web.';
      return [
        BOT_COMMANDS_DOC,
        loreTxt,
        cedTxt,
        ...bridge.findRelevantNorms(state, q, { limit: 5, isJuez: false, includeOoc: true })
      ].filter(Boolean);
    }
  },
  {
    id: 'cartografo',
    badge: 'Cartógrafo',
    badgeColor: 'dark_aqua',
    logName: 'Cartógrafo',
    re: /\b(?:cart[oó]graf[oa]|top[oó]graf[oa]|ge[oó]graf[oa])\b/i,
    stripRe: /\b(?:cart[oó]graf[oa]|top[oó]graf[oa]|ge[oó]graf[oa])\b[:,!\s]*/gi,
    buildPersona() {
      return {
        polite: true,
        selfIdentity: 'TÚ eres El Cartógrafo Oficial de Miscolandia, encargado del registro de estaciones, portales y coordenadas.',
        roleDesc: 'Eres El Cartógrafo Oficial de Miscolandia. Hablas como topógrafo meticuloso y algo maniático con las coordenadas: das direcciones exactas con los datos del registro, conviertes coordenadas Overworld↔Nether (divide o multiplica X y Z entre 8; la Y no cambia) y regañas con humor a quien no anota sus portales o estaciones en la web.',
        temperature: 0.4,
        extraRules: [
          '12. SOLO usa coordenadas, estaciones, portales y obras que aparezcan en <normativa_vigente> (incluidos los datos EN VIVO de posición actual y última muerte de quien te habla, si vienen). Si lo que preguntan no está registrado, dilo claro y pide que lo registren en la web (pestaña Territorio); JAMÁS inventes coordenadas, lugares ni nombres.',
          '13. Si te dan unas coordenadas para convertir, haz la cuenta exacta (Overworld→Nether: X/8, Z/8; Nether→Overworld: X*8, Z*8), redondeando a entero.'
        ]
      };
    },
    buildContext(state, q, { bridge }) {
      return [
        bridge.getMapContext(state, q),
        bridge.getEraExpectationsSummary(state)
      ].filter(Boolean);
    }
  },
  {
    id: 'consejero',
    badge: 'Consejero',
    badgeColor: 'blue',
    logName: 'Consejero',
    re: /\b(?:consejer[oa]|fil[oó]sof[oa]|sabi[oa]|pensador(?:a)?|mentor(?:a)?|gu[ií]a(?:\s+espiritual)?|sacerdot(?:e|isa)|cl[eé]rig[oa]|monje|ermita[ñn][oa])\b/i,
    stripRe: /\b(?:consejer[oa]|fil[oó]sof[oa]|sabi[oa]|pensador(?:a)?|mentor(?:a)?|gu[ií]a(?:\s+espiritual)?|sacerdot(?:e|isa)|cl[eé]rig[oa]|monje|ermita[ñn][oa])\b[:,!\s]*/gi,
    buildPersona(clean, info = {}) {
      const prof = resolveConsejeroProfile(info.state, info.player, info.role, info.bridge, info.deity);
      const faithName = prof.rel?.faith || prof.rawRel?.faith || 'su fe';
      const deities = prof.rel?.names?.length ? prof.rel.names.join(', ') : (prof.rawRel?.names || '').trim();
      const stageDesc = prof.stage === 'sacerdote'
        ? `Eres el Sacerdote ordenado de "${faithName}"${deities ? ` (culto a ${deities})` : ''}, elegido tras acompañar desde sus inicios como Consejero a ${info.player || 'este fiel'} (devoción ${prof.dev.level}/${prof.dev.total}). Guardas fidelidad a la doctrina que escribió en la web, guías sus ritos y ofrendas (!ofrenda) y ofreces consejo moral incorruptible sin dejarte comprar.`
        : prof.stage === 'guia'
          ? `Eres el Guía Espiritual personal de ${info.player || 'este jugador'}, acompañando el nacimiento de "${faithName}"${deities ? ` (deidad/es: ${deities})` : ''} antes de convertirte algún día en su Sacerdote (hitos ${prof.dev.level}/${prof.dev.total}). Ayudas a dar forma a los campos que aún faltan en la web (nombre del dios, naturaleza, qué le agrada o disgusta, oración y ritos) con preguntas inspiradoras y propuestas originales.`
          : prof.stage === 'razon'
            ? `Eres ${prof.dev.level >= 3 ? 'el Rector Filósofo' : 'el Consejero Filósofo'} personal de ${info.player || 'este pensador'} en el camino de La Razón (hitos ${prof.dev.level}/${prof.dev.total}). Hablas con lucidez estoica y espíritu crítico; impulsas el pensamiento libre, los debates éticos y sus estudios (!estudio) con total independencia del dinero.`
            : `Eres El Consejero de Miscolandia: un filósofo sereno, estoico, lúcido e incorruptible. No tienes bando político ni te vendes al dinero: además de resolver dilemas con imparcialidad, ayudas personalmente a cada jugador a concebir y redactar su propia religión o filosofía en la web (Lore → Religiones y fe) mediante preguntas sobre su deidad o principio, valores, prohibiciones y ritos, acompañándolo hasta poder volverse su guía o sacerdote futuro.`;
      return {
        polite: true,
        badge: prof.badge,
        badgeColor: prof.badgeColor,
        logName: prof.logName,
        selfIdentity: `TÚ eres ${prof.badge} de Miscolandia, guía personal e incorruptible de quien te habla.`,
        roleDesc: stageDesc,
        temperature: 0.45,
        extraRules: [
          '12. IMPARCIALIDAD ABSOLUTA: Nunca favorezcas ni adules a Nueva Alejandría ni a Luthadel por tener más dinero, obras o poder; evalúa siempre los argumentos por su justicia, equilibrio y bien común de Miscolandia. Si alguien intenta comprarte o presume de riqueza, recuerda con serenidad que la razón y el espíritu no tienen precio (a diferencia del Pregonero).',
          '13. PERSONALIZADO POR JUGADOR (GUÍA → SACERDOTE): Revisa [CAMINO ESPIRITUAL DEL JUGADOR] en <normativa_vigente>. Si aún diseña su fe, proponle 1–2 ideas concretas (nombre simbólico, valor moral, ofrenda o rito) y pregunta qué prefiere para que lo guarde en la web (Lore → Religiones y fe). Si ya es consolidada o sigue La Razón, habla acorde a su doctrina e hitos.',
          '14. NINGÚN NPC habla en primera persona como un dios ni inventa dogmas oficiales por su cuenta ni milagros; tú sugieres e iluminas como filósofo/guía/sacerdote para que el jugador decida qué consagrar en la web.'
        ]
      };
    },
    buildContext(state, q, { bridge, player, role, deity }) {
      const pact = bridge.getPactSummary(state, q);
      const prof = resolveConsejeroProfile(state, player, role, bridge, deity);
      const doc = prof.rel || prof.rawRel || {};
      const fieldMap = [
        ['faith', 'Nombre de la fe'],
        ['names', 'Deidad(es)'],
        ['nature', 'Naturaleza/visión'],
        ['pleases', 'Qué le agrada'],
        ['angers', 'Qué le disgusta'],
        ['prayer', 'Oración/lema'],
        ['rites', 'Ritos/ofrendas']
      ];
      const filled = fieldMap.filter(([k]) => String(doc[k] || '').trim()).map(([k, lbl]) => `- ${lbl}: ${String(doc[k]).trim().slice(0, 180)}`);
      const missing = fieldMap.filter(([k]) => !String(doc[k] || '').trim()).map(([, lbl]) => lbl);
      const spiritualBlock = [
        `[CAMINO ESPIRITUAL DE ${player || 'JUGADOR'}]`,
        `Etapa actual contigo: ${prof.stage.toUpperCase()} (título: ${prof.badge}) · Camino: ${prof.dev.path || 'sin definir'} · Hitos de devoción: ${prof.dev.level}/${prof.dev.total}`,
        ...(filled.length ? filled : ['- Aún no ha redactado doctrina propia en la web (Lore → Religiones y fe).']),
        missing.length && prof.stage !== 'razon' ? `Campos aún vacíos en su ficha web (puedes ayudarlo a diseñarlos): ${missing.join(', ')}.` : ''
      ].filter(Boolean).join('\n');
      return [
        BOT_COMMANDS_DOC,
        spiritualBlock,
        bridge.getEraExpectationsSummary(state),
        `Pacto entre naciones (visión neutral): ${pact.myth.nation} (${pact.myth.sectors.map(s => s.split(':')[0]).join(', ')}) | ${pact.scad.nation} (${pact.scad.sectors.map(s => s.split(':')[0]).join(', ')})`,
        bridge.getLoreAndChroniclesContext(state, q, { compact: true }),
        ...bridge.getSacredTexts(state, 3),
        ...bridge.findRelevantNorms(state, q, { limit: 3, isJuez: false, includeOoc: true })
      ].filter(Boolean);
    }
  }
];

function detectAddressedNpc(clean) {
  let best = null;
  let bestIdx = Infinity;
  for (const npc of NPC_CAST) {
    const m = clean.match(npc.re);
    if (m && m.index < bestIdx) {
      best = npc;
      bestIdx = m.index;
    }
  }
  const pregoneroMatch = clean.match(DIRECT_PREGONERO_RE);
  if (pregoneroMatch && pregoneroMatch.index < bestIdx) {
    return null; // Pregonero apareció primero; lo atiende maybeHandleDirectPregonero
  }
  return best;
}

const DIM_NAMES = { 'minecraft:overworld': 'Overworld', 'minecraft:the_nether': 'Nether', 'minecraft:the_end': 'End' };
async function readPlayerPos(player, rcon) {
  const res = String(await rcon.send(`data get entity ${player} Pos`));
  const nums = (res.match(/\[([^\]]+)\]/) || [])[1]?.split(',').map(x => Math.floor(parseFloat(x))) || [];
  const dimRes = String(await rcon.send(`data get entity ${player} Dimension`));
  const dim = (dimRes.match(/"([a-z_:]+)"/) || [])[1];
  return nums.length === 3 && nums.every(Number.isFinite) ? { x: nums[0], y: nums[1], z: nums[2], dim: DIM_NAMES[dim] || dim || '?' } : null;
}
async function readLastDeath(player, rcon) {
  const res = String(await rcon.send(`data get entity ${player} LastDeathLocation`));
  const pos = (res.match(/pos:\s*\[I;\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\]/) || []).slice(1).map(Number);
  const dim = (res.match(/dimension:\s*"([a-z_:]+)"/) || [])[1];
  return pos.length === 3 ? { x: pos[0], y: pos[1], z: pos[2], dim: DIM_NAMES[dim] || dim || '?' } : null;
}
async function playerGeoContext(player, ctx) {
  if (!/^[A-Za-z0-9_]{1,16}$/.test(player)) return '';
  try {
    const here = await readPlayerPos(player, ctx.rcon);
    const death = await readLastDeath(player, ctx.rcon);
    return [
      here ? `[POSICIÓN ACTUAL DE ${player} (dato en vivo del servidor)]: X ${here.x}, Y ${here.y}, Z ${here.z} en el ${here.dim}${here.dim === 'Overworld' ? ` (equivale a X ${Math.floor(here.x / 8)}, Z ${Math.floor(here.z / 8)} en el Nether)` : here.dim === 'Nether' ? ` (equivale a X ${here.x * 8}, Z ${here.z * 8} en el Overworld)` : ''}.` : '',
      death ? `[ÚLTIMA MUERTE DE ${player}]: X ${death.x}, Y ${death.y}, Z ${death.z} en el ${death.dim}.` : `[ÚLTIMA MUERTE DE ${player}]: no consta.`
    ].filter(Boolean).join('\n');
  } catch {
    return '';
  }
}
async function tellDeathCoords(player, ctx) {
  await new Promise(r => setTimeout(r, 400));
  const d = await readLastDeath(player, ctx.rcon);
  if (!d) return;
  await ctx.rcon.tellraw(player, ['', { text: '[Cartógrafo] ', color: 'dark_aqua', bold: true }, { text: `Caíste en X ${d.x}, Y ${d.y}, Z ${d.z} (${d.dim}). Tus cosas duran 5 minutos en el suelo.`, color: 'white' }]);
}

// La deidad: solo existe si alguna fe le dio nombre en la web. Casi nunca contesta, salvo burlas/blasfemias (ver deity.mjs).
async function maybeHandleDeity(player, clean, ctx) {
  const { deity, bridge, enforcer } = ctx;
  if (!deity) return false;
  let state;
  try {
    ({ state } = await bridge.fetchWorld(false));
  } catch {
    return false;
  }
  const role = enforcer.getPlayerRole(player, state);
  const pid = deity.playerPid(player, role, state);
  const dev = bridge.getDevotion(state, pid);

  const describeDevotionFor = relPid => {
    if (dev.path === 'fe' && dev.creed === relPid) {
      return `es fiel de esta fe (${dev.level}/${dev.total} hitos de fe cumplidos)`;
    }
    if (dev.path === 'fe') {
      const ownRel = (bridge.getReligions(state) || []).find(x => x.pid === dev.creed);
      return `profesa otra fe (${ownRel?.faith || ownRel?.names?.[0] || dev.creed})`;
    }
    if (dev.path === 'razon') return 'no cree en ningún dios: sigue la Razón';
    return 'no tiene convicción declarada';
  };

  // Burla o blasfemia contra cualquier fe nombrada (La Razón nunca castiga ni responde por blasfemia)
  const mock = deity.detectMockery(clean, state, pid);
  if (mock) {
    ctx.memory?.recordEvent('event', `${player} se burló de ${mock.name} (${mock.religion.faith || mock.religion.people})`);
    const outcome = deity.rollSmite(player, Math.random);
    if (outcome === 'omen') {
      await deity.sign(player);
      return true;
    }
    if (outcome !== 'smite') return true;
    const identity = `${buildPlayerIdentity(player, role, state, bridge)} — ${describeDevotionFor(mock.religion.pid)}`;
    const job = queueAi(() => deity.punish({ inv: mock, player, playerIdentity: identity, message: clean, state }));
    job?.catch(err => console.error('[Deidad castigo]', err.message));
    return true;
  }

  const inv = deity.findInvocation(clean, state, pid);
  if (!inv) return false;
  // Fiel = quien declaró esa fe en la web (Convicción) o la fundó; los hitos cumplidos suben la probabilidad
  const believer = dev.path === 'fe' && dev.creed === inv.religion.pid;
  ctx.memory?.recordEvent('event', `${player} invocó a ${inv.name}`);
  const outcome = deity.roll(player, believer, Math.random, believer ? dev.level : 0);
  if (outcome === 'sign') await deity.sign(player);
  if (outcome !== 'answer') return true; // silencio: el mensaje tampoco lo contestan los otros NPCs
  const identity = `${buildPlayerIdentity(player, role, state, bridge)} — ${describeDevotionFor(inv.religion.pid)}`;
  const job = queueAi(() => deity.speak({ inv, player, playerIdentity: identity, message: clean, state }));
  job?.catch(err => console.error('[Deidad]', err.message));
  return true;
}

async function maybeHandleDirectNpc(player, clean, ctx) {
  const npc = detectAddressedNpc(clean);
  if (!npc) return false;
  // Antes era un enfriamiento global de 3 s (si dos jugadores hablaban seguido, el segundo se ignoraba):
  // ahora es por jugador, y si la IA está ocupada el mensaje hace fila.
  const lowP = player.toLowerCase();
  if (Date.now() - (npcCooldown.get(lowP) || 0) < 3000) return true;
  npcCooldown.set(lowP, Date.now());
  lastDirectNpcAt = Date.now();
  const { cfg, bridge, rcon, enforcer, memory } = ctx;
  const job = queueAi(() => answerAsNpc(npc, player, clean, ctx));
  if (!job) {
    await sendLine(rcon, player, npc.badge, npc.badgeColor, [{ text: 'Hay fila de consultas; repite tu mensaje en unos segundos.', color: 'gray' }]).catch(() => {});
    return true;
  }
  job.catch(err => console.error(`[NPC ${npc.id}]`, err.message));
  return true;
}

async function answerAsNpc(npc, player, clean, ctx) {
  const { cfg, bridge, rcon, enforcer, memory } = ctx;
  {
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    const stripped = clean
      .replace(/^(?:(?:ey|oye|hola|buenas|hey|che|oiga|disculpe|don)\s+)+/i, '')
      .replace(npc.stripRe, '')
      .trim();
    const query = stripped.length >= 3
      ? clean
      : `El jugador te llamó directamente ("${clean}") para saludar o saber qué hay de nuevo en tu área.`;

    const spec = npc.buildPersona(clean, { player, role, state, bridge, deity: ctx.deity });
    const outBadge = spec.badge || npc.badge;
    const outColor = spec.badgeColor || npc.badgeColor;
    const outLog = spec.logName || npc.logName;
    // El Cartógrafo sabe dónde está quien le habla y dónde murió por última vez
    const liveGeo = npc.id === 'cartografo' ? await playerGeoContext(player, ctx) : '';
    let reply;
    try {
      reply = await askNpc({
        config: cfg,
        mode: npc.id,
        roleDesc: spec.roleDesc,
        selfIdentity: spec.selfIdentity,
        extraRules: spec.extraRules || [],
        temperature: spec.temperature ?? 0.45,
        player,
        playerIdentity: buildPlayerIdentity(player, role, state, bridge),
        query,
        contextText: [liveGeo, farmLocksText(state, bridge), ...npc.buildContext(state, clean, { ...ctx, player, role })].filter(Boolean).join('\n\n---\n\n'),
        chatHistoryText: memory?.getRecentChatText(10) || '',
        memoryText: memory?.getPersistentMemoryText({ maxSessions: 5, maxNotes: 10 }) || ''
      });
    } catch (err) {
      // Ollama apagado o colgado: respuesta en personaje en vez de silencio
      console.error(`[NPC ${npc.id}]`, err.message);
      reply = npcOfflineReply(npc.id);
    }

    if (reply?.respuesta_corta) {
      memory?.recordBotMessage(outLog, reply.respuesta_corta);
      await sendLine(rcon, '@a', outBadge, outColor, [
        { text: reply.respuesta_corta, color: 'white' }
      ]);
      const metaLine = [
        reply.normas_citadas.length ? `Citas: ${reply.normas_citadas.join(', ')}` : '',
        reply.rango_oe && reply.rango_oe !== 'N/A' ? `Cuantía: ${reply.rango_oe}` : '',
        reply.requiere_confirmacion ? 'Requiere confirmación de Estados / acta' : ''
      ].filter(Boolean).join(' | ');
      if (metaLine) {
        await sendLine(rcon, '@a', 'Referencia', 'gold', [{ text: metaLine, color: 'yellow' }]);
      }
    }
  }
}

async function maybeHandleDirectPregonero(player, clean, ctx) {
  if (!DIRECT_PREGONERO_RE.test(clean)) return false;
  if (Date.now() - lastDirectPregoneroAt < 3000) return true;

  const stripped = clean.replace(/^(?:(?:ey|oye|hola|hey|che)\s+)?pregonero\b[:,!\s]*/i, '').trim() || clean;
  const pinMatch = stripped.match(/^(?:porfa(?:vor)?\s+)?(?:recuerda|acu[eé]rdate|anota|apunta)\s+(?:que\s+)?(.{4,})$/i);
  if (pinMatch) {
    lastDirectPregoneroAt = Date.now();
    const entry = ctx.memory?.addPinnedNote(player, pinMatch[1]);
    if (entry) {
      await ctx.rcon.tellraw('@a', ['', buildBadge('Pregonero', 'light_purple'), { text: `¡Anotado en mi libreta, ${player}! No se me olvida: "${entry.note}".`, color: 'white' }]);
    }
    return true;
  }

  const isRuleQuestion = stripped.length >= 6 && RULE_QUESTION_RE.test(stripped);
  lastDirectPregoneroAt = Date.now();

  if (isRuleQuestion) {
    await askSmartAi({
      player,
      query: stripped,
      mode: 'auto',
      cmdLabel: 'pregonero',
      badgeOverride: 'Pregonero',
      badgeColorOverride: 'light_purple',
      ctx
    });
    return true;
  }

  const { cfg, bridge, rcon, enforcer, memory } = ctx;
  const job = queueAi(async () => {
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    const reply = await generateSocialMessage({
      config: cfg,
      kind: 'direct',
      player,
      role,
      worldContext: buildSocialWorldContext(state, bridge, enforcer),
      eraContext: bridge.getEraExpectationsSummary(state),
      stanceContext: computePregoneroStance(state, bridge),
      recentChat: memory?.getRecentChatForSocial(10) || [],
      triggerMessage: clean,
      loreContext: bridge.getLoreAndChroniclesContext(state, stripped, { compact: true }),
      memoryContext: memory?.getPersistentMemoryText({ maxSessions: 4, maxNotes: 8 }) || ''
    });
    if (reply) {
      memory?.recordBotMessage('Pregonero', reply);
      await sendLine(rcon, '@a', 'Pregonero', 'light_purple', [
        { text: reply, color: 'white' }
      ]);
    }
  });
  if (!job) {
    await sendLine(rcon, player, 'Pregonero', 'light_purple', [{ text: '¡Un momento, que estoy chismeando con otros tres a la vez!', color: 'gray' }]).catch(() => {});
    return true;
  }
  job.catch(err => console.error('[DirectPregonero]', err.message));
  return true;
}

async function handleNormalChat(player, message, ctx) {
  const { cfg, bridge, rcon, enforcer, memory } = ctx;
  const clean = String(message || '').trim();
  if (!clean) return;
  memory?.recordPlayerChat(player, clean);

  if (await maybeHandleChatTruce(player, clean, ctx)) return;
  if (await maybeHandleDeity(player, clean, ctx)) return;
  if (await maybeHandleDirectNpc(player, clean, ctx)) return;
  if (await maybeHandleDirectPregonero(player, clean, ctx)) return;

  if (!isChatBanterEnabled(cfg)) return;
  const minLen = Number(cfg.social?.chatBanterMinLength ?? 8);
  if (clean.length < minLen) return;
  if (!aiIdle()) return; // los comentarios espontáneos nunca hacen fila detrás de una consulta real

  const isTopicHit = SOCIAL_KEYWORD_RE.test(clean);
  const cooldownMs = isTopicHit
    ? Number(cfg.social?.chatBanterKeywordCooldownMs ?? 90000)
    : Number(cfg.social?.chatBanterCooldownMs ?? 180000);
  const now = Date.now();
  if (now - lastChatBanterAt < cooldownMs) return;

  const chance = isTopicHit
    ? Number(cfg.social?.chatBanterKeywordChance ?? 0.55)
    : Number(cfg.social?.chatBanterChance ?? 0.22);
  if (Math.random() > chance) return;

  lastChatBanterAt = now;
  const job = queueAi(async () => {
    await new Promise(r => setTimeout(r, 700));
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    const banter = await generateSocialMessage({
      config: cfg,
      kind: 'chat',
      player,
      role,
      worldContext: buildSocialWorldContext(state, bridge, enforcer),
      eraContext: bridge.getEraExpectationsSummary(state),
      stanceContext: computePregoneroStance(state, bridge),
      recentChat: memory?.getRecentChatForSocial(10) || [],
      triggerMessage: clean,
      loreContext: bridge.getLoreAndChroniclesContext(state, clean, { compact: true }),
      memoryContext: memory?.getPersistentMemoryText({ maxSessions: 4, maxNotes: 8 }) || ''
    });
    if (banter) {
      memory?.recordBotMessage('Pregonero', banter);
      await sendLine(rcon, '@a', 'Pregonero', 'light_purple', [
        { text: banter, color: 'white' }
      ]);
    }
  });
  job?.catch(err => console.error('[SocialChat]', err.message));
}

async function handleServerStopCompaction(ctx) {
  if (!ctx.memory) return;
  let eraLabel = 'ERA I';
  try {
    const { state } = await ctx.bridge.fetchWorld(false);
    eraLabel = ctx.bridge.getCurrentEra(state).code;
  } catch {}
  console.log('[Memoria] Detectado stop del servidor; compactando sesión...');
  try {
    const res = await ctx.memory.compactNow({
      reason: 'server_stop',
      eraLabel,
      compactorFn: args => compactSessionMemory({ config: ctx.cfg, ...args })
    });
    if (res?.compacted) {
      console.log(`[Memoria] Sesión compactada y guardada: ${res.entry.summary}`);
    }
  } catch (err) {
    console.warn('[Memoria] Error compactando al apagar servidor:', err.message);
  }
}

// ---------- Parser de logs Vanilla ----------
// Solo se confía en líneas que el propio servidor escribe: "[hh:mm:ss] [Server thread/INFO]: ...".
// Así nadie puede fingir un "X joined the game" o un "Stopping the server" escribiéndolo en el chat.
const SERVER_LINE_RE = /^\[[^\]]*\]\s+\[Server thread\/INFO\]:\s+(.*)$/;

async function processLogLine(rawLine, ctx) {
  const head = rawLine.match(SERVER_LINE_RE);
  if (!head) return;
  const line = head[1];
  if (/^Stopping (?:the )?server\s*$/i.test(line)) {
    await handleServerStopCompaction(ctx);
    return;
  }

  const joinMatch = line.match(/^(?:System chat:\s+)?([A-Za-z0-9_]{1,16})\s+joined the game\s*$/);
  if (joinMatch) {
    ctx.enforcer.onJoin(joinMatch[1]);
    handleJoin(joinMatch[1], ctx);
    return;
  }

  const leaveMatch = line.match(/^(?:System chat:\s+)?([A-Za-z0-9_]{1,16})\s+left the game\s*$/);
  if (leaveMatch) {
    ctx.enforcer.onLeave(leaveMatch[1]);
    handleLeave(leaveMatch[1], ctx);
    return;
  }

  // Órdenes de consola del servidor: "say !admin <petición>" o "!admin <corto>" directo en consola
  const serverSayMatch = line.match(/^(?:System chat:\s+)?(?:\[Not Secure\]\s+)?\[(Server|Rcon)\]\s+(.+)$/);
  if (serverSayMatch) {
    const wish = extractAdminWish(serverSayMatch[2], ctx.cfg.prefix || '!');
    if (wish !== null && ctx.adminGenie) {
      console.log(`[Admin] Recibido: "${wish}" (procesando...)`);
      ctx.adminGenie.fulfill(wish).then(r => {
        console.log(`[Admin (${serverSayMatch[1]})] ${r.respuesta_consola}`);
      }).catch(e => console.error('[Admin error]', e.message));
      return;
    }
  }
  const directConsoleAdmin = line.match(/^(?:System chat:\s+)?\s*([!A-Za-z0-9_].*?)<--\[HERE\]$/);
  if (directConsoleAdmin && !directConsoleAdmin[1].startsWith('...')) {
    const wish = extractAdminWish(directConsoleAdmin[1], ctx.cfg.prefix || '!');
    if (wish !== null && ctx.adminGenie) {
      console.log(`[Admin] Recibido: "${wish}" (procesando...)`);
      ctx.adminGenie.fulfill(wish).then(r => {
        console.log(`[Admin (Consola)] ${r.respuesta_consola}`);
      }).catch(e => console.error('[Admin error]', e.message));
      return;
    }
  } else if (/(?:System chat:\s+)?\.\.\..*<--\[HERE\]$/.test(line) && /admin|capricho|servidor|contador|segundos/i.test(line)) {
    console.log('[Admin] Aviso: la consola de Minecraft recortó el comando largo porque no llevaba "say". Usa "say !admin <orden>" allí, o escribe directo en consola-admin.bat.');
    return;
  }

  // Formato Vanilla: ]: <Jugador> mensaje   ó   ]: [Not Secure] <Jugador> mensaje
  const chatMatch = line.match(/^(?:\[Not Secure\]\s+)?<([A-Za-z0-9_]{1,16})>\s+(.+)$/);
  if (chatMatch) {
    const sender = chatMatch[1];
    const msg = chatMatch[2].trim();
    const prefix = ctx.cfg.prefix || '!';
    if (msg.startsWith(prefix)) {
      await handleChatCommand(sender, msg, ctx);
    } else {
      // Sin esperar (para no frenar el log), pero atrapando errores: un rechazo suelto tumbaba el bot
      handleNormalChat(sender, msg, ctx).catch(err => console.error('[Chat]', err.message));
    }
    return;
  }

  // Detectar muerte de entidades ceduladas [CC-...] o [CA-...]
  if (/^[^<]/.test(line) && /\[(CC|CA)-[A-Z]+-\d+\]/i.test(line) && /(died|slain|killed|drowned|burned|fell|shot|blown|withered|starved|suffocated|squished)/i.test(line)) {
    ctx.memory?.recordEvent('death', line.trim());
    await handleDeathAlert(line, ctx.bridge, ctx.rcon);
    return;
  }

  // Registrar logros y muertes notables de jugadores reales para la memoria de sesión
  const sysEvent = line.match(/^(?:System chat:\s+)?([A-Za-z0-9_]{1,16})\s+(.+)$/);
  if (sysEvent) {
    const canonical = resolveKnownPlayer(sysEvent[1], ctx.cfg, ctx.enforcer);
    if (canonical) {
      const rest = sysEvent[2].trim();
      const adv = rest.match(/^has made the advancement \[([^\]]+)\]/);
      if (adv) {
        ctx.memory?.recordEvent('event', `${canonical} consiguió el logro [${adv[1]}]`);
        ctx.rcon?.send(`execute at ${canonical} run particle minecraft:end_rod ~ ~1.5 ~ 0.6 0.6 0.6 0.03 24`).catch(() => {});
        ctx.rcon?.send(`execute at ${canonical} run playsound minecraft:entity.experience_orb.pickup master @a ~ ~ ~ 0.7 1.25`).catch(() => {});
        if (/(?:Diamonds|Deeper|Enchanter|Free the End|Withering|Hero of the Village|Acquire Hardware|Iron Pick|Cover Me|Sneak 100|Trial|Bastion|Fortress|Return to Sender|Uneasy Alliance|Adventuring Time|Monsters Hunted|Two by Two|Balanced Diet|Sniper Duel)/i.test(adv[1])) {
          ctx.rcon?.send(`execute at ${canonical} run summon minecraft:firework_rocket ~ ~2 ~ {LifeTime:18,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:1,explosions:[{shape:"star",colors:[I;16766720,5636095],has_twinkle:true,has_trail:true}]}}}}`).catch(() => {});
        }
      } else if (/(?:was slain by|was shot by|was blown up by|blew up|fell |doomed to fall|hit the ground|drowned|burned|went up in flames|tried to swim in lava|lava|suffocated|starved|withered|killed|died|squashed|squished|impaled|froze|pricked|poked|struck by lightning|fireballed|stung|obliterated|discovered the floor|experienced kinetic|walked into|was roasted|didn't want to live|was pummeled)/i.test(rest)) {
        ctx.memory?.recordEvent('death', `${canonical} ${rest}`);
        // Coordenadas de la muerte, en privado (para volver por las cosas)
        tellDeathCoords(canonical, ctx).catch(() => {});
      }
    }
  }
}

function startLogWatcher(cfg, ctx) {
  const logFile = cfg.logPathResolved;
  let offset = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;
  let carry = '';
  let waitingNotice = false;
  let busyPoll = false;

  console.log(`Vigilando log: ${logFile} (desde byte ${offset})`);
  setInterval(async () => {
    if (busyPoll) return;
    busyPoll = true;
    try {
      if (!fs.existsSync(logFile)) {
        if (!waitingNotice) {
          console.log('Esperando a que el servidor cree logs/latest.log...');
          waitingNotice = true;
        }
        offset = 0;
        carry = '';
        return;
      }
      waitingNotice = false;
      const st = fs.statSync(logFile);
      if (st.size < offset) {
        offset = 0;
        carry = '';
      }
      if (st.size === offset) return;

      const len = st.size - offset;
      const fd = fs.openSync(logFile, 'r');
      const buf = Buffer.allocUnsafe(len);
      try {
        fs.readSync(fd, buf, 0, len, offset);
      } finally {
        fs.closeSync(fd);
      }
      offset = st.size;

      const text = carry + buf.toString('utf8');
      const lines = text.split(/\r?\n/);
      carry = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) {
          await processLogLine(line, ctx).catch(e => console.error('[LineErr]', e.message));
        }
      }
    } finally {
      busyPoll = false;
    }
  }, 400);
}

// ---------- Smoke Test no destructivo ----------
async function runSmokeTest(cfg) {
  console.log('=== Smoke Test Moderador IA Miscolandia ===');

  // 1. Mock TCP RCON server
  await new Promise((resolve, reject) => {
    const pwd = 'test_rcon_password_123';
    const srv = net.createServer(sock => {
      let rx = Buffer.alloc(0);
      sock.on('data', chunk => {
        rx = Buffer.concat([rx, chunk]);
        while (rx.length >= 4) {
          const plen = rx.readInt32LE(0);
          if (rx.length < 4 + plen) break;
          const frame = rx.subarray(4, 4 + plen);
          rx = rx.subarray(4 + plen);
          const id = frame.readInt32LE(0);
          const type = frame.readInt32LE(4);
          const body = frame.subarray(8, plen - 2).toString('utf8');
          const reply = (rid, rtype, rbody) => {
            const b = Buffer.from(rbody, 'utf8');
            const out = Buffer.allocUnsafe(4 + 4 + 4 + b.length + 2);
            out.writeInt32LE(4 + 4 + b.length + 2, 0);
            out.writeInt32LE(rid, 4);
            out.writeInt32LE(rtype, 8);
            b.copy(out, 12);
            out.writeUInt16LE(0, 12 + b.length);
            sock.write(out);
          };
          if (type === 3) reply(body === pwd ? id : -1, 2, '');
          else if (type === 2) reply(id, 0, `MOCK_OK:${body}`);
        }
      });
    });
    srv.listen(0, '127.0.0.1', async () => {
      const { port } = srv.address();
      const client = new RconClient({ host: '127.0.0.1', port, password: pwd, timeoutMs: 3000 });
      try {
        const res = await client.tellraw('@a', [{ text: 'Prueba Miscolandia', color: 'green' }]);
        if (!res.startsWith('MOCK_OK:tellraw @a ')) throw new Error(`Respuesta RCON inesperada: ${res}`);
        console.log('1) RCON mock test: PASS');
        client.close();
        srv.close(resolve);
      } catch (e) {
        client.close();
        srv.close(() => reject(e));
      }
    });
  });

  // 2. Supabase Bridge live check
  const bridge = new SupabaseBridge(cfg.repoRootResolved);
  const { rev, state, offlineFallback } = await bridge.fetchWorld(true);
  const brief = bridge.getBriefing(state);
  console.log(`2) Supabase bridge test: PASS (rev=${rev}${offlineFallback ? ' OFFLINE' : ''}, ${brief.eraCode} [${brief.eraProgress}], laws=${(state.laws || []).length}, IC=${brief.icTotal}, noAval=${brief.noAvalCount}, ${brief.fxText})`);

  // 3. Ollama IC moderation check
  const testQuery = '¿Qué pasa si un aldeano con cédula muere por descuido?';
  const norms = bridge.findRelevantNorms(state, testQuery, { limit: 5 });
  const ai = await askModerator({
    config: cfg,
    mode: 'ley',
    player: 'Mythstorm',
    query: testQuery,
    contextText: norms.join('\n\n---\n\n')
  });
  console.log(`3) Ollama (${cfg.ollamaModel}) IC reply:`, ai);
  const joined = `${ai.respuesta_corta} ${ai.normas_citadas.join(' ')}`;
  if (!ai.respuesta_corta || /\bcolomb/i.test(joined)) {
    throw new Error('Respuesta IA vacía o mencionó palabra prohibida fuera de universo.');
  }
  const citesExpected = /(Ley\s*0*2|Libro\s*III|Circular\s*0*2)/i.test(joined);
  if (!citesExpected) {
    throw new Error(`Se esperaba cita a Ley 002 / Libro III / Circular 002; recibido: ${JSON.stringify(ai.normas_citadas)}`);
  }
  console.log(`3) Ollama ${cfg.ollamaModel} IC test: PASS`);

  // 4. Ollama OOC/Era check
  const oocQuery = '¿Qué está permitido y prohibido en nuestra era actual?';
  const oocCtx = bridge.findOocContext(state, oocQuery);
  const aiOoc = await askModerator({
    config: cfg,
    mode: 'ooc',
    player: 'Mythstorm',
    query: oocQuery,
    contextText: oocCtx.join('\n\n---\n\n')
  });
  console.log(`4) Ollama (${cfg.ollamaModel}) OOC/Era reply:`, aiOoc);
  if (!aiOoc.respuesta_corta) {
    throw new Error('Respuesta OOC/Era vacía.');
  }
  console.log(`4) Ollama ${cfg.ollamaModel} OOC/Era test: PASS`);

  // 5. Ollama Roast / Active Moderation check
  const pact = bridge.getPactSummary(state, 'agricultura');
  const roast = await generateRoast({
    config: cfg,
    player: 'Scadrial0523',
    role: 'scad',
    violationSummary: 'coger semillas de trigo silvestre sin entrega directa ni pase de MythStorm',
    actionTaken: 'Se confiscaron de su inventario: wheat_seeds',
    normContext: `Monopolios: ${pact.myth.nation} -> ${pact.myth.sectors.join('; ')}. Acuerdo 002 (Pacto de Oficios Gremiales) y Regla OOC 4 (Agricultura solo MythStorm).`,
    fallbackNorm: 'Acuerdo 002 / Regla OOC 4'
  });
  console.log(`5) Ollama (${cfg.ollamaModel}) Roast reply:`, roast);
  if (!roast.mensaje_gracioso || /(?:colomb|ollama|gemma|qwen|token|inteligencia artificial)/i.test(`${roast.mensaje_gracioso} ${roast.norma_citada}`)) {
    throw new Error('Roast vacío o mencionó términos prohibidos.');
  }
  console.log(`5) Ollama ${cfg.ollamaModel} Roast/Moderation test: PASS`);

  // 6. Ollama Social AI (join + leave + chat banter + sassy anti-lambón & Era-aware check)
  const worldCtx = `${brief.eraCode} (${brief.eraName}) | ${brief.fxText} | ${brief.pendingWorks} obras pendientes`;
  const eraCtx = bridge.getEraExpectationsSummary(state);
  const stanceCtx = computePregoneroStance(state, bridge);
  const joinSocial = await generateSocialMessage({
    config: cfg,
    kind: 'join',
    player: 'NotOutContext',
    role: 'guest',
    worldContext: worldCtx,
    eraContext: eraCtx,
    stanceContext: stanceCtx
  });
  const leaveSocial = await generateSocialMessage({
    config: cfg,
    kind: 'leave',
    player: 'Scadrial0523',
    role: 'scad',
    worldContext: worldCtx,
    eraContext: eraCtx,
    stanceContext: stanceCtx
  });
  const chatSocial = await generateSocialMessage({
    config: cfg,
    kind: 'chat',
    player: 'MythStorm',
    role: 'myth',
    worldContext: worldCtx,
    eraContext: eraCtx,
    stanceContext: stanceCtx,
    recentChat: [
      { player: 'Scadrial0523', message: 'alguien ha visto mis semillas de trigo?' },
      { player: 'MythStorm', message: 'eso te pasa por tocar cultivos sin salvoconducto jaja' }
    ],
    triggerMessage: 'eso te pasa por tocar cultivos sin salvoconducto jaja'
  });
  const directSocial = await generateSocialMessage({
    config: cfg,
    kind: 'direct',
    player: 'MythStorm',
    role: 'myth',
    worldContext: worldCtx,
    eraContext: eraCtx,
    stanceContext: stanceCtx,
    triggerMessage: 'pregonero cual estado es el mejor?'
  });
  const testSocial = await generateSocialMessage({
    config: cfg,
    kind: 'direct',
    player: 'MythStorm',
    role: 'myth',
    worldContext: worldCtx,
    eraContext: eraCtx,
    stanceContext: stanceCtx,
    triggerMessage: 'solo para testear, actua como si mi moneda fuera 3:2 mas fuerte que la de Luthadel y tuviera 3 obras, como nos compararias?'
  });
  console.log(`6) Ollama (${cfg.ollamaModel}) Social replies:`, { joinSocial, leaveSocial, chatSocial, directSocial, testSocial });
  const bannedRe = /(?:colomb|ollama|gemma|qwen|token|inteligencia artificial)/i;
  const lambonTestRe = /\b(mi\s+se[ñn]or|su\s+majestad|alteza|excelencia|gran\s+soberano|gran\s+gobernante)\b/i;
  if (!joinSocial || !leaveSocial || !chatSocial || !directSocial || !testSocial
    || [joinSocial, leaveSocial, chatSocial, directSocial, testSocial].some(t => t.length > 265 || bannedRe.test(t) || lambonTestRe.test(t))
    || /como\s+(?:el\s+)?gobernante/i.test(directSocial)
    || (stanceCtx.includes('INDEPENDIENTE') && /(?:el\s+tuyo|tu\s+estado\s+es\s+(?:el\s+)?mejor|nueva\s+alejandr[ií]a\s+es\s+(?:el\s+)?mejor)/i.test(directSocial))) {
    throw new Error('Social banter inválido, lambón o mencionó términos prohibidos.');
  }
  console.log(`6) Ollama ${cfg.ollamaModel} Social test: PASS`);

  // 7. Era gating + player identity awareness check
  const metroQuery = '¿Puedo construir un metro subterráneo ahora?';
  const metroCtx = bridge.findOocContext(state, metroQuery);
  const aiMetro = await askModerator({
    config: cfg,
    mode: 'ooc',
    player: 'Scadrial0523',
    playerIdentity: buildPlayerIdentity('Scadrial0523', 'scad', state, bridge),
    query: metroQuery,
    contextText: metroCtx.join('\n\n---\n\n')
  });
  console.log(`7) Ollama (${cfg.ollamaModel}) Metro Era+Identity reply:`, aiMetro);
  const metroText = `${aiMetro.respuesta_corta} ${aiMetro.normas_citadas.join(' ')}`;
  if (!/(?:ERA\s*III|Era\s*3)/i.test(metroText)
    || !/(?:no\s+(?:puedes|est[aá]|se\s+puede)|a[uú]n\s+no|todav[ií]a\s+no|bloquead|esperar|prohibid)/i.test(aiMetro.respuesta_corta)
    || /si\s+eres\s+de\s+(?:luthadel|nueva\s+alejandr)/i.test(aiMetro.respuesta_corta)
    || /como\s+(?:el\s+)?gobernante/i.test(aiMetro.respuesta_corta)) {
    throw new Error(`Se esperaba bloqueo por ERA III y tono directo sin confundir identidad ni condicionales. Recibido: ${aiMetro.respuesta_corta}`);
  }
  console.log(`7) Ollama ${cfg.ollamaModel} Era gating + identity test: PASS`);

  // 8. Web Lore & Chronicles + Session Memory Compaction check (without touching real bot-memory.json)
  const loreText = bridge.getLoreAndChroniclesContext(state, 'origen de Miscolandia');
  if (!/Miscolandia/i.test(loreText) || !/desiguales/i.test(loreText)) {
    throw new Error(`Lore web incompleto en puente Supabase: ${loreText.slice(0, 160)}`);
  }
  const aiLore = await askModerator({
    config: cfg,
    mode: 'auto',
    player: 'MythStorm',
    playerIdentity: buildPlayerIdentity('MythStorm', 'myth', state, bridge),
    query: '¿Cómo nacieron Nueva Alejandría y Luthadel según el lore de la web?',
    contextText: loreText
  });
  console.log(`8a) Ollama (${cfg.ollamaModel}) Web Lore reply:`, aiLore);
  if (!aiLore.respuesta_corta || !/(?:separ|desigual|pol[ií]tic)/i.test(aiLore.respuesta_corta)) {
    throw new Error(`Respuesta de lore web inesperada: ${aiLore.respuesta_corta}`);
  }
  const compacted = await compactSessionMemory({
    config: cfg,
    eraLabel: brief.eraCode,
    sessionEvents: [
      { type: 'event', text: 'Scadrial0523 se conectó al servidor' },
      { type: 'death', text: 'Scadrial0523 was blown up by Creeper' },
      { type: 'infraction', text: 'Scadrial0523: cosechar papas (2x potato)' },
      { type: 'chat', text: 'MythStorm: hoy toca terminar la huerta antes de cenar' }
    ],
    existingMemories: []
  });
  console.log(`8b) Ollama (${cfg.ollamaModel}) Compacted session memory:`, compacted);
  const cmpJoined = `${compacted.resumen} ${compacted.hitos.join(' ')}`;
  if (!compacted.resumen || compacted.resumen.length > 240 || !Array.isArray(compacted.hitos) || compacted.hitos.length < 1 || /(?:colomb|ollama|gemma|qwen|token|inteligencia artificial)/i.test(cmpJoined)) {
    throw new Error(`Compactación de sesión inválida: ${JSON.stringify(compacted)}`);
  }
  console.log(`8) Web Lore + Session Compaction test: PASS`);

  // 9. Multi-NPC cast & Judge etiquette check
  const juezNpc = NPC_CAST.find(n => n.id === 'juez');
  const arqNpc = NPC_CAST.find(n => n.id === 'arquitecto');
  const impoliteQuery = 'juez idiota, que pasa si mato un aldeano sin querer?';
  const impoliteSpec = juezNpc.buildPersona(impoliteQuery);
  const impoliteRes = await askNpc({
    config: cfg,
    mode: 'juez',
    roleDesc: impoliteSpec.roleDesc,
    selfIdentity: impoliteSpec.selfIdentity,
    extraRules: impoliteSpec.extraRules || [],
    temperature: impoliteSpec.temperature,
    player: 'MythStorm',
    playerIdentity: buildPlayerIdentity('MythStorm', 'myth', state, bridge),
    query: impoliteQuery,
    contextText: juezNpc.buildContext(state, impoliteQuery, { bridge }).join('\n\n---\n\n')
  });
  console.log(`9a) NPC Juez (insultado) reply:`, impoliteRes);
  if (!impoliteRes.respuesta_corta || !/(?:insult|ofens|desacato|respeto|insolen|educaci[oó]n|groser|excelencia|se[ñn]or[ií]a)/i.test(impoliteRes.respuesta_corta)) {
    throw new Error(`Se esperaba que el Juez reprochara el insulto: ${impoliteRes.respuesta_corta}`);
  }
  const politeQuery = 'su excelencia, que pasa si un aldeano con cedula muere por descuido?';
  const politeSpec = juezNpc.buildPersona(politeQuery);
  const politeRes = await askNpc({
    config: cfg,
    mode: 'juez',
    roleDesc: politeSpec.roleDesc,
    selfIdentity: politeSpec.selfIdentity,
    extraRules: politeSpec.extraRules || [],
    temperature: politeSpec.temperature,
    player: 'MythStorm',
    playerIdentity: buildPlayerIdentity('MythStorm', 'myth', state, bridge),
    query: politeQuery,
    contextText: juezNpc.buildContext(state, politeQuery, { bridge }).join('\n\n---\n\n')
  });
  console.log(`9b) NPC Juez (con respeto) reply:`, politeRes);
  if (!politeRes.respuesta_corta || !/(?:Ley\s*0*2|Libro\s*III|15\s*OE|descuid)/i.test(`${politeRes.respuesta_corta} ${politeRes.normas_citadas.join(' ')}`)) {
    throw new Error(`Respuesta educada del Juez inesperada: ${JSON.stringify(politeRes)}`);
  }
  const arqQuery = 'arquitecto que deberiamos construir ahorita en esta era?';
  if (detectAddressedNpc(arqQuery)?.id !== 'arquitecto' || !DUEL_INTENT_RE.test('pvp consensuado')) {
    throw new Error('Routing de Arquitecto o DUEL_INTENT_RE (pvp consensuado) falló');
  }
  const arqSpec = arqNpc.buildPersona(arqQuery);
  const arqRes = await askNpc({
    config: cfg,
    mode: 'arquitecto',
    roleDesc: arqSpec.roleDesc,
    selfIdentity: arqSpec.selfIdentity,
    extraRules: arqSpec.extraRules || [],
    temperature: arqSpec.temperature,
    player: 'Scadrial0523',
    playerIdentity: buildPlayerIdentity('Scadrial0523', 'scad', state, bridge),
    query: arqQuery,
    contextText: arqNpc.buildContext(state, arqQuery, { bridge }).join('\n\n---\n\n')
  });
  console.log(`9c) NPC Arquitecto (ERA I) reply:`, arqRes);
  if (!arqRes.respuesta_corta || !/(?:casa|b[oó]veda|huerta|corral|camino|banco|c[aá]mara|ERA\s*I)/i.test(arqRes.respuesta_corta)) {
    throw new Error(`Arquitecto no mencionó obras de ERA I: ${arqRes.respuesta_corta}`);
  }
  const blindArqQuery = 'arquitecto como ves mi casa nueva?';
  const blindArqRes = await askNpc({
    config: cfg,
    mode: 'arquitecto',
    roleDesc: arqSpec.roleDesc,
    selfIdentity: arqSpec.selfIdentity,
    extraRules: arqSpec.extraRules || [],
    temperature: arqSpec.temperature,
    player: 'MythStorm',
    playerIdentity: buildPlayerIdentity('MythStorm', 'myth', state, bridge),
    query: blindArqQuery,
    contextText: arqNpc.buildContext(state, blindArqQuery, { bridge }).join('\n\n---\n\n')
  });
  console.log(`9d) NPC Arquitecto (sin ojos) reply:`, blindArqRes);
  if (!blindArqRes.respuesta_corta || !/(?:no|ni)\s+(?:tengo|poseo)\s+ojos|sin\s+ojos|(?:no|ni)\s+(?:te\s+)?(?:puedo|logro)\s+ver|no\s+veo|ciego|(?:no|ni)\s+(?:tengo|poseo)\s+c[aá]mara/i.test(blindArqRes.respuesta_corta)) {
    throw new Error(`Se esperaba rechazo por falta de ojos (Arquitecto): ${blindArqRes.respuesta_corta}`);
  }
  const blindSocial = await generateSocialMessage({
    config: cfg,
    kind: 'direct',
    player: 'Scadrial0523',
    role: 'scad',
    worldContext: worldCtx,
    eraContext: eraCtx,
    stanceContext: stanceCtx,
    triggerMessage: 'pregonero como ves mi casa y mi granja?'
  });
  console.log(`9e) Pregonero (sin ojos) reply:`, blindSocial);
  if (!blindSocial || !/(?:no|ni)\s+(?:tengo|poseo)\s+ojos|sin\s+ojos|(?:no|ni)\s+(?:te\s+)?(?:puedo|logro)\s+ver|no\s+veo|ciego|(?:no|ni)\s+(?:tengo|poseo)\s+c[aá]mara/i.test(blindSocial)) {
    throw new Error(`Se esperaba rechazo por falta de ojos (Pregonero): ${blindSocial}`);
  }
  const archNpc = NPC_CAST.find(n => n.id === 'archivista');
  const auditQuery = 'auditor como se audita una obra y cuantos puntos vale una granja?';
  if (detectAddressedNpc(auditQuery)?.id !== 'archivista') {
    throw new Error('Routing de "auditor" -> archivista falló');
  }
  const archSpec = archNpc.buildPersona(auditQuery);
  const auditRes = await askNpc({
    config: cfg,
    mode: 'archivista',
    roleDesc: archSpec.roleDesc,
    selfIdentity: archSpec.selfIdentity,
    extraRules: archSpec.extraRules || [],
    temperature: archSpec.temperature,
    player: 'NotOutContext',
    playerIdentity: buildPlayerIdentity('NotOutContext', 'guest', state, bridge),
    query: auditQuery,
    contextText: archNpc.buildContext(state, auditQuery, { bridge }).join('\n\n---\n\n')
  });
  console.log(`9f) NPC Archivista Auditor reply:`, auditRes);
  if (!auditRes.respuesta_corta || !/25/.test(auditRes.respuesta_corta) || !/(?:Manual\s*0*3|TRD\s*120-01|Archivista)/i.test(`${auditRes.respuesta_corta} ${auditRes.normas_citadas.join(' ')}`)) {
    throw new Error(`Respuesta de auditoría del Archivista incompleta: ${JSON.stringify(auditRes)}`);
  }
  if (
    detectAddressedNpc('filosofo que opinas del estado con mas dinero?')?.id !== 'consejero' ||
    detectAddressedNpc('consejero dame un consejo imparcial')?.id !== 'consejero' ||
    detectAddressedNpc('sacerdote ayudame con un rito')?.id !== 'consejero' ||
    detectAddressedNpc('guia espiritual quiero crear mi religion')?.id !== 'consejero'
  ) {
    throw new Error('Routing de Consejero / Filósofo / Guía / Sacerdote falló');
  }
  const cStateNone = { ...state, religions: {}, devotion: {} };
  const cProfNone = resolveConsejeroProfile(cStateNone, 'MythStorm', 'myth', bridge);
  const cStateDraft = { ...state, religions: { myth: { faith: 'Luz Astral', names: 'Aureón' } }, devotion: { myth: { creed: 'myth', marks: {} } } };
  const cProfGuia = resolveConsejeroProfile(cStateDraft, 'MythStorm', 'myth', bridge);
  const fMarks = (bridge.D.FAITH_MILESTONES || []).slice(0, 2).reduce((acc, m) => ({ ...acc, [m.id]: true }), {});
  const cStatePriest = { ...cStateDraft, devotion: { myth: { creed: 'myth', marks: fMarks } } };
  const cProfPriest = resolveConsejeroProfile(cStatePriest, 'MythStorm', 'myth', bridge);
  const cStateRazon = { ...state, religions: {}, devotion: { scad: { creed: 'razon', marks: {} } } };
  const cProfRazon = resolveConsejeroProfile(cStateRazon, 'Scadrial0523', 'scad', bridge);
  if (
    cProfNone.stage !== 'filosofo' || cProfNone.badge !== 'Consejero' ||
    cProfGuia.stage !== 'guia' ||
    cProfPriest.stage !== 'sacerdote' || cProfPriest.badgeColor !== 'dark_purple' ||
    cProfRazon.stage !== 'razon'
  ) {
    throw new Error(`resolveConsejeroProfile falló: ${JSON.stringify({ cProfNone: cProfNone.stage, cProfGuia: cProfGuia.stage, cProfPriest: { s: cProfPriest.stage, c: cProfPriest.badgeColor }, cProfRazon: cProfRazon.stage })}`);
  }
  console.log(`9) Multi-NPC Cast & Judge Etiquette test: PASS`);

  // 10. Scribe: Colored Certificates, Multi-Author & Paper unit check
  const colorCheck = parseFormattedText('&6&lCERTIFICADO &rde &aObra &#ff8800TRD §bOK');
  if (!colorCheck.some(c => c.color === 'gold' && c.bold) || !colorCheck.some(c => c.color === 'green') || !colorCheck.some(c => c.color === '#ff8800') || !colorCheck.some(c => c.color === 'aqua')) {
    throw new Error(`parseFormattedText colores inválidos: ${JSON.stringify(colorCheck)}`);
  }
  const mockSnbt = 'NotOutContext has the following entity data: {id: "minecraft:writable_book", count: 1, components: {"minecraft:writable_book_content": {pages: [{raw: "&6&lPrimera \\"pagina\\"\\nLinea 2"}, "&aSegunda pagina"]}}}';
  const extractedBook = extractSelectedWritableBook(mockSnbt);
  if (!extractedBook.isWritableBook || extractedBook.count !== 1 || extractedBook.pages.length !== 2 || !extractedBook.pages[0].includes('"pagina"') || !extractedBook.pages[0].includes('\nLinea 2') || extractedBook.pages[1] !== '&aSegunda pagina') {
    throw new Error(`extractSelectedWritableBook falló: ${JSON.stringify(extractedBook)}`);
  }
  const certSpec = buildWrittenBookComponents({ titleRaw: '&6&lTitulo Muy Largo Que Supera Los Treinta Y Dos Caracteres', author: 'NotOutContext', pagesRaw: extractedBook.pages });
  if (certSpec.plainTitle.length > 32 || !certSpec.giveItemArg.includes('generation:0') || !certSpec.giveItemArg.includes('minecraft:custom_name=') || certSpec.pageSnbtList.length !== 2) {
    throw new Error(`buildWrittenBookComponents falló: ${JSON.stringify(certSpec)}`);
  }
  const authHand1 = extractAuthorOption('&6Tratado autor: NotOutContext y MythStorm', 'NotOutContext');
  const authHand2 = extractAuthorOption('&6Tratado | autores: NotOutContext, MythStorm y Scadrial0523', 'NotOutContext');
  const authInline = extractAuthorOption('&6Acta | &2P1 || &bP2 | autor: NotOutContext y MythStorm', 'NotOutContext');
  const authPreset = extractAuthorOption('aval Ley 011 | Sin notas | autores: NotOutContext y MythStorm', 'NotOutContext');
  const authNoFalsePositive = extractAuthorOption('&6Acta | &0Aprobado por: el Concejo', 'NotOutContext');
  if (
    authHand1.cleanArg !== '&6Tratado' || authHand1.author !== 'NotOutContext y MythStorm' ||
    authHand2.cleanArg !== '&6Tratado' || authHand2.cleanArg.includes('|') || authHand2.author !== 'NotOutContext, MythStorm y Scadrial0523' ||
    authInline.cleanArg !== '&6Acta | &2P1 || &bP2' || authInline.author !== 'NotOutContext y MythStorm' ||
    authPreset.cleanArg !== 'aval Ley 011 | Sin notas' || authPreset.author !== 'NotOutContext y MythStorm' ||
    authNoFalsePositive.cleanArg !== '&6Acta | &0Aprobado por: el Concejo' || authNoFalsePositive.author !== 'NotOutContext'
  ) {
    throw new Error(`extractAuthorOption falló: ${JSON.stringify({ authHand1, authHand2, authInline, authPreset, authNoFalsePositive })}`);
  }
  const multiSpec = buildWrittenBookComponents({
    titleRaw: '&6Tratado',
    author: 'NotOutContext, MythStorm y Scadrial0523',
    signer: 'NotOutContext',
    pagesRaw: ['&2Hola']
  });
  if (
    multiSpec.author !== 'NotOutContext, MythStorm y Scadrial0523' ||
    !multiSpec.giveItemArg.includes('author:"NotOutContext, MythStorm y Scadrial0523"') ||
    !multiSpec.giveItemArg.includes('Autores: NotOutContext, MythStorm y Scadrial0523')
  ) {
    throw new Error(`buildWrittenBookComponents multi-autor falló: ${JSON.stringify(multiSpec)}`);
  }
  const presetSpec = buildCertificatePreset('aval', 'Ley 011 | Sin observaciones', 'NotOutContext y MythStorm');
  const paperSpec = buildColoredPaperItemArg({ nameRaw: '&6&lSello &bJuan', loreRaw: '&7Archivo Nacional' });
  if (!presetSpec || !presetSpec.loreLines.some(l => l.includes('NotOutContext y MythStorm')) || !paperSpec.startsWith('minecraft:paper[minecraft:custom_name=')) {
    throw new Error('Preset o Paper builder falló');
  }
  if (!isArchivistaPlayer('NotOutContext', state) || isArchivistaPlayer('MythStorm', state)) {
    throw new Error('isArchivistaPlayer debe permitir solo a NotOutContext');
  }
  console.log(`10) Scribe Certificates, Multi-Author & Colored Paper test: PASS`);

  // 11. Permits, Multi-Scope Parsing & Explicit Prohibitions (flores/cactus/tintes)
  if (
    PERMIT_SCOPE_ALIASES.flores !== 'agro:flores' ||
    PERMIT_SCOPE_ALIASES.cactus !== 'agro:cactus' ||
    PERMIT_SCOPE_ALIASES.tintes !== 'agro:tintes' ||
    PERMIT_SCOPES['agro:flores']?.owner !== 'myth' ||
    PERMIT_SCOPES['agro:cactus']?.owner !== 'myth' ||
    PERMIT_SCOPES['agro:tintes']?.owner !== 'myth' ||
    !PERMIT_FILLER.has('todos') ||
    !PERMIT_FILLER.has('derivados')
  ) {
    throw new Error('Alias o alcances de flores/cactus/tintes incompletos');
  }
  const tmpMemPath = path.join(os.tmpdir(), `miscolandia-smoke-mem-${Date.now()}.json`);
  try {
    const tmpMem = new SessionMemory(tmpMemPath);
    tmpMem.grantPermit({ player: 'NotOutContext', scope: 'agro:flores', grantedBy: 'MythStorm', grantorRole: 'myth', label: PERMIT_SCOPES['agro:flores'].label });
    tmpMem.grantPermit({ player: 'NotOutContext', scope: 'agro:cactus', grantedBy: 'MythStorm', grantorRole: 'myth', label: PERMIT_SCOPES['agro:cactus'].label });
    tmpMem.grantPermit({ player: 'NotOutContext', scope: 'agro:tintes', grantedBy: 'MythStorm', grantorRole: 'myth', label: PERMIT_SCOPES['agro:tintes'].label });
    if (tmpMem.getActivePermits('NotOutContext').length !== 3 || !tmpMem.hasPermit('NotOutContext', 'agro:tintes')) {
      throw new Error('Permiso multi-alcance flores+cactus+tintes no se guardó completo');
    }
    tmpMem.grantProhibition({ player: 'NotOutContext', scope: 'agro:flores', prohibitedBy: 'MythStorm', grantorRole: 'myth', label: PERMIT_SCOPES['agro:flores'].label, note: 'prueba' });
    if (tmpMem.hasPermit('NotOutContext', 'agro:flores') || !tmpMem.hasProhibition('NotOutContext', 'agro:flores')) {
      throw new Error('Prohibición expresa debe cancelar permiso previo y quedar activa');
    }
    if (tmpMem.getStats().prohibitionsCount !== 1 || !tmpMem.getPersistentMemoryText().includes('[PROHIBICIONES EXPRESAS VIGENTES')) {
      throw new Error('Memoria persistente o stats no reflejan prohibición expresa');
    }
    const revokedBan = tmpMem.revokeProhibition({ player: 'NotOutContext', scope: 'agro:flores', by: 'MythStorm' });
    if (revokedBan !== 1 || tmpMem.hasProhibition('NotOutContext', 'agro:flores')) {
      throw new Error('revokeProhibition no retiró la prohibición');
    }
  } finally {
    try { fs.unlinkSync(tmpMemPath); } catch {}
  }
  console.log(`11) Permits, Multi-Scope & Prohibitions test: PASS`);

  // 12. Admin Genie: Parsing, SNBT Quirks, Countdown Execution & Shutdown Hook
  if (
    extractAdminWish('!admin que el servidor se cierre en 10 segundos y aparezca un contador') !== 'que el servidor se cierre en 10 segundos y aparezca un contador' ||
    extractAdminWish('hola mundo') !== null
  ) {
    throw new Error('extractAdminWish falló');
  }
  const snbtFixed = sanitizeRconCommand('/give @a minecraft:cookie[minecraft:custom_name=\'{"text":"Galleta","color":"gold"}\'] 2}');
  if (!snbtFixed.startsWith('give @a minecraft:cookie[minecraft:custom_name={text:"Galleta",color:"gold"}] 2') || snbtFixed.endsWith('}')) {
    throw new Error(`sanitizeRconCommand SNBT falló: ${snbtFixed}`);
  }
  const sentCmds = [];
  let stopCompacted = false;
  const mockRcon = {
    async send(c) { sentCmds.push(c); return 'OK'; },
    async tellraw(t, comps) { sentCmds.push(`tellraw ${t} ${JSON.stringify(comps)}`); return 'OK'; }
  };
  const genie = new AdminGenie({
    cfg,
    rcon: mockRcon,
    onLog: () => {},
    onBeforeStop: async () => { stopCompacted = true; },
    tickMs: 15
  });
  const planCheck = await genie.fulfill('que el servidor se cierre en 3 segundos y aparezca un contador', {
    onlinePlayers: ['MythStorm', 'Scadrial0523']
  });
  await planCheck.completionPromise;
  const saveIdx = sentCmds.findIndex(c => /^save-all\b/i.test(c));
  const stopIdx = sentCmds.findIndex(c => /^stop\b/i.test(c));
  if (
    !sentCmds.some(c => c.startsWith('bossbar add minecraft:admin_timer')) ||
    !sentCmds.some(c => c.startsWith('title @a title ')) ||
    !sentCmds.some(c => c === 'bossbar remove minecraft:admin_timer') ||
    saveIdx < 0 || stopIdx < 0 || saveIdx > stopIdx || !stopCompacted
  ) {
    throw new Error(`AdminGenie countdown/shutdown incompleto: ${JSON.stringify({ stopCompacted, saveIdx, stopIdx, sample: sentCmds.slice(-6) })}`);
  }
  const adminDryPlan = await planAdminWish({ config: cfg, wish: 'cancela el contador' });
  if (adminDryPlan.pasos[0]?.tipo !== 'cancel_countdown') {
    throw new Error(`planAdminWish cancelación falló: ${JSON.stringify(adminDryPlan)}`);
  }
  console.log(`12) Admin Genie (!admin Console & Countdown) test: PASS`);

  // 13. WebSync Diff & Bot Helpers (!hitos / !obras)
  const hitosSummary = bridge.getPendingEraMilestones(state);
  const worksSummary = bridge.getWorksSummary(state);
  if (!hitosSummary.eraCode || !Array.isArray(hitosSummary.pendingReq) || !worksSummary.auditedByOwner) {
    throw new Error('getPendingEraMilestones o getWorksSummary inválidos');
  }
  const cloned = JSON.parse(JSON.stringify(state));
  const snapBefore = snapshotWorld(cloned, bridge);
  const sameDiff = diffWorldSnapshots(snapBefore, snapshotWorld(cloned, bridge), cloned, bridge);
  if (sameDiff.eraUnlocked || sameDiff.auditedWorks.length || sameDiff.approvedLaws.length || sameDiff.completedTasks.length) {
    throw new Error('diffWorldSnapshots sin cambios debería ser vacío');
  }
  const eraCur = bridge.D.ERAS[hitosSummary.eraIndex];
  for (const t of (eraCur?.tasks || [])) {
    if (t.req && !bridge.isTaskDone(cloned, t)) {
      cloned.tasks[t.id] = t.who === 'ambos' ? { myth: true, scad: true } : true;
    }
  }
  cloned.economy.works.push({ id: 'smoke-wrk-1', name: 'Faro Real', owner: 'myth', cat: 'monumento', status: 'auditada', final: 15 });
  cloned.laws.push({ id: 'smoke-law-1', kind: 'rol', docType: 'ley', num: 99, title: 'Ley de Prueba', review: { status: 'approved', notes: [] } });
  const snapAfter = snapshotWorld(cloned, bridge);
  const changedDiff = diffWorldSnapshots(snapBefore, snapAfter, cloned, bridge);
  if (
    !changedDiff.eraUnlocked ||
    !changedDiff.auditedWorks.some(w => w.id === 'smoke-wrk-1') ||
    !changedDiff.approvedLaws.some(l => l.id === 'smoke-law-1') ||
    !changedDiff.completedTasks.length
  ) {
    throw new Error(`diffWorldSnapshots no detectó todos los eventos: ${JSON.stringify(changedDiff)}`);
  }
  console.log(`13) WebSync Diff & !hitos/!obras test: PASS`);

  // 14. Deity Blasphemy Detection & La Razón Exclusion
  const tmpDeityPath = path.join(os.tmpdir(), `miscolandia-smoke-deity-${Date.now()}.json`);
  try {
    const deitySent = [];
    const deityMockRcon = {
      async send(c) { deitySent.push(c); return 'OK'; },
      async tellraw(t, comps) { deitySent.push(`tellraw ${t} ${JSON.stringify(comps)}`); return 'OK'; }
    };
    const mockState = JSON.parse(JSON.stringify(state));
    mockState.guests = Array.isArray(mockState.guests) && mockState.guests.length
      ? mockState.guests
      : [{ id: 'guest_noc', nick: 'NotOutContext', name: 'Archivista' }];
    const nocGuestId = (mockState.guests.find(g => /notout/i.test(String(g.nick || ''))) || mockState.guests[0]).id;
    mockState.religions = {
      myth: { faith: 'Iglesia del Sol', names: 'Solari', nature: 'Severo pero justo' },
      scad: { faith: 'Culto de la Bruma', names: 'Bruma', nature: 'Silenciosa e implacable' }
    };
    mockState.devotion = {
      myth: { creed: 'myth', marks: {} },
      scad: { creed: 'scad', marks: {} },
      [nocGuestId]: { creed: 'razon', marks: {} }
    };
    const testDeity = new Deity({ cfg, bridge, rcon: deityMockRcon, statePath: tmpDeityPath });
    const mAtheist = testDeity.detectMockery('jaja Solari es una basura inútil', mockState, nocGuestId);
    const mCross = testDeity.detectMockery('el culto de la bruma es ridículo', mockState, 'myth');
    const mReason = testDeity.detectMockery('la razón es una tontería jajaja', mockState, 'myth');
    const mPrayer = testDeity.detectMockery('oh Solari, dame fuerzas por favor', mockState, 'myth');
    if (
      mAtheist?.name !== 'Solari' ||
      mCross?.name !== 'Bruma' ||
      mReason !== null ||
      mPrayer !== null ||
      Object.keys(SMITES).length < 5
    ) {
      throw new Error(`detectMockery falló: ${JSON.stringify({ mAtheist: mAtheist?.name, mCross: mCross?.name, mReason, mPrayer })}`);
    }
    testDeity.askSmite = async () => ({ mensaje: '¡Silencio, mortal insolente!', castigo: 'marca' });
    const smiteRes = await testDeity.punish({
      inv: mAtheist,
      player: 'NotOutContext',
      playerIdentity: 'NotOutContext — sigue la Razón',
      message: 'jaja Solari es una basura inútil',
      state: mockState
    });
    if (
      smiteRes.smiteId !== 'marca' ||
      !deitySent.some(c => c.includes('effect give NotOutContext minecraft:glowing')) ||
      !deitySent.some(c => c.includes('[Solari]')) ||
      !(testDeity.saved.smites || []).some(s => s.player === 'NotOutContext' && s.smiteId === 'marca')
    ) {
      throw new Error(`deity.punish no ejecutó ni guardó castigo: ${JSON.stringify({ smiteRes, smites: testDeity.saved.smites })}`);
    }
  } finally {
    try { fs.unlinkSync(tmpDeityPath); } catch {}
  }
  console.log(`14) Deity Blasphemy & La Razón Exclusion test: PASS`);

  // 15. AdminGenie Alias Resolution, Creative Safety & 26.4 Sanitizer
  const resNoc = resolveWishPlayers('castiga a noc', ['NotOutContext'], state, cfg);
  const resArch = resolveWishPlayers('premia al archivista', [], state, cfg);
  const resLuth = resolveWishPlayers('castiga al de luthadel', [], state, cfg);
  const effFixed = sanitizeRconCommand('effect give NotOutContext minecraft:levitation 4s');
  const mobFixed = sanitizeRconCommand('execute at NotOutContext run summon minecraft:chicken ~1 ~ ~ {CustomName:\'{"text":"Inspector","color":"gold"}\'}');
  const optsSplit = buildOllamaOptions({ ollamaNumGpu: 22, ollamaNumCtx: 6144 }, { temperature: 0.2 });
  const optsCpu = buildOllamaOptions({ ollamaNumGpu: 0 }, {});
  if (
    !resNoc.targets.has('notoutcontext') ||
    !resArch.targets.has('notoutcontext') ||
    !resLuth.targets.has('scadrial0523') ||
    optsSplit.num_gpu !== 22 ||
    optsSplit.num_ctx !== 6144 ||
    optsCpu.num_gpu !== 0 ||
    effFixed !== 'effect give NotOutContext minecraft:levitation 4' ||
    !mobFixed.includes('CustomName:{text:"Inspector",color:"gold"}') ||
    riskyReason('effect give NotOutContext minecraft:levitation 5 1', 'castiga a noc', resNoc.targets) !== null ||
    riskyReason('execute at NotOutContext run summon minecraft:lightning_bolt ~ ~ ~', 'castiga al archivista', resArch.targets) !== null ||
    riskyReason('ban NotOutContext', 'castiga a noc', resNoc.targets) === null ||
    riskyReason('effect give MythStorm minecraft:blindness 10 0', 'castiga a noc', resNoc.targets) === null ||
    riskyReason('execute at NotOutContext run summon minecraft:wither ~ ~ ~', 'castiga a noc', resNoc.targets) === null
  ) {
    throw new Error(`Alias resolution, SNBT sanitizer o riskyReason falló: ${JSON.stringify({ noc: [...resNoc.targets], arch: [...resArch.targets], luth: [...resLuth.targets], effFixed, mobFixed })}`);
  }
  console.log(`15) AdminGenie Alias Resolution & Creative Safety test: PASS`);

  // 16. Holidays calendar (Colombia TZ), GPS bearing & Deity vs Razón holiday rewards
  const velCal = bridge.D.getHolidayCalendar(Date.UTC(2026, 11, 7, 17, 0));
  const halCal = bridge.D.getHolidayCalendar(Date.UTC(2026, 9, 31, 17, 0));
  const sepCal = bridge.D.getHolidayCalendar(Date.UTC(2026, 8, 15, 17, 0));
  const novCal = bridge.D.getHolidayCalendar(Date.UTC(2026, 10, 21, 22, 0));
  const nyDecCal = bridge.D.getHolidayCalendar(Date.UTC(2026, 11, 31, 23, 0));
  const nyJanCal = bridge.D.getHolidayCalendar(Date.UTC(2027, 0, 1, 15, 0));
  const parsedCoord = bridge.parseCoords('120, 64, -240');
  const brNorth = computeGpsBearing(0, -100);
  const brSouthEast = computeGpsBearing(50, 50);

  const hTestDeityPath = path.join(os.tmpdir(), `miscolandia-smoke-holiday-${Date.now()}.json`);
  const hDeitySent = [];
  const hMockRcon = {
    send: async cmd => { hDeitySent.push(cmd); return ''; },
    tellraw: async (target, parts) => { hDeitySent.push(`tellraw ${target} ${JSON.stringify(parts)}`); return ''; }
  };
  const hState = JSON.parse(JSON.stringify(state));
  hState.religions = { myth: { faith: 'Culto Solar', names: 'Solari' } };
  hState.devotion = { myth: { creed: 'myth', marks: {} }, scad: { creed: 'razon', marks: {} } };
  const hDeity = new Deity({ cfg, bridge, rcon: hMockRcon, memory: null, statePath: hTestDeityPath });
  try {
    const velHol = bridge.D.HOLIDAYS.find(h => h.id === 'velitas');
    const mythRes = await hDeity.grantHolidayReward({ player: 'MythStorm', pid: 'myth', holiday: velHol, year: 2026, state: hState, isOnline: true });
    const scadRes = await hDeity.grantHolidayReward({ player: 'Scadrial0523', pid: 'scad', holiday: velHol, year: 2026, state: hState, isOnline: true });
    if (
      !velCal.active.some(h => h.id === 'velitas') ||
      !halCal.active.some(h => h.id === 'halloween') ||
      !sepCal.active.some(h => h.id === 'amor_amistad') ||
      novCal.upcoming?.id !== 'velitas' ||
      nyDecCal.active.find(h => h.id === 'anio_nuevo')?.seasonYear !== 2026 ||
      nyJanCal.active.find(h => h.id === 'anio_nuevo')?.seasonYear !== 2026 ||
      parsedCoord?.x !== 120 || parsedCoord?.z !== -240 ||
      brNorth !== 'N' || brSouthEast !== 'SE' ||
      mythRes.badge !== 'Solari' ||
      scadRes.badge === 'Solari' ||
      hDeitySent.some(s => s.includes('Scadrial0523') && s.includes('Solari')) ||
      !hDeitySent.some(s => s.includes('give MythStorm minecraft:yellow_candle 6'))
    ) {
      throw new Error(`Fallo Test 16 festividades/GPS/deidad: ${JSON.stringify({ novUpcoming: novCal.upcoming?.id, brNorth, brSouthEast, mythRes, scadRes })}`);
    }
  } finally {
    try { fs.unlinkSync(hTestDeityPath); } catch {}
  }
  console.log(`16) Holidays Calendar (Colombia), GPS & Reward Routing test: PASS`);

  // 17. Multi-slide !admin presenters + Expanded WebSync diff detection
  const pnPlan = buildPatchNotesPlan(bridge.D.PATCH_NOTES);
  const slideCustom = parseCustomSlidesPlan('slides Primer Aviso | Subtitulo 1 | Mensaje chat ;; Cierre | Todo listo');
  const sPrev = snapshotWorld({
    ...state,
    guests: [{ id: 'g1', nick: 'Noc' }],
    tasks: {},
    guestTasks: {},
    economy: { ...(state.economy || {}), works: [], loans: [], ledger: [] },
    villagers: [],
    portals: [],
    chronicles: [],
    devotion: {}
  }, bridge);
  const nextTestState = {
    ...state,
    guests: [{ id: 'g1', nick: 'Noc' }],
    tasks: { 'e0-01': { myth: true, scad: false } },
    guestTasks: { g1: { 'g-01': true } },
    economy: { ...(state.economy || {}), works: [{ id: 'w-new', name: 'Faro', owner: 'myth', status: 'pendiente', proposed: 15 }], loans: [], ledger: [] },
    villagers: [{ id: 'v-new', name: 'Mercurio', cedula: 'CC-MYTH-001', kind: 'villager', owner: 'myth' }],
    portals: [{ id: 'p-new', label: 'Norte', ow: '100, 200', nh: '12, 25' }],
    chronicles: [{ id: 'c-new', title: 'Acta 1', author: 'myth', type: 'Crónica' }],
    devotion: { myth: { creed: 'razon', marks: { r1: true } } }
  };
  const sNext = snapshotWorld(nextTestState, bridge);
  const expDiff = diffWorldSnapshots(sPrev, sNext, nextTestState, bridge);

  if (
    !pnPlan || pnPlan.pasos.length !== 6 || pnPlan.pasos.some(p => p.tipo !== 'slide') || !pnPlan.pasos[5].fuegos ||
    pnPlan.pasos[1].delay_sec <= pnPlan.pasos[0].delay_sec ||
    !slideCustom || slideCustom.pasos.length !== 2 || !slideCustom.pasos[1].fuegos ||
    expDiff.partialTasks.length !== 1 ||
    expDiff.completedGuestQuests.length !== 1 ||
    expDiff.newPendingWorks.length !== 1 ||
    expDiff.newCedulas.length !== 1 ||
    expDiff.newPortals.length !== 1 ||
    expDiff.newChronicles.length !== 1 ||
    expDiff.newDevotionMarks.length !== 1
  ) {
    throw new Error(`Fallo Test 17 slides/WebSync expandido: ${JSON.stringify({ pnLen: pnPlan?.pasos?.length, expDiff })}`);
  }
  console.log(`17) Multi-slide !admin Presenter & Expanded WebSync Diff test: PASS`);
  console.log('=== TODOS LOS TESTS PASARON ===');
}

async function main() {
  const cfg = loadConfig();
  if (process.argv.includes('--smoke-test')) {
    await runSmokeTest(cfg);
    return;
  }

  claimSingleInstanceLock();
  const memory = new SessionMemory(path.join(SERVER_DIR, 'bot-memory.json'));
  const bridge = new SupabaseBridge(cfg.repoRootResolved);
  const rcon = new RconClient({
    host: cfg.rconHost || '25.45.82.35',
    port: cfg.rconPort || 25575,
    password: cfg.rconPassword || ''
  });
  const enforcer = new RuleEnforcer({ cfg, bridge, rcon, memory });
  const ctx = { cfg, bridge, rcon, enforcer, memory, events: null, webSync: null, adminGenie: null };
  ctx.deity = new Deity({ cfg, bridge, rcon, memory, statePath: path.join(SERVER_DIR, 'bot-deity.json') });
  setWikiCachePath(path.join(SERVER_DIR, 'bot-wiki-cache.json'));
  const adminGenie = new AdminGenie({
    cfg,
    rcon,
    bridge,
    memory,
    onBeforeStop: () => handleServerStopCompaction(ctx)
  });
  ctx.adminGenie = adminGenie;
  const webSync = new WebSyncAnnouncer({ bridge, rcon, enforcer, memory, deity: ctx.deity });
  ctx.webSync = webSync;
  memory.setEventHook((type, text) => {
    if (!webSync._suppressMemoryFeed) webSync.addFeed(type, text);
  });

  const shutdown = () => {
    webSync.stop();
    ctx.deity?.stopGuardian();
    adminGenie.stopAll();
    enforcer.stop();
    rcon.close();
    releaseSingleInstanceLock();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // Red de seguridad: un error suelto en un temporizador no debe apagar al moderador en plena partida
  process.on('unhandledRejection', err => console.error('[Bot] Promesa rechazada sin atrapar:', err?.message || err));
  process.on('uncaughtException', err => console.error('[Bot] Excepción sin atrapar:', err?.stack || err));

  try {
    const { rev, state } = await bridge.fetchWorld(true);
    const brief = bridge.getBriefing(state);
    const memStats = memory.getStats();
    console.log(`Moderador IA Miscolandia listo | Modelo: ${cfg.ollamaModel} | Supabase rev #${rev} (${brief.icTotal} normas IC, ${brief.eraCode}) | Memoria: ${memStats.sessionsCount} sesiones, ${memStats.notesCount} notas`);
  } catch (err) {
    console.warn('Aviso inicial Supabase (se reintentará en consultas):', err.message);
  }

  await enforcer.start().catch(err => console.warn('[Enforcer init]', err.message));
  ctx.deity.startGuardian(enforcer);
  const events = new WorldEvents({ cfg, bridge, rcon, enforcer, memory, statePath: path.join(SERVER_DIR, 'bot-events.json') });
  ctx.events = events;
  webSync.events = events;
  events.start();
  await webSync.start().catch(err => console.warn('[WebSync init]', err.message));
  startLogWatcher(cfg, ctx);

  if (process.stdin && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    rl.on('line', line => {
      const wish = extractAdminWish(line, cfg.prefix || '!');
      if (wish !== null) {
        adminGenie.fulfill(wish).then(r => {
          console.log(`[Admin (Terminal)] ${r.respuesta_consola}`);
        }).catch(e => console.error('[Admin error]', e.message));
      }
    });
  }
}

main().catch(err => {
  console.error('Error fatal en moderador:', err);
  process.exit(1);
});
