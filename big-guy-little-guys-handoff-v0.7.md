# Big Guy Little Guys — Project Handoff GDD / Technical Source of Truth v0.7

**Project:** Big Guy Little Guys  
**Current handoff date:** 2026-05-18  
**Current playable reference:** `big-guy-little-guys-shared-v0.7.html`  
**Purpose:** Current game-design and technical source of truth for continuing the project from the stable multiplayer build.

---

# 0. Current Project State

Big Guy Little Guys is now a single-file browser prototype with:

- one shared simulation state
- Big Guy arena combat
- Little Guys body-management gameplay
- solo play with inactive-side AI
- browser-to-browser multiplayer through GitHub Pages using PIN host/join flow
- role selection with coin flip if both players choose the same role
- paused shared MOD upgrade voting
- host-authoritative online simulation

The current stable build is:

```text
big-guy-little-guys-shared-v0.7.html
```

This file supersedes the earlier split-prototype handoff that referenced separate Big Guy and Little Guys HTML files.

---

# 1. High Concept

**Big Guy Little Guys** is an asymmetric co-op game about one giant fighter and the tiny workers inside his body.

Two players interact with the same living machine/body from different roles:

```text
Big Guy player:
  live arena combat

Little Guys player:
  internal body management, repair, power routing, and upgrade decisions
```

The body is not a menu and the arena is not a separate game. They are two views into one shared simulation.

---

# 2. Core Design Pillar

The game must always use **one shared simulation state**.

```text
shared simulation state
├─ Big Guy view reads it and exposes combat controls
└─ Little Guys view reads it and exposes body-management controls
```

Examples:

```text
Shared truth:
  rangedArm.hp = 42
  rangedArm.allocatedPower = 2
  rangedArm.mods.spreadBarrel.stats.amount = 1
  Bix is repairing rangedArm

Big Guy sees:
  ranged arm flickering
  shots weakened if the system is damaged
  Spread Barrel behavior when online

Little Guys sees:
  Ranged Arm room damaged
  Bix repairing
  power pips and MOD chips
```

No game-facing result should exist outside shared state.

---

# 3. Canonical Body Systems

The body has five gameplay systems:

```text
heart
meleeArm
reactor
rangedArm
legs
```

Display names:

```text
Heart
Melee Arm
Reactor
Ranged Arm
Legs
```

Do not use `leftArm` / `rightArm` in new gameplay design. Use `meleeArm` and `rangedArm`.

Do not reintroduce Head as a gameplay system. A visual head/face is allowed as art only.

Each body system has:

```js
{
  id,
  hp,
  maxHp,
  allocatedPower,
  modSlots,
  mods,
  charge
}
```

Current MOD slots:

```text
2 MOD slots per body system
```

---

# 4. Body Power Model

Little Guys allocate power to body systems.

Each system derives:

```text
usableCap
crewBonus
effectivePower
```

## Usable Cap

System HP limits usable power.

Current intended rule:

```text
if hp <= 0: usableCap = 0
else if hp <= 33%: usableCap = 1
else if hp <= 66%: usableCap = 2
else usableCap = 3
```

Allocated power above the damaged cap does not fully apply.

## Crew Bonus

A stationed Little Guy can provide:

```text
+1 effective power
```

A crew bonus only counts if the worker is actually stationed and able to work.

## Effective Power

```text
effectivePower = min(usableCap, allocatedPower + crewBonus)
```

Effective power drives Big Guy combat outputs and body behavior.

---

# 5. Base Body Functions and Destroyed Fallbacks

Each body part has a built-in base function. The Big Guy does not start with MODs.

MOD slots start empty.

## Ranged Arm

Healthy base:

```text
basic single shot
```

Destroyed fallback:

```text
weak emergency sputter shot or severely weakened ranged output
Ranged Arm MODs offline
```

## Melee Arm

Healthy base:

```text
basic melee swing
```

Destroyed fallback:

```text
tiny emergency shove/panic slap
Melee Arm MODs offline
```

## Legs

Healthy base:

```text
movement and dash
```

Destroyed fallback:

```text
slow crawl / weak movement
Legs MODs offline
```

## Heart

Healthy base:

```text
max HP, basic survival support, limited regen
```

Destroyed fallback:

```text
no Heart MOD support
no instant death solely because Heart system is destroyed
```

## Reactor

Healthy base:

```text
stamina, stamina regen, body power economy
```

Destroyed fallback:

```text
weak stamina/power support
Reactor MODs offline
```

---

# 6. Big Guy Role

The Big Guy player controls a single fighter in a live arena.

Current feel target:

```text
Brotato / Vampire Survivors / Megabonk-like arena survival action
```

Core controls:

```text
WASD        move
Mouse       aim
Click       ranged attack
Space       melee attack
Shift/RMB   dash
```

The Big Guy should feel:

- pressure from waves
- immediate feedback from body damage
- changed attack/movement/survival behavior from MODs
- support or failure from Little Guys power/repair choices

Big Guy view should not expose full Little Guys management complexity, but it must show enough body status to avoid feeling blind.

Current Big Guy readability tools:

- larger body minimap
- MOD/status strip
- composite body character drawn from body parts
- body part color/damage/power cues
- boss health/readout when relevant

---

# 7. Little Guys Role

The Little Guys player manages workers inside the Big Guy’s body.

Current feel target:

```text
FTL-style internal body/ship management
```

The Little Guys player:

- routes power
- moves workers
- repairs damaged systems
- stations workers for bonuses
- responds to combat damage
- participates in upgrade voting
- keeps Big Guy’s MOD-bearing systems online

Current workers:

```text
Bix
Milo
```

Workers can:

```text
move
station
repair
be stunned/hurt
```

Little Guys should not feel like a menu. The internal body should remain spatial and active.

---

# 8. MOD Upgrade System

The old item/inventory/equipment-slot model has been removed.

The current system is **permanent MOD growth**.

## Core Rules

```text
Each body system starts with 2 empty MOD slots.
Each body system has a base function.
A new MOD unlocks a new behavior.
Choosing an already-owned MOD upgrades one stat aspect of that MOD.
MODs stack and get weirder/stronger over time.
MODs go offline when their body system is destroyed.
```

No inventory.
No item replacement.
No separate tome system.
No generic stat-only cards.

## Universal Stat Pools

Each body part has a small universal stat vocabulary.

```js
rangedArm: ['damage', 'speed', 'amount', 'size', 'special']
meleeArm:  ['damage', 'speed', 'amount', 'size', 'special']
legs:      ['power', 'speed', 'amount', 'duration', 'special']
heart:     ['health', 'recovery', 'defense', 'duration', 'special']
reactor:   ['capacity', 'recovery', 'efficiency', 'output', 'special']
```

Each MOD interprets these stats in its own way.

Example:

```text
Spread Barrel +Amount:
  more side projectiles

Rail Injector +Amount:
  more pierce/rail targets or more rail output

Shock Knuckle +Amount:
  more chain targets
```

This keeps the system simple while letting MODs feel distinct.

---

# 9. Current MOD List

There are 15 starter MODs: 3 per body system.

## Ranged Arm MODs

### Spread Barrel

Unlock:

```text
Ranged shots fire angled side projectiles.
```

Stat meanings:

```text
Damage  = side projectile damage
Speed   = spread firing/cooldown behavior
Amount  = more side projectiles
Size    = spread coverage / projectile presence
Special = improved spread efficiency/identity
```

### Rail Injector

Unlock:

```text
Every few shots fires a piercing rail shot.
```

Stat meanings:

```text
Damage  = rail damage
Speed   = rail frequency / shot speed
Amount  = pierce/rail output
Size    = rail width/range presence
Special = improved rail trigger/identity
```

### Bone Splitter

Unlock:

```text
Ranged shots fragment when they hit an enemy.
```

Stat meanings:

```text
Damage  = fragment damage
Speed   = fragment/projectile speed
Amount  = more fragments
Size    = larger fragments/coverage
Special = fragment pierce/split identity
```

## Melee Arm MODs

### Crusher Palm

Unlock:

```text
Melee swing becomes heavier, wider, and knocks enemies back harder.
```

Stat meanings:

```text
Damage  = melee hit damage
Speed   = melee recovery/cooldown
Amount  = more impact pulses/targets
Size    = bigger arc/radius
Special = stronger knockback/impact identity
```

### Shock Knuckle

Unlock:

```text
Melee hits zap nearby enemies.
```

Stat meanings:

```text
Damage  = zap/hit damage
Speed   = trigger/cooldown behavior
Amount  = chain targets
Size    = zap radius
Special = stun/electric identity
```

### Hook Tendon

Unlock:

```text
Melee pulls enemies inward before or during the hit.
```

Stat meanings:

```text
Damage  = hit damage
Speed   = hook recovery
Amount  = more pulled targets
Size    = hook range/arc
Special = pull strength/control identity
```

## Legs MODs

### Tendon Springs

Unlock:

```text
Dash recovers faster and movement feels springier.
```

Stat meanings:

```text
Power    = dash strength
Speed    = dash cooldown / move speed
Amount   = extra bounce/uses when supported
Duration = post-dash boost duration
Special  = better control/recovery identity
```

### Heavy Boots

Unlock:

```text
Dash damages and shoves enemies touched during the dash.
```

Stat meanings:

```text
Power    = dash impact damage
Speed    = dash recovery
Amount   = more enemies/impact coverage
Duration = stun/impact duration
Special  = knockback/contact resistance identity
```

### Skitter Gears

Unlock:

```text
Attacking gives a short movement burst.
```

Stat meanings:

```text
Power    = burst strength
Speed    = trigger/recovery speed
Amount   = trigger frequency or stacking
Duration = burst duration
Special  = pickup/mobility identity
```

## Heart MODs

### Thick Plating

Unlock:

```text
Big Guy gains more durability and body systems take less damage.
```

Stat meanings:

```text
Health   = max HP
Recovery = minor survival recovery
Defense  = direct/body damage resistance
Duration = invulnerability/safety window
Special  = system/crew protection identity
```

### Blood Pump

Unlock:

```text
Big Guy regenerates after avoiding damage.
```

Stat meanings:

```text
Health   = max HP
Recovery = regen rate/delay
Defense  = damage smoothing
Duration = regen/safety window
Special  = emergency healing identity
```

### Leech Tube

Unlock:

```text
Close-range kills heal the Big Guy slightly.
```

Stat meanings:

```text
Health   = max HP
Recovery = heal amount
Defense  = close-range resistance
Duration = heal trigger window
Special  = kill-heal range/condition identity
```

## Reactor MODs

### Battery Gut

Unlock:

```text
Big Guy has a larger stamina reserve.
```

Stat meanings:

```text
Capacity   = stamina/power capacity
Recovery   = stamina recovery
Efficiency = lower action costs
Output     = action availability
Special    = emergency reserve identity
```

### Capacitor Organ

Unlock:

```text
Periodically stores a free or boosted action.
```

Stat meanings:

```text
Capacity   = stored charge capacity
Recovery   = charge rate
Efficiency = cheaper stored actions
Output     = boost strength
Special    = trigger/frequency identity
```

### Overclock Coil

Unlock:

```text
High Reactor power boosts attacks and movement.
```

Stat meanings:

```text
Capacity   = overclock headroom
Recovery   = recovery from output demand
Efficiency = power conversion
Output     = high-power bonus strength
Special    = threshold/extra power identity
```

---

# 10. Upgrade Pause and Voting

When a resource threshold triggers an upgrade:

```text
game pauses
both players see same 3 choices
players vote
choice applies
game resumes
```

## Solo

```text
Only the human player votes.
AI does not vote.
Pick applies immediately.
```

## Two-player

```text
Big Guy player must vote.
Little Guys player must vote.
If both pick the same choice, it applies.
If they pick different choices, a coin flip decides between the two selected choices.
```

Vote badges:

```text
YOU
NOT YOU
YOU + NOT YOU
```

Coin flip:

```text
muted overlay
clicks disabled
animated CSS coin
coin sides: YOU / OTHER GUY
result holds briefly before applying
```

---

# 11. Resources and Upgrade Pacing

Resources:

```text
Flesh
Scrap
Charge
```

Resources come primarily from combat drops.

Resource weighting should influence upgrade choices:

```text
Flesh:
  Heart, Legs, survival, movement

Scrap:
  Ranged Arm, Melee Arm, weapon impact, armor-like effects

Charge:
  Reactor, cooldown, stamina, electric/tempo effects
```

Upgrade costs scale upward over the run to prevent runaway upgrade frequency.

Design goal:

```text
Upgrades should feel frequent enough to shape the run,
but not so frequent that the game becomes constant pause screens.
```

---

# 12. Enemy Pressure and Threat Scaling

The current build includes a shared threat director.

Threat should be based primarily on:

```text
time
wave count
small upgrade-count contribution
```

Enemy pressure should scale through:

- enemy count
- enemy HP
- enemy damage
- enemy speed
- enemy mix
- ranged pressure
- boss timing

Avoid scaling enemies only as a direct response to player power. The game should feel like a time-based survival curve where upgrades help the player keep up.

---

# 13. Current Enemy Types

The arena currently uses small/medium/ranged pressure enemies and a boss-style mob.

## Grub

Role:

```text
basic contact pressure
```

## Scrapper

Role:

```text
stronger/faster body pressure
```

## Spark

Role:

```text
ranged/projectile pressure
```

## Brute

Role:

```text
beefy boss/focus danger
```

Design goals for Brute:

- high HP
- large visible body
- clear focus target
- meaningful contact/body-system damage
- boss ring/health readout
- large resource reward

Bosses should punctuate the survival flow and create special danger moments.

---

# 14. Multiplayer Session Flow

The current build supports GitHub Pages multiplayer using a browser-side connection path.

## Start Screen

Minimal UI:

```text
BIG GUY LITTLE GUYS
SOLO
HOST
JOIN
```

No explanatory paragraphs in the game UI.

## Solo

```text
click SOLO
start as Big Guy
inactive Little Guys AI runs
minimap can switch active role
```

## Host

```text
click HOST
host gets 4-digit PIN
host waits on WAITING FOR OTHER PLAYER TO JOIN screen
```

Host does not choose role until another player connects.

## Join

```text
click JOIN
type 4-digit PIN
CONNECT button appears after 4 digits
click CONNECT
```

## Role Select

After connection, both players go to a full-screen role-selection screen.

Choices:

```text
BIG GUY
LITTLE GUYS
```

Role select should be visually fun with CSS art, but not text-heavy.

If both players choose different roles:

```text
roles assign directly
```

If both choose the same role:

```text
coin flip decides who gets that role
other player gets the other role
```

---

# 15. Multiplayer Architecture

The current online model is host-authoritative.

```text
Host:
  runs simulation
  applies commands
  resolves roles/votes
  broadcasts snapshots

Client:
  sends commands/input
  renders snapshots
  does not simulate gameplay
```

This is required for stability.

Do not let the non-host client run enemy/projectile/repair/update simulation.

---

# 16. Solo AI

Solo mode uses AI for the inactive side.

## Little Guys AI

When Big Guy is controlled by the player, Little Guys AI should:

- repair damaged systems
- keep important systems powered
- station workers when no repair is needed
- choose upgrades only if explicitly allowed by the solo flow

Current rule: upgrade choice belongs to the human player; AI does not vote.

## Big Guy AI

When Little Guys is controlled by the player, Big Guy AI should:

- avoid getting trapped
- move toward open space
- avoid bosses/crowds
- aim at nearest/highest-threat enemies
- shoot when possible
- melee only when enemies are close
- dash out of danger
- collect drops only when reasonably safe

Current Big Guy AI uses safer movement sampling and should not simply back into corners.

---

# 17. UI Direction

The game UI should be minimal and iconographic.

Avoid:

- explanatory paragraphs
- text-heavy panels
- generic dashboard feel
- long instructions inside the playable screen

Prefer:

- clear buttons
- icons/chips
- compact system readouts
- visible body status
- CSS/canvas art that communicates state
- short status labels only when necessary

Current label preference:

```text
NOT YOU
```

not:

```text
OTHER
```

---

# 18. Big Guy Visual Direction

The Big Guy should not be just a circle.

Current direction:

```text
canvas-drawn composite body
visible torso / heart core / reactor core / ranged arm / melee arm / legs
body part colors reflect HP/power/damage
MODs should eventually add visible attachments or effects
```

A visual head/face is allowed, but not as a gameplay body part.

Future visual goals:

- Ranged Arm visibly changes with Ranged MODs
- Melee Arm visibly changes with Melee MODs
- Legs show spring/boot/skitter identity
- Heart and Reactor cores visibly pulse/flicker
- damaged parts spark/fade/droop
- powered parts glow subtly

---

# 19. Little Guys Visual Direction

Little Guys side should remain an FTL-like body cutaway:

- five rooms
- corridors
- station/repair/idle slots
- worker movement
- power pips
- HP bars
- damage and repair effects
- MOD chips per body part

The Little Guys screen should feel spatial and live, not like an equipment menu.

---

# 20. Current Known Priorities

Likely next areas to improve:

1. Big Guy and Little Guys readability while preserving minimal UI.
2. Better body/MOD icon display for Big Guy.
3. Continued enemy/boss scaling tuning.
4. More interesting but controlled MOD effects.
5. Better Big Guy character art/status feedback.
6. Multiplayer disconnect/reconnect handling if needed.
7. More robust browser compatibility testing for GitHub Pages host/join.

---

# 21. Maintenance Requirement

Future updates should use this handoff together with:

```text
big-guy-little-guys-architecture-maintenance-v0.1.md
```

That guide defines how to keep changes system-level, multiplayer-safe, and agnostic of either player side.

Before implementing future patches, always identify:

```text
shared state changes
command changes
selector/output changes
simulation changes
Big Guy experience
Little Guys experience
solo behavior
multiplayer behavior
snapshot/network risk
```

---

# 22. Short Summary

Current Big Guy Little Guys is:

```text
a single shared-simulation browser game
with two asymmetric roles
host-authoritative GitHub Pages multiplayer
paused shared MOD voting
permanent MOD growth
five canonical body systems
and a strict requirement that future patches work for both sides and multiplayer
```
