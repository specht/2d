# 2D Game Studio — handoff and next steps

**Repository:** https://github.com/specht/2d  
**Working branch:** `combat`
**Context:** This is a child-oriented 2D game engine with hundreds of existing student games. The user wants incremental improvements and small, focused patches, not a rewrite. All student-facing UI/help should be in **German** (common English gaming vocabulary is OK with a clear explanation). **Keep existing game JSON and legacy gameplay compatible** unless a behavior change is explicitly agreed. Do **not** write to, commit to, or push to GitHub or the user's local checkout: inspect the public repository read-only and supply a patch that the user can apply and test.

## Current state (verify against the branch before each patch)

**Verified source snapshot (2026-09-20):** `combat` @ `23cda8f4567429157e1277d6772128e8f9d574ac`. The user confirmed that the mouse-click and bomb-wall fixes work in-game and committed/pushed them. Shared actor/baddie melee, optional Angriff/Treffer states and hit feedback, projectile gravity and mouse aiming, left-click shooting, and dropped/thrown bombs with one-shot Zündschnur/Explosion, wall/floor handling, optional shake and opt-in owner self-damage are implemented. These are targeted gameplay confirmations, **not** comprehensive saved-game regression tests.

**Current task:** Focus on **seamless interiors**. Do not implement collectible ranged ammunition now. Keep the work in small, backward-compatible patches; the combat document owns future combat details and recipes.

**Still deferred:** Generic two-sided stomp and other reusable area editor geometry, ray/laser deliveries, per-attack cooldown HUD, consumable ammunition and pickups, extra attack slots, changes to overall level gravity, and browser-captured student documentation. Bomb radius damage does not imply a general-purpose area attack editor.

## Next focus: seamless interiors (design, not implemented)

**Goal:** Build an exterior and a furnished interior at the **same world coordinates**. Approaching/entering reveals the interior by hiding only the house's decorative cover (facade, roof), and leaving restores it. No teleportation or level reload; no change in unmarked old levels.

**Existing runtime seams:** Levels have sprite/backdrop layers and placed `[sprite_index, x, y, optional_properties]` entries. `app.js` creates a `game_layer` for each layer, separately registers collidable placed sprites in `active_level_sprites` and interval trees, and renders sprites through their meshes. The editor has layer-visibility controls; do **not** hide a whole global layer when unrelated houses share it. Doors already have independent opening and collision state.

**First implementation direction:** Introduce an *opt-in room region* with explicit world bounds and a stable per-house identity. Associate only dedicated facade/roof *decorative* meshes with that room; let the player entering/leaving the region toggle their visibility. Interior geometry, solid walls, doors, furniture, enemies, pickups and collision must remain independent of facade visibility. Define room boundary, initial state, enter/exit hysteresis and what happens at a doorway before coding. A single-room prototype is fine, but its grouping must not hide another house by accident.

**Checks for the first interiors patch:** Starting outside shows the exterior. Entering reveals the room at the same player position, exiting restores the cover. Existing blocking/door/key behavior is unchanged and remains stable when art is hidden; restarting cleans up room state; unmarked levels behave exactly as before. Test two separate houses or demonstrate that the initial implementation explicitly supports only one. Inspect the live browser as well as focused source-level tests.

## Combat architecture (deferred while interiors are active)

`CombatSystem` validates attacks, tracks owner-local cooldowns and dispatches shared melee/projectile/bomb damage for actors and baddies. Preserve the legacy `sword` compatibility adapter and saved JSON. When combat resumes, treat bilateral stomp, rays/lasers, cooldown display and optional collectible ammunition as **separate** milestones rather than unfinished parts of the existing bomb feature.

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

**Patching requirement:** Pin the current `combat` HEAD, verify changes against the exact full source where possible, and report the scope of actual verification. Previous patches failed because of inaccurate context; a reconstructed excerpt alone does not establish full-repository applicability. Confirm the downloadable patch exists before linking it. Never write to GitHub on the user's behalf.

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
- **Seamless interiors (active design above):** Same-world cutaway controlled by an opt-in room region and that room's cover artwork only. Decide grouping and doorway semantics before coding; never conflate visual occlusion with blocking physics.
- **General small cleanups:** Investigate only with current source and reproducible behavior. Avoid repeated broad refactors or compulsory large test suites.

## Workflow for the next chat

1. Read `AGENTS.md`, this file and, for combat work, `2d-combat-design-and-recipes.md`. Inspect the current `combat` branch read-only at https://github.com/specht/2d and pin its HEAD. Do not assume an old SHA or the user's working tree matches GitHub.
2. Make **one small patch per iteration**, with no write access to GitHub. Keep changes backward compatible, preserve saved game data, and use German language for student-facing UI/help.
3. Generate a real downloadable `.patch`, validate its hunks against the **complete exact original source** where possible, and provide `git apply --check ...` followed by `git apply ...`, plus a concise, targeted manual test. Never claim browser tests were run if they were not.
4. After the user tests and commits, continue to the next focused issue. They prefer quick iteration, concrete code, and minimal questions when intent is clear.
