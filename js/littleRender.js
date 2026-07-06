/* SCRAPWALKER — littleRender.js
   FTL-idiom mech-interior renderer + input for Little Guy.

   v4 fidelity pass: single drawn hull silhouette with shadow/bob/shake,
   consoles at station tiles ARE the manning read (crew stand at them,
   facing them), no room name text, doors slide open for passing crew,
   chunky pixel crew with smoothed movement and facing, FTL yellow doors,
   pink airless stripes, chamfered panels, border-charge weapon boxes,
   portrait rows whose background is the health bar, centered warning
   banners, two-line tooltips, shield bubble around the hull.

   Reads G.state; mutations leave only as intents (§10.3). */

window.LITTLER = (function () {
  let cv, ctx;
  let selected = null;
  let hover = { x: -1, y: -1 };
  let regions = [];
  let lastTime = 0;
  const rp = {};                 // per-entity render position/facing cache

  const FONT = '"Chakra Petch","Courier New",monospace';
  const COL = {
    floor: '#e2e0d8', floorLine: '#c9c7bd', floorShadow: 'rgba(30,36,44,0.25)',
    wall: '#14181d', wallHi: '#6a7683',
    hull: '#39414c', hullEdge: '#10151b', hullSeam: '#2b323b',
    panel: '#141c23', panelEdge: '#48606f', panelHi: '#5d7787',
    green: '#69c46e', orange: '#e8a33d', red: '#d0453e', blue: '#7fb4c9',
    gold: '#e8c860', text: '#cfe0ea', dim: '#7d919e',
    door: '#c98a2e', doorDark: '#8a5f1e',
    goblin: '#63b93e', goblinLight: '#83d454', goblinDark: '#2c5a1e',
  };

  /* ---------- geometry ---------- */
  const T = 50;
  const ROOM_LAYOUT = {
    head:         { rect: [350, 80, 100, 50] },
    sawWing:      { rect: [450, 80, 100, 50] },
    armGun:       { rect: [250, 130, 100, 50] },
    reactor:      { rect: [350, 130, 100, 100] },
    coreOrbitals: { rect: [450, 130, 100, 100] },
    mortar:       { rect: [150, 180, 100, 50] },
    shields:      { rect: [250, 180, 100, 100] },
    air:          { rect: [350, 230, 100, 50] },
    medbay:       { rect: [450, 230, 100, 50] },
    zapper:       { rect: [450, 280, 100, 50] },
    legs:         { rect: [350, 280, 100, 100] },
  };
  const AIRLOCK_PX = {
    armGun: { x: 250, y: 155, horiz: false, out: -1 },
    medbay: { x: 550, y: 255, horiz: false, out: 1 },
    legs:   { x: 400, y: 380, horiz: true, out: 1 },
  };
  /* base hull: the headless starting brute (armGun/reactor/shields/air/legs).
     Grafted rooms get their own welded-on pads — seams are the flavor. */
  const HULL_PATH = [
    [238, 118], [370, 118],
    [370, 104], [430, 104], [430, 118],       // neck stub, waiting for a head
    [462, 118], [462, 392],
    [470, 412], [404, 412], [404, 394],       // right foot
    [396, 394], [396, 412], [330, 412], [338, 392],  // left foot
    [338, 292], [238, 292],
    [238, 186],
    [204, 180], [202, 128], [238, 122],       // gun-arm fist
  ];
  const CLUSTER = { px: 6, py: 556, pw: 288, ph: 152, x0: 42, colW: 22, iconY: 686, pipH: 8, pipGap: 10 };
  const CLUSTER_ORDER = ['shields', 'legs', 'air', 'medbay', 'repair', 'armGun', 'coreOrbitals', 'head', 'mortar', 'zapper', 'sawWing'];
  const WEAPON_BAR = { x0: 300, y0: 644, w: 47, h: 62, gap: 2.5 };
  const WEAPON_ORDER = G.WEAPON_ORDER;
  const PORTRAITS = { x: 10, y: 76, w: 178, h: 48, gap: 5 };
  const dust = [];
  for (let i = 0; i < 70; i++) {
    dust.push({ x: Math.random() * 700, y: Math.random() * 712, r: Math.random() * 1.4 + 0.4, a: Math.random() * 0.25 + 0.05 });
  }

  // rooms carry their own rect in state now (grafts get theirs at placement);
  // ROOM_LAYOUT is only a fallback for the fixed starting body.
  function roomRect(id) {
    const r = G.state && G.state.rooms[id];
    if (r && r.rect) return r.rect;
    return ROOM_LAYOUT[id] ? ROOM_LAYOUT[id].rect : null;
  }
  function roomCenter(id) { const r = roomRect(id); return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 }; }
  function tileXY(id, slot) {
    const [x, y] = roomRect(id);
    return { x: x + (slot % 2) * T + T / 2, y: y + ((slot / 2) | 0) * T + T / 2 };
  }
  function doorPx(a, b) {
    const ra = roomRect(a), rb = roomRect(b);
    if (ra[0] + ra[2] === rb[0] || rb[0] + rb[2] === ra[0]) {
      const x = ra[0] + ra[2] === rb[0] ? rb[0] : ra[0];
      const y0 = Math.max(ra[1], rb[1]), y1 = Math.min(ra[1] + ra[3], rb[1] + rb[3]);
      return { x, y: (y0 + y1) / 2, horiz: false };
    }
    const y = ra[1] + ra[3] === rb[1] ? rb[1] : ra[1];
    const x0 = Math.max(ra[0], rb[0]), x1 = Math.min(ra[0] + ra[2], rb[0] + rb[2]);
    return { x: (x0 + x1) / 2, y, horiz: true };
  }
  function chamfer(c, x, y, w, h, cut) {
    c.beginPath();
    c.moveTo(x + cut, y);
    c.lineTo(x + w - cut, y); c.lineTo(x + w, y + cut);
    c.lineTo(x + w, y + h - cut); c.lineTo(x + w - cut, y + h);
    c.lineTo(x + cut, y + h); c.lineTo(x, y + h - cut);
    c.lineTo(x, y + cut);
    c.closePath();
  }

  /* ---------- init & input ---------- */
  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
    cv.addEventListener('mousedown', onMouse);
    cv.addEventListener('mousemove', e => { const p = canvasXY(e); hover.x = p.x; hover.y = p.y; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  function canvasXY(e) {
    const b = cv.getBoundingClientRect();
    return { x: (e.clientX - b.left) * (cv.width / b.width), y: (e.clientY - b.top) * (cv.height / b.height) };
  }

  function onMouse(e) {
    const s = G.state;
    if (s.humanSide !== 'little' || !s.started || s.over) return;
    const p = canvasXY(e);
    const right = e.button === 2;
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        r.act(right);
        return;
      }
    }
    if (!right) selected = null;
  }

  function selectGoblin(id) { selected = (selected === id) ? null : id; }

  /* ================= draw ================= */
  function draw(s, time) {
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    regions = [];
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.textBaseline = 'alphabetic';

    drawBackdrop(s, time);

    // the whole ship bobs; hits shake it (interior juice)
    const shake = s.big.hitFlash > 0 ? s.big.shake * 4 : 0;
    const ox = Math.sin(time * 0.7) * 1.5 + (Math.random() - 0.5) * shake;
    const oy = Math.cos(time * 0.9) * 2 + (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(ox, oy);
    const built = G.builtIds(s).filter(id => roomRect(id));
    drawHull(s, time);
    drawExpansionPads(s, time, built);
    drawGraftPlacement(s, time);
    for (const id of built) drawRoomFloor(s, id, time);
    drawWallsAndDoors(s, time, built);
    drawAirlocks(s, time);
    for (const id of built) drawRoomContents(s, id, time);
    drawIntruders(s, time, dt);
    drawGoblins(s, time, dt);
    for (const id of built) drawRoomOverlays(s, id, time);
    drawShieldBubble(s, time);
    ctx.restore();

    drawTopReadout(s, time);
    drawBanner(s, time);
    drawPortraits(s, time);
    drawLog(s);
    drawPowerCluster(s, time);
    drawWeaponBar(s, time);
    drawTooltip(s);
  }

  function drawBackdrop(s, time) {
    for (const d of dust) {
      ctx.fillStyle = 'rgba(150,170,190,' + d.a + ')';
      ctx.fillRect(d.x, d.y, d.r, d.r);
    }
    const haze = ctx.createLinearGradient(0, 640, 0, 712);
    haze.addColorStop(0, 'rgba(60,45,80,0)');
    haze.addColorStop(1, 'rgba(60,45,80,0.25)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 560, 700, 152);
  }

  /* ---------- hull: one silhouette, shadowed, seamed ---------- */
  function hullPath(c) {
    c.beginPath();
    c.moveTo(HULL_PATH[0][0], HULL_PATH[0][1]);
    for (let i = 1; i < HULL_PATH.length; i++) c.lineTo(HULL_PATH[i][0], HULL_PATH[i][1]);
    c.closePath();
  }

  /* grafted rooms: welded-on hull pads with stitch seams + build-in flash */
  function drawExpansionPads(s, time, built) {
    for (const id of G.EXPANSION_ORDER) {
      if (!built.includes(id)) continue;
      const r = s.rooms[id];
      const [x, y, w, h] = roomRect(id);
      const P = 12;
      const age = s.t - r.builtT;
      const pop = age < 1 ? 0.6 + 0.4 * Math.min(1, age) : 1;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(pop, pop);
      ctx.translate(-(x + w / 2), -(y + h / 2));
      // shadow, pad, outline — a slightly different plate tone (scavenged)
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      chamfer(ctx, x - P + 5, y - P + 8, w + P * 2, h + P * 2, 8);
      ctx.fill();
      ctx.fillStyle = '#414a56';
      chamfer(ctx, x - P, y - P, w + P * 2, h + P * 2, 8);
      ctx.fill();
      ctx.strokeStyle = age < 1.2 && Math.sin(time * 12) > 0 ? COL.green : COL.hullEdge;
      ctx.lineWidth = 3;
      chamfer(ctx, x - P, y - P, w + P * 2, h + P * 2, 8);
      ctx.stroke();
      ctx.lineWidth = 1;
      // weld stitches along every edge that meets the rest of the body
      ctx.strokeStyle = '#8a93a0';
      ctx.setLineDash([4, 5]);
      for (const n of G.builtNeighbors(s, id)) {
        if (!roomRect(n)) continue;
        const d = doorPx(id, n);
        ctx.beginPath();
        if (d.horiz) { ctx.moveTo(d.x - 40, d.y); ctx.lineTo(d.x + 40, d.y); }
        else { ctx.moveTo(d.x, d.y - 30); ctx.lineTo(d.x, d.y + 30); }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // rivets
      ctx.fillStyle = '#5a6470';
      ctx.fillRect(x - 8, y - 8, 3, 3);
      ctx.fillRect(x + w + 5, y - 8, 3, 3);
      ctx.fillRect(x - 8, y + h + 5, 3, 3);
      ctx.fillRect(x + w + 5, y + h + 5, 3, 3);
      ctx.restore();
    }
  }

  /* ---------- graft placement: crew chooses which pad to weld the new room onto ---------- */
  function drawGraftPlacement(s, time) {
    if (!s.pendingGraft) return;
    const id = s.pendingGraft.room;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    for (const { key, rect } of G.validGraftSlots(s)) {
      const [x, y, w, h] = rect;
      ctx.save();
      ctx.fillStyle = 'rgba(105,196,110,' + (0.08 + 0.10 * pulse) + ')';
      chamfer(ctx, x, y, w, h, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(105,196,110,' + (0.5 + 0.45 * pulse) + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      chamfer(ctx, x, y, w, h, 8); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      drawSysIcon(ctx, id, x + w / 2, y + h / 2, 20, 'rgba(150,230,160,' + (0.55 + 0.4 * pulse) + ')');
      ctx.restore();
      regions.push({
        x, y, w, h,
        tip: { t: 'WELD ' + s.rooms[id].name + ' HERE', b: 'doors line up — click to install' },
        act: () => G.submitIntent({ t: 'placeGraft', slot: key }),
      });
    }
    // prompt
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = Math.sin(time * 4) > -0.3 ? COL.green : '#3f7d43';
    ctx.fillText('◈ WELD ' + s.rooms[id].name + ' — CLICK A GLOWING PAD ◈', 400, 60);
    ctx.textAlign = 'left';
  }

  function drawHull(s, time) {
    // drop shadow — the ship floats over the surface
    ctx.save();
    ctx.translate(6, 10);
    hullPath(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.restore();

    hullPath(ctx);
    ctx.fillStyle = COL.hull;
    ctx.fill();
    // panel seams
    ctx.strokeStyle = COL.hullSeam;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(240, 124); ctx.lineTo(560, 124);
    ctx.moveTo(344, 236); ctx.lineTo(344, 386);
    ctx.moveTo(456, 236); ctx.lineTo(456, 286);
    ctx.stroke();
    // outline
    hullPath(ctx);
    ctx.strokeStyle = COL.hullEdge;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.lineWidth = 1;
    // rivets
    ctx.fillStyle = '#4c555f';
    for (const [rx, ry] of [[244, 124], [556, 124], [556, 286], [244, 286], [344, 398], [456, 398], [210, 134], [210, 172]]) {
      ctx.fillRect(rx, ry, 3, 3);
    }
    // goblin-skull decal on the fist
    ctx.fillStyle = '#2b323b';
    ctx.beginPath(); ctx.arc(219, 150, 7, 0, 7); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(213, 146); ctx.lineTo(206, 141); ctx.lineTo(214, 143);
    ctx.moveTo(225, 146); ctx.lineTo(232, 141); ctx.lineTo(224, 143);
    ctx.fill();
    ctx.fillStyle = COL.hull;
    ctx.fillRect(215, 148, 3, 3);
    ctx.fillRect(221, 148, 3, 3);
    // red edge flash when the mech takes a hit
    if (s.big.hitFlash > 0) {
      hullPath(ctx);
      ctx.strokeStyle = 'rgba(220,50,50,' + Math.min(1, s.big.hitFlash * 3) + ')';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  function drawShieldBubble(s, time) {
    if (s.shield.layers <= 0) return;
    ctx.strokeStyle = 'rgba(127,180,201,' + (0.35 + s.shield.layers * 0.12 + Math.sin(time * 3) * 0.06) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(382, 217, 196 + Math.sin(time * 2.4) * 3, 208, 0, 0, 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(127,180,201,0.05)';
    ctx.fill();
    ctx.lineWidth = 1;
  }

  /* ---------- floors ---------- */
  function drawRoomFloor(s, id, time) {
    const r = s.rooms[id];
    const [x, y, w, h] = roomRect(id);
    if (ASSETS.ready('floor')) {
      // painted deck plating, one plate per tile (art fallback below)
      for (let gy = y; gy < y + h; gy += T)
        for (let gx = x; gx < x + w; gx += T)
          ASSETS.drawCell(ctx, 'floor', 0, gx, gy, T, T);
    } else {
      ctx.fillStyle = COL.floor;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = COL.floorLine;
      for (let gx = x + T; gx < x + w; gx += T) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
      for (let gy = y + T; gy < y + h; gy += T) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
    }
    // inner wall shadow for depth
    ctx.strokeStyle = COL.floorShadow;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.lineWidth = 1;

    // hover highlight + move markers for the selected goblin
    const sel = s.goblins.find(g => g.id === selected);
    if (sel) {
      if (hover.x >= x && hover.x <= x + w && hover.y >= y && hover.y <= y + h) {
        ctx.strokeStyle = COL.green;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
        ctx.lineWidth = 1;
      }
      if (sel.dest === id && sel.path.length) {
        const slot = G.firstFreeSlot(s, id, true);
        if (slot != null) {
          const p = tileXY(id, slot);
          ctx.strokeStyle = COL.green;
          ctx.lineWidth = 2;
          chamfer(ctx, p.x - 16, p.y - 16, 32, 32, 5);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
    }
    regions.unshift({
      x, y, w, h,
      tip: { t: r.name, b: 'air ' + Math.round(r.air * 100) + '%' + (r.damage >= 0.5 ? ' · damaged' : '') + (G.roomManned(s, id) ? ' · manned' : '') },
      act: (right) => {
        if (!right && selected) {
          G.submitIntent({ t: 'goblin', id: selected, room: id });
          selected = null;
        }
      },
    });
  }

  /* ---------- walls + FTL yellow doors that open for crew ---------- */
  function crewTransiting(s, key) {
    for (const g of s.goblins) {
      if (g.path.length && G.doorKey(g.room, g.path[0]) === key && g.hopT > 0.28 && g.hopT < 0.72) return true;
    }
    return false;
  }

  function drawWallsAndDoors(s, time, built) {
    // double-line walls: dark stroke + inner highlight
    for (const id of built) {
      const [x, y, w, h] = roomRect(id);
      ctx.strokeStyle = COL.wall;
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = COL.wallHi;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
    }

    for (const key in s.doors) {
      const [a, b] = key.split('-');
      if (!s.rooms[a].built || !s.rooms[b].built) continue;
      const d = doorPx(a, b);
      const sealed = !s.doors[key].open;
      const slidOpen = !sealed || crewTransiting(s, key);   // crew auto-open sealed doors
      let bash = 0;
      for (const iv of s.intruders) {
        if (iv.path.length && G.doorKey(iv.room, iv.path[0]) === key && iv.bashT > 0) bash = iv.bashT;
      }
      const L = 26, TH = 9;
      const shakeD = bash ? Math.sin(time * 40) * 1.5 : 0;
      ctx.save();
      ctx.translate(d.x + (d.horiz ? 0 : shakeD), d.y + (d.horiz ? shakeD : 0));
      // clear the wall gap to floor
      ctx.fillStyle = COL.floor;
      if (d.horiz) ctx.fillRect(-L / 2, -4, L, 8);
      else ctx.fillRect(-4, -L / 2, 8, L);
      // panels
      const panel = sealed ? COL.doorDark : COL.door;
      ctx.fillStyle = panel;
      const g = slidOpen ? 7 : 0;   // panel retraction
      if (d.horiz) {
        ctx.fillRect(-L / 2, -TH / 2, L / 2 - 2 - g, TH);
        ctx.fillRect(2 + g, -TH / 2, L / 2 - 2 - g, TH);
        ctx.strokeStyle = COL.hullEdge;
        ctx.strokeRect(-L / 2, -TH / 2, L, TH);
      } else {
        ctx.fillRect(-TH / 2, -L / 2, TH, L / 2 - 2 - g);
        ctx.fillRect(-TH / 2, 2 + g, TH, L / 2 - 2 - g);
        ctx.strokeStyle = COL.hullEdge;
        ctx.strokeRect(-TH / 2, -L / 2, TH, L);
      }
      if (sealed && !slidOpen) {
        ctx.strokeStyle = COL.red;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (d.horiz) { ctx.moveTo(0, -TH / 2 + 1); ctx.lineTo(0, TH / 2 - 1); }
        else { ctx.moveTo(-TH / 2 + 1, 0); ctx.lineTo(TH / 2 - 1, 0); }
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (bash) {
        ctx.fillStyle = COL.orange;
        ctx.fillRect(-2 + Math.sin(time * 31) * 4, -2, 3, 3);
      }
      ctx.restore();
      regions.push({
        x: d.x - 15, y: d.y - 15, w: 30, h: 30,
        tip: { t: 'BULKHEAD', b: sealed ? (bash ? 'BEING FORCED! click to open' : 'sealed — click to open') : 'open — click to seal' },
        act: () => G.submitIntent({ t: 'door', key }),
      });
    }
  }

  /* ---------- airlocks: exterior doors onto the void ---------- */
  function drawAirlocks(s, time) {
    for (const id in AIRLOCK_PX) {
      if (!s.rooms[id].built) continue;
      const a = AIRLOCK_PX[id];
      const open = s.airlocks[id].open;
      const L = 24, TH = 9;
      ctx.save();
      ctx.translate(a.x, a.y);
      // void behind when open
      ctx.fillStyle = open ? '#06090d' : COL.floor;
      if (a.horiz) ctx.fillRect(-L / 2, -4, L, 8);
      else ctx.fillRect(-4, -L / 2, 8, L);
      ctx.fillStyle = open ? '#31414d' : '#4a5866';
      const g = open ? 7 : 0;
      if (a.horiz) {
        ctx.fillRect(-L / 2, -TH / 2, L / 2 - 2 - g, TH);
        ctx.fillRect(2 + g, -TH / 2, L / 2 - 2 - g, TH);
      } else {
        ctx.fillRect(-TH / 2, -L / 2, TH, L / 2 - 2 - g);
        ctx.fillRect(-TH / 2, 2 + g, TH, L / 2 - 2 - g);
      }
      ctx.strokeStyle = open ? COL.red : COL.blue;
      if (a.horiz) ctx.strokeRect(-L / 2, -TH / 2, L, TH);
      else ctx.strokeRect(-TH / 2, -L / 2, TH, L);
      if (open) {
        for (let i = 0; i < 3; i++) {
          const vt = (time * 2 + i * 0.33) % 1;
          ctx.strokeStyle = 'rgba(180,220,235,' + (0.6 * (1 - vt)) + ')';
          ctx.beginPath();
          if (a.horiz) { ctx.moveTo(-6 + i * 6, 6 + vt * 14); ctx.lineTo(-4 + i * 6, 6 + vt * 22); }
          else { ctx.moveTo(a.out * (6 + vt * 14), -6 + i * 6); ctx.lineTo(a.out * (6 + vt * 22), -4 + i * 6); }
          ctx.stroke();
        }
      }
      ctx.restore();
      regions.push({
        x: a.x - 14, y: a.y - 14, w: 28, h: 28,
        tip: { t: 'AIRLOCK', b: open ? 'VENTING — click to seal' : 'click to vent this room to the void' },
        act: () => G.submitIntent({ t: 'airlock', room: id }),
      });
    }
  }

  /* ---------- system icons + consoles ---------- */
  function sysIconColor(s, id, time) {
    const r = s.rooms[id];
    if (G.roomCap(r) === 0) return Math.sin(time * 8) > 0 ? COL.red : '#7d2a26';
    if (r.damage > 0) return COL.orange;
    if (!G.systemActive(s, id) && r.sys !== 'reactor') return '#8b9099';
    return '#5b636d';
  }

  const ICON_FRAME = { weapon: 0, shield: 1, leg: 2, air: 3, medbay: 4, repair: 5, reactor: 6, head: 7 };
  function drawSysIcon(c, id, x, y, sz, color) {
    // painted sprite icon (state is conveyed by pips/overlays around it); vector fallback below
    const sys = G.ROOM_DEFS[id] && G.ROOM_DEFS[id].sys;
    const fr = ICON_FRAME[sys];
    if (fr != null && ASSETS.ready('icons')) {
      const d = sz * 1.7;
      ASSETS.drawCell(c, 'icons', fr, x - d / 2, y - d / 2, d, d);
      return;
    }
    c.save();
    c.translate(x, y);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = Math.max(1.5, sz * 0.09);
    const h = sz / 2;
    if (id === 'armGun') {
      c.fillRect(-h, -sz * 0.18, sz * 0.95, sz * 0.3);
      c.fillRect(-h * 0.4, sz * 0.12, sz * 0.22, sz * 0.34);
      c.fillRect(h * 0.55, -sz * 0.08, sz * 0.25, sz * 0.12);
    } else if (id === 'coreOrbitals') {
      c.beginPath(); c.arc(0, 0, sz * 0.18, 0, 7); c.fill();
      c.beginPath(); c.ellipse(0, 0, h, sz * 0.22, -0.5, 0, 7); c.stroke();
      c.beginPath(); c.arc(h * Math.cos(-0.5) * 0.9, h * Math.sin(-0.5) * 0.9, sz * 0.1, 0, 7); c.fill();
    } else if (id === 'shields') {
      c.beginPath();
      c.moveTo(-h * 0.8, -h * 0.6);
      c.quadraticCurveTo(0, -h, h * 0.8, -h * 0.6);
      c.lineTo(h * 0.6, h * 0.3);
      c.quadraticCurveTo(0, h, -h * 0.6, h * 0.3);
      c.closePath(); c.stroke();
    } else if (id === 'legs') {
      c.fillRect(-h * 0.3, -h, sz * 0.28, sz * 0.7);
      c.fillRect(-h * 0.3, h * 0.4, sz * 0.6, sz * 0.26);
    } else if (id === 'head') {
      c.beginPath();
      c.moveTo(0, -h);
      c.quadraticCurveTo(h, 0, 0, h);
      c.quadraticCurveTo(-h, 0, 0, -h);
      c.fill();
    } else if (id === 'air') {
      c.beginPath(); c.arc(0, 0, h * 0.9, 0, 7); c.stroke();
      for (let b = 0; b < 3; b++) {
        const a = b * 2.09;
        c.beginPath(); c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * h * 0.7, Math.sin(a) * h * 0.7);
        c.stroke();
      }
    } else if (id === 'medbay') {
      c.fillRect(-sz * 0.14, -h, sz * 0.28, sz);
      c.fillRect(-h, -sz * 0.14, sz, sz * 0.28);
    } else if (id === 'mortar') {
      // angled tube + shell arc
      c.save();
      c.rotate(-0.6);
      c.fillRect(-sz * 0.15, -h, sz * 0.3, sz * 0.9);
      c.restore();
      c.beginPath(); c.arc(h * 0.45, -h * 0.45, sz * 0.12, 0, 7); c.fill();
    } else if (id === 'zapper') {
      c.beginPath();
      c.moveTo(h * 0.25, -h); c.lineTo(-h * 0.45, h * 0.1); c.lineTo(0, h * 0.1);
      c.lineTo(-h * 0.25, h); c.lineTo(h * 0.45, -h * 0.1); c.lineTo(0, -h * 0.1);
      c.closePath(); c.fill();
      c.beginPath(); c.arc(0, 0, h * 0.95, 0.4, 2.2); c.stroke();
    } else if (id === 'sawWing') {
      c.beginPath(); c.arc(0, 0, h * 0.6, 0, 7); c.stroke();
      for (let tooth = 0; tooth < 6; tooth++) {
        const a = tooth / 6 * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(a) * h * 0.6, Math.sin(a) * h * 0.6);
        c.lineTo(Math.cos(a + 0.3) * h, Math.sin(a + 0.3) * h);
        c.stroke();
      }
      c.beginPath(); c.arc(0, 0, h * 0.15, 0, 7); c.fill();
    } else if (id === 'reactor') {
      c.beginPath();
      c.moveTo(h * 0.2, -h); c.lineTo(-h * 0.5, h * 0.15); c.lineTo(0, h * 0.15);
      c.lineTo(-h * 0.2, h); c.lineTo(h * 0.5, -h * 0.15); c.lineTo(0, -h * 0.15);
      c.closePath(); c.fill();
    } else if (id === 'repair') {
      // wrench (open jaw + shaft) with a hex nut — mends the hull
      c.save();
      c.rotate(-0.7);
      c.fillRect(-sz * 0.11, -sz * 0.45, sz * 0.22, sz * 0.7);
      c.lineWidth = Math.max(2, sz * 0.14);
      c.beginPath(); c.arc(0, -sz * 0.45, sz * 0.22, Math.PI * 0.18, Math.PI * 1.82); c.stroke();
      c.restore();
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2;
        const px = sz * 0.33 + Math.cos(a) * sz * 0.17, py = sz * 0.30 + Math.sin(a) * sz * 0.17;
        k ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath(); c.stroke();
    }
    c.restore();
  }

  function drawRoomContents(s, id, time) {
    const r = s.rooms[id];
    const cen = roomCenter(id);
    drawSysIcon(ctx, id, cen.x, cen.y, 24, sysIconColor(s, id, time));

    // wrench overlay while damaged (FTL repair read)
    if (r.damage > 0) {
      const blink = Math.sin(time * 6) > -0.3;
      if (blink) {
        ctx.save();
        ctx.translate(cen.x + 20, cen.y - 16);
        ctx.rotate(-0.7);
        ctx.fillStyle = COL.orange;
        ctx.fillRect(-2, -7, 4, 12);
        ctx.beginPath(); ctx.arc(0, -8, 4, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
        ctx.strokeStyle = COL.orange;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, -8, 4, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
      }
      // repair progress ring
      const frac = 1 - (r.damage / Math.max(1, r.tier));
      ctx.strokeStyle = COL.orange;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cen.x + 21, cen.y - 15, 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // console at the station tile — standing at it IS manning
    if (r.station != null) {
      const p = tileXY(id, r.station);
      const active = G.systemActive(s, id);
      const cy = p.y - 17;
      ctx.fillStyle = '#39414c';
      ctx.fillRect(p.x - 10, cy, 20, 8);              // desk
      ctx.fillStyle = '#10151b';
      ctx.fillRect(p.x - 8, cy - 7, 16, 7);           // screen
      if (active) {
        const sysCol = { weapon: COL.gold, shield: COL.blue, leg: '#b48ce8', head: '#e8a2d8', air: '#8fd4c2', medbay: COL.green, repair: '#e0813c' }[r.sys] || COL.green;
        ctx.fillStyle = sysCol;
        ctx.globalAlpha = G.roomManned(s, id) ? 0.9 : 0.35;
        ctx.fillRect(p.x - 7, cy - 6, 14, 5);
        if (G.roomManned(s, id) && Math.sin(time * 10 + p.x) > 0.3) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(p.x - 6 + ((time * 26) % 12), cy - 6, 2, 5);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (id === 'reactor') {
      const pulse = 0.35 + 0.25 * Math.sin(time * 3);
      ctx.strokeStyle = 'rgba(105,196,110,' + pulse + ')';
      ctx.beginPath(); ctx.arc(cen.x, cen.y, 21, 0, 7); ctx.stroke();
    }
  }

  /* ---------- overlays: fire, breach/leak, stripes, telegraph ---------- */
  function drawRoomOverlays(s, id, time) {
    const r = s.rooms[id];
    const [x, y, w, h] = roomRect(id);

    if (r.fire > 0.02) {
      const frame = ((time * 8) | 0) % 2;   // two-frame flicker, FTL-style
      for (let t = 0; t < r.slots; t++) {
        const p = tileXY(id, t);
        for (let i = 0; i < 2; i++) {
          const fx2 = p.x - 10 + i * 20 + (frame ? 2 : -2);
          const fh = (14 + (frame ? 5 : 0) + Math.sin(t * 3 + i * 2) * 3) * (0.5 + r.fire * 0.8);
          ctx.fillStyle = i === frame ? 'rgba(235,110,40,0.9)' : 'rgba(245,195,90,0.8)';
          ctx.beginPath();
          ctx.moveTo(fx2 - 6, p.y + 18);
          ctx.quadraticCurveTo(fx2 - 2, p.y + 18 - fh * 0.7, fx2, p.y + 18 - fh);
          ctx.quadraticCurveTo(fx2 + 2, p.y + 18 - fh * 0.6, fx2 + 6, p.y + 18);
          ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(40,24,16,' + (0.3 * r.fire) + ')';
      ctx.fillRect(x, y, w, 18);
    }

    if (r.breach) {
      const p = tileXY(id, r.slots - 1);
      const scale = r.leak ? 0.6 : 1;
      ctx.fillStyle = '#0a0d12';
      ctx.beginPath();
      for (let a = 0; a < 9; a++) {
        const ang = a / 9 * Math.PI * 2;
        const rad = (a % 2 ? 7 : 11) * scale;
        const px = p.x + Math.cos(ang) * rad, py = p.y + Math.sin(ang) * rad * 0.8;
        a ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const vt = (time * 1.6 + i * 0.33) % 1;
        ctx.strokeStyle = 'rgba(170,210,230,' + (0.5 * (1 - vt) * scale) + ')';
        ctx.beginPath();
        ctx.moveTo(p.x - 5 + i * 5, p.y - vt * 15 * scale);
        ctx.lineTo(p.x - 2 + i * 5, p.y - vt * 24 * scale);
        ctx.stroke();
      }
      if (r.weld > 0) {
        const need = r.leak ? G.CONFIG.LEAK_WELD_TIME : G.CONFIG.WELD_TIME;
        ctx.strokeStyle = COL.gold;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14 * scale, -Math.PI / 2, -Math.PI / 2 + (r.weld / need) * Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    // airless: pink-red candy stripes (no text — the stripes ARE the message)
    if (r.air < 0.6) {
      const alpha = Math.min(0.55, (0.6 - r.air) * 1.2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      for (let sx = x - h - 20; sx < x + w; sx += 16) {
        ctx.strokeStyle = 'rgba(224,96,110,' + alpha + ')';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(sx, y + h); ctx.lineTo(sx + h, y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,190,200,' + alpha * 0.5 + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx + 5, y + h); ctx.lineTo(sx + 5 + h, y); ctx.stroke();
      }
      ctx.restore();
      ctx.lineWidth = 1;
    }

    // hazard telegraph: something is actually about to happen here
    const warned = s.hazard.warn && s.hazard.warn.room === id;
    if (warned && Math.sin(time * 10) > -0.2) {
      ctx.strokeStyle = COL.orange;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
      ctx.lineWidth = 1;
    }
  }

  /* ---------- characters: smoothed positions + facing ---------- */
  function transitXY(s, ent) {
    const a = roomCenter(ent.room), b = roomCenter(ent.path[0]);
    const d = doorPx(ent.room, ent.path[0]);
    const t = ent.hopT;
    if (t < 0.5) {
      const k = t / 0.5;
      return { x: a.x + (d.x - a.x) * k, y: a.y + (d.y - a.y) * k };
    }
    const k = (t - 0.5) / 0.5;
    return { x: d.x + (b.x - d.x) * k, y: d.y + (b.y - d.y) * k };
  }

  function smoothed(id, tx, ty, dt, manning) {
    let e = rp[id];
    if (!e) { e = rp[id] = { x: tx, y: ty, face: 'down' }; }
    const dx = tx - e.x, dy = ty - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 70) { e.x = tx; e.y = ty; }
    else if (dist > 0.5) {
      const step = Math.min(dist, 90 * dt);
      e.x += dx / dist * step;
      e.y += dy / dist * step;
      e.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
    if (manning) e.face = 'up';   // working the console, back to camera
    return e;
  }

  function drawGoblins(s, time, dt) {
    for (const g of s.goblins) {
      const manning = g.task === 'manning';
      let target;
      if (g.path.length) target = transitXY(s, g);
      else {
        target = tileXY(g.room, g.slot);
        if (manning) target = { x: target.x, y: target.y - 5 };  // snug to console
      }
      const p = smoothed(g.id, target.x, target.y, dt, manning);
      drawGoblin(s, g, p, time);
      regions.push({
        x: p.x - 12, y: p.y - 28, w: 24, h: 36,
        tip: { t: g.name, b: Math.ceil(g.hp) + '/' + g.maxHp + ' HP · ' + g.task },
        act: (right) => { if (!right) selectGoblin(g.id); },
      });
    }
    // prune stale cache
    for (const id in rp) {
      if (id[0] === 'g' && !s.goblins.some(g => g.id === id)) delete rp[id];
      if (id[0] === 'i' && !s.intruders.some(iv => iv.id === id)) delete rp[id];
    }
  }

  /* crew sprite atlas frame for a goblin's current task (see assets/goblin_crew.png) */
  function goblinFrame(g) {
    if (g.flashT > 0) return 6;                            // hurt
    switch (g.task) {
      case 'moving':       return 1 + (Math.floor(g.animT * 8) % 2);  // walk A/B
      case 'manning':                                      // side-on at a console
      case 'repairing':
      case 'mending':      return 3;                       // hunched at a panel, wrench
      case 'welding':
      case 'firefighting': return 4;                       // arm out with a spark
      case 'fighting':     return 5;                       // fists up
      default:             return 0;                       // idle / healing / waiting
    }
  }

  /* chunky pixel goblin, 4-way facing, task poses */
  function drawGoblin(s, g, p, time) {
    const x = Math.round(p.x), face = p.face;
    const moving = g.task === 'moving';
    const kneel = g.task === 'welding' ? 3 : 0;
    const bob = moving ? Math.sin(g.animT * 14) * 1.5
      : (g.task === 'idle' || g.task === 'manning') ? Math.sin(g.animT * 3) * 0.8 : 0;
    const y = Math.round(p.y + bob + kneel - 4);
    const hurt = g.flashT > 0;
    const body = hurt ? '#e88a8a' : COL.goblin;
    const skin = hurt ? '#e88a8a' : COL.goblinLight;

    // sprite path — falls back to the procedural body below when the sheet isn't loaded
    if (ASSETS.ready('goblin')) {
      const DRAW = 44;
      const footY = Math.round(p.y + bob + 7);
      if (g.id === selected) {
        ctx.strokeStyle = COL.green; ctx.lineWidth = 2;
        chamfer(ctx, x - 16, footY - DRAW + 4, 32, DRAW - 2, 5); ctx.stroke(); ctx.lineWidth = 1;
      }
      ASSETS.drawFrame(ctx, 'goblin', goblinFrame(g), x, footY, DRAW, face === 'left');
      if (g.hp < g.maxHp) {
        ctx.fillStyle = '#10151b'; ctx.fillRect(x - 10, footY - DRAW + 2, 20, 3);
        ctx.fillStyle = g.hp / g.maxHp > 0.4 ? COL.green : COL.red;
        ctx.fillRect(x - 10, footY - DRAW + 2, 20 * (g.hp / g.maxHp), 3);
      }
      return;
    }

    if (g.id === selected) {
      ctx.strokeStyle = COL.green;
      ctx.lineWidth = 2;
      chamfer(ctx, x - 13, y - 24, 26, 34, 4);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // legs: chunky rects, walk cycle
    const step = moving ? Math.round(Math.sin(g.animT * 14) * 2) : 0;
    ctx.fillStyle = COL.goblinDark;
    ctx.fillRect(x - 5, y + 2 + step, 4, 7 - kneel);
    ctx.fillRect(x + 1, y + 2 - step, 4, 7 - kneel);
    // body
    ctx.fillStyle = body;
    ctx.fillRect(x - 7, y - 7, 14, 11);
    ctx.strokeStyle = COL.goblinDark;
    ctx.strokeRect(x - 7, y - 7, 14, 11);
    ctx.fillStyle = '#7a5a2e';
    ctx.fillRect(x - 7, y + 1, 14, 3);
    // head
    ctx.fillStyle = skin;
    ctx.fillRect(x - 6, y - 18, 12, 11);
    ctx.strokeStyle = COL.goblinDark;
    ctx.strokeRect(x - 6, y - 18, 12, 11);
    // ears (always visible, FTL-goblin silhouette)
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 15); ctx.lineTo(x - 14, y - 19); ctx.lineTo(x - 6, y - 12);
    ctx.moveTo(x + 6, y - 15); ctx.lineTo(x + 14, y - 19); ctx.lineTo(x + 6, y - 12);
    ctx.fill();
    // eyes by facing; 'up' = back of head (no eyes) — the manning read
    ctx.fillStyle = '#10240c';
    if (face === 'down') {
      ctx.fillRect(x - 4, y - 15, 3, 4);
      ctx.fillRect(x + 1, y - 15, 3, 4);
    } else if (face === 'left') {
      ctx.fillRect(x - 5, y - 15, 3, 4);
    } else if (face === 'right') {
      ctx.fillRect(x + 2, y - 15, 3, 4);
    } else {
      ctx.fillRect(x - 3, y - 18, 6, 2);   // hair tuft from behind
    }

    // task poses/tools (chunky)
    if (g.task === 'manning') {
      // arms forward onto the console
      ctx.fillStyle = body;
      ctx.fillRect(x - 8, y - 12, 3, 5);
      ctx.fillRect(x + 5, y - 12, 3, 5);
    } else if (g.task === 'repairing') {
      const swing = Math.sin(g.animT * 10) > 0 ? 3 : 0;
      ctx.fillStyle = body;
      ctx.fillRect(x + 6, y - 8 - swing, 3, 5);
      ctx.fillStyle = '#b9c0c9';
      ctx.fillRect(x + 8, y - 13 - swing, 7, 4);
      if (Math.sin(g.animT * 20) > 0.5) {
        ctx.fillStyle = COL.gold;
        ctx.fillRect(x + 12, y - 6, 2, 2);
      }
    } else if (g.task === 'mending') {
      // repair rig: wrench-turn on the hull frame + rising green mend spark
      const swing = Math.sin(g.animT * 8) > 0 ? 3 : 0;
      ctx.fillStyle = body;
      ctx.fillRect(x + 6, y - 8 - swing, 3, 5);
      ctx.fillStyle = '#b9c0c9';
      ctx.fillRect(x + 8, y - 13 - swing, 7, 4);
      const mt = (g.animT * 1.1) % 1;
      ctx.fillStyle = 'rgba(105,196,110,' + (0.9 * (1 - mt)) + ')';
      ctx.fillRect(x - 1, y - 24 - mt * 7, 3, 3);
      ctx.fillRect(x - 3, y - 22 - mt * 7, 7, 2);
    } else if (g.task === 'firefighting') {
      ctx.fillStyle = '#b03050';
      ctx.fillRect(x + 7, y - 9, 6, 9);
      for (let i = 0; i < 4; i++) {
        const st = (g.animT * 3 + i * 0.25) % 1;
        ctx.fillStyle = 'rgba(210,240,255,' + (0.85 * (1 - st)) + ')';
        ctx.fillRect(x + 13 + st * 16, y - 8 - st * 4 + Math.sin(i * 9) * 2, 3, 3);
      }
    } else if (g.task === 'welding') {
      ctx.fillStyle = body;
      ctx.fillRect(x + 6, y - 4, 5, 3);
      if (Math.sin(g.animT * 25) > 0) {
        ctx.fillStyle = '#fff6cf';
        ctx.fillRect(x + 11, y - 2, 4, 4);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = COL.gold;
          ctx.fillRect(x + 12 + Math.sin(g.animT * 40 + i * 2) * 6, y - Math.abs(Math.sin(g.animT * 30 + i)) * 7, 2, 2);
        }
      }
    } else if (g.task === 'fighting') {
      const punch = Math.max(0, Math.sin(g.animT * 12)) * 5;
      ctx.fillStyle = '#b9c0c9';
      ctx.fillRect(x + 6 + punch, y - 9, 6, 5);
      if (punch > 4) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 14 + punch, y - 9, 4, 4);
      }
    } else if (g.task === 'healing') {
      const ht = (g.animT * 1.2) % 1;
      ctx.fillStyle = 'rgba(105,196,110,' + (0.9 * (1 - ht)) + ')';
      ctx.fillRect(x - 1, y - 26 - ht * 8, 3, 3);
      ctx.fillRect(x - 3, y - 24 - ht * 8, 7, 2);
    } else if (g.task === 'waiting') {
      ctx.fillStyle = COL.text;
      ctx.font = 'bold 10px ' + FONT;
      ctx.fillText('·'.repeat(1 + ((g.animT * 2) | 0) % 3), x - 4, y - 24);
    }

    if (g.hp < g.maxHp) {
      ctx.fillStyle = '#10151b';
      ctx.fillRect(x - 10, y - 24, 20, 3);
      ctx.fillStyle = g.hp / g.maxHp > 0.4 ? COL.green : COL.red;
      ctx.fillRect(x - 10, y - 24, 20 * (g.hp / g.maxHp), 3);
    }
  }

  function drawIntruders(s, time, dt) {
    for (const iv of s.intruders) {
      const target = iv.path.length ? transitXY(s, iv) : tileXY(iv.room, iv.slot);
      const p = smoothed(iv.id, target.x, target.y, dt, false);
      const scale = iv.runt ? 0.72 : 1;
      const crew = G.settledGoblinsIn(s, iv.room);
      const fighting = !iv.path.length && crew.length;
      const lunge = fighting ? Math.max(0, Math.sin(time * 6 + iv.animT)) * 4 : 0;
      const bx = p.x + lunge, by = p.y - 6 * scale;

      // materialize-in sparkle (teleport read)
      const mat = Math.min(1, iv.animT / 0.5);
      ctx.globalAlpha = mat;
      if (mat < 1) {
        ctx.strokeStyle = 'rgba(255,150,180,' + (1 - mat) + ')';
        for (let i = 0; i < 4; i++) {
          const lx = bx - 9 + i * 6;
          ctx.beginPath();
          ctx.moveTo(lx, by - 18 * (1 - mat) - 8);
          ctx.lineTo(lx, by + 10);
          ctx.stroke();
        }
      }
      // hostility ring (red = enemy, FTL grammar)
      ctx.strokeStyle = 'rgba(208,69,62,0.65)';
      ctx.lineWidth = 1.5;
      chamfer(ctx, bx - 13 * scale, by - 12 * scale, 26 * scale, 24 * scale, 4);
      ctx.stroke();
      ctx.lineWidth = 1;

      // sprite by state, or the procedural blob as fallback
      const ivFrame = iv.flash > 0 ? 4 : fighting ? 3 : iv.path.length ? 1 + (Math.floor(iv.animT * 7) % 2) : 0;
      if (ASSETS.ready('invader')) {
        ASSETS.drawFrame(ctx, 'invader', ivFrame, bx, by + 13 * scale, 40 * scale, false);
      } else {
        ctx.fillStyle = iv.flash > 0 ? '#ffffff' : (iv.runt ? '#c2506a' : '#b03050');
        ctx.beginPath();
        for (let a = 0; a < 10; a++) {
          const ang = a / 10 * Math.PI * 2;
          const rad = ((a % 2 ? 6 : 10) + Math.sin(time * 5 + a) * 1) * scale;
          const px = bx + Math.cos(ang) * rad, py = by + Math.sin(ang) * rad * 0.85;
          a ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.fill();
        ctx.strokeStyle = iv.flash > 0 ? '#ffffff' : '#701c34';
        const step = Math.sin(time * 12 + iv.animT) * 3;
        ctx.beginPath();
        ctx.moveTo(bx - 4 * scale, by + 7 * scale); ctx.lineTo(bx - 6 * scale + step, by + 13 * scale);
        ctx.moveTo(bx + 4 * scale, by + 7 * scale); ctx.lineTo(bx + 6 * scale - step, by + 13 * scale);
        ctx.stroke();
        ctx.fillStyle = COL.gold;
        ctx.fillRect(bx - 3, by - 3, 3, 3);
        ctx.fillRect(bx + 2, by - 3, 3, 3);
      }
      ctx.fillStyle = '#10151b';
      ctx.fillRect(bx - 10, by - 17, 20, 3);
      ctx.fillStyle = COL.red;
      ctx.fillRect(bx - 10, by - 17, 20 * (iv.hp / iv.maxHp), 3);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- top readout: icons + boxed values ---------- */
  function mechGlyph(c, x, y, sz, color) {
    c.fillStyle = color;
    c.fillRect(x - sz * 0.35, y - sz * 0.3, sz * 0.7, sz * 0.65);
    c.beginPath();
    c.moveTo(x - sz * 0.3, y - sz * 0.25); c.lineTo(x - sz * 0.7, y - sz * 0.5); c.lineTo(x - sz * 0.25, y - sz * 0.05);
    c.moveTo(x + sz * 0.3, y - sz * 0.25); c.lineTo(x + sz * 0.7, y - sz * 0.5); c.lineTo(x + sz * 0.25, y - sz * 0.05);
    c.fill();
  }

  function box(x, y, w, label, value, color, tip) {
    ctx.fillStyle = COL.panel;
    chamfer(ctx, x, y, w, 17, 4);
    ctx.fill();
    ctx.strokeStyle = COL.panelEdge;
    chamfer(ctx, x, y, w, 17, 4);
    ctx.stroke();
    ctx.font = '9px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillStyle = COL.dim;
    ctx.fillText(label, x + 5, y + 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.fillText(value, x + w - 5, y + 12);
    ctx.textAlign = 'left';
    if (tip) regions.push({ x, y, w, h: 17, tip, act: () => {} });
  }

  function drawTopReadout(s, time) {
    // hull: mech glyph + segments
    mechGlyph(ctx, 18, 15, 14, s.hp / s.maxHp < 0.3 ? COL.red : COL.green);
    const segs = 24, filled = Math.ceil(Math.max(0, s.hp / s.maxHp) * segs);
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle = i < filled ? (s.hp / s.maxHp < 0.3 ? COL.red : COL.green) : '#26313a';
      ctx.fillRect(34 + i * 9, 8, 7, 12);
    }
    // salvage progress to the next pick — the one upgrade bar
    box(258, 6, 92, '⛭', Math.floor(s.salvage) + '/' + s.levelUp.need, COL.gold,
      { t: 'SALVAGE', b: 'bar fills → the crew picks an upgrade' });

    // shields: arcs over a tiny mech glyph
    mechGlyph(ctx, 18, 39, 12, COL.dim);
    for (let i = 0; i < Math.max(G.shieldMax(s), s.rooms.shields.tier); i++) {
      ctx.strokeStyle = i < s.shield.layers ? COL.blue : '#3a4854';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(18, 42, 10 + i * 4, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    const legs = G.legBonus(s);
    box(40, 31, 74, 'EVADE', Math.round(legs.dodge * 100) + '%', COL.green,
      { t: 'EVASION', b: 'from powered + manned LEGS' });
    let worst = 1;
    for (const id of G.ROOM_IDS) worst = Math.min(worst, s.rooms[id].air);
    const airBad = worst < G.CONFIG.AIR_THRESHOLD;
    box(120, 31, 70, 'AIR', Math.round(worst * 100) + '%',
      airBad && Math.sin(time * 8) > 0 ? COL.red : worst < 0.6 ? COL.orange : COL.blue,
      { t: 'AIR (worst room)', b: 'breaches & vents drain · AIR system restores' });
    box(196, 31, 62, 'CREW', s.goblins.length, COL.green);
    if (s.intruders.length) box(264, 31, 86, 'HOSTILE', s.intruders.length, COL.red);
  }

  /* ---------- centered warning banner ---------- */
  function drawBanner(s, time) {
    let msg = null;
    if (s.hazard.warn) {
      const w = s.hazard.warn;
      msg = '⚠ ' + w.label + (w.room ? ' — ' + s.rooms[w.room].name : '') + ' ⚠';
    } else if (s.hazard.squallT > 0) {
      msg = '🔥 ASH SQUALL — ' + Math.ceil(s.hazard.squallT) + 's';
    } else {
      const bad = s.toasts.filter(t => t.side !== 'big' && t.cls === 'bad' && t.t > 2.4);
      if (bad.length) msg = bad[bad.length - 1].msg;
    }
    if (!msg) return;
    ctx.font = 'bold 12px ' + FONT;
    const w = ctx.measureText(msg).width + 26;
    const x = 520 - w / 2, y = 18;
    const flash = Math.sin(time * 8) > -0.3;
    ctx.fillStyle = 'rgba(30,12,12,0.92)';
    chamfer(ctx, x, y, w, 24, 6);
    ctx.fill();
    ctx.strokeStyle = flash ? COL.red : '#6a2320';
    ctx.lineWidth = 2;
    chamfer(ctx, x, y, w, 24, 6);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = flash ? '#ffb0a8' : COL.red;
    ctx.textAlign = 'center';
    ctx.fillText(msg, 520, y + 16);
    ctx.textAlign = 'left';
  }

  /* ---------- portraits: the row IS the health bar ---------- */
  function drawPortraits(s, time) {
    s.goblins.forEach((g, i) => {
      const x = PORTRAITS.x, y = PORTRAITS.y + i * (PORTRAITS.h + PORTRAITS.gap);
      const w = PORTRAITS.w, h = PORTRAITS.h;
      const sel = g.id === selected;
      const frac = Math.max(0, g.hp / g.maxHp);
      // health fill as the row background (FTL)
      ctx.fillStyle = '#301416';
      chamfer(ctx, x, y, w, h, 6);
      ctx.fill();
      ctx.save();
      chamfer(ctx, x, y, w, h, 6);
      ctx.clip();
      ctx.fillStyle = frac > 0.4 ? 'rgba(80,150,84,0.55)' : 'rgba(190,70,64,0.55)';
      ctx.fillRect(x, y, w * frac, h);
      ctx.restore();
      ctx.strokeStyle = sel ? COL.green : COL.panelEdge;
      ctx.lineWidth = sel ? 2 : 1;
      chamfer(ctx, x, y, w, h, 6);
      ctx.stroke();
      ctx.lineWidth = 1;
      // face bust — a framed portrait sprite, or the procedural bust as fallback
      const pi = (parseInt(g.id.slice(1), 10) || 0) % 6;
      if (ASSETS.ready('portrait')) {
        const bs = h - 6, bx = x + 3, by = y + 3;
        ctx.save();
        chamfer(ctx, bx, by, bs, bs, 5); ctx.clip();
        ASSETS.drawCell(ctx, 'portrait', pi, bx, by, bs, bs);
        ctx.restore();
        ctx.strokeStyle = sel ? COL.green : COL.panelEdge;
        chamfer(ctx, bx, by, bs, bs, 5); ctx.stroke();
      } else {
        const fx = x + 26, fy = y + h / 2 + 3;
        ctx.fillStyle = COL.goblinLight;
        ctx.fillRect(fx - 8, fy - 10, 16, 14);
        ctx.strokeStyle = COL.goblinDark;
        ctx.strokeRect(fx - 8, fy - 10, 16, 14);
        ctx.fillStyle = COL.goblinLight;
        ctx.beginPath();
        ctx.moveTo(fx - 8, fy - 6); ctx.lineTo(fx - 17, fy - 11); ctx.lineTo(fx - 8, fy - 2);
        ctx.moveTo(fx + 8, fy - 6); ctx.lineTo(fx + 17, fy - 11); ctx.lineTo(fx + 8, fy - 2);
        ctx.fill();
        ctx.fillStyle = '#10240c';
        ctx.fillRect(fx - 5, fy - 5, 3, 5);
        ctx.fillRect(fx + 2, fy - 5, 3, 5);
      }
      // hotkey number (on top of the portrait corner)
      ctx.font = '9px ' + FONT;
      ctx.fillStyle = '#0a0d12';
      ctx.fillText(String(i + 1), x + 5, y + 13);
      ctx.fillStyle = COL.gold;
      ctx.fillText(String(i + 1), x + 4, y + 12);
      // name + task
      ctx.font = '11px ' + FONT;
      ctx.fillStyle = COL.text;
      ctx.fillText(g.name.toUpperCase(), x + 48, y + 19);
      ctx.font = '9px ' + FONT;
      ctx.fillStyle = ['fighting', 'firefighting', 'welding'].includes(g.task) ? COL.orange : COL.dim;
      ctx.fillText(g.task, x + 48, y + 33);
      regions.push({
        x, y, w, h,
        tip: { t: g.name + '  [' + (i + 1) + ']', b: 'click to select, then click a room' },
        act: (right) => { if (!right) selectGoblin(g.id); },
      });
    });
  }

  /* ---------- info log (non-crisis messages, off the ship art) ---------- */
  function drawLog(s) {
    let ty = 474;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'left';
    for (const t of s.toasts) {
      if (t.side === 'big' || t.cls === 'bad') continue;   // crises use the banner
      ctx.fillStyle = t.cls === 'warn' ? COL.orange : t.cls === 'good' ? COL.green : COL.text;
      ctx.globalAlpha = Math.min(1, t.t) * 0.9;
      ctx.fillText('· ' + t.msg, 10, ty);
      ctx.globalAlpha = 1;
      ty += 14;
    }
    const sel = s.goblins.find(g => g.id === selected);
    if (sel) {
      ctx.fillStyle = COL.green;
      ctx.fillText('▶ ' + sel.name.toUpperCase() + ' — click a room to send', 10, 545);
    }
  }

  /* ---------- power cluster on its chamfered panel ---------- */
  function personGlyph(c, x, y, color) {
    c.fillStyle = color;
    c.fillRect(x - 2, y - 5, 4, 3);   // head
    c.fillRect(x - 3, y - 1, 6, 5);   // body
  }

  function drawPowerCluster(s, time) {
    ctx.fillStyle = COL.panel;
    chamfer(ctx, CLUSTER.px, CLUSTER.py, CLUSTER.pw, CLUSTER.ph, 8);
    ctx.fill();
    ctx.strokeStyle = COL.panelEdge;
    chamfer(ctx, CLUSTER.px, CLUSTER.py, CLUSTER.pw, CLUSTER.ph, 8);
    ctx.stroke();
    ctx.font = '9px ' + FONT;
    ctx.fillStyle = COL.dim;
    ctx.textAlign = 'left';
    ctx.fillText('POWER', CLUSTER.px + 8, CLUSTER.py + 13);

    const used = SIM.usedPips(s);
    const free = s.reactor.pips - used;
    for (let i = 0; i < s.reactor.pips; i++) {
      const py = CLUSTER.iconY - 2 - i * CLUSTER.pipGap;
      if (i < free) {
        ctx.fillStyle = COL.green;
        ctx.fillRect(16, py, 22, CLUSTER.pipH);
      } else {
        ctx.strokeStyle = '#3a4854';
        ctx.strokeRect(16, py, 22, CLUSTER.pipH);
      }
    }

    CLUSTER_ORDER.forEach((id, i) => {
      const r = s.rooms[id];
      const cx = CLUSTER.x0 + i * CLUSTER.colW + CLUSTER.colW / 2;
      if (!r.built) {
        // empty socket: a system slot the mech hasn't grown yet
        ctx.strokeStyle = '#26333d';
        ctx.beginPath(); ctx.arc(cx, CLUSTER.iconY, 11, 0, 7); ctx.stroke();
        ctx.fillStyle = '#26333d';
        ctx.font = '11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('+', cx, CLUSTER.iconY + 4);
        regions.push({
          x: cx - CLUSTER.colW / 2, y: CLUSTER.py + 16, w: CLUSTER.colW, h: CLUSTER.ph - 20,
          tip: { t: r.name, b: 'not grown yet — channel a shrine' },
          act: () => {},
        });
        return;
      }
      const cap = G.roomCap(r);
      for (let t = 0; t < r.tier; t++) {
        const py = CLUSTER.iconY - 18 - t * CLUSTER.pipGap;
        if (t >= cap) {
          ctx.strokeStyle = COL.red;
          ctx.strokeRect(cx - 8, py, 16, CLUSTER.pipH);
          ctx.beginPath();
          ctx.moveTo(cx - 8, py); ctx.lineTo(cx + 8, py + CLUSTER.pipH);
          ctx.moveTo(cx + 8, py); ctx.lineTo(cx - 8, py + CLUSTER.pipH);
          ctx.stroke();
        } else if (t < r.power) {
          ctx.fillStyle = COL.green;
          ctx.fillRect(cx - 8, py, 16, CLUSTER.pipH);
        } else {
          ctx.strokeStyle = '#5b646e';
          ctx.strokeRect(cx - 8, py, 16, CLUSTER.pipH);
        }
      }
      // icon in a base circle; person glyph above when manned
      ctx.fillStyle = '#0f151a';
      ctx.beginPath(); ctx.arc(cx, CLUSTER.iconY, 11, 0, 7); ctx.fill();
      ctx.strokeStyle = G.systemActive(s, id) ? COL.panelHi : '#31404c';
      ctx.beginPath(); ctx.arc(cx, CLUSTER.iconY, 11, 0, 7); ctx.stroke();
      const iconCol = G.roomCap(r) === 0 ? (Math.sin(time * 8) > 0 ? COL.red : '#7d2a26')
        : r.damage > 0 ? COL.orange
        : G.systemActive(s, id) ? COL.text : '#5b646e';
      drawSysIcon(ctx, id, cx, CLUSTER.iconY, 14, iconCol);
      if (G.roomManned(s, id)) personGlyph(ctx, cx, CLUSTER.iconY - 18 - r.tier * CLUSTER.pipGap, COL.gold);

      regions.push({
        x: cx - CLUSTER.colW / 2, y: CLUSTER.py + 16, w: CLUSTER.colW, h: CLUSTER.ph - 20,
        tip: { t: r.name, b: r.power + '/' + cap + ' power · click +, right-click −' },
        act: (right) => G.submitIntent({ t: 'power', room: id, delta: right ? -1 : 1 }),
      });
    });
    ctx.textAlign = 'left';
  }

  /* ---------- weapon bar: charge fills the border (FTL read) ---------- */
  function chamferPerimeter(w, h, cut) {
    return 2 * (w + h) - 8 * cut + 4 * cut * Math.SQRT2;
  }

  function drawWeaponBar(s, time) {
    ctx.font = '8px ' + FONT;
    const CD_WEAPONS = { armGun: 1, headFlame: 1, mortar: 1, zapper: 1, sawWing: 1 };
    WEAPON_ORDER.forEach((wid, i) => {
      const def = G.WEAPON_DEFS[wid];
      const r = s.rooms[def.room];
      const x = WEAPON_BAR.x0 + i * (WEAPON_BAR.w + WEAPON_BAR.gap);
      const y = WEAPON_BAR.y0, w = WEAPON_BAR.w, h = WEAPON_BAR.h;

      if (!r.built) {
        // socket: this weapon hasn't been grafted on yet
        ctx.strokeStyle = '#26333d';
        chamfer(ctx, x, y, w, h, 6);
        ctx.stroke();
        ctx.fillStyle = '#26333d';
        ctx.textAlign = 'center';
        ctx.fillText('+', x + w / 2, y + h / 2 + 3);
        ctx.textAlign = 'left';
        regions.push({
          x, y, w, h,
          tip: { t: def.name, b: 'grows from a shrine — send Big Guy to channel one' },
          act: () => {},
        });
        return;
      }

      const active = G.weaponActive(s, wid);
      const crisis = G.roomInCrisis(s, r);
      ctx.fillStyle = COL.panel;
      chamfer(ctx, x, y, w, h, 6);
      ctx.fill();
      ctx.strokeStyle = crisis ? COL.red : '#31404c';
      chamfer(ctx, x, y, w, h, 6);
      ctx.stroke();

      // charge fills the border (FTL read)
      let frac = 0;
      if (active) {
        frac = CD_WEAPONS[wid]
          ? 1 - Math.min(1, Math.max(0, s.weapons[wid].cd) / (def.cooldown * 1.4))
          : 1;
      }
      if (frac > 0) {
        const per = chamferPerimeter(w, h, 6);
        ctx.save();
        ctx.setLineDash([per * frac, per]);
        ctx.strokeStyle = frac >= 1 ? (Math.sin(time * 9) > 0 ? '#9fe8a4' : COL.green) : COL.green;
        ctx.lineWidth = 2.5;
        chamfer(ctx, x, y, w, h, 6);
        ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = active ? COL.text : COL.dim;
      ctx.fillText(def.name, x + w / 2, y + 14);

      if (wid === 'shieldShockwave') {
        for (let l = 0; l < Math.min(3, Math.max(1, s.rooms.shields.tier)); l++) {
          const lx = x + w / 2 - 12 + l * 12;
          ctx.strokeStyle = COL.blue;
          ctx.beginPath(); ctx.arc(lx, y + 32, 4, 0, 7); ctx.stroke();
          if (l < s.shield.layers) {
            ctx.fillStyle = COL.blue;
            ctx.beginPath(); ctx.arc(lx, y + 32, 2.8, 0, 7); ctx.fill();
          }
        }
      } else if (wid === 'coreOrbitals' && active) {
        ctx.fillStyle = COL.green;
        ctx.fillText('×' + SIM.orbitalCount(s), x + w / 2, y + 34);
      }
      ctx.fillStyle = active ? COL.green : COL.dim;
      ctx.fillText(active ? 'AUTO' : crisis ? 'CRISIS' : 'OFF', x + w / 2, y + 52);
      ctx.textAlign = 'left';

      regions.push({
        x, y, w, h,
        tip: { t: def.name, b: def.source + ' · auto-fires from ' + r.name },
        act: () => {},
      });
    });
  }

  /* ---------- two-line tooltip ---------- */
  function drawTooltip(s) {
    if (hover.x < 0) return;
    let tip = null;
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (r.tip && hover.x >= r.x && hover.x <= r.x + r.w && hover.y >= r.y && hover.y <= r.y + r.h) {
        tip = r.tip; break;
      }
    }
    if (!tip) return;
    const title = typeof tip === 'string' ? tip : tip.t;
    const body = typeof tip === 'string' ? null : tip.b;
    ctx.font = 'bold 10px ' + FONT;
    const wT = ctx.measureText(title).width;
    ctx.font = '10px ' + FONT;
    const wB = body ? ctx.measureText(body).width : 0;
    const w = Math.max(wT, wB) + 16;
    const h = body ? 32 : 19;
    let tx = Math.min(hover.x + 14, cv.width - w - 4);
    let ty = hover.y > cv.height - h - 24 ? hover.y - h - 8 : hover.y + 18;
    ctx.fillStyle = 'rgba(13,18,24,0.94)';
    chamfer(ctx, tx, ty, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = COL.panelEdge;
    chamfer(ctx, tx, ty, w, h, 5);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px ' + FONT;
    ctx.fillStyle = COL.text;
    ctx.fillText(title, tx + 8, ty + 13);
    if (body) {
      ctx.font = '10px ' + FONT;
      ctx.fillStyle = COL.dim;
      ctx.fillText(body, tx + 8, ty + 26);
    }
  }

  /* geometry exports for the mini-HUD + dev/qa.js synthetic clicks */
  const debug = {
    layout: ROOM_LAYOUT,
    tileXY, doorPx,
    airlockPx: id => AIRLOCK_PX[id],
    clusterColXY: id => {
      const i = CLUSTER_ORDER.indexOf(id);
      return { x: CLUSTER.x0 + i * CLUSTER.colW + CLUSTER.colW / 2, y: CLUSTER.py + CLUSTER.ph / 2 };
    },
    portraitXY: i => ({ x: PORTRAITS.x + PORTRAITS.w / 2, y: PORTRAITS.y + i * (PORTRAITS.h + PORTRAITS.gap) + PORTRAITS.h / 2 }),
  };

  return { init, draw, selectGoblin, layout: ROOM_LAYOUT, debug, get selected() { return selected; } };
})();
