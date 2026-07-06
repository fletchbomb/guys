# SCRAPWALKER Next-Version Change Spec

**Purpose:** This is a focused implementation spec for the next playable version of SCRAPWALKER. It collects the playtest feedback and design decisions from the first prototype review into one actionable handoff for a coding agent.

**Primary rule:** **Reskin, do not invent.**

SCRAPWALKER is not trying to design a new Big Guy action system or a new Little Guy management system. The goal is:

- **Big Guy:** copy proven **Megabonk-style** horde-survival weapon and readability patterns, then reskin them as parts of a giant goblin mech.
- **Little Guy:** copy proven **FTL-style** ship-interior management, then reskin it as the inside of that goblin mech.
- **Only the wiring between them is original:** Big Guy's outside fight creates salvage and interior crises; Little Guy's FTL management keeps Big Guy's Megabonk weapons and body systems online.

Use **original art, original names, and original UI styling**. Do not copy proprietary sprites, UI art, logos, icons, sound effects, characters, or exact visual assets from either reference game. Copy the **mechanical patterns and interaction grammar**, not the assets.

---

## 1. Current prototype diagnosis

### 1.1 Big Guy problem

Big Guy currently reads like:

> dodging some polygons, collecting other polygons, and seeing a third kind of polygon as terrain.

That is not enough. The screen needs the juice and clarity of a Megabonk-style survivor game.

Big Guy must clearly communicate:

- what is an enemy;
- what is a pickup;
- what is terrain/decor;
- what each enemy type asks the player to do;
- what each weapon is doing;
- why a weapon result happened;
- what Little Guy's management changed on the Big Guy side.

### 1.2 Little Guy problem

Little Guy currently feels like:

> a control menu with icons and bars.

It should feel like:

> an FTL ship interior reskinned as the inside of a giant goblin mech.

The player should be moving named goblin crew through actual rooms, manning systems, repairing damage, extinguishing fires, sealing breaches, fighting intruders, healing injured crew, managing power, and using doors/bulkheads to contain problems.

### 1.3 Design correction

The first prototype implemented pieces of the concept, but it drifted toward invention/abstraction. The next version must become **less clever and more referential**:

- Big Guy should be much closer to Megabonk.
- Little Guy should be much closer to FTL.
- Scrapwalker flavor should appear as **reskin + wiring**, not as new mechanics.

---

## 2. Hard scope for this next version

Build only the following systems for the next pass.

### 2.1 Big Guy: five body-mapped Megabonk weapon patterns

Use **exactly one** prototype weapon in each category for now:

| Category | Megabonk source pattern | Prototype name | Scrapwalker body source |
|---|---|---|---|
| Projectile | basic auto projectile, Revolver/Bow-like | **Arm Gun** | Arm system |
| Orbital | Chunkers | **Core Orbitals** | Core system |
| Trail | Flamewalker | **Fire Trail** | Legs system |
| Shield weapon | Aegis | **Shield Shockwave** | Shield/chest system |
| Cone | Dragon's Breath | **Head Flame** | Head system |

Do **not** add additional Big Guy weapon patterns in this pass.

### 2.2 Little Guy: FTL room-management basics

Implement the core FTL-like interior behaviors:

- named goblin crew with health;
- crew movement between rooms;
- rooms with fixed occupancy slots;
- reactor power allocation;
- system rooms with power, damage, manning, and repair;
- auto-firing weapons, not manual fire buttons;
- fires;
- breaches;
- intruders/boarders;
- medbay/crew healing;
- oxygen/coolant/air safety;
- doors/bulkheads;
- FTL-style control strip/menu, not current custom room-embedded controls.

### 2.3 Explicitly out of scope

Do not add these yet:

- dash attacks;
- harpoons;
- black holes;
- mines;
- boomerangs;
- lightning;
- shotgun spread;
- rockets as a separate weapon slot;
- overheat attacks;
- manual special weapon loading;
- custom breach-fighting weapons;
- crafting;
- new currencies;
- two-device netcode;
- new non-FTL Little Guy systems;
- new non-Megabonk Big Guy weapon mechanics.

These may be valid later only if they map directly to a known Megabonk weapon pattern or FTL system. They are not part of this pass.

---

## 3. Big Guy changes

## 3.1 Big Guy design rule

Every Big Guy attack must answer this question:

> Which Megabonk weapon pattern is this a reskin of?

If the answer is unclear, do not build it.

The next pass has five allowed answers only:

1. **Arm Gun** = basic auto projectile pattern.
2. **Core Orbitals** = Chunkers pattern.
3. **Fire Trail** = Flamewalker pattern.
4. **Shield Shockwave** = Aegis pattern.
5. **Head Flame** = Dragon's Breath pattern.

## 3.2 Remove manual weapon firing as the default

Little Guy should **not** click to fire normal weapons.

Current prototype behavior to remove/deprecate:

- `fireArm` intent as the main weapon verb.
- L/R arm `FIRE` buttons in Little Guy UI.
- keyboard hotkeys `1` and `2` for manual arm firing.
- AI behavior that waits for charged arms and submits `fireArm`.

Replacement behavior:

- Weapons auto-fire when their linked system is powered, functional, and charged/available.
- Little Guy controls weapon output by managing power, manning, repairs, crew position, and system damage.
- Weapon charge bars may still exist, but they should display automatic charge/fire cycles, not invite constant manual clicking.

This follows the target fantasy: **Little Guy keeps the war machine alive; Big Guy receives continuous Megabonk-style weapon output.**

## 3.3 The five prototype weapons

### 3.3.1 Arm Gun

**Source pattern:** basic auto projectile, Revolver/Bow-like.

**Function:** auto-fires a simple projectile at the nearest valid enemy.

**Body source:** Arm system.

**Little Guy dependency:** Arm Gun room.

**Prototype behavior:**

- Fires automatically on cooldown while powered and functional.
- Targets nearest enemy in range.
- Uses clear projectile trails and hit pops.
- Manning the room improves cooldown or projectile damage.
- Damage to the Arm Gun room slows/stops the weapon.

**Important:** Big Guy should never feel completely weaponless. If the Arm Gun is unpowered/offline and no other body weapon is active, allow a weak emergency fallback shot. Treat this as the existing baseline auto-fire fail-safe, not as a sixth weapon. Do not show it as an upgrade or separate system.

### 3.3.2 Core Orbitals

**Source pattern:** Chunkers.

**Function:** scrap chunks orbit around Big Guy, damaging and knocking back enemies they contact.

**Body source:** Core system.

**Little Guy dependency:** Core Orbitals room/system.

**Prototype behavior:**

- When powered, render orbiting scrap chunks around the mech.
- Chunks orbit continuously around the mech.
- On contact, they damage and knock enemies away.
- Use per-enemy hit cooldowns so orbitals do not apply damage every frame.
- Manning improves number of chunks, orbit speed, damage, or uptime. Pick one for first pass; recommended: cooldown/damage only.
- Damaged Core Orbitals system reduces or disables orbitals.

**Do not add:** custom reactor explosions, overheat blasts, magnet pulls, or black-hole behavior.

### 3.3.3 Fire Trail

**Source pattern:** Flamewalker.

**Function:** Big Guy leaves damaging fire/trail patches while moving.

**Body source:** Legs system.

**Little Guy dependency:** Legs room/system.

**Prototype behavior:**

- While the Legs system is powered and Big Guy is moving, spawn short-lived fire patches behind/under the mech.
- Enemies standing on a patch take damage over time.
- Fire patches fade out clearly.
- Manning Legs improves trail spawn cadence or duration. Pick one for first pass; recommended: shorter spawn interval.
- Damaged Legs weaken or disable Fire Trail and also reduce speed/evasion.

**Do not add:** dash attack, stomp, knee ram, rocket boots, or other movement attack not copied from a Megabonk weapon.

### 3.3.4 Shield Shockwave

**Source pattern:** Aegis.

**Function:** shield blocks damage and emits a shockwave when it blocks.

**Body source:** Shields/chest system.

**Little Guy dependency:** Shields room/system.

**Prototype behavior:**

- Existing shield layers still absorb hits.
- When a shield layer blocks a hit, emit a visible radial shockwave from the mech.
- Shockwave damages and knocks back nearby enemies.
- Manning Shields improves shield recharge, as in FTL-like shield manning.
- Damaged Shields reduce layers and therefore reduce shockwave frequency.

**Do not add:** shield ram, recharge pulse, or custom thorns unless matching the intended Aegis source behavior.

### 3.3.5 Head Flame

**Source pattern:** Dragon's Breath.

**Function:** fires a cone of flame in the movement/facing direction.

**Body source:** Head system.

**Little Guy dependency:** Head room/system.

**Prototype behavior:**

- Auto-fires on cooldown while Head is powered and functional.
- Uses Big Guy's current facing/movement direction.
- Applies damage in a clear cone in front of the mech.
- Render a visible flame cone from the mech head/mouth.
- Manning Head improves cooldown or cone size. Pick one for first pass; recommended: cooldown.
- Damaged Head weakens or disables Head Flame.

**Do not add:** custom targeting modes, player-placed zones, or Little Guy aiming.

---

## 4. Big Guy readability and juice changes

## 4.1 Visual grammar rule

Every object on Big Guy's screen must immediately read as one of:

1. enemy;
2. pickup;
3. terrain/decor;
4. player/mech;
5. weapon effect;
6. crisis warning.

No category should be visually confusable with another.

## 4.2 Enemy readability

Keep the existing three enemy roles for now, but make each one visually and behaviorally distinct.

| Enemy | Role | Required read |
|---|---|---|
| Swarmer | weak horde food | small, numerous, soft, obvious enemy body, not the same color/shape as XP |
| Runner | fast pressure | lean/pointed/fast silhouette, visible forward motion, punishes straight lines |
| Bruiser | elite crisis source | large, slow, heavy, obvious warning that it can cause Little Guy emergencies |

Implementation notes:

- Avoid using green glowing enemies if XP is also green/glowing.
- Enemies should have simple creature traits: eyes, mouths, legs, spikes, wobble, squash, or directional movement cues.
- The Bruiser should telegraph interior consequences. When it is close to hitting, show a warning pulse and, if possible, highlight the room likely to be hit in the HUD.

## 4.3 Pickup readability

XP and salvage must read as rewards, not enemies.

Suggested prototype distinction:

- XP = small smooth glowing orb/gem, magnetic, clean.
- Salvage = spinning bolt/nut/gear/chunk of metal, clinky, angular but not creature-like.
- Pickups should have collection juice: magnet trail, pop, sound, number/flash.

## 4.4 Terrain/decor readability

Terrain/decor should be visually quiet.

- Use muted, low-saturation colors.
- Avoid bright enemy/pickup glow on decor.
- If terrain is non-collidable, it must look like background dressing.
- If terrain is collidable, it needs a unique silhouette and clear edge treatment.

## 4.5 Weapon feedback requirements

Each weapon needs a distinct effect:

| Weapon | Required on-screen read |
|---|---|
| Arm Gun | visible bullet/streak, clear impact pop |
| Core Orbitals | always-visible orbiting chunks around mech |
| Fire Trail | visible fire footprints/trail patches left behind movement |
| Shield Shockwave | bright expanding ring when shield blocks |
| Head Flame | cone burst from head/mouth in facing direction |

A new player should be able to describe what each weapon does after seeing it once.

---

## 5. Little Guy changes

## 5.1 Little Guy design rule

Every Little Guy system must answer this question:

> Which FTL ship-interior system or crisis is this a reskin of?

If the answer is unclear, do not build it.

Allowed FTL parallels for this pass:

| FTL concept | Scrapwalker reskin |
|---|---|
| Reactor | Reactor power pips |
| Weapons | body weapon systems/rooms |
| Shields | Shield/chest system |
| Engines | Legs system |
| Piloting | Head/control system |
| Oxygen | Air/Coolant system |
| Medbay | Medbay / Crew Bay |
| Doors | Bulkheads |
| Crew | named goblins |
| Fires | fires |
| Breaches | breaches |
| Boarders | intruders |
| System damage | room/system damage |
| Crew health | goblin health |
| Manning | goblin at console/station |
| Scrap economy | salvage |

## 5.2 Little Guy should be a place, not a menu

The Little Guy screen should read first as:

> the inside of a giant goblin mech.

It should not read first as:

> a dashboard of labeled rectangles.

### Required visual direction

- Rooms must look like rooms with floors, walls, machinery, doors, and floor slots.
- Goblins must look like small animated characters, not icons.
- Intruders must look like small hostile bodies in rooms, not red UI alerts.
- Fire, breach, and damage must be physical effects inside rooms.
- Power/charge/damage UI should overlay the rooms or sit in an FTL-style control strip, but the rooms themselves should remain the focus.

## 5.3 Goblins as FTL crew

Goblins need individual identity and health.

### Required state

Each goblin should have at least:

```js
{
  id,
  name,
  hp,
  maxHp,
  room,
  slot,
  dest,
  path,
  hopT,
  task,        // 'idle' | 'moving' | 'manning' | 'repairing' | 'firefighting' | 'welding' | 'fighting' | 'healing'
  animT,
  flashT
}
```

### Required animation states

Use simple prototype animations, but make behavior readable:

| Task | Visual read |
|---|---|
| idle | breathing/bobbing goblin |
| moving | walking/running legs, bobbing body |
| manning | standing at console/station, hands moving |
| repairing | wrench/welder motion, sparks |
| firefighting | extinguisher/foam/water motion at fire |
| welding breach | kneeling/leaning at breach with sparks |
| fighting intruder | swinging tool/weapon, impact flashes |
| healing | standing/lying in medbay with healing pulse |
| hurt | low HP bar, red flash, limping optional |

Do not represent a goblin only as a circle, dot, or icon.

## 5.4 Named crew

Starting goblins should have names. The prototype can keep a simple name list.

Examples:

- Grub
- Sprocket
- Nixie
- Bolt
- Wick
- Tansy
- Gizmo
- Pip

Display names and health in the crew roster/status area. The user should care that **Grub is hurt**, not merely that **crew unit 1 is low**.

## 5.5 Room occupancy slots

This is a hard requirement.

> Each Little Guy room has a fixed set of occupiable floor slots. Goblins and intruders occupy slots one-to-one. They cannot stack. If all slots in a room are full, no additional character can enter.

### Required behavior

- Every room defines a fixed slot layout.
- A goblin occupies exactly one slot when settled in a room.
- An intruder occupies exactly one slot.
- Movement into a room fails or waits if there is no free slot.
- A destination room can become available later; waiting/pathing should retry.
- Rendering uses actual slot positions, not `mates.indexOf(g)` as the only positioning rule.

### Suggested slot counts

| Room | Suggested slots | Notes |
|---|---:|---|
| Head | 2 | small control room |
| Arm Gun | 2 or 4 | weapon room; 2 is tenser, 4 is easier |
| Core Orbitals | 4 | machinery room |
| Reactor | 4 or 6 | largest central room |
| Shields | 4 | standard system room |
| Legs | 4 | engine/legs system room |
| Air/Coolant | 2 | life-support room |
| Medbay | 2 or 3 | FTL-like limited healing spots |
| Doors/Bulkheads | 2 | optional control room if represented as a room |

### Station slot

Each system room should have one station/console slot.

- Slot `0` may be the station slot.
- A goblin in the station slot mans the system if the room is safe.
- Only one goblin mans a system at a time.
- Additional goblins in the room help with repair/combat/firefighting but do not stack manning bonuses.

### Manning rule

A room is manned only if:

- a goblin is settled in that room;
- that goblin is in the station slot or has been assigned as the station operator;
- the room has no active fire, breach, intruder, or unrepaired system damage that consumes crew attention;
- the goblin is alive and not moving.

This follows the FTL feeling that a crew member at a system console improves that system.

## 5.6 Room/task priority

When a goblin is in a room, automatic task choice should copy FTL-style common sense.

Priority order:

1. Fight intruders.
2. Extinguish fire.
3. Seal breach.
4. Repair system damage.
5. Heal if in Medbay and wounded.
6. Man the system if safe and station available.
7. Idle.

Do not require separate buttons for repair/firefighting/fighting. FTL's magic is that crew go to a room and do the obvious job.

## 5.7 Fires

Fires should remain literal room-local fires.

Required behavior:

- Fire damages crew in the room.
- Fire damages the room/system over time.
- Goblins in the room extinguish fire.
- Fire can spread to connected rooms, preferably through open doors/bulkheads.
- Closed bulkheads should slow or block fire spread.

Required visual:

- animated flames inside the room;
- smoke/heat overlay;
- goblin firefighting animation;
- room warning.

Do not replace this with an abstract heat meter.

## 5.8 Breaches

Breaches should remain literal room-local hull ruptures.

Required behavior:

- Breach causes air/coolant loss in the room.
- Breach prevents normal operation/repair priority until sealed.
- Goblins seal breaches over time by standing in the room.
- Breach sealing uses welding/patching animation.

Required visual:

- black/blue rupture hole;
- airflow/coolant vapor effect;
- weld progress ring/bar;
- sparks when a goblin is sealing it.

Do not create custom breach-combat mechanics. Goblins can hold tools visually, but mechanically they repair breaches like FTL crew.

## 5.9 Intruders/boarders

Intruders should remain literal bodies inside rooms.

Required behavior:

- Intruder occupies a room slot.
- Goblins and intruders fight when in the same room.
- Intruders damage crew and/or systems.
- If no crew are present, intruders sabotage the room.
- Doors/bulkheads should slow intruder movement once intruder movement is implemented.

Required visual:

- intruder character sprite/creature, not just an icon;
- attack animation;
- HP bar;
- hit flashes;
- goblin fighting animation.

## 5.10 Medbay

Rename current `Repair Bay` behavior to clarify its FTL role.

Recommended user-facing name: **Medbay** or **Crew Bay**.

Required behavior:

- Powered Medbay heals goblins standing in its slots.
- Upgrade/tier improves healing speed.
- Goblins repair systems by going to the damaged system room, not by standing in Medbay.

Do not use Medbay as a generic system-repair station.

## 5.11 Air/Coolant system

Add an FTL Oxygen equivalent.

Recommended user-facing name: **Air** for clarity, or **Coolant** if the visual language strongly supports it. The behavior should copy FTL Oxygen more than a custom heat system.

Required behavior:

- Each room has an `air` or `coolant` level, 0..1.
- Powered Air/Coolant system restores room air/coolant over time.
- Breaches drain room air/coolant.
- Open doors/bulkheads allow air/coolant to equalize between rooms.
- Goblins in unsafe rooms take damage over time.
- Low-air rooms should tint/stripe visually.

Do not invent a separate mech heat economy in this pass.

## 5.12 Doors/Bulkheads

Add FTL-style doors/bulkheads.

Required behavior:

- Doors exist between connected rooms.
- Doors can be open or closed.
- Closed doors slow intruders and slow/block fire and air spread.
- A damaged Doors/Bulkheads system can reduce control or force doors open; optional for first pass if time is tight, but the door state itself should exist.

Required controls:

- Click a door segment to toggle open/closed.
- Do not use an abstract containment button.

---

## 6. Little Guy UI/control changes

## 6.1 Control rule

If FTL already solved the interaction, use that interaction pattern.

Current custom behavior to replace:

- plus/minus power buttons floating inside each room;
- room boxes as UI panels;
- manual FIRE buttons;
- Little Guy screen reading as a menu/dashboard.

Replacement:

- Ship/mech cutaway is the primary visual.
- Bottom/side FTL-style system control strip handles power/status.
- Crew are selected and ordered like FTL crew.
- Doors are clicked directly in the map.
- Weapon charge/status is shown in weapon/system boxes, but normal weapons auto-fire.

## 6.2 Crew controls

Minimum control set:

- Click goblin to select.
- Click room to send selected goblin there.
- Optional: drag-select multiple goblins.
- Optional: double-click a goblin to select all goblins in that room.
- No separate repair/fire/fight buttons.

When selected goblin is ordered to a full room:

- If no slot is free, show blocked feedback and either keep the order queued or reject it.
- Recommended for first pass: keep the destination queued and have the goblin wait/retry at the doorway/current room.

## 6.3 Power controls

Implement FTL-style power controls in a system strip.

Recommended behavior:

- Each system has a control box with power bars/pips.
- Left-click a power bar/box adds power if reactor pips are available.
- Right-click removes power.
- Prevent browser context menu on right-click inside the game canvas.
- Damaged power slots are red/broken and cannot be powered.
- Show reactor pips used/free clearly.

Do not keep `+` and `-` buttons inside room art as the primary interaction.

## 6.4 Weapon controls

Normal weapons should not have FIRE buttons.

Required UI:

- Show charge/cooldown/progress bars for auto weapons.
- Show whether each weapon is powered, charging, active, blocked by damage, or unmanned.
- Label as `AUTO` or use a small auto-fire indicator.
- No `FIRE` button for Arm Gun or Head Flame.
- Core Orbitals and Fire Trail can show `ACTIVE` when powered.
- Shield Shockwave can show shield layers and recharge.

## 6.5 Room rendering hierarchy

Visual hierarchy should be:

1. rooms/interior;
2. crew/intruders/crises;
3. system machinery;
4. subtle overlays for power/damage/charge;
5. bottom/side control UI.

Do not let UI overlays make the room stop feeling like a place.

---

## 7. Suggested revised room layout

The exact layout can be adjusted for readability, but it should be a mech-shaped FTL-style cutaway with real rooms and doors.

Suggested next-version layout:

```text
                 [ HEAD ]
        [ ARM GUN ] [ REACTOR ] [ CORE ORBITALS ]
        [ SHIELDS ] [ AIR ]     [ MEDBAY ]
                 [ LEGS ]
```

Optional if space permits:

```text
                 [ HEAD ]
        [ ARM GUN ] [ REACTOR ] [ CORE ORBITALS ]
        [ SHIELDS ] [ AIR ]     [ MEDBAY ]
                 [ LEGS ]
              [ BULKHEADS ]
```

Implementation recommendation:

- Replace `lArm`/`rArm` with one user-facing **Arm Gun** weapon room for this pass.
- Replace `lLeg`/`rLeg` with one user-facing **Legs** room for this pass.
- Add **Head**, **Core Orbitals**, **Air/Coolant**, and **Medbay**.
- Keep **Reactor** as power source.
- Keep **Shields** as shield system.
- Add doors between connected rooms.

Do not preserve two arms/two legs merely because the current code has them. FTL-like readability is more important than symmetry here.

---

## 8. Code implementation plan

The current project structure appears to be:

```text
scrapwalker/
├── index.html
└── js/
    ├── main.js
    ├── state.js
    ├── sim.js
    ├── ai.js
    ├── bigRender.js
    ├── littleRender.js
    ├── hud.js
    └── audio.js
```

Preserve the existing architecture rule:

- `state.js` owns the plain state object and intent queue.
- `sim.js` applies intents and advances the fixed-tick simulation.
- renderers only read state.
- inputs submit intents.
- AI submits the same intents as humans.

Do not break sim/render/input separation.

## 8.1 state.js changes

### Replace current room definitions

Current rooms include `lArm`, `rArm`, `lLeg`, `rLeg`, and `repair`. Replace with clearer body/system room ids.

Suggested ids:

```js
const ROOM_DEFS = {
  head: {
    name: 'HEAD',
    sys: 'head',
    need: 1,
    tier: 1,
    slots: 2,
    station: 0,
    neighbors: ['armGun', 'reactor']
  },
  armGun: {
    name: 'ARM GUN',
    sys: 'weapon',
    weapon: 'armGun',
    need: 1,
    tier: 1,
    slots: 2,
    station: 0,
    neighbors: ['head', 'reactor', 'shields']
  },
  reactor: {
    name: 'REACTOR',
    sys: 'reactor',
    need: 0,
    tier: 0,
    slots: 4,
    station: null,
    neighbors: ['head', 'armGun', 'coreOrbitals', 'air', 'shields']
  },
  coreOrbitals: {
    name: 'CORE ORBITALS',
    sys: 'weapon',
    weapon: 'coreOrbitals',
    need: 1,
    tier: 1,
    slots: 4,
    station: 0,
    neighbors: ['reactor', 'legs']
  },
  shields: {
    name: 'SHIELDS',
    sys: 'shield',
    weapon: 'shieldShockwave',
    need: 1,
    tier: 1,
    slots: 4,
    station: 0,
    neighbors: ['armGun', 'reactor', 'air', 'legs']
  },
  air: {
    name: 'AIR',
    sys: 'air',
    need: 1,
    tier: 1,
    slots: 2,
    station: 0,
    neighbors: ['reactor', 'shields', 'medbay']
  },
  medbay: {
    name: 'MEDBAY',
    sys: 'medbay',
    need: 1,
    tier: 1,
    slots: 2,
    station: null,
    neighbors: ['air', 'coreOrbitals']
  },
  legs: {
    name: 'LEGS',
    sys: 'leg',
    weapon: 'fireTrail',
    need: 1,
    tier: 1,
    slots: 4,
    station: 0,
    neighbors: ['shields', 'coreOrbitals']
  }
};
```

Adjust layout if needed, but keep the user-facing room names simple and functional.

### Add weapon definitions

Replace `ARM_STATS` with a more general `WEAPON_DEFS`.

```js
const WEAPON_DEFS = {
  armGun: {
    name: 'ARM GUN',
    source: 'basic projectile',
    room: 'armGun',
    pattern: 'projectile',
    cooldown: 0.42,
    damage: 9,
    range: 28,
    projectileSpeed: 62
  },
  coreOrbitals: {
    name: 'CORE ORBITALS',
    source: 'Chunkers',
    room: 'coreOrbitals',
    pattern: 'orbital',
    count: 2,
    damage: 10,
    radius: 5.5,
    knockback: 8,
    hitCooldown: 0.35
  },
  fireTrail: {
    name: 'FIRE TRAIL',
    source: 'Flamewalker',
    room: 'legs',
    pattern: 'trail',
    spawnEvery: 0.18,
    damagePerSecond: 12,
    radius: 2.2,
    life: 2.2
  },
  shieldShockwave: {
    name: 'SHIELD SHOCKWAVE',
    source: 'Aegis',
    room: 'shields',
    pattern: 'shieldShockwave',
    damage: 18,
    radius: 8,
    knockback: 14
  },
  headFlame: {
    name: 'HEAD FLAME',
    source: "Dragon's Breath",
    room: 'head',
    pattern: 'cone',
    cooldown: 2.1,
    damage: 24,
    range: 15,
    angle: 0.75
  }
};
```

### Add room slot state

Rooms need fixed slots. At minimum:

```js
rooms[id] = {
  id,
  name,
  sys,
  weapon,
  neighbors,
  tier,
  need,
  power,
  damage,
  fire,
  breach,
  weld,
  air: 1,
  slots: makeSlots(d.slots),
  station: d.station,
  intruders: [],
  doors: {},
  offlineFlash: 0
};
```

Slots can be simple indices in state; pixel positions can live in `littleRender.js`.

### Update goblin state

Add `slot`, `task`, and animation timers:

```js
function makeGoblin(room, slot) {
  return {
    id,
    name,
    hp,
    maxHp,
    room,
    slot,
    dest: room,
    path: [],
    hopT: 0,
    hopFrom: room,
    task: 'idle',
    animT: 0,
    flashT: 0
  };
}
```

Starting crew recommendation:

- one in Arm Gun station;
- one in Shields station;
- one in Legs station or Air station.

Assign each a valid slot.

### Add helpers

Required helpers:

```js
function occupantsIn(s, roomId) // goblins settled + intruders
function freeSlots(s, roomId)
function firstFreeSlot(s, roomId)
function roomHasFreeSlot(s, roomId)
function assignSlot(s, entity, roomId)
function roomManned(s, roomId)
function systemActive(s, roomId)
function weaponActive(s, weaponId)
```

`roomManned` should use station logic, not just `some goblin in room`.

## 8.2 sim.js changes

### Remove/deprecate manual fire intent

Remove `fireArm` from normal gameplay.

- Delete or ignore `case 'fireArm'`.
- Remove `fireArm(s, id)` as the default arm weapon system.
- Replace arm charging loop with generalized weapon ticking.

### Add generalized weapon ticking

Add a `tickWeapons(s, dt)` called from `tickBig` or after interior dependencies are updated.

Pseudo-code:

```js
function tickWeapons(s, dt) {
  tickArmGun(s, dt);
  tickCoreOrbitals(s, dt);
  tickFireTrail(s, dt);
  // shield shockwave is triggered by shield block in mechHit
  tickHeadFlame(s, dt);
}
```

#### Active check

```js
function weaponIsActive(s, weaponId) {
  const def = G.WEAPON_DEFS[weaponId];
  const room = s.rooms[def.room];
  if (!room) return false;
  if (G.roomEffPower(room) < room.need) return false;
  if (G.roomCap(room) <= 0) return false;
  if (room.damage >= room.tier) return false;
  if (room.fire > 0 || room.breach || room.intruders.length) return false;
  return true;
}
```

This is intentionally FTL-like: power, damage, and room crises affect system output.

#### Manning bonus

Use one consistent first-pass rule:

```js
const manned = G.roomManned(s, roomId);
const cooldownMult = manned ? 0.75 : 1.0;
```

Do not add multiple stacking bonuses from multiple goblins.

### Implement Arm Gun

Reuse existing bolt projectile code, but tie it to `WEAPON_DEFS.armGun` and `weaponIsActive(s, 'armGun')`.

- Existing `s.bolts` pool is fine.
- Existing nearest-target logic is fine.
- Use room manning to reduce cooldown.
- If no weapons are active, allow the weak fallback shot only to preserve Big Guy baseline fun.

### Implement Core Orbitals

Add state:

```js
s.weapons.coreOrbitals = {
  angle: 0,
  hitT: {} // optional per enemy id/counter if enemies have stable ids
};
```

Simpler implementation without stable enemy ids:

- Add `e.orbitalHitT` to enemy objects.
- Decrement each enemy's `orbitalHitT` each tick.
- For each active orbital position, check distance to each enemy.
- If collision and `e.orbitalHitT <= 0`, damage and knockback enemy, then set `e.orbitalHitT = hitCooldown`.

Pseudo-code:

```js
function tickCoreOrbitals(s, dt) {
  if (!weaponIsActive(s, 'coreOrbitals')) return;
  const def = G.WEAPON_DEFS.coreOrbitals;
  const count = def.count; // first pass: fixed 2
  s.weapons.coreOrbitals.angle += dt * 2.8;

  for each orbital i:
    ox = s.big.x + cos(angle + i * TAU / count) * def.radius;
    oz = s.big.z + sin(angle + i * TAU / count) * def.radius;
    for each enemy:
      if distance enemy/orbital < enemy.r + 0.8 and enemy.orbitalHitT <= 0:
        hurtEnemy(s, enemy, def.damage);
        knock enemy away from mech/orbital;
        enemy.orbitalHitT = def.hitCooldown;
}
```

Render orbitals in `bigRender.js` from state/time, not as authoritative objects.

### Implement Fire Trail

Add state:

```js
s.fireTrailT = 0;
s.trails = []; // pooled if needed: {x,z,r,life,maxLife,dps}
```

Behavior:

- If Legs/Fire Trail active and Big Guy is moving, spawn a trail patch every `spawnEvery` seconds.
- Trail patches damage enemies inside radius.
- Trail patches expire after `life`.

Use object pooling if many patches exist.

### Implement Shield Shockwave

Modify `mechHit(s, e)` shield block branch.

Current behavior removes a shield layer and returns. Add:

```js
if (shield blocked and weaponIsActive(s, 'shieldShockwave')) {
  doShockwave(s, s.big.x, s.big.z, def.radius, def.damage, def.knockback);
  s.fx.push({ type: 'shieldShockwave', x: s.big.x, z: s.big.z, radius: def.radius, age: 0 });
}
```

Do not trigger on recharge for now.

### Implement Head Flame

Add state:

```js
s.weapons.headFlame = { cd: 0 };
```

Behavior:

- Cooldown ticks down only while active.
- On fire, damage enemies in cone in facing direction.
- Push FX event for cone render.

Pseudo-code:

```js
function tickHeadFlame(s, dt) {
  if (!weaponIsActive(s, 'headFlame')) return;
  const def = G.WEAPON_DEFS.headFlame;
  const room = s.rooms[def.room];
  const mult = G.roomManned(s, def.room) ? 0.75 : 1;
  const w = s.weapons.headFlame;
  w.cd -= dt;
  if (w.cd > 0) return;
  w.cd = def.cooldown * mult;

  for each enemy:
    dx = enemy.x - b.x; dz = enemy.z - b.z;
    if distance <= def.range and angle to facing <= def.angle:
      hurtEnemy(s, enemy, def.damage);
  s.fx.push({type:'headFlame', x:b.x, z:b.z, fx:b.fx, fz:b.fz, range:def.range, angle:def.angle, age:0});
}
```

### Implement room capacity

Update movement arrival code.

Current movement lets goblins enter any room and rendering chooses a visual slot by index. Replace with slot enforcement.

Pseudo-code:

```js
function tryAdvanceGoblin(s, g, dt) {
  if (!g.path.length) return;
  const next = g.path[0];
  g.hopT += dt / C.GOBLIN_HOP;
  if (g.hopT < 1) return;

  const slot = G.firstFreeSlot(s, next);
  if (slot == null) {
    // room full: wait and retry
    g.hopT = 0;
    g.task = 'waiting';
    return;
  }

  g.room = next;
  g.slot = slot;
  g.path.shift();
  g.hopT = 0;
  g.task = g.path.length ? 'moving' : 'idle';
}
```

If room has station and station slot is free and room is safe, prefer station slot for the first goblin entering.

### Implement automatic task assignment

In `tickInterior`, set `g.task` per room priority.

Pseudo-code:

```js
for each room:
  crew = goblinsIn(room)
  if intruders: crew task='fighting'; resolve combat
  else if fire: crew task='firefighting'; resolve fire
  else if breach: crew task='welding'; resolve breach
  else if damage: crew task='repairing'; resolve system repair
  else if room.sys === 'medbay' and wounded: task='healing'; heal
  else if station goblin present: station goblin task='manning'; others idle
```

### Add Air/Coolant simulation

First-pass simplification:

- Each room has `air` from 0..1.
- If room has breach, air drains.
- If Air system is active, rooms trend upward slowly.
- Open doors allow simple equalization between neighbors.
- Closed doors reduce equalization.
- Goblins take damage if `room.air < 0.25`.

Pseudo-code:

```js
function tickAir(s, dt) {
  const airActive = systemActive(s, 'air');
  for each room:
    if room.breach: room.air -= 0.18 * dt;
    else if airActive: room.air += 0.05 * dt;
    clamp 0..1

  for each door between rooms:
    if door.open:
      equalize a fraction of air between rooms

  for each goblin:
    if s.rooms[g.room].air < 0.25:
      g.hp -= suffocationDps * dt;
}
```

Do not overbuild this. It just needs to create the FTL oxygen feel.

### Add doors/bulkheads

Add door state for each neighbor pair.

```js
s.doors = {
  'head-reactor': { open: true, hp: 1 },
  ...
};
```

Intent:

```js
{ t: 'door', key: 'head-reactor' }
```

`applyIntent` toggles door open/closed.

Use doors for:

- rendering;
- fire spread chance;
- air equalization;
- later intruder movement/pathing.

### Update damage/crisis mapping

Update `ROOM_IDS` to new room ids.

Bruiser hits should still be the main source of major Little Guy crises.

When Big Guy takes a hard hit:

- choose a room;
- apply system damage;
- roll for fire/breach/intruder;
- make it visible on both screens.

If possible, telegraph a Bruiser hit before it lands and highlight the target room.

## 8.3 littleRender.js changes

This file should be treated as a substantial rewrite.

### Replace menu-box rooms with room art

Keep Canvas 2D if desired, but draw rooms as spaces:

- floor panels;
- thick walls;
- doors/bulkheads on edges;
- system machinery inside room;
- station/console slot;
- floor slots;
- small details by room type.

### Define room layout separately from state

Example:

```js
const ROOM_LAYOUT = {
  head: { rect:[250, 40, 120, 90], slots:[[40,58],[80,58]], station:0 },
  armGun: { rect:[70, 150, 150, 110], slots:[[35,78],[95,78]], station:0 },
  reactor: { rect:[250,150,150,110], slots:[[35,70],[75,70],[115,70],[75,35]], station:null },
  coreOrbitals: { rect:[430,150,150,110], slots:[[35,78],[75,78],[115,78],[75,42]], station:0 },
  shields: { rect:[70,285,150,110], slots:[[35,78],[75,78],[115,78],[75,42]], station:0 },
  air: { rect:[250,285,150,110], slots:[[45,75],[105,75]], station:0 },
  medbay: { rect:[430,285,150,110], slots:[[45,75],[105,75]], station:null },
  legs: { rect:[250,420,150,110], slots:[[35,78],[75,78],[115,78],[75,42]], station:0 }
};
```

These pixel slots are render positions only. State owns occupancy by slot index.

### Draw slot markers subtly

Slots should be visible enough to explain capacity, but not feel like UI dots.

- draw small floor pads/shadows;
- occupied slots show goblin/intruder;
- full room should visually read as full.

### Draw goblins as animated characters

Replace circle body with a slightly more characterful sprite drawn from primitives:

- head/body separation;
- ears;
- arms/tools;
- legs/walk cycle;
- different poses by task;
- name/HP on hover/selection or roster.

This can still be procedural Canvas art. It does not require external sprites.

### Draw intruders as characters

Intruders need room-slot positions too.

- draw as hostile alien blobs/creatures;
- attack animation;
- HP bar;
- slot occupancy.

### Draw FTL-style control strip

Add a bottom or side system control strip.

Each system box should show:

- system name;
- power pips;
- damaged pips;
- manning indicator;
- charge/active status where relevant;
- click/right-click power controls.

Remove room-embedded `+` and `-` buttons.

### Remove FIRE buttons

No normal weapon should draw a FIRE button.

Replace with:

- `AUTO` label;
- charging bar for Arm Gun/Head Flame;
- `ACTIVE` status for Core Orbitals/Fire Trail;
- shield layer/recharge display for Shield Shockwave.

### Door click regions

Draw clickable doors between room rects.

- open door = lit/open passage;
- closed door = metal bulkhead;
- click toggles state via `{t:'door', key}`.

## 8.4 bigRender.js changes

### Improve enemy silhouettes

Replace or improve current instanced geometries.

Current issue: basic low-poly shapes read too similarly to pickups/decor.

Recommended simple shapes:

- Swarmer: small bug/blob with tiny eyes/antennae or pulsing body.
- Runner: pointed wedge/creature leaning toward movement direction.
- Bruiser: large bulky armored creature with warning glow and heavy stomp/bob.

Still use instanced meshes for performance.

### Improve pickups

- XP should not share enemy colors.
- Salvage should look metallic/mechanical.
- Add collection burst FX.

### Render the five weapon effects

Add render support for:

- orbiting chunks around mech;
- fire trail patches;
- shield shockwave FX;
- head flame cone;
- improved arm gun projectiles.

Recommended state/FX coupling:

- Continuous effects like orbitals can be rendered from `weaponIsActive` state and `s.t`.
- Discrete effects like head flame and shield shockwave should be rendered from `s.fx` events.
- Trail patches should be state objects because they damage enemies over time.

## 8.5 hud.js changes

Update mini HUDs to match new rooms/weapons.

Big Guy's mini interior should show:

- room grid;
- power state;
- crew positions;
- fires/breaches/intruders;
- weapon active/disabled states;
- shield layers;
- room targeted by incoming elite hit if implemented.

Little Guy's mini arena should show:

- Big Guy position;
- horde density;
- Bruisers/crisis-causing enemies emphasized;
- HP/shield state;
- active weapon effects maybe as small icons.

## 8.6 ai.js changes

Remove AI manual firing.

AI Little Guy should focus on FTL tasks:

1. Keep at least one weapon powered.
2. Keep Shields and Legs powered if possible.
3. Send wounded goblins to Medbay if safe.
4. Send nearest available goblin to intruder/fire/breach/damage.
5. Respect room capacity; do not send goblins to full rooms unless queuing/waiting is supported.
6. Man high-value systems when no crises exist.
7. Maintain Air system when rooms are unsafe.
8. Spend salvage on reactor pips, crew, and system upgrades.

AI Big Guy can remain simple kite behavior.

## 8.7 main.js changes

Remove Little Guy weapon hotkeys:

```js
if (s.humanSide === 'little') {
  if (e.code === 'Digit1') ...
  if (e.code === 'Digit2') ...
}
```

Add:

- right-click prevention for Little Guy canvas if right-click depowers systems;
- maybe keyboard shortcuts for selecting crew later, but not required.

Keep Tab hot-swap.

## 8.8 audio.js changes

Add/assign distinct cues:

- Arm Gun shot;
- Core Orbital hit;
- Fire Trail burn tick/ignite;
- Shield Shockwave;
- Head Flame burst;
- goblin repair;
- goblin firefighting;
- breach welding;
- intruder fight;
- door toggle;
- low air warning.

Small procedural tones are fine. The goal is readability and juice, not final audio polish.

---

## 9. Tuning starting values

Use simple values first. Tune after the pass is playable.

### 9.1 Reactor/power

- Reactor starts with 4 pips.
- Not enough to power all systems.
- Starting powered systems recommendation:
  - Arm Gun: 1 pip;
  - Shields: 1 pip;
  - Legs: 1 pip;
  - Air or Core Orbitals: 1 pip.

This forces an immediate FTL-like allocation decision.

### 9.2 Weapons

Initial rough values:

| Weapon | Value |
|---|---|
| Arm Gun cooldown | 0.42s base; 0.32s manned |
| Arm Gun damage | 9 |
| Core Orbitals | 2 chunks, 10 damage, 0.35s per-enemy hit cooldown |
| Fire Trail | patch every 0.18s while moving, 2.2s life, 12 DPS |
| Shield Shockwave | 18 damage, radius 8, knockback 14 on shield block |
| Head Flame | 2.1s cooldown, range 15, cone angle ~0.75 rad, 24 damage |

### 9.3 Crew

- Start with 3 goblins.
- Goblin HP: 30.
- Intruder HP: 30.
- Goblin combat DPS: around 7 per goblin.
- Intruder attack: around 6 damage per second or attack cycle equivalent.
- Medbay healing: around 8 HP/s at tier 1.

### 9.4 Room capacity

- Small rooms: 2 slots.
- Standard rooms: 4 slots.
- Reactor: 4-6 slots.
- Medbay: 2 slots for first pass.

---

## 10. Acceptance criteria

The next version is successful only if these are true.

## 10.1 Big Guy acceptance criteria

- A new player can identify enemies, pickups, terrain, and weapon effects within one second.
- Swarmer, Runner, and Bruiser have distinct silhouettes and gameplay roles.
- XP and salvage cannot be mistaken for enemies.
- All five prototype weapon patterns are visible and understandable:
  - Arm Gun;
  - Core Orbitals;
  - Fire Trail;
  - Shield Shockwave;
  - Head Flame.
- No extra Big Guy weapon patterns are added.
- No manual weapon firing is required for normal weapons.
- Big Guy feels more like a Megabonk-style auto-attacking survivor game.

## 10.2 Little Guy acceptance criteria

- The Little Guy screen reads as a mech interior, not a menu.
- Rooms look like rooms with machinery, floors, walls, doors, and slots.
- Goblins look like characters and animate by task.
- Goblins have names and health.
- Room occupancy slots are enforced; characters do not stack.
- A full room blocks or queues additional entrants.
- Fires, breaches, and intruders are physical room events.
- Medbay heals crew in its slots.
- Air/Coolant/Oxygen equivalent exists and affects room safety.
- Doors/bulkheads can be clicked and affect air/fire/containment.
- System power controls are FTL-style, not custom plus/minus buttons inside room art.
- Weapons auto-fire based on power/charge/state.
- Little Guy feels like FTL ship management reskinned as a mech interior.

## 10.3 Architecture acceptance criteria

- Fixed tick simulation remains authoritative.
- Rendering does not mutate state.
- Human input and AI input both go through intents.
- State remains plain serializable JS data.
- No netcode is added in this pass.
- The game still runs as static browser files.

---

## 11. Manual QA checklist

Run these tests before calling the pass complete.

### Big Guy tests

1. Start a run as Big Guy.
2. Confirm Arm Gun auto-fires without pressing a fire button.
3. Power Core Orbitals as Little Guy or AI; confirm orbiting chunks appear and damage/knock enemies.
4. Power Legs; move; confirm Fire Trail appears only while moving.
5. Let a shield block a hit; confirm Shield Shockwave fires.
6. Power Head; confirm Head Flame fires in facing direction on cooldown.
7. Confirm no extra weapon patterns appear.
8. Confirm pickups and enemies are visually distinct.
9. Confirm Bruiser reads as the crisis-causing elite.

### Little Guy tests

1. Select a goblin and send it to a room.
2. Confirm the goblin walks to a specific slot.
3. Fill a 2-slot room and try to send a third character there.
4. Confirm the third character does not stack on top of others.
5. Spawn or wait for fire; confirm goblin changes to firefighting behavior.
6. Spawn or wait for breach; confirm goblin changes to welding behavior.
7. Spawn or wait for intruder; confirm goblins and intruders fight as bodies in the room.
8. Injure a goblin and send to Medbay; confirm healing.
9. Create a breach/low-air state; confirm air/coolant warning and crew damage.
10. Toggle a door/bulkhead; confirm visual open/closed state and effect on air/fire spread.
11. Confirm power controls are in the system strip and not plus/minus buttons embedded in rooms.
12. Confirm no normal weapon has a FIRE button.

### Hot-swap/AI tests

1. Start as Big Guy with AI Little Guy.
2. Confirm AI powers systems and handles crises.
3. Hot-swap to Little Guy.
4. Confirm AI Big Guy keeps moving/kiting.
5. Confirm Little Guy can manage rooms manually.
6. Hot-swap back; confirm state continuity.

---

## 12. One-shot implementation instruction

When applying this spec, prioritize in this order:

1. **Refactor state schema** for new rooms, weapons, goblin slots, air, and doors.
2. **Remove manual firing** and implement auto weapon ticking.
3. **Implement the five allowed Big Guy weapon patterns only.**
4. **Enforce room occupancy slots.**
5. **Rewrite Little Guy visuals/controls toward FTL-style room management.**
6. **Improve Big Guy readability and weapon FX.**
7. **Update AI to use FTL priorities and no manual firing.**
8. **Update HUD/audio for clarity.**
9. **Run the QA checklist.**

Do not spend time adding new content beyond this scope. The goal is not more systems; the goal is to make the two existing halves read correctly:

> **Big Guy = Megabonk reskinned as a giant goblin mech.**
>
> **Little Guy = FTL reskinned as the inside of that mech.**
>
> **SCRAPWALKER = the wiring between them.**
