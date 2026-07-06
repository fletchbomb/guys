/* SCRAPWALKER — assets.js
   Preloads sprite sheets and exposes their frame geometry. Renderers read from
   here and blit frames; if a sheet isn't ready (or we're headless, e.g. the QA
   harness with no Image), renderers fall back to their procedural drawing.
   No build step — plain <img>, file://-friendly. */

window.ASSETS = (function () {
  // each sheet: horizontal strip of `cols` cells, `cell` px square
  const sheets = {
    goblin: { src: 'assets/goblin_crew.png', cols: 7, cell: 128, img: null, ready: false },
    portrait: { src: 'assets/goblin_portraits.png', cols: 6, cell: 112, img: null, ready: false },
    invader: { src: 'assets/invader_crew.png', cols: 5, cell: 112, img: null, ready: false },
    icons: { src: 'assets/system_icons.png', cols: 8, cell: 112, img: null, ready: false },
    floor: { src: 'assets/floor_tile.png', cols: 1, cell: 64, img: null, ready: false },
  };

  function load() {
    if (typeof Image === 'undefined') return;   // headless: stay procedural
    for (const key in sheets) {
      const s = sheets[key];
      const im = new Image();
      im.onload = () => { s.ready = true; };
      im.onerror = () => { s.ready = false; };
      im.src = s.src;
      s.img = im;
    }
  }

  // draw cell `frame` of a sheet into a dw×dh box centered on (cx, footY-anchored).
  // flipX mirrors horizontally (for left-facing). No-op if the sheet isn't ready.
  function drawFrame(ctx, key, frame, cx, bottomY, dh, flipX) {
    const s = sheets[key];
    if (!s || !s.ready) return false;
    const dw = dh;                       // cells are square
    ctx.save();
    ctx.translate(cx, bottomY - dh);     // origin at box top, centered on cx
    if (flipX) ctx.scale(-1, 1);         // mirror around cx for left-facing
    ctx.imageSmoothingEnabled = false;   // keep the pixel edges crisp
    ctx.drawImage(s.img, frame * s.cell, 0, s.cell, s.cell, -dw / 2, 0, dw, dh);
    ctx.restore();
    return true;
  }

  // blit a square cell straight into a box (no anchor/flip) — for portraits, icons, tiles
  function drawCell(ctx, key, frame, dx, dy, dw, dh) {
    const s = sheets[key];
    if (!s || !s.ready) return false;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;                // painted art downsamples smoothly
    ctx.drawImage(s.img, frame * s.cell, 0, s.cell, s.cell, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = prev;
    return true;
  }

  return { sheets, load, drawFrame, drawCell, ready: key => !!(sheets[key] && sheets[key].ready) };
})();

ASSETS.load();
