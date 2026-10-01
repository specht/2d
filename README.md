# 2D Game Studio

2D Game Studio is a browser-based environment for creating small 2D games.

It is designed primarily for use with children and students: sprites can be drawn and animated directly in the browser, behaviours are assembled through visual properties and traits, and levels are built from those sprites without requiring students to write game-engine code.

A public instance is available at:

https://2d.hackschule.de/

## What can you build with it?

A game consists of animated sprites, behaviours and one or more levels.

The Studio lets you:

- draw pixel-art sprites and animations
- define animation states
- assign behaviours to sprites
- create player characters and enemies
- build layered levels
- configure collision and movement
- use slopes, ladders, conveyors and moving environments
- create doors, keys and checkpoints
- add collectibles and hazards
- create melee and ranged combat
- use projectiles and bombs
- configure several enemy behaviours
- create water, floating and other movement regions
- add parallax backgrounds, lighting, weather and visual effects
- playtest the game directly in the Studio
- save and continue developing games through generated game codes

The built-in **Rezepte** provide small German-language examples showing how individual mechanics can be assembled into games.

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

### Saved games and versions

Games are stored as JSON.

Saving a game creates a short tag derived from its contents. The game JSON itself is written to the generated game-data directory, while Neo4j stores metadata and relationships between versions.

All saved games are public to anyone who has their game code or link. There are no accounts, owners or per-game permissions: anyone can open a game in the Studio, change it and save another version. This does not require a global catalogue of every game; discovery can remain based on shared codes and links.

When a saved game is opened, its tag becomes the parent for the next normal save. Saving creates a new immutable child version, and that new tag then becomes the parent for the following save. Older versions remain untouched, so the development of a game forms a version tree.

#### Independent forks

An explicit independent-fork workflow is planned for cases where somebody wants to use an existing public game as a starting point without keeping the new work in the source game's version tree.

An independent fork should:

- save the current game state as the root of a new lineage
- leave the source game and its version history unchanged
- make subsequent normal saves descend from the new root
- produce its own game code even when the gameplay content has not changed yet
- require no account, ownership or permission model
- not require a global list of all games

The current tags are content-derived. Simply clearing `parent` is therefore not sufficient to guarantee a distinct new root in every case: an unchanged root game, or repeated forks of the same version, could otherwise collapse to the same tag. The fork design needs a small independent lineage identity, for example an optional non-gameplay lineage identifier, while existing games without it keep their current tags and behaviour.

#### Live collaboration

A separate live-collaboration workflow is planned for groups who want to work on the **same game at the same time from different browsers**.

Collaboration should stay compatible with the no-account model:

- starting a session produces a separate, hard-to-guess collaboration link or code
- the ordinary public game code does **not** grant access to an active collaboration session
- everybody starting or joining a session enters a display name
- the name is used only inside that live session and is not an account or ownership identity
- no permanent membership is required
- the collaboration session is temporary; the normal saved game remains the durable artefact

Participant names should be visible in the session and in conflict messages, for example **„Mia bearbeitet gerade diese Ebene“**. Names do not have to be globally or even session-wide unique; if two children choose the same name, the UI can distinguish them visually without treating the name as authentication.

A collaboration session starts from one saved game version and keeps one server-authoritative working state. Browsers send editing operations to the session, receive operations from the other participants and track a monotonically increasing session revision. A reconnecting browser can therefore request the current state and revision instead of trying to reconstruct missed edits.

The first version should favour understandable conflict prevention over a fully general collaborative-editor algorithm. Different people should be able to work on different resources at the same time, for example one sprite and one level. A resource currently being edited elsewhere can use a short-lived lease/lock and be shown as temporarily occupied by the participant who holds it. Fine-grained simultaneous editing of the same pixel frame or level region can be considered later if real use shows that it is needed.

Collaboration also needs stable temporary identities for editable objects. Saved games use arrays and some index-based references; concurrent insertions or deletions must not make an operation intended for one sprite or placed object accidentally target another. Session-only stable IDs can identify sprites, states, frames, levels, layers and placed objects while collaborating and disappear again when the normal game JSON is saved.

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
src/static/visibility_regions.js
```

Movement regions and seamless/interior visibility regions.

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
- visibility regions
- backdrop effects

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