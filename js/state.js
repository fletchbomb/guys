/* SCRAPWALKER — state.js
   The single plain state object (§10.1) + the intent queue (§10.3).
   Renderers only read G.state; all input goes through G.submitIntent().

   v5: the mech GROWS. You start with 5 rooms; shrines on the surface graft
   new rooms on (head, orbitals, medbay, then three new Megabonk-pattern
   weapon rooms). Bosses arrive on a cycle with high-value cache drops.
   Four new alien mobs. Bruiser telegraphs removed — alerts are only for
   things actually happening. */

window.G = (function () {

  const CONFIG = {
    TICK: 1 / 60,
    ARENA_R: 118,
    HP: 100,
    REACTOR_PIPS: 4,
    MAX_PIPS: 12,
    GOBLIN_HP: 30,
    GOBLIN_HOP: 1.0,
    MAX_GOBLINS: 6,
    /* --- crisis pacing --- */
    INTRUDER_HP: 55,
    INTRUDER_DPS: 4.5,
    RUNT_HP: 25,
    RUNT_DPS: 3,
    GOBLIN_DPS: 5,
    INTRUDER_HOP: 1.6,
    INTRUDER_SABOTAGE: 0.12,
    DOOR_BASH: 5,
    FIRE_GOBLIN_DPS: 2,
    FIRE_FIGHT_RATE: 0.05,
    FIRE_GROW: 0.04,
    FIRE_SYS_DPS: 0.05,
    FIRE_SPREAD_EVERY: 10,
    REPAIR_RATE: 0.18,
    WELD_TIME: 14,
    LEAK_WELD_TIME: 5,
    LEAK_DRAIN: 0.05,
    HEAL_RATE: 6,
    HULL_REPAIR_RATE: 0.5,     // REPAIR RIG: hull hp/s per pip (manned x1.5)
    SUFFOCATE_DPS: 2.5,
    AIR_THRESHOLD: 0.25,
    AIR_BREACH_DRAIN: 0.10,
    AIR_VENT_DRAIN: 0.25,
    AIR_REGEN: 0.05,
    AIR_DECAY: 0.008,
    DOOR_FLOW: 0.5,
    /* --- hazard director --- */
    HAZARD_FIRST: 35,
    HAZARD_MIN: 30, HAZARD_VAR: 25,
    HAZARD_WARN: 3,
    SQUALL_TIME: 15,
    PARASITE_CHANCE: 0.25,
    PARASITE_RANGE: 12,
    /* --- shrines: channel to graft a new room onto the mech --- */
    SHRINE_FIRST: 45,
    SHRINE_EVERY: 55,          // after a graft completes
    SHRINE_RADIUS: 9,
    SHRINE_CHANNEL: 7,         // seconds standing inside
    SHRINE_SALVAGE: 30,        // reward once fully grown
    /* --- enemies: unlockAt gates the spawn table --- */
    ENEMY: {
      swarmer: { dmg: 2,  hp: 12,  spd: 6.5,  r: 0.9, salv: 1,  salvC: 0.65, unlockAt: 0 },
      runner:  { dmg: 6,  hp: 20,  spd: 12.5, r: 0.9, salv: 3,  salvC: 1.0,  unlockAt: 28 },
      bruiser: { dmg: 15, hp: 130, spd: 5.4,  r: 2.2, salv: 10, salvC: 1.0,  unlockAt: 70 },
      spitter: { dmg: 4,  hp: 40,  spd: 5.5,  r: 1.1, salv: 4,  salvC: 1.0,  unlockAt: 130 },
      brood:   { dmg: 8,  hp: 90,  spd: 3.2,  r: 1.8, salv: 6,  salvC: 1.0,  unlockAt: 150 },
      charger: { dmg: 5,  hp: 60,  spd: 6.0,  r: 1.2, salv: 5,  salvC: 1.0,  unlockAt: 190 },
      boss:    { dmg: 22, hp: 2200, spd: 3.4, r: 3.5, salv: 0,  salvC: 0,    unlockAt: 1e9 },
    },
    SPIT_DMG: 8, SPIT_SPEED: 18, SPIT_RANGE: 22, SPIT_CD: 3,
    CHARGE_SPEED: 42, CHARGE_DMG: 14, CHARGE_WINDUP: 0.8, CHARGE_TIME: 1.0,
    BROOD_SPLIT: 5,
    BOSS_FIRST: 180, BOSS_EVERY: 100,
    BOSS_CACHE: 40,            // guaranteed high-value drop
    CACHE_CHANCE: 0.06,        // rare cache from bruisers+
    CACHE_VALUE: 25,
    HEAL_CHANCE: 0.03,         // rare hull-patch drop from any kill
    HEAL_VALUE: 8,
    BRUISER_CRISIS_CHANCE: 0.65,
    FALLBACK_CD: 1.0,
    FALLBACK_DMG: 4,
    FALLBACK_RANGE: 22,
    BOLT_SPEED: 62,
    PICKUP_MAGNET: 8,
    MAGNET_STEP: 4,            // Scrap Magnet pick: +collection range
    CRIT_BASE: 0.07,          // baseline crit chance on discrete weapon hits
    CRIT_MULT: 2.0,           // crit damage multiplier
    CRIT_STEP: 0.09,          // Targeting Array pick: +crit chance
    RAMP_EVERY: 30,
    THROTTLE: 4.5,
    PICK_BASE: 22,
    PICK_GROW: 1.35,
    LEVEL_HP: 8,               // every level-up toughens the hull a little
  };

  /* ---------- rooms ----------
     Base rooms have fixed rects + neighbors. Grafts have NO position until
     the crew places them on a free GRAFT_SLOT that shares a wall with a
     built room ("the doors line up") — adjacency is derived from geometry. */
  const ROOM_DEFS = {
    // starting body (headless little brute)
    armGun:       { name: 'ARM GUN',      sys: 'weapon',  weapon: 'armGun',          tier: 1, slots: 2, station: 0,    built: true,  rect: [250, 130, 100, 50],  neighbors: ['reactor', 'shields'] },
    reactor:      { name: 'REACTOR',      sys: 'reactor', weapon: null,              tier: 0, slots: 4, station: null, built: true,  rect: [350, 130, 100, 100], neighbors: ['armGun', 'air'] },
    shields:      { name: 'SHIELDS',      sys: 'shield',  weapon: 'shieldShockwave', tier: 1, slots: 4, station: 0,    built: true,  rect: [250, 180, 100, 100], neighbors: ['armGun', 'air'] },
    air:          { name: 'AIR',          sys: 'air',     weapon: null,              tier: 1, slots: 2, station: 0,    built: true,  rect: [350, 230, 100, 50],  neighbors: ['reactor', 'shields', 'legs'] },
    legs:         { name: 'LEGS',         sys: 'leg',     weapon: 'fireTrail',       tier: 1, slots: 4, station: 0,    built: true,  rect: [350, 280, 100, 100], neighbors: ['air'] },
    // grafts (shrine rewards, in order; crew chooses the slot)
    head:         { name: 'HEAD',         sys: 'head',    weapon: 'headFlame',       tier: 1, slots: 2, station: 0,    built: false, rect: null, neighbors: [] },
    coreOrbitals: { name: 'CORE ORBITALS',sys: 'weapon',  weapon: 'coreOrbitals',    tier: 1, slots: 2, station: 0,    built: false, rect: null, neighbors: [] },
    medbay:       { name: 'MEDBAY',       sys: 'medbay',  weapon: null,              tier: 1, slots: 2, station: null, built: false, rect: null, neighbors: [] },
    repair:       { name: 'REPAIR RIG',   sys: 'repair',  weapon: null,              tier: 1, slots: 2, station: 0,    built: false, rect: null, neighbors: [] },
    mortar:       { name: 'SPIKE MORTAR', sys: 'weapon',  weapon: 'mortar',          tier: 1, slots: 2, station: 0,    built: false, rect: null, neighbors: [] },
    zapper:       { name: 'ZAP COIL',     sys: 'weapon',  weapon: 'zapper',          tier: 1, slots: 2, station: 0,    built: false, rect: null, neighbors: [] },
    sawWing:      { name: 'SAW WING',     sys: 'weapon',  weapon: 'sawWing',         tier: 1, slots: 2, station: 0,    built: false, rect: null, neighbors: [] },
    armGun2:      { name: 'SECOND ARM',   sys: 'weapon',  weapon: 'armGun2',         tier: 1, slots: 2, station: 0,    built: false, rect: null, neighbors: [] },
    treads:       { name: 'TREADS',       sys: 'tread',   weapon: 'treadRam',        tier: 1, slots: 2, station: 0,    built: false, rect: null, neighbors: [] },
  };
  const ROOM_IDS = Object.keys(ROOM_DEFS);
  const EXPANSION_ORDER = ['head', 'coreOrbitals', 'medbay', 'repair', 'mortar', 'zapper', 'sawWing', 'armGun2', 'treads'];
  const AIRLOCK_ROOMS = ['armGun', 'legs'];
  // where grafts may be welded on (all 2-slot pads around the base body)
  const GRAFT_SLOTS = {
    n:  [350, 80, 100, 50],
    ne: [450, 80, 100, 50],
    e:  [450, 130, 100, 100],
    w:  [150, 180, 100, 50],
    se: [450, 230, 100, 50],
    sw: [150, 230, 100, 50],
    s:  [450, 280, 100, 50],
    s2: [250, 280, 100, 50],
  };
  // each part's suggested home on the body plan — the AI (and the placement UI's
  // default highlight) prefer it, but the human crew can weld anywhere valid.
  const HOME_SLOT = {
    head: 'n', coreOrbitals: 'e', medbay: 'se', sawWing: 's',
    mortar: 'w', repair: 'sw', zapper: 's2', armGun2: 'ne',
    // treads has no fixed home — it goes wherever the crew welds it (best-connected for AI)
  };
  // shared wall long enough for a doorway (one full tile)
  function sharedWall(a, b) {
    if (a[0] + a[2] === b[0] || b[0] + b[2] === a[0]) {
      return Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]) >= 50;
    }
    if (a[1] + a[3] === b[1] || b[1] + b[3] === a[1]) {
      return Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]) >= 50;
    }
    return false;
  }
  // built rooms whose wall lines up with a candidate rect (a doorway can join them)
  function geoNeighbors(s, rect, excludeId) {
    const out = [];
    for (const id of ROOM_IDS) {
      if (id === excludeId) continue;
      const r = s.rooms[id];
      if (!r.built || !r.rect) continue;
      if (sharedWall(rect, r.rect)) out.push(id);
    }
    return out;
  }
  function slotTaken(s, rect) {
    for (const id of ROOM_IDS) {
      const r = s.rooms[id];
      if (r.built && r.rect && r.rect[0] === rect[0] && r.rect[1] === rect[1]) return true;
    }
    return false;
  }
  // graft pads the crew may weld the pending room onto: free, and touching the body
  function validGraftSlots(s) {
    const out = [];
    for (const key in GRAFT_SLOTS) {
      const rect = GRAFT_SLOTS[key];
      if (slotTaken(s, rect)) continue;
      if (geoNeighbors(s, rect).length === 0) continue;
      out.push({ key, rect: rect.slice() });
    }
    return out;
  }

  /* ---------- weapons: Megabonk patterns, output scales per pip ---------- */
  const WEAPON_DEFS = {
    armGun: {
      name: 'BOLTER', source: 'basic projectile', room: 'armGun', pattern: 'projectile',
      cooldown: 0.42, damage: 9, range: 28,
    },
    coreOrbitals: {
      name: 'ORBIT', source: 'Chunkers', room: 'coreOrbitals', pattern: 'orbital',
      damage: 10, radius: 5.5, knockback: 8, hitCooldown: 0.35, spin: 2.8,
    },
    fireTrail: {
      name: 'TRAIL', source: 'Flamewalker', room: 'legs', pattern: 'trail',
      spawnEvery: 0.18, damagePerSecond: 12, radius: 2.2, life: 2.2,
    },
    shieldShockwave: {
      name: 'AEGIS', source: 'Aegis', room: 'shields', pattern: 'shieldShockwave',
      damage: 18, radius: 8, knockback: 14,
    },
    headFlame: {
      name: 'FLAME', source: "Dragon's Breath", room: 'head', pattern: 'cone',
      cooldown: 2.1, damage: 24, range: 15, angle: 0.75,
    },
    mortar: {
      name: 'MORTAR', source: 'lobbed explosive', room: 'mortar', pattern: 'lob',
      cooldown: 3.2, damage: 30, radius: 6, range: 45, flightTime: 0.9,
    },
    zapper: {
      name: 'ZAP', source: 'chain lightning', room: 'zapper', pattern: 'chain',
      cooldown: 2.6, damage: 14, range: 24, chainRange: 9, chains: 3,
    },
    sawWing: {
      name: 'SAW', source: 'returning blade', room: 'sawWing', pattern: 'boomerang',
      cooldown: 3.5, damage: 16, reach: 25, flightTime: 1.6, radius: 1.6,
    },
    armGun2: {
      name: 'TWIN BOLT', source: 'second gun-arm', room: 'armGun2', pattern: 'projectile',
      cooldown: 0.42, damage: 9, range: 28,
    },
    treadRam: {
      name: 'RAM AURA', source: 'crushing treads', room: 'treads', pattern: 'aura',
      damagePerSecond: 15, radius: 7,
    },
  };
  const WEAPON_ORDER = ['armGun', 'coreOrbitals', 'fireTrail', 'shieldShockwave', 'headFlame', 'mortar', 'zapper', 'sawWing', 'armGun2', 'treadRam'];

  const GOBLIN_NAMES = ['Grub', 'Sprocket', 'Nixie', 'Bolt', 'Wick', 'Tansy', 'Gizmo', 'Pip'];

  let goblinSeq = 0, intruderSeq = 0;
  function makeGoblin(room, slot) {
    return {
      id: 'g' + (goblinSeq++),
      name: GOBLIN_NAMES[(goblinSeq - 1) % GOBLIN_NAMES.length],
      hp: CONFIG.GOBLIN_HP, maxHp: CONFIG.GOBLIN_HP,
      room, slot: slot == null ? 0 : slot,
      dest: room,
      path: [],
      hopT: 0,
      hopFrom: room,
      task: 'idle',
      animT: Math.random() * 10,
      flashT: 0,
    };
  }
  function makeIntruder(room, slot, runt) {
    const hp = runt ? CONFIG.RUNT_HP : CONFIG.INTRUDER_HP;
    return {
      id: 'iv' + (intruderSeq++),
      hp, maxHp: hp,
      dps: runt ? CONFIG.RUNT_DPS : CONFIG.INTRUDER_DPS,
      runt: !!runt,
      room, slot,
      path: [],
      hopT: 0,
      bashT: 0,
      atkT: 0,
      flash: 0,
      animT: 0,
    };
  }

  function doorKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }

  function makeRooms() {
    const rooms = {};
    for (const id in ROOM_DEFS) {
      const d = ROOM_DEFS[id];
      rooms[id] = {
        id, name: d.name, sys: d.sys, weapon: d.weapon,
        neighbors: d.neighbors.slice(),
        rect: d.rect ? d.rect.slice() : null,   // grafts get theirs when placed
        tier: d.tier,
        slots: d.slots, station: d.station,
        built: d.built,
        builtT: d.built ? -10 : 0,   // sim time when grafted (render flash)
        power: 0,
        damage: 0,
        fire: 0,
        breach: false,
        leak: false,
        weld: 0,
        air: 1,
        spreadT: 0,
      };
    }
    return rooms;
  }

  function makeDoors() {
    const doors = {};
    const seen = new Set();
    for (const id in ROOM_DEFS) {
      for (const n of ROOM_DEFS[id].neighbors) {
        const key = doorKey(id, n);
        if (!seen.has(key)) { seen.add(key); doors[key] = { open: true }; }
      }
    }
    return doors;
  }

  function makeAirlocks() {
    const locks = {};
    for (const id of AIRLOCK_ROOMS) locks[id] = { open: false };
    return locks;
  }

  function newState() {
    goblinSeq = 0; intruderSeq = 0;
    const rooms = makeRooms();
    rooms.armGun.power = 1; rooms.shields.power = 1;
    rooms.legs.power = 1; rooms.air.power = 1;

    return {
      t: 0, over: false, started: false,
      kills: 0, level: 1,
      hp: CONFIG.HP, maxHp: CONFIG.HP, regen: 0,
      salvage: 0,
      magnet: CONFIG.PICKUP_MAGNET,
      critChance: CONFIG.CRIT_BASE,
      humanSide: 'big',
      big: {
        x: 0, z: 0, fx: 0, fz: 1,
        baseSpeed: 14,
        moveX: 0, moveZ: 0,
        hitFlash: 0, shake: 0, dodgeFlash: 0,
      },
      shield: { layers: 1, regenT: 0 },
      reactor: { pips: CONFIG.REACTOR_PIPS },
      rooms,
      doors: makeDoors(),
      airlocks: makeAirlocks(),
      goblins: [
        makeGoblin('armGun', 0),
        makeGoblin('shields', 0),
        makeGoblin('legs', 0),
      ],
      intruders: [],
      weapons: {
        armGun: { cd: 0 },
        armGun2: { cd: 0 },
        headFlame: { cd: 0 },
        coreOrbitals: { angle: 0 },
        mortar: { cd: 0 },
        zapper: { cd: 0 },
        sawWing: { cd: 0 },
        treadRam: { cd: 0 },
        fallback: { cd: 0 },
      },
      trails: [],
      saws: [],          // returning blades {x,z,t,dirX,dirZ}
      lobs: [],          // mortar spikes in flight {x,z,tx,tz,t}
      globs: [],         // enemy acid {x,z,vx,vz,life}
      enemies: [],
      bolts: [],
      pickups: [],       // {kind:'salv'|'cache'|'heal', x,z,v,seed}
      fx: [],
      shrine: null,      // {x,z,progress} — channel it for an instant level-up
      pendingGraft: null,// {room} chosen at level-up, awaiting the crew to weld it on
      shrineT: CONFIG.SHRINE_FIRST,
      bossT: CONFIG.BOSS_FIRST,
      spawn: { timer: 1.2, ramp: 0, rampT: CONFIG.RAMP_EVERY },
      levelUp: { pending: false, free: false, options: null, throttle: 0, aiT: 0, need: CONFIG.PICK_BASE },
      hazard: { t: CONFIG.HAZARD_FIRST, warn: null, squallT: 0, squallRollT: 0 },
      toasts: [],
      stats: { crisesSurvived: 0, shockwaves: 0, flameBursts: 0, vented: 0, events: 0, bosses: 0, roomsGrown: 0 },
    };
  }

  /* ================= derived getters ================= */

  function roomCap(r) { return r.built ? Math.max(0, r.tier - Math.floor(r.damage)) : 0; }
  function roomEffPower(r) { return Math.min(r.power, roomCap(r)); }
  function pipEff(pips) { return [0, 1, 1.55, 2.0][Math.min(3, Math.max(0, pips))]; }

  function builtIds(s) { return ROOM_IDS.filter(id => s.rooms[id].built); }
  function builtNeighbors(s, id) { return s.rooms[id].neighbors.filter(n => s.rooms[n].built); }
  function nextExpansion(s) { return EXPANSION_ORDER.find(id => !s.rooms[id].built) || null; }

  function settledGoblinsIn(s, id) {
    return s.goblins.filter(g => g.room === id && g.path.length === 0);
  }
  function intrudersIn(s, id) {
    return s.intruders.filter(iv => iv.room === id && iv.path.length === 0);
  }
  function occupantsIn(s, id) {
    return settledGoblinsIn(s, id).length + intrudersIn(s, id).length;
  }
  function usedSlots(s, id) {
    const used = new Set();
    for (const g of settledGoblinsIn(s, id)) used.add(g.slot);
    for (const iv of intrudersIn(s, id)) used.add(iv.slot);
    return used;
  }
  function firstFreeSlot(s, id, preferStation) {
    const r = s.rooms[id];
    if (!r.built) return null;
    const used = usedSlots(s, id);
    if (preferStation && r.station != null && !used.has(r.station)) return r.station;
    for (let i = 0; i < r.slots; i++) if (!used.has(i)) return i;
    return null;
  }
  function roomHasFreeSlot(s, id) { return s.rooms[id].built && occupantsIn(s, id) < s.rooms[id].slots; }

  function roomInCrisis(s, r) { return intrudersIn(s, r.id).length > 0 || r.fire > 0.05 || r.breach; }

  function roomManned(s, id) {
    const r = s.rooms[id];
    if (!r.built || r.station == null) return false;
    if (roomInCrisis(s, r) || r.damage >= 0.5) return false;
    return settledGoblinsIn(s, id).some(g => g.slot === r.station);
  }

  function systemActive(s, id) {
    const r = s.rooms[id];
    return r.built && roomCap(r) > 0 && roomEffPower(r) >= 1;
  }

  function weaponActive(s, weaponId) {
    const def = WEAPON_DEFS[weaponId];
    const r = s.rooms[def.room];
    if (!r || !r.built) return false;
    if (!systemActive(s, def.room)) return false;
    if (roomInCrisis(s, r)) return false;
    return true;
  }

  function legBonus(s) {
    let spd = 0, dodge = 0;
    const r = s.rooms.legs;
    const pips = roomEffPower(r);
    if (systemActive(s, 'legs')) {
      spd = 0.10 * pips; dodge = 0.08 * pips;
      if (roomManned(s, 'legs')) { spd += 0.06; dodge += 0.05; }
    }
    return { spd, dodge: Math.min(0.55, dodge) };
  }

  function shieldMax(s) {
    const r = s.rooms.shields;
    return Math.min(roomEffPower(r), roomCap(r));
  }
  function shieldRegenTime(s) { return roomManned(s, 'shields') ? 2.2 : 4.2; }

  /* ---------- intents ---------- */
  const intents = [];
  function submitIntent(intent) { intents.push(intent); }
  function drainIntents() { const out = intents.slice(); intents.length = 0; return out; }

  /* ---------- toasts ---------- */
  function toast(s, side, msg, cls) {
    s.toasts.push({ side, msg, cls: cls || '', t: 3.6, id: Math.random() });
    if (s.toasts.length > 5) s.toasts.shift();
  }

  return {
    CONFIG, ROOM_DEFS, ROOM_IDS, WEAPON_DEFS, WEAPON_ORDER, AIRLOCK_ROOMS, EXPANSION_ORDER,
    GRAFT_SLOTS, HOME_SLOT,
    state: null,
    newState, makeGoblin, makeIntruder, doorKey,
    geoNeighbors, validGraftSlots,
    roomCap, roomEffPower, pipEff,
    builtIds, builtNeighbors, nextExpansion,
    settledGoblinsIn, intrudersIn, occupantsIn, usedSlots, firstFreeSlot, roomHasFreeSlot,
    roomInCrisis, roomManned, systemActive, weaponActive,
    legBonus, shieldMax, shieldRegenTime,
    submitIntent, drainIntents, toast,
  };
})();

G.state = G.newState();
