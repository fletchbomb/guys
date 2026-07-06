# SCRAPWALKER — solo-mode prototype (v5)

A two-player asymmetric co-op game, currently in single-player form with AI hot-swap. One player is the mech (**Big Guy** — Megabonk-style horde survivor), one is the crew inside it (**Little Guy** — FTL reskinned as the interior of a giant goblin mech). One shared health bar. Each half copies its reference game's mechanical grammar and visual idiom with original art and names; only the wiring between them is original.

## Run it

Open `index.html` in a browser (needs internet once, for the three.js CDN and the UI font). No build step, no install.

Controls: `WASD`/arrows move the mech, `Tab` hot-swaps which half you control (the AI takes the other), `M` mutes. Little Guy is mouse-only plus `1`–`6` to select crew: click a goblin/portrait then a room to send it; click a power column to add a pip (right-click removes — output scales per pip); click doors to seal bulkheads; click hull airlocks to vent; when a room grows, click a glowing pad to weld it on. All weapons are AUTO.

## Architecture (do not break)

```
index.html      shell, CSS (FTL chamfered chrome), pick modal, overlays
js/state.js     THE plain state object + intent queue + derived getters
js/sim.js       fixed-tick simulation; the only writer of state
js/ai.js        AI operators for both halves (submit intents like a human)
js/bigRender.js three.js arena renderer (reads state only)
js/littleRender.js  canvas FTL-interior renderer + mouse input (emits intents)
js/hud.js       top bar, corner HUDs, level-pick modal, toasts
js/audio.js     tiny WebAudio synth, no assets
js/main.js      boot, fixed-tick loop, keyboard, hot-swap, screens
dev/qa.js       headless QA harness (see below)
```

`G.state` is the single serializable source of truth; renderers only read it; ALL input (human, AI, future network) submits intents via `G.submitIntent()` applied by `sim.js` on a fixed 60 Hz tick. `LITTLER.debug` exports pixel geometry so the QA harness can drive real clicks.

## Progression: one currency, one moment

There is no shop and no XP. Kills drop **salvage** (gold hex nuts — the only pickup). The gold bar fills (`PICK_BASE` 22, ×1.35 per pick) → spawns throttle → the crew picks one of three **bundle cards**: +1 reactor pip, reinforce hull (+20/+20/+0.3 regen), +1 goblin, a system card that grants **+1 capacity AND the pip to run it**, **Targeting Array** (+crit chance, crits deal ×2), or a **Scrap Magnet** (wider pickup range). One decision every ~40–50s, each one meaty.

## Growth: shrines grow rooms; the crew welds them where doors line up

You start as a headless 5-room brute (ARM GUN, REACTOR, SHIELDS, AIR, LEGS). Shrines rise on the surface (~every 55s); standing in the ring for 7s (progress drains if you leave) **grows** the next room, in order: HEAD, CORE ORBITALS, MEDBAY, REPAIR RIG, SPIKE MORTAR, ZAP COIL, SAW WING. A grown room isn't part of the body until the crew **welds it onto a pad** — Little Guy clicks any glowing `GRAFT_SLOT` whose wall lines up with a built room (a full tile of shared wall = a doorway). Adjacency and doors are then **derived from geometry** (`geoNeighbors`), so where you place a room decides how crew route through it. A grown-but-unplaced room blocks the next shrine. Fully grown, shrines pay 30 salvage. Unbuilt rooms show as sockets in the power cluster and weapon bar.

## Big Guy IS the floor plan (1:1)

The mech has no fixed design. Every built room projects **one body-part polygon** onto the 3D mech at the exact spot it sits on Little Guy's grid — interior X → left/right on the body, interior Y (grows downward) → top-to-bottom (`mapRoom` in `bigRender.js`). The starting five rooms tile into a connected silhouette (gun-arm upper-left, core upper-centre, shields mid-left, air belly, legs at the ground, feet on the deck); each room carries a decoration that reads its function (barrel, core sphere, shield dish, fan, feet, face, gyro ring, med cross, torch, mortar tube, tesla spike, saw-wings). Weld the HEAD onto a bottom pad and the **face rides down to the shin** — the body is a 1:1 mirror of the crew's build, remutating live as rooms are placed, grafted, or damaged (a room on fire lights up its matching body-part).

**REPAIR RIG** is a support system, not a weapon: powered, it mends Big Guy's shared hull (`HULL_REPAIR_RATE`/s per effective pip); manned, ×1.5. **MEDBAY** heals crew; the rig heals the mech.

## Big Guy's radar

Both halves now watch the **surface feed** (`#miniArena`): the swarm on the mech's level, the shrine beacon + channel ring, and bosses (a pulsing threat ring). Big Guy also keeps his interior status window. Discrete weapon hits throw **floating damage numbers** over the arena (crits are bigger and gold), projected from the live three.js camera via `BIGR.project`.

## The eight weapon patterns

Auto-fire only; output scales with pips (`G.pipEff` 1/1.55/2.0×); manning = 0.75× cooldown; weak fallback only when everything is dark. BOLTER (projectile), ORBIT (Chunkers), TRAIL (Flamewalker), AEGIS (on shield block), FLAME (Dragon's Breath), and three grafts: MORTAR (lobbed AoE at the densest cluster), ZAP (chain lightning, 4 targets), SAW (returning blade along facing).

## The bestiary + bosses

Unlocks over time, read through bodies and motion, not UI alerts: swarmer mites (squash-bob, dragging abdomen), dart runners (tail fin), horned bruisers (elite: hits roll interior crises), spitters (hold range, bulb inflates, lob dodgeable acid — 130s), broodmothers (split into 5 on death — 150s), chargers (visible crouch-windup, then a locked-direction ram — 190s). **Alphas** (unique boss body) surface at 180s then every 100s: melee causes crises, acid volleys, summons broods of swarmers; guaranteed **salvage cache** (+heal) on death. Rare caches (6% from elites) and heal packs (3% any kill, +8 hull) drop throughout.

## The interior

Up to twelve tile-grid rooms sharing walls inside a drawn goblin hull that grows welded pads at the crew-chosen slots as rooms graft on (shadow, seams, decal; the whole ship bobs and shakes when hit). FTL semantics on FTL timescales: fires are ~10s+ dramas that spread through open doors; breaches weld in 14 goblin-seconds; repairs ~5.5s/point; **intruders move** — sabotage, re-target, bash sealed bulkheads (~5s); **airlocks vent** — fires starve below 35% air, creatures suffocate below 25%.

**The hazard director** rolls a telegraphed minor event every 30–55s (3s warning banner + room highlight, never during a pick, one at a time): **Grubber** (runt boarder through a hull room, 40%), **Coolant leak** (mini-breach, quick patch, 25%), **Rattle** (1 system damage, 20%), **Ash squall** (15s of random ignitions, after 90s). Killing a bruiser at close range can also send its parasites aboard (`PARASITE_CHANCE` 0.25). Bruiser hits remain the major crisis source.

**The visual idiom is FTL's**: consoles at station tiles are the manning read (the goblin stands at it, back to camera), no room-name text, doors slide open for passing crew, yellow bulkheads, pink airless stripes, chunky pixel crew with smoothed tile-walking and 4-way facing, portrait rows whose background is the health bar, chamfered panels everywhere, border-fill weapon charge, icon+boxed-value top readout, shield bubble around the hull, centered warning banners, two-line tooltips, custom cursor.

## QA

```
node dev/qa.js          # sim checks + 5-minute AI-vs-AI soak with invariants
NODE_PATH=<path with three> node dev/qa.js --full   # + boots the full app on a fake DOM
```

65 checks (48 headless + 17 full-app): shrine channel/drain, crew-placed grafts (grow → weld on a chosen pad → derived neighbors/doors → crew route through), pending-graft blocks the next shrine, all eight weapons, repair-rig hull mend (powered/manned/unpowered), crit multiplier + damage numbers, scrap-magnet range, new mobs (spitter/brood/charger behaviors), boss cycle + cache/heal drops, salvage picks, hazards + parasites, slots/tasks/venting/door-bashing regressions, full-app synthetic clicks including a live mid-run graft placed by the AI crew, and per-tick soak invariants (incl. no entity in an ungrown room).

## Out of scope (deliberately)

Manual firing/targeting, crew skill-up, surge pacing, solo pause, netcode. Tuning is first-pass: AI-vs-AI survives ~2–4 minutes; the AI is a floor — calibrate boss HP, shrine cadence, and mob unlock times against human play.
