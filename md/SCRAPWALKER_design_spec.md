# SCRAPWALKER — Design & Build Spec

*A two-player asymmetric co-op game. One player is the mech (Megabonk). One player is the crew inside it (FTL). Same fight, two screens, one shared fate.*

---

## 0. How to read this document

This is a build spec for vibecoding. It is deliberately **MVP-first**: Section 9 defines the smallest thing worth building and testing, and everything before it is the full target. Build the MVP slice first, get the two loops feeling right in **solo mode**, then layer in the rest.

Two hard design rules govern every decision below:

1. **Big Guy must feel almost exactly like Megabonk.** Twitch positioning, auto-fire baseline, horde survival, escalating chaos, the level-up dopamine beat. If a feature would make Big Guy feel like he's driving a spreadsheet, it's wrong.
2. **Little Guy must feel almost exactly like FTL.** Power allocation, crew you physically move room to room, charge-timer weapons, fires and breaches and boarders. If a feature would make Little Guy feel like a passive support bot, it's wrong.

We are copying two proven loops ~95% and inventing only the **wiring between them**. The wiring is where the game becomes its own thing.

---

## 1. The pitch

Green engineer goblins live on a hostile alien world. To survive it, they built **Scrapwalker** — a giant metal goblin mech, essentially a huge armored version of themselves. One goblin's-worth of intent drives it across the surface; the rest of the crew scramble around inside keeping it powered, armed, patched, and clear of intruders.

- **Player A (Big Guy)** pilots Scrapwalker on the alien surface. This is a Megabonk-style bullet-heaven horde-survival game.
- **Player B (Little Guy)** commands the goblin crew inside Scrapwalker. This is an FTL-style real-time ship-interior management game.

Neither player can win alone. Big Guy's positioning decides what the crew has to deal with; the crew's decisions decide what Big Guy is actually capable of, second to second.

---

## 2. The two-game structure

| | Big Guy | Little Guy |
|---|---|---|
| Reference game | Megabonk | FTL: Faster Than Light |
| View | 3D-ish arena, third-person, chunky stylized | 2D flat cutaway of the mech interior, room grid |
| Core verb | Move / dodge / position | Allocate power, move crew room-to-room, fire weapons, fight fires/breaches/boarders |
| Player controls movement? | **Yes** — fully twitch-controlled | No — never controls Big Guy's position |
| What the player is fighting | The alien horde | Damage consequences (fires, breaches, boarders) + firing the mech's heavy weapons |
| Emotional register | Power fantasy under chaos | Tense triage + clutch offense |

Both run in real time. **Neither game ever hard-pauses** except the shared level-up beat (Section 6).

---

## 3. Theme & art direction

Unified universe, two distinct visual languages that read as the same world when glimpsed in the corner HUD.

**Shared theme:** Green engineer goblins on an alien planet. Scrapwalker is a giant metal goblin — same silhouette as the little crew, scaled up and armored. This visual rhyme (little green goblin ↔ big metal goblin) is the identity of the game; lean into it everywhere.

**Big Guy (Megabonk language):**
- Bright, chunky, low-poly / stylized-3D arena look. Readable-at-a-glance shapes over realism.
- Scrapwalker: hulking metal goblin — big ears, hunched posture, glowing reactor "heart" visible through chest venting, mismatched scavenged armor panels.
- Enemies: alien fauna horde — glowing bio-creatures, swarming, escalating variety. Chunky and readable so a screen full of them stays legible.
- Alien surface: vivid, otherworldly palette. Hazard-lit, spore-glow, strange geometry.
- Damage is **visible on the mech's exterior**: armor panels pop off when destroyed, exposing frame and sparking systems underneath. From across the room you can tell Scrapwalker is hurting.

**Little Guy (FTL language):**
- Flat 2D cutaway of the mech interior. Grid of rooms with clear borders, retro-sci-fi UI, pixel-art crew.
- Crew: small green engineer goblins with tool belts, scurrying between rooms, hauling battery cells, welding breaches, brawling intruders.
- Rooms glow/pulse by function (reactor = warm core glow, weapons = charge bars, shields = blue). Fire = orange spread, breach = sucking dark rupture venting coolant vapor.
- Overall feel: the greasy, lived-in engine-room interior of the metal goblin. Pipes, rivets, warning decals in a goblin script.

**Asset rule:** Evoke both styles with **original art**. Match the *visual language and vibe* of each reference game; do not reproduce any proprietary sprites, characters, UI, or assets from either game.

---

## 4. BIG GUY — Megabonk spec

Copy Megabonk's loop. The only structural change from a solo bullet-heaven is that **the level-up upgrade choices belong to Little Guy**, and Big Guy's stats are continuously set by what the crew is doing.

### 4.1 Core loop (unchanged from the genre)
- Third-person, player-controlled movement across an open arena on the alien surface.
- Enemies spawn continuously in escalating waves; difficulty ramps on a clock.
- The player's skill is **positioning and dodging**, not aiming.
- Killing enemies drops **salvage** (the shared economy — see Section 7) and **XP orbs**.
- Filling the XP bar triggers a **level-up** (Section 6).
- Survive as long as possible; run ends when Scrapwalker falls (Section 8).

### 4.2 Attacks — the critical reconciliation
Megabonk auto-fires. FTL weapons are charge-timer weapons fired by the crew. We keep **both**, split by role:

- **Baseline auto-fire (Big Guy's):** Scrapwalker always has a light built-in weapon that auto-targets nearby enemies. This preserves the Megabonk feel — the player is never weaponless, positioning always matters, the twitch loop is intact even if the crew does nothing.
- **Heavy weapons = the arms (Little Guy's):** The big damage comes from the two **arm weapons**, which are FTL weapon rooms — charged on a timer, powered by allocation, boosted by manning, and **fired by Little Guy** (Section 5.3). When Little Guy fires an arm, Scrapwalker's mech arm visibly fires in the world.

**Aiming of arm weapons:** they fire toward Big Guy's facing / auto-target the nearest cluster in front of him. So **Big Guy's positioning decides *where* the heavy shots land; Little Guy decides *when* and *whether* they fire.** Positioning (Big Guy) and timing/energy (Little Guy) are both load-bearing — this is the offense-sharing that stops Little Guy feeling like all-work-no-reward.

### 4.3 Big Guy's stats are set by Little Guy, live
Big Guy has no upgrade menu of his own. His moment-to-moment capabilities are outputs of the crew's decisions:

- **Fire rate / damage of arms** ← weapon room power + manning
- **Dodge chance / move speed** ← leg (engine) room power + manning
- **Damage absorption** ← shield room layers + manning
- **Crit chance / ability cooldown** ← head (piloting) room manning
- **Max HP / regen** ← upgrades the crew buys with salvage

The player feels these change in real time and learns to read the corner HUD to understand *why* (Section 8).

### 4.4 Escalation
Standard survivors ramp: spawn rate, enemy variety, and enemy toughness climb on a timer. Introduce elite/heavy enemies that specifically threaten the interior (their hits are the ones that cause breaches/boarders — Section 7.3), so Big Guy learns which threats are "Little Guy's problem incoming."

---

## 5. LITTLE GUY — FTL spec (full system map)

Copy FTL's systems 1:1. Every FTL subsystem gets a mech-part twin doing the identical job; only the skin and the input/output source change. Crew are **green engineer goblins**, plural, expandable via crew modules.

### 5.1 FTL → Scrapwalker system mapping

| FTL system | Scrapwalker part | Mechanic (copied) |
|---|---|---|
| Reactor / power bar | **Core reactor** (chest) | Generates a pool of power pips; player allocates across systems. Upgrade to add pips (costs salvage). |
| Weapons | **Arms** (L + R) | Charge-on-timer, energy-allocated, manned = faster charge. Different arm weapons have different timers/energy costs (melee arm, gun arm, missile arm) — direct laser/missile/beam-style tradeoffs. Fired by Little Guy. |
| Engines | **Legs** | Powered + manned = raises Big Guy's evasion (dodge) and move speed. |
| Shields | **Chest/back plate** | Powered = shield layers that absorb hits; manned = faster regen between hits. |
| Piloting / helm | **Head / targeting core** | Repurposed (Big Guy already drives): manned = crit chance up / ability cooldown down. The "extra survivability+offense stacking" seat. |
| Oxygen / life support | **Coolant system** | Damage vents coolant; if a room hits zero coolant, goblins in it take heat damage. Same clock-and-stakes mechanic, reskinned. |
| Medbay | **Repair bay** | Goblins standing in it heal. Direct port. |
| Doors / bulkheads | **Bulkheads** | Sealable internal doors to contain fire/breach spread. Direct port. |
| Fires | **Fires** | Damage can ignite a room; spreads room-to-room; vent via bulkheads or beat out. Direct port. |
| Breaches | **Hull breaches** | Damage can rupture a room; vents coolant; a goblin must stand on it to weld it shut. Direct port. |
| Boarders | **Intruders** | Enemy hits/crits can spawn hostile corruption-sprites/alien-spawn inside a room; goblins fight them hand-to-hand. Direct port — this is Little Guy's visceral offense. |
| Crew skill-up | **Goblin XP** | A goblin who mans weapons gets better at weapons, one who fights gets better at combat, etc. Skill-up-through-use. Direct port. |
| Drones / hacking / cloak / teleporter | **Advanced modules** | Late-run unlocks: decoy drone (draws horde aggro off Big Guy), EMP burst (stuns nearby enemies), etc. Direct ports, reskinned. |

### 5.2 Crew (the goblins)
- Player directly grabs and moves goblins room to room in real time — **FTL puppeting, not Cosmoteer autonomy.** This is the whole point: it gives Little Guy as much continuous action as Big Guy.
- A manned room gives its bonus. Moving a goblin is a real tradeoff (the room they left loses its bonus).
- **Crew is a core progression axis:** buy **crew modules** with salvage to raise max goblin count, and **module upgrades** to improve rooms. Growing the roster is how Little Guy scales up over a run.
- Keep the roster in the FTL sweet spot early (a handful) so puppeting stays tense not chaotic; let modules push it higher as the interior grows.

### 5.3 Firing the arms (Little Guy's offensive lever)
- Each arm weapon has a charge bar. Allocate power → it charges on its timer → man it → it charges faster.
- When charged, **Little Guy triggers the shot.** Scrapwalker's arm fires in the world (Section 4.2).
- This is the "gunner seat" that earns Little Guy kill credit and agency. At least one arm should always be a satisfying, manually-fired heavy hitter, not a passive buff.

### 5.4 No downward spiral (design guardrail)
Damage adds *challenge* (fires, breaches, boarders, garbage to clear) but never *starves the ability to fight back*:
- Salvage keeps flowing from Big Guy's kills regardless of interior state.
- Repair and boarder-fighting are themselves satisfying core actions, not a tax on offense.
- Damaged systems can optionally be **pushed** into a risky overcharge state (e.g. an overheating arm fires faster but will break if not vented in time) — danger creates *opportunity with an upside*, not just downside to claw back. (Optional; strong flavor if included.)

---

## 6. The shared level-up beat (the only pause)

When Big Guy's XP bar fills:

- **Little Guy** gets the upgrade choice (this is where the Megabonk "pick your build" dopamine lives, handed to the crew): choose a new system, a system upgrade, a reactor pip, a new goblin, or a new arm weapon.
- **The pause is invisible to Big Guy.** Do **not** hard-freeze Big Guy's screen (he'd hate it). Instead, during the pick window, **throttle Big Guy's incoming pressure** — spawns thin out and slow for those few seconds, and Scrapwalker briefly auto-fights on baseline auto-fire — so there's no dead time to fill. Big Guy gets a short, earned breather while his build gets chosen; then the horde ramps back up.
- Optional: a **soft-pause / slow-mo** (world at ~15% speed) instead of a throttle, if the "big moment, take a breath" feeling reads better in playtest. Prefer the throttle first — it keeps Big Guy in flow.

Keep the pick screen fast and readable — it's Megabonk's level-up card moment, just on the other player's screen.

---

## 7. THE WIRING (this is the actual game)

Three bidirectional links. These must feel meaningful, causal, and *fun both ways* — not bookkeeping.

### 7.1 Big Guy → Little Guy: the salvage economy
- Big Guy's kills and loot pickups drop **salvage** into Little Guy's economy (this replaces FTL's scrap).
- Salvage funds: reactor pips, system upgrades, new crew modules, new arm weapons, advanced modules.
- **Feel:** a good Big Guy run (lots of kills, good pickups) visibly fuels the crew's build. Big Guy killing well = Little Guy getting to go shopping.

### 7.2 Little Guy → Big Guy: live capability
- Power allocation + manning set Big Guy's live stats (Section 4.3).
- Firing the arms produces Big Guy's heavy attacks (Section 4.2 / 5.3).
- **Feel:** Big Guy feels the crew's choices second to second — "shields just came online," "my dodge got better," "my right arm just fired a rocket." Losing a system or a goblin produces a matching **malfunction** on Big Guy's side (an arm goes offline, a stagger, a speed drop) rather than a silent stat change, so the cause is legible.

### 7.3 Big Guy's damage → Little Guy's crisis
- When Big Guy takes a hit, it maps to a **specific room** taking damage (replaces FTL's "enemy fire hits a random system").
- Heavier/elite enemy hits are the ones that roll for **fire, breach, or boarders** — so certain visible threats in Big Guy's world telegraph "interior emergency incoming."
- **Feel:** Little Guy watching the corner HUD sees Big Guy about to get swarmed and can **pre-position goblins** before the breach lands. Big Guy taking a big hit and then hearing/seeing his crew scramble is the core shared-tension moment.

### 7.4 Shared fate
- **Big Guy's HP = the mech's HP = the run's survival bar.** There is one health bar and both players share it.
- Losing goblins or systems *weakens* you (lost bonuses, offline weapons) but does **not** independently end the run.
- The run ends when Scrapwalker falls. Both players share one fate — this is what makes it one game instead of two.

---

## 8. UI & the corner HUD (the connection made legible)

Each player plays their own game full-screen, with a **corner HUD showing the other player's game** — designed so you understand *what the other player is doing and why it's about to affect you*. The HUD explains **causation, not just state.**

**On Big Guy's screen — the interior HUD (small FTL-style cutaway):**
- Miniature room grid showing: which rooms are manned, power allocation, arms' charge bars, fires/breaches, and any intruders.
- Big Guy reads this to understand *why* his shields dropped, why an arm went quiet, why his speed changed — and to anticipate ("crew's fighting a boarder in the left arm, so no rocket coming, I need to reposition").

**On Little Guy's screen — the battlefield HUD (small Megabonk-style view):**
- Miniature arena view: Big Guy's position, the horde, incoming heavy threats, and Big Guy's HP.
- Little Guy reads this to *pre-empt* crises: sees a swarm about to hit, pre-positions goblins near the room likely to breach, decides whether to dump power into shields now.

**Design principles for the HUD:**
- Prioritize *the other player's imminent impact on me*, not a full readout.
- Use shared iconography/palette so both HUDs read as the same world (reinforces the one-game feeling).
- Telegraph causes a beat before effects where possible (incoming heavy hit → glowing warning on the room it'll strike), so both players get to *react*, which is where the fun co-op tension lives.

---

## 9. MODES

### 9.1 Two-screen co-op (the real target)
- Two players, two devices/screens. Shared authoritative simulation kept in sync (Section 10).

### 9.2 Solo mode with AI + hot-swap (build this first — it's the test harness)
- One human plays; the other half is run by an **AI operator**.
- The player can **switch which half they control at any time**; the AI seamlessly takes over the half they leave.
- Purpose: lets you test and tune each game cleanly and independently, and verify the wiring feels good from both sides, without needing two humans or netcode. **Build this mode first.**
- AI operators need only be competent, not brilliant:
  - **AI Little Guy:** man the highest-value rooms, keep shields/arms powered, send the nearest goblin to fires/breaches/boarders, fire arms when charged, spend salvage on sensible upgrades.
  - **AI Big Guy:** kite the horde, avoid clustering damage, stay roughly in open space, favor positions that let arm weapons hit clusters.

---

## 10. TECHNICAL NOTES (for vibecoding)

**Recommended stack:**
- **Big Guy:** **three.js** (WebGL). Megabonk's look — chunky low-poly characters, simple arena geometry, large enemy counts, minimal lighting — is squarely what three.js does well without a heavy engine. Use original low-poly assets in that style.
- **Little Guy:** 2D — HTML/DOM or Canvas 2D — for the FTL-style room-grid cutaway. No 3D needed here; a flat grid is truer to the reference anyway.
- **Format:** ships as HTML + JS (loading three.js). For a non-coder this is the easiest possible format: no install, no build step, opens in a browser, and hosts free on itch.io / Netlify / GitHub Pages. Solo mode runs entirely from static files. (True two-device play later needs a small relay or a P2P library like PeerJS — see build order — but nothing about the format needs to change for that.)
- **Single-file vs. modules:** two games + AI + shared state is larger than a typical single-file build. A small module split is recommended — e.g. `sharedState`, `bigGuy` (three.js scene + render), `littleGuy` (grid render), `ai`, `hud`, `sim` (the tick loop). It can still be delivered as one HTML entry point that pulls these in.

**Performance (build these in from the start, not as a retrofit):**
- **Instanced meshes** for enemies and projectiles — one draw call renders all copies of a given enemy/projectile type. This is the single most important thing for hitting Megabonk-scale hordes in the browser. Do not spawn one standalone mesh per enemy.
- **Object pooling** — pre-allocate and reuse enemy, projectile, and pickup objects rather than creating/destroying them each frame. Avoids GC hitches during heavy waves.
- Keep lighting cheap (baked / simple), favor flat or lightly-shaded materials — matches the art style *and* the performance budget.

**HARD REQUIREMENT — simulation/render/input separation (this is what makes 2-player sync a later add, not a rewrite):**
1. **One plain state object is the single source of truth** — Big Guy HP/position, every room's power/manning/damage state, salvage total, arm charge levels, active fires/breaches/boarders, discrete events (arm fired, hit landed). This is the wiring object from §7.
2. **Rendering only reads state.** The three.js scene and the 2D grid draw *from* the state object every frame. The renderer never holds authoritative truth. Input must never poke the three.js scene or the DOM grid directly.
3. **All input submits intents, not direct mutations.** Human keyboard/gamepad, the AI operator, and (later) a network message must all go through the *same* path: emit an intent (`moveTo`, `allocatePower`, `manRoom`, `fireArm`) that the simulation applies to the state object. Nothing special-cases "local human." This is the rule that makes the AI operator and the future netcode drop into the exact same seam.
4. **The simulation advances on a fixed tick**, applying queued intents to the state object; rendering runs off that state independently.

If this separation is honored, going solo → two-screen is: keep the same state object, make one machine the authority, and have the second machine send intents / receive state snapshots over the network instead of via local calls. If it's violated (input wired straight into rendering), that's the classic "breaks when we add networking" rewrite. **Follow this from the first line of code.**

**Architecture — build order:**
1. **Single-process solo mode first.** Both games run in one app/tab against the one shared state object. The hot-swap toggle just changes which half receives human intents vs. AI intents — both feed the identical intent path. **No netcode needed to prove the design or the fun.**
2. **Then two-screen.** Promote the state object to an authoritative simulation on one host; the other device sends intents and receives state snapshots on a fixed tick (the synced set is small — salvage total, room states, HP, position, and discrete fire/damage/boarder/arm-fire events). Use whatever's easiest to wire (PeerJS for P2P, or a tiny WebSocket relay). Local twitch animation stays client-side; only the wiring variables are authoritative.

**MVP vertical slice (target for first playable):**
- **Big Guy:** arena, WASD/stick movement, baseline auto-fire, escalating horde spawns, salvage + XP drops, one shared HP bar, visible exterior damage.
- **Little Guy:** reactor (power pips), 2 arm weapon rooms (charge/allocate/man/fire), legs (dodge+speed), shields (layers+regen), one repair loop (fire OR breach), boarders.
- **Wiring:** all three links (salvage economy, live capability incl. arm-fire → Big Guy attacks, damage → specific room crisis), shared fate.
- **Level-up beat** with the throttle (not hard pause).
- **Both corner HUDs.**
- **Solo mode with AI + hot-swap.**

Defer to post-MVP: head/targeting room, coolant/life-support depletion, medbay, bulkhead door control, missile-type third arm, advanced modules (decoy drone / EMP), crew-module roster expansion beyond the starting few, two-screen netcode.

**Tuning targets to protect the two hard rules:**
- Big Guy's baseline auto-fire must be strong enough that he's *fun with zero crew help*, so the crew always feels additive, never like a life-support drip.
- Little Guy must have a satisfying manually-fired heavy weapon from minute one, so the role reads as "gunner + engineer," never "janitor."
- Every interior state change that affects Big Guy should produce a *visible/audible* cue on his side, so the wiring is always felt, never silent.

---

## 11. Open design questions to resolve in playtest

- **Arm targeting:** facing-direction vs. nearest-cluster auto-target vs. Little Guy marking a target zone. Start with facing/nearest; add target-marking only if Little Guy wants more aiming agency.
- **Overcharge/push mechanic (5.4):** include from the start for depth, or add later once the base loop is proven? Recommend prototyping the base loop first, then adding push as the first depth layer.
- **Level-up cadence:** how often the shared pick fires — frequent small picks (more shared beats, more throttle interruptions) vs. rarer meaty picks. Tune against Big Guy's flow.
- **Salvage sink balance:** crew vs. system upgrades vs. new weapons — make sure no single sink dominates, so Little Guy's shopping stays a real choice.

---

## 12. Prototype quickstart (concrete starting points)

Everything here is a **placeholder to unblock the first build** — pick these unless the design body says otherwise, and expect to tune all numbers in playtest. The point is that the coder should never have to stall on "what value / what layout / what control."

### 12.1 Controls (MVP, keyboard + mouse)
- **Big Guy:** WASD / arrows to move. Movement only — auto-fire and arm-fire are not his inputs. (Gamepad stick later.)
- **Little Guy (mouse-driven, FTL-style):**
  - Click a goblin to select, click a room to send it there.
  - Click a system's power bar (or +/− on it) to allocate/deallocate a reactor pip.
  - Click a charged arm's fire button (or press its hotkey) to fire it.
- **Hot-swap (solo mode):** a single key (e.g. **Tab**) toggles which half the human controls; AI takes over the half just left. On-screen indicator shows which half is human right now.

### 12.2 MVP interior layout (the FTL grid)
A small fixed layout for the first build — a 2-wide, roughly body-shaped grid readable as a goblin silhouette:

```
        [ HEAD/target ]        (post-MVP)
   [ L.ARM ]  [ REACTOR ]  [ R.ARM ]
   [ SHIELD ]            [ REPAIR BAY ]
        [ L.LEG ]  [ R.LEG ]
```
- MVP rooms: **Reactor, L.Arm, R.Arm, Shield, L.Leg, R.Leg, Repair Bay.** (Head/targeting, coolant, medbay-vs-repair split, bulkhead doors = post-MVP.)
- Rooms are connected orthogonally; goblins walk tile-to-tile between them (FTL movement).
- Start with **3 goblins** and **enough reactor pips to power ~2–3 systems at once** — so allocation is an immediate, meaningful squeeze, exactly like FTL's opening.

### 12.3 Two currencies (keep them distinct)
- **XP orbs** → fill the XP bar → trigger the **level-up pick** (a *free* choice, Megabonk-style). Not spent; just a threshold.
- **Salvage** → the spendable economy → Little Guy buys reactor pips, system upgrades, new goblins, new arm weapons. This is FTL's scrap.
- Both drop from Big Guy's kills. Keep them as two separate tracks in the state object.

### 12.4 Run structure & lose condition (MVP)
- **Endless survival.** Difficulty ramps on a clock; there is no "win," the goal is to last.
- **Score = time survived** (show a run timer). Optionally also show kills.
- **Lose:** the run ends when Scrapwalker's shared HP hits zero (§7.4). Show a summary (time, level reached, kills), then restart.

### 12.5 MVP enemy set (3 types is enough to prove the loop)
- **Swarmer** — weak, numerous, slow. The baseline horde; feeds most XP/salvage. (Instanced.)
- **Runner** — fast, fragile; punishes bad positioning by closing distance. (Instanced.)
- **Bruiser (elite)** — slow, tough, hits hard; its hits are the ones that roll for **fire / breach / boarders** on the interior (§7.3). This is the enemy that creates Little Guy's crises. Telegraph it clearly.

### 12.6 MVP level-up pick pool
When the XP bar fills, Little Guy picks one of ~3 offered options drawn from: **+1 reactor pip**, **upgrade a system one tier** (arm charge speed, shield layer, leg bonus), **+1 goblin**, **+max HP / regen**. (New arm weapon types can enter the pool post-MVP.)

### 12.7 Placeholder starting values (tune later — just so nothing is undefined)
- Shared HP: ~100. Bruiser hit ~15, Runner ~6, Swarmer ~2.
- Reactor: start ~4 pips; each system costs 1–2 pips to run a meaningful tier.
- Arm charge: ~3–4s base, ~40% faster when manned.
- Shield: 1 layer per powered tier, regen ~4s per layer (~2s when manned).
- Legs: each powered tier +dodge% and +move speed; manned adds a further step.
- Salvage: Swarmer ~1, Runner ~2, Bruiser ~8. First upgrade tier ~10–15 salvage.
- Difficulty ramp: spawn rate and enemy toughness step up every ~30s; introduce Bruisers around ~60–90s.
- Level-up throttle window (§6): ~3–5s of thinned/slowed spawns while Little Guy picks.

---

## 13. Readiness checklist (is this MD enough to start coding?)

**Yes — a coding agent can build the MVP from this document.** Confirmed in place:
- ✅ Both game loops fully specified against clear reference games (§4, §5).
- ✅ The attack reconciliation resolved — baseline auto-fire (Big Guy) + crew-fired arms (Little Guy) (§4.2).
- ✅ All three wiring links defined, both directions, plus shared fate (§7).
- ✅ HUD purpose and contents for both screens (§8).
- ✅ Modes defined, with solo-mode-with-AI as the first build target and test harness (§9).
- ✅ Stack (three.js + 2D), performance rules (instancing/pooling), and the sim/render/input separation as a hard requirement for later sync (§10).
- ✅ Concrete controls, interior layout, currencies, run structure, enemy set, pick pool, and placeholder numbers (§12).
- ✅ Art direction and unified theme (§3).

**Deliberately deferred (not needed for MVP, documented for later):** head/targeting room, coolant/life-support, medbay/bulkhead detail, third arm type, advanced modules, roster expansion, and two-screen netcode (§10 build order, §5 deferrals).

**The two things you'll still decide by feel, not spec** (and that's correct — they're playtest calls, flagged in §11): exact tuning numbers, and the level-up cadence. Everything structural is pinned.

**Suggested first prompt when you upload this:** ask for the §9.2 solo-mode MVP only — the shared state object, both loops, the AI operator, both HUDs, and the hot-swap toggle — built with the §10 separation rules and §12 concrete values. Explicitly say to stub the deferred systems. That keeps the first build scoped to something that actually compiles and plays, rather than the whole spec at once.
