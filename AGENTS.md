# 2D Game Studio — notes for future development sessions

Read `TODO.md` and inspect the current repository before proposing changes. This is a visual game-making tool used by children, and hundreds of existing games have been saved. The TODO is a collection of ideas and reports, **not** a list of verified bugs or approved feature designs.

## Working agreement

- **Advice and patches only.** Never push to GitHub, create remote branches or pull requests, commit changes, or modify this repository on the user's behalf. Provide a patch based on the current branch for the user to inspect and apply locally. Do not assume a previous patch or this file has been applied.
- **Saved JSON is a compatibility contract.** Old game descriptions must load unchanged. Preserve existing trait/state/property names, array layouts, defaults, references, and the meaning of absent fields. Do not require users to migrate or re-export games. New features should use optional fields with legacy-compatible defaults. When modernizing mechanics, prefer a runtime compatibility adapter over rewriting stored JSON; keep legacy semantics and define explicit precedence if old and new fields coexist. Compatibility is one-way: saving may write a newer format, because only the current code reads saved games. `fix_game_data` must stay deterministic (the same JSON always normalizes to the same result), since content-derived tags and recipe fingerprints depend on it.
- **Preserve established gameplay.** Runtime internals may change, but assess any visible change to old games. Identify an intentional bug fix and its compatibility implications instead of silently changing existing behavior. Do not enable formerly ignored level-completion conditions for old games without a compatibility strategy.
- **Small, focused patches.** Implement one agreed issue or milestone at a time, explain the change and give practical checks for existing and new games. Add focused automated tests where they help; never substitute isolated tests for browser/gameplay verification.
- Keep the visual trait-based editor approachable. Separate **control**, **movement/physics**, **abilities** and **presentation** where practical; combine capabilities through traits instead of hardcoding platformer-only character classes. Do not begin a wholesale ECS/physics rewrite.

## Current direction and document ownership

Keep the active documentation small and purpose-specific:

- `README.md`: what the project is, how games and versions work, architecture and local setup.
- `TODO.md`: the active backlog and open design questions. Remove entries when they are implemented.
- `AGENTS.md`: standing development contracts and code orientation for future development sessions.
- `rezepte/README.md`: recipe authoring, recording and verification.
- `docs/archive/`: historical handoffs and design explorations. They are context only, not current requirements.

Always inspect the current source and `TODO.md` instead of relying on archived handoff SHAs or implementation-status prose.

## Established behavior and design boundaries

- **Seamless interiors are implemented:** A named Sichtbarkeitsbereich targets one layer via player-position rectangles; optional fading is visual only. Dedicated facade/roof art should have collision explicitly disabled. Hidden layers must retain their existing gameplay/collision structures.
- **Combat foundation is implemented:** Shared actor/baddie melee, ranged projectiles and timed bombs; preserve legacy attacks and J/K/F controls. New attack families must use the same owner-neutral combat machinery for actor and baddie from their first playable version rather than creating a second enemy-only or player-only damage system.
- **Combat rules are independent of artwork:** Delivery, targeting, damage, timing and hit geometry come from combat configuration and runtime state, never from image pixels, frame count or sprite colour. Optional attack/hit/death animation states are presentation and must not silently change damage or collision semantics. Projectiles and other attack visuals likewise do not inherit unrelated placed-sprite traits.
- **Future combat stays incremental:** Instant lasers/rays, reusable area attacks, cooldown feedback and finite ammunition remain separate backlog items. A continuous beam is a distinct mechanic from an instant ray because it needs explicit re-hit/interrupt timing.
- **Collaboration is explicit and capability-by-link:** Do not introduce accounts, ownership or private-game permissions just to support live collaboration. A normal public game code may continue to let anybody open and save a descendant, but joining an active shared editing session requires its own hard-to-guess temporary session link/code. Every participant supplies a session-local display name; use it for presence and lock/conflict messages, but never treat it as authentication or durable ownership metadata. Address sprites and levels by their durable `id`, never by array index; keep session-only metadata (participants, locks, revisions) out of saved JSON. Prefer server-authoritative revisions and small resource leases/locks for the first implementation over a wholesale CRDT rewrite. The server never interprets references between resources; every editor action that adds, deletes or moves a sprite or level must call `window.collaboration?.structure_changed(kind, action, id)` after changing the local list (and lists offer `can_delete_index` so a locked item cannot be deleted). Anything that replaces the studio's game with another one must not do so silently during a session: `game.load()` is already guarded, other paths call `window.collaboration.confirm_leave('load', proceed)` first. Shared saves must still go through the established immutable game/version path.
- **Sprites and levels have stable IDs:** Every sprite and level carries a durable `id` (`src/static/game_ids.js`). `fix_game_data` fills in missing, invalid or duplicate IDs deterministically from the position (old games get `s0`, `s1`, … and `l0`, …) and never changes an existing valid ID. Editor actions that create a sprite or level must call `assign_new_game_id` before adding it, so a new object never inherits the ID of a deleted one. References to sprites are stored as sprite IDs: slot 0 of a placed sprite, `hit_sprite_id`/`attack_sprite_id`/`projectile_sprite_id` in attack visuals, `traits.baddie.drop.sprite_id` and `sprite_id` of `need_sprite` conditions. Old games hold indices in the legacy fields (`*_sprite_index`, `sprite_index`, slot 0); `fix_game_data` converts them, and an ID wins if both exist. The game engine keeps working with indices: `app.js` calls `resolve_sprite_references_to_indices` when it loads a game, which also drops references to sprites that no longer exist. The studio keeps unknown IDs until a sprite is deleted (`remove_sprite_references`), and the level editor drops placed sprites whose sprite is missing. Reordering sprites never rewrites references. Any new kind of sprite reference must be added to the walker in `game_ids.js`. State references inside one sprite (door states and the like) are still indices.
- **Movement and gravity remain separate ideas:** Keep control, movement/physics, abilities and presentation conceptually separate. Variable gravity/camera changes must be opt-in; old games retain established downward gravity.

## Student-facing language and help

All student-facing labels, explanations, hints, tutorials, and warnings must be **in German**. Retain established gaming terms such as *Hitbox*, *Knockback*, *Cooldown*, and *Coyote Time*, explaining them in German as needed. Make doors and keys easier to configure with contextual help: explain `geschlossen`/`geöffnet` states, the optional `Übergang` animation, and matching door/key codes on placed sprites. Do not overwrite student artwork.

## Code map

- `src/static/traits.js`: trait and state metadata.
- `src/static/game.js`: studio editor and data normalization (`fix_game_data`).
- `src/static/game_ids.js`: stable sprite/level IDs (`ensure_game_ids`, `assign_new_game_id`) and ID-based sprite references (`convert_sprite_references_to_ids`, `resolve_sprite_references_to_indices`, `remove_sprite_references`).
- `src/static/level_editor.js`, `src/static/widgets.js`: placement controls and UI widgets.
- `src/static/app.js`: gameplay runtime, door/key interactions, collisions, camera.
- `src/static/visibility_regions.js`: opt-in layer targets and visual-only fading.
- `src/static/movement_regions.js`: opt-in Bewegungsbereiche (swim, float, other gravity, currents) for the player character and walking enemies, per rectangle layer or for the whole level.
- `src/static/combat.js`, `src/static/combat_swing.js`, `src/static/combat_projectile.js`, `src/static/combat_melee_trait.js`: shared attack, melee, projectile/bomb deliveries and legacy/new trait adapters.
- `rezepte/`: German how-to recipes for the Hilfe tab. `rezepte/tools/build.mjs` records each recipe's GIF from the real engine in headless Chromium, checks the recipe's promised outcome and writes `src/static/rezepte/` (commit the generated files). Rebuild after gameplay changes; a failing recipe means children would be told something that no longer works. See `rezepte/README.md`.
- `TODO.md`: active backlog and open design questions. It is not proof that a reported bug still exists; verify current source and behaviour before implementing an item.

Be clear whether an observation came from source review, an isolated check, or a real browser/gameplay test. Never claim existing games were tested unless they actually were.
