// Consola Admin IA de Miscolandia: interpreta deseos libres (!admin ...)
// desde consola/RCON y los ejecuta en Minecraft Java 26.4 con pasos diferidos y contadores.

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

function normalizePlan(rawPlan, wish) {
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
    return JSON.parse(stripped.slice(first, last + 1));
  }
  throw new Error(`No se pudo parsear plan admin JSON: ${txt.slice(0, 140)}`);
}

export async function planAdminWish({ config, wish, onlinePlayers = [] }) {
  const clean = String(wish || '').trim();
  if (!clean) {
    return {
      resumen: 'Sin instrucción',
      respuesta_consola: 'Escribe lo que quieras después de !admin (ej. "!admin cierra el servidor en 10 segundos con contador").',
      anuncio_chat: '',
      pasos: []
    };
  }

  // Cancelación inmediata sin esperar al LLM
  if (CANCEL_RE.test(clean)) {
    return deterministicFallbackPlan(clean);
  }

  const systemPrompt = [
    'Eres el Genio Administrador del servidor Minecraft Java Edition 26.4-snapshot-10 (Miscolandia: MythStorm, Scadrial0523 y NotOutContext).',
    'El dueño del servidor te da caprichos o instrucciones administrativas por consola y TÚ debes traducirlas a un plan JSON ejecutable con comandos 100% válidos de Minecraft Vanilla 26.4.',
    'REGLAS DE SINTAXIS VANILLA 26.4 (MUY IMPORTANTE):',
    '1. En "comando" NO pongas barra inicial "/". Ej: "time set day", NO "/time set day".',
    '2. Es servidor Vanilla sin plugins (no existe /fly, /god, /home, /tpa, /broadcast, /countdown). Usa comandos nativos: time, weather, tp, give, effect, summon, title, tellraw, playsound, particle, gamerule, difficulty, gamemode, xp, clear, bossbar, save-all, stop, list, whitelist, ban, pardon, kick, scoreboard.',
    '3. Si piden ítems con nombre personalizado o lore en 1.21+/26.4, usa componentes: give @a minecraft:cookie[minecraft:custom_name={text:"Galleta Real",color:"gold",bold:true,italic:false}] 3. NUNCA uses sintaxis vieja {display:{Name:...}}.',
    '4. Para fuegos artificiales divertidos: execute as @a at @s run summon minecraft:firework_rocket ~ ~1 ~ {LifeTime:20,FireworksItem:{id:"minecraft:firework_rocket",count:1,components:{"minecraft:fireworks":{flight_duration:1,explosions:[{shape:"large_ball",colors:[I;16755200,5636095],flicker:true}]}}}}',
    '5. Para sonidos: execute as @a at @s run playsound minecraft:entity.player.levelup master @s ~ ~ ~ 0.9 1',
    '6. SI PIDEN CUENTA REGRESIVA, CONTADOR O QUE ALGO PASE EN N SEGUNDOS CON CONTEO (ej. cerrar/apagar/explotar/celebrar en 10s con contador): USA SIEMPRE UN SOLO PASO tipo:"countdown" (con segundos, titulo, subtitulo con "{s}", color, bossbar:true, mensaje_final, y comandos_finales como ["save-all","stop"] si cierra el servidor). NO generes 10 comandos title sueltos.',
    '7. Si piden cancelar un contador o cierre: usa tipo:"cancel_countdown".',
    '8. Si solo es un mensaje o anuncio al chat/pantalla: usa tipo:"broadcast" (pantalla:true si es título grande).',
    '9. Cumple exactamente el capricho pedido; no inventes castigos o explosiones si no los pidieron.',
    '10. Devuelve JSON válido con resumen, respuesta_consola, anuncio_chat y pasos.'
  ].join('\n');

  const userPrompt = [
    `Jugadores conectados actualmente: ${onlinePlayers.length ? onlinePlayers.join(', ') : 'ninguno (usa @a si aplica a todos)'}`,
    `Petición del administrador: ${clean}`
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    const res = await fetch(`${config.ollamaUrl.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ollamaModel,
        stream: false,
        think: false,
        keep_alive: config.ollamaKeepAlive || '10m',
        format: ADMIN_PLAN_SCHEMA,
        options: {
          temperature: 0.2,
          num_predict: 600,
          num_ctx: 8192
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const parsed = parseJsonSafe(data?.message?.content ?? '');
    const normalized = normalizePlan(parsed, clean);
    if (!normalized.pasos.length) {
      const fb = deterministicFallbackPlan(clean);
      if (fb) return normalizePlan(fb, clean);
    }
    return normalized;
  } catch (err) {
    const fb = deterministicFallbackPlan(clean);
    if (fb) return normalizePlan(fb, clean);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export class AdminGenie {
  constructor({ cfg, rcon, onLog = console.log, onBeforeStop = null, tickMs = 1000 } = {}) {
    this.cfg = cfg;
    this.rcon = rcon;
    this.onLog = onLog;
    this.onBeforeStop = onBeforeStop;
    this.tickMs = Math.max(10, Number(tickMs) || 1000);
    this.activeCountdown = null;
    this.pendingTimers = new Set();
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
      if (/^(?:Unknown|Incorrect|Expected|Malformed|Invalid|No entity|No player|Can't)/i.test(String(res || '').trim())) {
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
      await this._safeSend(step.comando, errors);
      return;
    }
    if (step.tipo === 'countdown') {
      await this._runCountdown(step, errors);
    }
  }

  async fulfill(wish, { dryRun = false, onlinePlayers = null } = {}) {
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

    const plan = await planAdminWish({ config: this.cfg, wish, onlinePlayers: players });
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
