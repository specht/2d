# Rezepte – how-to recipes with recorded animations

The **Hilfe** tab shows a gallery of short German recipes ("Rezepte"). Every
recipe has an animation (lossless animated WebP, or a GIF for scenes full of
shader noise) that is **recorded automatically from the real game engine**: `src/static/standalone.html` and `app.js` run unmodified in headless
Chromium, and only the recorded area is kept.

```
rezepte/
  katalog.yaml        animation catalogue: sprites, states, traits, map legend
  sprites/…/*.png     editable pixel art, one PNG strip per animation
  texte/NN-id.md      one recipe per file: YAML head (scene, input, checks) + German Markdown
  tools/              build + recorder (Node, Playwright, sharp)
src/static/rezepte/   generated: <id>.webp|gif, katalog/*.png|webp, rezepte.json  (commit these)
  spiele/<id>.json    each recipe's scene as a game for the studio (embedded frame PNGs)
src/static/rezepte.js gallery in the Hilfe tab (reads rezepte.json)
```

## Building

```bash
cd rezepte/tools
npm install          # playwright, sharp, yaml, marked
npx playwright install chromium   # only if no Chromium is installed yet
npm run build        # all recipes that changed (see "Only what changed")
npm run studio       # only the studio scenes (spiele/), nothing recorded
npm run studio -- leiter bombe    # only these studio scenes
node build.mjs leiter bombe       # always these (others are kept from rezepte.json)
node build.mjs --force            # everything, changed or not
npm run check        # record + verify, write nothing
```

**Only what changed** (like `make`): every recipe stores a fingerprint
(`quelle` in `rezepte.json`) of everything its recording depends on – its
Markdown front matter, the game built from it (sprites, pixels, map) and the
engine (the standalone page, its scripts and shaders, the build tools). A
recipe whose fingerprint is unchanged and whose files still exist is not
recorded again (`= id (unverändert)`); only its text is refreshed. The
fingerprint uses file contents, not timestamps, so a `git checkout` or a
fresh clone rebuilds nothing. Recipes named on the command line and
`--force` always record; `--check` always records and verifies.

Commit the generated files in `src/static/rezepte/`; the production server
needs no Node or Chromium. That includes `spiele/<id>.json`: every build writes
each recipe's scene as a game with its frame pictures inside (for unchanged
recipes too – it takes no recording), and `rezepte.json` names it (`spiel`,
`spiel_version`). Every recipe popup in the Hilfe tab then shows **Selbst
ausprobieren → Szene öffnen** above the recording: it opens exactly that scene
in the sprite and level editors (after asking if the open game has unsaved
changes), so children can look at how it is built and play it with T or the
**Spielen** tab (temporary saves only). Saving a recipe scene never saves the
recipe: it asks for a title of its own and an author and saves a new game
(`own_game.js`), so the game list never shows a changed recipe. `npm run
studio` writes only the scenes (and their entries in `rezepte.json`), which is
quicker while working on a scene.

**Every recipe checks its own outcome.** The `erwartet` block (see below) is
evaluated after recording. If an engine change breaks, say, doors, the door
recipe fails and the build exits with status 1. The failing recording is
written to `tools/fehler-<id>.webp` (or `.gif`) when using `--check`. Page errors
(JavaScript exceptions) also fail the build. This is a real browser/gameplay
check of exactly what children are told to do, not an isolated unit test.

`REZEPT_DEBUG=1 node build.mjs <id>` prints the player's position, state,
direction and pressed keys every few frames (`REZEPT_DEBUG=alle`: every step),
plus each enemy's position, energy and behaviour mode — the quickest way to tune a
scene. `node contact.mjs <webp|gif> <png> [step]` makes a contact sheet of a recording;
`node preview.mjs <prefix> [recipe title]` screenshots the Hilfe tab of the
studio.

## How the recording works

* `game.mjs` builds a real saved-game JSON from `katalog.yaml` and the
  recipe's map. Map column *c* is centred on x = c × 24 (`X0`, the left edge
  of column 0, is −12), exactly where the level editor puts a 24-pixel sprite,
  so whatever a child paints into an opened recipe scene lines up with it;
  Bereiche and other rectangles in tiles use the same grid. Defaults are filled in by running the studio's own
  `Game.prototype.fix_game_data()` (`game.js`) in a Node VM, so the recorded
  game has exactly the fields a child's saved game would have. The sprite
  sheet uses the same layout as `Main.render_spritesheet_for_tag`.
* `record.mjs` serves `src/static` plus the generated `/gen/…` files through
  Playwright request interception (no server, no Docker), seeds
  `Math.random`, replaces `game.clock` with a manual clock, and calls
  `game.render()` once per frame. Key presses go through
  `game.handle_key_down/up`, the same path as a real keyboard, and are
  snapped to whole simulation steps. Frames are read back with
  `gl.readPixels`.
* **Frame timing:** every frame is exactly one 60 Hz simulation step
  (`schritte: 2`: two steps). WebP delays are whole milliseconds; they are
  rounded cumulatively (17, 17, 16, …), so every frame ends at the exact
  millisecond of its step and the recording plays at real speed. Identical
  consecutive frames are merged. GIFs (`format: gif`) can only store whole
  hundredths: 20 ms per step, i.e. 5/6 of real speed, but perfectly even.
* **Scale:** recordings are rendered at `skala` screen pixels per game pixel
  (default 3) – exactly what the game shows, including parallax and camera
  shake. The recorded area follows the camera *without* its shake, so the
  shake stays visible.
* **Encoding:** libvips joins all frames of an animation into one tall image
  and garbles frames beyond roughly 65,000 rows. `write_webp` therefore
  encodes chunks of at most 32,000 rows and joins their frames (`ANMF`
  chunks) into one file itself.
* Runs are deterministic: the same inputs give the same recording.
* **Catalogue images** (`![…](katalog:…)`) are written at their native size
  with real transparency: a PNG for a single frame, otherwise an animated
  WebP plus one PNG per frame (`katalog/<strip>_<n>.png`). Scaling, the
  checkerboard and the dashed outline are CSS only – whoever copies or saves
  an image gets exactly the pixels to paste into the sprite editor. Sprites
  with the Mischmodus *Leuchten* or *Aufhellen* are shown on a dark
  checkerboard.
* **Cache busting:** every generated file gets a content hash (`?3f9a0c1b2d`
  in `rezepte.json` and in the HTML). nginx (`config.rb`) serves URLs with a
  query string as immutable and everything else with `no-cache`; the app
  loads its own files with `window.CACHE_BUSTER`. A full build (no ids, no
  `--check`) deletes generated files that are no longer referenced.
* **Still frames:** every recording also gets `standbild/<id>.webp`, one
  frame of it. The gallery cards show that frame and only play the recording
  while the card is on screen – forty animations at once would keep the browser
  busy for nothing. The recipe itself opens in a popup above the gallery
  (numbered #01, #02 … in gallery order); closing it or the back button
  returns to the same place in the gallery.

The recorder relies on these runtime entry points: `window.game`,
`Game.load(tag)`, `reset()`, `setup()`, `render()`, `clock.getElapsedTime()`,
`camera`, `renderer`, `handle_key_down/up`, `player_character`, `baddies`,
`found_keys`, `signals.sent`, `speech.log`, `speech_fonts_ready()`, `active_level_sprites`. If one of them changes, adjust
`record.mjs`.

## Writing a recipe

```yaml
---
titel: Leitern hochklettern
kategorie: Welt bauen          # Loslegen | Figuren animieren | Welt bauen | Level gestalten | Türen & Schlüssel | Signale | Kampf | Gegner | Wasser & Weltall
# entwurf: true                # hide this recipe (not built, not shown)
stufe: 1                       # difficulty 1–3 (kept in rezepte.json, not shown)
kurz: Pip klettert eine Leiter hoch und läuft oben weiter.
szene:
  ausschnitt: [0, 1, 10, 4]    # optional crop in tiles: column, row (from top), width, height
  legende:                     # optional, extends katalog.yaml `legende`
    L: { sprite: schlosstuer, platziert: { door: { signal_code: 7 } } }
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
  #     id: fassade            #   optional stable layer id
  #     kollision: false       #   "Kollisionen erkennen" off (decoration, facades, supports)
  #     parallaxe: 0.5         #   layer Parallaxe (-1 … 1); placed so the layer looks like
  #                            #   its map when the level starts
  #     mischmodus: leuchten   #   the layer's Mischmodus: leuchten | aufhellen | abdunkeln
  #     figuren: true          #   characters stay in this layer (a ghost behind a window)
  #                            #   instead of the common layer "Figuren"
  #     vorne: true            #   drawn in front of the characters (water Pip wades
  #                            #   through, light falling on him). Default: behind them.
  #     signal: { code: 4, reaktion: erscheint, ueberblendung: 0.6 }
  #                            #   the layer reacts to signals (signals.js, "Bei Signal"):
  #                            #   erscheint | verschwindet | solange_an | solange_aus | wechselt;
  #                            #   ueberblendung in seconds (default 0.3). Effects take it, too.
  #     karte: |
  #       …
  # bereiche:                  # Bereiche (signal_area layers): send their code "an" while the
  #   - { name: Haus, code: 4, rechtecke: [[4, 2, 6, 3]] }   # figure's centre is inside, else "aus"
  #                            # rectangles in tiles: column, row from top, width, height
  # alle_besiegt: 9            # the level sends Code 9 once no enemy is left
  # bewegung: { art: schwimmen, schwerkraft: 0, gleiten: 85, tempo: 1.2, schwimmzug: 0 }
  #                            # how the player moves in the whole level (Level-Eigenschaften:
  #                            # "Bewegung im ganzen Level", src/static/movement_regions.js):
  #                            # art: schwimmen | schweben | laufen (only another schwerkraft)
  #                            # schwerkraft: % of the game's gravity · gleiten: % how long the
  #                            # figure drifts on (0 … 99) · tempo: × its speed · schwimmzug:
  #                            # × jump strength per press of the jump key (schwimmen only) ·
  #                            # stroemung: [px/s, Richtung in Grad] (0 right, 90 up, 270 down)
  # bewegungsbereiche:         # Bewegungsbereiche (movement_region layers), later ones in front
  #   - { art: schwimmen, rechtecke: [[0, 2.25, 13, 3.75]] }     # the water below the surface
  #   - { art: wie_darunter, stroemung: [240, 0], rechtecke: [[12, 3, 9, 1]] }
  #                            # wie_darunter: only adds its current to what lies below.
  #                            # The frontmost area at the figure's centre decides the art;
  #                            # the currents of all areas there add up.
  # eigenschaften: { show_energy: true }   # game properties (Einstellungen), e.g.
  #                            # controls: { jump: ['ArrowUp'], melee: ['ControlLeft'] }
  # himmel: ['#41a6f6', '#73eff7']         # sky: top and bottom colour, or
  # himmel: { farben: [['#29366f', 0, 1], ['#5d275d', 1, 1], ['#ef7d57', 0, 0], ['#ffcd75', 1, 0]] }
  #                            # 1, 2 or 4 colour points [colour, x, y] (0…1, y = 0 is the bottom)
  #                            # optional in this form: pixel: true (game resolution),
  #                            # dither: noise | bayer, stufen: 8 (colour steps of the ramp)
  # effekte:                   # backdrop effect layers (in front of the world unless vorne: false)
  #   - { effekt: snow, farbe: '#ffffffff', skala: 1.0, tempo: 1.0, pixel: true }
  #     # snow | rain | smoke | fire | lightrays | stars | aurora | clouds | fireflies |
  #     # bubbles | dust (Schwebestaub) | lightning (Gewitter) | current (Strömung) –
  #     # BACKDROP_EFFECTS in src/static/backdrops.js
  #     # richtung: 250            current only: the direction of the streaks in degrees
  #     # blitz_alle: 5 · himmel_leuchtet: 0.6 · blitze: false · blitz_aufbau: 0.06
  #     #                          lightning only: seconds between strikes, sky glow 0…1,
  #     #                          no bolts = Wetterleuchten, seconds a flash takes to build up
  #     # punkte: [[x, y], …]      control points (0…1 of the effect rectangle)
  #     # bereich: [c, r, w, h]    rectangle in tiles (default: the whole scene) – e.g.
  #     #                          only the air above the ground
  #     # vorne: false             behind all layers · hinter: Figuren | <layer name or id>:
  #     #                          right behind that layer (fireflies between the trees)
  #     # menge: 1.5               snow, rain, dust: amount (1 = normal)
  #     # mischmodus: leuchten     the layer's Mischmodus
  #     # signal: { code: 4, reaktion: solange_an }   reacts to signals like a layer
  #   - { effekt: farbe, farben: ['#56668a', '#7d6784'], mischmodus: abdunkeln }
  #     # a colour layer instead of an effect (top, bottom or [[colour, x, y], …]):
  #     # with abdunkeln a tint over the whole scene (the gloomy world in Schwebestaub)
  # palette: Nyx8             # every sprite converted to a studio palette (palettes.js, by
  #                            # name) like "Sprite an Palette anpassen", the sky gets the
  #                            # nearest palette colours · { name: Nyx8, dithering: ordered |
  #                            # diffusion | atkinson } (default ordered)
  #                            # palette: null in a variant: the sprites as drawn, not converted
  # kamera: { bildhoehe: 144 } # level wider than the screen: the camera follows the
  #                            # player and the whole screen is recorded (height in
  #                            # game pixels, divisible by 9)
ablauf:                        # input script, times in seconds
  - { t: 0.3, halten: rechts, dauer: 0.4 }
  - { t: 0.9, halten: hoch, dauer: 0.75 }
  - { t: 1.3, drücken: springen }      # a short tap (0.1 s)
dauer: 3.0                     # length of the recording
# skala: 2                     # optional screen pixels per game pixel (default 3)
# bild_hoch: 0.5               # optional: the picture moves up by so many tiles – less floor,
#                              # more sky (with kamera: the camera is lifted)
# schritte: 2                  # optional simulation steps per frame (default 1); 2 = half the size
# format: gif                  # optional: a GIF instead of a lossless WebP – for scenes full of
#                              # shader noise (weather), where a GIF is much smaller.
#                              # REZEPT_FORMAT=gif forces GIFs for every recipe (to compare builds)
# farben: 256                  # GIF only: palette size (default 128); more for colourful scenes
# toleranz: 16                 # GIF only: ignore tiny colour changes between frames (shimmering
#                              # backdrop effects); much smaller files
# schleife: true               # the recording must loop seamlessly: the last frame has to match the first
#                              # (checked, ≤ 0.4 % different pixels) and is then dropped
# tasten_zeigen: true          # draws the pressed keys as keycaps (German labels) into the recording
# karte_unten: 1               # optional: the gallery card leaves out this many map rows at the
#                              # bottom and shows more at the top (tall scenes)
# standbild: 2.5               # optional: the moment (s) of the still frame on the gallery card
#                              # (default: 60 % of the recording)
# beschriftung:                # optional labels drawn into the recording, centred on a tile
#   - { text: Leuchten, spalte: 4, zeile: 2 }   # (halves allowed; only for scenes that do not scroll)
erwartet:                      # outcome checks
  figur_hoeher_als: 3          # player y ≥ 3 tiles
  figur_rechts_von: 5          # player x > 5 tiles
  # gegner_besiegt: 1 · gegner_leben: 0 · schluessel: [7] · tuer_offen: true
  # punkte: 60 · energie_unter: 100 · energie_gleich: 100 · lebt: true · checkpoint_aktiv: true
  # signale: ['4 an', '4 aus'] – exactly these signals were sent, in this order (signals.js)
  # gesagt: ['Hallo!', 'Tschüss!'] – exactly these sentences were said, in this order (speech.js)
  # Enemy behaviours (some enemy in the scene): gegner_modi: [chase, idle] (modes of
  # baddie_ai.js: chase/idle, wait/windup/charge/rest, shake/drop/bottom/rise/cool/done) ·
  # gegner_ausrufezeichen: true · gegner_weg: 96 (px sideways) · gegner_hub: 24 (px up/down)
# ohne:                        # optional: the same world without decoration. The recording shows
#   szene: { ebenen: [ … ] }   # the finished world left of Pip and this one right of him –
#                              # he "paints" the level as he walks. Same size required.
# varianten:                   # optional: the same input again with changed scene parts,
#   - szene: { himmel: [ … ] } # played one after another (sky at day, dusk, night …)
#     erwartet: { … }          # optional checks for this variant
#     beschriftung: [ … ]      # optional labels of this variant (default: the recipe's)
# raster: 2                   # optional: the recording and its variants side by side instead of one
#                              # after another – 2 per row, all playing at once (compare moods)
# einzelbilder: true           # optional: the variants are not part of the recording but
#                              # recordings of their own for the text (`varianten/<id>-<n>.webp`):
#                              # ![Nyx8: Nacht](variante:2) (0 = the recording, 1 … = the variants)
---
## Kurz gesagt
…
```

Keys: `rechts`, `links`, `hoch`, `runter`, `springen`, `aktion` (F),
`nahkampf` (J), `fernkampf` (K), `weiter` (., the next sentence of what somebody says) – or any browser key code (`ArrowUp`,
`ControlLeft`, `KeyZ` …), useful together with `eigenschaften.controls`.

Body conventions (German, "du"): **Kurz gesagt** (3-step outline) →
**Das brauchst du** (*Das musst du zeichnen* / *Das kannst du später
dazumalen*) → **Schritt für Schritt** with the exact editor labels →
**Tipps** → **Wenn's nicht klappt** → **Mach mehr draus**. Two Markdown
extensions:

* `![Laufen](katalog:pip/laufen 10)` shows a catalogue animation (at 10 fps)
  together with its single frames, on a checkerboard (so transparent pixels
  are visible) and at native size underneath (see *Catalogue images*). A thin
  dashed frame marks the sprite's bounds, so children see whether a drawing
  sits at the top or the bottom of its 24×24 tile.
* `> **Tipp:** …`, `> **Profi-Tipp:** …`, `> **Achtung:** …` become coloured
  hint boxes.

Publish a recipe only for features that work in the current editor. Its
`erwartet` block must prove the effect the text promises.

For combat recipes, use the same implemented attack family for player and
enemy examples where applicable. Make **required drawings** and **optional
presentation art** explicit: a character attack state, hit animation or extra
projectile frames may improve the look, but must never be taught as controlling
damage, timing or hit geometry. Do not publish recipes for planned attack
families (for example a laser) until their editor controls and runtime behaviour
actually exist and the recipe can verify the promised result.

Useful numbers when tuning a scene: Pip walks 3 px per simulation step (180
px/s); with Sprungkraft 7 a jump rises about 75 px. A character that leaves
the level at the side or bottom dies. Keep every scene closed.

## The animation catalogue

Pixel art lives in `sprites/<figure>/<animation>.png` as **horizontal strips of
24×24 frames**. Open them in any pixel editor, change them or make them wider
for more frames, and rebuild. Everything uses the Sweetie 16 palette (in
`palettes/`), drawn facing **right** (the engine mirrors left).

* **Pip** (mascot, ~13×19 px): `stehen` (2), `laufen` (4), `springen`,
  `fallen`, `klettern` (2, back view; state *Spielfigur klettert*), `angriff_schwert` (3),
  `angriff_bogen` (2), `angriff_wurf` (2), `treffer`, `tot` (3),
  `jubeln` (not used yet).
* **Glibber** (slime enemy): `laufen` (4), `treffer`, `tot` (3).
* **Spuckpilz** (stationary spitting mushroom): `stehen` (2), `angriff` (3),
  `treffer`, `tot` (3).
* **Welt**: `boden`, `erde`, `mauer`, `dach`, `leiter`, `schraege`, `treppe`,
  `brett` (jump-through), `eis`, `eishang` (slope down, slippery),
  `broeckel` + `broeckel_zerfall` (6, crumbling bricks: irregular fragments
  that break off and fall – drawn from a Voronoi pattern), `stacheln`,
  `fahne_aus` / `fahne_an` (2, checkpoint), `wurzeln`, `tuer_zu`, `tuer_auf`,
  `tuer_uebergang` (3), `schlosstuer_zu`, `schluessel` (2), `muenze` (4),
  `pfeil`, `stein`, `spore` (2), `bombe_zuendschnur` (4), `bombe_explosion`
  (4), `treffer_funke` (3), `schalter_aus` / `schalter_an` (lever),
  `druckplatte_oben` / `druckplatte_unten`, `gitter_zu`, `gitter_auf`,
  `gitter_uebergang` (3, a portcullis rising; catalogue `gittertor` is locked
  and automatic, so only a signal opens it).
* **Deko** (transparent, no traits, own layer without collisions): `moos`,
  `ranke`, `riss`, `fackel` (3), `burgfenster`, `grasbuesche`, `innenwand`,
  `bild`, `lampe`, `tisch`, `pflanze`, `fassade`, `fassade_fenster`, `zimmer`
  (dark wallpaper), `toter_baum`, `toter_baum_2`, `toter_baum_3` (48×72,
  bare trees), `tote_baeume_fern` (192×64, a dead forest silhouette that
  tiles), `boden_tot` (ground with dead grass),
  `hausfront` (192×72, transparent doorway), `eingang` (open door, no
  traits), `sterne`, and the supports `pfosten`, `pfeiler`, `kette`.
* **Semi-transparent** (RGBA pixels): `wasser`, `wasser_oben` (8 frames,
  waves move 1 px per frame, `phase_r: 0`), `glas` (Mischmodus *Abdunkeln*)
  with `mauer_fenster`, `lichtkegel` (*Leuchten*) + `laterne` (48×72), the
  ghost enemy `geist` (*Aufhellen*), `leuchtschein` (120×120, glows through
  its layer's Mischmodus) and `schatten` (*Abdunkeln*).
* **Gentle slopes**: `hang_flach`, `hang_flach_ab` (48×24).
* **Conveyors**: `band`, `band_anfang`, `band_ende` (8 frames, moving right),
  `band_links…` (the mirror images, moving left), `rolltreppe` (6 frames,
  escalator: slope + conveyor), `maschine` (housing block). Their states use
  `fps: 60` – the stripes move exactly 1 px per frame, without temporal
  aliasing – and `phase_r: 0` (all tiles animate in step; `phase_x`,
  `phase_y`, `phase_r` are passed to the state).
* **Enemies with a behaviour** (`traits.baddie.behavior`): `kaefer` (Jäger:
  `laufen`, `jagen`), `keiler` (Lauerer: `stehen`, `laufen`, `stuermen`,
  `benommen`), `frosch` (Hüpfer: `stehen`, `springen`), `fledermaus`
  (Flatterer: `fliegen`), `klotz` (Stampfer: `stehen`, `fallen`, `landen`;
  `klotz_einmal` falls only once); each with `treffer` and `tot`. `maus`
  (Angsthase: `stehen`, `laufen`, `fliehen`, `tot`). `waschbaer` (Jäger with Intelligenz: `stehen`,
  `laufen`, `jagen`, `springen`, `klettern` – back view, state *Gegner
  klettert*). `strohpuppe` (24×32 training dummy, *Steht still*: `stehen`,
  `treffer`, `tot` – its bullseye sits exactly at arrow height, 10 px
  above the ground). `strohballen` (solid hay bale for the training ground).
* **Meer** (`meer/`, recipes *Pip taucht*, *Ein Fisch als Spielfigur*, *Das
  U-Boot und der Sog*, *Ein Hai, der dich jagt*): `pip_taucher` (Pip with
  `pip/schwimmen`, `treiben`, `abtauchen`, `auftauchen` – states *Spielfigur
  schwimmt / treibt / taucht ab / taucht auf*), `fisch` (also `fisch_ab`,
  `fisch_auf`) and `u_boot` (48×24) as player characters,
  `qualle` (Flatterer, damage 10), `hai` (48×24, a hunter that swims after
  the player; no gravity, so it patrols at its depth), `perle` (pickup), `sand` and `riff`
  (solid), `seegras` (24×48, swaying), `koralle`, `koralle_gruen`, `truhe`,
  `schlot` (48×24), `quallenlicht` (Leuchten).
* **Weltall** (`weltall/`, recipe *Schweben im Weltall*): `astronaut` (Pip in a
  space suit: `stehen`, `laufen`, `springen`, `schweben` – state *Spielfigur
  schwebt*), `station`, `station_boden`, `mondboden`, `mondgestein` (solid),
  `luke` (24×48), `bullauge`, `stern` (pickup), `satellit` (48×24), `planet`
  (72×72), `erde_planet` (48×48), `mondstein`.
* **Küste** (`kueste/`, recipe *Farben, die Stimmung machen*): `leuchtturm`
  (48×96, lamp pulsing), `klippe` and `fels` (solid), `steg` (von oben),
  `stegpfosten`, `meer` (4 frames, `phase_r: 0`), `boot` (48×24, bobbing),
  `sonne`, `schaefchenwolke` (48×24). Drawn in the studio's default palette
  *Cling*, so that converting them to other palettes shows the idea.
* **Winter and rain:** `boden_schnee` (solid, a snow cap on frozen earth),
  `tannen_schnee` (192×64, the firs with snow and cold colours), `schneemann`
  (decoration), `regenspritzer` (8 frames at 14 fps, three splashes per tile;
  the default phase makes every copy start at another moment).
* **Höhle** (`hoehle/`, recipe *Eine Höhle erkunden*): `hoehle_fels`,
  `hoehle_boden` (solid), `hoehle_wand` (dark back wall), `hoehle_spalt`
  (48×24, solid ceiling with a crack of light), `tropfstein_oben`,
  `tropfstein_unten`, `leuchtpilz`, `pilzlicht` (72×72, for a *Leuchten*
  layer), `lichtschacht` (48×72, pale daylight), `bergfront` (192×96, the
  mountain from outside with a see-through cave mouth).
* **Transitions:** `hang_flach` / `hang_flach_ab` carry exactly the grass band
  of `boden`; `hang_fuss` / `hang_fuss_ab` go under their low end (the band
  continues into the ground row), everything else under a hill is `erde`.
  `rolltreppe_gehaeuse` goes under the upper step of an escalator (the same
  stripes as the escalator), so no machine edge cuts in.
* **Details:** `wandlampe` / `wandlampe_aus` (a lantern above a door, lit and
  dark), `hohes_gras` (48×24, 4 frames swaying – something can hide in it).
* **Light and shadow:** `hausfront_licht` (only the window panes of
  `hausfront`, warm – on a layer with *Leuchten*), `dachschatten` (soft,
  dithered, *Abdunkeln*), `farbkreis` (opaque disc for *Mischmodi verstehen*).
* **Beute:** a defeated enemy can leave a sprite behind that is collected
  like a placed one – `traits.baddie.drop = { sprite_index, signal_code }`
  (in `katalog.yaml`/`anpassen`: `drop: { sprite_index: { sprite: schluessel },
  signal_code: 1 }`). It must be a key or have "man kann es einsammeln".
  `on_touch: true` (*gibt die Beute ab, wenn man ihn berührt*): the player
  gets it by touching the enemy, without defeating it (once). A key's Code
  belongs to the placed enemy (*Code der Beute*: `platziert: { baddie:
  { drop_code: 1 } }` in `legende`); the drawing's `signal_code` is only the
  fallback for enemies without one (older games).
* **Placed doors** can open differently from their drawing: `platziert:
  { door: { lockable: true, automatic: true } }` (absent = as drawn).
* **Free Codes:** in the studio a newly placed Schalter or Druckplatte, and an
  enemy whose *sendet, wenn besiegt* is switched on, get a Code nothing else in
  the level uses. Scenes in `legende` set their Codes themselves.
* **Intelligenz** (`traits.smart`, a sprite trait of its own next to
  `baddie`): `walks_slopes`, `jumps_obstacles`, `jumps_gaps`, `drops_down`,
  `climbs_ladders`, all off by default. Wächter, Jäger and Angsthase use the
  first four; `climbs_ladders` only Jäger and Angsthase (the editor shows only
  what fits the enemy's behaviour; other behaviours ignore the trait). Without
  the trait – every older game – enemies move exactly as before. Abilities are
  used every time they apply (no chance involved):
  - *patrolling* (Wächter; Jäger and Angsthase while calm): slopes, obstacles
    (only if lower than the jump), gaps (only with a landing), drops (ground at
    most 5 blocks down) – `smart_patrol_step` in app.js;
  - *Jäger chasing*: slopes and hopping at walls as always; gaps; ladders
    (climbs here, or walks to one within `LADDER_REACH` = 5 blocks when the
    player is on another floor); follows the player down a ledge as always,
    but with the trait only onto ground at most 5 blocks below;
  - *Angsthase fleeing*: climbs every ladder it passes, never towards the
    player; when cornered: obstacle, gap, drop, else it trembles.
* **Klettern** (`climb`, *Spielfigur klettert* / *Gegner klettert*): an optional
  state without direction, shown while climbing a ladder and – paused – while
  holding still in the middle of one. Without it the game shows the back-facing
  state (*schaut nach hinten*), as in older games.
* **Behaviour poses** are optional enemy states (traits.js
  `STATE_TRAITS.baddie`): `hunt_*` (*Gegner jagt*: Jäger chasing, Lauerer
  charging), `flee_*` (*Gegner flieht*: Angsthase), `stunned_*` (*Gegner ist
  benommen*: Lauerer after a wall), `landed_*` (*Gegner ist aufgeschlagen*:
  Stampfer at the bottom, played once). Without such a state the enemy keeps
  its normal movement animation.
* **Old enemies** without a `behavior` are promoted when a game is loaded
  (`promote_baddie_behavior`): *Wächter* (`guard`), or *Steht still*
  (`still`) if they did not patrol. The classic fields stay, so they move
  exactly as before, also after saving again.

A sprite in `katalog.yaml` may set `mischmodus: leuchten | aufhellen |
abdunkeln` (the sprite's Mischmodus, saved as `sprite.blend`: `add`,
`screen`, `multiply`); `extends` inherits it.

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
stone block, `8` stone block that falls once, `@` mouse, `y` dark room,
`*` glow, `%` shadow, `1` `2` `3` dead trees, `4` dead forest far away,
`5` dead ground.

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
