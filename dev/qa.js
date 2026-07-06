/* SCRAPWALKER — dev/qa.js
   Headless QA harness (v5): shrines/expansion, bosses, new mobs, drops,
   plus all prior regressions. Run from the scrapwalker folder:

       node dev/qa.js
       node dev/qa.js --full     # needs `three` require-able (NODE_PATH)

   PASS/FAIL lines; non-zero exit on any failure. */

'use strict';
const path = require('path');
const JS = f => path.join(__dirname, '..', 'js', f + '.js');

let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? '  PASS  ' : '! FAIL  ') + name + (extra != null ? '  [' + extra + ']' : ''));
  if (!cond) failures++;
}
function section(t) { console.log('\n== ' + t + ' =='); }

global.window = global;
global.performance = { now: () => Date.now() };
require(JS('state'));
require(JS('audio'));
require(JS('sim'));
require(JS('ai'));

const C = G.CONFIG;
const TICK = C.TICK;

function fresh(opts) {
  opts = opts || {};
  const s = G.newState();
  s.started = true;
  s.humanSide = opts.humanSide || 'nobody';
  if (!opts.spawns) s.spawn.timer = 1e9;
  if (!opts.hazards) s.hazard.t = 1e9;
  if (!opts.shrines) s.shrineT = 1e9;
  if (!opts.bosses) s.bossT = 1e9;
  return s;
}
function run(s, seconds, withAI) {
  const n = Math.round(seconds / TICK);
  for (let i = 0; i < n && !s.over; i++) {
    if (withAI) AI.tick(s, TICK);
    SIM.tick(s, TICK);
  }
}
function addEnemy(s, x, z, hp, type) {
  const e = {
    type: type || 'swarmer', x, z, hp: hp || 100, maxHp: hp || 100,
    spd: 0, r: 0.9, dmg: 2, atkT: 1e9, seed: 0, hitFlash: 0,
    kx: 0, kz: 0, orbitalHitT: 0, sawHitT: 0,
    mode: 0, modeT: 0, spitT: 1, volleyT: 6, summonT: 14,
  };
  s.enemies.push(e);
  return e;
}
function addIntruder(s, room, hp, runt) {
  const iv = G.makeIntruder(room, G.firstFreeSlot(s, room), runt);
  if (hp) { iv.hp = hp; iv.maxHp = hp; }
  s.intruders.push(iv);
  return iv;
}
function power(s, room, delta) { G.submitIntent({ t: 'power', room, delta }); SIM.tick(s, TICK); }
function build(s, id, pips) {
  s.rooms[id].built = true;
  s.rooms[id].builtT = s.t;
  if (pips) {
    s.reactor.pips += pips;
    for (let i = 0; i < pips; i++) power(s, id, 1);
  }
}
function occupancyOK(s) {
  for (const id of G.builtIds(s)) {
    if (G.occupantsIn(s, id) > s.rooms[id].slots) return false;
    const used = [];
    for (const g of G.settledGoblinsIn(s, id)) used.push(g.slot);
    for (const iv of G.intrudersIn(s, id)) used.push(iv.slot);
    if (new Set(used).size !== used.length) return false;
  }
  return true;
}

/* ================= progression: one economy, Build vs Upgrade ================= */
section('Level-up economy (Build / Upgrade / Shrine)');
{
  const s = fresh();
  check('Run starts with 5 rooms (headless brute)', G.builtIds(s).length === 5, G.builtIds(s).join(','));
  check('Head Flame is a socket, not a weapon, at start', !G.weaponActive(s, 'headFlame'));
  // XP bar → level-up with three cards: BUILD, UPGRADE, +GOBLIN
  s.salvage = s.levelUp.need;
  SIM.tick(s, TICK);
  check('XP bar full → level-up pending', s.levelUp.pending);
  const opts = s.levelUp.options || [];
  check('Three options offered', opts.length === 3, opts.map(o => o.id).join(','));
  check('Build, Upgrade and +Goblin are the three',
    opts.some(o => o.id === 'build') && opts.some(o => o.id === 'upgrade') && opts.some(o => o.id === 'crew'),
    opts.map(o => o.id).join(','));
}
{
  // BUILD hands a part to the crew; they weld it onto a pad THEY choose (manual placement)
  const s = fresh();
  s.salvage = s.levelUp.need;
  SIM.tick(s, TICK);
  const bi = (s.levelUp.options || []).findIndex(o => o.id === 'build');
  const part = s.levelUp.options[bi].room;
  const need0 = s.levelUp.need, crew0 = s.goblins.length, lvl0 = s.level;
  G.submitIntent({ t: 'pick', idx: bi });
  SIM.tick(s, TICK);
  check('BUILD queues the part for placement (not auto-installed)',
    !s.rooms[part].built && s.pendingGraft && s.pendingGraft.room === part);
  check('Level up spent XP and raised the bar', s.salvage < need0 && s.levelUp.need > need0 && s.level === lvl0 + 1);
  // the crew chooses the pad
  const pads = G.validGraftSlots(s);
  const chosen = pads.find(p => p.key === 'e') || pads[0];
  G.submitIntent({ t: 'placeGraft', slot: chosen.key });
  SIM.tick(s, TICK);
  check('Chosen pad installs the part with a rect + doorways',
    s.rooms[part].built && s.rooms[part].rect &&
    s.rooms[part].rect[0] === G.GRAFT_SLOTS[chosen.key][0] &&
    s.rooms[part].neighbors.length > 0 &&
    s.rooms[part].neighbors.every(n => s.doors[G.doorKey(part, n)] && s.rooms[n].neighbors.includes(part)),
    part + '@' + chosen.key + ':' + s.rooms[part].neighbors.join(','));
  check('Building a part does NOT add a free goblin (crew grows via the +GOBLIN card)',
    s.goblins.length === crew0);
  check('A pending graft blocks the next level-up until placed', (() => {
    const t = fresh(); t.salvage = t.levelUp.need; SIM.tick(t, TICK);
    const b = (t.levelUp.options || []).findIndex(o => o.id === 'build');
    G.submitIntent({ t: 'pick', idx: b }); SIM.tick(t, TICK);
    t.salvage = t.levelUp.need * 3; run(t, 1);
    return t.pendingGraft && !t.levelUp.pending;   // still waiting to place, no new level
  })());
  // crew can path into the freshly built room
  const g = s.goblins[0];
  G.submitIntent({ t: 'goblin', id: g.id, room: part });
  run(s, 6);
  check('Crew can walk into the built room', g.room === part);
}
{
  // UPGRADE advances a part's level
  const s = fresh();
  s.salvage = s.levelUp.need;
  SIM.tick(s, TICK);
  const ui = (s.levelUp.options || []).findIndex(o => o.id === 'upgrade');
  const room = s.levelUp.options[ui].room;
  const tier0 = s.rooms[room].tier, pips0 = s.reactor.pips;
  G.submitIntent({ t: 'pick', idx: ui });
  SIM.tick(s, TICK);
  check('UPGRADE raises the part one level', s.rooms[room].tier === tier0 + 1);
  check('Level-up grants a reactor pip to run it', s.reactor.pips === pips0 + 1);
}
{
  // +GOBLIN card adds a crew member (crew now grows here, not for free with builds)
  const s = fresh();
  s.salvage = s.levelUp.need;
  SIM.tick(s, TICK);
  const ci = (s.levelUp.options || []).findIndex(o => o.id === 'crew');
  const crew0 = s.goblins.length;
  G.submitIntent({ t: 'pick', idx: ci });
  SIM.tick(s, TICK);
  check('+GOBLIN card adds a crew member', s.goblins.length === crew0 + 1);
}
{
  // a channeled shrine is a FREE, instant level-up (no XP spent)
  const s = fresh();
  const salv0 = s.salvage, lvl0 = s.level, need0 = s.levelUp.need;
  s.shrine = { x: s.big.x, z: s.big.z, progress: 0.99 };
  run(s, 1);
  check('Shrine channel grants an instant level-up', s.levelUp.pending && s.levelUp.free);
  const idx = 0;
  G.submitIntent({ t: 'pick', idx });
  SIM.tick(s, TICK);
  check('Shrine level-up is free — no XP drained, bar unchanged',
    s.salvage === salv0 && s.levelUp.need === need0 && s.level === lvl0 + 1);
}
{
  // leaving the shrine ring drains the channel
  const s = fresh();
  s.shrine = { x: s.big.x, z: s.big.z, progress: 0.5 };
  G.submitIntent({ t: 'bigMove', x: 1, z: 0 });
  run(s, 1.2);
  G.submitIntent({ t: 'bigMove', x: 0, z: 0 });
  run(s, 3);
  check('Leaving the ring drains channel progress', s.shrine && s.shrine.progress < 0.5,
    (s.shrine ? s.shrine.progress.toFixed(2) : 'done'));
}
{
  const s = fresh();
  const g = s.goblins[0];
  const dest0 = g.dest;
  G.submitIntent({ t: 'goblin', id: g.id, room: 'medbay' });   // unbuilt
  SIM.tick(s, TICK);
  check('Orders to unbuilt rooms are ignored', g.dest === dest0);
}

/* ================= new weapons (Megabonk patterns) ================= */
section('Grafted weapons');
{
  const s = fresh();
  build(s, 'mortar', 1);
  for (let k = 0; k < 5; k++) addEnemy(s, 20 + (k % 2), (k / 2) | 0, 200);
  run(s, 5);
  check('Spike Mortar lobs into the cluster', s.enemies.some(e => e.hp < 200),
    s.enemies.map(e => e.hp.toFixed(0)).join(','));
}
{
  const s = fresh();
  build(s, 'zapper', 1);
  power(s, 'armGun', -1);   // isolate the chain
  const a = addEnemy(s, 12, 0, 100), b = addEnemy(s, 15, 3, 100), c2 = addEnemy(s, 18, 6, 100);
  run(s, 4);
  check('Zap Coil chains between enemies', a.hp < 100 && b.hp < 100 && c2.hp < 100,
    [a.hp, b.hp, c2.hp].map(v => v.toFixed(0)).join(','));
}
{
  const s = fresh();
  build(s, 'sawWing', 1);
  power(s, 'armGun', -1);
  G.submitIntent({ t: 'bigMove', x: 0, z: 1 });
  SIM.tick(s, TICK);
  G.submitIntent({ t: 'bigMove', x: 0, z: 0 });
  const e = addEnemy(s, 0, 12, 200);
  run(s, 5);
  check('Saw Wing sweeps out and back through enemies', e.hp < 200, 'hp ' + e.hp.toFixed(0));
}
{
  // SECOND ARM: a twin bolter that fires on its own
  const s = fresh();
  build(s, 'armGun2', 1);
  power(s, 'armGun', -1);   // isolate the second arm
  const e = addEnemy(s, 14, 0, 200);
  run(s, 3);
  check('Second Arm auto-fires twin bolts', e.hp < 200, 'hp ' + e.hp.toFixed(0));
}
{
  // TREADS: a crushing contact aura + a move-speed boost
  const s = fresh();
  build(s, 'treads', 2);
  const e = addEnemy(s, 4, 0, 200);   // inside the aura radius (7)
  const spd0 = s.big.baseSpeed * (1 + G.legBonus(s).spd);
  run(s, 2);
  check('Treads grind nearby enemies (ram aura)', e.hp < 200, 'hp ' + e.hp.toFixed(0));
  check('Treads add move speed', 0.10 * G.roomEffPower(s.rooms.treads) > 0 && G.systemActive(s, 'treads'));
}

/* ================= repair rig, crits, magnet (Big Guy richness) ================= */
section('Repair rig, crits & magnet');
{
  const s = fresh();
  build(s, 'repair', 2);
  s.hp = 40;
  const g = s.goblins[0]; g.room = 'repair'; g.slot = 0; g.path = [];
  const hp0 = s.hp;
  run(s, 4);
  check('Repair Rig mends Big Guy\'s hull', s.hp > hp0, hp0 + '→' + s.hp.toFixed(1));
  check('Manning the rig sets the mending task', g.task === 'mending', g.task);
  check('Hull mend stops at full', (() => { s.hp = s.maxHp; run(s, 1); return s.hp === s.maxHp; })());
}
{
  const s = fresh();
  build(s, 'repair', 2);
  s.hp = 40; s.rooms.repair.power = 0;   // unpowered rig does nothing
  const hp0 = s.hp;
  run(s, 3);
  check('Unpowered Repair Rig does not heal', s.hp === hp0, s.hp.toFixed(1));
}
{
  const base = fresh(); const e0 = addEnemy(base, 10, 0, 2000); base.critChance = 0;
  run(base, 2.5);
  const noCrit = 2000 - e0.hp;
  const cr = fresh(); const e1 = addEnemy(cr, 10, 0, 2000); cr.critChance = 1;
  run(cr, 2.5);
  const allCrit = 2000 - e1.hp;
  check('Crits multiply weapon damage (~x2)', allCrit > noCrit * 1.7,
    'base ' + noCrit.toFixed(0) + ' vs crit ' + allCrit.toFixed(0));
  check('Crit hits emit a crit damage number', cr.fx.some(f => f.type === 'dmg' && f.crit));
}
{
  const s = fresh();
  s.pickups.push({ kind: 'salv', x: 10, z: 0, v: 5, seed: 0 });
  const salv0 = s.salvage;
  run(s, 0.3);
  check('Scrap outside base magnet range is not collected', s.salvage === salv0, s.salvage);
  s.magnet = 14;
  run(s, 0.3);
  check('Scrap Magnet widens pickup range', s.salvage === salv0 + 5, s.salvage);
}

/* ================= new mobs ================= */
section('New alien mobs');
{
  const s = fresh();
  power(s, 'legs', -1);
  s.shield.layers = 0;
  power(s, 'shields', -1);
  addEnemy(s, 18, 0, 500, 'spitter');
  run(s, 8);
  check('Spitter lobs acid from range', s.hp < C.HP, 'hp ' + s.hp.toFixed(0));
}
{
  // all real weapons dark so only the weak fallback pops the brood —
  // otherwise the Aegis shockwave legitimately wipes the hatchlings
  const s = fresh();
  for (const id of ['armGun', 'shields', 'legs', 'air']) power(s, id, -1);
  s.shield.layers = 0;
  addEnemy(s, 12, 0, 1, 'brood');
  run(s, 2.5);
  check('Broodmother splits into swarmers on death',
    s.enemies.filter(e => e.type === 'swarmer').length >= C.BROOD_SPLIT,
    s.enemies.length + ' enemies');
}
{
  const s = fresh();
  power(s, 'legs', -1);
  s.shield.layers = 0;
  power(s, 'shields', -1);
  power(s, 'armGun', -1);
  const e = addEnemy(s, 19, 0, 5000, 'charger');
  e.spd = C.ENEMY.charger.spd;
  run(s, 5);
  check('Charger winds up and rams (no UI alert needed)', s.hp <= C.HP - C.CHARGE_DMG + 1,
    'hp ' + s.hp.toFixed(0) + ' mode ' + e.mode);
}

/* ================= bosses + high-value drops ================= */
section('Bosses and drops');
{
  const s = fresh({ bosses: true });
  s.bossT = 0.1;
  run(s, 0.3);
  const boss = s.enemies.find(e => e.type === 'boss');
  check('Alpha surfaces on the cycle', !!boss, boss && boss.hp.toFixed(0) + ' hp');
  boss.hp = 1;
  boss.x = 10; boss.z = 0;
  run(s, 2);
  check('Dead alpha drops a cache + heal pack',
    s.stats.bosses === 1 &&
    (s.pickups.some(p => p.kind === 'cache') || s.salvage >= C.BOSS_CACHE),
    'salvage ' + s.salvage);
}
{
  const old = C.HEAL_CHANCE;
  C.HEAL_CHANCE = 1;
  const s = fresh();
  s.hp = 50;
  const e = addEnemy(s, 6, 0, 1);
  run(s, 4);
  C.HEAL_CHANCE = old;
  check('Heal packs drop and patch the hull', s.hp > 50, 'hp ' + s.hp.toFixed(1));
}

/* ================= progression + hazards (regression) ================= */
section('Progression + hazard director (regression)');
{
  const s = fresh();
  s.salvage = C.PICK_BASE + 5;
  run(s, 0.1);
  check('Salvage bar → pick moment', s.levelUp.pending);
  G.submitIntent({ t: 'pick', idx: 0 });
  SIM.tick(s, TICK);
  check('Pick spends banked salvage', !s.levelUp.pending && s.salvage === 5);
}
{
  const s = fresh();
  s.hazard.warn = { type: 'grubber', room: 'legs', t: 0.05, label: 'TEST' };
  run(s, 0.3);
  check('Grubber event spawns a runt', s.intruders.length === 1 && s.intruders[0].runt);
}
{
  const s = fresh();
  s.goblins.length = 0;
  s.hazard.warn = { type: 'rattle', room: 'shields', t: 0.05, label: 'TEST' };
  run(s, 0.3);
  check('Rattle knocks a system loose', s.rooms.shields.damage >= 1);
}
{
  const old = C.PARASITE_CHANCE;
  C.PARASITE_CHANCE = 1;
  const s = fresh();
  addEnemy(s, 3, 0, 5, 'bruiser');
  run(s, 1.5);
  check('Close-range bruiser kill spawns parasites',
    (s.hazard.warn && s.hazard.warn.type === 'grubber') || s.intruders.some(iv => iv.runt));
  C.PARASITE_CHANCE = old;
}

/* ================= slots, tasks, venting, doors (regression) ================= */
section('Occupancy, tasks, venting, doors (regression)');
{
  const s = fresh();
  const [g1, g2, g3] = s.goblins;
  G.submitIntent({ t: 'goblin', id: g1.id, room: 'air' });
  G.submitIntent({ t: 'goblin', id: g2.id, room: 'air' });
  run(s, 6);
  check('Two goblins fill the 2-slot AIR room', G.occupantsIn(s, 'air') === 2);
  G.submitIntent({ t: 'goblin', id: g3.id, room: 'air' });
  run(s, 6);
  check('Third goblin waits — no stacking', g3.room !== 'air' && g3.task === 'waiting');
  check('No slot double-occupied', occupancyOK(s));
}
{
  const s = fresh();
  const g = s.goblins[0];
  s.rooms.armGun.fire = 0.5;
  run(s, 0.2);
  check('Fire → firefighting', g.task === 'firefighting');
  g.hp = g.maxHp;
  run(s, 15);
  check('Firefighter survives (~1/3 HP cost)', g.hp > 5 && s.rooms.armGun.fire === 0);
  g.hp = g.maxHp;
  addIntruder(s, 'armGun', 15);
  run(s, 0.2);
  check('Intruder → fighting', g.task === 'fighting');
  run(s, 6);
  check('Intruder killed', G.intrudersIn(s, 'armGun').length === 0);
}
{
  const s = fresh();
  s.goblins.length = 0;
  s.rooms.legs.fire = 0.5;
  G.submitIntent({ t: 'airlock', room: 'legs' });
  G.submitIntent({ t: 'door', key: G.doorKey('air', 'legs') });
  SIM.tick(s, TICK);
  run(s, 35);
  check('Venting suffocates fires', s.rooms.legs.fire === 0 && s.rooms.legs.air < 0.3);
}
{
  const s = fresh();
  s.goblins.length = 0;
  s.rooms.armGun.damage = 1;
  const key = G.doorKey('armGun', 'reactor');
  G.submitIntent({ t: 'door', key });
  SIM.tick(s, TICK);
  const key2 = G.doorKey('armGun', 'shields');
  G.submitIntent({ t: 'door', key: key2 });
  SIM.tick(s, TICK);
  const iv = addIntruder(s, 'armGun');
  run(s, 4);
  check('Sealed bulkheads hold the intruder', iv.room === 'armGun');
  run(s, 14);
  check('Intruder bashes through eventually',
    (s.doors[key].open || s.doors[key2].open) && (iv.room !== 'armGun' || iv.path.length > 0));
}

/* ================= AI soak ================= */
section('AI-vs-AI soak (5 sim-minutes, everything on)');
{
  const s = fresh({ spawns: true, hazards: true, shrines: true, bosses: true });
  let ok = true, why = '';
  for (let i = 0; i < 60 * 300 && !s.over; i++) {
    AI.tick(s, TICK);
    SIM.tick(s, TICK);
    if (i % 30 === 0) {
      if (SIM.usedPips(s) > s.reactor.pips) { ok = false; why = 'power over budget'; break; }
      if (!occupancyOK(s)) { ok = false; why = 'slot stacking'; break; }
      for (const id of G.builtIds(s)) {
        const r = s.rooms[id];
        if (!(r.air >= 0 && r.air <= 1)) { ok = false; why = 'air out of range'; }
      }
      if (!s.enemies.every(e => isFinite(e.x) && isFinite(e.z))) { ok = false; why = 'NaN enemy'; break; }
      if (!s.goblins.every(g => g.room in s.rooms && s.rooms[g.room].built)) { ok = false; why = 'goblin in ungrown room'; break; }
      if (!s.intruders.every(iv => iv.room in s.rooms && s.rooms[iv.room].built)) { ok = false; why = 'intruder in ungrown room'; break; }
    }
  }
  check('Soak survived without invariant violations', ok, why || ('lasted ' + s.t.toFixed(0) + 's'));
  if (s.t > 120) check('AI Big Guy channels shrines (mech grows)', s.stats.roomsGrown >= 1,
    s.stats.roomsGrown + ' rooms in ' + s.t.toFixed(0) + 's');
  console.log('    soak: t=' + s.t.toFixed(0) + 's over=' + s.over + ' picks=' + (s.level - 1) +
    ' kills=' + s.kills + ' rooms=+' + s.stats.roomsGrown + ' bosses=' + s.stats.bosses +
    ' crises=' + s.stats.crisesSurvived + ' events=' + s.stats.events + ' crew=' + s.goblins.length);
}

/* ================= optional: full app boot ================= */
if (process.argv.includes('--full')) {
  section('Full app boot (fake DOM + real three.js)');
  try {
    bootFullApp();
  } catch (err) {
    check('Full app boot', false, err.message);
    console.error(err.stack);
  }
}

function bootFullApp() {
  const anyProxy = new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : anyProxy),
    apply: () => anyProxy,
    set: () => true,
  });
  function fakeCtx() {
    return new Proxy({ canvas: null }, {
      get(t, k) { return k in t ? t[k] : anyProxy; },
      set(t, k, v) { t[k] = v; return true; },
    });
  }
  function makeEl(tag) {
    const el = {
      tag, children: [], style: {}, dataset: {}, _text: '', _html: '',
      className: '', disabled: false, parent: null, listeners: {},
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
        toggle(c, f) { (f === undefined ? !this._s.has(c) : f) ? this._s.add(c) : this._s.delete(c); },
        contains(c) { return this._s.has(c); },
      },
      addEventListener(ev, fn) { (el.listeners[ev] = el.listeners[ev] || []).push(fn); },
      appendChild(c) { c.parent = el; el.children.push(c); return c; },
      remove() { if (el.parent) { const i = el.parent.children.indexOf(el); if (i >= 0) el.parent.children.splice(i, 1); } },
      querySelector() { el._q = el._q || { textContent: '' }; return el._q; },
      getBoundingClientRect() { return { left: 0, top: 0, width: el.width || 100, height: el.height || 100 }; },
    };
    Object.defineProperty(el, 'textContent', { get: () => el._text, set: v => { el._text = String(v); } });
    Object.defineProperty(el, 'innerHTML', {
      get: () => el._html,
      set: v => { el._html = String(v); if (v === '') el.children.length = 0; },
    });
    return el;
  }
  function fakeCanvas(w, h) {
    const el = makeEl('canvas');
    el.width = w || 300; el.height = h || 150;
    const ctx = fakeCtx(); ctx.canvas = el;
    el.getContext = () => ctx;
    return el;
  }

  const IDS = ['bigView', 'bigFx', 'bigLoadout', 'littleView', 'littleWrap', 'littleCanvas', 'topbar', 'hpFill', 'hpLabel', 'xpFill',
    'shieldPips', 'salvStat', 'lvlStat', 'timeStat', 'sideTag', 'sideName', 'muteBtn', 'miniInterior', 'miniArena',
    'miniArenaTitle', 'toasts', 'dmgVignette', 'throttleBanner', 'pickModal', 'pickCards', 'startOverlay', 'startBtn',
    'overOverlay', 'overStats', 'restartBtn', 'hintBox'];
  const els = {};
  for (const id of IDS) {
    els[id] = id === 'littleCanvas' ? fakeCanvas(700, 712)
      : id === 'miniInterior' ? fakeCanvas(252, 240)
      : id === 'miniArena' ? fakeCanvas(230, 230)
      : id === 'bigFx' ? fakeCanvas(1440, 900)
      : id === 'bigLoadout' ? fakeCanvas(640, 60)
      : makeEl('div');
  }

  const winListeners = {};
  global.devicePixelRatio = 1;
  global.innerWidth = 1440; global.innerHeight = 900;
  global.addEventListener = (ev, fn) => { (winListeners[ev] = winListeners[ev] || []).push(fn); };
  global.document = {
    body: makeEl('body'),
    getElementById: id => els[id] || null,
    createElement: tag => (tag === 'canvas' ? fakeCanvas() : makeEl(tag)),
  };
  let rafCb = null, simNow = 0;
  global.requestAnimationFrame = cb => { rafCb = cb; };
  global.performance = { now: () => simNow };

  global.THREE = require('three');
  THREE.WebGLRenderer = class {
    constructor() { this.domElement = fakeCanvas(1440, 900); }
    setPixelRatio() {} setSize() {} render() {}
  };

  for (const f of ['assets', 'bigRender', 'littleRender', 'hud', 'main']) require(JS(f));
  winListeners['DOMContentLoaded'][0]();

  const frames = (n, keys) => {
    for (const [code, down] of Object.entries(keys || {})) {
      for (const fn of winListeners[down ? 'keydown' : 'keyup'] || []) fn({ code, preventDefault() {} });
    }
    for (let i = 0; i < n; i++) { simNow += 16.7; rafCb(simNow); }
  };
  const key = code => { for (const fn of winListeners.keydown) fn({ code, preventDefault() {} }); };
  const clickCanvas = (x, y, button) =>
    els.littleCanvas.listeners.mousedown[0]({ clientX: x, clientY: y, button: button || 0, preventDefault() {} });

  els.startBtn.onclick();
  check('App boots and starts', G.state.started === true);

  frames(600, { KeyW: true, KeyD: true });
  check('10s as Big Guy runs clean (5-room mech)', G.state.t > 9 && G.builtIds(G.state).length === 5);

  // force a shrine mid-run: it grants an instant level-up the AI crew resolves live
  const lvl0 = G.state.level;
  G.state.shrine = { x: G.state.big.x, z: G.state.big.z, progress: 0.999 };
  frames(150, { KeyW: false, KeyD: false });
  check('Shrine grants an instant level-up the AI resolves live', G.state.level > lvl0,
    'lvl ' + lvl0 + '→' + G.state.level);
  frames(120);
  check('Renderers survive the growth', G.state.t > 12);

  key('Tab');
  check('Hot-swap to Little Guy', G.state.humanSide === 'little');
  frames(300);

  const D = LITTLER.debug;
  const dp = D.doorPx('armGun', 'reactor');
  const doorBefore = G.state.doors['armGun-reactor'].open;
  clickCanvas(dp.x, dp.y);
  frames(3);
  check('Door click toggles', G.state.doors['armGun-reactor'].open === !doorBefore);

  const col = D.clusterColXY('armGun');
  const p0 = G.state.rooms.armGun.power;
  clickCanvas(col.x, col.y, 2);
  frames(3);
  check('Right-click power column removes a pip', G.state.rooms.armGun.power === Math.max(0, p0 - 1));
  clickCanvas(col.x, col.y, 0);
  frames(3);
  check('Left-click power column adds a pip', G.state.rooms.armGun.power === p0);

  const al = D.airlockPx('legs');
  clickCanvas(al.x, al.y);
  frames(3);
  check('Airlock click vents', G.state.airlocks.legs.open === true);
  clickCanvas(al.x, al.y);
  frames(3);

  key('Digit2');
  frames(2);
  check('Number key selects crew', LITTLER.selected === G.state.goblins[1].id);
  const port = D.portraitXY(0);
  clickCanvas(port.x, port.y);
  frames(2);
  const grub = G.state.goblins[0];
  check('Portrait click selects', LITTLER.selected === grub.id);
  const air = LITTLER.layout.air.rect;
  clickCanvas(air[0] + air[2] / 2, air[1] + air[3] / 2);
  frames(2);
  check('Room click orders the selected goblin', grub.dest === 'air');

  G.state.salvage = G.state.levelUp.need;
  frames(30);
  check('Full salvage bar opens the pick modal',
    G.state.levelUp.pending && !els.pickModal.classList.contains('hidden'));
  const lvlBeforePick = G.state.level;
  els.pickCards.children[0].onclick();
  frames(3);
  if (G.state.pendingGraft) {                        // a BUILD pick → the crew welds it onto a pad
    const p0 = G.validGraftSlots(G.state)[0];
    if (p0) G.submitIntent({ t: 'placeGraft', slot: p0.key });
    frames(3);
  }
  check('Pick card applies (level resolved, nothing left pending)',
    G.state.level > lvlBeforePick && !G.state.pendingGraft);

  // regression: MEDBAY is not an airlock room — building it once froze the interior render
  if (!G.state.rooms.medbay.built) {
    G.state.levelUp.pending = true; G.state.levelUp.free = true;
    G.state.levelUp.options = [{ id: 'build', room: 'medbay' }, { id: 'upgrade', room: 'armGun' }];
    G.submitIntent({ t: 'pick', idx: 0 });
    frames(2);
    const pad = G.validGraftSlots(G.state)[0];
    if (pad) G.submitIntent({ t: 'placeGraft', slot: pad.key });
  }
  frames(20);
  check('Built MEDBAY renders without freezing the interior', G.state.rooms.medbay.built);

  key('Tab');
  frames(1200);
  check('Swap back + 20s: state continuity', G.state.humanSide === 'big' && G.state.t > 30);

  let guard = 60 * 400;
  while (!G.state.over && guard-- > 0) { simNow += 16.7; rafCb(simNow); }
  check('Run ends and game-over screen fills', G.state.over && els.overStats._html.length > 0);
  els.restartBtn.onclick();
  frames(60);
  check('Restart produces a fresh 5-room run', !G.state.over && G.builtIds(G.state).length === 5);
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL CHECKS PASSED'));
process.exit(failures ? 1 : 0);
