# Rezepte – how-to recipes with recorded GIFs

The **Hilfe** tab shows a gallery of short German recipes ("Rezepte"). Every
recipe has an animated GIF that is **recorded automatically from the real game
engine**: `src/static/standalone.html` and `app.js` run unmodified in headless
Chromium, and only the recorded area is kept.

```
rezepte/
  katalog.yaml        animation catalogue: sprites, states, traits, map legend
  sprites/…/*.png     editable pixel art, one PNG strip per animation
  texte/NN-id.md      one recipe per file: YAML head (scene, input, checks) + German Markdown
  tools/              build + recorder (Node, Playwright, sharp)
src/static/rezepte/   generated: <id>.gif, katalog/*.gif|png, rezepte.json  (commit these)
src/static/rezepte.js gallery in the Hilfe tab (reads rezepte.json)
```

## Building

```bash
cd rezepte/tools
npm install          # playwright, sharp, yaml, marked
npx playwright install chromium   # only if no Chromium is installed yet
npm run build        # all recipes
node build.mjs leiter bombe       # only these (others are kept from rezepte.json)
npm run check        # record + verify, write nothing
```

Commit the generated files in `src/static/rezepte/`; the production server
needs no Node or Chromium. Rebuild after changing the engine, the art or a
recipe. The build takes about ten seconds per recipe.

**Every recipe checks its own outcome.** The `erwartet` block (see below) is
evaluated after recording. If an engine change breaks, say, doors, the door
recipe fails and the build exits with status 1. The failing recording is
written to `tools/fehler-<id>.gif` when using `--check`. Page errors
(JavaScript exceptions) also fail the build. This is a real browser/gameplay
check of exactly what children are told to do, not an isolated unit test.

`REZEPT_DEBUG=1 node build.mjs <id>` prints the player's position, state,
direction and pressed keys every few frames — the quickest way to tune a
scene. `node contact.mjs <gif> <png> [step]` makes a contact sheet of a GIF;
`node preview.mjs <prefix> [recipe title]` screenshots the Hilfe tab of the
studio.

## How the recording works

* `game.mjs` builds a real saved-game JSON from `katalog.yaml` and the
  recipe's map. Defaults are filled in by running the studio's own
  `Game.prototype.fix_game_data()` (`game.js`) in a Node VM, so the recorded
  game has exactly the fields a child's saved game would have. The sprite
  sheet uses the same layout as `Main.render_spritesheet_for_tag`.
* `record.mjs` serves `src/static` plus the generated `/gen/…` files through
  Playwright request interception (no server, no Docker), seeds
  `Math.random`, replaces `game.clock` with a manual clock, and calls
  `game.render()` once per GIF frame (30 fps; the simulation stays at its
  fixed 60 Hz). Key presses go through `game.handle_key_down/up`, the same
  path as a real keyboard. Frames are read back with `gl.readPixels`.
* Runs are deterministic: the same inputs give the same GIF.

The recorder relies on these runtime entry points: `window.game`,
`Game.load(tag)`, `reset()`, `setup()`, `render()`, `clock.getElapsedTime()`,
`camera`, `renderer`, `handle_key_down/up`, `player_character`, `baddies`,
`found_keys`, `active_level_sprites`. If one of them changes, adjust
`record.mjs`.

## Writing a recipe

```yaml
---
titel: Leitern hochklettern
kategorie: Welt bauen          # Loslegen | Figuren animieren | Welt bauen | Level gestalten | Türen & Schlüssel | Kampf
stufe: 1                       # 1–3 stars
kurz: Pip klettert eine Leiter hoch und läuft oben weiter.
szene:
  ausschnitt: [0, 1, 10, 4]    # optional crop in tiles: column, row (from top), width, height
  legende:                     # optional, extends katalog.yaml `legende`
    L: { sprite: schlosstuer, platziert: { door: { door_code: 7 } } }
  anpassen:                    # optional trait overrides for this recipe only
    glibber: { baddie: { patrols: false } }
  karte: |                     # one character = one 24×24 tile, '.' = empty
    ..........
    ....H###..
    ....H.....
    .P..H.....
    ##########
  # ebenen:                    # instead of karte: several layers, back to front
  #   - name: Fassade          #   layer name shown in the editor
  #     id: fassade            #   stable id, needed as target of a Sichtbarkeitsbereich
  #     kollision: false       #   "Kollisionen erkennen" off (decoration, facades, supports)
  #     parallaxe: 0.5         #   layer Parallaxe (-1 … 1); placed so the layer looks like
  #                            #   its map when the level starts
  #     karte: |
  #       …
  # bereiche:                  # Sichtbarkeitsbereiche (visibility_region layers)
  #   - { ziel: fassade, rechtecke: [[4, 2, 6, 3]], im_bereich: versteckt, ueberblendung: 0.4 }
  #                            # rectangles in tiles: column, row from top, width, height
  # eigenschaften: { show_energy: true }   # game properties (Einstellungen)
  # kamera: { bildhoehe: 144 } # level wider than the screen: the camera follows the
  #                            # player and the whole screen is recorded (height in
  #                            # game pixels, divisible by 9)
ablauf:                        # input script, times in seconds
  - { t: 0.3, halten: rechts, dauer: 0.4 }
  - { t: 0.9, halten: hoch, dauer: 0.75 }
  - { t: 1.3, drücken: springen }      # a short tap (0.1 s)
dauer: 3.0                     # length of the GIF
# farben: 256                  # optional GIF palette size (default 128); more for colourful scenes
# skala: 2                     # optional screen pixels per game pixel (default 3)
# bildrate: 15                 # optional GIF frame rate (default 30); lower = smaller file
erwartet:                      # outcome checks
  figur_hoeher_als: 3          # player y ≥ 3 tiles
  figur_rechts_von: 5          # player x > 5 tiles
  # gegner_besiegt: 1 · gegner_leben: 0 · schluessel: [7] · tuer_offen: true
  # punkte: 60 · energie_unter: 100 · energie_gleich: 100 · lebt: true · checkpoint_aktiv: true
# vorher:                      # optional before/after: another scene, recorded with the same
#   szene: { ebenen: [ … ] }   # input and played first. Both halves get a "Vorher"/"Nachher"
#                              # label and must have the same size.
#   parallaxe_aus: true        # …or: the same scene with every Parallaxe set to 0
---
## Kurz gesagt
…
```

Keys: `rechts`, `links`, `hoch`, `runter`, `springen`, `aktion` (F),
`nahkampf` (J), `fernkampf` (K).

Body conventions (German, "du"): **Kurz gesagt** (3-step outline) →
**Das brauchst du** (*Das musst du zeichnen* / *Das kannst du später
dazumalen*) → **Schritt für Schritt** with the exact editor labels →
**Tipps** → **Wenn's nicht klappt** → **Mach mehr draus**. Two Markdown
extensions:

* `![Laufen](katalog:pip/laufen 10)` shows a catalogue animation (at 10 fps)
  together with its single frames.
* `> **Tipp:** …`, `> **Profi-Tipp:** …`, `> **Achtung:** …` become coloured
  hint boxes.

Publish a recipe only for features that work in the current editor. Its
`erwartet` block must prove the effect the text promises.

Useful numbers when tuning a scene: Pip walks 3 px per simulation step (180
px/s); with Sprungkraft 7 a jump rises about 75 px. A character that leaves
the level at the side or bottom dies. Keep every scene closed.

## The animation catalogue

Pixel art lives in `sprites/<figure>/<animation>.png` as **horizontal strips of
24×24 frames**. Open them in any pixel editor, change them or make them wider
for more frames, and rebuild. Everything uses the Sweetie 16 palette (in
`palettes/`), drawn facing **right** (the engine mirrors left).

* **Pip** (mascot, ~13×19 px): `stehen` (2), `laufen` (4), `springen`,
  `fallen`, `klettern` (2, back view), `angriff_schwert` (3),
  `angriff_bogen` (2), `angriff_wurf` (2), `treffer`, `tot` (3),
  `jubeln` (not used yet).
* **Glibber** (slime enemy): `laufen` (4), `treffer`, `tot` (3).
* **Spuckpilz** (stationary spitting mushroom): `stehen` (2), `angriff` (3),
  `treffer`, `tot` (3).
* **Welt**: `boden`, `erde`, `mauer`, `dach`, `leiter`, `schraege`, `treppe`,
  `brett` (jump-through), `eis`, `eishang` (slope down, slippery),
  `broeckel` + `broeckel_zerfall` (3, crumbling bricks), `stacheln`,
  `fahne_aus` / `fahne_an` (2, checkpoint), `wurzeln`, `tuer_zu`, `tuer_auf`,
  `tuer_uebergang` (3), `schlosstuer_zu`, `schluessel` (2), `muenze` (4),
  `pfeil`, `stein`, `spore` (2), `bombe_zuendschnur` (4), `bombe_explosion`
  (4), `treffer_funke` (3).
* **Deko** (transparent, no traits, own layer without collisions): `moos`,
  `ranke`, `riss`, `fackel` (3), `burgfenster`, `grasbuesche`, `innenwand`,
  `bild`, `lampe`, `fassade`, `fassade_fenster`, and the supports `pfosten`,
  `pfeiler`, `kette`.

Big sprites set `groesse: [w, h]` in `katalog.yaml`; their strips use frames
of that size. The parallax backgrounds (`berge_fern`, `berge`, `wald`,
`tannen`, `vordergrund` 192 px wide, `wolke` 64×24) tile horizontally and are
shaded with ordered 4×4 Bayer dithering. A big sprite placed in a map starts
at its cell and stands on the cell's bottom edge. The sky is never a sprite
but the level's colour backdrop (`himmel`).

`katalog.yaml` turns strips into game sprites: a list of states with `strip`,
optional `frames: [i, …]`, `fps` and the engine's **state traits** (the keys of
`STATE_TRAITS` in `src/static/traits.js`, e.g. `actor: [walk_right]`). The
first state is the engine's fallback. `extends` derives variants (Pip with a
sword, a bow or bombs) that add states and deep-merge traits. `{ sprite: id }`
inside traits is replaced by that sprite's index (projectile and hit-effect
art).

The map legend (`legende` in `katalog.yaml`) gives every sprite one
character, e.g. `#` ground, `M` wall, `-` plank, `B` crumbling brick, `^`
spikes, `f` flag, `h` house door, `F`/`V` facade, `z` moss, `t` torch, `|`
post, `c` chain.

Design rules the scenes follow (and the recipes teach): doors sit in walls
that are higher than a jump, nothing floats without a support, ground has
earth underneath, and decoration lives in its own layer.

Engine detail worth knowing (and taught in the ladder recipe): on a ladder
the engine keeps the state `stand`/`walk` and switches the direction to
`back`. The climbing animation therefore belongs to **Spielfigur schaut nach
hinten**. Slopes and stairs are the same trait (*Schräge / Treppe*); only the
drawing differs.

### Adding a new situation later

For example swimming, gliding or a future `climb` state:

1. Draw `sprites/pip/schwimmen.png`.
2. Add a state to `pip` in `katalog.yaml` with the new state trait. Once the
   engine knows the trait, the build uses it. Until then the engine ignores
   it and falls back as usual.
3. Add any new tiles to `katalog.yaml` and a character to `legende`.
4. Write `texte/NN-schwimmen.md` with a scene, an input script and a check.
