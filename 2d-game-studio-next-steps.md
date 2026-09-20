# 2D Game Studio — handoff and next steps

**Repository:** https://github.com/specht/2d  
**Active branch:** `master`; the `combat` feature work was merged and pushed on 2026-09-20. Verify the actual branch and HEAD again before every patch.
**Audience/contract:** A child-oriented 2D editor with hundreds of existing saved games. Only give reviewable downloadable patches; never alter the user's checkout or GitHub. Preserve old JSON/defaults/gameplay. All student-facing UI and help must be in German.

## Current status (handoff, 2026-09-20)

**Verified remote source:** `master` @ `e407c4644452e9d36d6650597cba7c0df1636c9c`. The user confirmed in-game that Sichtbarkeitsbereich, optional fade and the horizontal-overflow fix work; they merged to `master` and pushed. These are targeted user confirmations, not exhaustive browser or legacy-saved-game tests.

**Seamless interiors are implemented, not pending.** A named `visibility_region` / **Sichtbarkeitsbereich** layer controls one other layer through a stable target ID. Its rectangle union tests the *current centre of the player* and applies **Im Bereich: sichtbar/versteckt** (the inverse outside). Target IDs are assigned only when a creator selects a target; merely loading a legacy game does not give all layers IDs. Duplicate/invalid target configurations are inert. Dedicated facades allow two houses to behave independently. **Überblendung** is optional (`fade_seconds` 0–2 s; omitted/0 is immediate); fade direction can reverse, while initial spawn and respawn set visibility immediately. Separate fading materials reuse the original atlas texture; the sidebar no longer overflows horizontally.

**Authoring/collision contract:** Put facade and roof art in their own sprite layer above the furnished interior, at the **same world coordinates**. Disable **Kollisionen erkennen** on that decorative layer explicitly. A hidden layer's meshes are not removed from collision, door, enemy or pickup structures; other gameplay objects remain active. No level reload, generic events, hysteresis, door-linked fade or new behavior in levels without visibility regions.

**Source/tests:** `src/static/visibility_regions.js` resolves rules and manages private fade materials; `src/static/app.js` builds collision objects independently and updates visibility; `src/static/level_editor.js` edits layer names, targets, rectangles and fade. `test/visibility_regions.test.cjs` covers geometry, references, restart, material independence and atlas texture reuse.

## Roadmap: candidates, one focused patch at a time

1. **German house-building recipe and contextual help.** Document exactly how to draw a furnished interior, create a separate noncolliding facade/roof, select the facade in a Sichtbarkeitsbereich, adjust several rectangles, choose an optional 0.4 s fade, and test spawn/respawn and two houses. Check the published steps against the live editor first.
2. **Combat: instant laser for BOTH actor and baddie.** Reinspect current `CombatSystem`, collision and door logic first; use one shared ray/hit pipeline with nearest obstacle/target, solid walls and closed doors blocking, and a procedural beam so children need no laser sprite. Test both sides and their independent cooldowns. A sustained beam is another feature, not part of the instant-ray slice.
3. **Combat: symmetric ground stomp / horizontal area pulse.** Separate milestone: configurable extent to both sides for actor and baddie, clear ground/obstacle policy, once-per-target hits. Do not silently generalize bomb explosions into a full area editor.
4. **Optional future combat polish:** Per-attack cooldown display, additional slots and German recipes for playable mechanics. Collectible ammunition remains deliberately paused pending a separate inventory/reset design.
5. **Longer-term, independent engine ideas:** Free-swimming/submarine movement with separate control/physics, gravity regions plus camera rotation, opt-in activation of currently inactive level-completion conditions, and optional once-per-enemy falling-block damage. Preserve all old defaults and do not bundle these with combat/interiors.

**Handoff decision:** These are proposals, not approval to implement everything. On resumption, choose one small slice with the user. Do not reopen completed interiors unless there is a reproducible bug or an agreed improvement.

## Earlier cleanup history (archive; not the active task)

Earlier fixes through the level-exit bounds change were user-confirmed. Historical patch names and statuses below describe the earlier work; inspect the current source rather than treating older `master`-era uncertainty as current branch status.

| Work item | Status / notes |
| --- | --- |
| Door/key initial state, editor property help, compact checklist presentation | Earlier user-confirmed work. Preserve existing door behavior. |
| Level-editor creation/renaming issues | Earlier patch; user proceeded. |
| Current-level music and silence handling | Earlier patch; verify state in repo if touching music. |
| Placed-sprite property association in runtime and editor | User explicitly said all work through this point was committed and pushed. |
| Preserve `min_points_percent` | User confirmed all work through subsequent level-exit patch committed and pushed. Existing configured percentage must not be reset to 100; missing value defaults to 100. |
| Label unused level-end conditions accurately in editor | User confirmed all work through subsequent level-exit patch committed and pushed. These conditions are **not** implemented in the runtime; do not silently activate them. |
| Level-exit bounds checking | User explicitly confirmed committed and pushed. A `Delta` pointing outside the level list should take the existing `THE END` path, not access a nonexistent level. |
| Per-enemy health | Patch supplied: `2d-enemy-instance-health.patch`. On a subsequent read of `master`, `src/static/app.js` **did** contain `this.energy -= damage`, so the change appears present remotely. Each enemy should have runtime health initialized from its sprite's `Energie`; never decrement the shared sprite trait's energy. |
| Skip inactive enemies when querying collision index | Patch supplied: `2d-enemy-collision-active-only.patch`. **Application/commit not confirmed** in conversation. Check current `master` or ask for the outcome. The change should skip inactive enemies in `has_baddie_at()` even when the interval tree is stale until the following frame. |

**Patching requirement:** Check the current *active* branch/HEAD, not the historical `combat` SHA above. Generate and verify an actual patch against complete source files before linking it. Never write to GitHub for the user.

## Deferred cleanup idea: falling-block damage

A previously discussed optional **one hit per enemy per falling block** setting remains a separate proposal, **not** the next combat task. Missing/false must preserve legacy repeated damage; first recheck present runtime behavior before implementation.

**Current behavior to check in `src/static/app.js`:** falling blocks are stored in `this.falling_sprite_indices`. Each simulation step updates a falling block's position; if `falling_sprite.damage > 0`, the block queries `this.has_baddie_at(...)` and calls `baddie.take_damage(falling_sprite.damage)`. The same block can therefore hurt a continuously overlapping enemy on every step. The current query returns at most one enemy, so the precise behavior of blocks passing through multiple or overlapping enemies needs inspection before changing it.

**Proposed design:**

1. Identify the existing `falls_down` trait definition, defaults, editor controls and runtime initialization. Add an **optional bool** to the sprite's falling-block trait, with an expressive name such as `damage_once_per_enemy` and a short German label/help. Absence or `false` preserves the old repeated-damage behavior. Do not add a mandatory migration or alter existing games' JSON on load unnecessarily.
2. When the option is enabled, hold a **per-falling-block, runtime-only** `Set` of enemy *instance identities* already hit during this fall. An enemy hit once by that block must not be damaged again by the same block; different blocks can each hit that enemy. If a block can hit multiple enemies during one step, be deliberate about whether to extend collision queries or preserve current at-most-one-target semantics—avoid unannounced behavior changes in legacy mode.
3. Clear the set naturally when a falling block is removed, a new fall begins, or the level is reinitialized. Never persist the set in game JSON. Respect inactive enemies and avoid callbacks/damage to dead enemies.
4. Manually check **both modes**: a legacy block repeatedly damages as before; an opted-in block hurts a particular enemy once, can hurt a second enemy during the same fall, and a different block can hurt the first enemy independently. Also check level restart and old game files without the new property.

Do **not** conflate this patch with new melee/ranged attacks, energy-balancing changes, or a global change to all falling blocks.

## Project-wide trait direction (design intent, not implemented)

- Keep **who controls a sprite** (player / AI), **how it moves** (platformer / free underwater movement), **what it can do** (attacks / interactions) and **how it looks** (sprite states / effects) conceptually separate. Prefer adding approachable, composable traits rather than a hardcoded submarine or spaceship character class. This is an architectural direction, not a request for an ECS rewrite.
- A submarine is the next architectural test case: player-controlled and AI-controlled submarines should share movement and projectile mechanics, with different control sources. **Free swimming, buoyancy, torpedoes and new movement modes do not exist yet.** A movement mode must have clear precedence; never let competing controllers independently move the same object.
- Interpret old `actor`/`baddie` movement properties using an **in-memory compatibility adapter** when introducing new movement traits. Do not eagerly rewrite old game JSON on load/save, force exports, or alter absent-field defaults. Specify precedence if old and new traits coexist, preserve legacy movement/collisions/input in regression tests, and migrate saved data only through a deliberately designed opt-in edit path.
- **Nahkampfangriff** and **Fernkampfangriff** already configure the same shared runtime, including projectiles and bombs; existing `actor.attacks` and `baddie.attacks` remain readable. New movement and interior properties should follow the same opt-in, legacy-safe rules. Combat-specific contracts belong in `2d-combat-design-and-recipes.md`.

## Other deferred backlog

- **Level-end conditions:** The editor exposes `touching_level_complete`, `min_points`, `need_sprite`, and `killed_baddie`; the runtime currently handles `level_complete` contact, but does not enforce the other conditions. The editor has been updated to mark inactive options honestly. Before activating any, decide how to opt in so older levels containing these values do not suddenly become impossible to complete. Clarify combination semantics (AND/OR), count/percentage measurement, and UI feedback; implement as a separate, carefully scoped feature.
- **Combat extensions (deferred):** Generic stomp/area delivery, ray/laser, opt-in cooldown HUD, finite ammunition and pickup/cost integration remain separate milestones. The ranged and bomb deliveries, mouse firing and basic attack/hit visuals are already present.
- **Gravity zones/switches:** Variable gravity per area, with smoothly rotating camera so gravity appears visually downward. Default remains existing downward gravity for old games. Requires a considered physics/camera design rather than a small blind patch.
- **Seamless interiors (implemented):** Opt-in room regions, named per-house facade layers and visual-only optional fades are merged in `master`; see the current-status section above. Hysteresis, door dependencies and generic events are not part of this release.
- **General small cleanups:** Investigate only with current source and reproducible behavior. Avoid repeated broad refactors or compulsory large test suites.

## Workflow for the next chat

1. Read `AGENTS.md`, this roadmap and, when relevant, `2d-combat-design-and-recipes.md`. Treat `TODO.md` as historical feedback, not an implementation contract. Recheck the **current** branch/HEAD and relevant complete files; the snapshot here will become stale.
2. Agree on one small change. Keep existing games and saved JSON compatible; make student-facing labels/help German. No GitHub writes, commits or pushes on the user's behalf.
3. Deliver an actual downloadable `.patch`, not a patch generator. Validate `git apply --check` against complete original files, include `git apply` and focused test commands, and state clearly which checks were automated versus user-confirmed in a browser.
4. For any interior regression check entering/leaving, spawn/respawn, two houses, multiple rectangles, renamed/reordered targets, invalid references, transitions, textures, collision independence and old levels. For new attacks, test actor and baddie symmetrically.
