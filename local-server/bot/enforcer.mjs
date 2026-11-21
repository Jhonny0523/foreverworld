import fs from 'node:fs';
import path from 'node:path';
import { generateRoast } from './ollama.mjs';

const FLOWER_ITEMS = [
  'dandelion', 'golden_dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet',
  'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy',
  'cornflower', 'lily_of_the_valley', 'wither_rose', 'torchflower', 'spore_blossom',
  'sunflower', 'lilac', 'rose_bush', 'peony', 'pitcher_plant', 'pink_petals',
  'wildflowers', 'cactus_flower', 'open_eyeblossom', 'closed_eyeblossom'
];
const DYE_ITEMS = [
  'white_dye', 'orange_dye', 'magenta_dye', 'light_blue_dye', 'yellow_dye',
  'lime_dye', 'pink_dye', 'gray_dye', 'light_gray_dye', 'cyan_dye', 'purple_dye',
  'blue_dye', 'brown_dye', 'green_dye', 'red_dye', 'black_dye'
];

const OBJECTIVES = [
  // Agricultura, flores, cactus, tintes y abejas (monopolio de MythStorm / Nueva Alejandría)
  ['fw_m_wheat', 'minecraft.mined:minecraft.wheat'],
  ['fw_m_carrot', 'minecraft.mined:minecraft.carrots'],
  ['fw_m_potato', 'minecraft.mined:minecraft.potatoes'],
  ['fw_m_beet', 'minecraft.mined:minecraft.beetroots'],
  ['fw_m_cane', 'minecraft.mined:minecraft.sugar_cane'],
  ['fw_m_melon', 'minecraft.mined:minecraft.melon'],
  ['fw_m_pump', 'minecraft.mined:minecraft.pumpkin'],
  ['fw_m_berry', 'minecraft.mined:minecraft.sweet_berry_bush'],
  ['fw_m_grass', 'minecraft.mined:minecraft.short_grass'],
  ['fw_m_tgrass', 'minecraft.mined:minecraft.tall_grass'],
  ['fw_m_nwart', 'minecraft.mined:minecraft.nether_wart'],
  ['fw_u_wseed', 'minecraft.used:minecraft.wheat_seeds'],
  ['fw_u_bseed', 'minecraft.used:minecraft.beetroot_seeds'],
  ['fw_u_pseed', 'minecraft.used:minecraft.pumpkin_seeds'],
  ['fw_u_mseed', 'minecraft.used:minecraft.melon_seeds'],
  ['fw_p_wseed', 'minecraft.picked_up:minecraft.wheat_seeds'],
  ['fw_p_bseed', 'minecraft.picked_up:minecraft.beetroot_seeds'],
  ['fw_p_pseed', 'minecraft.picked_up:minecraft.pumpkin_seeds'],
  ['fw_p_mseed', 'minecraft.picked_up:minecraft.melon_seeds'],
  ['fw_d_wseed', 'minecraft.dropped:minecraft.wheat_seeds'],
  ['fw_d_bseed', 'minecraft.dropped:minecraft.beetroot_seeds'],
  ['fw_d_pseed', 'minecraft.dropped:minecraft.pumpkin_seeds'],
  ['fw_d_mseed', 'minecraft.dropped:minecraft.melon_seeds'],
  ['fw_p_berry', 'minecraft.picked_up:minecraft.sweet_berries'],
  ['fw_d_berry', 'minecraft.dropped:minecraft.sweet_berries'],
  ['fw_p_honey', 'minecraft.picked_up:minecraft.honeycomb'],
  ['fw_d_honey', 'minecraft.dropped:minecraft.honeycomb'],
  ['fw_m_bnest', 'minecraft.mined:minecraft.bee_nest'],
  ['fw_m_bhive', 'minecraft.mined:minecraft.beehive'],
  ['fw_k_bee', 'minecraft.killed:minecraft.bee'],
  ['fw_m_cact', 'minecraft.mined:minecraft.cactus'],
  ['fw_p_cact', 'minecraft.picked_up:minecraft.cactus'],
  ['fw_d_cact', 'minecraft.dropped:minecraft.cactus'],
  ...FLOWER_ITEMS.flatMap((f, i) => [
    [`fw_mf_${i}`, `minecraft.mined:minecraft.${f}`],
    [`fw_pf_${i}`, `minecraft.picked_up:minecraft.${f}`],
    [`fw_df_${i}`, `minecraft.dropped:minecraft.${f}`]
  ]),
  ...DYE_ITEMS.map((d, i) => [`fw_cd_${i}`, `minecraft.crafted:minecraft.${d}`]),

  // Ganadería, pesca y animales (monopolio de Scadrial0523 / Luthadel)
  ['fw_k_cow', 'minecraft.killed:minecraft.cow'],
  ['fw_k_pig', 'minecraft.killed:minecraft.pig'],
  ['fw_k_sheep', 'minecraft.killed:minecraft.sheep'],
  ['fw_k_chick', 'minecraft.killed:minecraft.chicken'],
  ['fw_k_rab', 'minecraft.killed:minecraft.rabbit'],
  ['fw_k_moosh', 'minecraft.killed:minecraft.mooshroom'],
  ['fw_k_squid', 'minecraft.killed:minecraft.squid'],
  ['fw_k_gsqu', 'minecraft.killed:minecraft.glow_squid'],
  ['fw_k_cod', 'minecraft.killed:minecraft.cod'],
  ['fw_k_salm', 'minecraft.killed:minecraft.salmon'],
  ['fw_c_fish', 'minecraft.custom:minecraft.fish_caught'],
  ['fw_u_rod', 'minecraft.used:minecraft.fishing_rod'],
  ['fw_c_breed', 'minecraft.custom:minecraft.animals_bred'],
  ['fw_p_egg', 'minecraft.picked_up:minecraft.egg'],
  ['fw_p_begg', 'minecraft.picked_up:minecraft.brown_egg'],
  ['fw_p_blegg', 'minecraft.picked_up:minecraft.blue_egg'],
  ['fw_d_egg', 'minecraft.dropped:minecraft.egg'],
  ['fw_d_begg', 'minecraft.dropped:minecraft.brown_egg'],
  ['fw_d_blegg', 'minecraft.dropped:minecraft.blue_egg'],
  ['fw_u_egg', 'minecraft.used:minecraft.egg'],
  ['fw_u_begg', 'minecraft.used:minecraft.brown_egg'],
  ['fw_u_blegg', 'minecraft.used:minecraft.blue_egg'],
  ['fw_p_feath', 'minecraft.picked_up:minecraft.feather'],
  ['fw_d_feath', 'minecraft.dropped:minecraft.feather'],
  ['fw_p_leath', 'minecraft.picked_up:minecraft.leather'],
  ['fw_d_leath', 'minecraft.dropped:minecraft.leather'],
  ['fw_p_ink', 'minecraft.picked_up:minecraft.ink_sac'],
  ['fw_d_ink', 'minecraft.dropped:minecraft.ink_sac'],
  ['fw_p_gink', 'minecraft.picked_up:minecraft.glow_ink_sac'],
  ['fw_d_gink', 'minecraft.dropped:minecraft.glow_ink_sac'],

  // PvP fuera de rol ([OOC] PvP y bromas)
  ['fw_c_dmgd', 'minecraft.custom:minecraft.damage_dealt'],
  ['fw_c_dmgt', 'minecraft.custom:minecraft.damage_taken'],
  ['fw_k_play', 'minecraft.killed:minecraft.player'],

  // Comercio con aldeanos (todos los jugadores)
  ['fw_c_trade', 'minecraft.custom:minecraft.traded_with_villager']
];

const SEED_DROPS = new Set([
  'fw_d_wseed', 'fw_d_bseed', 'fw_d_pseed', 'fw_d_mseed', 'fw_d_berry', 'fw_d_honey', 'fw_d_cact',
  ...FLOWER_ITEMS.map((_, i) => `fw_df_${i}`)
]);
const SCAD_DROPS = new Set(['fw_d_egg', 'fw_d_begg', 'fw_d_blegg', 'fw_d_feath', 'fw_d_leath', 'fw_d_ink', 'fw_d_gink']);

const AGRO_CLEAR_MAP = {
  fw_m_wheat: ['minecraft:wheat_seeds', 'minecraft:wheat'],
  fw_m_carrot: ['minecraft:carrot'],
  fw_m_potato: ['minecraft:potato', 'minecraft:poisonous_potato'],
  fw_m_beet: ['minecraft:beetroot_seeds', 'minecraft:beetroot'],
  fw_m_cane: ['minecraft:sugar_cane'],
  fw_m_melon: ['minecraft:melon_slice', 'minecraft:melon'],
  fw_m_pump: ['minecraft:pumpkin'],
  fw_m_berry: ['minecraft:sweet_berries'],
  fw_m_grass: ['minecraft:wheat_seeds'],
  fw_m_tgrass: ['minecraft:wheat_seeds'],
  fw_m_nwart: ['minecraft:nether_wart'],
  fw_u_wseed: ['minecraft:wheat_seeds'],
  fw_u_bseed: ['minecraft:beetroot_seeds'],
  fw_u_pseed: ['minecraft:pumpkin_seeds'],
  fw_u_mseed: ['minecraft:melon_seeds'],
  fw_p_wseed: ['minecraft:wheat_seeds'],
  fw_p_bseed: ['minecraft:beetroot_seeds'],
  fw_p_pseed: ['minecraft:pumpkin_seeds'],
  fw_p_mseed: ['minecraft:melon_seeds'],
  fw_p_berry: ['minecraft:sweet_berries'],
  fw_p_honey: ['minecraft:honeycomb'],
  fw_m_bnest: ['minecraft:bee_nest', 'minecraft:honeycomb', 'minecraft:honey_bottle'],
  fw_m_bhive: ['minecraft:beehive', 'minecraft:honeycomb', 'minecraft:honey_bottle'],
  fw_k_bee: ['minecraft:honeycomb', 'minecraft:honey_bottle'],
  fw_m_cact: ['minecraft:cactus'],
  fw_p_cact: ['minecraft:cactus'],
  ...Object.fromEntries(FLOWER_ITEMS.flatMap((f, i) => [
    [`fw_mf_${i}`, [`minecraft:${f}`]],
    [`fw_pf_${i}`, [`minecraft:${f}`]]
  ])),
  ...Object.fromEntries(DYE_ITEMS.map((d, i) => [`fw_cd_${i}`, [`minecraft:${d}`]]))
};

// Cuántos ítems como máximo puede producir cada evento contado por el marcador.
// Sirve para confiscar SOLO lo que se obtuvo con la infracción y nunca lo que el jugador
// ya tenía (por ejemplo, 64 cueros comprados legalmente al otro Estado).
function perEventMax(key) {
  if (key.startsWith('fw_p_') || key.startsWith('fw_pf_') || key.startsWith('fw_cd_') || key.startsWith('fw_u_') || key === 'fw_c_fish') return 1;
  if (key === 'fw_m_melon') return 7;
  if (key === 'fw_m_bnest' || key === 'fw_m_bhive') return 4;
  if (key.startsWith('fw_m_')) return 5;
  if (key.startsWith('fw_k_')) return 3;
  return 1;
}

// A qué permiso fino corresponde cada contador (ver PERMIT_SUBSCOPES en memory.mjs)
const AGRO_SUB = {
  fw_m_wheat: 'trigo', fw_m_grass: 'trigo', fw_m_tgrass: 'trigo', fw_u_wseed: 'trigo', fw_p_wseed: 'trigo',
  fw_m_carrot: 'zanahoria', fw_m_potato: 'papa',
  fw_m_beet: 'remolacha', fw_u_bseed: 'remolacha', fw_p_bseed: 'remolacha',
  fw_m_cane: 'cana',
  fw_m_melon: 'sandia', fw_u_mseed: 'sandia', fw_p_mseed: 'sandia',
  fw_m_pump: 'calabaza', fw_u_pseed: 'calabaza', fw_p_pseed: 'calabaza',
  fw_m_berry: 'bayas', fw_p_berry: 'bayas', fw_m_nwart: 'verrugas',
  fw_p_honey: 'abejas', fw_m_bnest: 'abejas', fw_m_bhive: 'abejas', fw_k_bee: 'abejas',
  fw_m_cact: 'cactus', fw_p_cact: 'cactus',
  ...Object.fromEntries(FLOWER_ITEMS.flatMap((_, i) => [
    [`fw_mf_${i}`, 'flores'],
    [`fw_pf_${i}`, 'flores']
  ])),
  ...Object.fromEntries(DYE_ITEMS.map((_, i) => [`fw_cd_${i}`, 'tintes']))
};
const CACTUS_FLOWER_IDX = FLOWER_ITEMS.indexOf('cactus_flower');
const CACTUS_FLOWER_KEYS = new Set(CACTUS_FLOWER_IDX >= 0 ? [`fw_mf_${CACTUS_FLOWER_IDX}`, `fw_pf_${CACTUS_FLOWER_IDX}`] : []);
const LIVE_SUB = {
  fw_k_cow: 'vacas', fw_k_moosh: 'vacas', fw_p_leath: 'vacas',
  fw_k_pig: 'cerdos', fw_k_sheep: 'ovejas',
  fw_k_chick: 'gallinas', fw_p_egg: 'gallinas', fw_u_egg: 'gallinas', fw_p_begg: 'gallinas', fw_u_begg: 'gallinas', fw_p_blegg: 'gallinas', fw_u_blegg: 'gallinas', fw_p_feath: 'gallinas',
  fw_k_rab: 'conejos',
  fw_k_squid: 'calamares', fw_k_gsqu: 'calamares', fw_p_ink: 'calamares', fw_p_gink: 'calamares',
  fw_k_cod: 'pesca', fw_k_salm: 'pesca', fw_c_fish: 'pesca', fw_u_rod: 'pesca',
  fw_c_breed: 'cria'
};

const AGRO_LABELS = {
  fw_m_wheat: 'cosechar trigo',
  fw_m_carrot: 'cosechar zanahorias',
  fw_m_potato: 'cosechar papas',
  fw_m_beet: 'cosechar remolacha',
  fw_m_cane: 'cortar caña de azúcar',
  fw_m_melon: 'partir sandías',
  fw_m_pump: 'picar calabazas',
  fw_m_berry: 'recoger bayas dulces',
  fw_m_grass: 'romper pasto buscando semillas agrícolas',
  fw_m_tgrass: 'romper pasto alto buscando semillas',
  fw_m_nwart: 'cosechar verrugas del Nether',
  fw_u_wseed: 'sembrar semillas de trigo',
  fw_u_bseed: 'sembrar semillas de remolacha',
  fw_u_pseed: 'sembrar semillas de calabaza',
  fw_u_mseed: 'sembrar semillas de sandía',
  fw_p_wseed: 'coger semillas de trigo sin pase o entrega directa',
  fw_p_bseed: 'coger semillas de remolacha sin autorización',
  fw_p_pseed: 'coger semillas de calabaza sin autorización',
  fw_p_mseed: 'coger semillas de sandía sin autorización',
  fw_p_berry: 'recoger bayas dulces sin autorización',
  fw_p_honey: 'recoger panales de abeja sin autorización',
  fw_m_bnest: 'tocar nidos de abejas',
  fw_m_bhive: 'tocar colmenas de abejas',
  fw_k_bee: 'matar abejas',
  fw_m_cact: 'picar cactus sin autorización',
  fw_p_cact: 'recoger cactus sin autorización',
  ...Object.fromEntries(FLOWER_ITEMS.flatMap((_, i) => [
    [`fw_mf_${i}`, 'coger flores sin autorización'],
    [`fw_pf_${i}`, 'recoger flores sin autorización']
  ])),
  ...Object.fromEntries(DYE_ITEMS.map((_, i) => [`fw_cd_${i}`, 'fabricar tintes sin autorización']))
};

const LIVESTOCK_CLEAR_MAP = {
  fw_k_cow: ['minecraft:beef', 'minecraft:cooked_beef', 'minecraft:leather'],
  fw_k_pig: ['minecraft:porkchop', 'minecraft:cooked_porkchop'],
  fw_k_sheep: ['minecraft:mutton', 'minecraft:cooked_mutton', 'minecraft:white_wool', 'minecraft:black_wool', 'minecraft:gray_wool', 'minecraft:light_gray_wool', 'minecraft:brown_wool', 'minecraft:pink_wool'],
  fw_k_chick: ['minecraft:chicken', 'minecraft:cooked_chicken', 'minecraft:feather'],
  fw_k_rab: ['minecraft:rabbit', 'minecraft:cooked_rabbit', 'minecraft:rabbit_hide', 'minecraft:rabbit_foot'],
  fw_k_moosh: ['minecraft:beef', 'minecraft:leather', 'minecraft:red_mushroom'],
  fw_k_squid: ['minecraft:ink_sac'],
  fw_k_gsqu: ['minecraft:glow_ink_sac'],
  fw_k_cod: ['minecraft:cod'],
  fw_k_salm: ['minecraft:salmon'],
  fw_c_fish: ['minecraft:cod', 'minecraft:salmon', 'minecraft:pufferfish', 'minecraft:tropical_fish'],
  fw_u_rod: ['minecraft:cod', 'minecraft:salmon'],
  fw_c_breed: [],
  fw_p_egg: ['minecraft:egg'],
  fw_u_egg: ['minecraft:egg'],
  fw_p_begg: ['minecraft:brown_egg'],
  fw_u_begg: ['minecraft:brown_egg'],
  fw_p_blegg: ['minecraft:blue_egg'],
  fw_u_blegg: ['minecraft:blue_egg'],
  fw_p_feath: ['minecraft:feather'],
  fw_p_leath: ['minecraft:leather'],
  fw_p_ink: ['minecraft:ink_sac'],
  fw_p_gink: ['minecraft:glow_ink_sac']
};

const LIVESTOCK_LABELS = {
  fw_k_cow: 'cazar vacas',
  fw_k_pig: 'cazar cerdos',
  fw_k_sheep: 'cazar ovejas',
  fw_k_chick: 'cazar gallinas',
  fw_k_rab: 'cazar conejos',
  fw_k_moosh: 'cazar champiñacas',
  fw_k_squid: 'matar calamares',
  fw_k_gsqu: 'matar calamares luminosos',
  fw_k_cod: 'matar bacalaos',
  fw_k_salm: 'matar salmones',
  fw_c_fish: 'pescar sin permiso del monopolio pesquero',
  fw_u_rod: 'usar caña de pescar fuera del monopolio',
  fw_c_breed: 'criar animales',
  fw_p_egg: 'recoger huevos de gallina sin autorización',
  fw_u_egg: 'lanzar huevos para criar gallinas',
  fw_p_begg: 'recoger huevos marrones sin autorización',
  fw_u_begg: 'lanzar huevos marrones para criar gallinas',
  fw_p_blegg: 'recoger huevos azules sin autorización',
  fw_u_blegg: 'lanzar huevos azules para criar gallinas',
  fw_p_feath: 'recoger plumas sin autorización',
  fw_p_leath: 'recoger cuero sin autorización',
  fw_p_ink: 'recoger sacos de tinta sin autorización',
  fw_p_gink: 'recoger tinta luminosa sin autorización'
};

export class RuleEnforcer {
  constructor({ cfg, bridge, rcon, memory = null }) {
    this.cfg = cfg;
    this.bridge = bridge;
    this.rcon = rcon;
    this.memory = memory;
    const enf = cfg.enforcement || {};
    this.enabled = enf.enabled !== false;
    this.pollMs = Number(enf.pollMs || 1500);
    this.confiscateItems = enf.confiscateItems !== false;
    this.roastCooldownMs = Number(enf.roastCooldownMs || 8000);
    this.tradeWindowMs = Number(enf.tradeWindowMs || 45000);

    this.onlinePlayers = new Set();
    this.tradePasses = new Map(); // playerLower -> expiresAt
    this.recentMythSeedDropAt = 0;
    this.recentScadDropAt = 0;
    this.globalTradeUntil = 0;
    this.globalDuelUntil = 0;
    this.pvpCooldownAt = 0;
    this.roastCooldown = new Map(); // `${playerLower}:${key}` -> at
    this.dimCooldown = new Map(); // `${playerLower}:${dim}` -> at
    this.timer = null;
    this.tickNum = 0;
    this.polling = false;
    this.objectivesReady = false;
    this.lastInitTryAt = 0;
    this.failedObjectives = [];
    this.custodyPath = path.resolve(path.dirname(cfg.logPathResolved || './logs/latest.log'), '..', 'bot-custody.json');
    this.pendingCustody = this.loadCustody();
  }

  loadCustody() {
    try {
      if (fs.existsSync(this.custodyPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.custodyPath, 'utf8'));
        return {
          myth: parsed?.myth && typeof parsed.myth === 'object' ? parsed.myth : {},
          scad: parsed?.scad && typeof parsed.scad === 'object' ? parsed.scad : {}
        };
      }
    } catch (err) {
      console.warn('[Enforcer] Error leyendo bot-custody.json:', err.message);
    }
    return { myth: {}, scad: {} };
  }

  saveCustody() {
    try {
      fs.writeFileSync(this.custodyPath, JSON.stringify(this.pendingCustody, null, 2), 'utf8');
    } catch (err) {
      console.warn('[Enforcer] Error guardando bot-custody.json:', err.message);
    }
  }

  formatItemCounts(countMap) {
    return [...countMap.entries()]
      .filter(([, count]) => count > 0)
      .map(([item, count]) => `${count}x ${item.replace('minecraft:', '')}`)
      .join(', ');
  }

  mergeCountMaps(a, b) {
    const out = new Map(a);
    for (const [k, v] of b.entries()) {
      out.set(k, (out.get(k) || 0) + v);
    }
    return out;
  }

  getPlayerRole(player, state) {
    const low = String(player || '').trim().toLowerCase();
    const pc = this.cfg.players || {};
    const mythList = (pc.myth || ['MythStorm']).map(x => x.toLowerCase());
    const scadList = (pc.scad || ['Scadrial0523']).map(x => x.toLowerCase());
    const guestList = (pc.guests || ['NotOutContext']).map(x => x.toLowerCase());
    if (mythList.includes(low)) return 'myth';
    if (scadList.includes(low)) return 'scad';
    if (guestList.includes(low)) return 'guest';
    const mNick = (state?.settings?.nations?.myth?.player || '').toLowerCase();
    const sNick = (state?.settings?.nations?.scad?.player || '').toLowerCase();
    if (mNick && low === mNick) return 'myth';
    if (sNick && low === sNick) return 'scad';
    return 'guest';
  }

  findOnlineByRole(role, state) {
    for (const p of this.onlinePlayers) {
      if (this.getPlayerRole(p, state) === role) return p;
    }
    return null;
  }

  hasTradePass(player) {
    const low = String(player || '').toLowerCase();
    const exp = this.tradePasses.get(low);
    if (!exp) return false;
    if (Date.now() > exp) {
      this.tradePasses.delete(low);
      return false;
    }
    return true;
  }

  grantTradePass(player, minutes = 5) {
    const mins = Math.max(1, Math.min(60, Number(minutes) || 5));
    const low = String(player || '').toLowerCase();
    const exp = Date.now() + mins * 60_000;
    this.tradePasses.set(low, exp);
    return mins;
  }

  startGlobalWindow(minutes = 5, mode = 'trato') {
    const mins = Math.max(1, Math.min(60, Number(minutes) || 5));
    const until = Date.now() + mins * 60_000;
    if (mode === 'duelo') {
      this.globalDuelUntil = until;
    } else {
      this.globalTradeUntil = until;
    }
    return mins;
  }

  clearGlobalWindow(mode = 'all') {
    if (mode === 'all' || mode === 'trato') this.globalTradeUntil = 0;
    if (mode === 'all' || mode === 'duelo') this.globalDuelUntil = 0;
  }

  isGlobalTradeActive() {
    return Date.now() < this.globalTradeUntil;
  }

  isGlobalDuelActive() {
    return Date.now() < this.globalDuelUntil || this.isGlobalTradeActive();
  }

  getGlobalWindowStatus() {
    const now = Date.now();
    return {
      tradeMinsLeft: now < this.globalTradeUntil ? Math.ceil((this.globalTradeUntil - now) / 60_000) : 0,
      duelMinsLeft: now < this.globalDuelUntil ? Math.ceil((this.globalDuelUntil - now) / 60_000) : 0
    };
  }

  recordRoleDrops(role, scores) {
    if (role === 'myth') {
      for (const dk of SEED_DROPS) {
        if (scores[dk] > 0) this.recentMythSeedDropAt = Date.now();
      }
    } else if (role === 'scad') {
      for (const dk of SCAD_DROPS) {
        if (scores[dk] > 0) this.recentScadDropAt = Date.now();
      }
    }
  }

  async initObjectives() {
    this.lastInitTryAt = Date.now();
    try {
      await this.rcon.connect();
    } catch (err) {
      this.objectivesReady = false;
      this.failedObjectives = [];
      console.warn(`[Enforcer] RCON aún no disponible (${err.message}); reintentando automáticamente en 5s.`);
      return [];
    }

    const failed = [];
    // Objetivos fijos + los del catálogo de granjas (data.js → FARM_LOCKS)
    const farmObjectives = (this.bridge.D?.FARM_LOCKS || []).flatMap(l => (l.watch || []).map(w => [w[0], w[1]]));
    for (const [name, criterion] of [...OBJECTIVES, ...farmObjectives]) {
      try {
        const res = await this.rcon.send(`scoreboard objectives add ${name} ${criterion}`);
        if (/(Unknown criteria|Incorrect argument|Invalid)/i.test(res)) {
          failed.push({ name, criterion, res });
        }
      } catch (err) {
        this.objectivesReady = false;
        this.failedObjectives = [];
        console.warn(`[Enforcer] Conexión RCON interrumpida inicializando ${name} (${err.message}); reintentando en 5s.`);
        return [];
      }
    }
    this.failedObjectives = failed;
    this.objectivesReady = true;
    if (failed.length) {
      console.warn('[Enforcer] Criterios de scoreboard rechazados:', failed);
    } else {
      console.log(`[Enforcer] ${OBJECTIVES.length + farmObjectives.length} objetivos de vigilancia activos (sin alterar sidebar).`);
    }
    return failed;
  }

  async syncOnlinePlayers() {
    try {
      const res = await this.rcon.send('list');
      // Formato: "There are X of a max of Y players online: Player1, Player2"
      const idx = res.indexOf(':');
      this.onlinePlayers.clear();
      if (idx >= 0) {
        const tail = res.slice(idx + 1).trim();
        if (tail) {
          for (const name of tail.split(',')) {
            const clean = name.trim();
            if (/^[A-Za-z0-9_]{1,16}$/.test(clean)) {
              this.onlinePlayers.add(clean);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Enforcer] Error leyendo list:', err.message);
    }
  }

  onJoin(player) {
    if (!player) return;
    this.onlinePlayers.add(player);
    setTimeout(() => {
      this.deliverPendingCustody(player).catch(() => {});
    }, 2800);
  }

  onLeave(player) {
    if (player) this.onlinePlayers.delete(player);
  }

  parseScores(raw) {
    const map = {};
    const re = /\[(fw_[a-z0-9_]+)\]:\s*(-?\d+)/gi;
    let m;
    while ((m = re.exec(String(raw || ''))) !== null) {
      const val = Number(m[2]);
      if (val > 0) map[m[1].toLowerCase()] = val;
    }
    return map;
  }

  async resetScores(player, keys) {
    for (const k of keys) {
      await this.rcon.send(`scoreboard players set ${player} ${k} 0`).catch(() => {});
    }
  }

  // caps: Map item -> máximo que todavía se puede retirar (se descuenta en cada pasada)
  async collectItemsOnce(player, items, caps) {
    const collected = new Map();
    for (const item of items) {
      if (caps && !(caps.get(item) > 0)) continue;
      // 1. Capturar primero drops cercanos en el suelo (durante PickupDelay de Minecraft)
      for (let n = 0; n < 6; n++) {
        if (caps && !(caps.get(item) > 0)) break;
        try {
          const dataRes = await this.rcon.send(`execute at ${player} run data get entity @n[type=minecraft:item,distance=..8,nbt={Item:{id:"${item}"}}] Item`);
          if (!/entity data:/i.test(dataRes)) break;
          const countMatch = String(dataRes).match(/\bcount:\s*(\d+)/i);
          const stackCount = countMatch ? Math.max(1, Number(countMatch[1]) || 1) : 1;
          const capLeft = caps ? Math.floor(caps.get(item)) : Infinity;
          if (stackCount > capLeft) {
            // El stack del suelo trae más de lo que salió de la infracción (p. ej. 64 cueros comprados
            // y tirados al lado): solo se descuenta lo que toca y el resto se queda en el suelo.
            const modRes = await this.rcon.send(`execute at ${player} run data modify entity @n[type=minecraft:item,distance=..8,nbt={Item:{id:"${item}"}}] Item.count set value ${stackCount - capLeft}`);
            if (/Modified/i.test(String(modRes || ''))) {
              collected.set(item, (collected.get(item) || 0) + capLeft);
              caps.set(item, 0);
            }
            break;
          }
          const killRes = await this.rcon.send(`execute at ${player} run kill @n[type=minecraft:item,distance=..8,nbt={Item:{id:"${item}"}}]`);
          if (!/Killed\s+/i.test(killRes)) break;
          collected.set(item, (collected.get(item) || 0) + stackCount);
          if (caps) caps.set(item, Math.max(0, caps.get(item) - stackCount));
        } catch {
          break;
        }
      }
      // 2. Retirar del inventario SOLO la cantidad que falta por cubrir (nunca todo el stack)
      const left = caps ? caps.get(item) : 0;
      if (!(left > 0)) continue;
      try {
        const clearRes = await this.rcon.send(`clear ${player} ${item} ${Math.floor(left)}`);
        const m = String(clearRes || '').match(/Removed\s+(\d+)\s+item/i);
        const count = m ? Number(m[1]) : 0;
        if (count > 0) {
          collected.set(item, (collected.get(item) || 0) + count);
          if (caps) caps.set(item, Math.max(0, caps.get(item) - count));
        }
      } catch {}
    }
    return collected;
  }

  async deliverToState(ownerRole, countMap, fromPlayer, state) {
    if (!ownerRole || !countMap || !countMap.size) {
      return { deliveredTo: null, queuedFor: null, summary: '' };
    }
    const summary = this.formatItemCounts(countMap);
    if (!summary) {
      return { deliveredTo: null, queuedFor: null, summary: '' };
    }
    const ownerPlayer = this.findOnlineByRole(ownerRole, state);
    if (ownerPlayer) {
      const failed = new Map();
      for (const [item, count] of countMap.entries()) {
        if (count > 0 && !(await this.giveChecked(ownerPlayer, item, count))) failed.set(item, count);
      }
      if (failed.size) this.queueCustody(ownerRole, failed);
      await this.rcon.send(`execute at ${ownerPlayer} run playsound minecraft:entity.experience_orb.pickup master ${ownerPlayer} ~ ~ ~ 0.7 1.2`).catch(() => {});
      await this.rcon.tellraw(ownerPlayer, [
        '',
        { text: '[Aduana] ', color: 'aqua', bold: true },
        { text: `Transferido desde ${fromPlayer} (tu monopolio): ${summary}.`, color: 'white' }
      ]).catch(() => {});
      return { deliveredTo: ownerPlayer, queuedFor: null, summary };
    }

    this.queueCustody(ownerRole, countMap);
    return { deliveredTo: null, queuedFor: ownerRole, summary };
  }

  queueCustody(ownerRole, countMap) {
    if (!this.pendingCustody[ownerRole]) this.pendingCustody[ownerRole] = {};
    for (const [item, count] of countMap.entries()) {
      if (count > 0) {
        this.pendingCustody[ownerRole][item] = (Number(this.pendingCustody[ownerRole][item]) || 0) + count;
      }
    }
    this.saveCustody();
  }

  // true solo si el servidor confirma la entrega ("Gave ...")
  async giveChecked(player, item, count) {
    try {
      const res = await this.rcon.send(`give ${player} ${item} ${count}`);
      return /\bGave\b/i.test(String(res || ''));
    } catch {
      return false;
    }
  }

  async deliverPendingCustody(player) {
    const { state } = await this.bridge.fetchWorld(false);
    const role = this.getPlayerRole(player, state);
    if (role !== 'myth' && role !== 'scad') return;
    const bucket = this.pendingCustody[role] || {};
    const entries = Object.entries(bucket).filter(([, c]) => Number(c) > 0);
    if (!entries.length) return;

    this.pendingCustody[role] = {};
    this.saveCustody();

    const map = new Map();
    const failed = new Map();
    for (const [item, c] of entries) {
      const count = Math.floor(Number(c));
      if (count > 0) {
        if (await this.giveChecked(player, item, count)) map.set(item, count);
        else failed.set(item, count);
      }
    }
    if (failed.size) this.queueCustody(role, failed);
    const summary = this.formatItemCounts(map);
    if (!summary) return;
    await this.rcon.send(`execute at ${player} run playsound minecraft:entity.experience_orb.pickup master ${player} ~ ~ ~ 0.7 1.2`).catch(() => {});
    await this.rcon.tellraw(player, [
      '',
      { text: '[Aduana] ', color: 'aqua', bold: true },
      { text: `Mercancía incautada a tu favor mientras no estabas: ${summary}.`, color: 'white' }
    ]).catch(() => {});
  }

  async transferConfiscatedItems(player, items, ownerRole, state, caps) {
    if (!this.confiscateItems || !items || !items.length) {
      return { deliveredTo: null, queuedFor: null, summary: '' };
    }
    caps = caps || new Map(items.map(i => [i, 0]));
    const m1 = await this.collectItemsOnce(player, items, caps);
    await new Promise(r => setTimeout(r, 650));
    const m2 = await this.collectItemsOnce(player, items, caps);
    const total = this.mergeCountMaps(m1, m2);
    const res = await this.deliverToState(ownerRole, total, player, state);
    console.log(`[Enforcer] Transferencia desde ${player} -> ${res.deliveredTo || res.queuedFor || 'ninguno'}: ${res.summary || 'sin ítems'}`);
    setTimeout(async () => {
      try {
        const m3 = await this.collectItemsOnce(player, items, caps);
        if (m3.size) await this.deliverToState(ownerRole, m3, player, state);
      } catch {}
    }, 1600);
    return res;
  }

  async isNearRolePlayer(player, role, state) {
    const partner = this.findOnlineByRole(role, state);
    if (!partner) return false;
    try {
      const res = await this.rcon.send(`execute at ${player} if entity ${partner}[distance=..8]`);
      return /Test passed/i.test(res);
    } catch {
      return false;
    }
  }

  async punish({ player, role, ownerRole = null, cooldownKey, violationSummary, clearItemsList = [], clearCaps = null, normQuery, normFallback }) {
    const { state } = await this.bridge.fetchWorld(false);
    const transfer = await this.transferConfiscatedItems(player, clearItemsList, ownerRole, state, clearCaps);
    let actionTaken;
    if (transfer.deliveredTo) {
      const ownerNation = this.bridge.nat(state, ownerRole).nation;
      actionTaken = `Se confiscaron y transfirieron a ${transfer.deliveredTo} (${ownerNation}): ${transfer.summary}`;
    } else if (transfer.queuedFor) {
      const ownerNation = this.bridge.nat(state, ownerRole).nation;
      actionTaken = `Se confiscaron y guardaron en Aduana para ${ownerNation}: ${transfer.summary}`;
    } else {
      actionTaken = clearItemsList.length ? 'Amonestación y registro de infracción' : 'Aviso inmediato de restricción';
    }
    this.memory?.recordEvent('infraction', `${player}: ${violationSummary}${transfer.summary ? ` (${transfer.summary})` : ''}`);
    this.memory?.recordInfraction?.(player, violationSummary, transfer.summary);

    try {
      await this.rcon.send(`execute at ${player} run playsound minecraft:entity.villager.no master ${player} ~ ~ ~ 1 0.85`);
      await this.rcon.tellraw(player, [{ text: '¡Pacto / Norma de Miscolandia!', color: 'gold', bold: true }]);
    } catch {}

    const now = Date.now();
    const rKey = `${player.toLowerCase()}:${cooldownKey}`;
    const last = this.roastCooldown.get(rKey) || 0;
    if (now - last < this.roastCooldownMs) return;
    this.roastCooldown.set(rKey, now);

    const pact = this.bridge.getPactSummary(state, normQuery);
    const era = this.bridge.getCurrentEra(state);
    const norms = this.bridge.findRelevantNorms(state, normQuery, { limit: 3, includeOoc: true });
    const normContext = [
      `Era actual: ${era.code} (${era.name}). Permitido: ${era.allowed.join(' | ')}. Prohibido: ${era.banned.join(' | ')}.`,
      `Monopolios: ${pact.myth.nation} -> ${pact.myth.sectors.join('; ')} | ${pact.scad.nation} -> ${pact.scad.sectors.join('; ')}.`,
      ...norms
    ].join('\n\n');

    const roast = await generateRoast({
      config: this.cfg,
      player,
      role,
      violationSummary,
      actionTaken,
      normContext,
      fallbackNorm: normFallback
    });

    await this.rcon.tellraw('@a', [
      '',
      { text: '[Fiscalía] ', color: 'gold', bold: true },
      { text: roast.mensaje_gracioso, color: 'white' },
      { text: ` (${roast.norma_citada})`, color: 'yellow' }
    ]);
  }

  async checkVillagerTrade(player, role, state, eraKnown = true) {
    const era = this.bridge.getCurrentEra(state);
    if (era.index < 5 && eraKnown) {
      await this.punish({
        player,
        role,
        cooldownKey: 'villager_era',
        violationSummary: `intentar comerciar con un aldeano en plena ${era.code} (antes de la ERA V Ciudadanía)`,
        normQuery: 'comerciar con aldeanos ERA V pacto de monopolios',
        normFallback: `${era.code} / Pacto de Monopolios`
      });
      return;
    }

    const villagerProhibited = Boolean(this.memory?.hasProhibition(player, 'aldeanos'));
    if (role === 'guest' && (villagerProhibited || (!this.hasTradePass(player) && !this.memory?.hasPermit(player, 'aldeanos')))) {
      await this.punish({
        player,
        role,
        cooldownKey: 'villager_guest',
        violationSummary: villagerProhibited
          ? 'comerciar con aldeanos estatales teniendo prohibición expresa vigente'
          : 'comerciar con aldeanos estatales sin permiso escrito de un Estado',
        normQuery: 'visitante invitado comerciar aldeanos Ley 003',
        normFallback: 'Ley 003 Art. 3 Par. 1'
      });
      return;
    }

    // Desde ERA V: revisar si el aldeano cercano pertenece al gremio del otro Estado
    try {
      const res = await this.rcon.send(`execute at ${player} run data get entity @n[type=minecraft:villager,distance=..8] VillagerData.profession`);
      const match = res.match(/(?:minecraft:)?([a-z_]+)/i);
      if (!match) return;
      const tailMatch = res.match(/"?(?:minecraft:)?([a-z_]+)"?\s*$/i);
      const profId = (tailMatch ? tailMatch[1] : match[1]).toLowerCase();
      if (profId === 'none' || profId === 'nitwit') return;
      const profOwner = state.professions?.[profId];
      if (profOwner && role !== 'guest' && profOwner !== role) {
        const profObj = (this.bridge.D.PROFESSIONS || []).find(p => p.id === profId);
        const profName = profObj ? profObj.name : profId;
        const ownerNation = this.bridge.nat(state, profOwner).nation;
        await this.punish({
          player,
          role,
          cooldownKey: `villager_guild_${profId}`,
          violationSummary: `negociar a escondidas con un aldeano ${profName} reservado al gremio de ${ownerNation}`,
          normQuery: `gremio aldeanos profesiones monopolio Acuerdo 002 ${profName}`,
          normFallback: 'Acuerdo 002 · Gremios Aldeanos'
        });
      }
    } catch {}
  }

  async checkDimensions(player, role, state) {
    const era = this.bridge.getCurrentEra(state);
    const now = Date.now();
    if (era.index < 4) {
      const k = `${player.toLowerCase()}:nether`;
      if (now - (this.dimCooldown.get(k) || 0) > 20_000) {
        try {
          const res = await this.rcon.send(`execute if entity ${player}[nbt={Dimension:"minecraft:the_nether"}]`);
          if (/Test passed/i.test(res)) {
            this.dimCooldown.set(k, now);
            await this.punish({
              player,
              role,
              cooldownKey: 'dim_nether',
              violationSummary: `colarse al Nether antes de tiempo cuando el mundo sigue en ${era.code}`,
              normQuery: `Nether sellado prohibido ${era.code}`,
              normFallback: `${era.code} · Nether Sellado`
            });
          }
        } catch {}
      }
    }
    if (era.index < 11) {
      const k = `${player.toLowerCase()}:end`;
      if (now - (this.dimCooldown.get(k) || 0) > 20_000) {
        try {
          const res = await this.rcon.send(`execute if entity ${player}[nbt={Dimension:"minecraft:the_end"}]`);
          if (/Test passed/i.test(res)) {
            this.dimCooldown.set(k, now);
            await this.punish({
              player,
              role,
              cooldownKey: 'dim_end',
              violationSummary: `meterse al End en plena ${era.code} (prohibido hasta la ERA XI)`,
              normQuery: `End prohibido ${era.code}`,
              normFallback: `${era.code} · End Sellado`
            });
          }
        } catch {}
      }
    }
  }

  async inspectPlayer(player, state, preloadedScores = null) {
    const role = this.getPlayerRole(player, state);
    let scores = preloadedScores;
    if (!scores) {
      const raw = await this.rcon.send(`scoreboard players list ${player}`);
      scores = this.parseScores(raw);
      const rawKeys = Object.keys(scores);
      if (!rawKeys.length) return;
      await this.resetScores(player, rawKeys);
      this.recordRoleDrops(role, scores);
    }
    const keys = Object.keys(scores);
    if (!keys.length) return;

    const hasPass = this.hasTradePass(player);
    const tradeTruce = this.isGlobalTradeActive();
    // Permisos expresos guardados con !permiso (persisten entre reinicios)
    const permAgro = Boolean(this.memory?.hasPermit(player, 'agro'));
    const permGanado = Boolean(this.memory?.hasPermit(player, 'ganado'));
    let caughtCactusInAgro = false;

    // 1. Reglas de Agricultura, Flores, Cactus, Tintes y Abejas (solo MythStorm, o quien tenga su permiso)
    if (role !== 'myth' && !hasPass && !tradeTruce) {
      const agroHits = [];
      const agroClear = new Set();
      const agroCaps = new Map();
      const brokePlant = (scores.fw_m_grass || 0) > 0
        || (scores.fw_m_tgrass || 0) > 0
        || (scores.fw_m_wheat || 0) > 0
        || (scores.fw_m_berry || 0) > 0
        || (scores.fw_m_bnest || 0) > 0
        || (scores.fw_m_bhive || 0) > 0
        || (scores.fw_m_cact || 0) > 0
        || keys.some(k => k.startsWith('fw_mf_'));

      for (const k of keys) {
        if (!AGRO_LABELS[k]) continue;
        const sub = AGRO_SUB[k];
        const explicitlyProhibited = Boolean(
          this.memory?.hasProhibition(player, 'agro')
          || (sub && this.memory?.hasProhibition(player, `agro:${sub}`))
          || (sub === 'cactus' && this.memory?.hasProhibition(player, 'granja:cactus'))
        );
        if (!explicitlyProhibited) {
          if (permAgro) continue;
          if (sub && this.memory?.hasPermit(player, `agro:${sub}`)) continue;
          if (sub === 'cactus' && this.memory?.hasPermit(player, 'granja:cactus')) continue;
          if (CACTUS_FLOWER_KEYS.has(k) && (this.memory?.hasPermit(player, 'agro:cactus') || this.memory?.hasPermit(player, 'granja:cactus'))) continue;
        }
        if (k.startsWith('fw_p_') || k.startsWith('fw_pf_')) {
          const withinDropWindow = (Date.now() - this.recentMythSeedDropAt) < this.tradeWindowMs;
          const nearMyth = !brokePlant && await this.isNearRolePlayer(player, 'myth', state);
          if (!brokePlant && (withinDropWindow || nearMyth)) continue;
        }
        // Evitar falsos positivos si solo rompió un pastito sin recoger semilla y no era cultivo
        if ((k === 'fw_m_grass' || k === 'fw_m_tgrass') && !(scores.fw_p_wseed || scores.fw_p_bseed)) {
          continue;
        }
        if (sub === 'cactus') caughtCactusInAgro = true;
        agroHits.push(AGRO_LABELS[k]);
        for (const item of (AGRO_CLEAR_MAP[k] || [])) {
          agroClear.add(item);
          agroCaps.set(item, (agroCaps.get(item) || 0) + scores[k] * perEventMax(k));
        }
      }

      if (agroHits.length) {
        await this.punish({
          player,
          role,
          ownerRole: 'myth',
          cooldownKey: 'agro_monopoly',
          violationSummary: agroHits.slice(0, 2).join(' y '),
          clearItemsList: [...agroClear],
          clearCaps: agroCaps,
          normQuery: 'agricultura semillas cultivos flores cactus tintes abejas monopolio Acuerdo 002 Ley 003 REG 4',
          normFallback: role === 'guest' ? 'Ley 003 & Regla OOC 4 (Invitados)' : 'Acuerdo 002 & Regla OOC 4 (Agricultura, Flores y Tintes)'
        });
      }
    }

    // 2. Reglas de Ganadería y Pesca (solo Scadrial0523)
    if (role !== 'scad' && !hasPass && !tradeTruce) {
      const liveHits = [];
      const liveClear = new Set();
      const liveCaps = new Map();
      const killedAnimal = keys.some(k => k.startsWith('fw_k_') || k === 'fw_c_fish');

      for (const k of keys) {
        if (!LIVESTOCK_LABELS[k]) continue;
        const sub = LIVE_SUB[k];
        const explicitlyProhibited = Boolean(
          this.memory?.hasProhibition(player, 'ganado')
          || (sub && this.memory?.hasProhibition(player, `ganado:${sub}`))
        );
        if (!explicitlyProhibited) {
          if (permGanado) continue;
          if (sub && this.memory?.hasPermit(player, `ganado:${sub}`)) continue;
        }
        // Solo usar caña (sin pescar ni recoger pez) puede ser enganchar botes/entidades; solo sancionar pesca real o si mató peces
        if (k === 'fw_u_rod' && !(scores.fw_c_fish > 0 || scores.fw_k_cod > 0 || scores.fw_k_salm > 0)) continue;
        if (k.startsWith('fw_p_')) {
          const withinScadWindow = (Date.now() - this.recentScadDropAt) < this.tradeWindowMs;
          const nearScad = !killedAnimal && await this.isNearRolePlayer(player, 'scad', state);
          if (!killedAnimal && (withinScadWindow || nearScad)) continue;
        }
        liveHits.push(LIVESTOCK_LABELS[k]);
        for (const item of (LIVESTOCK_CLEAR_MAP[k] || [])) {
          liveClear.add(item);
          liveCaps.set(item, (liveCaps.get(item) || 0) + scores[k] * perEventMax(k));
        }
      }

      if (liveHits.length) {
        await this.punish({
          player,
          role,
          ownerRole: 'scad',
          cooldownKey: 'livestock_monopoly',
          violationSummary: liveHits.slice(0, 2).join(' y '),
          clearItemsList: [...liveClear],
          clearCaps: liveCaps,
          normQuery: 'ganaderia pesca animales vacas cerdos huevos monopolio Acuerdo 002 REG 4 Ley 003',
          normFallback: role === 'guest' ? 'Ley 003 & Regla OOC 4 (Invitados)' : 'Acuerdo 002 & Regla OOC 4 (Ganadería y Pesca)'
        });
      }
    }

    // 3. Bloqueo automático por granjas o prohibición expresa (!permiso prohibir)
    if (!hasPass && !tradeTruce) {
      const D = this.bridge.D || {};
      const activeLocks = typeof D.activeFarmLocks === 'function' ? D.activeFarmLocks(state) : [];
      const activeById = new Map(activeLocks.map(x => [x.lock.id, x]));
      for (const lock of (D.FARM_LOCKS || [])) {
        if (lock.id === 'cactus' && caughtCactusInAgro) continue;
        const activeEntry = activeById.get(lock.id);
        const owner = activeEntry ? activeEntry.owner : lock.owner;
        const scopeKey = `granja:${lock.id}`;
        const isProhibited = Boolean(
          this.memory?.hasProhibition(player, scopeKey)
          || (lock.id === 'cactus' && this.memory?.hasProhibition(player, 'agro:cactus'))
        );
        if (!activeEntry && !isProhibited) continue;
        if (role === owner) continue;
        const isAllowed = !isProhibited && Boolean(
          this.memory?.hasPermit(player, scopeKey)
          || (lock.id === 'cactus' && (permAgro || this.memory?.hasPermit(player, 'agro:cactus')))
        );
        if (isAllowed) continue;
        const caps = new Map();
        let events = 0;
        for (const [obj, , perEvent] of lock.watch) {
          const n = scores[obj] || 0;
          if (!n) continue;
          events += n;
          for (const item of lock.items) caps.set(item, (caps.get(item) || 0) + n * (Number(perEvent) || 1));
        }
        if (!events) continue;
        const ownerNation = this.bridge.nat(state, owner)?.nation || owner;
        await this.punish({
          player,
          role,
          ownerRole: owner,
          cooldownKey: `farm_${lock.id}`,
          violationSummary: isProhibited && !activeEntry
            ? `obtener ${lock.label.toLowerCase()} teniendo prohibición expresa de ${ownerNation}`
            : `conseguir ${lock.label.toLowerCase()} a mano cuando ${ownerNation} ya tiene su granja auditada (se compra en su tienda)`,
          clearItemsList: [...lock.items],
          clearCaps: caps,
          normQuery: `bloqueo automatico granjas ${lock.label} monopolio`,
          normFallback: '[OOC] Bloqueo automático por granjas'
        });
      }
    }

    // 4. Reglas de Comercio con Aldeanos (Todos)
    if (scores.fw_c_trade > 0) {
      await this.checkVillagerTrade(player, role, state, this.eraKnown !== false);
    }
  }

  async checkPvpTick(tickScores, state) {
    if (this.isGlobalDuelActive()) return;
    if (Date.now() - this.pvpCooldownAt < 25_000) return;

    const entries = [...tickScores.entries()];
    for (const [attacker, scoresA] of entries) {
      if (!scoresA.fw_k_play && !scoresA.fw_c_dmgd) continue;
      for (const [victim, scoresB] of entries) {
        if (attacker === victim) continue;
        const hitMatch = scoresA.fw_k_play > 0
          || (scoresA.fw_c_dmgd > 0 && scoresB.fw_c_dmgt > 0 && scoresB.fw_c_dmgt <= scoresA.fw_c_dmgd + 5);
        if (!hitMatch) continue;

        if (!scoresA.fw_k_play) {
          try {
            const nearRes = await this.rcon.send(`execute at ${attacker} if entity ${victim}[distance=..6]`);
            if (!/Test passed/i.test(nearRes)) continue;
          } catch {
            continue;
          }
        }

        if (!scoresA.fw_k_play) {
          // Solo hubo daño: el marcador no sabe si fue a un jugador o a un mob (raids, peleas en grupo).
          // Aviso privado y suave, sin Fiscalía pública ni infracción registrada.
          const k = `${attacker.toLowerCase()}:pvp_hint`;
          if (Date.now() - (this.roastCooldown.get(k) || 0) > 5 * 60_000) {
            this.roastCooldown.set(k, Date.now());
            await this.rcon.tellraw(attacker, [
              '',
              { text: '[Fiscalía] ', color: 'gold', bold: true },
              { text: `¿Le pegaste a ${victim}? Si fue sin querer o peleaban contra mobs, ignora esto. Para PvP de verdad usen !duelo.`, color: 'gray' }
            ]).catch(() => {});
          }
          return;
        }
        this.pvpCooldownAt = Date.now();
        await this.punish({
          player: attacker,
          role: this.getPlayerRole(attacker, state),
          ownerRole: null,
          cooldownKey: 'pvp_ooc',
          violationSummary: scoresA.fw_k_play > 0
            ? `matar en PvP a ${victim} sin duelo pactado`
            : `pegarle a ${victim} sin duelo ni evento consensuado`,
          clearItemsList: [],
          normQuery: 'PvP bromas fuera de rol duelo consensuado OOC multa 10 OE',
          normFallback: '[OOC] PvP y bromas'
        });
        return;
      }
    }
  }

  // Pausar/reanudar la vigilancia. Al reanudar, lo que se hizo durante la pausa NO se castiga:
  // la primera pasada solo vacía los marcadores acumulados.
  setEnabled(on) {
    const next = Boolean(on);
    if (next && !this.enabled) this.drainNextPoll = true;
    this.enabled = next;
    return this.enabled;
  }

  async pollOnce() {
    if (!this.enabled || this.polling) return;
    if (!this.objectivesReady && Date.now() - this.lastInitTryAt < 5000) return;
    if (this.objectivesReady && !this.onlinePlayers.size) return;

    this.polling = true;
    try {
      if (!this.objectivesReady) {
        await this.initObjectives();
        if (!this.objectivesReady) return;
        await this.syncOnlinePlayers();
        if (this.onlinePlayers.size) {
          console.log(`[Enforcer] Jugadores en línea sincronizados: ${[...this.onlinePlayers].join(', ')}`);
          for (const p of this.onlinePlayers) this.deliverPendingCustody(p).catch(() => {});
        }
      }
      if (!this.onlinePlayers.size) return;

      this.tickNum++;
      if (this.tickNum % 20 === 0) {
        await this.syncOnlinePlayers();
      }
      if (!this.onlinePlayers.size) return;

      const row = await this.bridge.fetchWorld(false);
      const state = row.state;
      // Si Supabase no respondió y no hay copia en caché, el bot NO sabe en qué era están:
      // en ese caso no castiga nada que dependa de la era (Nether, End, aldeanos antes de la ERA V).
      const eraKnown = row.id !== 'local-fallback';
      this.eraKnown = eraKnown;
      // Fase A: leer y limpiar contadores de todos para registrar ventanas de entrega de MythStorm y Scadrial0523
      const tickScores = new Map();
      for (const p of this.onlinePlayers) {
        const raw = await this.rcon.send(`scoreboard players list ${p}`);
        const scores = this.parseScores(raw);
        const keys = Object.keys(scores);
        if (keys.length) {
          await this.resetScores(p, keys);
          this.recordRoleDrops(this.getPlayerRole(p, state), scores);
        }
        tickScores.set(p, scores);
      }
      if (this.drainNextPoll) {
        this.drainNextPoll = false;
        console.log('[Enforcer] Vigilancia reanudada: marcadores de la pausa vaciados sin sancionar.');
        return;
      }

      // Fase B: evaluar infracciones con ventanas de entrega ya actualizadas
      for (const [p, scores] of tickScores.entries()) {
        if (Object.keys(scores).length) {
          await this.inspectPlayer(p, state, scores);
        }
        if (this.tickNum % 4 === 0 && eraKnown) {
          await this.checkDimensions(p, this.getPlayerRole(p, state), state);
        }
      }

      // Fase C: vigilancia PvP OOC (sin confiscación de inventario)
      if (tickScores.size >= 2) {
        await this.checkPvpTick(tickScores, state);
      }
    } catch (err) {
      console.warn('[Enforcer poll]', err.message);
    } finally {
      this.polling = false;
    }
  }

  async start() {
    await this.initObjectives();
    if (this.objectivesReady) {
      await this.syncOnlinePlayers();
      console.log(`[Enforcer] Jugadores en línea detectados al inicio: ${[...this.onlinePlayers].join(', ') || 'ninguno'}`);
      for (const p of this.onlinePlayers) this.deliverPendingCustody(p).catch(() => {});
    } else {
      console.log('[Enforcer] En espera: activará los marcadores automáticamente cuando el servidor Minecraft abra RCON.');
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => { this.pollOnce(); }, this.pollMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
