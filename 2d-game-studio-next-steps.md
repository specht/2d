# 2D Game Studio — handoff and next steps

**Repository:** https://github.com/specht/2d  
**Working branch:** `combat`
**Context:** This is a child-oriented 2D game engine with hundreds of existing student games. The user wants incremental improvements and small, focused patches, not a rewrite. All student-facing UI/help should be in **German** (common English gaming vocabulary is OK with a clear explanation). **Keep existing game JSON and legacy gameplay compatible** unless a behavior change is explicitly agreed. Do **not** write to, commit to, or push to GitHub or the user's local checkout: inspect the public repository read-only and supply a patch that the user can apply and test.

## Current state (verify against the branch before each patch)

**Verified branch snapshot (2026-09-20):** `master` @ `d716258afcd1b7d3104e082f6ca7ad5e18f7a38b` → `combat` @ `f21468fdd2beb2cffb7f6ff043c18a857445d971` (10 commits ahead at review). The pushed branch contains the shared `CombatSystem`, owner-local cooldown/hit records, forward swing for actor and baddie, the generic **Nahkampfangriff** editor trait (damage/reach/cooldown/swoosh), a compatibility adapter for saved `sword` data, touch attack, and compact editor help/CSS. The user has confirmed gameplay for earlier melee/UI work; no comprehensive old-game/browser regression suite is claimed. M1h **Trefferstern/POW** editor control and renderer are now committed and pushed; its separate test file is not tracked in the inspected branch. The user has tested the visual effects in-game, but no comprehensive regression test is claimed.

**Current task: review and document before another gameplay patch.** Keep combat open as a branch for small, separately testable steps. With M1h confirmed on the branch, first design and implement optional actor/baddie **Angriff/Treffer** states and target-owned hit reactions without coupling animation to collision or cooldown. Move the existing procedural effects onto the game's logical pixel grid. Next use a bilateral **Flächenangriff** (e.g. ground stomp) to test the extensibility of attack delivery. Optional per-attack cooldown HUD and collected-item costs are separate milestones; see the combat document for contracts and deliberate exclusions.

**Not yet present on the inspected remote branch:** optional character attack/hit states, a bilateral area/stomp delivery, per-attack cooldown HUD, general inventory/consumable costs, ranged/projectile/ray/laser delivery, and tested/published student combat recipes. Avoid presenting planned features as working; verify newer commits before each change.

## Combat architecture review — implementation order and boundaries

The `master...combat` diff is our baseline, not a cue for an engine rewrite. The generic `CombatSystem` validates an attack and owns timing, target eligibility and damage; `register_swing` is **one delivery**, not the definition of all attacks. The new `melee_attack` trait is a small editor/JSON adapter; keep the player and baddie on the same execution path. Preserve old games with no combat trait and the existing `sword` definitions without automatically rewriting them.

**Next focused milestones (one patch and specific tests at a time):** (1) optional attacker **Angriff** and target **Treffer** states and target-owned feedback, with death taking precedence and no required drawings; (2) crisp, grid-aligned procedural hit/swing effects with separate visual lifetimes; (3) shared symmetric **area** delivery for a ground stomp, usable by actor and baddie; (4) an opt-in, compact cooldown/availability indicator for each playable attack; (5) minimal, optional stockable resources and pickup/cost integration. Ranged projectiles and rays remain important subsequent deliveries; do not block simple area attacks on their completion. Child-facing settings should expand only when their feature works.

**Do not multiply editor traits by weapon.** Keep a small number of understandable capabilities (Nahkampfangriff, later Fernkampfangriff, possibly Flächenangriff only if useful in actual authoring). A punch, sword, ram and ground stomp can choose different delivery geometry, triggers and visuals while reusing one effect/timing/eligibility pipeline. A projectile and torpedo similarly share mechanics across platformer and submarine characters. Implement only the minimum new runtime seam required by each example; do not introduce a general ECS, compulsory inventory or universal HUD.

**Regression gates:** current-player and baddie symmetry, two placed instances of the same baddie, old JSON round-trip, no extra J/touch/visual/HUD in games without opt-in attacks, hit once per target, cooldown not reset by an animation, impact reaction never reviving/overriding `dead`, inventory spent once per accepted activation (not per target), and restart/level-change cleanup. Details and examples live in `2d-combat-design-and-recipes.md`; don't duplicate them here.
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
- Editor traits such as **Nahkampfangriff** and later **Fernkampfangriff** are authoring interfaces for the **same runtime combat machinery**. Existing `actor.attacks` / `baddie.attacks` JSON must remain readable during the transition. A weapon name is a label/preset, not a distinct combat class. Detailed combat contracts belong in `2d-combat-design-and-recipes.md`.

## Other deferred backlog

- **Level-end conditions:** The editor exposes `touching_level_complete`, `min_points`, `need_sprite`, and `killed_baddie`; the runtime currently handles `level_complete` contact, but does not enforce the other conditions. The editor has been updated to mark inactive options honestly. Before activating any, decide how to opt in so older levels containing these values do not suddenly become impossible to complete. Clarify combination semantics (AND/OR), count/percentage measurement, and UI feedback; implement as a separate, carefully scoped feature.
- **Combat extensions:** Implement the reviewed visual/animation, symmetric-area, opt-in HUD and optional item-cost milestones independently, then generic ranged/projectile/laser deliveries for both actor and baddie. The current branch does not yet contain them. The combat document owns exact contracts, UI examples and test cases.
- **Gravity zones/switches:** Variable gravity per area, with smoothly rotating camera so gravity appears visually downward. Default remains existing downward gravity for old games. Requires a considered physics/camera design rather than a small blind patch.
- **Seamless interiors:** Preferred approach is house inside and exterior at the **same world coordinates**, hiding the roof/front wall as the player enters, not teleporting to a separate room. Design an opt-in rendering/visibility mechanic that does not break old layers.
- **General small cleanups:** Investigate only with current source and reproducible behavior. Avoid repeated broad refactors or compulsory large test suites.

## Workflow for the next chat

1. Read `AGENTS.md`, this file and, for combat work, `2d-combat-design-and-recipes.md`. Inspect the current `combat` branch read-only at https://github.com/specht/2d and pin its HEAD. Do not assume an old SHA or the user's working tree matches GitHub.
2. Make **one small patch per iteration**, with no write access to GitHub. Keep changes backward compatible, preserve saved game data, and use German language for student-facing UI/help.
3. Generate a real downloadable `.patch`, validate its hunks against the **complete exact original source** where possible, and provide `git apply --check ...` followed by `git apply ...`, plus a concise, targeted manual test. Never claim browser tests were run if they were not.
4. After the user tests and commits, continue to the next focused issue. They prefer quick iteration, concrete code, and minimal questions when intent is clear.
