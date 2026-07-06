/* SCRAPWALKER — hud.js
   Top bar, both corner HUDs (§8 — causation, not just state), shop panel,
   level-up modal, toasts. Reads state; emits intents only.
   (Crew roster now lives in-canvas as FTL-style portraits — littleRender.) */

window.HUD = (function () {
  let els = {};
  let miniIntCtx, miniArCtx, bigFxCtx;
  let pickShownFor = null;

  const SYS_COLOR = {
    weapon: '#e8c860', shield: '#7fb4c9', leg: '#b48ce8',
    medbay: '#69c46e', reactor: '#e8a33d', air: '#8fd4c2', head: '#e8a2d8',
    repair: '#e0813c',
  };
  // rooms move now (grafts are placed by the crew), so scale live state rects
  function miniLayout(s) {
    const M = {};
    const sx = 0.72, sy = 0.60, ox = -250 * sx + 18, oy = -80 * sy + 22;
    for (const id of G.ROOM_IDS) {
      const r = s.rooms[id];
      if (!r.built || !r.rect) continue;
      const [x, y, w, h] = r.rect;
      M[id] = [x * sx + ox, y * sy + oy, w * sx, h * sy];
    }
    return M;
  }

  function init() {
    ['hpFill', 'hpLabel', 'xpFill', 'shieldPips', 'salvStat', 'lvlStat', 'timeStat', 'sideName',
     'miniInterior', 'miniArena', 'bigFx', 'toasts', 'dmgVignette', 'throttleBanner',
     'pickModal', 'pickCards',
    ].forEach(id => els[id] = document.getElementById(id));

    miniIntCtx = els.miniInterior.getContext('2d');
    miniArCtx = els.miniArena.getContext('2d');
    bigFxCtx = els.bigFx ? els.bigFx.getContext('2d') : null;
  }

  function fmtTime(t) {
    const m = (t / 60) | 0, sec = (t % 60) | 0;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function draw(s, time) {
    els.hpFill.style.width = Math.max(0, s.hp / s.maxHp * 100) + '%';
    els.hpLabel.textContent = 'SCRAPWALKER ' + Math.max(0, Math.ceil(s.hp)) + '/' + s.maxHp;
    // the gold bar: salvage progress toward the next crew pick
    els.xpFill.style.width = Math.min(100, s.salvage / s.levelUp.need * 100) + '%';
    els.shieldPips.textContent = '◈'.repeat(s.shield.layers);
    els.salvStat.textContent = Math.floor(s.salvage) + '/' + s.levelUp.need;
    els.lvlStat.textContent = s.level;
    els.timeStat.textContent = fmtTime(s.t);
    els.sideName.textContent = s.humanSide === 'big' ? 'BIG GUY' : 'LITTLE GUY';

    els.dmgVignette.style.opacity = s.big.hitFlash > 0 ? Math.min(1, s.big.hitFlash * 4) : 0;
    els.throttleBanner.classList.toggle('hidden', !(s.levelUp.pending && s.humanSide === 'big'));

    syncToasts(s);
    syncPickModal(s);

    // Big Guy runs the surface: give him the same radar the crew watches — the
    // swarm on his level, shrines, and bosses — plus his interior status window.
    if (s.humanSide === 'big') { drawMiniInterior(s, time); drawCombatText(s, time); }
    drawMiniArena(s, time);
  }

  /* ---------- floating damage numbers over the 3D arena (Big Guy) ---------- */
  function drawCombatText(s, time) {
    if (!bigFxCtx || !window.BIGR || !BIGR.project) return;
    const c = bigFxCtx;
    if (c.canvas.width !== window.innerWidth || c.canvas.height !== window.innerHeight) {
      c.canvas.width = window.innerWidth; c.canvas.height = window.innerHeight;
    }
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.textAlign = 'center';
    for (const f of s.fx) {
      if (f.type !== 'dmg') continue;
      const p = BIGR.project(f.x, 3 + f.age * 6, f.z);
      if (!p) continue;
      const fade = Math.max(0, 1 - f.age / 1.15);
      c.font = 'bold ' + (f.crit ? 22 : 14) + 'px "Chakra Petch", monospace';
      c.fillStyle = f.crit ? 'rgba(255,214,90,' + fade + ')' : 'rgba(232,240,255,' + (fade * 0.92) + ')';
      c.strokeStyle = 'rgba(8,12,18,' + (fade * 0.9) + ')';
      c.lineWidth = 3;
      const txt = f.amount + (f.crit ? '!' : '');
      c.strokeText(txt, p.x, p.y);
      c.fillText(txt, p.x, p.y);
    }
    c.textAlign = 'left';
  }

  /* ---------- toasts: DOM serves the Big Guy view; canvas handles Little ---------- */
  function syncToasts(s) {
    const want = s.humanSide === 'big'
      ? s.toasts.filter(t => t.side === 'both' || t.side === 'big')
      : [];
    for (const el of Array.from(els.toasts.children)) {
      if (!want.some(t => 'toast' + t.id === el.dataset.tid)) el.remove();
    }
    for (const t of want) {
      const tid = 'toast' + t.id;
      let el = Array.from(els.toasts.children).find(e => e.dataset.tid === tid);
      if (!el) {
        el = document.createElement('div');
        el.className = 'toast ' + t.cls;
        el.dataset.tid = tid;
        el.textContent = t.msg;
        els.toasts.appendChild(el);
      }
      el.style.opacity = Math.min(1, t.t);
    }
  }

  /* ---------- level-up modal ---------- */
  function syncPickModal(s) {
    const show = s.levelUp.pending && s.humanSide === 'little' && s.started && !s.over;
    els.pickModal.classList.toggle('hidden', !show);
    if (show && pickShownFor !== s.levelUp.options) {
      pickShownFor = s.levelUp.options;
      els.pickCards.innerHTML = '';
      s.levelUp.options.forEach((o, i) => {
        const card = document.createElement('button');
        card.className = 'pickCard';
        card.innerHTML = '<div class="icon">' + o.icon + '</div><div class="name">' + o.name +
          '</div><div class="desc">' + o.desc + '</div>';
        card.onclick = () => G.submitIntent({ t: 'pick', idx: i });
        els.pickCards.appendChild(card);
      });
    }
    if (!show) pickShownFor = null;
  }

  /* ---------- mini interior (Big Guy's corner HUD §8.5) ---------- */
  function drawMiniInterior(s, time) {
    const c = miniIntCtx;
    const MINI = miniLayout(s);
    c.clearRect(0, 0, 252, 240);
    c.font = '9px "Chakra Petch", monospace';
    c.textAlign = 'left';
    c.fillStyle = '#7d919e';
    c.fillText('CREW', 8, 12);
    const used = SIM.usedPips(s);
    c.textAlign = 'right';
    c.fillStyle = '#e8a33d';
    c.fillText('⚡' + used + '/' + s.reactor.pips, 244, 12);
    c.textAlign = 'left';

    for (const id in MINI) {
      const r = s.rooms[id];
      if (!r.built) continue;
      const [x, y, w, h] = MINI[id];
      const col = SYS_COLOR[r.sys];
      const active = r.sys === 'reactor' || G.systemActive(s, id);

      c.fillStyle = '#cfc9b6';
      c.fillRect(x, y, w, h);
      // airless stripes
      if (r.air < 0.6) {
        c.fillStyle = 'rgba(214,72,72,' + ((0.6 - r.air) * 0.7) + ')';
        c.fillRect(x, y, w, h);
      }
      if (r.fire > 0.02) {
        c.fillStyle = 'rgba(232,110,40,' + (0.35 + 0.3 * Math.abs(Math.sin(time * 6))) + ')';
        c.fillRect(x, y, w, h);
      }
      c.strokeStyle = active ? col : '#3a4854';
      c.strokeRect(x, y, w, h);

      if (r.breach) {
        c.fillStyle = '#0a0d12';
        c.beginPath(); c.arc(x + 8, y + h - 8, 4.5, 0, 7); c.fill();
      }
      for (const iv of G.intrudersIn(s, id)) {
        c.fillStyle = Math.sin(time * 8) > 0 ? '#d0453e' : '#8a1f2b';
        c.fillRect(x + w - 11, y + 3, 8, 8);
        break; // one marker is enough
      }
      if (r.damage >= 0.5) {
        c.fillStyle = '#d0453e';
        c.fillText('!', x + 3, y + 11);
      }
      let ci = 0;
      for (const g of G.settledGoblinsIn(s, id)) {
        c.fillStyle = g.hp / g.maxHp > 0.4 ? '#63b93e' : '#d0453e';
        c.beginPath();
        c.arc(x + 7 + (ci++) * 8, y + h - 7, 2.8, 0, 7);
        c.fill();
      }
      if (s.hazard.warn && s.hazard.warn.room === id && Math.sin(time * 10) > -0.2) {
        c.strokeStyle = '#e8a33d';
        c.lineWidth = 2;
        c.strokeRect(x - 2, y - 2, w + 4, h + 4);
        c.lineWidth = 1;
      }
    }
    // characters in transit
    const dot = (ent, color) => {
      const a = MINI[ent.room], b = MINI[ent.path[0]];
      if (!a || !b) return;
      c.fillStyle = color;
      c.beginPath();
      c.arc(a[0] + a[2] / 2 + (b[0] + b[2] / 2 - a[0] - a[2] / 2) * ent.hopT,
            a[1] + a[3] / 2 + (b[1] + b[3] / 2 - a[1] - a[3] / 2) * ent.hopT, 2.8, 0, 7);
      c.fill();
    };
    for (const g of s.goblins) if (g.path.length) dot(g, '#63b93e');
    for (const iv of s.intruders) if (iv.path.length) dot(iv, '#d0453e');

    // weapon status row
    const flags = [
      ['GUN', G.weaponActive(s, 'armGun')],
      ['ORB', G.weaponActive(s, 'coreOrbitals')],
      ['TRL', G.weaponActive(s, 'fireTrail')],
      ['SHK', G.weaponActive(s, 'shieldShockwave')],
      ['FLM', G.weaponActive(s, 'headFlame')],
    ];
    flags.forEach(([label, on], i) => {
      c.fillStyle = on ? '#69c46e' : '#3a4854';
      c.fillText(label, 10 + i * 34, 234);
    });
    for (let i = 0; i < s.shield.layers; i++) {
      c.fillStyle = '#7fb4c9';
      c.beginPath(); c.arc(190 + i * 10, 231, 3.5, 0, 7); c.fill();
    }
  }

  /* ---------- mini arena (Little Guy's "enemy ship" window §8.5) ---------- */
  function drawMiniArena(s, time) {
    const c = miniArCtx, W = 230, R = G.CONFIG.ARENA_R;
    c.clearRect(0, 0, W, W);
    const sc = (W / 2 - 12) / R;
    const cx = W / 2, cy = W / 2;
    c.strokeStyle = '#3a4854';
    c.beginPath(); c.arc(cx, cy, R * sc, 0, 7); c.stroke();

    const b = s.big;
    const DOT = {
      swarmer: ['#d4557a', 2.5], runner: ['#b44ae0', 2.5], bruiser: ['#ff6a2b', 6],
      spitter: ['#8fbf3a', 3.5], brood: ['#c86ab0', 5], charger: ['#e0a13c', 4],
      boss: ['#e03040', 10],
    };
    for (const e of s.enemies) {
      const x = cx + e.x * sc, y = cy + e.z * sc;
      const [col, sz] = DOT[e.type] || DOT.swarmer;
      c.fillStyle = col;
      c.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      if (e.type === 'boss') {   // unmistakable: a pulsing threat ring
        c.strokeStyle = 'rgba(224,48,64,' + (0.4 + 0.4 * Math.sin(time * 6)) + ')';
        c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, 9 + 3 * Math.sin(time * 6), 0, 7); c.stroke();
        c.lineWidth = 1;
      }
    }
    // shrine beacon — where the next room grows
    if (s.shrine) {
      const x = cx + s.shrine.x * sc, y = cy + s.shrine.z * sc;
      c.save();
      c.translate(x, y);
      c.rotate(Math.PI / 4);
      c.strokeStyle = 'rgba(232,200,96,' + (0.6 + 0.4 * Math.sin(time * 4)) + ')';
      c.lineWidth = 2;
      c.strokeRect(-4, -4, 8, 8);
      c.restore();
      c.lineWidth = 1;
      if (s.shrine.progress > 0) {
        c.strokeStyle = '#69c46e';
        c.beginPath();
        c.arc(x, y, 8, -Math.PI / 2, -Math.PI / 2 + s.shrine.progress * Math.PI * 2);
        c.stroke();
      }
    }
    c.fillStyle = 'rgba(232,200,96,0.55)';
    for (let i = 0; i < s.pickups.length; i += 3) {
      const p = s.pickups[i];
      c.fillRect(cx + p.x * sc, cy + p.z * sc, 1.5, 1.5);
    }
    for (const p of s.trails) {
      c.fillStyle = 'rgba(232,140,59,' + (0.4 * p.life / p.maxLife) + ')';
      c.fillRect(cx + p.x * sc - 1, cy + p.z * sc - 1, 2, 2);
    }
    const bx = cx + b.x * sc, by = cy + b.z * sc;
    c.save();
    c.translate(bx, by);
    c.rotate(Math.atan2(b.fx, -b.fz));
    c.fillStyle = s.big.hitFlash > 0 ? '#d0453e' : '#69c46e';
    c.beginPath();
    c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5);
    c.fill();
    c.restore();
    if (s.shield.layers > 0) {
      c.strokeStyle = '#7fb4c9';
      c.beginPath(); c.arc(bx, by, 9, 0, 7); c.stroke();
    }
    for (const f of s.fx) {
      if ((f.type === 'shockwave' || f.type === 'headFlame') && f.age < 0.5) {
        c.strokeStyle = f.type === 'shockwave' ? 'rgba(127,180,201,' + (1 - f.age * 2) + ')'
          : 'rgba(232,140,59,' + (1 - f.age * 2) + ')';
        c.beginPath();
        c.arc(cx + f.x * sc, cy + f.z * sc, f.age * 24, 0, 7);
        c.stroke();
      }
    }
    c.font = '9px "Chakra Petch", monospace';
    c.fillStyle = '#7d919e';
    c.textAlign = 'left';
    c.fillText('BIG GUY · HP ' + Math.max(0, Math.ceil(s.hp)) + ' · ◈' + s.shield.layers, 8, W - 8);
  }

  return { init, draw };
})();
