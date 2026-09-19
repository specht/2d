# 2D Game Studio — notes for future development sessions

Read `TODO.md` and inspect the current repository before proposing changes. This is a visual game-making tool used by children, and hundreds of existing games have been saved. The TODO is a collection of ideas and reports, **not** a list of verified bugs or approved feature designs.

## Working agreement

- **Advice and patches only.** Never push to GitHub, create remote branches or pull requests, commit changes, or modify this repository on the user's behalf. Provide a patch based on the current branch for the user to inspect and apply locally. Do not assume a previous patch or this file has been applied.
- **Saved JSON is a compatibility contract.** Old game descriptions must load unchanged. Preserve existing trait/state/property names, array layouts, defaults, references, and the meaning of absent fields. Do not require users to migrate or re-export games. New features should use optional fields with legacy-compatible defaults.
- **Preserve established gameplay.** Runtime internals may change, but assess any visible change to old games. Identify an intentional bug fix and its compatibility implications instead of silently changing existing behavior. Do not enable formerly ignored level-completion conditions for old games without a compatibility strategy.
- **Small cleanup patches first.** Identify and review one contained issue at a time, explain the change and supply short, practical manual checks for existing and new games. Automated tests are welcome when they materially help with a tricky change, but a large test suite is **not** a prerequisite for cleanup.
- Keep the visual trait-based editor approachable; avoid large rewrites, unnecessary JSON migrations, or a generic ECS/physics framework as a default solution.

## Immediate direction

Begin with the door-and-key workflow: placed checkbox values, matching initial visual state, and clear guidance about required door states. Reinspect the source and check what has already been changed before preparing the next patch. Other possible cleanup items from source review include shared enemy health, animation timing, level creation, music transitions, incomplete level-end conditions, sprite selection, and the reports in `TODO.md`. Treat these as issues to verify, not as fixes already completed.

## Agreed concepts for **later**, not requests to implement during cleanup

- **Combat:** Melee normally attacks in the character's facing direction using one attack key. Ranged attacks can shoot in the facing direction using an attack key or optionally aim and shoot with the mouse. Four directional attack keys are not the chosen default. Consider mobile controls and camera rotation.
- **Gravity and camera:** Entering a region or activating a switch may change gravity; the camera can rotate so gravity appears to point down on screen. Keep world coordinates, camera orientation, and screen-relative input distinct. Existing games retain their normal downward gravity.
- **Houses:** Prefer a cutaway interior at the *same world position*. On entry, hide or fade exterior artwork to reveal the inside; restore it on exit. Do not default to teleportation or level reload. Visibility and collision are separate concerns.

## Student-facing language and help

All student-facing labels, explanations, hints, tutorials, and warnings must be **in German**. Retain established gaming terms such as *Hitbox*, *Knockback*, *Cooldown*, and *Coyote Time*, explaining them in German as needed. Make doors and keys easier to configure with contextual help: explain `geschlossen`/`geöffnet` states, the optional `Übergang` animation, and matching door/key codes on placed sprites. Do not overwrite student artwork.

## Code map

- `src/static/traits.js`: trait and state metadata.
- `src/static/game.js`: studio editor and data normalization (`fix_game_data`).
- `src/static/level_editor.js`, `src/static/widgets.js`: placement controls and UI widgets.
- `src/static/app.js`: gameplay runtime, door/key interactions, collisions, camera.
- `TODO.md`: historical ideas and bug reports; the decisions above supersede conflicting older proposals.

Be clear whether an observation came from source review, an isolated check, or a real browser/gameplay test. Never claim existing games were tested unless they actually were.
