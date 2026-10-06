# Rezepte and Erste Schritte

The Hilfe tab shows German **recipes** (a mechanic, recorded from the real game engine) and **Erste-Schritte guides** (where to click, recorded from the real studio). Both are built here, check themselves, and are rendered by the user – never commit them in a patch.

```
rezepte/
  katalog.yaml        sprites, states, traits, map legend, the Sprite-Katalog (sammlung)
  sprites/…/*.png     pixel art: horizontal strips of frames (24×24 unless groesse)
  texte/NN-id.md      one recipe: YAML head (scene, input, checks) + German Markdown
  anleitungen/NN-id.md  one guide: YAML head (start, recordings) + German Markdown
  tools/              build.mjs, record.mjs, game.mjs (recipes); anleitungen.mjs, anleitung.mjs,
                      film.mjs, studio.mjs (guides)
src/static/rezepte/      generated: recordings, stills, katalog/, spiele/<id>.json (scenes to open
                         in the studio), katalog.json (the Sprite-Katalog), rezepte.json
src/static/anleitungen/  generated: films (<id>-<name>.json + .webp sheets), pictures, anleitungen.json
```

## Building

```bash
cd rezepte/tools && npm install
npm run build                    # recipes that changed
node build.mjs leiter bombe      # these recipes, always
node build.mjs --force           # all recipes
npm run studio                   # only the scenes (spiele/), nothing recorded
npm run check                    # record and verify, write nothing
npm run anleitungen              # guides that changed (node anleitungen.mjs <id> · --force · -- --check)
```

From the repository root, `./rebuild.sh` does both and restarts the server.

- **Only what changed:** every recording stores a content fingerprint (`quelle`). Recipes depend on their YAML head, their built game and the engine (`standalone.html` and its scripts, `traits.js`, `baddie_ai.js`, `game_ids.js`, `game.js`, shaders, `build/record/game.mjs`). Guides depend on their head, their start game and all of `src/static`. A checkout rebuilds nothing.
- **Everything checks itself:** a recipe's `erwartet` must hold; a guide's selectors must appear and its `pruefen` must be true; page errors fail too. A failure exits with status 1 and writes `tools/fehler-<id>.webp`.
- **Deterministic:** recipes run on a manual game clock with seeded randomness. Guides run on the guide clock (`studio.mjs`): page time moves only through `pass_time`, after everything the page loads has arrived; randomness is seeded and Chromium draws with `BROWSER_ARGS`. The same steps give the same files byte for byte, so guides record in parallel (`ANLEITUNG_PARALLEL=n`). **Never wait with real time** (`waitForTimeout`) – use `GuidePlayer.pass`.
- **Debugging:** `REZEPT_DEBUG=1 node build.mjs <id>` (player and enemies every few frames), `node contact.mjs <rec> <png>` (contact sheet), `ANLEITUNG_DEBUG=1` (step times), `ANLEITUNG_SICHTEN=1 … --check` (films to look at), `ANLEITUNG_BILDER=dir` (every guide frame as PNG, to compare runs).

## How recipes are recorded

`game.mjs` builds a real saved game from `katalog.yaml` and the map (column *c* is centred on x = 24·c, like the level editor's grid) and normalizes it with the studio's own `fix_game_data`. `record.mjs` serves `src/static` and the generated `/gen` files through Playwright, presses keys through `game.handle_key_down/up`, renders one 60 Hz step per frame (`schritte: 2`: two) and reads pixels back. WebP keeps real speed; GIF (`format: gif`, for shader noise) plays at 5/6. A completed level zooms onto the figure – keep `dauer` below 2.5 s after it.

The recorder reads these game entry points; adjust `record.mjs` when they change: `window.game`, `load`, `reset`, `setup`, `render`, `clock`, `camera`, `renderer`, `handle_key_down/up`, `player_character`, `baddies`, `companions`, `moving_platforms`, `found_keys`, `signals.sent`, `speech.log`, `speech_fonts_ready`, `active_level_sprites`, `reached_flag`, `ts_zoom_actor`, `inventory`, `weapon_choice`, `keep_item`, `hud_off`.

## Writing a recipe

```yaml
---
titel: Leitern hochklettern
kategorie: Welt bauen        # Loslegen | Figuren animieren | Welt bauen | Level gestalten | Türen & Schlüssel |
                             # Signale | Kampf | Gegner | Begleiter | Wasser & Weltall
kurz: Pip klettert eine Leiter hoch und läuft oben weiter.
# entwurf: true              # not built, not shown
szene:
  karte: |                   # one character = one 24×24 tile (legend in katalog.yaml), '.' = empty
    ....H###..
    .P..H.....
    ##########
ablauf:                      # input, times in seconds
  - { t: 0.3, halten: rechts, dauer: 0.4 }
  - { t: 1.3, drücken: springen }
dauer: 3.0
erwartet:
  figur_hoeher_als: 3
---
## Kurz gesagt
…
```

**Scene (`szene`), all optional:**
- `ausschnitt: [c, r, w, h]` crop in tiles · `kamera: { bildhoehe: 144 }` a scrolling level · `legende` / `anpassen` extend the legend / override traits · `zusaetzlich: [ids]` sprites in the game but not placed.
- `ebenen:` instead of `karte`, back to front, each with `name`, `id`, `karte`, `kollision: false`, `parallaxe`, `mischmodus` (leuchten | aufhellen | abdunkeln), `figuren`, `vorne`, `signal: { code, reaktion, ueberblendung }`.
- Signale: `bereiche` (Signalbereiche), `alle_besiegt: code`, `beim_start: { code, verzoegerung }`, `geschafft_bei: code`, `wenn_hat: [{ sprite, code }]` ("sendet, wenn die Spielfigur … hat"), `signale: { 3: Tor auf }` (every scene with Signale names its Codes).
- Inventar: `inventar: [ids]` – the figure starts with these, as if brought along from another level. A placed `pickup: { price, buy_again, shop_text, shop_buy_line }` (in `legende … platziert`) makes a shop; a placed `text: { shop_keeper: true, shop_thanks, shop_greeting, shop_chatter }` is its Verkäufer.
- Movement: `bewegung: { art, schwerkraft, gleiten, tempo, schwimmzug, stroemung }` for the level, `bewegungsbereiche: [{ art, rechtecke, stroemung, schwerkraft_nach, drehdauer, signal }]` (`schwerkraft_nach: links | oben | rechts` turns gravity and the camera – record such scenes with `kamera`; `signal: { code, reaktion }` switches the region like a layer).
- Look: `himmel` (two colours, or `{ farben: [[colour, x, y] …], pixel, dither, stufen }`), `effekte: [{ effekt, farbe, skala, tempo, bereich, parallaxe, vorne, hinter, menge, mischmodus, signal }]` (effects: `BACKDROP_EFFECTS` in `backdrops.js`; `effekt: farbe` is a colour layer), `palette: Nyx8` (convert every sprite), `eigenschaften: { … }` game settings (e.g. `controls`), `levelname` (what the HUD shows as the level starts; else the `titel`).

**Recording, all optional:** `skala` (3), `schritte`, `hud: true` (the HUD stays on – with `kamera`, so the whole screen is recorded), `bild_hoch` (tiles, fractions allowed), `format: gif` with `farben` / `toleranz`, `schleife: true` (must loop seamlessly), `tasten_zeigen`, `standbild` (s), `karte_unten`, `beschriftung: [{ text, spalte, zeile }]`, `ohne: { szene }` (the world without decoration on Pip's right), `varianten: [{ szene, erwartet, beschriftung }]` with `raster: 2` (side by side) or `einzelbilder: true` (own recordings, `![…](variante:2)`).

**Keys:** `rechts`, `links`, `hoch`, `runter`, `springen`, `aktion` (F), `nahkampf` (J), `fernkampf` (K), `weiter` (.) or any key code (`ArrowUp`, `KeyZ`).

**Checks (`erwartet`):** `figur_hoeher_als`, `figur_rechts_von`, `gegner_besiegt`, `gegner_leben`, `schluessel`, `tuer_offen`, `geschafft`, `punkte`, `energie_unter`, `energie_gleich`, `lebt`, `checkpoint_aktiv`, `signale: ['4 an', '4 aus']`, `gesagt: […]`, `gegner_modi`, `gegner_ausrufezeichen`, `gegner_weg`, `gegner_hub`, `punkte_gleich`, `leben` (exactly so many lives), `inventar: { Titel: Anzahl }`, `waffe: Titel` (a Titel by its beginning), `begleiter_*` (`folgt`, `weg`, `hub`, `bleibt_zurueck`, `verloren`, `nie_verloren`, `schwimmt`, `rechts_von`, `immer_hoeher_als`, `zeigt`, `landet`; `begleiter_einzeln: { Titel: { … } }`), `plattform_weg`, `figur_mitgefahren`, `plattform_wartet`, `figur_schwerkraft: links | oben | rechts | unten`. Exact meanings: `record.mjs`.

**Text** (German, "du"): Kurz gesagt → Das brauchst du (*Das musst du zeichnen* / *Das kannst du später dazumalen*) → Schritt für Schritt with the exact editor labels → Tipps → Wenn's nicht klappt → Mach mehr draus. `![Laufen](katalog:pip/laufen 10)` shows a catalogue animation with its frames; `> **Tipp:**`, `> **Profi-Tipp:**`, `> **Achtung:**` become hint boxes. Say *anklicken*, *auswählen*, *wählen*.

**Rules:** publish only what works in the current studio, and let `erwartet` prove what the text promises. Combat recipes use one attack family for player and enemy; attack and hit pictures are presentation, never what decides damage. Scenes follow what the recipes teach: doors in walls higher than a jump, nothing floats, decoration on its own layer, every scene closed (a figure leaving it dies). Pip walks 180 px/s; Sprungkraft 7 rises about 75 px.

## The catalogue

- Strips in `sprites/<figure>/<animation>.png`, drawn facing **right**, mostly in Sweetie 16. `katalog.yaml` turns them into sprites: states with `strip`, `frames`, `fps` and state traits (`STATE_TRAITS` in `traits.js`; the first state is the fallback), `extends` for variants, `{ sprite: id }` for references, `groesse: [w, h]`, `mischmodus`.
- Every catalogue sprite is a multiple of 24 × 24 (tested), and every figure that stands has a pixel in the bottom row of its standing and walking frames (the build stops otherwise; `schwebt: true` for figures that never stand).
- Every sprite belongs to one group of `sammlung` (the Sprite-Katalog in the studio) or to `nicht_in_sammlung`; the build stops otherwise. Shade with light from the upper left, outline figures, no big flat patches.
- A new situation (e.g. swimming): draw the strip, add the state with its trait, add tiles and a legend character, write the recipe with a check.

## Writing a guide

```yaml
---
titel: "Signale: Schalter und Tor verbinden"
kurz: Ein Schalter sendet ein Signal, ein Tor reagiert darauf.
start: { szene: { … }, eine_ebene: true, himmel: true }   # optional start game (a recipe scene)
aufnahmen:
  - name: verbinden          # in the text: ![Bildunterschrift](aufnahme:verbinden)
    art: video               # video | bild (bild: marken: [{ ziel, nr, x, y, rahmen }])
    ausschnitt: [0, 44, 1600, 818]   # or 'ganz', or selectors (rand: px around them)
    vorher: [ … ]            # steps before the recording (not shown)
    schritte: [ … ]
    ende: 1.6                # seconds the last picture stays
    standbild: 9             # still for the card (first video)
---
```

| Step | Does |
| --- | --- |
| `{ hinweis: Text, nr: 3, mehr: "…" }` | starts step ③ beside the film (`mehr`: a sentence under it) |
| `klick` · `doppelklick` · `rechtsklick: <ziel>` | moves the pointer and clicks (`mit: Control` holds keys) |
| `malen: [<ziel> …]` · `ziehen: { von, nach }` · `bewegen: <ziel>` · `rad: <ziel>` (`um: -4`) | drags, moves, turns the wheel |
| `menue: [Blöcke, man kann …]` | walks a menu or submenu by its labels |
| `taste: Control+KeyZ` (`halten`, `zeigen: false`) · `tippen: Text` (or `{ js }`) | keys and typing |
| `warten: 1` (`bis: <js>`, `meldung`) · `pause: 1` | lets time pass / holds the picture – after T wait `bis` the test runs |
| `ansicht: [c0, r0, c1, r1]` | the level view shows these cells (row 0 at the bottom) |
| `js: …` · `pruefen: …` | runs JavaScript; `pruefen` must return `true` |

A *ziel* is a selector (prefer titles and labels children see; add `:visible` when hidden copies exist), `{ ziel, x, y }`, `{ pixel: [x, y] }` on the drawing area, `{ feld: [spalte, zeile], ebene: n }` in the level, or `{ punkt: [x, y] }`. Unknown keys fail the build.

The studio runs without a server: `studio.mjs` answers the API like the server (saves, Spiel laden, versions) and lays out sprite sheets like `Main.render_spritesheet_for_tag`. Recorded at 1600 × 900.

**Text:** like the recipes, with `<kbd>Strg</kbd>` and `[Text](rezept:id)` links (checked). Captions are short – they stand in a narrow column; the rest goes into `mehr`. The film stops after each step, so every step changes something a child can see and do. Guides start like a child's game (black level, sprites drawn in the films, not fetched). The text under a film adds what is not a step. When a label or selector a guide uses changes in the studio, fix the guide in the same patch.
