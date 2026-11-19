import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { RconClient } from './rcon.mjs';
import { SupabaseBridge } from './supabase-bridge.mjs';
import { askModerator, askNpc, generateRoast, generateSocialMessage, compactSessionMemory } from './ollama.mjs';
import { RuleEnforcer } from './enforcer.mjs';
import { SessionMemory, PERMIT_SCOPES } from './memory.mjs';
import { WorldEvents } from './events.mjs';
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
  // Finos: un solo cultivo
  trigo: 'agro:trigo', zanahoria: 'agro:zanahoria', zanahorias: 'agro:zanahoria', papa: 'agro:papa', papas: 'agro:papa',
  remolacha: 'agro:remolacha', remolachas: 'agro:remolacha', 'caña': 'agro:cana', cana: 'agro:cana', azucar: 'agro:cana', 'azúcar': 'agro:cana',
  sandia: 'agro:sandia', 'sandía': 'agro:sandia', sandias: 'agro:sandia', 'sandías': 'agro:sandia', melon: 'agro:sandia', 'melón': 'agro:sandia',
  calabaza: 'agro:calabaza', calabazas: 'agro:calabaza', bayas: 'agro:bayas', baya: 'agro:bayas',
  verruga: 'agro:verrugas', verrugas: 'agro:verrugas', abejas: 'agro:abejas', abeja: 'agro:abejas', miel: 'agro:abejas', colmena: 'agro:abejas', panal: 'agro:abejas', panales: 'agro:abejas',
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
export function fmtMinutes(mins) {
  if (mins < 1) return `${Math.round(mins * 60)} s`;
  if (mins < 60) return `${Math.round(mins)} min`;
  if (mins < 1440) return `${+(mins / 60).toFixed(1)} h`;
  return `${+(mins / 1440).toFixed(1)} días`;
}
// Palabras de relleno que no deben quedar como nota ("semillas DE trigo POR 30 segundos")
const PERMIT_FILLER = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'por', 'para', 'durante', 'un', 'una', 'unos', 'y', 'a', 'al', 'en', 'solo', 'sólo', 'nada', 'mas', 'más']);

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

async function handleJoin(player, { cfg, bridge, rcon, enforcer, memory }) {
  try {
    memory?.recordEvent('event', `${player} se conectó al servidor`);
    await new Promise(r => setTimeout(r, 1800));
    const { state } = await bridge.fetchWorld(true);
    const b = bridge.getBriefing(state);
    if (cfg.social?.joinAi !== false) {
      const role = enforcer.getPlayerRole(player, state);
      const greeting = await generateSocialMessage({
        config: cfg,
        kind: 'join',
        player,
        role,
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
  } catch (err) {
    console.error(`[Join ${player}]`, err.message);
  }
}

async function handleLeave(player, { cfg, bridge, rcon, enforcer, memory }) {
  try {
    memory?.recordEvent('event', `${player} se desconectó del servidor`);
    if (cfg.social?.leaveAi === false) return;
    if (!enforcer.onlinePlayers.size) return;
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    const farewell = await generateSocialMessage({
      config: cfg,
      kind: 'leave',
      player,
      role,
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
  pacto: 'Muestra el Pacto de Monopolios y gremios, o responde dudas sobre sectores. Uso: !pacto [sector o pregunta].',
  trato: 'Pausa monopolios y PvP un rato para pasarse comida o ítems sin que interfiera. Uso: !trato [min] (ej: !trato 5) y !trato fin al acabar.',
  duelo: 'Autoriza PvP consensuado temporalmente sin regaños OOC. Uso: !duelo [min] y !duelo fin al acabar.',
  pase: 'Da salvoconducto temporal a 1 jugador (o a todos con !pase todos). Uso: !pase <jugador> [min].',
  permiso: 'Permiso expreso que se guarda y no se borra al reiniciar. MythStorm autoriza agricultura/semillas/abejas; Scadrial0523 autoriza ganadería/pesca; cualquiera de los dos, aldeanos. Productos con granja (hierro, oro, blaze, slime, madera…): solo el dueño de la granja. También uno solo: trigo, papa, zanahoria, calabaza, abejas…, vacas, gallinas, ovejas, pesca… Uso: !permiso <jugador> [semillas|trigo|ganado|gallinas|aldeanos|hierro…] [30m|2h|3d|permanente] [nota] · !permiso quitar <jugador> [alcance] · !permisos [jugador].',
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
  colores: 'Muestra la paleta de códigos &0-&f, &l/&o/&n/&m/&r y &#RRGGBB para !certificado y !papel.'
};

const COMMAND_ALIASES = {
  pregunta: 'duda',
  preguntar: 'duda',
  ia: 'duda',
  bot: 'duda',
  alguacil: 'duda',
  eras: 'era',
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
  formato: 'colores'
};

const BOT_COMMANDS_DOC = [
  'Guía oficial de Miscolandia (habla con los NPCs en el chat + utilidades operativas):',
  '- NO recomiendes comandos de consulta viejos (!era, !ley, !tasa, !saldo, !lore, !duda); diles que hablen directo con el NPC:',
  '  * Arquitecto / Maestro de Obras / Ingeniero: Eras (ERA 0–XIII), qué construir ahora y qué mecánicas están prohibidas.',
  '  * Su Excelencia / Su Señoría / Señor Juez: leyes IC, disputas y multas (si le dicen solo "juez" sin título de respeto, responde indignado y de mala forma).',
  '  * Fiscal / Policía / Alguacil / Aduana: pacto de monopolios, contrabando, PvP OOC, tratos y salvoconductos.',
  '  * Banquero / Don Tesoro / Contador: tasa cambiaria DR/CU, reservas de la Cámara, saldos y precios de catálogo.',
  '  * Archivista / Auditor / Cronista / Bibliotecario: auditoría oficial de obras (Manual 003, TRD 120-01), lore del mundo, crónicas (TRD 140-01), cédulas (TRD 150-01) y recuerdos pasados.',
  '  * Pregonero: chismes de la plaza, opinión económica y libreta permanente ("pregonero recuerda que...").',
  '- Utilidades operativas que ejecutan permisos/control del servidor: !duelo [min|fin] (PvP consensuado), !trato [min|fin] (intercambio libre), !pase <jug|todos>, !mod [on|off], !chat [on|off], !memoria y !ayuda.',
  '- Certificados y sellos oficiales (EXCLUSIVO Archivista NotOutContext): !certificado <Título> (sella en colores el Libro y Pluma en mano consumiéndolo, o !certificado <Título> | <Texto> / aval / obra / residencia / paz con 1 writable_book en inventario; admite autor: <Autor1 y Autor2> para coautoría), !papel <Nombre> [| <Lore>] (consume 1 papel real) y !colores.',
  '- Acuerdos en chat: "vamos a hacer un trato" o "pvp consensuado / vamos a hacer un duelo" pausan automáticamente al aduanero.',
  '- Permisos expresos que no se borran: !permiso <jugador> [semillas|ganado|aldeanos] [tiempo|permanente] [nota]. Cada Estado solo autoriza su monopolio (MythStorm: agricultura, semillas y abejas; Scadrial0523: ganadería y pesca); aldeanos, cualquiera de los dos; un producto con granja auditada (hierro, oro, blaze, slime, madera…), solo el dueño de esa granja. Se quitan con !permiso quitar <jugador> y se consultan con !permisos. Si alguien tiene un permiso vigente (aparece en la memoria), lo que hace dentro de ese permiso es legal: no lo regañes.'
].join('\n');

const NPC_HELP_DOCS = {
  arquitecto: 'Arquitecto (o maestro de obras / ingeniero): Eras (ERA 0-XIII), que construir y permisos. Ej: "arquitecto que toca construir?"',
  juez: 'Juez (o Excelencia / Su Senoria / Senor Juez): leyes IC, disputas y multas. Ej: "excelencia que multa aplica?"',
  fiscal: 'Fiscal (o policia / alguacil / aduana): monopolios, contrabando, PvP, tratos y pases. Ej: "fiscal puedo pasar trigo?"',
  banquero: 'Banquero (o Don Tesoro / contador): tasa DR/CU, reservas, saldos y precios. Ej: "banquero cuanto vale el trigo?"',
  archivista: 'Archivista (o auditor / cronista / bibliotecario): auditoria de obras (Manual 003), lore, cronicas, cedulas y recuerdos. Ej: "auditor como audito una granja?"',
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
  plaza: 'pregonero'
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
  if (aiBusy) {
    await sendLine(rcon, player, 'Archivo', 'yellow', [{ text: 'El Archivista está atendiendo otra consulta; intenta en un momento.', color: 'gray' }]);
    return;
  }

  if (badgeOverride !== 'Pregonero') {
    memory?.recordPlayerChat(player, `!${cmdLabel || mode} ${q}`);
  }

  aiCooldown.set(player, now);
  aiBusy = true;
  try {
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
    const reply = await askModerator({
      config: cfg,
      mode,
      player,
      playerIdentity: buildPlayerIdentity(player, role, state, bridge),
      query: q,
      contextText: contextParts.join('\n\n---\n\n'),
      chatHistoryText: memory?.getRecentChatText(10) || '',
      memoryText: memory?.getPersistentMemoryText({ maxSessions: 5, maxNotes: 10 }) || ''
    });

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
  } finally {
    aiBusy = false;
  }
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
      { text: 'Pregonero', color: 'light_purple', bold: true },
      { text: ': chismes y "recuerda <dato>"\n', color: 'white' },
      { text: 'Comandos: ', color: 'gray' },
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
      const mins = enforcer.startGlobalWindow(parts[1] ? Number(parts[1]) : 5, 'trato');
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
    const mins = enforcer.grantTradePass(canonicalTarget, parts[1] ? Number(parts[1]) : 5);
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
    const mins = enforcer.startGlobalWindow(arg ? Number(arg) : 5, 'trato');
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
    const mins = enforcer.startGlobalWindow(arg ? Number(arg) : 5, 'duelo');
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
      enforcer.enabled = sub === 'on';
      await sendLine(rcon, '@a', 'Fiscalía', 'gold', [
        { text: `Vigilancia automática ${enforcer.enabled ? 'ACTIVADA' : 'PAUSADA'} por ${player}.`, color: enforcer.enabled ? 'green' : 'yellow' }
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

    // Ver permisos: !permisos  |  !permiso ver [jugador]
    if (cmd === 'permisos' || !parts.length || ['ver', 'lista', 'listar'].includes(first)) {
      const who = ['ver', 'lista', 'listar'].includes(first) ? parts[1] : (cmd === 'permisos' ? parts[0] : null);
      const target = who ? (resolveKnownPlayer(who, cfg, enforcer) || who) : null;
      const list = mem.getActivePermits(target);
      await sendLine(rcon, player, 'Permisos', 'aqua', [
        { text: list.length ? list.map(p => mem.describePermit(p)).join('\n') : `Sin permisos vigentes${target ? ` para ${target}` : ''}.`, color: 'white' }
      ]);
      return;
    }

    if (senderRole !== 'myth' && senderRole !== 'scad') {
      await sendLine(rcon, player, 'Permisos', 'red', [{ text: 'Solo MythStorm o Scadrial0523 pueden dar o quitar permisos.', color: 'yellow' }]);
      return;
    }

    const revoke = ['quitar', 'retirar', 'revocar', 'anular', 'no'].includes(first);
    if (revoke) parts.shift();
    const target = resolveKnownPlayer(parts[0], cfg, enforcer);
    if (!target) {
      await sendLine(rcon, player, 'Permisos', 'gold', [{ text: `No conozco al jugador "${parts[0] || ''}". ${COMMAND_DOCS.permiso}`, color: 'yellow' }]);
      return;
    }
    if (target.toLowerCase() === player.toLowerCase()) {
      await sendLine(rcon, player, 'Permisos', 'gold', [{ text: 'No puedes darte permiso a ti mismo.', color: 'yellow' }]);
      return;
    }

    // Alcance: monopolio (semillas, ganado, aldeanos) o un producto con granja (hierro, slime, madera…)
    const scopeInfo = sc => {
      if (sc && sc.startsWith('granja:')) {
        const lock = (bridge.D.FARM_LOCKS || []).find(l => l.id === sc.slice(7));
        return lock ? { owner: lock.owner, label: `${lock.label} (producto con granja)` } : null;
      }
      return PERMIT_SCOPES[sc] ? { owner: PERMIT_SCOPES[sc].owner, label: PERMIT_SCOPES[sc].label } : null;
    };
    let scope = null;
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
    // El alcance más específico gana: "semillas de trigo" = solo trigo, no toda la agricultura
    scope = scopes.find(sc => sc.includes(':')) || scopes[0] || null;

    if (revoke) {
      // Sin alcance: quita todo lo que este Estado controla (su monopolio, aldeanos y sus granjas)
      const scopes = scope ? [scope] : [...new Set([
        senderRole === 'myth' ? 'agro' : 'ganado',
        'aldeanos',
        ...mem.getActivePermits(target).map(p => p.scope).filter(sc => sc.includes(':'))
      ])];
      let removed = 0;
      for (const sc of scopes) {
        const info = scopeInfo(sc);
        if (!info || (info.owner !== 'any' && info.owner !== senderRole)) continue;
        removed += mem.revokePermit({ player: target, scope: sc, by: player });
      }
      await sendLine(rcon, '@a', 'Permisos', 'aqua', [
        { text: removed ? `${player} retiró el permiso de ${target}${scope ? ` (${scopeInfo(scope)?.label || scope})` : ''}. La Aduana vuelve a vigilarlo en eso.` : `${target} no tenía permisos tuyos que quitar.`, color: 'white' }
      ]);
      return;
    }

    // Varios a la vez: "!permiso X trigo y papas 1h". Si nombra alguno específico, los generales sobran.
    const specific = [...new Set(scopes.filter(sc => sc.includes(':')))];
    const toGrant = specific.length ? specific : [scope || (senderRole === 'myth' ? 'agro' : 'ganado')];
    const granted = [];
    const refused = [];
    for (const sc of toGrant) {
      const info = scopeInfo(sc);
      if (!info) continue;
      if (info.owner !== 'any' && info.owner !== senderRole) { refused.push(`${info.label} (lo da ${PERMIT_OWNER_LABEL[info.owner]})`); continue; }
      mem.grantPermit({ player: target, scope: sc, grantedBy: player, grantorRole: senderRole, minutes, note: noteParts.join(' '), label: info.label });
      granted.push(info.label);
    }
    if (refused.length) {
      await sendLine(rcon, player, 'Permisos', 'gold', [{ text: `No puedes dar: ${refused.join('; ')}. Es monopolio del otro.`, color: 'yellow' }]);
    }
    if (granted.length) {
      const note = noteParts.join(' ');
      await sendLine(rcon, '@a', 'Permisos', 'aqua', [
        { text: `${player} autoriza a ${target}: ${granted.join(' + ')} ${minutes ? `por ${fmtMinutes(minutes)}` : 'hasta nuevo aviso'}${note ? ` (${note})` : ''}. La Aduana no interfiere en eso.`, color: 'white' }
      ]);
    }
    return;
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

const TRADE_INTENT_RE = /(?:nos\s+vamos\s+a\s+(?:pasar|dar|intercambiar|comerciar)|vamos\s+a\s+(?:pasar(?:nos)?|intercambiar|comerciar|cambiar|hacer\s+un\s+trato)|(?:te|le)\s+voy\s+a\s+pasar|p[aá]sa(?:me|le)\s+(?:comida|cosas|papas|trigo|carne|semillas|huevos)|no\s+(?:interfieras|te\s+metas|molestes|confisques|quites)|no\s+necesitamos\s+que\s+interfieras|d[eé]janos\s+(?:pasar|comerciar|intercambiar|en\s+paz)|trato\s+libre)/i;
const DUEL_INTENT_RE = /(?:vamos\s+a\s+(?:hacer\s+(?:un\s+)?|tener\s+(?:un\s+)?)?(?:duelo|pvp)|(?:duelo|pvp|combate|pelea)\s+(?:pactad[oa]|consensuad[oa]|amistoso))/i;
const RESUME_INTENT_RE = /(?:ya\s+(?:terminamos|acabamos|puedes\s+(?:vigilar|volver|seguir))|listo\s+el\s+trato)/i;

async function maybeHandleChatTruce(player, clean, { bridge, rcon, enforcer }) {
  const isResume = RESUME_INTENT_RE.test(clean);
  const isDuel = DUEL_INTENT_RE.test(clean);
  const isTrade = TRADE_INTENT_RE.test(clean);
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
const RULE_QUESTION_RE = /\b(?:puedo|puede|podemos|se\s+puede|permitid\w*|prohibid\w*|ley\w*|norma\w*|multa\w*|sanci[oó]n\w*|era\w*|pacto|monopolio\w*|aldean\w*|comando\w*|tasa|cambio|saldo\w*|precio\w*|c[eé]dula\w*|audit\w*|obra\w*|reliquia\w*|punt\w*|metro|tren\w*|riel\w*|granja\w*|nether|end|pvp|duelo|trato|pase|huevo\w*|semilla\w*|vaca\w*|pollo\w*|lore|cr[oó]nica\w*|historia)\b/i;
let lastDirectPregoneroAt = 0;
let lastDirectNpcAt = 0;

const NPC_CAST = [
  {
    id: 'juez',
    badge: 'Juez',
    badgeColor: 'gold',
    logName: 'Juez',
    re: /\b(?:su\s+excelencia|excelencia|su\s+se[ñn]or[ií]a|se[ñn]or\s+juez|juez|magistrad[oa]|tribunal)\b/i,
    stripRe: /\b(?:su\s+excelencia|excelencia|su\s+se[ñn]or[ií]a|se[ñn]or\s+juez|juez|magistrad[oa]|tribunal)\b[:,!\s]*/gi,
    buildPersona(clean) {
      const polite = JUDGE_HONORIFIC_RE.test(clean);
      return {
        polite,
        selfIdentity: 'TÚ eres Su Señoría, el Juez del Tribunal de Miscolandia.',
        roleDesc: polite
          ? 'Eres Su Señoría el Juez del Tribunal de Miscolandia. El jugador te trató con el respeto debido (Excelencia / Su Señoría / Señor Juez): respóndele con porte solemne, educado, justo y preciso, citando las leyes o normas pertinentes.'
          : 'Eres Su Señoría el Juez del Tribunal de Miscolandia, ¡y estás INDIGNADO porque el jugador NO te trató de "Excelencia", "Su Señoría" ni "Señor Juez"! Empieza regañándolo DE MALA FORMA con drama judicial por tutear al tribunal sin educación, y luego respóndele igual con precisión según <normativa_vigente>.',
        temperature: 0.45,
        extraRules: polite
          ? []
          : ['12. ¡OBLIGATORIO! Empieza tu respuesta quejándote con mal genio de que no te llamaron "Excelencia" ni "Señor Juez" antes de darle la respuesta.']
      };
    },
    buildContext(state, q, { bridge }) {
      const pact = bridge.getPactSummary(state, q);
      return [
        BOT_COMMANDS_DOC,
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
      return [
        BOT_COMMANDS_DOC,
        bridge.getEraExpectationsSummary(state),
        ...bridge.findOocContext(state, q),
        ...bridge.findRelevantNorms(state, q, { limit: 3, isJuez: false, includeOoc: true })
      ].filter(Boolean);
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

async function maybeHandleDirectNpc(player, clean, ctx) {
  const npc = detectAddressedNpc(clean);
  if (!npc) return false;
  if (Date.now() - lastDirectNpcAt < 3000) return true;
  if (aiBusy) return true;

  lastDirectNpcAt = Date.now();
  aiBusy = true;
  const { cfg, bridge, rcon, enforcer, memory } = ctx;
  try {
    const { state } = await bridge.fetchWorld(false);
    const role = enforcer.getPlayerRole(player, state);
    const stripped = clean
      .replace(/^(?:(?:ey|oye|hola|buenas|hey|che|oiga|disculpe|don)\s+)+/i, '')
      .replace(npc.stripRe, '')
      .trim();
    const query = stripped.length >= 3
      ? clean
      : `El jugador te llamó directamente ("${clean}") para saludar o saber qué hay de nuevo en tu área.`;

    const spec = npc.buildPersona(clean);
    const reply = await askNpc({
      config: cfg,
      mode: npc.id,
      roleDesc: spec.roleDesc,
      selfIdentity: spec.selfIdentity,
      extraRules: spec.extraRules || [],
      temperature: spec.temperature ?? 0.45,
      player,
      playerIdentity: buildPlayerIdentity(player, role, state, bridge),
      query,
      contextText: [farmLocksText(state, bridge), ...npc.buildContext(state, clean, ctx)].join('\n\n---\n\n'),
      chatHistoryText: memory?.getRecentChatText(10) || '',
      memoryText: memory?.getPersistentMemoryText({ maxSessions: 5, maxNotes: 10 }) || ''
    });

    if (reply?.respuesta_corta) {
      memory?.recordBotMessage(npc.logName, reply.respuesta_corta);
      await sendLine(rcon, '@a', npc.badge, npc.badgeColor, [
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
  } catch (err) {
    console.error(`[NPC ${npc.id}]`, err.message);
  } finally {
    aiBusy = false;
  }
  return true;
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

  if (aiBusy) return true;
  const { cfg, bridge, rcon, enforcer, memory } = ctx;
  aiBusy = true;
  try {
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
  } catch (err) {
    console.error('[DirectPregonero]', err.message);
  } finally {
    aiBusy = false;
  }
  return true;
}

async function handleNormalChat(player, message, ctx) {
  const { cfg, bridge, rcon, enforcer, memory } = ctx;
  const clean = String(message || '').trim();
  if (!clean) return;
  memory?.recordPlayerChat(player, clean);

  if (await maybeHandleChatTruce(player, clean, ctx)) return;
  if (await maybeHandleDirectNpc(player, clean, ctx)) return;
  if (await maybeHandleDirectPregonero(player, clean, ctx)) return;

  if (!isChatBanterEnabled(cfg)) return;
  const minLen = Number(cfg.social?.chatBanterMinLength ?? 8);
  if (clean.length < minLen) return;
  if (aiBusy) return;

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
  aiBusy = true;
  try {
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
  } catch (err) {
    console.error('[SocialChat]', err.message);
  } finally {
    aiBusy = false;
  }
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

  // Formato Vanilla: ]: <Jugador> mensaje   ó   ]: [Not Secure] <Jugador> mensaje
  const chatMatch = line.match(/^(?:\[Not Secure\]\s+)?<([A-Za-z0-9_]{1,16})>\s+(.+)$/);
  if (chatMatch) {
    const sender = chatMatch[1];
    const msg = chatMatch[2].trim();
    const prefix = ctx.cfg.prefix || '!';
    if (msg.startsWith(prefix)) {
      await handleChatCommand(sender, msg, ctx);
    } else {
      handleNormalChat(sender, msg, ctx);
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
      } else if (/(?:was slain by|was shot by|was blown up by|fell from|hit the ground|drowned|burned|went up in flames|tried to swim in lava|suffocated|starved|withered|killed|died)/i.test(rest)) {
        ctx.memory?.recordEvent('death', `${canonical} ${rest}`);
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
    || [joinSocial, leaveSocial, chatSocial, directSocial, testSocial].some(t => t.length > 195 || bannedRe.test(t) || lambonTestRe.test(t))
    || /como\s+(?:el\s+)?gobernante/i.test(directSocial)
    || /(?:el\s+tuyo|tu\s+estado\s+es\s+(?:el\s+)?mejor|nueva\s+alejandr[ií]a\s+es\s+(?:el\s+)?mejor)/i.test(directSocial)) {
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
  const impoliteQuery = 'juez que pasa si mato un aldeano sin querer?';
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
  console.log(`9a) NPC Juez (sin respeto) reply:`, impoliteRes);
  if (!impoliteRes.respuesta_corta || !/(?:excelencia|se[ñn]or[ií]a|se[ñn]or\s+juez|respeto|insolente|educaci[oó]n)/i.test(impoliteRes.respuesta_corta)) {
    throw new Error(`Se esperaba que el Juez regañara por falta de respeto: ${impoliteRes.respuesta_corta}`);
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
  if (!blindArqRes.respuesta_corta || !/(?:no\s+tengo\s+ojos|sin\s+ojos|no\s+(?:puedo|logro)\s+ver|no\s+veo|ciego|no\s+tengo\s+c[aá]mara)/i.test(blindArqRes.respuesta_corta)) {
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
  if (!blindSocial || !/(?:no\s+tengo\s+ojos|sin\s+ojos|no\s+(?:puedo|te\s+puedo|logro)\s+ver|no\s+veo|ciego|no\s+tengo\s+c[aá]mara)/i.test(blindSocial)) {
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

  const shutdown = () => {
    enforcer.stop();
    rcon.close();
    releaseSingleInstanceLock();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    const { rev, state } = await bridge.fetchWorld(true);
    const brief = bridge.getBriefing(state);
    const memStats = memory.getStats();
    console.log(`Moderador IA Miscolandia listo | Modelo: ${cfg.ollamaModel} | Supabase rev #${rev} (${brief.icTotal} normas IC, ${brief.eraCode}) | Memoria: ${memStats.sessionsCount} sesiones, ${memStats.notesCount} notas`);
  } catch (err) {
    console.warn('Aviso inicial Supabase (se reintentará en consultas):', err.message);
  }

  await enforcer.start().catch(err => console.warn('[Enforcer init]', err.message));
  const events = new WorldEvents({ cfg, bridge, rcon, enforcer, memory, statePath: path.join(SERVER_DIR, 'bot-events.json') });
  events.start();
  startLogWatcher(cfg, { cfg, bridge, rcon, enforcer, memory, events });
}

main().catch(err => {
  console.error('Error fatal en moderador:', err);
  process.exit(1);
});
