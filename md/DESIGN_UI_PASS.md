# SCRAPWALKER — comprehension & UI pass (design)

## Why this pass exists

Every request in this round is really one question, asked three ways:

- **What is my build?** (what have I assembled onto the mech)
- **What have I upgraded, and how is it doing?** (my loadout and its levels)
- **What are my goals, and am I winning?** (the objective and my progress toward it)

Right now the game answers none of these at a glance. You infer your build from the room
cutaway, there's no upgrade/loadout readout, and there's no goal at all — bosses just cycle
forever. That's the gap. Below is how the reference games solve each, and the design we'll
borrow.

## How the reference games solve comprehension

**MegaBonk / Vampire Survivors** (real-time hordes). Loadout is an always-visible **row of
weapon/item icons with a level pip on each** — zero clicks to read your whole build and its
levels. Progress is a **survival timer + boss call-outs + a boss/chest blip on the minimap**,
and an XP gem bar that escalates each level. Level-up = pause + a few **cards** (new weapon,
or +1 to an existing one). The trick: the icon row *is* the build state.

**FTL** (real-time-with-pause ship). The **ship cutaway is the dashboard** — rooms, systems,
crew, and an outer hull silhouette that gives the ship identity. Power is a bottom **system
bar**: each system a card with an icon + power pips you allocate, reactor bank on the left.
Goal loop = the **beacon map** and the **FTL-drive charge gauge**: reach the exit, charge the
drive, jump to the next sector. The trick: everything is spatial and always on screen.

**Into the Breach** (turn-based tactics — the clarity benchmark). **Perfect information**:
every enemy telegraphs its exact next move on the grid, threatened tiles are highlighted, an
explicit **objectives panel** states the win condition, and a grid-power bar is your lives.
The trick: telegraphs + highlights + labeled objectives mean you always know what will happen
and what matters.

## The synthesis for us

Our hook is that **the build is one object seen two ways** — Big Guy's body *is* Little Guy's
ship interior. So: steal FTL's "the ship is the dashboard," MegaBonk's "always-visible
level-pip loadout row," and ITB's "telegraph + explicit objective." Concretely:

### 1. One economy — XP → level → Build or Upgrade
Kills/drops fill a single **XP bar**; `need = BASE * GROWTH^level` (escalating). A **Shrine =
instant +1 level**. Every level-up offers exactly **2 cards**:
- **BUILD** — a random body part not yet on the mech (from the list below).
- **UPGRADE** — advance one existing part to its next level.

Reuses existing machinery: the level-up pick, room `tier` (= part level), and grafting (=
build). Salvage becomes XP. Parts auto-install at their designated body slot (no more manual
placement — the body plan is fixed, like the ref).

### 2. The official BUILD list (~10-12 parts, VS/MegaBonk archetypes)
Each part is a body location + a weapon/power. Base three exist; the rest are level-up builds.

| # | Part | Effect | VS/MegaBonk analog | status |
|---|------|--------|--------------------|--------|
| 1 | GUN ARM (Bolter) | homing-ish projectiles | Magic Wand | base |
| 2 | AEGIS PLATE (Shields) | armor + reactive shockwave | Armor + King Bible | base |
| 3 | STOMPERS (Legs) | move speed + fire trail | Flamewalker | base |
| 4 | GUT FURNACE (Core Orbitals) | orbiting chunks | King Bible / Garlic orbit | build |
| 5 | DRAGON HEAD | forward flame cone | Fire Wand / Dragon's Breath | build |
| 6 | SPIKE MORTAR | lobbed AoE at the densest cluster | Mortar / Death Spiral | build |
| 7 | TESLA COIL | chain lightning | Lightning Ring | build |
| 8 | SAW WINGS | returning blades | Cross / Axe | build |
| 9 | MEDBAY | heals crew | passive support | build |
| 10 | REPAIR RIG | heals the hull | passive support | build |
| 11 | SECOND ARM | twin Bolter, dual-fire | Peachone / duplicator | **NEW** |
| 12 | TREADS | +speed, contact-ram damage aura | Song of Mana / dash | **NEW** |
| — | STINK GLANDS (stretch) | damaging aura around the mech | Garlic | stretch |
| — | ROCKET POD (stretch) | homing missiles | MegaBonk rockets | stretch |

Prototype target: ship 10 (parts 1–10 already exist as rooms), add SECOND ARM + TREADS to
hit 12, stretch goals later.

### 3. Upgrade model
Each part has levels 1→3 (already `tier`). An **UPGRADE** advances one part with a
part-specific boost: +projectile, wider cone, +1 chain target, extra orbital, faster fire,
+aura radius. At max level, later we can offer a VS-style **evolution**. Power pips still gate
how much of a part's level is active (keeps the FTL allocation tension).

### 4. Run structure & goals — our "find the boss → defeat → warp"
The run becomes a sequence of **SECTORS**. Each sector: a **HUNT** phase (grow, survive; a
boss **beacon blips on the radar** so you know where/when it's coming — an ITB-style
telegraph) → the **ALPHA** arrives (boss fight, its HP shown) → on defeat the **WARP DRIVE**
charges (FTL gauge) → **WARP** to the next sector (difficulty up, new mobs, fresh shrines).
Shared **objective tracker** (both views, top-centre): `SECTOR 1 · HUNT THE ALPHA` → boss HP
→ `WARP DRIVE CHARGING` → `WARP`. This is the shared goal + progress both players read.

### 5. UI architecture (the visual pass)
- **Little Guy main view** → the mech drawn as an **illustrated body** (outer armored
  arms/legs/head, like the ref) with the interior room-grid as the torso cutaway. Bottom
  becomes an **FTL power bar**: reactor bank + a row of **system cards (built only)** with
  icon + power pips + level. Top: hull, shields, objective tracker, warp gauge.
- **Big Guy view** → bottom-right HUD becomes a **mech readout** (silhouette showing build +
  which parts are hurt), matching Little Guy. Add a **MegaBonk loadout row**: every built part
  as an icon with its level pip, always visible. Plus the shared objective/boss/warp readout;
  the radar shows the boss beacon.
- **Creative room shapes** → rooms become multi-tile, non-rectangular but tile-based (e.g.
  each leg a 1×3, the head a 2×2). Needs a tile-set room model + multi-tile pathing/standing.

### 6. ITB-grade clarity (beyond the asks)
- Lean on the **1:1 body-part damage link** already built: a room in crisis flashes its
  matching limb *and* its loadout icon, so a fire reads on the body and in the HUD at once.
- **Telegraphs**: boss beacon on the radar; imminent-boarding room highlight (we have hazard
  telegraphs — surface them harder).
- Restrained palette, labeled iconography, one readout per meaningful state, both players
  reading the same run summary.

## Phasing (each a shippable, verified slice — systems before their visuals)

- **A. Unified economy** — XP bar, Build/Upgrade 2-card level-up, shrine=instant level,
  escalating XP, auto-install parts, +SECOND ARM & TREADS. (sim/state + cards; headless-tested)
- **B. Run structure & goals** — sectors, hunt→boss→warp, objective + warp HUD, boss beacon.
- **C. Loadout comprehension** — MegaBonk build/upgrade icon row (both views) + FTL power-bar
  redesign (both).
- **D. Mech illustration** — outer illustrated body (Little Guy) + Big Guy mech HUD + creative
  multi-tile room shapes & pathing.
- **E. ITB polish** — telegraphs, damage→loadout linkage, palette/labels.

Recommended order **A → B → C → D → E**: the loadout row and power bar (C) can't be built
until the Build/Upgrade model (A) exists; the mech illustration (D) is the biggest art/render
lift and benefits from the systems being final.

## Playtest feedback — stacked ideas (Ross)

**Manual placement — DONE (kept).** Build hands the part to the crew, who weld it onto a pad
they choose (the part's home pad is highlighted gold as a suggestion; the AI auto-picks it).
The old "auto-install wherever" was legacy and is gone.

**Crew as a 3rd level-up card (A.3, next).** Level-up should offer three cards: BUILD /
UPGRADE / **+GOBLIN**, and parts should *not* come with a free goblin anymore. Small change to
`makePickOptions` (3 options), `applyPick` (drop the `addGoblin` in `placeGraft`), the modal
(already handles 3), AI `pickChoice`, and QA.

**Goblin specialization & leveling (new phase — "Crew progression").** FTL-style: goblins get
better at what they *do*. Manning consoles / repairing / fighting raises the matching skill;
skilled crew work faster and hit harder. Add attribute trade-offs (fast-but-fragile vs
slow-but-tough) so crew choices matter — shown on the roster card. This deepens the "how are my
crew doing" comprehension thread.

**Drop oxygen; keep doors (folds into D/E).** Remove the AIR room + air stat + suffocation.
Doors stay as the primary containment (seal to trap/slow intruders). Replacement defense ideas
that come from *room design* rather than air, to choose from:
- **Airlocks become mechanical purge** — still eject a boarded room into the void (a "flush"),
  just no oxygen sim behind it. Keeps the satisfying vent play.
- **Defensive rooms** — power a room to make it hostile to intruders: an electrified deck
  (zap), a crusher, gun-ports. Building/placing these = tactical defense.
- **Chokepoints** — the mech's tile layout (esp. with creative shapes) creates kill-zones; park
  a fighting-spec goblin at the neck/spine. Placement *is* defense.
- **Room integrity** instead of air — breaches let more invaders in until sealed/repaired.

Likely landing: airlock-as-purge + one or two defensive room types, decided when we remove air.
