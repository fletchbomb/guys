[big-guy-little-guys-architecture-maintenance-v0.2.md](https://github.com/user-attachments/files/27963283/big-guy-little-guys-architecture-maintenance-v0.2.md)
# Big Guy Little Guys — Architecture Maintenance Guide v0.2

**Project:** Big Guy Little Guys  
**Guide date:** 2026-05-18  
**Current reference build:** `big-guy-little-guys-shared-v0.8.html`  
**Purpose:** Preserve the shared-simulation, two-role, GitHub Pages multiplayer architecture while the game changes through many future playtest patches. This guide is intentionally durable: do not update it for routine balance, content, UI, or small feature patches. Update it only when the architecture, multiplayer model, body-system model, command model, or documentation philosophy changes radically.

---

# 0. Why This File Exists

Big Guy Little Guys is now a working multiplayer prototype with two asymmetric roles:

- **Big Guy**: live arena combat.
- **Little Guys**: internal body-management/repair/power control.

The biggest future risk is not a lack of feature ideas. The biggest risk is adding many small patches that accidentally become:

- Big Guy-only logic.
- Little Guys-only logic.
- solo-only logic.
- host-only logic.
- client-side simulation logic.
- duplicate state that works locally but breaks browser-hosted multiplayer.

This file exists to prevent that.

Every future update should preserve the central architecture:

```text
one shared simulation
one authoritative host
role-specific views
commands as the only gameplay mutation path
clients send intent and render snapshots
```

## Documentation Update Policy

This file is not a patch log.

Do not version-bump this architecture guide for every gameplay change. It should remain the source of truth across many patches. Update it only when one of these changes:

- the shared-simulation model changes
- the host-authoritative multiplayer model changes
- the command/validation model changes
- the snapshot/hydration model changes
- the canonical body systems change
- the project intentionally moves away from static GitHub Pages / single-file prototype delivery
- a repeated failure pattern proves the guide needs a new rule

Routine work should cite this guide, not rewrite it.

---

# 1. Non-Negotiable Architecture Rules

## Rule 1 — One Shared Gameplay State

There is only one authoritative gameplay state.

Big Guy and Little Guys must never maintain separate truths about:

- body system HP
- allocated power
- crew position
- repair status
- active MODs
- resources
- enemies
- projectiles
- upgrade choices
- role assignment

Big Guy and Little Guys views may render the state differently, but they must read from the same state.

Bad pattern:

```js
bigGuyWeaponPower = 3;
littleGuysRangedArmPower = 2;
```

Good pattern:

```js
effectivePower(state, 'rangedArm');
```

---

## Rule 2 — Host-Authoritative Multiplayer

In online two-player mode:

```text
host browser runs simulation
join browser sends commands/input
join browser renders host snapshots
```

The non-host client must not run combat, enemy, projectile, repair, resource, or upgrade simulation.

The stable v0.8 multiplayer baseline depends on this rule. Do not undo it.

Expected structure:

```text
local input
→ command
→ if host: apply command locally
→ if client: send command to host
→ host applies command
→ host broadcasts snapshot
→ clients render snapshot
```

---

## Rule 3 — Gameplay Changes Must Go Through Commands

Views, buttons, mouse handlers, keyboard handlers, AI, and debug tools should not directly mutate gameplay state.

Bad pattern:

```js
state.body.rangedArm.hp -= 10;
```

Good pattern:

```js
dispatch({
  type: 'DEBUG_DAMAGE_SYSTEM',
  systemId: 'rangedArm',
  amount: 10
});
```

For remote clients, commands must be sendable over the network.

Stable v0.8 adds a command registry / validation layer. New gameplay commands should be registered with their intended permissions before being wired into UI, AI, networking, or debug tools.

Each command should declare, directly or implicitly:

```text
what role may send it
whether it can run during upgrade pause
whether a remote client may send it
whether it is debug-only
```

Do not bypass command validation to make a quick feature work.

---

## Rule 4 — Rules Are Role-Agnostic

Shared rules should not be written as “Big Guy rules” or “Little Guys rules.”

They should describe:

- body systems
- power
- repair
- damage
- MOD output
- enemy pressure
- resources
- upgrade voting
- role commands

Then each role-specific view expresses those rules differently.

Example:

```text
Ranged Arm damaged
→ shared state: rangedArm.hp decreases
→ Big Guy view: gun arm flickers, shot output weakens
→ Little Guys view: Ranged Arm room flashes, repair becomes urgent
```

---

## Rule 5 — Solo Is Not a Separate Game

Solo mode uses the same simulation as multiplayer.

The only solo-specific idea is that one human controls one role and AI controls the inactive role.

Do not create separate solo-only body rules, combat rules, upgrade rules, or resource rules.

---

## Rule 6 — State Must Be Snapshot-Safe

Anything stored in authoritative gameplay state must be safe to serialize and send as a multiplayer snapshot.

Avoid storing these directly in shared state:

- DOM nodes
- canvas contexts
- event objects
- functions
- cyclic references
- class instances that depend on prototype methods after JSON cloning
- Sets/Maps unless they are explicitly converted during snapshot creation/hydration

If a feature needs temporary visual-only state, put it in view/UI state and ensure snapshots can safely omit or reconstruct it.

Stable v0.8 includes a snapshot-safety check before broadcast. Treat warnings from that check as architecture warnings, not cosmetic console noise.

---

## Rule 7 — GitHub Pages Is a First-Class Target

The game is expected to work when hosted as a static HTML file on GitHub Pages.

Current online multiplayer path uses browser-side PeerJS/WebRTC behavior from the single HTML file. Do not add a requirement for a Node server unless the project explicitly moves to a deployed backend.

If a future change needs a backend, document it clearly before coding.

---

## Rule 8 — Network-Visible Session Events

Session-critical presentation must be visible to both browsers in online play.

Examples:

```text
role coin flips
upgrade vote coin flips
start countdown
lobby/back/leave state
```

Do not trigger these only with a host-local callback. The host may decide the result, but both browsers should receive enough session/UI event data to show the same beat before the result is applied.

Good pattern:

```text
host decides coin result
host sends coin event to client
both browsers show coin overlay
host applies result after the visual beat
host broadcasts final snapshot
```

Bad pattern:

```text
host flips coin locally
host immediately applies result
client only receives final state
```

---

## Rule 9 — Working Stability Beats Premature Infrastructure

The single-file prototype is allowed to stay single-file while the game is still moving quickly.

Do not add a framework, bundler, backend, TypeScript migration, replay engine, or multi-file architecture solely for future-proofing. Add infrastructure only when it solves a present recurring problem without destabilizing the build.

The preferred future-proofing style is:

```text
small guardrails
clear commands
serializable state
smoke checks
versioned stable files
hosted multiplayer testing
```

---

# 2. Current Code Layers to Preserve

The single HTML file may remain single-file for prototyping, but it should stay internally organized by layer.

Recommended order:

```text
0. HTML/CSS shell
1. constants and tuning
2. static libraries: systems, MODs, enemies
3. initial shared state
4. pure selectors / derived outputs
5. commands
6. session / lobby / role assignment
7. networking adapter
8. shared simulation updates
9. AI controllers
10. Big Guy view/input
11. Little Guys view/input
12. minimaps / overlays / countdown / coin flip
13. debug tools / smoke checks / command log
14. main loop
```

Future changes should be placed in the correct layer rather than patched into whichever function is easiest to find.

---

# 3. Shared Systems and Naming

The canonical body systems are:

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

Do not reintroduce `head` as a gameplay body part.

A visual head/face on the Big Guy character is allowed, but it must not become a body system with HP, power, crew stationing, or MOD slots.

Do not use `leftArm` or `rightArm` in new gameplay code. Use `meleeArm` and `rangedArm`.

---

# 4. Command Discipline

Every gameplay-relevant input should become a command.

Examples:

```js
{ type: 'BIG_SHOOT' }
{ type: 'BIG_MELEE' }
{ type: 'BIG_DASH', angle }
{ type: 'BIG_INPUT', input }
{ type: 'LG_SET_POWER', systemId, value }
{ type: 'LG_MOVE_WORKER', workerId, systemId }
{ type: 'VOTE_UPGRADE', role, index }
{ type: 'SESSION_SELECT_ROLE', playerId, role }
```

AI should also use commands whenever it changes gameplay state.

Debug controls should use commands too.

New commands must be added to the command registry / validation layer. A command that is not registered should be treated as invalid rather than silently accepted.

When adding a command, check:

```text
role permission
pause/upgrade permission
remote-client permission
debug-only status
network payload shape
host handling path
client rendering consequence
```

---

# 5. Multiplayer-Safe Update Rules

## Host

The host may:

- run the main simulation update
- update enemies/projectiles/drops
- update workers and repair
- resolve upgrade votes
- resolve role coin flips
- start network-visible countdowns/coin flips
- apply commands from both players
- run snapshot-safety checks before broadcast
- broadcast snapshots

## Client

The non-host client may:

- collect local input
- send commands/input to host
- receive snapshots
- render latest snapshot
- show local UI state needed for input
- show network-visible session events such as countdowns and coin flips

The client must not:

- spawn waves
- move enemies
- update projectiles
- apply damage
- repair systems
- resolve votes
- generate upgrades
- advance boss timers
- apply resource pickups
- decide or apply coin-flip results independently

---

# 6. Feature Design Template

Before implementing a feature, write a small plan using this template.

```text
Feature:
Why:
Shared state changes:
Command changes:
Command registry / validation changes:
Selector/output changes:
Simulation changes:
Big Guy experience:
Little Guys experience:
Solo behavior:
Multiplayer behavior:
Snapshot/network risk:
Network-visible session events:
GitHub Pages risk:
UI changes:
AI changes:
Regression tests:
```

If the feature cannot be described in this format, it is probably not ready to code.

---

# 7. Change Classification

Every patch should be classified before implementation.

## Balance-only patch

Examples:

- enemy HP
- upgrade cost curve
- repair rate
- resource drop values
- MOD scaling numbers

Expected change location:

```text
constants / tuning / static data
```

Do not change view code for balance-only patches.

## Shared system patch

Examples:

- new damage rule
- new upgrade mechanic
- new body power behavior
- new enemy attack type

Expected change locations:

```text
state shape
commands
selectors
simulation
both role views if needed
network snapshot audit
```

## View-only patch

Examples:

- minimap size
- button layout
- CSS art
- animation timing
- icon display

Expected change locations:

```text
Big Guy view
Little Guys view
CSS/HTML
```

View-only patches must not alter gameplay state directly.

## Multiplayer/session patch

Examples:

- lobby flow
- role selection
- coin flip presentation
- disconnect handling

Expected change locations:

```text
session state
network adapter
commands
start/lobby UI
snapshot/role tests
```

---

# 8. Required Regression Checklist

After every update, check these at minimum.

## Shared simulation

- Is there still only one body state?
- Are all body systems using `heart`, `meleeArm`, `reactor`, `rangedArm`, `legs`?
- Did any old `leftArm`, `rightArm`, or gameplay `head` language return?
- Are new gameplay changes made through commands?
- Are new commands registered and permissioned?

## Big Guy side

- Can Big Guy move, aim, shoot, melee, and dash?
- Does Big Guy feel body damage/power/MOD state?
- Does the Big Guy minimap/body status still communicate enough?
- Does the game continue after the first shot, first melee, first dash, and first damage event?

## Little Guys side

- Can workers be selected and moved?
- Can power be changed?
- Do damaged systems show clearly?
- Do repairs actually restore shared system state?
- Does Little Guys view still reflect the same state Big Guy feels?

## Upgrade flow

- Does upgrade pause stop simulation?
- Does solo require only the human vote?
- Does two-player require both role votes?
- Do same-choice votes apply directly?
- Do different-choice votes show the coin flip on both online browsers and apply the result after the visual beat?
- Do vote badges show `YOU`, `NOT YOU`, or `YOU + NOT YOU` correctly?

## Solo

- Solo starts with countdown, then Big Guy is playable.
- Inactive side AI works.
- Minimap role switching works in solo only.

## Multiplayer

- Host gets PIN.
- Join enters 4-digit PIN and connects.
- Role select appears only after connection.
- Both players can choose roles.
- Back buttons work from host/join/role-select before play starts.
- Same-role choice coin flip works and is visible on both browsers.
- Start countdown appears before gameplay.
- Host starts and runs simulation.
- Client sends input/commands and renders snapshots.
- Client does not simulate independently.
- Upgrade voting syncs.
- Upgrade disagreement coin flip is visible on both browsers.

## GitHub Pages

- Hosted page loads from static HTML.
- Host/join works from two browser windows.
- Smoke test passes in the debug panel.
- Snapshot warnings are understood and addressed.
- No required backend unless explicitly intended.

---

# 9. Common Failure Patterns to Avoid

## Failure Pattern A — View owns rules

Symptom:

```text
Big Guy works, but Little Guys does not understand the result.
```

Cause:

```text
A rule was coded inside Big Guy rendering/input instead of shared selectors/simulation.
```

Fix:

```text
Move the rule into shared state/commands/selectors/simulation.
```

---

## Failure Pattern B — Client simulates gameplay

Symptom:

```text
Multiplayer freezes, diverges, or behaves differently after projectiles/enemies/upgrades appear.
```

Cause:

```text
The non-host browser is running update logic instead of only rendering host snapshots.
```

Fix:

```text
Gate update logic so only host/solo simulates.
Clients send commands and render snapshots.
```

---

## Failure Pattern C — Direct mutation from UI

Symptom:

```text
Works in solo, breaks or desyncs in multiplayer.
```

Cause:

```text
A button/input directly changed state instead of dispatching a command.
```

Fix:

```text
Convert the mutation to a command handled by the authoritative simulation.
```

---

## Failure Pattern D — Host-only session presentation

Symptom:

```text
The host sees a coin flip, countdown, or lobby transition, but the joiner jumps straight to the result or appears frozen.
```

Cause:

```text
A session-critical visual beat was implemented as a host-local callback instead of a network-visible session event.
```

Fix:

```text
Let the host decide the result, broadcast the visual event, show it on both browsers, then apply/broadcast the final state.
```

---

## Failure Pattern E — Non-serializable state

Symptom:

```text
Snapshot fails, freezes, or loses data.
```

Cause:

```text
State contains Sets, Maps, functions, DOM nodes, canvas data, or complex objects without hydration logic.
```

Fix:

```text
Store plain objects/arrays/numbers/strings/booleans in shared state.
Convert and hydrate special structures deliberately.
```

---

# 10. MOD System Maintenance Rules

Current MOD architecture:

```text
Each body system has 2 MOD slots.
Base body function exists even with no MODs.
First MOD pick unlocks a behavior.
Repeat picks upgrade one stat aspect of that MOD.
MODs go offline when their body part is destroyed.
```

Universal stat pools:

```js
rangedArm: ['damage', 'speed', 'amount', 'size', 'special']
meleeArm:  ['damage', 'speed', 'amount', 'size', 'special']
legs:      ['power', 'speed', 'amount', 'duration', 'special']
heart:     ['health', 'recovery', 'defense', 'duration', 'special']
reactor:   ['capacity', 'recovery', 'efficiency', 'output', 'special']
```

When adding a new MOD:

- assign it to one body system
- define unlock behavior
- define how each universal stat affects that MOD
- apply behavior in the relevant shared output function
- ensure it turns off when the body system is destroyed
- ensure it renders as an icon/chip in both relevant views

Do not create a custom stat vocabulary for each MOD unless the whole stat system is intentionally redesigned.

---

# 11. Enemy/Scaling Maintenance Rules

The current enemy pressure should be managed by a shared threat director, not by isolated spawn hacks.

When adding enemies or scaling:

- read shared threat/time/wave values
- avoid separate Big Guy-only difficulty systems
- ensure Little Guys receives meaningful body damage consequences
- ensure resources/upgrades do not accelerate so fast that challenge collapses
- bosses should create focus danger and reward, not random unavoidable punishment

---

# 12. UI Text Rule

The current design direction is minimal text.

Start/lobby screens should use only the game name and button/status labels needed to proceed.

Avoid explanatory paragraphs in the playable HTML.

Good:

```text
BIG GUY LITTLE GUYS
SOLO
HOST
JOIN
WAITING FOR OTHER PLAYER TO JOIN
CONNECT
```

Bad:

```text
This mode lets you connect to another player using a browser-based peer connection...
```

Detailed explanation belongs in MD files, not in the game UI.

---

# 13. Versioning and Documentation Practice

For stable playtest builds:

- increment the filename: `big-guy-little-guys-shared-v0.8.html`, `v0.9`, etc.
- update the HTML title/version label from a single build-version constant when possible
- keep prior stable files
- summarize changes in a patch log or chat response
- do not overwrite the last stable multiplayer build until the new one is tested

For MD files:

- do not update this architecture guide for every routine gameplay patch
- do not update the GDD snapshot for every balance/content tweak
- update docs only when the architecture, core body model, multiplayer flow, or prototype identity changes enough that future work would be misled by the old docs

---

# 14. Short Rule Summary

Use this as the mental checklist before every patch:

```text
One shared state.
Host simulates.
Clients send validated commands and render snapshots.
Views do not own rules.
Solo is not a fork.
State must serialize.
Session-critical visual events must be network-visible.
Both roles must feel the change.
GitHub Pages multiplayer must keep working.
```
