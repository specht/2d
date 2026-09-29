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
direction and pressed keys every few frames (`REZEPT_DEBUG=alle`: every step),
plus each enemy's position, energy and behaviour mode — the quickest way to tune a
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
  `game.render()` once per GIF frame. Key presses go through
  `game.handle_key_down/up`, the same path as a real keyboard, and are
  snapped to whole simulation steps. Frames are read back with
  `gl.readPixels`.
* **Frame timing:** every GIF frame is exactly one 60 Hz simulation step and
  is shown for 20 ms (GIF delays are whole hundredths of a second; 16.7 ms
  is not possible). The recordings therefore play at 5/6 of real speed, but
  perfectly evenly – no dropped or doubled steps. `schritte: 2` records two
  steps per frame (40 ms, real speed) for long scenes.
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
kategorie: Welt bauen          # Loslegen | Figuren animieren | Welt bauen | Level gestalten | Türen & Schlüssel | Kampf | Gegner
# entwurf: true                # hide this recipe (not built, not shown)
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
  #     vorne: true            #   drawn in front of the characters (water Pip wades
  #                            #   through, light falling on him). Default: behind them.
  # eigenschaften: { show_energy: true }   # game properties (Einstellungen), e.g.
  #                            # controls: { jump: ['ArrowUp'], melee: ['ControlLeft'] }
  # himmel: ['#41a6f6', '#73eff7']         # sky: top and bottom colour, or
  # himmel: { farben: [['#29366f', 0, 1], ['#5d275d', 1, 1], ['#ef7d57', 0, 0], ['#ffcd75', 1, 0]] }
  #                            # 1, 2 or 4 colour points [colour, x, y] (0…1, y = 0 is the bottom)
  # effekte:                   # backdrop effect layers (in front of the world unless vorne: false)
  #   - { effekt: snow, farbe: '#ffffffff', skala: 1.0, tempo: 1.0 }   # snow | smoke | fire | lightrays
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
# schritte: 2                  # optional simulation steps per GIF frame (default 1); 2 = half the size
# toleranz: 16                # optional: ignore tiny colour changes between frames (shimmering
#                              # backdrop effects); much smaller files
# schleife: true               # the GIF must loop seamlessly: the last frame has to match the first
#                              # (checked, ≤ 0.4 % different pixels) and is then dropped
# tasten_zeigen: true          # draws the pressed keys as keycaps (German labels) into the GIF
erwartet:                      # outcome checks
  figur_hoeher_als: 3          # player y ≥ 3 tiles
  figur_rechts_von: 5          # player x > 5 tiles
  # gegner_besiegt: 1 · gegner_leben: 0 · schluessel: [7] · tuer_offen: true
  # punkte: 60 · energie_unter: 100 · energie_gleich: 100 · lebt: true · checkpoint_aktiv: true
  # Enemy behaviours (some enemy in the scene): gegner_modi: [chase, idle] (modes of
  # baddie_ai.js: chase/idle, wait/windup/charge/rest, shake/drop/bottom/rise/cool) ·
  # gegner_ausrufezeichen: true · gegner_weg: 96 (px sideways) · gegner_hub: 24 (px up/down)
# ohne:                        # optional: the same world without decoration. The GIF shows
#   szene: { ebenen: [ … ] }   # the finished world left of Pip and this one right of him –
#                              # he "paints" the level as he walks. Same size required.
# varianten:                   # optional: the same input again with changed scene parts,
#   - szene: { himmel: [ … ] } # played one after another (sky at day, dusk, night …)
#     erwartet: { … }          # optional checks for this variant
---
## Kurz gesagt
…
```

Keys: `rechts`, `links`, `hoch`, `runter`, `springen`, `aktion` (F),
`nahkampf` (J), `fernkampf` (K) – or any browser key code (`ArrowUp`,
`ControlLeft`, `KeyZ` …), useful together with `eigenschaften.controls`.

Body conventions (German, "du"): **Kurz gesagt** (3-step outline) →
**Das brauchst du** (*Das musst du zeichnen* / *Das kannst du später
dazumalen*) → **Schritt für Schritt** with the exact editor labels →
**Tipps** → **Wenn's nicht klappt** → **Mach mehr draus**. Two Markdown
extensions:

* `![Laufen](katalog:pip/laufen 10)` shows a catalogue animation (at 10 fps)
  together with its single frames, on the recipe's sky. A thin dashed frame
  marks the sprite's bounds, so children see whether a drawing sits at the
  top or the bottom of its 24×24 tile.
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
  `bild`, `lampe`, `tisch`, `pflanze`, `fassade`, `fassade_fenster`,
  `hausfront` (192×72, transparent doorway), `eingang` (open door, no
  traits), `sterne`, and the supports `pfosten`, `pfeiler`, `kette`.
* **Semi-transparent** (RGBA pixels): `wasser`, `wasser_oben`, `glas` with
  `mauer_fenster`, `lichtkegel` + `laterne` (48×72), and the ghost enemy
  `geist`.
* **Gentle slopes**: `hang_flach`, `hang_flach_ab` (48×24).
* **Conveyors**: `band`, `band_anfang`, `band_ende` (4 frames, moving right),
  `band_links…` (the mirror images, moving left), `rolltreppe` (3 frames,
  escalator: slope + conveyor), `maschine` (housing block). Their states use
  `fps: 30` and `phase_r: 0` (all tiles animate in step; `phase_x`, `phase_y`,
  `phase_r` are passed to the state).
* **Enemies with a behaviour** (`traits.baddie.behavior`): `kaefer` (Jäger),
  `keiler` (Lauerer: `stehen`, `laufen`), `frosch` (Hüpfer: `stehen`,
  `springen`), `fledermaus` (Flatterer: `fliegen`), `klotz` (Stampfer:
  `stehen`, `fallen`); each with `treffer` and `tot`.

Big sprites set `groesse: [w, h]` in `katalog.yaml`; their strips use frames
of that size. The parallax backgrounds (`berge_fern`, `berge`, `wald`,
`tannen`, `vordergrund` 192 px wide, `wolke` 64×24) tile horizontally and are
shaded with ordered 4×4 Bayer dithering. A big sprite placed in a map starts
at its cell and stands on the cell's bottom edge. (In the level editor a
sprite hangs centred on the cursor. Sprites that are an even number of tiles
wide therefore need *Gitteroffset 12 : 0* to line up with 24×24 tiles; the
recipes say so.) The sky is never a sprite
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
post, `c` chain, `[` `>` `]` belt (start, middle, end), `<` belt to the left,
`s` escalator, `_` machine, `K` beetle, `a` boar, `q` frog, `j` bat, `U`
stone block.

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
