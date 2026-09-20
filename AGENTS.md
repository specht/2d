# 2D Game Studio — notes for future development sessions

Read `TODO.md` and inspect the current repository before proposing changes. This is a visual game-making tool used by children, and hundreds of existing games have been saved. The TODO is a collection of ideas and reports, **not** a list of verified bugs or approved feature designs.

## Working agreement

- **Advice and patches only.** Never push to GitHub, create remote branches or pull requests, commit changes, or modify this repository on the user's behalf. Provide a patch based on the current branch for the user to inspect and apply locally. Do not assume a previous patch or this file has been applied.
- **Saved JSON is a compatibility contract.** Old game descriptions must load unchanged. Preserve existing trait/state/property names, array layouts, defaults, references, and the meaning of absent fields. Do not require users to migrate or re-export games. New features should use optional fields with legacy-compatible defaults. When modernizing mechanics, prefer a runtime compatibility adapter over rewriting stored JSON; keep legacy semantics and define explicit precedence if old and new fields coexist.
- **Preserve established gameplay.** Runtime internals may change, but assess any visible change to old games. Identify an intentional bug fix and its compatibility implications instead of silently changing existing behavior. Do not enable formerly ignored level-completion conditions for old games without a compatibility strategy.
- **Small, focused patches.** Implement one agreed issue or milestone at a time, explain the change and give practical checks for existing and new games. Add focused automated tests where they help; never substitute isolated tests for browser/gameplay verification.
- Keep the visual trait-based editor approachable. Separate **control**, **movement/physics**, **abilities** and **presentation** where practical; combine capabilities through traits instead of hardcoding platformer-only character classes. Do not begin a wholesale ECS/physics rewrite.

## Current direction and document ownership

Read `2d-game-studio-next-steps.md` for the active branch, confirmed features and future roadmap. Read `2d-combat-design-and-recipes.md` for combat contracts and recipes. This file contains only standing rules; `TODO.md` is historical feedback rather than an approved feature list. Always inspect the current source instead of relying on old handoff SHAs.

## Established behavior and design boundaries

- **Seamless interiors are implemented:** A named Sichtbarkeitsbereich targets one layer via player-position rectangles; optional fading is visual only. Dedicated facade/roof art should have collision explicitly disabled. Hidden layers must retain their existing gameplay/collision structures.
- **Combat foundation is implemented:** Shared actor/baddie melee, ranged projectiles and timed bombs; preserve legacy attacks and J/K/F controls. Instant lasers, bilateral area attacks, cooldown HUD and collectible ammunition remain distinct future proposals.
- **Movement and gravity remain separate ideas:** Keep control, movement/physics, abilities and presentation conceptually separate. Variable gravity/camera changes must be opt-in; old games retain established downward gravity.

## Student-facing language and help

All student-facing labels, explanations, hints, tutorials, and warnings must be **in German**. Retain established gaming terms such as *Hitbox*, *Knockback*, *Cooldown*, and *Coyote Time*, explaining them in German as needed. Make doors and keys easier to configure with contextual help: explain `geschlossen`/`geöffnet` states, the optional `Übergang` animation, and matching door/key codes on placed sprites. Do not overwrite student artwork.

## Code map

- `src/static/traits.js`: trait and state metadata.
- `src/static/game.js`: studio editor and data normalization (`fix_game_data`).
- `src/static/level_editor.js`, `src/static/widgets.js`: placement controls and UI widgets.
- `src/static/app.js`: gameplay runtime, door/key interactions, collisions, camera.
- `src/static/visibility_regions.js`: opt-in layer targets and visual-only fading.
- `src/static/combat.js`, `src/static/combat_swing.js`, `src/static/combat_projectile.js`, `src/static/combat_melee_trait.js`: shared attack, melee, projectile/bomb deliveries and legacy/new trait adapters.
- `TODO.md`: historical ideas and bug reports, not an implementation contract; newer decisions in the two project documents supersede conflicting suggestions.

Be clear whether an observation came from source review, an isolated check, or a real browser/gameplay test. Never claim existing games were tested unless they actually were.
