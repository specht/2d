# 2D Game Studio

A browser studio for making small 2D games, built for school: children draw and animate pixel-art sprites, give them behaviour by choosing traits, and build levels from them – no code. Public instance: https://2d.hackschule.de/

## What you can build

- **Sprites:** pixel art with animation states, onion skin, preview, mirrored drawing, selections, recolouring, outlines, undo; pictures can be pasted (background, pixel size and frames are detected); the Sprite-Katalog and other games' codes provide ready-made pictures; a whole game can be converted to a palette.
- **Behaviour by traits:** player characters, enemies with several behaviours, companions (Begleiter), collectibles, hazards, ladders, slopes, conveyors, moving platforms and lifts, water and other movement regions (also gravity turned left, up or right, with a camera that turns along), melee and ranged combat, bombs.
- **Inventar, weapons and shops:** collectibles can stay for the whole game (shown in the HUD); one with an attack is a weapon (J or K, several chosen with 1–9, the number set by the author); a placed collectible with a Preis is bought with F and can describe itself, optionally with a Verkäufer who greets, chats and thanks; a level can send a Code when the figure has an item (a key for the whole game).
- **Levels:** layers on one grid, parallax, gradients, lighting and weather effects; doors, keys, checkpoints; exits that lead to chosen levels (hubs, shops, Nebenlevel); a level entered again looks as it was left.
- **Signale:** switches, pressure plates, keys, areas, enemies and timers send a Code; doors, layers, signs, platforms and the level react – with names, delays, Zähler and an overview of every rule.
- **For the player:** speech bubbles in pixel fonts, a HUD that shows only what the game uses, German start and level screens.
- **Help:** the Hilfe tab has twelve *Erste Schritte* guides and the *Rezepte* – videos recorded from the real studio and engine, so they always match (`rezepte/README.md`). Every recipe scene opens in the studio.

## Using the studio

- **Keys:** Strg+Z / Strg+Y undo, Strg+S save, Strg+O Spiel laden, F11 full screen, H help. Tools follow the keyboard rows (Q W E R T …); view switches have keys (sprite editor: O onion skin, P preview, M mirror; level editor: G grid, S Signale, M map, L Levelübersicht, A animate, B areas, D highlight layer). X switches between the colour and transparent (the level pen: erase).
- **Right-click** (or a long press on a tablet) opens a menu everywhere; the right button never paints.
- **Level testen (T)** plays the current level from the mouse position; Esc returns, nothing is saved.
- **Dialogs** close with Esc and confirm with Enter when they have one confirming button.
- Made for 1920 × 1080, works down to about 1366 × 768 and on tablets in landscape (two fingers zoom and pan).

## Games and versions

- Saving writes the game as JSON under a code derived from its content. Every save is a new, unchangeable version whose parent is the version it was loaded from, so a game's history is a tree. Anyone with the code can open a game and save their own version – there are no accounts.
- **Spiel laden** lists the newest version of every game, searchable by code, title and author; *Versionen* shows the family tree.
- **Als eigenes Spiel weiterführen** starts an independent game from the current state; **Neues Spiel** starts over.
- **Zusammenarbeiten:** several browsers edit one game at the same time through a secret session code, each locking the sprite or level they work on. `COLLABORATION = false` in `env.rb` switches it off.

## Running locally

Needs Git, Ruby and Docker (Compose). Everything else runs in containers.

```bash
git clone https://github.com/specht/2d.git && cd 2d
cp env.template.rb env.rb     # defaults are fine for development
./config.rb build
./config.rb up                # http://localhost:8025
```

Data lives in `./data` (games, pictures, database), logs in `./logs`. Static files are mounted, so a browser reload shows changes; the Ruby server restarts itself on changes. After a pull, `./rebuild.sh` records outdated recipes and guides and restarts the server. For production set `DEVELOPMENT = false` and real values in `env.rb`.

## In class: the teacher's scripts

Run inside the Ruby container (`./config.rb exec ruby sh`), or from outside as `./config.rb exec ruby ruby <script> …`.

**Restarts and errors.** The server can be restarted during a lesson: open studios wait, keep a copy of unsaved work in the browser and offer to reload once a new version is there. Crashes are reported to the server:

```bash
./errors.rb                  # today's errors, grouped
./errors.rb list 7           # the last seven days
./errors.rb show 3f2a1c      # one group: stack, the clicks before, the game
./errors.rb game 3f2a1c > spiel.json
./errors.rb resolve 3f2a1c   # fixed (hidden until it happens again)
./errors.rb prune 30         # delete reports (and their games) older than 30 days
```

**Playtesting.** Children test each other's games and fill in a survey; the server hands out the games.

```bash
./playtest.rb on 3           # switch on, 3 minutes per test
./playtest.rb watch          # the round during the lesson
./playtest.rb games          # submitted games and their tests
./playtest.rb remove 3fa2    # take a game out of the round
./playtest.rb pdf            # the feedback to print, one page per game
./playtest.rb off            # switch off
./playtest.rb reset          # a new round (the old one is archived)
```

**Moderation.** Removes a game for good: its file, its pictures (where no other game uses them), its database entry and its place in Spiel laden. Pictures and texts of the recipes are never shown or deleted.

```bash
./moderate.rb search wort1 "zwei Wörter"   # games with one of the words, and where; asks what to delete
./moderate.rb show 3fa2b1c                 # one version: texts, new pictures, later versions
./moderate.rb delete 3fa2b1c [--mit-spaeteren] [--ja] [--grund="…"]
./moderate.rb start                        # a secret page for 8 hours (the script ends, the page stays): live – new pictures and texts as they are saved, beside today's Fehlerberichte to copy; search, delete
./moderate.rb stop                         # close it at once (./moderate.rb web: the same page while the script runs, Strg+C closes it)
./moderate.rb log                          # what was deleted, when and why
```

The first run reads every game (minutes on a big server) and keeps a cache, so later runs start in seconds. The page's address comes from `WEB_ROOT` in `env.rb`.

## Project layout

```text
config.rb, env.rb     generate docker-compose.yaml and the nginx config
src/static/           the studio and the game engine (served by nginx)
src/ruby/             Sinatra backend (main.rb) and the teacher's scripts
rezepte/              recipes, Sprite-Katalog and guides – see rezepte/README.md
test/                 node --test test/*.cjs   and   ruby test/<name>_test.rb
data/gen/             saved games and pictures (public)   data/raw/  private state
```

nginx serves `src/static` and `data/gen` and passes the API to Ruby (Sinatra on Thin); Neo4j stores the versions and their relationships. `AGENTS.md` has the development rules and the code map, `TODO.md` the open work.
