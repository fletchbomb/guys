/* SCRAPWALKER — ai.js
   AI operators (§9.2): competent, not brilliant. Both submit intents through
   the exact same seam as human input.

   v3: FTL priorities with moving intruders — intercept boarders, seal
   bulkheads around crises, stack power deep (output scales per pip),
   tidy up airlocks, heal wounded, man stations, go shopping. */

window.AI = (function () {
  const C = G.CONFIG;

  /* ============ AI BIG GUY: kite, stay open, hoover pickups ============ */
  function bigGuy(s) {
    const b = s.big;
    let vx = 0, vz = 0, threat = 0;

    for (const e of s.enemies) {
      const dx = b.x - e.x, dz = b.z - e.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 1200) continue;
      const d = Math.sqrt(d2) || 1;
      const w = (e.type === 'boss' ? 5 : e.type === 'bruiser' || e.type === 'charger' ? 3 : 1) / (d * d) * 60;
      vx += dx / d * w; vz += dz / d * w;
      threat += w;
    }
    // shrine channeling is a commitment: healthy mech tanks the 7 seconds.
    // Repulsion only gets a small vote so the channel actually completes.
    if (s.shrine && s.hp / s.maxHp > 0.35) {
      const dx = s.shrine.x - b.x, dz = s.shrine.z - b.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > G.CONFIG.SHRINE_RADIUS * 0.45) {
        const l0 = Math.hypot(vx, vz) || 1;
        vx = vx / l0 * 0.35 + dx / d * 1.6;
        vz = vz / l0 * 0.35 + dz / d * 1.6;
      } else {
        vx *= 0.15; vz *= 0.15;   // hold the ring, micro-dodge only
      }
      const l = Math.hypot(vx, vz) || 1;
      G.submitIntent({ t: 'bigMove', x: vx / l, z: vz / l });
      return;
    }
    if (threat < 2.5) {
      let best = null, bd = 900;
      for (const p of s.pickups) {
        const dx = p.x - b.x, dz = p.z - b.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = p; }
      }
      if (best) {
        const d = Math.sqrt(bd) || 1;
        vx += (best.x - b.x) / d * 0.8; vz += (best.z - b.z) / d * 0.8;
      }
    }
    const cd = Math.hypot(b.x, b.z);
    if (cd > C.ARENA_R * 0.72) { vx += (-b.x / cd) * 2.2; vz += (-b.z / cd) * 2.2; }
    if (Math.hypot(vx, vz) < 0.35) {
      const a = s.t * 0.35;
      vx += Math.cos(a) * 0.6; vz += Math.sin(a) * 0.6;
    }
    const l = Math.hypot(vx, vz) || 1;
    G.submitIntent({ t: 'bigMove', x: vx / l, z: vz / l });
  }

  /* ============ AI LITTLE GUY: FTL common sense ============ */
  let decideT = 0;

  function littleGuy(s, dt) {
    if (s.levelUp.pending) {
      s.levelUp.aiT -= dt;
      if (s.levelUp.aiT <= 0) G.submitIntent({ t: 'pick', idx: pickChoice(s) });
    }
    if (s.pendingGraft) placeGraft(s);   // weld the chosen part onto a pad
    decideT -= dt;
    if (decideT > 0) return;
    decideT = 0.35;

    assignCrew(s);
    allocatePower(s);
    manageDoorsAndAirlocks(s);
  }

  function placeGraft(s) {
    const valid = G.validGraftSlots(s);
    if (!valid.length) return;
    const home = G.HOME_SLOT[s.pendingGraft.room];
    let key = valid.some(v => v.key === home) ? home : null;
    if (!key) {   // fall back to the best-connected pad
      let bn = -1;
      for (const sl of valid) { const n = G.geoNeighbors(s, sl.rect).length; if (n > bn) { bn = n; key = sl.key; } }
    }
    G.submitIntent({ t: 'placeGraft', slot: key });
  }

  function pickChoice(s) {
    const o = s.levelUp.options || [];
    const rank = (opt) => {
      if (!opt) return -1;
      if (opt.id === 'hull' && s.hp / s.maxHp < 0.5) return 6;
      if (opt.id === 'crew' && s.goblins.length < 4) return 5;   // keep enough hands to man rooms
      if (opt.id === 'build') return 4;                          // then grow the arsenal
      if (opt.id === 'upgrade') return 3;
      if (opt.id === 'crew') return 2;
      return 1;
    };
    let best = 0;
    for (let i = 1; i < o.length; i++) if (rank(o[i]) > rank(o[best])) best = i;
    return best;
  }

  function assignCrew(s) {
    const busy = new Set();
    const claimed = new Set();

    // crises: intruders (incl. inbound & telegraphed) > fire > breach > damage
    const crises = [];
    const inbound = {};  // rooms intruders are walking toward
    for (const iv of s.intruders) {
      if (iv.path.length) inbound[iv.path[iv.path.length - 1]] = true;
    }
    // pre-position on the hazard telegraph — the FTL anticipation play
    if (s.hazard.warn && s.hazard.warn.room && s.hazard.warn.type === 'grubber') {
      inbound[s.hazard.warn.room] = true;
    }
    for (const id of G.builtIds(s)) {
      const r = s.rooms[id];
      const here = G.intrudersIn(s, id).length;
      if (here) crises.push({ id, pri: 5 + here, need: 2 });
      else if (inbound[id]) crises.push({ id, pri: 4, need: 2 });
      else if (r.fire > 0.05) crises.push({ id, pri: 3, need: 1 });
      else if (r.breach) crises.push({ id, pri: 2, need: 1 });
      else if (r.damage >= 0.5) crises.push({ id, pri: 1, need: 1 });
    }
    crises.sort((a, b) => b.pri - a.pri);

    for (const c of crises) {
      const r = s.rooms[c.id];
      const responders = s.goblins.filter(g => g.dest === c.id);
      responders.forEach(g => busy.add(g.id));
      let want = Math.min(c.need, r.slots - G.intrudersIn(s, c.id).length) - responders.length;
      while (want-- > 0) {
        const g = nearestFree(s, c.id, busy);
        if (!g) break;
        busy.add(g.id);
        if (g.dest !== c.id) G.submitIntent({ t: 'goblin', id: g.id, room: c.id });
      }
      claimed.add(c.id);
    }

    // wounded → medbay when built, safe, powered, and there's room
    const bay = s.rooms.medbay;
    const baySafe = bay.built && !G.roomInCrisis(s, bay) && G.systemActive(s, 'medbay');
    for (const g of s.goblins) {
      if (busy.has(g.id)) continue;
      if (g.dest === 'medbay' && g.hp < g.maxHp * 0.9) { busy.add(g.id); continue; }
      if (g.hp < g.maxHp * 0.35 && baySafe &&
          (g.dest === 'medbay' || G.occupantsIn(s, 'medbay') < bay.slots)) {
        busy.add(g.id);
        if (g.dest !== 'medbay') G.submitIntent({ t: 'goblin', id: g.id, room: 'medbay' });
      }
    }

    // man the value stations — bring the repair rig online while the hull is hurt
    const stations = ['armGun', 'armGun2', 'shields', 'legs', 'treads', 'head', 'coreOrbitals', 'mortar', 'zapper', 'sawWing'];
    if (s.rooms.repair.built && s.hp < s.maxHp * 0.85) stations.unshift('repair');
    for (const id of stations) {
      if (!s.rooms[id].built) continue;
      if (claimed.has(id)) continue;
      const r = s.rooms[id];
      if (G.roomEffPower(r) < 1) continue;
      const assigned = s.goblins.find(g => !busy.has(g.id) && g.dest === id);
      if (assigned) { busy.add(assigned.id); continue; }
      if (!G.roomHasFreeSlot(s, id)) continue;
      const g = nearestFree(s, id, busy);
      if (!g) break;
      busy.add(g.id);
      G.submitIntent({ t: 'goblin', id: g.id, room: id });
    }
  }

  function nearestFree(s, roomId, busy) {
    let best = null, bd = 99;
    for (const g of s.goblins) {
      if (busy.has(g.id)) continue;
      const d = roomDist(s, g.room, roomId);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  }

  function roomDist(s, a, b) {
    if (a === b) return 0;
    const seen = { [a]: 0 }, q = [a];
    while (q.length) {
      const cur = q.shift();
      for (const n of s.rooms[cur].neighbors) {
        if (!(n in seen)) { seen[n] = seen[cur] + 1; if (n === b) return seen[n]; q.push(n); }
      }
    }
    return 99;
  }

  /* power: output scales per pip, so stack deep in priority order */
  function allocatePower(s) {
    const wish = [
      ['armGun', 1], ['shields', 1], ['legs', 1], ['air', 1], ['armGun2', 1], ['treads', 1],
      ['coreOrbitals', 1], ['head', 1], ['mortar', 1], ['zapper', 1], ['sawWing', 1],
      ['shields', 2], ['armGun', 2], ['legs', 2], ['armGun2', 2],
      ['coreOrbitals', 2], ['head', 2], ['mortar', 2], ['zapper', 2], ['treads', 2],
      ['shields', 3], ['armGun', 3], ['legs', 3], ['air', 2],
      ['coreOrbitals', 3], ['head', 3], ['sawWing', 2], ['armGun2', 3],
    ];
    const target = {};
    for (const id of G.ROOM_IDS) if (s.rooms[id].sys !== 'reactor') target[id] = 0;
    let budget = s.reactor.pips;
    for (const [id, lvl] of wish) {
      const cap = G.roomCap(s.rooms[id]);
      if (lvl > cap) continue;
      const add = lvl - target[id];
      if (add <= 0) continue;
      if (budget >= add) { budget -= add; target[id] = lvl; }
    }
    if (s.goblins.some(g => g.room === 'medbay' && g.hp < g.maxHp) && target.medbay < 1) {
      if (budget >= 1) { target.medbay = 1; budget--; }
      else if (target.coreOrbitals > 0) { target.coreOrbitals--; target.medbay = 1; }
    }
    // power the repair rig to mend the shared hull when Big Guy is hurting
    if (s.rooms.repair.built && s.hp < s.maxHp * 0.75 && target.repair < 1) {
      if (budget >= 1) { budget--; target.repair = 1; }
      else if (target.coreOrbitals > 0) { target.coreOrbitals--; target.repair = 1; }
    }
    for (const id in target) {
      const cur = s.rooms[id].power;
      if (cur < target[id]) G.submitIntent({ t: 'power', room: id, delta: 1 });
      else if (cur > target[id]) G.submitIntent({ t: 'power', room: id, delta: -1 });
    }
  }

  /* bulkhead doctrine: seal around fire, breach, and intruders; open the rest.
     Close stray airlocks once their room's crisis is over. */
  function manageDoorsAndAirlocks(s) {
    const hot = {};
    for (const id of G.builtIds(s)) {
      const r = s.rooms[id];
      hot[id] = r.fire > 0.05 || r.breach || G.intrudersIn(s, id).length > 0;
    }
    for (const key in s.doors) {
      const [a, b] = key.split('-');
      const wantClosed = hot[a] || hot[b];
      if (s.doors[key].open === wantClosed) G.submitIntent({ t: 'door', key });
    }
    for (const id in s.airlocks) {
      if (s.airlocks[id].open && !hot[id]) G.submitIntent({ t: 'airlock', room: id });
    }
  }

  /* ============ dispatcher ============ */
  function tick(s, dt) {
    if (!s.started || s.over) return;
    if (s.humanSide !== 'big') bigGuy(s);
    if (s.humanSide !== 'little') littleGuy(s, dt);
  }

  return { tick };
})();
