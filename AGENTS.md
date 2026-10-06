# 2D Game Studio — notes for development sessions

A visual game studio used by children; thousands of saved games depend on it. Read `README.md` (what exists) and `TODO.md` (ideas – not verified bugs, not approved designs), and check the current source before proposing anything.

## Working agreement

- **Advice and patches only.** Never commit, push, branch or open pull requests. Deliver one combined patch against the current upstream branch, named `2d-….patch`, checked with `git apply --check`. Do not assume an earlier patch was applied.
- **No generated media in patches** (`src/static/rezepte/`, `src/static/anleitungen/`): the user renders recipes and guides himself. Run `npm run check` in `rezepte/tools` only when a change could break a recipe, and say so when it was skipped.
- **Saved JSON is a compatibility contract.** Old games load and play unchanged. New fields are optional, absent means the old behaviour, and a runtime adapter beats rewriting stored JSON. Saving may write a newer format. `fix_game_data` stays deterministic (tags and recipe fingerprints depend on it) and never writes placed defaults or editor-only fields.
- **Preserve gameplay.** A visible change to old games is allowed only as a named intentional fix (listed below).
- **Small, focused patches** with practical checks. Tests help but never replace trying it in the browser; say whether something was checked by reading, a test or a real browser – never claim old games were tested when they were not.
- **Traits, not classes:** keep control, movement, abilities and presentation apart; no ECS or physics rewrite.

## Documents

`README.md`: what exists, setup, teacher scripts. `TODO.md`: only what is open (delete an entry when it is done). `AGENTS.md`: contracts and code map. `rezepte/README.md`: recipes and guides. `docs/archive/`: history only. Keep them short – a rule or a pointer here, the details in code comments.

## Student-facing text

German everywhere; keep gaming terms (Hitbox, Knockback, Cooldown, Coyote Time). Say "auswählen", "wählen", "anklicken" – never "nehmen" or "wegmachen". Never overwrite a child's artwork or a name a child typed. Everything new gets a hover title (label, key, what it does) instead of needing a recipe.

## Recipes and guides

- The recipe build fingerprints the engine: `standalone.html` and its scripts, `traits.js`, `baddie_ai.js`, `game_ids.js`, `game.js`, the shaders and `rezepte/tools/{build,record,game}.mjs`. Touching them re-records every recipe, so editor-only code lives elsewhere.
- Guides fingerprint all of `src/static`, but recording is deterministic (the guide clock in `studio.mjs`, `BROWSER_ARGS`): an untouched guide comes out byte for byte the same. Never wait with real time in a guide or the recorder (`waitForTimeout`) – use `GuidePlayer.pass`. A changed label or selector a guide uses is fixed in the guide in the same patch.
- A recipe only promises what works; its `erwartet` checks it.

## Contracts

**Data**
- Sprites and levels carry durable `id`s (`game_ids.js`); `fix_game_data` fills missing ones deterministically, new objects get `assign_new_game_id`. Sprite references are stored as IDs and resolved to indices when the engine loads a game; a new kind of reference goes into the walker in `game_ids.js`. States are referenced by position: new states go to the end, nothing reorders them.
- What a sprite *is* belongs to its drawing (traits); what a placed copy is *connected to* or *where it leads* belongs to the copy (`placed[3]`). All placed settings land on one flat game entry – a name that could clash needs an `entry_key`.
- Editor-only fields (`grid_size`, `locked`, `signal_names`, sprite titles …) are never read by the engine, never written by `fix_game_data`, and removed when set back to the default. `level.conditions` stays as written.

**Signale** (`signals.js`)
- One bus per level; senders and receivers meet by the number `signal_code`, names are labels only. Read codes with `stored_signal_code` (absent → 0, `null` → no signal), never `?? 0`.
- A new sender or receiver uses the bus, has a role in `SIGNAL_SPRITE_ROLES` and a sentence in `signal_rules`, gets a free Code when created (`free_signal_code`), calls `remember_send` if its effect should last, and is checked by a recipe (`erwartet: signale`).
- A layer that is away neither draws nor collides; every collision query goes through `Game.collision_candidates`. Doors never close onto anybody (`door_occupied`).

**Gameplay**
- Combat is one path for player and enemies; damage only through `take_damage` / `apply_hit` (they honour `invincible`). Rules never come from pixels, frame counts or colours.
- Companions never act on the level (collect, press, send, hold doors), are never enemies, and use `companion_random`, never `Math.random`. The level may act on them.
- What "bleibt fürs ganze Spiel" lives in `game.inventory`, emptied only by `reset()`. A weapon changes the figure's attacks at runtime only (`apply_weapons`), never its JSON; a shop item (placed `pickup.price`) is never collected on touch. What the shop says (`shop_text`, `shop_buy_line`, the Verkäufer's `shop_greeting` / `shop_chatter`) uses speech sources starting with `shop`, which never interrupt a sign (`app.js` `shop_*`).
- Moving platforms carry, never push or squash. Exit targets are level ids (`level_flow.js`). A level entered again restores what `level_memory` remembers. Gravity and camera changes are opt-in.
- Speech, HUD and the curtain screens are pixel text drawn into the canvas, never HTML made from names.
- Intentional fixes (old games may differ): a figure without left/right roles faces right; the figure is drawn in front of its layer, F hints just behind it; doors wait instead of closing onto somebody; a game starts at the first level in use; lives are set only by `reset()`.

**Editor**
- Level and sprite undo compare versions (`level_history.js`, `sprite_history.js`): an edit must finish inside a mouse or key event, showing something calls `history_rebase()`, replacing data from elsewhere calls `forget(id)`. The list histories share `next_undo_seq`. No undo history in live sessions.
- Locked layers: every editing path checks `layer_locked` / `refuse_locked_layer`.
- Shortcuts match by key position (`e.code`); Strg letter shortcuts (Z, Y, C, V …) by the printed letter (`e.key`).
- Enter finishes a single-line field (`leave_field_on_enter`). Dialogs: Esc cancels, Enter clicks the one confirming button (`modal_dialog_key_action`; mark a second way out `enter: false`).
- Hover-only icons keep their space; a button without its own border gets hover feedback by background or outline. A new status-bar entry only if nothing else on screen offers it.
- Touch: a long press is a right-click, two fingers zoom and pan and never paint.

**Collaboration** (`collaboration.rb`, `collaboration.js`)
- No accounts: a session needs its own secret code, names are display only. Sprites and levels are addressed by `id`; session data never goes into saved JSON; saves use the normal immutable versions.
- Every action that adds, deletes or moves a sprite or level calls `window.collaboration?.structure_changed(kind, action, id)`; replacing the game asks `collaboration.confirm_leave` first. `COLOR_COUNT` and `COLLABORATION_COLORS` have the same length.

**Server**
- Saved games are immutable and content-addressed (`/gen`, public). Everything private stays below `/raw` (collaboration sessions, Fehlerberichte, playtesting, moderation, play copies), never below `/gen`.
- Only Speichern makes a version. Spielen and Level testen play a copy below `/raw/play` (`play_copies.rb`, gone after a week); a Fehlerbericht's game stays with the reports. Neither is ever a game anybody loads by code, plays by link or sees in a family.
- `GameIndex` answers Spiel laden from memory; saves call `add`, deletions `remove`; each endpoint has a Neo4j fallback until the index is ready.
- Playtesting state changes only inside `Store#transaction`; the server, not the studio, chooses what a child tests.
- Moderation deletes a game everywhere (database first, then files nobody else uses, then the log the server follows); recipe pictures are never deleted; the page exists only with a valid token and builds every game text with `textContent`.
- Teacher scripts speak German, colour only in a terminal (`terminal_colors.rb`) and end with the likely next commands ("Weiter:").

## Code map

- `game.js` – the studio's game data, `fix_game_data`. `traits.js` – traits and state roles.
- `app.js` – the game runtime (`Character`, collisions, camera, doors). `platforms.js`, `movement_regions.js`, `level_flow.js`, `signals.js`, `layer_fade.js`, `speech.js`, `hud.js`, `screens.js`, `backdrops.js` – its parts.
- `combat*.js` – attacks, projectiles, bombs. `baddie_ai.js` – enemies. `companion_ai.js` – Begleiter. `inventory.js` – what stays for the whole game, weapons (1–9), the shop's rules.
- `studio.js` – panes, layout (`handleResize`), dialogs. `menu.js` – tools, keys, status bar. `widgets.js` – lists, fields, menus. `modaldialogs.js` – dialogs.
- `canvas.js`, `pixel_tools.js`, `sprite_actions.js`, `sprite_preview.js`, `who_shows_what.js` – the sprite editor.
- `level_editor.js`, `level_selection.js`, `level_rects.js`, `level_minimap.js`, `level_map.js` – the level editor.
- `level_history.js`, `level_list_history.js`, `sprite_history.js`, `sprite_list_history.js`, `trash_undo.js` – undo.
- `game_ids.js` – IDs and references. `default_names.js` – names of new things.
- `image_import.js`, `palette_apply.js`, `sprite_basket.js`, `sprite_filter.js`, `own_game.js`, `new_game.js`, `game_list.js` – authoring helpers and Spiel laden.
- `rescue.js`, `server_watch.js`, `crash_report.js` – nothing is lost to reloads, restarts and crashes.
- `collaboration.js`, `playtesting.js`, `rezepte.js`, `anleitung_film.js` – sessions, the Playtesting tab, the Hilfe tab.
- `src/ruby/main.rb` – the API. `game_index.rb`, `sheet_repair.rb`, `collaboration.rb`, `client_errors.rb`, `playtesting.rb`, `moderation.rb`, `play_copies.rb` – its parts. `errors.rb`, `playtest.rb`, `moderate.rb` – the teacher's scripts.
- `rezepte/` – recipes, the Sprite-Katalog and the guides (`rezepte/README.md`). `test/` – `node --test test/*.cjs`, `ruby test/<name>_test.rb`.
