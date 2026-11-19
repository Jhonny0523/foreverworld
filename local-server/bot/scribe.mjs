const MC_COLOR_CODES = {
  '0': 'black',
  '1': 'dark_blue',
  '2': 'dark_green',
  '3': 'dark_aqua',
  '4': 'dark_red',
  '5': 'dark_purple',
  '6': 'gold',
  '7': 'gray',
  '8': 'dark_gray',
  '9': 'blue',
  a: 'green',
  b: 'aqua',
  c: 'red',
  d: 'light_purple',
  e: 'yellow',
  f: 'white'
};

export const COLOR_PALETTE_LIST = [
  { code: '&0', name: 'Negro', color: 'black' },
  { code: '&1', name: 'Azul osc', color: 'dark_blue' },
  { code: '&2', name: 'Verde osc', color: 'dark_green' },
  { code: '&3', name: 'Cian osc', color: 'dark_aqua' },
  { code: '&4', name: 'Rojo osc', color: 'dark_red' },
  { code: '&5', name: 'Morado', color: 'dark_purple' },
  { code: '&6', name: 'Dorado', color: 'gold' },
  { code: '&7', name: 'Gris', color: 'gray' },
  { code: '&8', name: 'Gris osc', color: 'dark_gray' },
  { code: '&9', name: 'Azul', color: 'blue' },
  { code: '&a', name: 'Verde', color: 'green' },
  { code: '&b', name: 'Aqua', color: 'aqua' },
  { code: '&c', name: 'Rojo', color: 'red' },
  { code: '&d', name: 'Rosa', color: 'light_purple' },
  { code: '&e', name: 'Amarillo', color: 'yellow' },
  { code: '&f', name: 'Blanco', color: 'white' }
];

const SAFE_PLAYER_RE = /^[A-Za-z0-9_]{1,16}$/;
const RCON_ERR_RE = /^(?:Unknown|Malformed|Expected|Incorrect|Invalid|No player|No entity|Can't|Nothing changed)/i;

export function stripFormatCodes(input) {
  return String(input ?? '')
    .replace(/[&§]#[0-9a-fA-F]{6}/g, '')
    .replace(/[&§][0-9a-fA-Fk-oK-OrR]/g, '');
}

function sameStyle(a, b) {
  return a.color === b.color
    && a.bold === b.bold
    && a.italic === b.italic
    && a.underlined === b.underlined
    && a.strikethrough === b.strikethrough
    && a.obfuscated === b.obfuscated;
}

export function parseFormattedText(input, { defaultColor = null, forceNonItalic = false, allowEscapedNewlines = false } = {}) {
  let src = String(input ?? '');
  if (allowEscapedNewlines) src = src.replace(/\\n/g, '\n');

  const emptyState = () => ({
    color: defaultColor || null,
    bold: false,
    italic: forceNonItalic ? false : null,
    underlined: false,
    strikethrough: false,
    obfuscated: false
  });

  let state = emptyState();
  let buf = '';
  const spans = [];

  const flush = () => {
    if (!buf) return;
    const comp = { text: buf };
    if (state.color) comp.color = state.color;
    if (state.bold) comp.bold = true;
    if (state.italic === true) comp.italic = true;
    else if (state.italic === false && forceNonItalic) comp.italic = false;
    if (state.underlined) comp.underlined = true;
    if (state.strikethrough) comp.strikethrough = true;
    if (state.obfuscated) comp.obfuscated = true;

    const prev = spans[spans.length - 1];
    if (prev && sameStyle(prev, comp)) {
      prev.text += comp.text;
    } else {
      spans.push(comp);
    }
    buf = '';
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if ((ch === '&' || ch === '§') && i + 1 < src.length) {
      const next = src[i + 1];
      if (next === '#' && /^[0-9a-fA-F]{6}/.test(src.slice(i + 2, i + 8))) {
        flush();
        const hex = src.slice(i + 2, i + 8).toLowerCase();
        state = {
          ...emptyState(),
          color: `#${hex}`
        };
        i += 7;
        continue;
      }
      const lower = next.toLowerCase();
      if (MC_COLOR_CODES[lower]) {
        flush();
        state = {
          ...emptyState(),
          color: MC_COLOR_CODES[lower]
        };
        i += 1;
        continue;
      }
      if (lower === 'l') { flush(); state.bold = true; i += 1; continue; }
      if (lower === 'o') { flush(); state.italic = true; i += 1; continue; }
      if (lower === 'n') { flush(); state.underlined = true; i += 1; continue; }
      if (lower === 'm') { flush(); state.strikethrough = true; i += 1; continue; }
      if (lower === 'k') { flush(); state.obfuscated = true; i += 1; continue; }
      if (lower === 'r') { flush(); state = emptyState(); i += 1; continue; }
    }
    buf += ch;
  }
  flush();

  return spans;
}

export function toSnbtString(str) {
  let out = '"';
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const ch = s[i];
    if (ch === '\\') out += '\\\\';
    else if (ch === '"') out += '\\"';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (code < 0x20) continue;
    else out += ch;
  }
  return out + '"';
}

export function componentToSnbt(comp) {
  const parts = [`text:${toSnbtString(comp.text || '')}`];
  if (comp.color) parts.push(`color:${toSnbtString(comp.color)}`);
  if (comp.bold) parts.push('bold:true');
  if (comp.italic === true) parts.push('italic:true');
  else if (comp.italic === false) parts.push('italic:false');
  if (comp.underlined) parts.push('underlined:true');
  if (comp.strikethrough) parts.push('strikethrough:true');
  if (comp.obfuscated) parts.push('obfuscated:true');
  return `{${parts.join(',')}}`;
}

export function componentsToPageSnbt(comps, { forceNonItalic = false } = {}) {
  if (!comps || !comps.length) {
    return forceNonItalic ? '{text:"",italic:false}' : '{text:""}';
  }
  if (comps.length === 1) {
    return componentToSnbt(comps[0]);
  }
  const head = forceNonItalic ? 'text:"",italic:false' : 'text:""';
  return `{${head},extra:[${comps.map(componentToSnbt).join(',')}]}`;
}

export function buildItemNameSnbt(raw, fallbackColor = 'gold') {
  const clean = String(raw || '').trim() || 'Certificado Oficial';
  const hasExplicitLeadingColor = /^[&§](?:[0-9a-fA-F]|#[0-9a-fA-F]{6})/.test(clean);
  const comps = parseFormattedText(clean, {
    defaultColor: hasExplicitLeadingColor ? null : fallbackColor,
    forceNonItalic: true,
    allowEscapedNewlines: false
  });
  return componentsToPageSnbt(comps, { forceNonItalic: true });
}

function readSnbtQuotedString(src, startIdx) {
  const quote = src[startIdx];
  let out = '';
  let i = startIdx + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < src.length) {
      const next = src[i + 1];
      if (next === 'n') { out += '\n'; i += 2; continue; }
      if (next === 'r') { out += '\r'; i += 2; continue; }
      if (next === 't') { out += '\t'; i += 2; continue; }
      if (next === '\\' || next === '"' || next === "'") { out += next; i += 2; continue; }
      if (next === 'u' && /^[0-9a-fA-F]{4}/.test(src.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      out += next;
      i += 2;
      continue;
    }
    if (ch === quote) {
      return { value: out, nextIdx: i + 1 };
    }
    out += ch;
    i += 1;
  }
  return { value: out, nextIdx: src.length };
}

function skipWs(src, idx) {
  while (idx < src.length && /\s/.test(src[idx])) idx += 1;
  return idx;
}

function skipSnbtValue(src, idx) {
  idx = skipWs(src, idx);
  if (idx >= src.length) return idx;
  const ch = src[idx];
  if (ch === '"' || ch === "'") return readSnbtQuotedString(src, idx).nextIdx;
  if (ch === '{' || ch === '[') {
    const closeCh = ch === '{' ? '}' : ']';
    let depth = 1;
    let i = idx + 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === '"' || c === "'") {
        i = readSnbtQuotedString(src, i).nextIdx;
        continue;
      }
      if (c === ch) depth += 1;
      else if (c === closeCh) depth -= 1;
      i += 1;
    }
    return i;
  }
  let i = idx;
  while (i < src.length && !/[,}\]]/.test(src[i])) i += 1;
  return i;
}

function extractRawFieldFromCompound(src, startIdx) {
  let i = skipWs(src, startIdx + 1);
  let rawText = null;
  while (i < src.length) {
    i = skipWs(src, i);
    if (src[i] === '}') return { text: rawText ?? '', nextIdx: i + 1 };
    let key = '';
    if (src[i] === '"' || src[i] === "'") {
      const parsedKey = readSnbtQuotedString(src, i);
      key = parsedKey.value;
      i = parsedKey.nextIdx;
    } else {
      const kStart = i;
      while (i < src.length && /[A-Za-z0-9_.-]/.test(src[i])) i += 1;
      key = src.slice(kStart, i);
    }
    i = skipWs(src, i);
    if (src[i] === ':') i = skipWs(src, i + 1);
    if (key === 'raw' && (src[i] === '"' || src[i] === "'")) {
      const val = readSnbtQuotedString(src, i);
      rawText = val.value;
      i = val.nextIdx;
    } else if ((key === 'text' || key === 'filtered') && rawText === null && (src[i] === '"' || src[i] === "'")) {
      const val = readSnbtQuotedString(src, i);
      rawText = val.value;
      i = val.nextIdx;
    } else {
      i = skipSnbtValue(src, i);
    }
    i = skipWs(src, i);
    if (src[i] === ',') i += 1;
  }
  return { text: rawText ?? '', nextIdx: src.length };
}

export function extractSelectedWritableBook(rconReply) {
  const txt = String(rconReply || '');
  if (!/id:\s*["']minecraft:writable_book["']/.test(txt)) {
    return { isWritableBook: false, count: 0, pages: [] };
  }
  const countMatch = txt.match(/\bcount:\s*(\d+)/);
  const count = countMatch ? Math.max(1, Number(countMatch[1])) : 1;

  const contentIdx = txt.indexOf('writable_book_content');
  if (contentIdx < 0) {
    return { isWritableBook: true, count, pages: [] };
  }
  const sliceAfterContent = txt.slice(contentIdx);
  const pagesMatch = sliceAfterContent.match(/pages:\s*\[/);
  if (!pagesMatch) {
    return { isWritableBook: true, count, pages: [] };
  }

  let i = contentIdx + pagesMatch.index + pagesMatch[0].length;
  const pages = [];
  while (i < txt.length) {
    i = skipWs(txt, i);
    if (i >= txt.length || txt[i] === ']') break;
    if (txt[i] === '"' || txt[i] === "'") {
      const parsed = readSnbtQuotedString(txt, i);
      pages.push(parsed.value);
      i = parsed.nextIdx;
    } else if (txt[i] === '{') {
      const parsed = extractRawFieldFromCompound(txt, i);
      pages.push(parsed.text);
      i = parsed.nextIdx;
    } else {
      i = skipSnbtValue(txt, i);
    }
    i = skipWs(txt, i);
    if (txt[i] === ',') i += 1;
  }

  return { isWritableBook: true, count, pages };
}

export function buildWrittenBookComponents({ titleRaw, author, pagesRaw, loreLines = [] }) {
  const cleanTitle = stripFormatCodes(titleRaw).replace(/[\r\n]+/g, ' ').trim().slice(0, 32) || 'Certificado Oficial';
  const safeAuthor = String(author || 'NotOutContext').trim().slice(0, 32) || 'NotOutContext';
  const customNameSnbt = buildItemNameSnbt(titleRaw || '&6&lCertificado Oficial', 'gold');

  const finalLore = loreLines.length
    ? loreLines
    : ['&bArchivo Nacional de Miscolandia', `&7Sellado por ${safeAuthor}`];
  const loreSnbt = `[${finalLore.map(line => buildItemNameSnbt(line, 'gray')).join(',')}]`;

  const pages = (Array.isArray(pagesRaw) && pagesRaw.length ? pagesRaw : [''])
    .slice(0, 50)
    .map(p => componentsToPageSnbt(parseFormattedText(p, { allowEscapedNewlines: true })));

  const contentHeader = `title:${toSnbtString(cleanTitle)},author:${toSnbtString(safeAuthor)},generation:0,resolved:true`;
  const giveItemArg = `minecraft:written_book[minecraft:custom_name=${customNameSnbt},minecraft:lore=${loreSnbt},minecraft:written_book_content={${contentHeader},pages:[${pages.join(',')}]}]`;
  const headerComponentsSnbt = `{"minecraft:custom_name":${customNameSnbt},"minecraft:lore":${loreSnbt},"minecraft:written_book_content":{${contentHeader},pages:[]}}`;

  return {
    plainTitle: cleanTitle,
    giveItemArg,
    headerComponentsSnbt,
    pageSnbtList: pages
  };
}

export function buildColoredPaperItemArg({ nameRaw, loreRaw = '' }) {
  const customNameSnbt = buildItemNameSnbt(nameRaw || '&6&lSello Oficial', 'gold');
  const loreLines = String(loreRaw || '').trim()
    ? String(loreRaw).split('||').map(s => s.trim()).filter(Boolean).slice(0, 4)
    : ['&7Archivo Nacional de Miscolandia'];
  const loreSnbt = `[${loreLines.map(l => buildItemNameSnbt(l, 'gray')).join(',')}]`;
  return `minecraft:paper[minecraft:custom_name=${customNameSnbt},minecraft:lore=${loreSnbt}]`;
}

export function buildCertificatePreset(presetKey, restText, author) {
  const key = String(presetKey || '').toLowerCase();
  const parts = String(restText || '').split('|').map(s => s.trim());
  const signer = String(author || 'NotOutContext').trim();

  if (key === 'aval') {
    const norma = parts[0] || 'Norma de Miscolandia';
    const nota = parts[1] || 'Cumple TRD y lenguaje claro';
    return {
      titleRaw: `&6&lAval · ${stripFormatCodes(norma).slice(0, 22)}`,
      loreLines: ['&bArchivo Nacional · TRD 110-04', `&7Avalado por ${signer}`],
      pagesRaw: [
        `&6&l=================\n  &2&lCERTIFICADO DE AVAL\n&6&l=================\n\n&0Norma:\n&1&l${norma}\n\n&0Observación:\n&8${nota}\n\n&5Estado: &2&lAVALADA Y SELLADA\n&8Ref: Circular 004 · TRD 110-04`
      ]
    };
  }
  if (key === 'obra') {
    const obra = parts[0] || 'Obra Pública';
    const pts = parts[1] || '10 pts';
    const estado = parts[2] || 'APROBADA';
    return {
      titleRaw: `&2&lAuditoría · ${stripFormatCodes(obra).slice(0, 17)}`,
      loreLines: ['&bManual 003 · TRD 120-01', `&7Auditor: ${signer}`],
      pagesRaw: [
        `&2&l=================\n   &6&lACTA DE AUDITORÍA\n&2&l=================\n\n&0Obra:\n&1&l${obra}\n\n&0Avalúo final: &2&l${pts}\n&0Dictamen: &6&l${estado}\n\n&8Con arreglo al Manual 003\n&8Serie TRD 120-01`
      ]
    };
  }
  if (key === 'residencia') {
    const target = parts[0] || 'Visitante';
    const nacion = parts[1] || 'Miscolandia';
    return {
      titleRaw: `&b&lResidencia · ${stripFormatCodes(target).slice(0, 17)}`,
      loreLines: ['&bLey 003 · TRD 110-02', `&7Expedido por ${signer}`],
      pagesRaw: [
        `&3&l=================\n &b&lCARTA DE RESIDENCIA\n&3&l=================\n\n&0Titular:\n&1&l${target}\n\n&0Territorio anfitrión:\n&2&l${nacion}\n\n&8Tarifa oficial: 5 OE\n&8Ley 003 · Resolución 002`
      ]
    };
  }
  if (key === 'paz') {
    const target = parts[0] || 'Ciudadano';
    const motivo = parts[1] || 'Obligaciones cumplidas';
    return {
      titleRaw: `&a&lPaz y Salvo · ${stripFormatCodes(target).slice(0, 16)}`,
      loreLines: ['&bResolución 005 · TRD 100-02', `&7Archivista: ${signer}`],
      pagesRaw: [
        `&2&l=================\n    &a&lPAZ Y SALVO\n&2&l=================\n\n&0A favor de:\n&1&l${target}\n\n&0Concepto:\n&8${motivo}\n\n&2&lCUMPLIDO SIN PENDIENTES\n&8Resolución 005 · Archivo`
      ]
    };
  }
  return null;
}

export async function deliverWrittenBook(rcon, player, bookSpec, { replaceMainHand = false } = {}) {
  if (!SAFE_PLAYER_RE.test(player)) throw new Error(`Jugador inválido: ${player}`);

  const directCmd = replaceMainHand
    ? `item replace entity ${player} weapon.mainhand with ${bookSpec.giveItemArg} 1`
    : `give ${player} ${bookSpec.giveItemArg} 1`;

  if (Buffer.byteLength(directCmd, 'utf8') <= 1380) {
    const res = await rcon.send(directCmd);
    if (RCON_ERR_RE.test(String(res || '').trim())) {
      throw new Error(`Error entregando libro: ${res}`);
    }
  } else {
    const tag = `fw_cert_${Date.now().toString(36)}`;
    const summonRes = await rcon.send(
      `execute at ${player} run summon minecraft:item ~ ~0.2 ~ {Tags:["${tag}"],PickupDelay:20s,Item:{id:"minecraft:written_book",count:1,components:${bookSpec.headerComponentsSnbt}}}`
    );
    if (RCON_ERR_RE.test(String(summonRes || '').trim())) {
      throw new Error(`Error creando certificado multipágina: ${summonRes}`);
    }
    try {
      for (const pageSnbt of bookSpec.pageSnbtList) {
        const modRes = await rcon.send(
          `data modify entity @e[tag=${tag},limit=1] Item.components."minecraft:written_book_content".pages append value ${pageSnbt}`
        );
        if (RCON_ERR_RE.test(String(modRes || '').trim())) {
          throw new Error(`Error agregando página: ${modRes}`);
        }
      }
      await rcon.send(`data modify entity @e[tag=${tag},limit=1] PickupDelay set value 0s`);
      await rcon.send(`tp @e[tag=${tag},limit=1] ${player}`);
    } catch (err) {
      await rcon.send(`kill @e[tag=${tag}]`).catch(() => {});
      throw err;
    }
  }

  await rcon.send(`execute at ${player} run playsound minecraft:block.enchantment_table.use master ${player} ~ ~ ~ 0.8 1.2`).catch(() => {});
}
