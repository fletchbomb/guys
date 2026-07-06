/* SCRAPWALKER — audio.js : tiny WebAudio synth, no assets */
window.AUDIO = (function () {
  let ctx = null, muted = false, master = null;
  const lastPlay = {}; // rate-limit per sound

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone(freq, dur, type, vol, slide) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, freq) {
    const len = (ctx.sampleRate * dur) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 900;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  const DEFS = {
    pew:         { limit: 0.09, fn: () => tone(880, 0.06, 'square', 0.05, 0.5) },
    weakPew:     { limit: 0.2,  fn: () => tone(520, 0.07, 'triangle', 0.04, 0.5) },
    orbital:     { limit: 0.12, fn: () => { tone(220, 0.09, 'square', 0.08, 0.6); noise(0.06, 0.05, 700); } },
    trail:       { limit: 0.9,  fn: () => noise(0.18, 0.04, 500) },
    shockwave:   { limit: 0.15, fn: () => { tone(90, 0.4, 'sine', 0.28, 0.4); tone(440, 0.25, 'sine', 0.1, 1.8); } },
    flame:       { limit: 0.3,  fn: () => { noise(0.35, 0.16, 1400); tone(140, 0.3, 'sawtooth', 0.08, 0.6); } },
    repair:      { limit: 0.55, fn: () => tone(1300, 0.04, 'square', 0.035, 0.8) },
    spray:       { limit: 0.6,  fn: () => noise(0.2, 0.035, 2400) },
    weld:        { limit: 0.5,  fn: () => { tone(1900, 0.05, 'square', 0.03); noise(0.08, 0.03, 3000); } },
    fight:       { limit: 0.4,  fn: () => tone(180, 0.09, 'square', 0.09, 0.5) },
    doorOpen:    { limit: 0.15, fn: () => tone(300, 0.1, 'square', 0.06, 1.6) },
    doorClose:   { limit: 0.15, fn: () => tone(480, 0.1, 'square', 0.07, 0.5) },
    doorBash:    { limit: 0.35, fn: () => { tone(90, 0.12, 'square', 0.14, 0.6); noise(0.1, 0.08, 300); } },
    pipUp:       { limit: 0.06, fn: () => tone(540, 0.05, 'square', 0.06, 1.25) },
    pipDown:     { limit: 0.06, fn: () => tone(440, 0.05, 'square', 0.05, 0.75) },
    vent:        { limit: 0.4,  fn: () => noise(0.5, 0.07, 2600) },
    klaxon:      { limit: 2.6,  fn: () => { tone(620, 0.28, 'square', 0.05, 0.76); setTimeout(() => muted || tone(470, 0.28, 'square', 0.05, 1.3), 340); } },
    lowAir:      { limit: 3.0,  fn: () => { tone(700, 0.25, 'sine', 0.08, 0.85); setTimeout(() => muted || tone(700, 0.25, 'sine', 0.08, 0.85), 350); } },
    kill:        { limit: 0.06, fn: () => tone(300, 0.08, 'sawtooth', 0.07, 0.4) },
    crit:        { limit: 0.05, fn: () => { tone(1200, 0.05, 'square', 0.05, 1.8); tone(1800, 0.06, 'square', 0.03, 2.2); } },
    bigKill:     { limit: 0.1,  fn: () => { tone(140, 0.3, 'sawtooth', 0.16, 0.3); noise(0.25, 0.12, 500); } },
    hit:         { limit: 0.15, fn: () => { tone(110, 0.15, 'triangle', 0.2, 0.5); } },
    bigHit:      { limit: 0.2,  fn: () => { tone(70, 0.4, 'sawtooth', 0.3, 0.4); noise(0.3, 0.2, 400); } },
    shieldHit:   { limit: 0.1,  fn: () => tone(520, 0.18, 'sine', 0.18, 0.6) },
    shieldUp:    { limit: 0.2,  fn: () => tone(420, 0.14, 'sine', 0.12, 1.6) },
    dodge:       { limit: 0.2,  fn: () => tone(700, 0.08, 'sine', 0.06, 1.4) },
    blast:       { limit: 0.1,  fn: () => { tone(200, 0.22, 'square', 0.2, 0.3); noise(0.2, 0.18, 1200); } },
    rocketLaunch:{ limit: 0.1,  fn: () => { tone(160, 0.5, 'sawtooth', 0.12, 2.2); noise(0.3, 0.1, 800); } },
    boom:        { limit: 0.12, fn: () => { tone(60, 0.5, 'sine', 0.3, 0.5); noise(0.45, 0.25, 350); } },
    xp:          { limit: 0.08, fn: () => tone(1150, 0.05, 'sine', 0.04, 1.3) },
    salv:        { limit: 0.1,  fn: () => { tone(1500, 0.05, 'square', 0.05); tone(1900, 0.06, 'square', 0.04); } },
    levelup:     { limit: 0.5,  fn: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => muted || tone(f, 0.16, 'square', 0.12), i * 90)); } },
    pick:        { limit: 0.3,  fn: () => { tone(784, 0.12, 'square', 0.1); setTimeout(() => muted || tone(1046, 0.2, 'square', 0.1), 100); } },
    buy:         { limit: 0.2,  fn: () => { tone(660, 0.08, 'square', 0.08); setTimeout(() => muted || tone(880, 0.1, 'square', 0.08), 70); } },
    charged:     { limit: 0.3,  fn: () => tone(950, 0.15, 'sine', 0.1, 1.25) },
    alarm:       { limit: 0.5,  fn: () => { tone(600, 0.18, 'square', 0.1, 0.7); setTimeout(() => muted || tone(600, 0.18, 'square', 0.1, 0.7), 240); } },
    intruder:    { limit: 0.5,  fn: () => { tone(180, 0.3, 'sawtooth', 0.14, 1.8); } },
    goblinDeath: { limit: 0.3,  fn: () => tone(400, 0.5, 'triangle', 0.14, 0.25) },
    gameover:    { limit: 1,    fn: () => { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => muted || tone(f, 0.5, 'triangle', 0.16), i * 240)); } },
    swap:        { limit: 0.2,  fn: () => tone(500, 0.1, 'sine', 0.09, 1.5) },
    mortar:      { limit: 0.3,  fn: () => { tone(140, 0.25, 'square', 0.14, 0.4); noise(0.15, 0.08, 500); } },
    zap:         { limit: 0.25, fn: () => { tone(1800, 0.12, 'sawtooth', 0.07, 0.2); noise(0.08, 0.06, 4000); } },
    saw:         { limit: 0.3,  fn: () => tone(320, 0.18, 'sawtooth', 0.08, 1.6) },
    spit:        { limit: 0.3,  fn: () => tone(240, 0.14, 'triangle', 0.07, 1.8) },
    shrine:      { limit: 1,    fn: () => { [392, 523, 659].forEach((f, i) => setTimeout(() => muted || tone(f, 0.3, 'sine', 0.1), i * 130)); } },
    roomBuilt:   { limit: 1,    fn: () => { [262, 392, 523, 784].forEach((f, i) => setTimeout(() => muted || tone(f, 0.22, 'square', 0.1), i * 110)); noise(0.4, 0.08, 600); } },
    bossRoar:    { limit: 1.5,  fn: () => { tone(70, 0.9, 'sawtooth', 0.22, 0.5); noise(0.7, 0.15, 250); } },
    bossDown:    { limit: 1,    fn: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => muted || tone(f, 0.2, 'square', 0.12), i * 90)); } },
    cacheGet:    { limit: 0.3,  fn: () => { [880, 1108, 1318].forEach((f, i) => setTimeout(() => muted || tone(f, 0.1, 'square', 0.09), i * 60)); } },
    healPack:    { limit: 0.3,  fn: () => { tone(660, 0.15, 'sine', 0.1, 1.5); setTimeout(() => muted || tone(990, 0.2, 'sine', 0.08), 120); } },
  };

  function play(name) {
    if (muted || !ctx) return;
    const d = DEFS[name];
    if (!d) return;
    const now = performance.now() / 1000;
    if (lastPlay[name] && now - lastPlay[name] < d.limit) return;
    lastPlay[name] = now;
    try { d.fn(); } catch (e) { /* audio must never crash the sim */ }
  }

  return {
    play,
    unlock: ensure,
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
  };
})();
