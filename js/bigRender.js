/* SCRAPWALKER — bigRender.js
   three.js renderer for Big Guy. Reads G.state only.

   v5: alien multi-part enemy bodies with motion signatures (no more bare
   shapes), a unique boss body, shrine totems, high-value drop visuals, and
   a mech that visibly grows new parts as rooms are grafted on. Bruiser
   warning rings removed — threats read through creature behavior. */

window.BIGR = (function () {
  let renderer, scene, camera, active = true;
  let mech, coreMat, mouthMat;
  let roomParts = {};            // room id → body-part group, built lazily from its rect
  let inst = {};
  const dummy = new THREE.Object3D();
  let rings = [], flameCones = [], orbitalChunks = [], zapLines = [];
  let shieldMesh = null, shrineGroup = null, bossGroup = null;

  const PALETTE = {
    ground: 0x2c2246, fog: 0x1a1330,
    mech: 0x6f7d68, mechDark: 0x4c5747, armor: 0x8a9b7a, core: 0x7dd94a,
    swarmer: 0xd4557a, runner: 0xb44ae0, bruiser: 0xff6a2b,
    spitter: 0x8fbf3a, brood: 0xc86ab0, charger: 0xe0a13c, boss: 0x8a1c28,
    bolt: 0xffe066, salv: 0xffd166, cache: 0xffb020, heal: 0xf0f4f8,
    trail: 0xff8c3b, shockwave: 0x59d6e8, orbital: 0xc9995c,
    acid: 0xa8e83a, saw: 0xb8c4cc, zap: 0x9fd8ff,
  };
  const CAP = { swarmer: 600, runner: 220, bruiser: 60, spitter: 80, brood: 30, charger: 60 };

  function init(container) {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.fog);
    scene.fog = new THREE.Fog(PALETTE.fog, 90, 170);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 400);

    scene.add(new THREE.HemisphereLight(0xbfa8ff, 0x1a2415, 0.95));
    const dir = new THREE.DirectionalLight(0xfff2d8, 0.75);
    dir.position.set(30, 60, 20);
    scene.add(dir);

    buildGround();
    buildScenery();
    buildBody();
    buildInstanced();
    buildBoss();
    buildShrine();
    buildFxPools();

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ---------- world ---------- */
  function buildGround() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const c = cv.getContext('2d');
    c.fillStyle = '#2c2246'; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = ['#3d2f61', '#352a55', '#27354a', '#332750'][i % 4];
      const r = 4 + Math.random() * 26;
      c.beginPath(); c.arc(Math.random() * 512, Math.random() * 512, r, 0, 7); c.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    const g = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshLambertMaterial({ map: tex }));
    g.rotation.x = -Math.PI / 2;
    scene.add(g);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(G.CONFIG.ARENA_R + 3, 0.5, 6, 80),
      new THREE.MeshBasicMaterial({ color: 0x59d6e8, transparent: true, opacity: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.6;
    scene.add(ring);
  }

  function buildScenery() {
    const rocks = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshLambertMaterial({ color: 0x3a3157 }), 70);
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 120;
      dummy.position.set(Math.cos(a) * d, 0.4, Math.sin(a) * d);
      const sc = 0.8 + Math.random() * 3.2;
      dummy.scale.set(sc, sc * (0.6 + Math.random() * 0.8), sc);
      dummy.rotation.set(Math.random(), Math.random() * 6, Math.random());
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate = true;
    scene.add(rocks);

    const plants = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.5, 2.2, 5),
      new THREE.MeshLambertMaterial({ color: 0x2f4a52, emissive: 0x1e4a52, emissiveIntensity: 0.25 }), 60);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, d = 15 + Math.random() * 125;
      dummy.position.set(Math.cos(a) * d, 1, Math.sin(a) * d);
      const sc = 0.4 + Math.random() * 1.3;
      dummy.scale.set(sc, sc, sc);
      dummy.rotation.set(0, Math.random() * 6, (Math.random() - 0.5) * 0.4);
      dummy.updateMatrix();
      plants.setMatrixAt(i, dummy.matrix);
    }
    plants.instanceMatrix.needsUpdate = true;
    scene.add(plants);
  }

  /* ---------- the mech ---------- */
  function box(w, h, d, color, emissive) {
    return new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color, emissive: emissive || 0x000000, emissiveIntensity: emissive ? 0.8 : 0 }));
  }

  /* ---------- the mech IS the interior floor plan ----------
     Big Guy has no fixed design: every built room projects one body-part polygon
     at the exact spot it sits on Little Guy's grid. Interior X → left/right on the
     body, interior Y (grows downward) → top-to-bottom, so the silhouette is a 1:1
     mirror of the crew's build and remutates live as rooms are placed/grafted. */
  const MECH_S = 0.024;          // interior px → world unit
  const MECH_CX = 350;           // interior centerline x (hull symmetry)
  const MECH_GROUND = 380;       // interior y that lands on the ground (feet)
  const PART_DEPTH = 1.8, FRONT = PART_DEPTH / 2;

  function mapRoom(rect) {
    const [ix, iy, iw, ih] = rect;
    return {
      x: (ix + iw / 2 - MECH_CX) * MECH_S,
      y: (MECH_GROUND - (iy + ih / 2)) * MECH_S,
      w: iw * MECH_S, h: ih * MECH_S,
    };
  }
  function plateColor(sys) {
    return (sys === 'reactor' || sys === 'air' || sys === 'medbay' || sys === 'repair')
      ? PALETTE.mechDark : PALETTE.mech;
  }

  // fixed-size decoration that reads the room's function (added onto its plate)
  const DECOR = {
    reactor(g) {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), coreMat);
      core.position.set(0, 0, FRONT); g.add(core);
      for (let i = 0; i < 3; i++) { const s = box(1.1, 0.13, 0.12, PALETTE.mechDark); s.position.set(0, -0.4 + i * 0.4, FRONT + 0.15); g.add(s); }
    },
    armGun(g) {   // the gun-arm
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.8, 8), new THREE.MeshLambertMaterial({ color: 0x5d6858 }));
      barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, FRONT + 0.7); g.add(barrel);
    },
    shields(g) {
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 12), new THREE.MeshLambertMaterial({ color: 0x2a4652, emissive: 0x1a3a48, emissiveIntensity: 0.5 }));
      dish.rotation.x = Math.PI / 2; dish.position.set(0, 0, FRONT + 0.05); g.add(dish);
    },
    air(g) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 6, 12), new THREE.MeshLambertMaterial({ color: 0x8fd4c2 }));
      ring.position.set(0, 0, FRONT); g.add(ring);
      const h = box(0.5, 0.11, 0.11, 0x8fd4c2), v = box(0.11, 0.5, 0.11, 0x8fd4c2);
      h.position.set(0, 0, FRONT); v.position.set(0, 0, FRONT); g.add(h, v);
    },
    legs(g) {   // feet that sway on the walk
      g.userData.feet = [];
      for (const sx of [-0.45, 0.45]) { const f = box(0.6, 0.5, 1.1, PALETTE.mechDark); f.position.set(sx, -0.95, 0.3); g.add(f); g.userData.feet.push(f); }
    },
    head(g) {   // the face — identity, wherever it's welded
      const lEye = box(0.28, 0.2, 0.1, 0x000000, 0xffd166); lEye.position.set(-0.32, 0.12, FRONT);
      const rEye = box(0.28, 0.2, 0.1, 0x000000, 0xffd166); rEye.position.set(0.32, 0.12, FRONT);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.1), mouthMat); mouth.position.set(0, -0.2, FRONT);
      const lEar = box(0.22, 0.7, 0.5, PALETTE.mechDark); lEar.position.set(-0.95, 0.35, -0.1); lEar.rotation.z = 0.5;
      const rEar = box(0.22, 0.7, 0.5, PALETTE.mechDark); rEar.position.set(0.95, 0.35, -0.1); rEar.rotation.z = -0.5;
      g.add(lEye, rEye, mouth, lEar, rEar);
    },
    coreOrbitals(g) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 6, 16), new THREE.MeshLambertMaterial({ color: 0xc9995c, emissive: 0x6b4a26, emissiveIntensity: 0.4 }));
      ring.rotation.x = Math.PI / 2.3; ring.position.set(0, 0, FRONT - 0.2); g.add(ring);
    },
    medbay(g) {
      const v = box(0.2, 0.7, 0.1, 0x0f2f12, 0x7dd94a), h = box(0.7, 0.2, 0.1, 0x0f2f12, 0x7dd94a);
      v.position.set(0, 0, FRONT); h.position.set(0, 0, FRONT); g.add(v, h);
    },
    repair(g) {
      const torch = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshLambertMaterial({ color: 0x2a1405, emissive: 0xe0813c, emissiveIntensity: 1.2 }));
      torch.position.set(0.2, 0.2, FRONT + 0.2); g.add(torch);
      const bar = box(0.14, 0.7, 0.14, 0x5d6858); bar.rotation.z = 0.6; bar.position.set(-0.1, 0, FRONT); g.add(bar);
    },
    mortar(g) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.3, 8), new THREE.MeshLambertMaterial({ color: 0x4c5747 }));
      tube.rotation.x = -0.5; tube.position.set(0, 0.2, FRONT + 0.3); g.add(tube);
    },
    zapper(g) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.0, 5), new THREE.MeshLambertMaterial({ color: 0x5d6858 }));
      spike.position.set(0, 0.4, FRONT); g.add(spike);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshLambertMaterial({ color: 0x0a1a2a, emissive: 0x9fd8ff, emissiveIntensity: 1.2 }));
      orb.position.set(0, 0.95, FRONT); g.add(orb);
    },
    sawWing(g) {
      for (const side of [-1, 1]) { const w = box(1.2, 0.12, 0.6, 0xb8c4cc); w.position.set(side * 0.7, 0, -0.4); w.rotation.z = side * 0.4; w.rotation.y = side * 0.3; g.add(w); }
    },
    armGun2(g) {   // a second gun-arm — twin barrels
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 8), new THREE.MeshLambertMaterial({ color: 0x5d6858 }));
      barrel.rotation.x = Math.PI / 2; barrel.position.set(-0.18, 0.12, FRONT + 0.6); g.add(barrel);
      const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.4, 8), new THREE.MeshLambertMaterial({ color: 0x4c5747 }));
      barrel2.rotation.x = Math.PI / 2; barrel2.position.set(0.24, -0.16, FRONT + 0.5); g.add(barrel2);
    },
    treads(g) {   // crushing tracks at the base
      for (const sx of [-0.5, 0.5]) {
        const track = box(0.55, 0.8, 1.3, 0x2a2f36); track.position.set(sx, -0.15, 0.15); g.add(track);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 8), new THREE.MeshLambertMaterial({ color: 0x6a7683 }));
        hub.rotation.z = Math.PI / 2; hub.position.set(sx, -0.15, FRONT - 0.1); g.add(hub);
      }
    },
  };

  function buildRoomPart(id, sys) {
    const g = new THREE.Group();
    const plateMat = new THREE.MeshLambertMaterial({ color: plateColor(sys), emissive: 0x000000, emissiveIntensity: 0 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, PART_DEPTH), plateMat);   // scaled to the room each frame
    g.add(plate);
    g.userData = { plate, plateMat };
    if (DECOR[id]) DECOR[id](g);
    return g;
  }

  function buildBody() {
    mech = new THREE.Group();
    coreMat = new THREE.MeshLambertMaterial({ color: 0x184a12, emissive: PALETTE.core, emissiveIntensity: 1.4 });
    mouthMat = new THREE.MeshLambertMaterial({ color: 0x1a0d05, emissive: 0xff8c3b, emissiveIntensity: 0.25 });
    mech.scale.setScalar(0.9);
    scene.add(mech);
  }

  /* ---------- instanced enemies: alien bodies, 2-3 parts each ---------- */
  function buildInstanced() {
    const mk = (geo, color, cap, opts) => {
      opts = opts || {};
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({
        color, emissive: opts.emissive != null ? opts.emissive : color,
        emissiveIntensity: opts.glow != null ? opts.glow : 0.35,
      }), cap);
      m.count = 0;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    // swarmer "mite": squashy tick body + bulbous abdomen
    inst.swarmer = mk(new THREE.SphereGeometry(0.85, 7, 6), PALETTE.swarmer, CAP.swarmer, { glow: 0.3 });
    inst.swarmerAbd = mk(new THREE.SphereGeometry(0.6, 6, 5), 0xa33d5e, CAP.swarmer, { glow: 0.25 });
    // runner "dart hound": lean wedge + tail fin
    inst.runner = mk(new THREE.ConeGeometry(0.65, 2.2, 4), PALETTE.runner, CAP.runner, { glow: 0.35 });
    inst.runnerFin = mk(new THREE.BoxGeometry(0.12, 0.9, 0.7), 0x8836ab, CAP.runner, { glow: 0.3 });
    // bruiser "horned hulk": bulk + horn crown
    inst.bruiser = mk(new THREE.BoxGeometry(2.6, 3.0, 2.4), PALETTE.bruiser, CAP.bruiser, { glow: 0.4 });
    inst.horn = mk(new THREE.ConeGeometry(0.35, 1.1, 4), 0x7a2a10, CAP.bruiser, { glow: 0.2 });
    // spitter "lobber": stalk trunk + acid bulb head
    inst.spitter = mk(new THREE.CylinderGeometry(0.35, 0.7, 2.4, 6), PALETTE.spitter, CAP.spitter, { glow: 0.25 });
    inst.spitterBulb = mk(new THREE.SphereGeometry(0.75, 7, 6), PALETTE.acid, CAP.spitter, { glow: 0.6 });
    // broodmother: swollen sphere + egg ring
    inst.brood = mk(new THREE.SphereGeometry(1.8, 9, 7), PALETTE.brood, CAP.brood, { glow: 0.3 });
    inst.broodRing = mk(new THREE.TorusGeometry(1.5, 0.35, 6, 10), 0x8a3d78, CAP.brood, { glow: 0.35 });
    // charger "ram": wedge body + heavy head plate
    inst.charger = mk(new THREE.ConeGeometry(1.0, 2.6, 5), PALETTE.charger, CAP.charger, { glow: 0.3 });
    inst.chargerPlate = mk(new THREE.BoxGeometry(1.6, 1.2, 0.4), 0x8a5c14, CAP.charger, { glow: 0.25 });
    // shared face visor
    inst.face = mk(new THREE.BoxGeometry(0.7, 0.22, 0.1), 0x14060a, 1100, { emissive: 0x000000, glow: 0 });
    // projectiles + drops
    inst.bolt = mk(new THREE.SphereGeometry(0.3, 6, 5), PALETTE.bolt, 80, { glow: 0.9 });
    inst.glob = mk(new THREE.SphereGeometry(0.42, 6, 5), PALETTE.acid, 60, { glow: 0.9 });
    inst.lob = mk(new THREE.ConeGeometry(0.4, 1.2, 5), 0x8a9b7a, 16, { glow: 0.4 });
    inst.saw = mk(new THREE.CylinderGeometry(0.9, 0.9, 0.15, 8), PALETTE.saw, 12, { glow: 0.5 });
    inst.salv = mk(new THREE.CylinderGeometry(0.55, 0.55, 0.28, 6), PALETTE.salv, 450, { glow: 0.6 });
    inst.cache = mk(new THREE.BoxGeometry(1.2, 0.9, 0.9), PALETTE.cache, 24, { glow: 0.8 });
    inst.heal = mk(new THREE.SphereGeometry(0.5, 7, 6), PALETTE.heal, 24, { glow: 0.7 });
    inst.trail = mk(new THREE.ConeGeometry(1.4, 1.6, 6), PALETTE.trail, 48, { glow: 0.95 });
  }

  /* ---------- boss: unique assembled monster ---------- */
  function buildBoss() {
    bossGroup = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: PALETTE.boss, emissive: 0x4a0d14, emissiveIntensity: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), bodyMat);
    body.position.y = 3.4;
    body.scale.set(1, 1.15, 1.05);
    bossGroup.add(body);
    const skullMat = new THREE.MeshLambertMaterial({ color: 0xd8ccb8 });
    const skull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.8), skullMat);
    skull.position.set(0, 4.6, 2.4);
    bossGroup.add(skull);
    for (const side of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.6, 5), skullMat);
      tusk.position.set(side * 1.0, 4.1, 3.2);
      tusk.rotation.x = 1.0;
      bossGroup.add(tusk);
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 4),
        new THREE.MeshLambertMaterial({ color: 0x5a1018 }));
      spine.position.set(side * 1.8, 6.0, -0.5);
      spine.rotation.z = side * -0.5;
      bossGroup.add(spine);
    }
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0x000000, emissive: 0xffd166, emissiveIntensity: 1.5 }));
    eyeL.position.set(-0.5, 4.8, 3.3);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.5;
    bossGroup.add(eyeL, eyeR);
    bossGroup.visible = false;
    scene.add(bossGroup);
  }

  /* ---------- shrine totem ---------- */
  function buildShrine() {
    shrineGroup = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 5, 6),
      new THREE.MeshLambertMaterial({ color: 0x4a3d70, emissive: 0x2a2050, emissiveIntensity: 0.4 }));
    stone.position.y = 2.5;
    shrineGroup.add(stone);
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x1a1408, emissive: 0xffd166, emissiveIntensity: 1.2 }));
    glyph.position.set(0, 3.6, 0.7);
    shrineGroup.add(glyph);
    // channel zone ring
    const zone = new THREE.Mesh(new THREE.TorusGeometry(G.CONFIG.SHRINE_RADIUS, 0.35, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.5 }));
    zone.rotation.x = Math.PI / 2;
    zone.position.y = 0.4;
    shrineGroup.add(zone);
    shrineGroup.userData.zone = zone;
    // progress ring (scales with channel)
    const prog = new THREE.Mesh(new THREE.TorusGeometry(1, 0.3, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0x7dd94a, transparent: true, opacity: 0.8 }));
    prog.rotation.x = Math.PI / 2;
    prog.position.y = 0.5;
    shrineGroup.add(prog);
    shrineGroup.userData.prog = prog;
    // light beam
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.9, 26, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
    beam.position.y = 15;
    shrineGroup.add(beam);
    shrineGroup.visible = false;
    scene.add(shrineGroup);
  }

  function buildFxPools() {
    for (let i = 0; i < 22; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.22, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xff8c3b, transparent: true, opacity: 0 }));
      ring.rotation.x = Math.PI / 2;
      ring.visible = false;
      scene.add(ring);
      rings.push(ring);
    }
    for (let i = 0; i < 3; i++) {
      const fan = new THREE.Mesh(
        new THREE.CircleGeometry(1, 20, -G.WEAPON_DEFS.headFlame.angle, G.WEAPON_DEFS.headFlame.angle * 2),
        new THREE.MeshBasicMaterial({ color: 0xff8c3b, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      fan.rotation.x = -Math.PI / 2;
      fan.visible = false;
      scene.add(fan);
      flameCones.push(fan);
    }
    for (let i = 0; i < 5; i++) {
      const chunk = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.7, 0),
        new THREE.MeshLambertMaterial({ color: PALETTE.orbital, emissive: 0x6b4a26, emissiveIntensity: 0.5 }));
      chunk.visible = false;
      scene.add(chunk);
      orbitalChunks.push(chunk);
    }
    for (let i = 0; i < 3; i++) {
      const pts = [];
      for (let k = 0; k < 6; k++) pts.push(new THREE.Vector3());
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: PALETTE.zap, transparent: true, opacity: 0 }));
      line.visible = false;
      scene.add(line);
      zapLines.push(line);
    }
    shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x59d6e8, transparent: true, opacity: 0.14, side: THREE.DoubleSide }));
    shieldMesh.visible = false;
    scene.add(shieldMesh);
  }

  /* ================= per-frame draw ================= */
  function draw(s, time) {
    if (!active) return;
    const b = s.big;

    mech.position.set(b.x, 0, b.z);
    const targetRot = Math.atan2(b.fx, b.fz);
    let dr = targetRot - mech.rotation.y;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    mech.rotation.y += dr * 0.18;
    const moving = Math.hypot(b.moveX, b.moveZ) > 0.01;
    mech.position.y = moving ? Math.abs(Math.sin(time * 9)) * 0.35 : 0;

    const used = SIM.usedPips(s);
    coreMat.emissiveIntensity = 0.7 + 0.5 * Math.sin(time * (2 + used)) + used * 0.12;

    let mouthFlare = 0.25;
    for (const f of s.fx) if (f.type === 'headFlame' && f.age < 0.3) mouthFlare = 2.2 * (1 - f.age / 0.3);
    mouthMat.emissiveIntensity = mouthFlare;

    let recoil = 0;
    for (const f of s.fx) if (f.type === 'muzzle' && f.age < 0.25) recoil = (0.25 - f.age) * 1.6;

    // the mech IS the floor plan: one body-part per built room, placed/sized 1:1
    // from its interior rect, remutating live as the crew builds and welds.
    const flash = b.hitFlash > 0, lowHp = s.hp / s.maxHp < 0.33;
    for (const id of G.ROOM_IDS) {
      const r = s.rooms[id];
      let part = roomParts[id];
      if (r.built && r.rect) {
        if (!part) { part = roomParts[id] = buildRoomPart(id, r.sys); mech.add(part); }
        const m = mapRoom(r.rect);
        part.visible = true;
        part.position.set(m.x, m.y, id === 'armGun' ? -recoil : 0);   // gun-arm recoils
        part.userData.plate.scale.set(m.w, m.h, 1);
        const age = s.t - r.builtT;
        part.scale.setScalar(age < 1 ? 0.4 + 0.6 * Math.min(1, age) : 1);   // build-in pop
        if (part.userData.feet) {
          part.userData.feet[0].rotation.x = moving ? Math.sin(time * 9) * 0.5 : 0;
          part.userData.feet[1].rotation.x = moving ? -Math.sin(time * 9) * 0.5 : 0;
        }
        // 1:1 feedback: a room in trouble lights up its matching body-part
        const mat = part.userData.plateMat;
        if (flash) { mat.emissive.setHex(0xff2030); mat.emissiveIntensity = 0.7; }
        else if (r.fire > 0.05) { mat.emissive.setHex(0xe8791f); mat.emissiveIntensity = 0.4 + 0.3 * Math.abs(Math.sin(time * 8)); }
        else if (r.damage > 0 || r.breach) { mat.emissive.setHex(0xe8791f); mat.emissiveIntensity = 0.3; }
        else if (lowHp) { mat.emissive.setHex(0x8a1c1c); mat.emissiveIntensity = 0.25 * Math.abs(Math.sin(time * 4)); }
        else { mat.emissiveIntensity = 0; }
      } else if (part) {
        part.visible = false;
      }
    }

    drawShield(s, time);
    drawOrbitals(s, time);
    drawShrineState(s, time);
    fillEnemies(s, time);
    drawBossState(s, time);
    fillProjectilesAndPickups(s, time);
    fillTrail(s, time);
    drawFx(s, time);

    const shake = b.shake;
    camera.position.lerp(new THREE.Vector3(
      b.x + (Math.random() - 0.5) * shake * 2.2, 30, b.z + 24 + (Math.random() - 0.5) * shake * 2.2), 0.12);
    camera.lookAt(b.x, 2, b.z);

    renderer.render(scene, camera);
  }

  function drawShield(s, time) {
    const layers = s.shield.layers;
    shieldMesh.visible = layers > 0;
    if (layers > 0) {
      shieldMesh.position.set(s.big.x, 4, s.big.z);
      shieldMesh.material.opacity = 0.08 + layers * 0.07 + Math.sin(time * 3) * 0.02;
      shieldMesh.scale.setScalar(1 + Math.sin(time * 2.4) * 0.03);
    }
  }

  function drawOrbitals(s, time) {
    const count = SIM.orbitalCount(s);
    const def = G.WEAPON_DEFS.coreOrbitals;
    for (let i = 0; i < orbitalChunks.length; i++) {
      const chunk = orbitalChunks[i];
      if (i >= count) { chunk.visible = false; continue; }
      chunk.visible = true;
      const a = s.weapons.coreOrbitals.angle + i * Math.PI * 2 / count;
      chunk.position.set(
        s.big.x + Math.cos(a) * def.radius,
        2.2 + Math.sin(time * 4 + i * 2) * 0.4,
        s.big.z + Math.sin(a) * def.radius);
      chunk.rotation.set(time * 3 + i, time * 2.2, i);
    }
  }

  function drawShrineState(s, time) {
    shrineGroup.visible = !!s.shrine;
    if (!s.shrine) return;
    shrineGroup.position.set(s.shrine.x, 0, s.shrine.z);
    const zone = shrineGroup.userData.zone;
    zone.material.opacity = 0.35 + Math.sin(time * 4) * 0.15;
    zone.scale.setScalar(1 + Math.sin(time * 2) * 0.02);
    const prog = shrineGroup.userData.prog;
    const frac = s.shrine.progress;
    prog.visible = frac > 0;
    prog.scale.setScalar(0.5 + frac * (G.CONFIG.SHRINE_RADIUS - 0.5));
    prog.material.opacity = 0.5 + frac * 0.4;
  }

  function drawBossState(s, time) {
    const boss = s.enemies.find(e => e.type === 'boss');
    bossGroup.visible = !!boss;
    if (!boss) return;
    bossGroup.position.set(boss.x, Math.abs(Math.sin(time * 2.2)) * 0.4, boss.z);
    bossGroup.rotation.y = Math.atan2(s.big.x - boss.x, s.big.z - boss.z);
    const breathe = 1 + Math.sin(time * 3) * 0.04;
    bossGroup.scale.setScalar(breathe * (boss.hitFlash > 0 ? 1.06 : 1));
  }

  /* enemies: each type gets a body + detail part + motion signature */
  function fillEnemies(s, time) {
    const counts = { swarmer: 0, runner: 0, bruiser: 0, spitter: 0, brood: 0, charger: 0 };
    let faceN = 0;
    const b = s.big;
    for (const e of s.enemies) {
      if (e.type === 'boss') continue;   // unique mesh
      if (counts[e.type] >= CAP[e.type]) continue;
      const i = counts[e.type]++;
      const dx = b.x - e.x, dz = b.z - e.z;
      const faceAng = Math.atan2(dx, dz);
      const flash = e.hitFlash > 0 ? 1.35 : 1;
      let faceY = 1.1, faceOff = 0.75, faceScale = 1;

      if (e.type === 'swarmer') {
        const sq = Math.sin(time * 6 + e.seed);
        dummy.position.set(e.x, 0.95 + Math.abs(sq) * 0.3, e.z);
        dummy.rotation.set(0, faceAng, 0);
        dummy.scale.set(flash * (1 + sq * 0.12), flash * (1 - sq * 0.15), flash * (1 + sq * 0.12));
        dummy.updateMatrix();
        inst.swarmer.setMatrixAt(i, dummy.matrix);
        // abdomen drags behind
        const fd = Math.hypot(dx, dz) || 1;
        dummy.position.set(e.x - dx / fd * 0.9, 0.8, e.z - dz / fd * 0.9);
        dummy.scale.setScalar(flash * (1 + sq * 0.1));
        dummy.updateMatrix();
        inst.swarmerAbd.setMatrixAt(i, dummy.matrix);
      } else if (e.type === 'runner') {
        dummy.position.set(e.x, 1.0, e.z);
        dummy.rotation.set(Math.PI / 2.6, faceAng, 0);
        dummy.scale.setScalar(flash);
        dummy.updateMatrix();
        inst.runner.setMatrixAt(i, dummy.matrix);
        const fd = Math.hypot(dx, dz) || 1;
        dummy.position.set(e.x - dx / fd * 1.1, 1.5, e.z - dz / fd * 1.1);
        dummy.rotation.set(0, faceAng, Math.sin(time * 10 + e.seed) * 0.3);
        dummy.updateMatrix();
        inst.runnerFin.setMatrixAt(i, dummy.matrix);
        faceY = 1.5;
      } else if (e.type === 'bruiser') {
        const stomp = Math.abs(Math.sin(time * 3.5 + e.seed)) * 0.25;
        dummy.position.set(e.x, 1.6 + stomp, e.z);
        dummy.rotation.set(0, faceAng, 0);
        dummy.scale.setScalar(flash * (1 + Math.sin(time * 6 + e.seed) * 0.05));
        dummy.updateMatrix();
        inst.bruiser.setMatrixAt(i, dummy.matrix);
        dummy.position.set(e.x, 3.5 + stomp, e.z);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        inst.horn.setMatrixAt(i, dummy.matrix);
        faceY = 2.6; faceOff = 1.25; faceScale = 1.8;
      } else if (e.type === 'spitter') {
        // stalk sways; bulb inflates before it spits
        const inflate = 1 + Math.max(0, 1 - e.spitT / 1.2) * 0.45;
        dummy.position.set(e.x, 1.2, e.z);
        dummy.rotation.set(Math.sin(time * 2 + e.seed) * 0.08, faceAng, 0);
        dummy.scale.setScalar(flash);
        dummy.updateMatrix();
        inst.spitter.setMatrixAt(i, dummy.matrix);
        dummy.position.set(e.x, 2.7, e.z);
        dummy.scale.setScalar(flash * inflate);
        dummy.updateMatrix();
        inst.spitterBulb.setMatrixAt(i, dummy.matrix);
        faceY = 2.7; faceOff = 0.6;
      } else if (e.type === 'brood') {
        const pulse = 1 + Math.sin(time * 2.4 + e.seed) * 0.08;   // wet heaving
        dummy.position.set(e.x, 1.9, e.z);
        dummy.rotation.set(0, faceAng, 0);
        dummy.scale.setScalar(flash * pulse);
        dummy.updateMatrix();
        inst.brood.setMatrixAt(i, dummy.matrix);
        dummy.position.set(e.x, 1.4, e.z);
        dummy.rotation.set(Math.PI / 2, 0, time * 0.6 + e.seed);
        dummy.scale.setScalar(flash);
        dummy.updateMatrix();
        inst.broodRing.setMatrixAt(i, dummy.matrix);
        faceY = 2.4; faceOff = 1.4; faceScale = 1.4;
      } else if (e.type === 'charger') {
        // crouch-shake in windup, flatten out in the charge
        const windup = e.mode === 1 ? Math.sin(time * 30) * 0.12 : 0;
        const lean = e.mode === 2 ? Math.PI / 2.2 : Math.PI / 2.8;
        dummy.position.set(e.x + windup, e.mode === 2 ? 0.8 : 1.1, e.z);
        dummy.rotation.set(lean, faceAng, 0);
        dummy.scale.setScalar(flash * (e.mode === 1 ? 0.92 : 1));
        dummy.updateMatrix();
        inst.charger.setMatrixAt(i, dummy.matrix);
        const fd = Math.hypot(dx, dz) || 1;
        dummy.position.set(e.x + dx / fd * 1.1, 1.2, e.z + dz / fd * 1.1);
        dummy.rotation.set(0.2, faceAng, 0);
        dummy.updateMatrix();
        inst.chargerPlate.setMatrixAt(i, dummy.matrix);
        faceY = 1.3;
      }

      if (faceN < 1100) {
        const fd = Math.hypot(dx, dz) || 1;
        dummy.position.set(e.x + dx / fd * faceOff, faceY, e.z + dz / fd * faceOff);
        dummy.rotation.set(0, faceAng, 0);
        dummy.scale.setScalar(faceScale);
        dummy.updateMatrix();
        inst.face.setMatrixAt(faceN++, dummy.matrix);
      }
    }
    for (const k in counts) {
      inst[k].count = counts[k];
      inst[k].instanceMatrix.needsUpdate = true;
    }
    inst.swarmerAbd.count = counts.swarmer; inst.swarmerAbd.instanceMatrix.needsUpdate = true;
    inst.runnerFin.count = counts.runner; inst.runnerFin.instanceMatrix.needsUpdate = true;
    inst.horn.count = counts.bruiser; inst.horn.instanceMatrix.needsUpdate = true;
    inst.spitterBulb.count = counts.spitter; inst.spitterBulb.instanceMatrix.needsUpdate = true;
    inst.broodRing.count = counts.brood; inst.broodRing.instanceMatrix.needsUpdate = true;
    inst.chargerPlate.count = counts.charger; inst.chargerPlate.instanceMatrix.needsUpdate = true;
    inst.face.count = faceN; inst.face.instanceMatrix.needsUpdate = true;
  }

  function fillProjectilesAndPickups(s, time) {
    let n = 0;
    for (const p of s.bolts) {
      if (n >= 80) break;
      dummy.position.set(p.x, 3.4, p.z);
      dummy.rotation.set(0, Math.atan2(p.vx, p.vz), 0);
      dummy.scale.set(p.weak ? 0.5 : 0.8, p.weak ? 0.5 : 0.8, p.weak ? 1.6 : 2.6);
      dummy.updateMatrix();
      inst.bolt.setMatrixAt(n++, dummy.matrix);
    }
    inst.bolt.count = n; inst.bolt.instanceMatrix.needsUpdate = true;

    n = 0;
    for (const gl of s.globs) {
      if (n >= 60) break;
      dummy.position.set(gl.x, 2.2 + Math.sin(time * 8 + gl.x) * 0.2, gl.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1 + Math.sin(time * 12) * 0.15);
      dummy.updateMatrix();
      inst.glob.setMatrixAt(n++, dummy.matrix);
    }
    inst.glob.count = n; inst.glob.instanceMatrix.needsUpdate = true;

    n = 0;
    for (const l of s.lobs) {
      if (n >= 16) break;
      const arc = Math.sin(Math.min(1, l.t) * Math.PI) * 9;   // lobbed height
      dummy.position.set(l.x, 2 + arc, l.z);
      dummy.rotation.set(l.t * 6, 0, 0);
      dummy.scale.setScalar(1.2);
      dummy.updateMatrix();
      inst.lob.setMatrixAt(n++, dummy.matrix);
    }
    inst.lob.count = n; inst.lob.instanceMatrix.needsUpdate = true;

    n = 0;
    for (const sw of s.saws) {
      if (n >= 12) break;
      dummy.position.set(sw.x, 2.2, sw.z);
      dummy.rotation.set(0.2, time * 18, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      inst.saw.setMatrixAt(n++, dummy.matrix);
    }
    inst.saw.count = n; inst.saw.instanceMatrix.needsUpdate = true;

    let ns = 0, nc = 0, nh = 0;
    for (const p of s.pickups) {
      const spin = time * 3 + p.seed;
      if (p.kind === 'salv') {
        if (ns >= 450) continue;
        dummy.position.set(p.x, 0.8 + Math.sin(spin) * 0.15, p.z);
        dummy.rotation.set(0.4, spin * 1.4, 0.3);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        inst.salv.setMatrixAt(ns++, dummy.matrix);
      } else if (p.kind === 'cache') {
        if (nc >= 24) continue;
        dummy.position.set(p.x, 1.0 + Math.sin(spin) * 0.3, p.z);
        dummy.rotation.set(0, spin * 0.8, 0.1);
        dummy.scale.setScalar(1 + Math.sin(time * 5 + p.seed) * 0.1);   // begs to be grabbed
        dummy.updateMatrix();
        inst.cache.setMatrixAt(nc++, dummy.matrix);
      } else {
        if (nh >= 24) continue;
        dummy.position.set(p.x, 1.0 + Math.sin(spin) * 0.25, p.z);
        dummy.rotation.set(0, spin, 0);
        dummy.scale.set(1, 1.4, 1);
        dummy.updateMatrix();
        inst.heal.setMatrixAt(nh++, dummy.matrix);
      }
    }
    inst.salv.count = ns; inst.salv.instanceMatrix.needsUpdate = true;
    inst.cache.count = nc; inst.cache.instanceMatrix.needsUpdate = true;
    inst.heal.count = nh; inst.heal.instanceMatrix.needsUpdate = true;
  }

  function fillTrail(s, time) {
    let n = 0;
    for (const p of s.trails) {
      if (n >= 48) break;
      const frac = p.life / p.maxLife;
      const flick = 1 + Math.sin(time * 14 + p.x * 3) * 0.2;
      dummy.position.set(p.x, 0.7 * frac, p.z);
      dummy.rotation.set(0, time * 2 + p.x, 0);
      dummy.scale.set(frac * flick, frac * (0.7 + flick * 0.5), frac * flick);
      dummy.updateMatrix();
      inst.trail.setMatrixAt(n++, dummy.matrix);
    }
    inst.trail.count = n; inst.trail.instanceMatrix.needsUpdate = true;
  }

  function drawFx(s, time) {
    let ri = 0, fi = 0, zi = 0;
    for (const f of s.fx) {
      if (ri < rings.length && (f.type === 'pop' || f.type === 'shockwave' || f.type === 'shieldHit' ||
          f.type === 'collect' || f.type === 'boltHit' || f.type === 'explosion' || f.type === 'globHit')) {
        const conf = {
          pop:       { life: 0.35, maxR: f.big ? 4 : 1.6, color: f.big ? 0xff6a2b : 0xd4557a, y: 1.2 },
          shockwave: { life: 0.5, maxR: f.radius || 8, color: PALETTE.shockwave, y: 1.5 },
          shieldHit: { life: 0.3, maxR: 6, color: 0x59d6e8, y: 4 },
          collect:   { life: 0.3, maxR: f.kind === 'cache' ? 2.6 : 1.4, color: f.kind === 'heal' ? PALETTE.heal : PALETTE.salv, y: 1.2 },
          boltHit:   { life: 0.2, maxR: 1.2, color: PALETTE.bolt, y: 2.5 },
          explosion: { life: 0.55, maxR: f.radius || 6, color: 0xff8c3b, y: 1.3 },
          globHit:   { life: 0.3, maxR: 2, color: PALETTE.acid, y: 2 },
        }[f.type];
        const t = Math.min(1, f.age / conf.life);
        if (t >= 1) continue;
        const ring = rings[ri++];
        ring.visible = true;
        ring.position.set(f.x, conf.y, f.z);
        ring.scale.setScalar(0.3 + t * conf.maxR);
        ring.material.opacity = (1 - t) * 0.85;
        ring.material.color.setHex(conf.color);
      } else if (f.type === 'headFlame' && fi < flameCones.length) {
        const t = Math.min(1, f.age / 0.45);
        if (t >= 1) continue;
        const fan = flameCones[fi++];
        fan.visible = true;
        fan.position.set(f.x, 0.5, f.z);
        fan.rotation.z = Math.atan2(f.fx, f.fz) - Math.PI / 2;
        fan.scale.setScalar(f.range * (0.3 + t * 0.7));
        fan.material.opacity = (1 - t) * 0.7;
        fan.material.color.setHex(t < 0.3 ? 0xffd166 : 0xff8c3b);
      } else if (f.type === 'zap' && zi < zapLines.length && f.age < 0.25) {
        const line = zapLines[zi++];
        line.visible = true;
        const pos = line.geometry.attributes.position;
        const pts = f.pts;
        for (let k = 0; k < 6; k++) {
          const p = pts[Math.min(k, pts.length - 1)];
          const jitter = k > 0 && k < pts.length - 1 ? (Math.random() - 0.5) * 1.2 : 0;
          pos.setXYZ(k, p.x + jitter, 3 + Math.random() * 1.5, p.z + jitter);
        }
        pos.needsUpdate = true;
        line.material.opacity = (0.25 - f.age) * 4;
      }
    }
    for (let i = ri; i < rings.length; i++) rings[i].visible = false;
    for (let i = fi; i < flameCones.length; i++) flameCones[i].visible = false;
    for (let i = zi; i < zapLines.length; i++) zapLines[i].visible = false;
  }

  function setActive(a) {
    active = a;
    renderer.domElement.style.display = a ? 'block' : 'none';
  }

  // world (x,y,z) → screen pixels, for the 2D combat-text overlay. null if behind camera.
  const _pv = new THREE.Vector3();
  function project(x, y, z) {
    if (!camera) return null;
    _pv.set(x, y, z).project(camera);
    if (_pv.z > 1) return null;
    return { x: (_pv.x * 0.5 + 0.5) * window.innerWidth, y: (-_pv.y * 0.5 + 0.5) * window.innerHeight };
  }

  return { init, draw, setActive, onResize, project };
})();
