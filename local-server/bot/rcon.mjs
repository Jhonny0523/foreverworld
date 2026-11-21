import net from 'node:net';

const SERVERDATA_RESPONSE_VALUE = 0;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_AUTH = 3;

function encodePacket(id, type, body) {
  const bodyBuf = Buffer.from(String(body ?? ''), 'utf8');
  const len = 4 + 4 + bodyBuf.length + 2;
  const buf = Buffer.allocUnsafe(4 + len);
  buf.writeInt32LE(len, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf.writeUInt16LE(0, 12 + bodyBuf.length);
  return buf;
}

const MAX_COMMAND_BYTES = 1400;

// Divide los componentes de un tellraw en líneas (por "\n") y las agrupa en lotes que quepan.
function splitTellraw(components, cmdFor) {
  const items = (Array.isArray(components) ? components : [components]).filter(c => c !== '');
  const lines = [[]];
  for (const c of items) {
    if (c && typeof c === 'object' && typeof c.text === 'string' && c.text.includes('\n')) {
      const parts = c.text.split('\n');
      parts.forEach((t, i) => {
        if (i > 0) lines.push([]);
        if (t) lines[lines.length - 1].push({ ...c, text: t });
      });
    } else {
      lines[lines.length - 1].push(c);
    }
  }
  const fits = comps => Buffer.byteLength(cmdFor(comps), 'utf8') <= MAX_COMMAND_BYTES;
  const batches = [];
  let cur = [];
  const flush = () => { if (cur.length) batches.push(['', ...cur]); cur = []; };
  for (const line of lines.filter(l => l.length)) {
    const trial = cur.length ? [...cur, { text: '\n' }, ...line] : [...line];
    if (fits(['', ...trial])) { cur = trial; continue; }
    flush();
    if (fits(['', ...line])) { cur = [...line]; continue; }
    // Una sola línea demasiado larga: se corta su texto en pedazos
    for (const c of line) {
      const text = typeof c === 'object' && typeof c.text === 'string' ? c.text : String(c);
      for (let i = 0; i < text.length; i += 400) {
        batches.push(['', typeof c === 'object' ? { ...c, text: text.slice(i, i + 400) } : text.slice(i, i + 400)]);
      }
    }
  }
  flush();
  return batches;
}

export class RconClient {
  constructor({ host = '127.0.0.1', port = 25575, password = '', timeoutMs = 5000 } = {}) {
    this.host = host;
    this.port = Number(port) || 25575;
    this.password = String(password ?? '');
    this.timeoutMs = timeoutMs;
    this.socket = null;
    this.authenticated = false;
    this.nextId = 1;
    this.rxBuf = Buffer.alloc(0);
    this.pending = new Map();
    this.connectPromise = null;
    this.queue = Promise.resolve();
  }

  _reset(err) {
    this.authenticated = false;
    this.connectPromise = null;
    this.rxBuf = Buffer.alloc(0);
    if (this.socket) {
      try { this.socket.destroy(); } catch {}
      this.socket = null;
    }
    for (const [, waiter] of this.pending) {
      clearTimeout(waiter.timer);
      waiter.reject(err || new Error('RCON connection closed'));
    }
    this.pending.clear();
  }

  _onData(chunk) {
    this.rxBuf = Buffer.concat([this.rxBuf, chunk]);
    while (this.rxBuf.length >= 4) {
      const packetLen = this.rxBuf.readInt32LE(0);
      if (packetLen < 10 || packetLen > 65536) {
        this._reset(new Error(`Invalid RCON packet length: ${packetLen}`));
        return;
      }
      if (this.rxBuf.length < 4 + packetLen) break;

      const frame = this.rxBuf.subarray(4, 4 + packetLen);
      this.rxBuf = this.rxBuf.subarray(4 + packetLen);

      const id = frame.readInt32LE(0);
      const type = frame.readInt32LE(4);
      const body = frame.subarray(8, Math.max(8, packetLen - 2)).toString('utf8');

      const exact = this.pending.get(id);
      if (exact && (exact.expectType === null || exact.expectType === type)) {
        this.pending.delete(id);
        clearTimeout(exact.timer);
        exact.resolve({ id, type, body });
      } else if (id === -1 && type === SERVERDATA_AUTH_RESPONSE) {
        for (const [key, waiter] of this.pending) {
          if (waiter.expectType === SERVERDATA_AUTH_RESPONSE) {
            this.pending.delete(key);
            clearTimeout(waiter.timer);
            waiter.resolve({ id: -1, type, body });
            break;
          }
        }
      }
    }
  }

  _sendRaw(type, body, expectType = null) {
    const id = this.nextId++;
    if (this.nextId > 0x7ffffff0) this.nextId = 1;
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        return reject(new Error('RCON socket not connected'));
      }
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RCON timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, expectType });
      this.socket.write(encodePacket(id, type, body));
    });
  }

  async connect() {
    if (this.socket && !this.socket.destroyed && this.authenticated) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      await new Promise((resolve, reject) => {
        const sock = net.createConnection({ host: this.host, port: this.port });
        const timer = setTimeout(() => {
          sock.destroy();
          reject(new Error(`RCON connect timeout (${this.host}:${this.port})`));
        }, this.timeoutMs);
        sock.once('connect', () => {
          clearTimeout(timer);
          this.socket = sock;
          sock.on('data', d => this._onData(d));
          sock.on('error', err => this._reset(err));
          sock.on('close', () => this._reset(new Error('RCON socket closed')));
          resolve();
        });
        sock.once('error', err => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const authRes = await this._sendRaw(SERVERDATA_AUTH, this.password, SERVERDATA_AUTH_RESPONSE);
      if (authRes.id === -1) {
        this._reset(new Error('RCON authentication failed (wrong rcon.password)'));
        throw new Error('RCON authentication failed (wrong rcon.password)');
      }
      this.authenticated = true;
    })();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async send(command) {
    if (Buffer.byteLength(String(command ?? ''), 'utf8') > 1446) {
      // Mandarlo tumbaría la conexión RCON; mejor fallar solo este comando
      return Promise.reject(new Error(`Comando RCON demasiado largo (${Buffer.byteLength(String(command), 'utf8')} bytes)`));
    }
    const run = async () => {
      try {
        await this.connect();
        const res = await this._sendRaw(SERVERDATA_EXECCOMMAND, command, SERVERDATA_RESPONSE_VALUE);
        return res.body;
      } catch (err) {
        this._reset(err);
        // Un reintento automático solo si el socket se cayó. Si fue un timeout, el servidor pudo
        // haber ejecutado el comando igual (lag): reenviarlo duplicaría un "give" o un "clear".
        const msg = String(err.message);
        if (!msg.includes('authentication') && !msg.includes('timeout')) {
          await this.connect();
          const res = await this._sendRaw(SERVERDATA_EXECCOMMAND, command, SERVERDATA_RESPONSE_VALUE);
          return res.body;
        }
        throw err;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => {});
    return next;
  }

  // El RCON de Minecraft corta la conexión si un comando pasa de ~1460 bytes.
  // Los mensajes largos se reparten en varios tellraw, cortando por saltos de línea.
  async tellraw(target, components) {
    const safeTarget = /^[A-Za-z0-9_]{1,16}$|^@[aeprs](\[.*\])?$/.test(target) ? target : '@a';
    const cmdFor = comps => `tellraw ${safeTarget} ${JSON.stringify(comps)}`;
    if (Buffer.byteLength(cmdFor(components), 'utf8') <= MAX_COMMAND_BYTES) {
      return this.send(cmdFor(components));
    }
    const out = [];
    for (const batch of splitTellraw(components, cmdFor)) {
      out.push(await this.send(cmdFor(batch)));
    }
    return out.join('\n');
  }

  close() {
    this._reset(new Error('RCON closed by client'));
  }
}
