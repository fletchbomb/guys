/* SCRAPWALKER — main.js
   Boot, fixed-tick loop (§10.4), input → intents (§10.3), hot-swap (§9.2),
   view swapping, start/game-over screens. */

(function () {
  const keys = {};
  let lastFrame = 0, acc = 0;
  const TICK = G.CONFIG.TICK;

  const el = id => document.getElementById(id);

  function boot() {
    if (!window.THREE) {
      document.body.innerHTML = '<div style="padding:60px;font-family:monospace;color:#dde3ee;background:#0d0f14;height:100vh">' +
        '<h2 style="color:#ff8c3b">three.js failed to load</h2>' +
        '<p>SCRAPWALKER loads three.js from a CDN — check your internet connection and reload.</p></div>';
      return;
    }
    BIGR.init(el('bigView'));
    LITTLER.init(el('littleCanvas'));
    HUD.init();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', e => { keys[e.code] = false; });

    el('startBtn').onclick = startRun;
    el('restartBtn').onclick = () => { el('overOverlay').classList.add('hidden'); startRun(); };
    el('muteBtn').onclick = toggleMute;
    el('sideTag').onclick = hotSwap;

    applyView();
    requestAnimationFrame(frame);
  }

  function startRun() {
    AUDIO.unlock();
    const keepSide = G.state ? G.state.humanSide : 'big';
    G.state = G.newState();
    G.state.humanSide = keepSide;
    G.state.started = true;
    el('startOverlay').classList.add('hidden');
    applyView();
  }

  function toggleMute() {
    const m = AUDIO.toggleMute();
    el('muteBtn').textContent = m ? '♪ off' : '♪ on';
  }

  function onKeyDown(e) {
    keys[e.code] = true;
    if (e.code === 'Tab') { e.preventDefault(); hotSwap(); return; }
    if (e.code === 'KeyM') { toggleMute(); return; }
    const s = G.state;
    if (!s.started || s.over) {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (!el('overOverlay').classList.contains('hidden')) { el('overOverlay').classList.add('hidden'); startRun(); }
        else if (!el('startOverlay').classList.contains('hidden')) startRun();
      }
      return;
    }
    // crew selection hotkeys (FTL binds numbers to crew) — weapons stay AUTO
    if (s.humanSide === 'little' && e.code.startsWith('Digit')) {
      const i = parseInt(e.code.slice(5), 10) - 1;
      if (i >= 0 && i < s.goblins.length) LITTLER.selectGoblin(s.goblins[i].id);
    }
  }

  /* ---------- hot-swap (§9.2): the AI takes the half you leave ---------- */
  function hotSwap() {
    const s = G.state;
    s.humanSide = s.humanSide === 'big' ? 'little' : 'big';
    AUDIO.play('swap');
    G.toast(s, s.humanSide, 'YOU ARE ' + (s.humanSide === 'big' ? 'THE MECH' : 'THE CREW') + ' — AI HAS THE OTHER HALF', 'good');
    applyView();
  }

  function applyView() {
    const side = G.state.humanSide;
    const big = side === 'big';
    el('littleView').classList.toggle('hidden', big);
    el('miniInterior').classList.toggle('hidden', !big);
    // both halves watch the surface radar now (Big Guy sees his own swarm/shrines/bosses)
    el('miniArena').classList.remove('hidden');
    el('miniArenaTitle').classList.remove('hidden');
    el('bigFx').classList.toggle('hidden', !big);
    el('bigLoadout').classList.toggle('hidden', !big);
    if (document.body) document.body.classList.toggle('littleMode', !big);
    BIGR.setActive(big);
  }

  /* ---------- human Big Guy input → the same intent seam as the AI ---------- */
  function submitHumanMove() {
    let x = 0, z = 0;
    if (keys.KeyW || keys.ArrowUp) z -= 1;
    if (keys.KeyS || keys.ArrowDown) z += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    G.submitIntent({ t: 'bigMove', x, z });
  }

  /* ---------- main loop ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    acc += dt;

    const s = G.state;
    let steps = 0;
    while (acc >= TICK && steps < 6) {
      acc -= TICK; steps++;
      if (s.started && !s.over) {
        if (s.humanSide === 'big') submitHumanMove();
        AI.tick(s, TICK);
        SIM.tick(s, TICK);
        if (s.over) onGameOver(s);
      }
    }

    const time = now / 1000;
    if (s.humanSide === 'big') BIGR.draw(s, time);
    else LITTLER.draw(s, time);
    HUD.draw(s, time);
  }

  function onGameOver(s) {
    el('overStats').innerHTML =
      'survived <b>' + Math.floor(s.t / 60) + 'm ' + Math.floor(s.t % 60) + 's</b>' +
      ' · upgrades <b>' + (s.level - 1) + '</b>' +
      ' · kills <b>' + s.kills + '</b><br>' +
      'rooms grown <b>' + s.stats.roomsGrown + '</b>' +
      ' · alphas slain <b>' + s.stats.bosses + '</b>' +
      ' · crises survived <b>' + s.stats.crisesSurvived + '</b>' +
      ' · crew left <b>' + s.goblins.length + '</b>';
    el('overOverlay').classList.remove('hidden');
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
