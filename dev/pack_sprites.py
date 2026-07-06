#!/usr/bin/env python3
"""Pack a raw AI-generated sprite strip into a clean, keyed, uniform atlas.

Usage: python3 dev/pack_sprites.py assets/goblin2.png assets/goblin_crew.png [--cell 128]

Keys out the near-white background to alpha, auto-detects the sprites by column
occupancy, then repacks them into equal square cells, each sprite centered and
feet-baselined so the renderer can blit frame i from (i*cell, 0).
"""
import sys, numpy as np
from PIL import Image

def pack(src_path, out_path, cell=128, col_thresh=6):
    src = Image.open(src_path).convert('RGB')
    a = np.asarray(src).astype(np.int16); H, W, _ = a.shape
    mn = np.minimum(np.minimum(a[:, :, 0], a[:, :, 1]), a[:, :, 2])
    alpha = np.clip((238 - mn) / (238 - 215) * 255, 0, 255).astype(np.uint8)
    alpha[mn > 236] = 0
    rgba = np.dstack([a[:, :, 0], a[:, :, 1], a[:, :, 2], alpha]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')

    cols = (alpha > 60).sum(axis=0) > col_thresh
    segs, i = [], 0
    while i < W:
        if cols[i]:
            j = i
            while j < W and cols[j]: j += 1
            segs.append((i, j)); i = j
        else:
            i += 1
    frames = []
    for x0, x1 in segs:
        sub = alpha[:, x0:x1]
        rows = np.where((sub > 60).sum(axis=1) > 2)[0]
        scols = np.where((sub > 60).sum(axis=0) > 2)[0]
        frames.append((x0 + scols.min(), int(rows.min()), x0 + scols.max() + 1, int(rows.max()) + 1))

    pad = 14
    src_cell = max(max(f[2] - f[0] for f in frames), max(f[3] - f[1] for f in frames)) + pad * 2
    sheet = Image.new('RGBA', (src_cell * len(frames), src_cell), (0, 0, 0, 0))
    for idx, (x0, y0, x1, y1) in enumerate(frames):
        crop = img.crop((x0, y0, x1, y1)); w, h = crop.size
        sheet.paste(crop, (idx * src_cell + (src_cell - w) // 2, src_cell - pad - h), crop)
    Image.Image.resize(sheet, (cell * len(frames), cell), Image.LANCZOS).save(out_path)
    print(f'packed {len(frames)} frames -> {out_path} (cell {cell})')

if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    cell = 128
    if '--cell' in sys.argv: cell = int(sys.argv[sys.argv.index('--cell') + 1])
    pack(args[0], args[1], cell)
