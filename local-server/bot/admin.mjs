import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { RconClient } from './rcon.mjs';
import { AdminGenie, extractAdminWish, sanitizeRconCommand } from './admin-genie.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(SERVER_DIR, 'moderator-config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Falta ${CONFIG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function printHelp() {
  console.log([
    '',
    'Comandos de Consola Admin IA:',
    '  !admin <peticion libre>  (o escribe la peticion directamente sin !admin)',
    '  Ejemplo: !admin que el servidor se cierre en 10 segundos y aparezca un contador',
    '  Ejemplo: haz de dia, quita la lluvia y regala 2 galletas doradas a todos',
    '  Ejemplo: cancela el contador',
    '  /<comando vanilla>       Ejecuta un comando directo de Minecraft por RCON',
    '  estado                   Muestra jugadores conectados y estado RCON',
    '  salir                    Cierra esta consola (sin apagar el servidor)',
    ''
  ].join('\n'));
}

async function runInput(line, genie, rcon, { waitTimers = true, dryRun = false } = {}) {
  const raw = String(line || '').trim();
  if (!raw) return 'continue';
  const low = raw.toLowerCase();

  if (['salir', 'exit', 'quit'].includes(low)) return 'exit';
  if (['ayuda', 'help', '?'].includes(low)) {
    printHelp();
    return 'continue';
  }
  if (low === 'estado' || low === 'status') {
    try {
      const listRes = await rcon.send('list');
      console.log(`[Estado] ${listRes}`);
      console.log(`[Estado] Contador activo: ${genie.hasActiveCountdown() ? 'SI' : 'NO'}`);
    } catch (err) {
      console.error('[Estado error]', err.message);
    }
    return 'continue';
  }
  if (raw.startsWith('/')) {
    const cmd = sanitizeRconCommand(raw);
    if (!cmd) return 'continue';
    try {
      const res = await rcon.send(cmd);
      console.log(`[RCON] ${res || '(OK sin salida)'}`);
    } catch (err) {
      console.error(`[RCON error] ${err.message}`);
    }
    return 'continue';
  }

  const parsedWish = extractAdminWish(raw);
  const wish = parsedWish !== null ? parsedWish : raw;
  const res = await genie.fulfill(wish, { dryRun });
  console.log(`[Genio Admin] ${res.respuesta_consola}`);
  if (dryRun) {
    console.log('[Dry-Run Pasos]', JSON.stringify(res.pasos, null, 2));
    return 'continue';
  }
  if (waitTimers) {
    await res.completionPromise;
  }
  return 'continue';
}

async function main() {
  const cfg = loadConfig();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const textArgs = args.filter(a => a !== '--dry-run');

  const rcon = new RconClient({
    host: cfg.rconHost || '25.45.82.35',
    port: cfg.rconPort || 25575,
    password: cfg.rconPassword || '',
    timeoutMs: 6000
  });
  const genie = new AdminGenie({ cfg, rcon });

  const shutdown = () => {
    genie.stopAll();
    rcon.close();
  };
  process.on('SIGINT', () => {
    shutdown();
    process.exit(0);
  });

  if (textArgs.length) {
    try {
      await runInput(textArgs.join(' '), genie, rcon, { waitTimers: true, dryRun });
    } finally {
      shutdown();
    }
    return;
  }

  console.log('================================================================');
  console.log('  Consola Admin IA Miscolandia (!admin) · conectada por RCON');
  console.log(`  Modelo: ${cfg.ollamaModel} · Servidor: ${cfg.rconHost || '25.45.82.35'}:${cfg.rconPort || 25575}`);
  console.log('================================================================');
  try {
    const online = await rcon.send('list');
    console.log(`[Conectado] ${online}`);
  } catch (err) {
    console.warn(`[Aviso RCON] ${err.message}`);
  }
  printHelp();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Miscolandia Admin > '
  });
  rl.prompt();

  rl.on('line', async line => {
    rl.pause();
    try {
      const action = await runInput(line, genie, rcon, { waitTimers: false, dryRun });
      if (action === 'exit') {
        rl.close();
        return;
      }
    } catch (err) {
      console.error('[Error Admin]', err.message);
    }
    rl.resume();
    rl.prompt();
  });

  rl.on('close', () => {
    shutdown();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Error fatal en consola admin:', err.message);
  process.exit(1);
});
