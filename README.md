# 2D Game Studio

2D Game Studio is a browser-based environment for creating small 2D games.

It is designed primarily for use with children and students: sprites can be drawn and animated directly in the browser, behaviours are assembled through visual properties and traits, and levels are built from those sprites without requiring students to write game-engine code.

A public instance is available at:

https://2d.hackschule.de/

## What can you build with it?

A game consists of animated sprites, behaviours and one or more levels.

The Studio lets you:

- draw pixel-art sprites and animations (with onion skinning, a live animation preview, mirrored drawing, recolouring a colour in every frame, outlines, and undo/redo), or paste and drop pictures: background, pixel size and the frames of a strip or a numbered series of files are detected
- define animation states, and duplicate, copy and move sprites, states and frames by right-click – several frames at once, too (Shift / Strg + click), also reversing their order
- borrow sprites from other games or recipe scenes (Sprite-Korb)
- convert a sprite or a whole game, backgrounds included, to a pixel-art palette
- assign behaviours to sprites
- create player characters and enemies
- give the player companions (Begleiter: pets, robots, friends) that follow with their own way of moving
- build layered levels: select, move, copy and fill many sprites at once (rectangles, their edges, lines), undo and redo, and find your way around large levels with an overview map
- configure collision and movement
- use slopes, ladders, conveyors and moving environments
- create doors, keys and checkpoints
- connect switches, pressure plates, keys, collectibles, Bereiche, defeated enemies and the start of a level (a timer) to doors, layers, speaking signs and the end of a level by a shared, nameable Code (Signale), and see every rule of a level in one overview
- let signs and characters speak in pixel-font speech bubbles
- add collectibles and hazards
- create melee and ranged combat
- use projectiles and bombs
- configure several enemy behaviours
- create water, floating and other movement regions
- add parallax backgrounds, straight, round and four-colour gradients, lighting, weather and visual effects
- playtest the game directly in the Studio
- save and continue developing games through generated game codes

The built-in **Rezepte** provide small German-language examples showing how individual mechanics can be assembled into games. Every recipe's scene can be opened in the Studio and saved as an own game.

The project deliberately keeps the authoring environment visual and approachable. New mechanics should preferably be composed from reusable traits rather than requiring special-purpose character classes or scripting.

## How a game is structured

### Sprites

Sprites contain one or more animation states.

For example, a character might have states for:

- standing
- walking
- jumping
- attacking
- taking damage
- dying

Each state consists of one or more frames and can have its own animation speed.

Sprites can also carry traits describing what they do in the game. A sprite may, for example, be solid, collectible, a player character, an enemy, a ladder, a door or a projectile.

### Levels

Levels contain layers of placed sprites.

Layers make it possible to separate things such as:

- collision geometry
- scenery
- foreground decoration
- interiors
- lighting and visual effects

The runtime combines the level geometry with the traits of the sprites placed in it.

### Movement and physics

Movement is trait-based rather than tied to a single kind of platform game.

The engine supports, among other things:

- normal platform movement
- slopes
- slippery surfaces
- ladders
- conveyors
- swimming
- floating
- currents
- movement regions with different gravity and movement parameters

Player characters and supported enemy behaviours use the same underlying movement systems where practical.

### Combat and enemies

The Studio contains a shared combat foundation for player characters and enemies.

It supports:

- melee attacks
- ranged projectiles
- thrown projectiles
- timed bombs
- damage and knockback
- hit reactions
- attack, hit and death animations
- configurable enemy health
- dropped items

Enemies can use different behaviours such as guarding, hunting, fleeing, lurking, hopping, fluttering and stomping. Additional traits can allow suitable enemies to deal with slopes, obstacles, gaps and ladders.

### Companions (Begleiter)

A sprite with the trait **Begleiter** is a character the game controls that tries to stay with the player character – a dog, a robot, a fairy, a friend. It is not an enemy: it deals no damage, is never attacked, has no health, collects nothing and does not count for "alle Gegner besiegt". Several companions line up behind the player.

*Begleiter* says that it follows; its own movement settings say **how**: Geschwindigkeit, *kann springen* with its own Sprungkraft, *kann schwimmen* (into a Bewegungsbereich "Schwimmen"; otherwise it waits at the shore) and *kann fliegen* (through the air, over gaps and water). It never takes over the player's abilities, so a weak jumper genuinely stays below a ledge the player jumped onto. When it has really lost the player – far away, out of sight and getting no closer for a few seconds – the game helps a little later: it comes back from just outside the screen behind the player and walks or flies in. When the player loses a life, companions come along to where it starts again.

Walking, jumping, slopes, Bewegungsbereiche and animation are the same engine code as for the player and the enemies (`app.js` `Character`); `src/static/companion_ai.js` only decides which keys a companion presses and when it is lost. Companions have the usual optional states (Stehen, Laufen, Springen, Fallen, Schwimmen, Schweben) plus *Begleiter fliegt*.

### Saved games and versions

Games are stored as JSON.

Saving a game creates a short tag derived from its contents. The game JSON itself is written to the generated game-data directory, while Neo4j stores metadata and relationships between versions.

All saved games are public to anyone who has their game code or link. There are no accounts, owners or per-game permissions: anyone can open a game in the Studio, change it and save another version. This does not require a global catalogue of every game; discovery can remain based on shared codes and links.

When a saved game is opened, its tag becomes the parent for the next normal save. Saving creates a new immutable child version, and that new tag then becomes the parent for the following save. Older versions remain untouched, so the development of a game forms a version tree.

#### Independent forks

**Als eigenes Spiel weiterführen** (Einstellungen → Spiel, shown for every game that has a code) starts an independent game from the current state. A short dialog asks for a new title and the author's name, then the current state is saved as the root of a new lineage:

- the source game and its version history stay unchanged
- the new game has no `parent`, so it is a new entry in the game list, and every later normal save descends from it
- it gets its own code even when nothing has been edited yet
- no account, ownership or permission is involved, and no global list of games is needed

Tags are content-derived, so clearing `parent` alone would give an unchanged root game (or two identical forks) the same code. An independent game therefore carries a random `lineage` field (`own_game.js`). It only makes the saved JSON distinct and is never read by the game; games without it keep their tags and behaviour. It is not available during a live collaboration session (leave the session first).

#### Live collaboration

Live collaboration lets groups work on the **same game at the same time from different browsers**. It is enabled in development and production; `COLLABORATION = false` in `env.rb` switches it off (then run `./config.rb build` and restart). Sessions live in the memory of the Ruby process and are written to `raw/collaboration/sessions.json` every 30 seconds and on shutdown, so a restart or deploy does not end them: browsers reconnect and continue. That file contains the secret session codes and reconnect tokens; it lives below `raw/`, which nginx does not serve, and must stay there. A session ends six hours after the last activity. At most 200 sessions run at the same time (`COLLABORATION_MAX_SESSIONS` in the Ruby container's environment changes that) and 40 people can be in one session; one client address can keep at most 60 sessions open, and a client that enters many wrong session codes is blocked for a few minutes.

Collaboration should stay compatible with the no-account model:

- starting a session produces a separate, hard-to-guess collaboration link or code
- the ordinary public game code does **not** grant access to an active collaboration session
- everybody starting or joining a session enters a display name
- the name is used only inside that live session and is not an account or ownership identity
- no permanent membership is required
- the collaboration session is temporary; the normal saved game remains the durable artefact

Every participant gets a colour from the server (stable for as long as they are in the session, also across reconnects and restarts) and appears as a small token with their initial: in the status bar, on the sprite or level they are working on, and in the session dialog, which also says what everybody is doing. Something another participant is working on is shown inside a frame in their colour with a name tag, for example **„Mia baut gerade an diesem Level. Du kannst zuschauen.“**; the hand tool and the mouse wheel still work there. Names do not have to be unique; two children with the same name are told apart by their colour, and the name is never treated as authentication.

A collaboration session starts from one saved game version and keeps one server-authoritative working state (`src/ruby/collaboration.rb`, browser side `src/static/collaboration.js`). Browsers talk to it over a WebSocket with small operations: lock or unlock a resource (the game settings, one sprite or one level), replace the resource they hold as a whole, and insert, delete or move a sprite or level. Every applied operation increases the session revision by one and is broadcast to all participants; a browser that notices a gap, or reconnects, asks for the current state instead of trying to reconstruct missed edits.

Conflicts are prevented rather than merged. Different people can work on different resources at the same time, for example one sprite and one level; a resource being edited elsewhere is read-only and shown as occupied by the participant who holds it. A sprite or level somebody else is editing cannot be deleted, and the last sprite or level cannot be deleted at all. A lock that has not been used for a change for three minutes can be taken over by somebody else, so a forgotten tab does not block a sprite for a whole lesson, and a participant that has not been heard from for two minutes loses its lock. Every participant receives a secret reconnect token, so a browser whose connection dropped takes over its own participant again. Fine-grained simultaneous editing of the same pixel frame or level region can be considered later if real use shows that it is needed.

Collaboration needs stable identities for editable objects. Sprites and levels carry durable IDs in the saved game JSON (`src/static/game_ids.js`). Old games receive deterministic IDs when they are opened, so the same old game always gets the same IDs. Collaboration operations address sprites and levels by these IDs, so concurrent insertions, deletions or reordering cannot make an operation intended for one object target another. References to sprites (placed sprites, attack visuals, enemy drops) are stored as sprite IDs too, so reordering or deleting a sprite never renumbers anything else. Old games with index references are converted when they are opened; the game engine itself still works with array indices and resolves the IDs when a game is loaded for playing.

Saving from a collaboration session should use the existing immutable version model. One serialized save creates the next normal game version, broadcasts its new tag to all participants and makes that version the parent for the following save. An independent fork remains a separate action: a group can first choose **Als eigenes Spiel weiterführen** and then start a collaboration session in that new lineage.

Existing saved JSON is considered part of the compatibility contract of the project: new engine features should continue to load old games without requiring migrations.

## Project structure

The most important directories are:

```text
.
├── config.rb              development/production Docker configuration
├── env.template.rb        configuration template
├── docker/                container definitions
├── src/
│   ├── static/            browser application and game engine
│   └── ruby/              Sinatra backend
├── test/                  focused JavaScript tests
├── rezepte/               source material for the built-in recipes
├── palettes/              pixel-art colour palettes
└── data/                  local generated/runtime data (created locally)
```

Some particularly important frontend files are:

```text
src/static/game.js
```

Studio data handling, editor configuration and normalization of loaded game data.

```text
src/static/studio.js
```

Main Studio interaction and authoring workflow.

```text
src/static/canvas.js
```

Sprite and animation editing.

```text
src/static/level_editor.js
```

Visual level editing and sprite placement.

```text
src/static/traits.js
```

Definitions and metadata for sprite and state traits.

```text
src/static/app.js
```

Main game runtime, collisions, movement and interaction.

```text
src/static/baddie_ai.js
```

Enemy behaviour.

```text
src/static/combat*.js
```

Shared combat systems.

```text
src/static/movement_regions.js
src/static/signals.js
src/static/layer_fade.js
src/static/speech.js
```

Movement regions, and Signale: keys, collectibles, switches, pressure plates, Bereiche, defeated enemies and the level's start send a Code; doors, layers, signs and the level react (a roof that disappears while the player is inside, a bridge that appears, an ambush, a sign that speaks when the player walks past, a level that is done once every enemy is defeated). Speech bubbles for signs and characters.

```text
src/static/image_import.js
src/static/palette_apply.js
src/static/sprite_basket.js
src/static/sprite_actions.js
src/static/own_game.js
```

Authoring helpers: importing pictures, converting to a palette, borrowing sprites from other games, the sprite editor's right-click menus, and starting an own game from an existing one. `AGENTS.md` has the complete code map.

The backend lives mainly in:

```text
src/ruby/main.rb
```

It provides the HTTP API, stores and loads game JSON, generates assets and maintains game/version metadata in Neo4j.

## Architecture

The local application consists of three Docker services:

```text
Browser
   │
   ▼
 nginx
   │
   ├── static Studio / game files
   │
   └── dynamic requests
           │
           ▼
      Ruby / Sinatra / Thin
           │
           ├── game JSON and generated files
           │
           └── Neo4j
```

### nginx

nginx serves the browser application from `src/static/` and proxies API requests to the Ruby application.

### Ruby backend

The backend uses Sinatra running through Thin.

Among other things it handles:

- saving games
- loading games
- temporary playtest saves
- game search
- version relationships
- generated spritesheets and other assets
- the studio's version (`/api/ping`, a digest of the files in `src/static/`) and Fehlerberichte from the studio (`/api/report_error`)

### Neo4j

Neo4j stores metadata about saved games and their relationships.

The actual game descriptions are JSON files; Neo4j is primarily used for indexing and the graph of game versions.

## Running locally

### Requirements

You need:

- Git
- Ruby
- Docker
- Docker Compose

The application dependencies themselves run inside containers, so you do not need to install Sinatra, Neo4j or the other Ruby gems on the host.

Both the newer

```bash
docker compose
```

and the older

```bash
docker-compose
```

command are supported by `config.rb`.

### Clone the repository

```bash
git clone https://github.com/specht/2d.git
cd 2d
```

### Create the local configuration

Copy the development configuration:

```bash
cp env.template.rb env.rb
```

The supplied defaults are suitable for local development.

In development mode the Studio is available at:

```text
http://localhost:8025
```

Local data and logs are written below:

```text
./data
./logs
```

These locations can be changed in `env.rb`.

### Build the containers

```bash
./config.rb build
```

`config.rb` generates `docker-compose.yaml` from `env.rb`, prepares the required local directories and invokes Docker Compose.

Run this again after changing configuration or Docker build dependencies.

### Start the Studio

```bash
./config.rb up
```

Then open:

```text
http://localhost:8025/
```

Development mode mounts the source directories into the containers. Static frontend changes therefore do not require rebuilding the image; refresh the browser to load them.

The Ruby development server runs through `rerun`, so changes below `src/ruby/` restart the backend automatically.

### Stop the Studio

If it is running in the foreground, `Ctrl+C` stops the current Compose process.

To stop and remove the containers explicitly:

```bash
./config.rb down
```

### Rebuild from scratch

When Docker dependencies or the environment configuration have changed:

```bash
./config.rb down
./config.rb build
./config.rb up
```

## Development data

The default development configuration creates data beneath `./data`.

Important generated directories include:

```text
data/
├── gen/
│   ├── games/      saved/generated game JSON
│   └── png/        generated PNG assets
├── raw/
│   └── uploads/    uploaded source data
└── neo4j/          Neo4j database
```

Logs are stored below:

```text
logs/
```

Deleting these directories deletes local development data. They should therefore not be treated as disposable if the local games matter.

## Tests

Focused engine tests live in `test/`.

They cover systems such as:

- combat
- projectiles and bombs
- character combat states
- enemy AI
- controls
- movement regions
- signals and layer fading
- backdrop effects
- speech bubbles and sentence splitting
- picture import analysis and palette conversion
- stable IDs, sprite copying between games and level undo/selection
- the collaboration client and session store

Run them with `node --test test/*.cjs` (and `ruby test/collaboration_store_test.rb` and `ruby test/client_errors_test.rb` for the backend store and the Fehlerberichte).

These tests are useful for protecting engine contracts, but they are not a substitute for actually trying changes in the Studio and playing affected games in a browser.

## Recipes

`rezepte/` contains the source for the German help recipes shown in the Studio.

The recipe system does more than generate documentation: recipe scenes are run against the real game engine, their expected results are checked, and demonstration animations are generated automatically.

See:

```text
rezepte/README.md
```

for the recipe format and build process.

A recipe should only advertise functionality that works in the current Studio.

## Development principles

The project is used with existing student games, so backwards compatibility matters.

In particular:

- old game JSON must continue to load
- new stored properties should normally be optional
- absent properties should preserve previous behaviour
- established gameplay should not change accidentally
- new systems should compose through traits where practical
- student-facing labels and help should remain in German
- editor workflows should remain understandable without exposing engine internals
- authoring improvements are generally more valuable than adding isolated mechanics

See `AGENTS.md` for the standing development rules and `TODO.md` for the current backlog.

## Documentation

The active project documentation is intentionally small:

- `README.md` describes the project, architecture, save/version model and local setup.
- `TODO.md` contains only work that is still open or needs a design decision.
- `AGENTS.md` contains standing compatibility and development contracts.
- `rezepte/README.md` documents the recipe system and its build/verification workflow.

Older handoff and design documents live under `docs/archive/`. They are retained as historical context, but they are not authoritative descriptions of the current implementation or roadmap. Current source code and the active documents above take precedence.

## Production

Production uses the same generated Docker Compose setup but with `DEVELOPMENT = false` and production-specific values in `env.rb`.

The production configuration enables the configured virtual host and Let's Encrypt settings rather than exposing the development port directly.

Do not use the values from `env.template.rb` unchanged for a real deployment.

### Restarting during a lesson, crashes and Fehlerberichte

The server can be restarted while a class is working (for example to apply a fix):

- **While it is away**, nginx answers with `src/static/neustart.html` ("Gleich geht's weiter!") instead of a page, which reloads by itself once the server is back. Open studios show a banner: the server is restarting, keep working, only saving waits (`server_watch.js`); a save that failed is offered again when it is back.
- **After a restart with changed files** (the version is a digest of `src/static/`), open studios offer "Neu laden". Nothing is lost: the studio keeps a copy of unsaved work in the browser (IndexedDB, `rescue.js`) and brings it back after the reload by itself – also for a game without title or author, which never has to be saved for this. A restart without changes offers nothing.
- **A copy found otherwise** (the tab was closed, the browser crashed) is offered when the studio opens, naming the game and the time.
- **When something goes wrong** in the studio, the robot appears: the work is copied first, then it offers "Neu laden" (everything comes back) or "Weiterarbeiten". The error is reported to the server with the last clicks and keys, the pane and tool, the studio version and the code of a temporary copy of the game (`crash_report.js`), and appended to `data/raw/client-errors/<date>.jsonl` (not served by nginx).

To see what went wrong:

```bash
./config.rb exec ruby ruby errors.rb                  # today, grouped, most frequent first
./config.rb exec ruby ruby errors.rb list 7           # the last seven days (list all: everything)
./config.rb exec ruby ruby errors.rb show 3f2a1c      # one group: stack, the clicks before, the games
./config.rb exec ruby ruby errors.rb watch            # new reports as they come in, during a lesson
./config.rb exec ruby ruby errors.rb resolve 3f2a1c   # fixed: hidden until it happens again
./config.rb exec ruby ruby errors.rb prune 30         # delete days older than 30 days
```

Each group has a short code. `show` gives the message, where it happened, what the child did just before, and `/?<code>` to open the child's game as it was at that moment – reproduce the bug there, fix it and add a regression test, then `resolve` it.

When the Ruby container is recreated rather than restarted, nginx may keep the old address and answer 502 until it is restarted as well (`./config.rb restart nginx`).

### Playtesting in class

Children test each other's games and give feedback; the teacher prints it per game. It is run from the terminal:

```bash
./config.rb exec ruby ruby playtest.rb              # how the round stands
./config.rb exec ruby ruby playtest.rb on 3         # switch on, a test runs 3 minutes (the default)
./config.rb exec ruby ruby playtest.rb minutes 4    # change how long a test runs
./config.rb exec ruby ruby playtest.rb games        # the submitted games: tests, fun, versions
./config.rb exec ruby ruby playtest.rb testers      # who has tested how many games
./config.rb exec ruby ruby playtest.rb remove 3fa2  # take a game out of the round (its feedback stays)
./config.rb exec ruby ruby playtest.rb off          # switch off (surveys being filled in still arrive)
./config.rb exec ruby ruby playtest.rb pdf          # the feedback as a PDF to print
./config.rb exec ruby ruby playtest.rb reset        # a new round; the old one goes to archive/
```

While it is on, the studio shows a **Playtesting** tab (within half a minute: the studio's ping carries it):

- **Dein Spiel:** a child gives the game a title and their name and submits it; it is saved first. From then on every save of that game is the version that gets tested (also saves made while playtesting is off).
- **Spiele der anderen testen:** the child enters their first name and gets the next game – nobody chooses: the server hands out the game tested least so far (finished and running tests), never one's own, never one tested before. The game runs for the set time in the tab; after half of it "Fertig – zur Umfrage" may end it early. A reload during a test continues it.
- **The survey:** seven categories rated with five faces (Spaß, Aussehen, Animationen, Steuerung, Fair und ausgeglichen, Storytelling, Atmosphäre), three quick choices (difficulty, how far, bugs), and two required sentences – what was really good, what could be better – plus bugs. "Das Spiel ließ sich gar nicht spielen" skips the rest. The tester's first name is printed with the answers.

`pdf` writes `data/raw/playtesting/rueckmeldungen-<date>.pdf`: one handout per game (sorted by author) with the player character, the ratings as bars, what was liked most and where most is left, the choices, every comment with its tester's name (marked when it was about an older version) and a "Mein Plan" box for three next steps; the last page is an overview for the teacher. `pdf archive/<file>.json` prints an earlier round. The PDF needs the `prawn` gem: rebuild the Ruby container once (`./config.rb build ruby`).

There are no accounts: a browser is recognised by a random id in its localStorage, which keeps a child from testing their own game or one game twice. Everything is in `data/raw/playtesting/state.json` (not served by nginx).