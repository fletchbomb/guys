# SCRAPWALKER — art asset pipeline (sprite sheets)

Goal: reach the fidelity of `ref/littleguy-ref2.png` and `ref/bigguy-ref2.png` without
adding build tooling. All assets are transparent PNG sprite sheets loaded by the existing
canvas / three.js renderers. Portable, open-standard, drop-in.

## Approach (what generates well, what doesn't)

- **Little Guy (2D canvas)** — ideal for sprite sheets. Goblins, tiles, doors, consoles,
  icons all become drawn art. Highest visible payoff; matches the ref directly.
- **Big Guy enemies / pickups / ground detail (three.js)** — use each sprite as a
  **camera-facing billboard** (a textured `THREE.PlaneGeometry` or `THREE.Sprite`). Works
  fine in the 3D scene, ChatGPT-friendly.
- **Big Guy's mech** — do NOT sprite this. It is *emergently assembled* from the crew's room
  placements, so it must stay a kit of 3D parts. Higher fidelity there = voxel models
  (MagicaVoxel `.vox` → greedy-meshed geometry), not image generation. Out of scope for
  ChatGPT; keep the current procedural parts until we model a voxel kit.

## Generation rules (paste these habits, not just the prompts)

GPT-4o / DALL·E image gen is imperfect at sheets. Maximize hit rate:

1. **One subject per image.** Generate the goblin, then the intruder, then each enemy
   separately. Never ask for "all enemies in one sheet" — styles drift.
2. **Ask for a transparent background explicitly** ("pure transparent PNG, no backdrop, no
   glow, no vignette, no ground shadow"). Expect to clean stray pixels.
3. **Fixed grid, but NO baked labels.** Request an N×M grid, equal cells, one pose per cell,
   character centered, same scale/lighting. The numbered pose lists in the prompts below are
   for YOUR reference only — always add "do NOT draw any numbers, letters, or labels in the
   image." (An earlier version of this doc said "labeled cells," which is what stamped
   "1 2 3 4…" onto the tileset. Don't do that.)
4. **Lock the palette** with the hex list in each prompt so sheets match each other.
5. **Generate big, downscale later.** Ask for a large clean image; we resample to the
   in-game size (goblins ~48 px tall, tiles 50 px) at load or in a one-time crop.
6. **Consistent view angle:** interior art is a **¾ top-down** view; arena enemies are a
   **¾ top-down** view too (camera looks down the +Z at ~55°).

## Shared palette

Goblin: `#63b93e` mid, `#83d454` light, `#2c5a1e` dark. Skin warmth `#7fae3a`.
Interior: floor `#e2e0d8`, hull steel `#39414c`, door amber `#c98a2e`, panel `#1d2b34`,
edge `#48606f`. Accents: green `#69c46e`, blue `#7fb4c9`, orange `#e8a33d`, red `#d0453e`,
gold `#e8c860`.
Arena ground: purple `#3a2550`. Enemies: swarmer `#d4557a`, runner `#b44ae0`, bruiser
`#ff6a2b`, spitter `#8fbf3a`, broodmother `#c86ab0`, charger `#e0a13c`, alpha/boss `#e03040`.

---

## PRIORITY 1 — Goblin crew sheet (Little Guy)

Frames the renderer wants (map to `g.task`): idle, walk-A, walk-B, work (wrench), weld
(torch), fight (punch), hurt. Plus a separate portrait bust for the roster cards.

```
Create a 2D game sprite sheet of a single goblin engineer character, on a PURE TRANSPARENT
background (no backdrop, no cast shadow). Hand-painted pixel-art style with clean readable
silhouettes, chunky proportions, soft top-light — the look of a polished FTL-style
spaceship-management game.

Character: a small green goblin mechanic. Skin greens #63b93e / #83d454 highlights /
#2c5a1e shadow; big pointed ears; one large friendly eye-shine; wears grubby dark-steel
overalls (#39414c) with an orange tool-strap (#e8a33d). Viewed from a 3/4 TOP-DOWN angle,
as if standing on a floor seen from slightly above.

Lay out exactly 7 poses in a single row, 7 equal square cells, character centered and at
the SAME scale and lighting in every cell, left to right:
1. idle (standing, arms at sides)
2. walk step A
3. walk step B
4. working — turning a wrench on a console
5. welding — holding a torch with a bright spark
6. fighting — throwing a punch
7. hurt — flinching, small

Output a large crisp image. No text, no borders, no background grid lines.
```

### Facing (directional frames)

`goblin_crew.png` is a single front-facing set, so the renderer can only mirror
left/right and show working poses side-on — it can't show a goblin walking *up* (back to
camera) or *down*. FTL-style 4-way facing needs a directional walk sheet. When you want it,
generate this and I'll extend the loader to pick a row by `g.face`:

```
Create a 2D game sprite sheet of the SAME green goblin engineer as before (skin
#63b93e/#83d454/#2c5a1e, dark-steel overalls #39414c, orange strap #e8a33d), PURE
TRANSPARENT background, matching hand-painted pixel-art style, ¾ top-down. A 4-row walk
cycle, 3 frames per row, all cells equal size and identical scale/lighting:
row 1 = walking DOWN (facing the camera)
row 2 = walking UP (back to camera)
row 3 = walking LEFT (side profile)
row 4 = walking RIGHT (side profile)
Grid-aligned, no text, no borders.
```

Portrait (roster cards, ~44 px):

```
Create a single 2D game character portrait bust of the same green goblin engineer, PURE
TRANSPARENT background, hand-painted pixel-art style, warm top-light, framed head-and-
shoulders facing the camera, friendly expression, dark-steel overalls with an orange strap.
Palette: skin #63b93e/#83d454/#2c5a1e, steel #39414c, accent #e8a33d. Crisp, centered,
no text, no frame.
```

## PRIORITY 2 — Intruder / boarder sheet (Little Guy)

```
Create a 2D game sprite sheet of a single alien boarder creature for a spaceship-interior
game, PURE TRANSPARENT background, hand-painted pixel-art style matching a chunky FTL look,
3/4 top-down view. The creature is a hostile parasite-bug: chitinous carapace in bruised
red-violet (#7a2a3a with #d0453e highlights), too many legs, a wet mandible maw, menacing
but readable. 5 equal cells in one row, same scale/lighting each cell:
1. idle-crouch  2. skitter-A  3. skitter-B  4. lunge-attack  5. hurt.
Large crisp output, no text, no borders.
```

## Extraction-critical formatting (read before re-genning tiles/icons)

The goblin + portrait + invader sheets wired cleanly because each subject was clearly
separable. The **tileset and icon** sheets came back on glowy/vignette backgrounds with
uneven spacing and baked-in number labels — which the auto-slicer can't cut cleanly (a warm
glow bleeds between icons; a plate has no seamless tiling period). Don't hand-fix those; just
re-gen with these rules added to the prompt, verbatim, and they become one-liners to wire:

> Output on a FULLY TRANSPARENT background (alpha 0). Absolutely NO background gradient, NO
> vignette, NO colored glow/aura, NO drop shadow, NO ground shadow. Arrange every item in a
> SINGLE horizontal row, each centered in its OWN equal-size square cell, with clear empty
> transparent gaps between cells. Do NOT draw any numbers, letters, labels, or frame lines.
> Identical scale and lighting in every cell.

For the **floor tile** specifically, it must tile seamlessly: ask for "a single seamless
repeating deck-plate tile, edges designed to wrap on all four sides (top matches bottom, left
matches right), one tile only."

## PRIORITY 3 — Interior tile kit (Little Guy)

Generate the floor as its own seamless tile, and the fixtures as a separate transparent row.

Floor (seamless):

```
Create ONE seamless 2D top-down deck-plate floor tile for a spaceship, FULLY TRANSPARENT
padding, hand-painted pixel-art, bone-white plating #e2e0d8 with panel lines #c9c7bd and
faint rivets. It MUST tile seamlessly on all four edges (top wraps to bottom, left to right).
One square tile only, no border frame, no text, no background gradient or glow.
```

Fixtures (one transparent row — apply the extraction-critical rules above):

```
Create a 2D top-down spaceship-interior fixture set, FULLY TRANSPARENT background (no glow,
no vignette, no shadow), hand-painted pixel-art, one item per equal square cell in a single
row with gaps between cells, no numbers/labels. Items: straight wall segment (dark steel
#39414c, edge #48606f); wall corner; closed bulkhead door (amber #c98a2e); open bulkhead
door (recessed panels, dark interior); exterior airlock hatch (blue trim #7fb4c9); crew
console/workstation (dark screen, small green glow). Identical scale + lighting each cell.
```

System icons (apply the extraction-critical rules above):

```
Create a set of 2D game UI system icons, FULLY TRANSPARENT background (NO glow, NO aura, NO
vignette, NO shadow — pure alpha), hand-painted pixel-art, one bold glyph per equal square
cell in a single evenly-spaced row with clear gaps, no numbers/labels. 8 icons: weapon
(bolter gun), shield (chevron shield), legs (piston leg), air (fan), medbay (cross), repair
(wrench + hex nut), reactor (lightning bolt), head/flame (dragon). Colors: gold #e8c860
weapon, blue #7fb4c9 shield, purple #b48ce8 legs, teal #8fd4c2 air, green #69c46e medbay,
orange #e0813c repair, amber #e8a33d reactor, pink #e8a2d8 head. Crisp, centered.
```

Note: the icon sheet only covers 8 *system types*; the game shows 12 distinct room glyphs
(5 different weapons). If wired, all weapon rooms would share the gun icon — the vector
glyphs currently keep them distinct, and weapon names still show in the weapon bar, so this
is an acceptable trade if you want the painted look.

## PRIORITY 4 — Arena enemy billboards (Big Guy)

Generate **each enemy separately** with this template. Fill in the `[[ ]]` fields from the
table below. Same ¾ top-down view so they read on the ground plane.

```
Create a 2D game sprite sheet of a single alien monster for a top-down horde-survivor game,
PURE TRANSPARENT background, chunky voxel-inspired pixel-art with clean edges and soft
top-light (the look of a stylized voxel arena shooter). 3/4 top-down view. The monster is
[[SHAPE]], main color [[HEX]] with darker underside and a bright [[EYE]] eye/core. Lay out
5 equal cells in one row, same scale/lighting each: 1. idle  2. move-A  3. move-B
4. attack/telegraph  5. death-burst. Large crisp output, no text, no background.
```

| enemy | [[SHAPE]] | [[HEX]] | [[EYE]] |
|---|---|---|---|
| swarmer | a squat single-eye mite with a dragging abdomen | #d4557a | gold |
| runner | a fast dart-lizard with a tall tail fin | #b44ae0 | white |
| bruiser | a big horned brute, heavy shoulders | #ff6a2b | orange |
| spitter | a bulbous acid-sac creature that inflates | #8fbf3a | yellow-green |
| broodmother | a bloated egg-sac mother, splits on death | #c86ab0 | magenta |
| charger | a crouched ram-beast with a bony crest | #e0a13c | amber |
| alpha (boss) | a massive multi-eye alpha horror, unmistakable | #e03040 | red |

## PRIORITY 5 — Pickups + ground detail (Big Guy)

```
Create a small 2D sprite sheet of top-down game pickups, PURE TRANSPARENT background,
chunky voxel-pixel style, soft glow, 3 equal cells: 1. a gold hexagonal scrap-nut (#e8c860)
2. an open salvage cache crate spilling gold (#e8c860 on #5d6858) 3. a blue-green hull-patch
med-pack (#7fb4c9). Crisp, centered, no text.
```

```
Create a 2D top-down ground tileset for an alien surface, PURE TRANSPARENT background where
appropriate, chunky voxel-pixel style, bruised-purple rock palette (#3a2550 base, #5a3a72
highlight): 1. flat ground tile  2. cracked ground tile  3. a jagged crystal spire (upright)
4. a cluster of cube boulders. Uniform ¾ top-down angle, no text.
```

---

## Integration notes (what each unlocks in code)

- **Goblins / intruders** → `littleRender.drawGoblin` / `drawIntruders`: replace the
  procedural body with `ctx.drawImage(sheet, frameX, 0, 96, 96, x, y, w, h)`, picking the
  frame from `g.task` + a walk-cycle timer. Keep the existing HP bar + task-glyph overlays.
- **Tiles / doors / consoles** → `drawRoomFloor` / `drawWallsAndDoors`: blit tiles instead of
  filling rects; the dynamic room rects already drive placement, so art follows layout.
- **System icons** → `drawSysIcon`: swap the vector glyph for a sub-image. One-line change per
  icon; used in-room, in the power cluster, and on the placement ghost pads.
- **Enemies / pickups** → `bigRender.fillEnemies` / `fillProjectilesAndPickups`: swap the
  instanced boxes for billboarded textured planes (`THREE.PlaneGeometry` + `MeshBasicMaterial`
  `{map, transparent:true}`, `plane.lookAt(camera.position)` each frame, or `THREE.Sprite`).
- **A tiny loader** (`js/assets.js`): preload the sheets, expose `ASSETS.goblin` etc.;
  renderers read frames. No build step — plain `<img>` / `THREE.TextureLoader`.

## Packing raw GPT strips into a clean atlas

GPT returns an uneven strip on a white background. `dev/pack_sprites.py` keys the
background to alpha, auto-detects the frames by column occupancy, and repacks them into
equal square cells (centered, feet-baselined):

```
python3 dev/pack_sprites.py assets/goblin2.png assets/goblin_crew.png --cell 128
```

Use the same tool for future sheets (intruder, enemies) — same layout convention means the
loader reads them all the same way.

## Suggested order (one shippable feature at a time)

1. ✅ **Goblin crew sheet** — `assets/goblin_crew.png` (7 frames, 128px cells), packed from
   `goblin2.png`, loaded by `js/assets.js`, wired into `littleRender.drawGoblin`
   (frame chosen by `g.task` + walk timer, mirror for left-facing). Procedural body remains
   as the fallback when the sheet hasn't loaded (keeps the QA harness green headless).
2. ✅ **Goblin portraits** — `assets/goblin_portraits.png` (6 busts), framed in `drawPortraits`.
3. ✅ **Intruder** — `assets/invader_crew.png` (5 frames), state-driven in `drawIntruders`.
4. ✅ **System icons** — `assets/system_icons.png` (8, mapped by sys type), in `drawSysIcon`.
   The semi-transparent glow renders as a soft shadow/halo — kept as-is per Ross.
5. ✅ **Floor** — `assets/floor_tile.png` (one seamless plate, extracted from `tile-kit1.png`
   gutter-to-gutter), tiled per 50px in `drawRoomFloor`.
6. Remaining tile fixtures (walls / doors / airlock / console) — kept **procedural** on
   purpose: they animate and change state (slide open, seal, bash, vent) and interleave with
   the goblin sprites, so static tiles would be a downgrade. Revisit only if desired.
7. Arena enemies → **improve 3D geometry** (Ross's choice), not sprites. Not yet done.
8. (Later, non-ChatGPT) voxel mech-part kit for Big Guy.

All wired art keeps a procedural fallback, so the game (and the headless QA harness) never
breaks when a sheet is absent. Pack scripts live ad-hoc in `/tmp` during a session; the
reusable one is `dev/pack_sprites.py` (goblin-style strips). Icons/floor used bespoke
alpha-bbox + gutter extraction.
