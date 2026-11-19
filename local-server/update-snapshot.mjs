import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const VER_FILE = path.join(__dirname, 'snapshot-version.json');
const JAR_FILE = path.join(__dirname, 'server.jar');
const BAK_FILE = path.join(__dirname, 'server.jar.bak');
const TMP_FILE = path.join(__dirname, 'server.jar.tmp');

async function main() {
  let current = null;
  if (fs.existsSync(VER_FILE)) {
    try { current = JSON.parse(fs.readFileSync(VER_FILE, 'utf8')); } catch {}
  }

  console.log('Consultando manifest oficial de Mojang...');
  const manifestRes = await fetch(MANIFEST_URL);
  if (!manifestRes.ok) throw new Error(`HTTP ${manifestRes.status} consultando manifest`);
  const manifest = await manifestRes.json();
  const targetId = manifest?.latest?.snapshot;
  if (!targetId) throw new Error('No se encontró latest.snapshot en el manifest.');

  const entry = (manifest.versions || []).find(v => v.id === targetId);
  if (!entry?.url) throw new Error(`No se encontró URL para snapshot ${targetId}`);

  const metaRes = await fetch(entry.url);
  if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status} leyendo metadatos de ${targetId}`);
  const meta = await metaRes.json();

  const srv = meta?.downloads?.server;
  if (!srv?.url || !srv?.sha1 || !srv?.size) {
    throw new Error(`Metadatos de servidor incompletos para ${targetId}`);
  }

  const javaMajor = Number(meta?.javaVersion?.majorVersion || 25);
  if (javaMajor > 25) {
    console.warn(`[AVISO] Esta snapshot requiere Java ${javaMajor} (superior a Java 25). Verifica tu runtime antes de iniciar.`);
  }

  if (current && current.id === targetId && current.sha1 === srv.sha1 && fs.existsSync(JAR_FILE)) {
    console.log(`Ya tienes la última snapshot instalada: ${targetId} (${srv.sha1}).`);
    return;
  }

  console.log(`Descargando ${targetId} (${Math.round(srv.size / 1024 / 1024)} MB)...`);
  const jarRes = await fetch(srv.url);
  if (!jarRes.ok) throw new Error(`HTTP ${jarRes.status} descargando server.jar`);
  const buf = Buffer.from(await jarRes.arrayBuffer());

  if (buf.length !== srv.size) {
    throw new Error(`Tamaño incorrecto: esperado ${srv.size}, recibido ${buf.length}`);
  }
  const actualSha1 = crypto.createHash('sha1').update(buf).digest('hex').toLowerCase();
  if (actualSha1 !== srv.sha1.toLowerCase()) {
    throw new Error(`SHA-1 inválido: esperado ${srv.sha1}, recibido ${actualSha1}`);
  }

  fs.writeFileSync(TMP_FILE, buf);
  if (fs.existsSync(JAR_FILE)) {
    fs.copyFileSync(JAR_FILE, BAK_FILE);
  }
  fs.renameSync(TMP_FILE, JAR_FILE);

  const nextInfo = {
    id: meta.id,
    releaseTime: meta.releaseTime,
    sha1: srv.sha1,
    javaMajor
  };
  fs.writeFileSync(VER_FILE, JSON.stringify(nextInfo, null, 2) + '\n', 'utf8');
  console.log(`Actualizado correctamente a ${meta.id} (respaldo anterior en server.jar.bak).`);
}

main().catch(err => {
  console.error('Error actualizando snapshot:', err);
  process.exit(1);
});
