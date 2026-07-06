/* SCRAPWALKER — sim.js
   Fixed-tick simulation (§10.4). Applies queued intents to G.state.
   No rendering, no DOM.

   v5: shrines graft rooms onto the mech (the body grows); bosses on a cycle
   with cache drops; spitter/brood/charger mobs; mortar/zapper/saw weapons;
   heal-pack drops. Unbuilt rooms are invisible to every system. */

window.SIM = (function () {
  const C = G.CONFIG;
  const W = G.WEAPON_DEFS;

  /* ================= pools ================= */
  const pools = { enemy: [], bolt: [], pickup: [], trail: [], glob: [], lob: [], saw: [] };
  function take(kind) { return pools[kind].pop() || {}; }
  function release(kind, obj) { pools[kind].push(obj); }

  /* ================= intents ================= */
  function applyIntent(s, it) {
    switch (it.t) {
      case 'bigMove':
        s.big.moveX = it.x; s.big.moveZ = it.z;
        break;
      case 'power': {
        const r = s.rooms[it.room];
        if (!r || !r.built || r.sys === 'reactor') break;
        if (it.delta > 0) {
          if (usedPips(s) < s.reactor.pips && r.power < G.roomCap(r)) { r.power++; AUDIO.play('pipUp'); }
        } else if (r.power > 0) { r.power--; AUDIO.play('pipDown'); }
        break;
      }
      case 'goblin': {
        const g = s.goblins.find(g => g.id === it.id);
        if (g && s.rooms[it.room] && s.rooms[it.room].built) sendGoblin(s, g, it.room);
        break;
      }
      case 'door': {
        const d = s.doors[it.key];
        const [a, b] = it.key.split('-');
        if (d && s.rooms[a].built && s.rooms[b].built) {
          d.open = !d.open;
          AUDIO.play(d.open ? 'doorOpen' : 'doorClose');
        }
        break;
      }
      case 'airlock': {
        const a = s.airlocks[it.room];
        if (a && s.rooms[it.room].built) { a.open = !a.open; AUDIO.play(a.open ? 'vent' : 'doorClose'); }
        break;
      }
      case 'pick':
        applyPick(s, it.idx);
        break;
      case 'placeGraft':
        installGraft(s, it.slot);
        break;
    }
  }

  function usedPips(s) {
    let n = 0;
    for (const id in s.rooms) n += s.rooms[id].power;
    return n;
  }

  /* ================= pathing (built rooms only) ================= */
  function findPath(s, from, to) {
    if (from === to) return [];
    const prev = { [from]: null }, q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const n of G.builtNeighbors(s, cur)) {
        if (!(n in prev)) { prev[n] = cur; if (n === to) { q.length = 0; break; } q.push(n); }
      }
    }
    if (!(to in prev)) return null;
    const path = [];
    for (let n = to; n !== from; n = prev[n]) path.unshift(n);
    return path;
  }

  function sendGoblin(s, g, room) {
    const start = g.path.length ? g.path[0] : g.room;
    const rest = findPath(s, start, room);
    if (rest === null) return;
    g.path = g.path.length ? [g.path[0]].concat(findPath(s, g.path[0], room) || []) : rest;
    g.dest = room;
    if (g.path.length) g.task = 'moving';
  }

  function tryAdvanceGoblin(s, g, dt) {
    if (!g.path.length) return;
    g.hopT += dt / C.GOBLIN_HOP;
    if (g.hopT < 1) return;
    const next = g.path[0];
    const slot = G.firstFreeSlot(s, next, next === g.dest);
    if (slot == null) {
      g.hopT = 0.99;
      g.task = 'waiting';
      return;
    }
    g.hopFrom = g.room;
    g.room = next;
    g.slot = slot;
    g.path.shift();
    g.hopT = 0;
    g.task = g.path.length ? 'moving' : 'idle';
  }

  /* ================= progression: salvage bar → pick ================= */
  function makePickOptions(s) {
    const pool = [
      { id: 'hp', icon: '🛠', name: 'Reinforce Hull', desc: '+20 max HP, +20 HP now, +0.3 HP/s regen.' },
    ];
    if (s.reactor.pips < C.MAX_PIPS)
      pool.push({ id: 'pip', icon: '⚡', name: '+1 Reactor Pip', desc: 'More total power — every pip is output.' });
    if (s.goblins.length < C.MAX_GOBLINS)
      pool.push({ id: 'goblin', icon: '👷', name: '+1 Goblin', desc: 'Another pair of green hands aboard.' });
    if (s.critChance < 0.55)
      pool.push({ id: 'crit', icon: '🎯', name: 'Targeting Array', desc: '+' + Math.round(C.CRIT_STEP * 100) + '% critical-hit chance (×' + C.CRIT_MULT + ' damage).' });
    pool.push({ id: 'magnet', icon: '🧲', name: 'Scrap Magnet', desc: '+' + C.MAGNET_STEP + ' salvage pickup range — hoover the field.' });
    const upgradable = G.builtIds(s).filter(id => s.rooms[id].sys !== 'reactor' && s.rooms[id].tier < 3);
    for (let i = 0; i < 2 && upgradable.length; i++) {
      const id = upgradable.splice((Math.random() * upgradable.length) | 0, 1)[0];
      const r = s.rooms[id];
      pool.push({
        id: 'upg', room: id, icon: '▲', name: r.name + ' +1',
        desc: '+1 capacity AND +1 reactor pip to run it.',
      });
    }
    const opts = [];
    while (opts.length < 3 && pool.length) opts.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
    return opts;
  }

  function applyPick(s, idx) {
    const lu = s.levelUp;
    if (!lu.pending || !lu.options || !lu.options[idx]) return;
    const o = lu.options[idx];
    if (o.id === 'pip') s.reactor.pips = Math.min(C.MAX_PIPS, s.reactor.pips + 1);
    else if (o.id === 'crit') s.critChance = Math.min(0.6, s.critChance + C.CRIT_STEP);
    else if (o.id === 'magnet') s.magnet += C.MAGNET_STEP;
    else if (o.id === 'hp') { s.maxHp += 20; s.hp = Math.min(s.maxHp, s.hp + 20); s.regen += 0.3; }
    else if (o.id === 'goblin') {
      const bay = s.rooms.medbay.built && G.roomHasFreeSlot(s, 'medbay') ? 'medbay'
        : G.builtIds(s).find(id => G.roomHasFreeSlot(s, id));
      if (bay) s.goblins.push(G.makeGoblin(bay, G.firstFreeSlot(s, bay)));
    }
    else if (o.id === 'upg') {
      s.rooms[o.room].tier++;
      s.reactor.pips = Math.min(C.MAX_PIPS, s.reactor.pips + 1);
    }
    s.salvage = Math.max(0, s.salvage - lu.cost);
    lu.need = Math.round(lu.need * C.PICK_GROW);
    s.level++;
    lu.pending = false; lu.options = null;
    G.toast(s, 'big', 'CREW CHOSE: ' + o.name.toUpperCase(), 'good');
    AUDIO.play('pick');
  }

  /* ================= shrines: channel to grow the mech ================= */
  function tickShrine(s, dt) {
    // a grown-but-unplaced room blocks the next shrine — the crew must weld it on first
    if (s.pendingGraft) return;
    if (!s.shrine) {
      s.shrineT -= dt;
      if (s.shrineT <= 0) {
        let x, z, tries = 20;
        do {
          const a = Math.random() * Math.PI * 2, d = 35 + Math.random() * 55;
          x = Math.cos(a) * d; z = Math.sin(a) * d;
        } while (tries-- > 0 && Math.hypot(x - s.big.x, z - s.big.z) < 30);
        s.shrine = { x, z, progress: 0 };
        const next = G.nextExpansion(s);
        G.toast(s, 'both', '⬢ SHRINE RISEN — ' + (next ? 'a new room waits' : 'salvage waits'), 'good');
        AUDIO.play('shrine');
      }
      return;
    }
    const sh = s.shrine;
    const dx = s.big.x - sh.x, dz = s.big.z - sh.z;
    if (dx * dx + dz * dz <= C.SHRINE_RADIUS * C.SHRINE_RADIUS) {
      sh.progress += dt / C.SHRINE_CHANNEL;
      if (sh.progress >= 1) {
        completeShrine(s);
        return;
      }
    } else {
      sh.progress = Math.max(0, sh.progress - dt * 0.5 / C.SHRINE_CHANNEL);
    }
  }

  function completeShrine(s) {
    s.shrine = null;
    s.shrineT = C.SHRINE_EVERY;
    const id = G.nextExpansion(s);
    if (!id) {
      s.salvage += C.SHRINE_SALVAGE;
      G.toast(s, 'both', '⬢ SHRINE DRAINED: +' + C.SHRINE_SALVAGE + '⛭', 'good');
      AUDIO.play('roomBuilt');
      return;
    }
    // the room is grown, but it isn't part of the body until the crew welds it
    // onto a pad whose doors line up (§ player-placed grafts).
    s.pendingGraft = { room: id };
    G.toast(s, 'both', '⬢ ' + s.rooms[id].name + ' GROWN — CREW: weld it onto the hull', 'good');
    AUDIO.play('shrine');
  }

  // install the pending graft onto a chosen pad: derive adjacency from geometry,
  // link neighbors both ways, cut the doorways, then bring the room online.
  function installGraft(s, slotKey) {
    if (!s.pendingGraft) return false;
    const id = s.pendingGraft.room;
    const slot = G.GRAFT_SLOTS[slotKey];
    if (!slot) return false;
    if (!G.validGraftSlots(s).some(v => v.key === slotKey)) return false;
    const r = s.rooms[id];
    r.rect = slot.slice();
    for (const n of G.geoNeighbors(s, r.rect, id)) {
      if (!r.neighbors.includes(n)) r.neighbors.push(n);
      if (!s.rooms[n].neighbors.includes(id)) s.rooms[n].neighbors.push(id);
      const key = G.doorKey(id, n);
      if (!s.doors[key]) s.doors[key] = { open: true };
    }
    r.built = true;
    r.builtT = s.t;
    r.air = 1;
    s.pendingGraft = null;
    s.stats.roomsGrown++;
    s.fx.push({ type: 'graft', age: 0 });
    G.toast(s, 'both', '⬢ ' + r.name + ' WELDED ON', 'good');
    AUDIO.play('roomBuilt');
    return true;
  }

  /* ================= weapons ================= */
  function manMult(s, roomId) { return G.roomManned(s, roomId) ? 0.75 : 1; }
  function pipsOf(s, roomId) { return G.roomEffPower(s.rooms[roomId]); }
  function scaledCd(s, wid) {
    const def = W[wid];
    return def.cooldown / G.pipEff(pipsOf(s, def.room)) * manMult(s, def.room);
  }

  function tickWeapons(s, dt) {
    tickArmGun(s, dt);
    tickCoreOrbitals(s, dt);
    tickFireTrail(s, dt);
    tickHeadFlame(s, dt);
    tickMortar(s, dt);
    tickZapper(s, dt);
    tickSawWing(s, dt);
    tickFallback(s, dt);
  }

  function nearestEnemy(s, range) {
    const b = s.big;
    let best = null, bd = range * range;
    for (const e of s.enemies) {
      const dx = e.x - b.x, dz = e.z - b.z, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  }

  function densestCluster(s, range) {
    const b = s.big;
    let best = null, bestScore = 0;
    const r2 = range * range;
    const stride = Math.max(1, (s.enemies.length / 30) | 0);
    for (let i = 0; i < s.enemies.length; i += stride) {
      const e = s.enemies[i];
      const dx = e.x - b.x, dz = e.z - b.z;
      if (dx * dx + dz * dz > r2) continue;
      let n = 0;
      for (const o of s.enemies) {
        const ox = o.x - e.x, oz = o.z - e.z;
        if (ox * ox + oz * oz < 64) n++;
      }
      if (e.type === 'boss' || e.type === 'bruiser') n += 5;
      if (n > bestScore) { bestScore = n; best = e; }
    }
    return best;
  }

  function fireBolt(s, target, dmg, weak) {
    const b = s.big;
    const bolt = take('bolt');
    bolt.x = b.x; bolt.z = b.z;
    const dx = target.x - b.x, dz = target.z - b.z, d = Math.hypot(dx, dz) || 1;
    bolt.vx = dx / d * C.BOLT_SPEED; bolt.vz = dz / d * C.BOLT_SPEED;
    bolt.dmg = dmg; bolt.life = 0.8; bolt.weak = !!weak;
    s.bolts.push(bolt);
    AUDIO.play(weak ? 'weakPew' : 'pew');
  }

  function tickArmGun(s, dt) {
    const w = s.weapons.armGun;
    w.cd -= dt;
    if (!G.weaponActive(s, 'armGun') || w.cd > 0) return;
    const target = nearestEnemy(s, W.armGun.range);
    if (!target) { w.cd = 0.05; return; }
    w.cd = scaledCd(s, 'armGun');
    fireBolt(s, target, W.armGun.damage);
    s.fx.push({ type: 'muzzle', side: 'l', age: 0 });
  }

  function tickFallback(s, dt) {
    const w = s.weapons.fallback;
    w.cd -= dt;
    if (w.cd > 0) return;
    const anyActive = G.WEAPON_ORDER.some(id => G.weaponActive(s, id));
    if (anyActive) return;
    const target = nearestEnemy(s, C.FALLBACK_RANGE);
    if (!target) { w.cd = 0.1; return; }
    w.cd = C.FALLBACK_CD;
    fireBolt(s, target, C.FALLBACK_DMG, true);
  }

  function orbitalCount(s) {
    return G.weaponActive(s, 'coreOrbitals') ? 1 + pipsOf(s, 'coreOrbitals') : 0;
  }
  function tickCoreOrbitals(s, dt) {
    const w = s.weapons.coreOrbitals;
    if (!G.weaponActive(s, 'coreOrbitals')) return;
    const def = W.coreOrbitals;
    w.angle += dt * def.spin;
    const count = orbitalCount(s);
    const hitCd = def.hitCooldown * manMult(s, 'coreOrbitals');
    const b = s.big;
    for (let i = 0; i < count; i++) {
      const a = w.angle + i * Math.PI * 2 / count;
      const ox = b.x + Math.cos(a) * def.radius;
      const oz = b.z + Math.sin(a) * def.radius;
      for (const e of s.enemies) {
        if (e.orbitalHitT > 0) continue;
        const dx = e.x - ox, dz = e.z - oz;
        if (dx * dx + dz * dz < (e.r + 0.9) * (e.r + 0.9)) {
          hurtEnemy(s, e, def.damage);
          const kx = e.x - b.x, kz = e.z - b.z, kd = Math.hypot(kx, kz) || 1;
          e.kx += kx / kd * def.knockback; e.kz += kz / kd * def.knockback;
          e.orbitalHitT = hitCd;
          AUDIO.play('orbital');
        }
      }
    }
  }

  function tickFireTrail(s, dt) {
    for (let i = s.trails.length - 1; i >= 0; i--) {
      const p = s.trails[i];
      p.life -= dt;
      if (p.life <= 0) { s.trails.splice(i, 1); release('trail', p); continue; }
      for (const e of s.enemies) {
        if (e.dead) continue;
        const dx = e.x - p.x, dz = e.z - p.z;
        if (dx * dx + dz * dz < p.r * p.r) burnEnemy(s, e, p.dps * dt);
      }
    }
    if (!G.weaponActive(s, 'fireTrail')) return;
    if (Math.hypot(s.big.moveX, s.big.moveZ) < 0.01) return;
    const def = W.fireTrail;
    s.fireTrailT = (s.fireTrailT || 0) - dt;
    if (s.fireTrailT > 0) return;
    s.fireTrailT = def.spawnEvery / G.pipEff(pipsOf(s, 'legs')) * (G.roomManned(s, 'legs') ? 0.8 : 1);
    if (s.trails.length > 40) return;
    const p = take('trail');
    p.x = s.big.x; p.z = s.big.z;
    p.r = def.radius; p.maxLife = def.life; p.life = def.life;
    p.dps = def.damagePerSecond;
    s.trails.push(p);
    AUDIO.play('trail');
  }
  function burnEnemy(s, e, dmg) {
    e.hp -= dmg;
    if (e.hp <= 0 && !e.dead) { e.dead = true; killEnemy(s, e); }
  }

  function doShockwave(s) {
    const def = W.shieldShockwave;
    const dmg = def.damage * (1 + 0.25 * (pipsOf(s, 'shields') - 1));
    const b = s.big, r2 = def.radius * def.radius;
    for (const e of s.enemies) {
      const dx = e.x - b.x, dz = e.z - b.z, d2 = dx * dx + dz * dz;
      if (d2 <= r2) {
        hurtEnemy(s, e, dmg);
        const d = Math.sqrt(d2) || 1;
        e.kx += dx / d * def.knockback; e.kz += dz / d * def.knockback;
      }
    }
    s.fx.push({ type: 'shockwave', x: b.x, z: b.z, radius: def.radius, age: 0 });
    s.stats.shockwaves++;
    AUDIO.play('shockwave');
  }

  function tickHeadFlame(s, dt) {
    const w = s.weapons.headFlame;
    w.cd -= dt;
    if (!G.weaponActive(s, 'headFlame') || w.cd > 0) return;
    if (!s.enemies.length) { w.cd = 0.1; return; }
    const def = W.headFlame;
    w.cd = scaledCd(s, 'headFlame');
    const b = s.big, r2 = def.range * def.range;
    const cosLimit = Math.cos(def.angle);
    for (const e of s.enemies) {
      const dx = e.x - b.x, dz = e.z - b.z, d2 = dx * dx + dz * dz;
      if (d2 > r2 || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      if ((dx * b.fx + dz * b.fz) / d >= cosLimit) hurtEnemy(s, e, def.damage);
    }
    s.fx.push({ type: 'headFlame', x: b.x, z: b.z, fx: b.fx, fz: b.fz, range: def.range, angle: def.angle, age: 0 });
    s.stats.flameBursts++;
    AUDIO.play('flame');
  }

  // SPIKE MORTAR — lobbed explosive at the densest cluster
  function tickMortar(s, dt) {
    const w = s.weapons.mortar;
    w.cd -= dt;
    if (!G.weaponActive(s, 'mortar') || w.cd > 0) return;
    const def = W.mortar;
    const target = densestCluster(s, def.range);
    if (!target) { w.cd = 0.2; return; }
    w.cd = scaledCd(s, 'mortar');
    const lob = take('lob');
    lob.x = s.big.x; lob.z = s.big.z;
    lob.tx = target.x; lob.tz = target.z;
    lob.t = 0;
    s.lobs.push(lob);
    AUDIO.play('mortar');
  }
  function tickLobs(s, dt) {
    const def = W.mortar;
    for (let i = s.lobs.length - 1; i >= 0; i--) {
      const l = s.lobs[i];
      l.t += dt / def.flightTime;
      l.x = l.x + (l.tx - l.x) * Math.min(1, dt / (def.flightTime * (1 - l.t) + 0.01));
      l.z = l.z + (l.tz - l.z) * Math.min(1, dt / (def.flightTime * (1 - l.t) + 0.01));
      if (l.t >= 1) {
        explodeAt(s, l.tx, l.tz, def.radius, def.damage);
        s.lobs.splice(i, 1); release('lob', l);
      }
    }
  }
  function explodeAt(s, x, z, radius, dmg) {
    const r2 = radius * radius;
    for (const e of s.enemies) {
      const dx = e.x - x, dz = e.z - z;
      if (dx * dx + dz * dz <= r2) hurtEnemy(s, e, dmg);
    }
    s.fx.push({ type: 'explosion', x, z, radius, age: 0 });
    AUDIO.play('boom');
  }

  // ZAP COIL — chain lightning
  function tickZapper(s, dt) {
    const w = s.weapons.zapper;
    w.cd -= dt;
    if (!G.weaponActive(s, 'zapper') || w.cd > 0) return;
    const def = W.zapper;
    let cur = nearestEnemy(s, def.range);
    if (!cur) { w.cd = 0.15; return; }
    w.cd = scaledCd(s, 'zapper');
    const pts = [{ x: s.big.x, z: s.big.z }];
    const hitSet = new Set();
    for (let hop = 0; hop <= def.chains && cur; hop++) {
      hurtEnemy(s, cur, def.damage);
      pts.push({ x: cur.x, z: cur.z });
      hitSet.add(cur);
      let next = null, bd = def.chainRange * def.chainRange;
      for (const e of s.enemies) {
        if (hitSet.has(e) || e.dead) continue;
        const dx = e.x - cur.x, dz = e.z - cur.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; next = e; }
      }
      cur = next;
    }
    s.fx.push({ type: 'zap', pts, age: 0 });
    AUDIO.play('zap');
  }

  // SAW WING — returning blade along facing
  function tickSawWing(s, dt) {
    const def = W.sawWing;
    for (let i = s.saws.length - 1; i >= 0; i--) {
      const sw = s.saws[i];
      sw.t += dt / def.flightTime;
      if (sw.t >= 1) { s.saws.splice(i, 1); release('saw', sw); continue; }
      const out = sw.t < 0.5 ? sw.t / 0.5 : (1 - sw.t) / 0.5;   // out then back
      sw.x = s.big.x + sw.dirX * def.reach * out;
      sw.z = s.big.z + sw.dirZ * def.reach * out;
      for (const e of s.enemies) {
        if (e.dead || e.sawHitT > 0) continue;
        const dx = e.x - sw.x, dz = e.z - sw.z;
        if (dx * dx + dz * dz < (e.r + def.radius) * (e.r + def.radius)) {
          hurtEnemy(s, e, def.damage);
          e.sawHitT = 0.5;
          AUDIO.play('saw');
        }
      }
    }
    const w = s.weapons.sawWing;
    w.cd -= dt;
    if (!G.weaponActive(s, 'sawWing') || w.cd > 0) return;
    if (!s.enemies.length) { w.cd = 0.15; return; }
    w.cd = scaledCd(s, 'sawWing');
    const sw = take('saw');
    sw.t = 0;
    sw.dirX = s.big.fx; sw.dirZ = s.big.fz;
    sw.x = s.big.x; sw.z = s.big.z;
    s.saws.push(sw);
    AUDIO.play('saw');
  }

  /* ================= enemies ================= */
  function spawnEnemy(s, type, atX, atZ) {
    const st = C.ENEMY[type];
    const e = take('enemy');
    if (atX == null) {
      const a = Math.random() * Math.PI * 2;
      const dist = 55 + Math.random() * 18;
      e.x = clampArena(s.big.x + Math.cos(a) * dist);
      e.z = clampArena(s.big.z + Math.sin(a) * dist);
    } else { e.x = atX; e.z = atZ; }
    const tough = 1 + 0.16 * s.spawn.ramp;
    e.type = type;
    e.hp = st.hp * (type === 'boss' ? 1 + 0.2 * s.spawn.ramp : tough);
    e.maxHp = e.hp;
    e.spd = st.spd * (1 + 0.02 * s.spawn.ramp);
    e.r = st.r; e.dmg = st.dmg;
    e.atkT = 0; e.seed = Math.random() * 10; e.hitFlash = 0;
    e.kx = 0; e.kz = 0; e.orbitalHitT = 0; e.sawHitT = 0;
    e.mode = 0; e.modeT = 0;              // charger states / boss timers
    e.spitT = 1 + Math.random() * 2;
    e.volleyT = 6; e.summonT = 14;
    s.enemies.push(e);
    return e;
  }
  function clampArena(v) { return Math.max(-C.ARENA_R, Math.min(C.ARENA_R, v)); }

  function hurtEnemy(s, e, dmg) {
    let crit = false;
    if (Math.random() < s.critChance) { dmg *= C.CRIT_MULT; crit = true; }
    e.hp -= dmg; e.hitFlash = crit ? 0.2 : 0.12;
    if (crit) AUDIO.play('crit');
    if (s.fx.length < 90) s.fx.push({ type: 'dmg', x: e.x, z: e.z, age: 0, amount: Math.max(1, Math.round(dmg)), crit });
    if (e.hp <= 0 && !e.dead) { e.dead = true; killEnemy(s, e); }
  }

  function killEnemy(s, e) {
    const st = C.ENEMY[e.type];
    s.kills++;
    if (e.type === 'boss') {
      s.stats.bosses++;
      dropPickup(s, e.x, e.z, 'cache', C.BOSS_CACHE);
      dropPickup(s, e.x + 2, e.z, 'heal', C.HEAL_VALUE * 2);
      s.fx.push({ type: 'pop', x: e.x, z: e.z, age: 0, big: true });
      G.toast(s, 'both', '☠ ALPHA DOWN — CACHE DROPPED', 'good');
      AUDIO.play('bossDown');
    } else {
      if (Math.random() < st.salvC) dropPickup(s, e.x, e.z, 'salv', st.salv);
      if ((e.type === 'bruiser' || e.type === 'brood' || e.type === 'charger') &&
          Math.random() < C.CACHE_CHANCE) dropPickup(s, e.x + 1, e.z, 'cache', C.CACHE_VALUE);
      if (Math.random() < C.HEAL_CHANCE) dropPickup(s, e.x - 1, e.z, 'heal', C.HEAL_VALUE);
      s.fx.push({ type: 'pop', x: e.x, z: e.z, age: 0, big: e.type === 'bruiser' || e.type === 'brood' });
      AUDIO.play(e.type === 'bruiser' || e.type === 'brood' ? 'bigKill' : 'kill');
    }
    // broodmother splits
    if (e.type === 'brood') {
      for (let i = 0; i < C.BROOD_SPLIT; i++) {
        const a = i / C.BROOD_SPLIT * Math.PI * 2;
        spawnEnemy(s, 'swarmer', e.x + Math.cos(a) * 2, e.z + Math.sin(a) * 2);
      }
    }
    // parasites: close-range elite kills can send grubbers aboard
    if ((e.type === 'bruiser' || e.type === 'boss') && !s.hazard.warn) {
      const dx = e.x - s.big.x, dz = e.z - s.big.z;
      if (dx * dx + dz * dz < C.PARASITE_RANGE * C.PARASITE_RANGE &&
          Math.random() < C.PARASITE_CHANCE) {
        warnHazard(s, 'grubber', pickGrubberRoom(s), 'PARASITES CRAWLING IN');
      }
    }
  }

  function dropPickup(s, x, z, kind, v) {
    if (s.pickups.length > 400) return;
    const p = take('pickup');
    p.kind = kind; p.x = x + (Math.random() - 0.5) * 2; p.z = z + (Math.random() - 0.5) * 2;
    p.v = v; p.seed = Math.random() * 10;
    s.pickups.push(p);
  }

  /* ================= hits on the mech (§7.3 wiring) ================= */
  function builtHitRoom(s) {
    const ids = G.builtIds(s);
    return s.rooms[ids[(Math.random() * ids.length) | 0]];
  }

  function mechHit(s, dmg, isElite) {
    const legs = G.legBonus(s);
    if (Math.random() < legs.dodge) {
      s.fx.push({ type: 'dodge', x: s.big.x, z: s.big.z, age: 0 });
      s.big.dodgeFlash = 0.3;
      return;
    }
    if (s.shield.layers > 0) {
      s.shield.layers--;
      s.shield.regenT = 0;
      s.fx.push({ type: 'shieldHit', x: s.big.x, z: s.big.z, age: 0 });
      AUDIO.play('shieldHit');
      if (G.weaponActive(s, 'shieldShockwave')) doShockwave(s);
      if (s.shield.layers === 0) G.toast(s, 'both', 'SHIELDS DOWN', 'warn');
      return;
    }
    s.hp -= dmg;
    s.big.hitFlash = 0.25;
    s.big.shake = Math.max(s.big.shake, isElite ? 0.7 : 0.25);
    AUDIO.play(isElite ? 'bigHit' : 'hit');

    const room = builtHitRoom(s);
    if (room.sys !== 'reactor') room.damage = Math.min(room.tier, room.damage + dmg / 22);

    if (isElite && Math.random() < C.BRUISER_CRISIS_CHANCE) {
      const roll = Math.random();
      if (roll < 0.35) startFire(s, room);
      else if (roll < 0.65) startBreach(s, room);
      else spawnIntruder(s, room);
    }
    if (s.hp <= 0) endRun(s);
  }

  function startFire(s, room) {
    if (!room.built) return;
    if (room.fire <= 0) {
      room.fire = 0.3;
      G.toast(s, 'both', '🔥 FIRE IN ' + room.name, 'bad');
      AUDIO.play('alarm');
    } else room.fire = Math.min(1, room.fire + 0.3);
  }
  function startBreach(s, room) {
    if (!room.built) return;
    if (!room.breach) {
      room.breach = true; room.weld = 0;
      G.toast(s, 'both', '⭘ BREACH IN ' + room.name, 'bad');
      AUDIO.play('alarm');
    }
  }
  function spawnIntruder(s, room, runt) {
    let target = G.roomHasFreeSlot(s, room.id) ? room
      : s.rooms[G.builtIds(s).find(id => G.roomHasFreeSlot(s, id))];
    if (!target) { startFire(s, room); return; }
    s.intruders.push(G.makeIntruder(target.id, G.firstFreeSlot(s, target.id), runt));
    G.toast(s, 'both', '👹 ' + (runt ? 'GRUBBER' : 'INTRUDER') + ' IN ' + target.name, 'bad');
    AUDIO.play('intruder');
  }

  /* ================= hazard director ================= */
  function pickGrubberRoom(s) {
    const hull = G.builtIds(s).filter(id => id !== 'reactor' && id !== 'air' && G.roomHasFreeSlot(s, id));
    return hull.length ? hull[(Math.random() * hull.length) | 0]
      : G.builtIds(s).find(id => G.roomHasFreeSlot(s, id)) || null;
  }

  function warnHazard(s, type, room, label) {
    if (type === 'grubber' && room == null) return;
    s.hazard.warn = { type, room, t: C.HAZARD_WARN, label };
    G.toast(s, 'both', '⚠ ' + label + (room ? ' — ' + s.rooms[room].name : ''), 'warn');
    AUDIO.play('alarm');
  }

  function tickHazards(s, dt) {
    const hz = s.hazard;
    if (hz.squallT > 0) {
      hz.squallT -= dt;
      hz.squallRollT -= dt;
      if (hz.squallRollT <= 0) {
        hz.squallRollT = 4;
        if (Math.random() < 0.55) {
          const ids = G.builtIds(s);
          startFire(s, s.rooms[ids[(Math.random() * ids.length) | 0]]);
        }
      }
    }
    if (hz.warn) {
      hz.warn.t -= dt;
      if (hz.warn.t <= 0) {
        applyHazard(s, hz.warn);
        hz.warn = null;
        hz.t = C.HAZARD_MIN + Math.random() * C.HAZARD_VAR;
      }
      return;
    }
    if (s.levelUp.pending) return;
    hz.t -= dt;
    if (hz.t > 0) return;

    const roll = Math.random();
    if (roll < 0.4) {
      warnHazard(s, 'grubber', pickGrubberRoom(s), 'GRUBBER BREACHING HULL');
    } else if (roll < 0.65) {
      const ids = G.builtIds(s);
      warnHazard(s, 'leak', ids[(Math.random() * ids.length) | 0], 'COOLANT LINE FAILING');
    } else if (roll < 0.85) {
      const options = G.builtIds(s).filter(id => s.rooms[id].sys !== 'reactor' && G.roomCap(s.rooms[id]) > 0);
      if (options.length) warnHazard(s, 'rattle', options[(Math.random() * options.length) | 0], 'SYSTEM SHAKING LOOSE');
      else hz.t = 5;
    } else if (s.t > 90) {
      warnHazard(s, 'squall', null, 'ASH SQUALL INBOUND');
    } else {
      warnHazard(s, 'grubber', pickGrubberRoom(s), 'GRUBBER BREACHING HULL');
    }
  }

  function applyHazard(s, warn) {
    s.stats.events++;
    if (warn.type === 'grubber') {
      const room = warn.room && G.roomHasFreeSlot(s, warn.room) ? warn.room : pickGrubberRoom(s);
      if (room) spawnIntruder(s, s.rooms[room], true);
    } else if (warn.type === 'leak') {
      const r = s.rooms[warn.room];
      if (r.built && !r.breach) {
        r.breach = true; r.leak = true; r.weld = 0;
        G.toast(s, 'both', '⭘ COOLANT LEAK IN ' + r.name, 'bad');
        AUDIO.play('alarm');
      }
    } else if (warn.type === 'rattle') {
      const r = s.rooms[warn.room];
      if (r.built) {
        r.damage = Math.min(r.tier, r.damage + 1);
        G.toast(s, 'both', '⚙ ' + r.name + ' RATTLED LOOSE', 'bad');
        AUDIO.play('bigHit');
      }
    } else if (warn.type === 'squall') {
      s.hazard.squallT = C.SQUALL_TIME;
      s.hazard.squallRollT = 1;
      G.toast(s, 'both', '🔥 ASH SQUALL — FIRE RISK', 'bad');
      AUDIO.play('alarm');
    }
  }

  /* ================= intruders (unchanged FTL boarders) ================= */
  function tickIntruders(s, dt) {
    for (let i = s.intruders.length - 1; i >= 0; i--) {
      const iv = s.intruders[i];
      iv.animT += dt;
      iv.flash = Math.max(0, iv.flash - dt);
      if (iv.hp <= 0) { s.intruders.splice(i, 1); continue; }

      if (iv.path.length) {
        advanceIntruder(s, iv, dt);
        continue;
      }
      const r = s.rooms[iv.room];
      const crew = G.settledGoblinsIn(s, iv.room);
      if (crew.length) {
        iv.atkT -= dt;
        if (iv.atkT <= 0) {
          iv.atkT = 1.2;
          const victim = crew[(Math.random() * crew.length) | 0];
          victim.hp -= iv.dps;
          victim.flashT = 0.25;
          AUDIO.play('fight');
          if (victim.hp <= 0) killGoblin(s, victim);
        }
        continue;
      }
      if (r.sys !== 'reactor' && G.roomCap(r) > 0) {
        const before = G.roomCap(r);
        r.damage = Math.min(r.tier, r.damage + C.INTRUDER_SABOTAGE * dt);
        if (before > 0 && G.roomCap(r) === 0)
          G.toast(s, 'both', r.name + ' SABOTAGED', 'bad');
        continue;
      }
      const target = G.builtIds(s).find(id =>
        id !== iv.room && s.rooms[id].sys !== 'reactor' &&
        G.roomCap(s.rooms[id]) > 0 && G.roomHasFreeSlot(s, id));
      if (target) {
        const path = findPath(s, iv.room, target);
        if (path && path.length) { iv.path = path; iv.hopT = 0; iv.bashT = 0; }
      }
    }
  }

  function advanceIntruder(s, iv, dt) {
    const next = iv.path[0];
    const door = s.doors[G.doorKey(iv.room, next)];
    if (iv.hopT < 0.5) {
      iv.hopT = Math.min(0.5, iv.hopT + dt / C.INTRUDER_HOP);
      return;
    }
    if (door && !door.open) {
      iv.bashT += dt;
      if (iv.bashT >= C.DOOR_BASH) {
        door.open = true;
        iv.bashT = 0;
        G.toast(s, 'both', 'BULKHEAD FORCED — ' + s.rooms[next].name, 'bad');
        AUDIO.play('doorBash');
      } else {
        if (Math.random() < dt * 2) AUDIO.play('doorBash');
        return;
      }
    }
    iv.hopT += dt / C.INTRUDER_HOP;
    if (iv.hopT < 1) return;
    const slot = G.firstFreeSlot(s, next);
    if (slot == null) { iv.hopT = 0.99; return; }
    iv.room = next;
    iv.slot = slot;
    iv.path.shift();
    iv.hopT = 0;
    iv.bashT = 0;
  }

  /* ================= interior ================= */
  function tickInterior(s, dt) {
    for (const id of G.builtIds(s)) {
      const r = s.rooms[id];
      const cap = G.roomCap(r);
      if (r.power > cap) r.power = cap;
    }

    const smax = G.shieldMax(s);
    if (s.shield.layers > smax) s.shield.layers = smax;
    if (s.shield.layers < smax) {
      s.shield.regenT += dt;
      if (s.shield.regenT >= G.shieldRegenTime(s)) {
        s.shield.regenT = 0; s.shield.layers++;
        AUDIO.play('shieldUp');
        if (s.shield.layers === smax) G.toast(s, 'big', 'SHIELDS ONLINE', 'good');
      }
    } else s.shield.regenT = 0;

    for (const g of s.goblins) tryAdvanceGoblin(s, g, dt);

    for (const id of G.builtIds(s)) {
      const r = s.rooms[id];
      if (r.station == null || G.roomInCrisis(s, r) || r.damage >= 0.5) continue;
      const crew = G.settledGoblinsIn(s, id);
      if (!crew.length || crew.some(g => g.slot === r.station)) continue;
      if (!G.usedSlots(s, id).has(r.station)) crew[0].slot = r.station;
    }

    tickIntruders(s, dt);
    for (const id of G.builtIds(s)) tickRoom(s, s.rooms[id], dt);
    tickAir(s, dt);

    for (const g of s.goblins) {
      g.animT += dt;
      g.flashT = Math.max(0, g.flashT - dt);
    }
  }

  function tickRoom(s, r, dt) {
    const crew = G.settledGoblinsIn(s, r.id);
    const invaders = G.intrudersIn(s, r.id);

    if (invaders.length) {
      if (crew.length) {
        for (const g of crew) g.task = 'fighting';
        const target = invaders[0];
        target.hp -= C.GOBLIN_DPS * crew.length * dt;
        target.flash = 0.1;
        if (target.hp <= 0) {
          s.salvage += 2;
          s.stats.crisesSurvived++;
          G.toast(s, 'little', 'INTRUDER DOWN (+2⛭)', 'good');
          AUDIO.play('kill');
        }
      }
      return;
    }

    if (r.fire > 0) {
      if (crew.length) {
        for (const g of crew) g.task = 'firefighting';
        r.fire -= C.FIRE_FIGHT_RATE * crew.length * dt;
        AUDIO.play('spray');
        if (r.fire <= 0) { r.fire = 0; s.stats.crisesSurvived++; G.toast(s, 'little', r.name + ' FIRE OUT', 'good'); }
      } else if (r.air < 0.35) {
        r.fire -= 0.06 * dt;
        if (r.fire <= 0) {
          r.fire = 0; s.stats.crisesSurvived++; s.stats.vented++;
          G.toast(s, 'little', r.name + ' FIRE SUFFOCATED', 'good');
        }
      } else {
        r.fire = Math.min(1, r.fire + C.FIRE_GROW * (0.3 + 0.7 * r.air) * dt);
      }
      if (r.fire > 0) {
        r.damage = Math.min(r.tier || 1, r.damage + C.FIRE_SYS_DPS * r.fire * dt);
        for (const g of crew) {
          g.hp -= C.FIRE_GOBLIN_DPS * dt;
          g.flashT = Math.max(g.flashT, 0.1);
          if (g.hp <= 0) killGoblin(s, g);
        }
        r.spreadT += dt;
        if (r.spreadT > C.FIRE_SPREAD_EVERY) {
          r.spreadT = 0;
          const options = G.builtNeighbors(s, r.id);
          if (options.length) {
            const n = options[(Math.random() * options.length) | 0];
            const door = s.doors[G.doorKey(r.id, n)];
            const chance = door && door.open ? 0.3 : 0.06;
            if (Math.random() < chance && s.rooms[n].fire <= 0) startFire(s, s.rooms[n]);
          }
        }
      }
      return;
    }

    if (r.breach) {
      const weldNeed = r.leak ? C.LEAK_WELD_TIME : C.WELD_TIME;
      if (crew.length) {
        for (const g of crew) g.task = 'welding';
        r.weld += crew.length * dt;
        AUDIO.play('weld');
        if (r.weld >= weldNeed) {
          const wasLeak = r.leak;
          r.breach = false; r.leak = false; r.weld = 0; s.stats.crisesSurvived++;
          G.toast(s, 'little', r.name + (wasLeak ? ' LEAK PATCHED' : ' BREACH SEALED'), 'good');
        }
      } else if (!r.leak) {
        r.damage = Math.min(r.tier || 1, r.damage + 0.02 * dt);
      }
      return;
    }

    if (r.damage > 0 && crew.length) {
      const before = Math.floor(r.damage);
      for (const g of crew) g.task = 'repairing';
      r.damage = Math.max(0, r.damage - C.REPAIR_RATE * crew.length * dt);
      AUDIO.play('repair');
      if (r.damage === 0 && before > 0) G.toast(s, 'both', r.name + ' REPAIRED', 'good');
      return;
    }

    if (r.sys === 'repair' && G.systemActive(s, r.id)) {
      // the REPAIR RIG mends the mech's shared hull — Little Guy heals Big Guy
      const manned = G.roomManned(s, r.id);
      if (s.hp < s.maxHp) {
        s.hp = Math.min(s.maxHp, s.hp + C.HULL_REPAIR_RATE * G.roomEffPower(r) * (manned ? 1.5 : 1) * dt);
      }
      for (const g of crew) g.task = (g.slot === r.station) ? 'mending' : 'idle';
      return;
    }

    if (r.sys === 'medbay' && G.systemActive(s, r.id)) {
      const rate = C.HEAL_RATE * G.roomEffPower(r);
      for (const g of crew) {
        if (g.hp < g.maxHp) {
          g.task = 'healing';
          g.hp = Math.min(g.maxHp, g.hp + rate * dt);
        } else g.task = 'idle';
      }
      return;
    }

    for (const g of crew) g.task = (r.station != null && g.slot === r.station) ? 'manning' : 'idle';
  }

  function tickAir(s, dt) {
    const airOn = G.systemActive(s, 'air');
    const regen = C.AIR_REGEN * G.roomEffPower(s.rooms.air) * (G.roomManned(s, 'air') ? 1.5 : 1);
    for (const id of G.builtIds(s)) {
      const r = s.rooms[id];
      let delta = 0;
      if (r.breach) delta -= r.leak ? C.LEAK_DRAIN : C.AIR_BREACH_DRAIN;
      if (s.airlocks[id] && s.airlocks[id].open) delta -= C.AIR_VENT_DRAIN;
      if (delta === 0) delta = airOn ? regen : -C.AIR_DECAY;
      r.air = Math.max(0, Math.min(1, r.air + delta * dt));
    }
    for (const key in s.doors) {
      const [a, b] = key.split('-');
      if (!s.rooms[a].built || !s.rooms[b].built) continue;
      const flow = (s.doors[key].open ? C.DOOR_FLOW : 0.02) * dt;
      const ra = s.rooms[a], rb = s.rooms[b];
      const d = (ra.air - rb.air) * 0.5 * Math.min(1, flow);
      ra.air -= d; rb.air += d;
    }
    let warned = false;
    for (const g of s.goblins.slice()) {
      if (s.rooms[g.room].air < C.AIR_THRESHOLD) {
        g.hp -= C.SUFFOCATE_DPS * dt;
        g.flashT = Math.max(g.flashT, 0.1);
        if (!warned) { AUDIO.play('lowAir'); warned = true; }
        if (g.hp <= 0) killGoblin(s, g);
      }
    }
    for (let i = s.intruders.length - 1; i >= 0; i--) {
      const iv = s.intruders[i];
      if (s.rooms[iv.room].air < C.AIR_THRESHOLD) {
        iv.hp -= C.SUFFOCATE_DPS * dt;
        if (iv.hp <= 0) {
          s.intruders.splice(i, 1);
          s.stats.crisesSurvived++; s.stats.vented++;
          G.toast(s, 'little', 'INTRUDER SUFFOCATED', 'good');
        }
      }
    }
  }

  function killGoblin(s, g) {
    const i = s.goblins.indexOf(g);
    if (i >= 0) s.goblins.splice(i, 1);
    G.toast(s, 'both', '💀 ' + g.name.toUpperCase() + ' IS DOWN', 'bad');
    AUDIO.play('goblinDeath');
  }

  /* ================= big guy tick ================= */
  function tickBig(s, dt) {
    const b = s.big;
    const legs = G.legBonus(s);
    const spd = b.baseSpeed * (1 + legs.spd);
    let mx = b.moveX, mz = b.moveZ;
    const ml = Math.hypot(mx, mz);
    if (ml > 1e-3) {
      mx /= Math.max(1, ml); mz /= Math.max(1, ml);
      b.x = clampArena(b.x + mx * spd * dt);
      b.z = clampArena(b.z + mz * spd * dt);
      b.fx = mx; b.fz = mz;
    }
    b.hitFlash = Math.max(0, b.hitFlash - dt);
    b.dodgeFlash = Math.max(0, b.dodgeFlash - dt);
    b.shake = Math.max(0, b.shake - dt * 1.6);

    if (s.regen > 0) s.hp = Math.min(s.maxHp, s.hp + s.regen * dt);

    tickWeapons(s, dt);
    tickLobs(s, dt);

    // bolts
    for (let i = s.bolts.length - 1; i >= 0; i--) {
      const p = s.bolts[i];
      p.x += p.vx * dt; p.z += p.vz * dt; p.life -= dt;
      let hit = false;
      for (const e of s.enemies) {
        const dx = e.x - p.x, dz = e.z - p.z;
        if (dx * dx + dz * dz < (e.r + 0.8) * (e.r + 0.8)) {
          hurtEnemy(s, e, p.dmg);
          s.fx.push({ type: 'boltHit', x: p.x, z: p.z, age: 0 });
          hit = true; break;
        }
      }
      if (hit || p.life <= 0) { s.bolts.splice(i, 1); release('bolt', p); }
    }

    // enemy acid globs
    for (let i = s.globs.length - 1; i >= 0; i--) {
      const gl = s.globs[i];
      gl.x += gl.vx * dt; gl.z += gl.vz * dt; gl.life -= dt;
      const dx = b.x - gl.x, dz = b.z - gl.z;
      if (dx * dx + dz * dz < 3.2) {
        mechHit(s, C.SPIT_DMG, false);
        s.fx.push({ type: 'globHit', x: gl.x, z: gl.z, age: 0 });
        s.globs.splice(i, 1); release('glob', gl);
        if (s.over) return;
        continue;
      }
      if (gl.life <= 0) { s.globs.splice(i, 1); release('glob', gl); }
    }

    // enemies
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      if (e.dead) { e.dead = false; s.enemies.splice(i, 1); release('enemy', e); continue; }
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.orbitalHitT = Math.max(0, e.orbitalHitT - dt);
      e.sawHitT = Math.max(0, e.sawHitT - dt);
      if (e.kx || e.kz) {
        e.x += e.kx * dt; e.z += e.kz * dt;
        const damp = Math.max(0, 1 - 5 * dt);
        e.kx *= damp; e.kz *= damp;
        if (Math.abs(e.kx) + Math.abs(e.kz) < 0.05) { e.kx = 0; e.kz = 0; }
      }
      const dx = b.x - e.x, dz = b.z - e.z, d = Math.hypot(dx, dz) || 1;
      if (d > 140 && e.type !== 'boss') {
        const a = Math.random() * Math.PI * 2;
        e.x = clampArena(b.x + Math.cos(a) * 60); e.z = clampArena(b.z + Math.sin(a) * 60);
        continue;
      }
      tickEnemy(s, e, dx, dz, d, dt);
      if (s.over) return;
    }

    // pickups
    for (let i = s.pickups.length - 1; i >= 0; i--) {
      const p = s.pickups[i];
      const magnet = p.kind === 'cache' ? s.magnet + 5 : s.magnet;
      const dx = b.x - p.x, dz = b.z - p.z, d2 = dx * dx + dz * dz;
      if (d2 < magnet * magnet) {
        const d = Math.sqrt(d2) || 1;
        p.x += dx / d * 30 * dt; p.z += dz / d * 30 * dt;
        if (d < 2.2) {
          if (p.kind === 'heal') {
            s.hp = Math.min(s.maxHp, s.hp + p.v);
            AUDIO.play('healPack');
          } else {
            s.salvage += p.v;
            AUDIO.play(p.kind === 'cache' ? 'cacheGet' : 'salv');
          }
          if (s.fx.length < 80) s.fx.push({ type: 'collect', x: p.x, z: p.z, kind: p.kind, age: 0 });
          s.pickups.splice(i, 1); release('pickup', p);
        }
      }
    }

    tickShrine(s, dt);

    // salvage bar → pick moment
    if (!s.levelUp.pending && s.salvage >= s.levelUp.need) {
      s.levelUp.pending = true;
      s.levelUp.cost = s.levelUp.need;
      s.levelUp.options = makePickOptions(s);
      s.levelUp.throttle = C.THROTTLE;
      s.levelUp.aiT = 1.6;
      AUDIO.play('levelup');
      G.toast(s, 'big', 'SALVAGE BANKED — CREW IS CHOOSING', 'good');
    }
    if (s.levelUp.throttle > 0) s.levelUp.throttle -= dt;
  }

  /* per-type enemy behavior — read through motion, not UI alerts */
  function tickEnemy(s, e, dx, dz, d, dt) {
    const b = s.big;
    const reach = e.r + 2.2;
    e.atkT -= dt;

    if (e.type === 'spitter') {
      if (d > C.SPIT_RANGE) {
        e.x += dx / d * e.spd * dt;
        e.z += dz / d * e.spd * dt;
      } else {
        // hold range, drift sideways
        e.x += -dz / d * e.spd * 0.4 * dt;
        e.z += dx / d * e.spd * 0.4 * dt;
        e.spitT -= dt;
        if (e.spitT <= 0) {
          e.spitT = C.SPIT_CD;
          const gl = take('glob');
          gl.x = e.x; gl.z = e.z;
          gl.vx = dx / d * C.SPIT_SPEED; gl.vz = dz / d * C.SPIT_SPEED;
          gl.life = 3.5;
          s.globs.push(gl);
          AUDIO.play('spit');
        }
      }
      if (d <= reach && e.atkT <= 0) { e.atkT = 1; mechHit(s, e.dmg, false); }
      return;
    }

    if (e.type === 'charger') {
      if (e.mode === 0) {                       // stalk
        e.x += dx / d * e.spd * dt;
        e.z += dz / d * e.spd * dt;
        if (d < 20) { e.mode = 1; e.modeT = C.CHARGE_WINDUP; }
      } else if (e.mode === 1) {                // windup (visible crouch/shake)
        e.modeT -= dt;
        if (e.modeT <= 0) {
          e.mode = 2; e.modeT = C.CHARGE_TIME;
          e.cdx = dx / d; e.cdz = dz / d;       // lock direction
        }
      } else if (e.mode === 2) {                // charge!
        e.modeT -= dt;
        e.x = clampArena(e.x + e.cdx * C.CHARGE_SPEED * dt);
        e.z = clampArena(e.z + e.cdz * C.CHARGE_SPEED * dt);
        if (d <= reach + 1) {
          mechHit(s, C.CHARGE_DMG, false);
          e.mode = 3; e.modeT = 1.2;
        } else if (e.modeT <= 0) { e.mode = 3; e.modeT = 1.2; }
      } else {                                   // recover
        e.modeT -= dt;
        if (e.modeT <= 0) e.mode = 0;
      }
      return;
    }

    if (e.type === 'boss') {
      if (d > reach) {
        e.x += dx / d * e.spd * dt;
        e.z += dz / d * e.spd * dt;
      } else if (e.atkT <= 0) {
        e.atkT = 1.4;
        mechHit(s, e.dmg, true);                // bosses always threaten the interior
      }
      e.volleyT -= dt;
      if (e.volleyT <= 0) {
        e.volleyT = 6;
        for (let k = -2; k <= 2; k++) {
          const ang = Math.atan2(dx, dz) + k * 0.22;
          const gl = take('glob');
          gl.x = e.x; gl.z = e.z;
          gl.vx = Math.sin(ang) * C.SPIT_SPEED * 1.2;
          gl.vz = Math.cos(ang) * C.SPIT_SPEED * 1.2;
          gl.life = 3.5;
          s.globs.push(gl);
        }
        AUDIO.play('spit');
      }
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = 20;
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2;
          spawnEnemy(s, 'swarmer', e.x + Math.cos(a) * 4, e.z + Math.sin(a) * 4);
        }
        AUDIO.play('bossRoar');
      }
      return;
    }

    // swarmer / runner / bruiser / brood: straight seek + contact
    if (d > reach) {
      e.x += dx / d * e.spd * dt;
      e.z += dz / d * e.spd * dt;
    } else if (e.atkT <= 0) {
      e.atkT = 1.0;
      mechHit(s, e.dmg, e.type === 'bruiser');
    }
  }

  /* ================= spawner: growing bestiary + boss cycle ================= */
  function tickSpawner(s, dt) {
    const sp = s.spawn;
    sp.rampT -= dt;
    if (sp.rampT <= 0) { sp.rampT = C.RAMP_EVERY; sp.ramp++; }
    const throttled = s.levelUp.pending || s.levelUp.throttle > 0;
    const interval = Math.max(0.22, 1.1 - sp.ramp * 0.09) * (throttled ? 5 : 1);
    sp.timer -= dt;
    if (sp.timer <= 0 && s.enemies.length < 650) {
      sp.timer = interval;
      const batch = throttled ? 1 : 2 + Math.min(8, sp.ramp);
      for (let i = 0; i < batch; i++) spawnEnemy(s, rollType(s));
    }
    // boss cycle
    s.bossT -= dt;
    if (s.bossT <= 0) {
      s.bossT = C.BOSS_EVERY;
      spawnEnemy(s, 'boss');
      G.toast(s, 'both', '☠ AN ALPHA SURFACES', 'bad');
      AUDIO.play('bossRoar');
    }
  }

  function rollType(s) {
    // cumulative bands so unlocking a new mob never inflates the others
    const t = s.t, roll = Math.random();
    const bands = [];
    if (t >= C.ENEMY.charger.unlockAt) bands.push(['charger', 0.08]);
    if (t >= C.ENEMY.brood.unlockAt) bands.push(['brood', 0.06]);
    if (t >= C.ENEMY.spitter.unlockAt) bands.push(['spitter', 0.12]);
    if (t >= C.ENEMY.bruiser.unlockAt) bands.push(['bruiser', 0.07 + s.spawn.ramp * 0.009]);
    if (t >= C.ENEMY.runner.unlockAt) bands.push(['runner', 0.30]);
    let acc = 0;
    for (const [type, w] of bands) {
      acc += w;
      if (roll < acc) return type;
    }
    return 'swarmer';
  }

  /* ================= fx / toasts / klaxon ================= */
  function tickFx(s, dt) {
    for (let i = s.fx.length - 1; i >= 0; i--) {
      s.fx[i].age += dt;
      if (s.fx[i].age > (s.fx[i].type === 'dmg' ? 1.15 : 0.9)) s.fx.splice(i, 1);
    }
    for (let i = s.toasts.length - 1; i >= 0; i--) {
      s.toasts[i].t -= dt;
      if (s.toasts[i].t <= 0) s.toasts.splice(i, 1);
    }
    if (G.builtIds(s).some(id => G.roomInCrisis(s, s.rooms[id]))) AUDIO.play('klaxon');
  }

  function endRun(s) {
    s.hp = 0;
    s.over = true;
    AUDIO.play('gameover');
  }

  /* ================= master tick ================= */
  function tick(s, dt) {
    if (!s.started || s.over) { G.drainIntents(); return; }
    for (const it of G.drainIntents()) applyIntent(s, it);
    s.t += dt;
    tickSpawner(s, dt);
    tickHazards(s, dt);
    tickBig(s, dt);
    if (s.over) return;
    tickInterior(s, dt);
    tickFx(s, dt);
  }

  return { tick, usedPips, makePickOptions, orbitalCount };
})();
