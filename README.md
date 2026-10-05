# 2D Game Studio

2D Game Studio is a browser-based environment for creating small 2D games.

It is designed primarily for use with children and students: sprites can be drawn and animated directly in the browser, behaviours are assembled through visual properties and traits, and levels are built from those sprites without requiring students to write game-engine code.

A public instance is available at:

https://2d.hackschule.de/

## What can you build with it?

A game consists of animated sprites, behaviours and one or more levels.

The Studio lets you:

- draw pixel-art sprites and animations (with onion skinning, a live animation preview, mirrored drawing, recolouring a colour in every frame, outlines, and undo/redo – also for adding, duplicating and reordering whole sprites), or paste and drop pictures: background, pixel size and the frames of a strip or a numbered series of files are detected
- define animation states, and duplicate, copy and move sprites, states and frames by right-click – several frames at once, too (Shift / Strg + click), also reversing their order
- start quickly with sprites from the Sprite-Katalog (everything from the recipes and more, grouped: Spielfiguren, Gegner, Natur …) or borrow them from other games by their code (Sprite-Korb)
- convert a sprite or a whole game, backgrounds included, to a pixel-art palette
- assign behaviours to sprites
- create player characters and enemies
- give the player companions (Begleiter: pets, robots, friends) that follow with their own way of moving
- build layered levels on one grid (the game's Rastergröße, 24 × 24 unless a child chooses another on purpose; sprites of 1, 2 or 3 cells line up, and Größe ändern offers whole cells): select, move, copy and fill many sprites at once (rectangles, their edges, lines), undo and redo, and find your way around large levels with an overview map
- configure collision and movement
- use slopes, ladders, conveyors, moving platforms and lifts, and moving environments
- create doors, keys and checkpoints
- play the levels as a simple sequence, or let exits lead to chosen levels: two doors to different levels, a hub, a shop or a bonus level (Nebenlevel) that leads back, and the end of the game wherever you want it – with a Levelübersicht of how everything is connected; a level entered again looks as it was left
- connect switches, pressure plates, keys, collectibles, Signalbereiche, defeated enemies and the start of a level (a timer) to doors, layers, speaking signs, moving platforms and the end of a level by a shared, nameable Code (Signale) – with Zähler for "all three switches" or "five coins" – and see every rule of a level in one overview
- let signs and characters speak in pixel-font speech bubbles
- add collectibles and hazards
- create melee and ranged combat
- use projectiles and bombs
- configure several enemy behaviours
- create water, floating and other movement regions
- add parallax backgrounds, straight, round and four-colour gradients, lighting, weather and visual effects
- show the player only what the game uses: hearts, an energy bar and a coin counter drawn with the game's own sprites and pixel font
- playtest the game directly in the Studio, a level at a time (Level testen, T) or from the start
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

### The sprite editor

- **Columns at 1920 × 1080,** from the general to the particular: the whole sprite list at full height, with a search over the Titel and filters by what a sprite is (Figuren, Gegner, Blöcke, Sammeln, Türen & Schalter, Deko – shown from 13 sprites on, `sprite_filter.js`) – on the left, like the sprite palette of the level editor; tools, view switches, palette and Funktionen, always 240 px wide (six tools, eight colours and eleven variations per row, edge to edge), beside the drawing area as in the level editor; the drawing area with the *Verlauf* above it and the frames below, near the middle; then what is being edited: the sprite (Titel, Mischmodus, then its Eigenschaften) and its Zustände (the list with their roles, *Wer zeigt was?*, the state's settings and *Rolle zuweisen*) in a column of their own. Where a column of their own would cost the drawing area more than a little (below about 1900 px), the Zustände come below the Eigenschaften; on smaller screens the drawing area shrinks before the columns get too narrow, and the left column scrolls when the screen is low – its scrollbar sits beside the boxes, so the six tools stay in a row, also at any page zoom (the tools and the colours are grids of fixed columns). The sprite list is as wide as whole tiles (three at least, two on a tablet); what is left goes to the sprite and state columns (`sprite_pane_layout` in `studio.js`).
- **Wer zeigt was?** under the list of Zustände, for a Spielfigur, Gegner or Begleiter: for Stehen, Laufen, Springen, Fallen (and Klettern, Tot, and every pose that has a state) to the left, to the right and from the front, the picture the game shows – its own picture (green), the other side mirrored (blue), the picture of another role (yellow) or the Grundbild, the first state (grey). None of it is an error – a figure with one picture for everything works –, so the words stay friendly: the head says "Platz für 4 Bilder" ("vorn" is only seen at the very start and is not counted), and a line says how to add one if the child wants to. For a Tür, Schalter, Druckplatte, Zähler … the states it has. A figure without any left/right role shows its first state as drawn when it moves right and mirrored when it moves left – so draw it facing right. A click on a picture chooses that state. `who_shows_what.js` builds the same table as the game (`Character` in `app.js`; a test compares both for hundreds of sprites).
- **View switches** under Werkzeuge, like the level editor's: Onion Skinning (O), Vorschau (P) and Spiegelnd zeichnen (M), with their keys (`SPRITE_VIEW_TOGGLES`).
- **The status bar** shows the tool's own hints on the left and, always on the right, Rückgängig, Wiederholen, Laden, Speichern (each with its key – Strg+Z, Strg+Y, Strg+O, Strg+S – so children learn them), Vollbild (a button that switches the studio in and out of full screen, like F11), Hilfe and Zusammenarbeiten. Everything that has a button elsewhere (view switches, X, the tabs) is left out; its key still works.
- **Drawing:** the mouse wheel zooms and Leertaste + drag (or the middle button) moves the view with every tool; the brush size comes back after the pipette, fill, spray, gradient or selection; the palette's swatch of the pen's colour is highlighted (also after the pipette). **X** switches between the colour and transparent (like the two colours in Photoshop; the second one is always transparent): pen, shapes and fill then erase. The tool button at X shows both, the one the pen paints with in front; a line under the palette says what X does (yellow while transparent is the colour); the variations of the colour stay while transparent is chosen. The right mouse button never paints: on the drawing area it opens a menu with every tool – the selection's menu while there is a selection, else Farbe von hier nehmen, Durchsichtig malen, Einfügen, Alles auswählen, spiegeln and drehen, Frame leeren. *Sprite verschieben* has no key any more (X is the colour switch); its button took the place of *Frame leeren*. The rows under the palette are variations of the colour: similar hues, pixel-art shades (darker ones cooler, lighter ones warmer, `shade_ramp` in `pixel_tools.js`), darker/lighter, paler/stronger and more transparent – each row says what it is on hover.
- **Selections** (Rechteck auswählen): Strg+C / X / V copy, cut and paste the selected pixels – pasted at the place they came from, also in another frame (the same head on every frame of a walk); Entf clears them, Esc ends the selection, the arrow keys move it by a pixel (Shift: four), B / N mirror only the selection, and the right-click menu offers all of it (`pixel_tools.js`: `copy_selected`, `paste_selected`, `move_selected`, `flip_selected`). After the window was left, Strg+V pastes a picture from outside again (the picture import).
- **The Verlauf** above the drawing area keeps the pictures drawn or looked at lately (each once); a click puts one into the frame being drawn, dragging it onto the frames inserts it as a new frame. Pictures of another size are dimmed.
- **Names:** a new sprite is "Sprite 4", a new state "Zustand 2" (the next free number; `default_names.js`). While a state still has such a name, giving it a role names it after the role ("laufen", "laufen links", "geöffnet"); a sprite still called "Sprite 4" is named after its first trait that says what it is ("Gegner", "Tür"). Names the child typed are never replaced. Lists show "Zustand 2" dimmed for a state without a name, a state's role in small letters beside its name when the name does not say it, and a double-click on a state renames it in the list. Right-click menus rename and delete sprites, states and frames (deleting a sprite can be undone like the trash); "Frame leeren" (in the drawing area's menu) only clears the pixels. A new sprite's first state is "Zustand 1"; layers have a Titel field like sprites, states and levels (with "Ebene 2" as placeholder), and an unnamed layer is listed dimmed. Every label that names the shown sprite, state, level or layer follows switching, renaming and undo (the level and layer settings heads, the selection's head, the layer in the corner of the level view).

### Levels

Levels contain layers of placed sprites.

Layers make it possible to separate things such as:

- collision geometry
- scenery
- foreground decoration
- interiors
- lighting and visual effects

The runtime combines the level geometry with the traits of the sprites placed in it.

### The level editor

- **The layout at 1920 × 1080:** on the left the tools, the view switches (Gitter, Signale, Karte, Levelübersicht, Bereiche, Hervorheben, Animieren – small buttons with their keys; the grid size of the session folded away) and the sprite palette at full height, with the same search and filters as the sprite list plus *Im Level*; a game with fewer than four sprites says where more come from (*Sprites holen*). On the right the level list, *Einstellungen von »…«* (folds away, remembered per browser), the layers, *Einstellungen der Ebene* (folds away; always open for a Hintergrund, Signalbereich or Bewegungsbereich) and the selection's panel taking the rest of the height, so a selected sprite's settings are never below the screen. A level without a Titel is listed as "Level 3", dimmed; a double-click on a level or a layer renames it in the list.
- **The right-click menu:** with every tool but Verbinden (where it cancels), a right-click on a sprite selects it (switching to Auswählen) (in whichever layer it lies) and shows what can be done with it: Ausschneiden, Kopieren, Einfügen, Duplizieren, Löschen (with their keys), Alle gleichen auswählen, Ersetzen durch, In Ebene ›, Nach vorne holen / Nach hinten schicken (the order in the layer is what is drawn in front; moving keeps it), Im Sprite-Editor bearbeiten, Verbinden … (for something that sends or reacts), Hier testen, and locking or hiding the layer. On empty ground: Einfügen there, Alles auswählen, Hier testen, Ganzes Level zeigen. Where a Hintergrund, Signalbereich or Bewegungsbereich lies under the mouse, the menu offers to edit it (its layer becomes the current one, that rectangle the chosen one). A finger held still on a tablet opens it too. The right button never erases: **X** makes the pen erase (*Radieren* above the sprite palette and in the status bar; the cursor is a red frame with a cross) – the topmost sprite under the mouse, also a wider one than the chosen sprite; X again, choosing a sprite or another tool makes it place again. Levels and layers have Umbenennen and Löschen in their menus.
- **Placing and changing:** the pen places sprites on the grid; Strg + drag fills a rectangle (Shift: only its edge, Alt: a line). The select tool selects many sprites (rectangle, Shift adds), drags them in grid steps (Shift: pixel by pixel) or with the arrow keys, copies, cuts, pastes and duplicates them (Strg+C/X/V/D, also into another layer or level), moves them to another layer (*In Ebene*), selects every copy of a sprite (*Alle gleichen*) and replaces them with another sprite (*Ersetzen durch*). A double-click picks a sprite in any layer (again: the one behind it).
- **Undo:** Strg+Z / Strg+Y per level (and per sprite in the sprite editor), and for the level list: a new, duplicated, deleted or moved level is undone in the order things happened (`level_list_history.js`). Right after deleting, the trash's own offer brings back the whole game as before.
- **Hintergründe, Signalbereiche and Bewegungsbereiche:** with their layer current (no tool chosen), a rectangle is dragged to move it (on the grid while it is shown) and chosen by pressing on it; the handles resize it. *Bereiche* (B, on by default) draws every such rectangle of the level as a thin dashed line (blue, yellow, green), also while another layer is current. *Hervorheben* (D, off by default) shows the current layer clearly and keeps the order of the layers: what lies behind it is darkened, what lies in front of it is drawn faint, so it shows through.
- **Layers:** reordered by dragging, shown and hidden (eye), locked (padlock: nothing can be painted, moved or deleted in them); the current layer is named in a corner of the view.
- **Finding your way:** the hand tool (Q), the middle mouse button or Leertaste + drag move the view, the mouse wheel zooms, and the Übersichtskarte (M) shows the whole level small in a corner. On a tablet two fingers zoom and move the view with every tool, and a finger can tap and drag on the Übersichtskarte.
- **Overviews:** the Signale-Übersicht (S) lists every rule of the level, the Levelübersicht (L) every level of the game and where its exits lead.
- **Testing:** Level testen (T) plays the level straight away, with the figure where the mouse is; R starts again, Esc returns to the editor exactly as it was. Nothing is saved or changed by a test run.

### On a tablet (touch, no mouse, no keyboard)

Landscape from about 1024 × 768 works with fingers only (`widgets.js` long press, `canvas.js`, `level_editor.js`):

- A finger held still for about half a second is a right-click everywhere – lists, palettes, the drawing area, the level view –, and a tap opens a submenu. What the finger had begun (a dot of paint, a sprite with the pen) is taken back; with the pen a sprite is only set once the finger moves or lifts.
- Two fingers zoom (closer / apart) and move the view (together), with every tool, in both editors; the second finger never paints.
- Shift, Strg and Alt of the tools are in the status bar and stay on after a tap – until the tool changes (then they are released, nothing stays on unseen). X (Farbe ↔ durchsichtig, Radieren) has its buttons, the view switches are buttons, Rückgängig and Wiederholen are in the status bar.
- Lists are dragged by their handle (wider on a touch screen); the handles of rectangles are bigger, too.
- Still keyboard only: Strg + drag shapes in the level editor, the arrow keys that nudge a selection, Esc. Hover texts have no touch equivalent. Portrait and phones remain unsupported.

### How levels follow each other

By default the levels are a sequence: an exit (*Levelwechsel*) leads to the next level of the list that has *Level verwenden*, and after the last one the game shows its end screen (*Ende*). A child who never thinks about it never sees anything else.

Each placed exit can say where it leads instead (*führt zu*): a particular level, *zurück, woher man kam* or *zum Spielende*. So two doors can lead to different levels, a hub can have doors to several levels, and a shop or bonus level can lead back. A level can be a *Nebenlevel*: the sequence skips it, and its exits without a target lead back to where the player came from. Coming in through an exit with a target, the player stands at the exit that leads back (the door it came through), and dying brings it back there. An exit can also wait for the action key (*nur mit Aktionstaste*), so the player can walk past it. "geschafft bei Signal" has the same *führt zu*. Exits refer to levels by their stable ID, so reordering levels changes nothing. The rules are in `src/static/level_flow.js`.

The **Levelübersicht** (L in the level editor) draws every level as a node and every exit as an arrow – grey to the next level, yellow to a chosen level, dashed for *zurück*, green to the end. Clicking a level opens it, clicking an arrow selects its exit, and warnings name levels nobody reaches, exits in layers without collisions and a game whose end cannot be reached (`src/static/level_map.js`). An exit that waits for a Signal has a ⚡ on its arrow, and the arrow's text says which Code and who sends it: "geschafft bei Signal", or an exit on a layer that reacts to a Code ("Der Ausgang in der Ebene »Tor« erscheint erst bei »Tor auf« (Code 5) – sendet: 1 Schalter"). An exit that is not there until a Code comes that nothing in the level sends is a warning (the ⚡ turns red). A door in front of an exit is not shown: nothing in the game links the two. A game that never chose a target is simply a row: a level that has no exit yet is joined to the next one (or to the end) by a thin dashed arrow, *Reihenfolge*, and gets a hint instead of a warning – "Noch kein Ausgang" –, so a new game is connected from the start; clicking that arrow opens the level and says how to make an exit. A help line under the map says where an exit's target is set.

A level that is entered again during the same run looks as it was left: collected sprites and keys stay collected (a found key still opens its doors), defeated enemies stay defeated and loot they dropped is still lying where it fell, Schalter keep their position, and the signals these sent arrive again at once – so doors, layers, Zähler and companions are as they were. Crumbling blocks, Druckplatten, Signalbereiche and timers start afresh, so a level can never become impossible to finish. A new game, game over and a new test run forget everything.

### What the player sees: the start screen and the curtains

The start screen shows the game's title and author in the game's own pixel font (the same letters as the HUD and the speech bubbles), the Start button and the game's own controls. The screens between are in German and in that font, drawn as crisp bitmaps (`src/static/screens.js`): a level begins with its name (if it has one) and "Drück eine Taste, um loszulegen"; a lost life says "Autsch!" and how many lives are left; then "Game Over" or, after a level, "Geschafft!" with "Weiter mit:" and the next level's name; the end says "Ende", that the game was won, and the points if the HUD counts them. Names are text, never HTML.

### What the player sees: the HUD

There is no status bar across the top of the game. The HUD (`src/static/hud.js`, drawn by `app.js` into the game's canvas like the speech bubbles) shows only what the game uses, in the game's own pixel font and with the game's own sprites: hearts top left (the picture of the sprite that gives lives, else a built-in heart) when the game starts with more than one life or something gives lives, an energy bar under them when *Energie anzeigen* is on and something can hurt, the picture of the sprite that gives points and the number top right when anything gives points, and the level's name for a moment when a level starts. Changes are animated: a lost heart flashes, shakes and empties, damage leaves a white piece on the bar that drains away, coins count up and their picture hops. Recipe recordings show no HUD.

### Movement and physics

Movement is trait-based rather than tied to a single kind of platform game.

The engine supports, among other things:

- normal platform movement
- slopes
- slippery surfaces
- ladders
- conveyors
- moving platforms and lifts
- swimming
- floating
- currents
- movement regions with different gravity and movement parameters

Player characters and supported enemy behaviours use the same underlying movement systems where practical.

### Moving platforms and lifts

Any sprite with the trait **bewegt sich (Plattform, Aufzug)** travels along a straight Weg and back. The drawing has the Geschwindigkeit and the Pause at the ends; each placed copy has its own Weg (*Weg nach rechts*, *Weg nach oben*, in pixels) and says when it moves (*Fährt*): *immer hin und her*, *wenn die Spielfigur draufsteht (Aufzug)* – it takes the player to the other end and comes back alone after the pause – or *bei Signal* (a receiver in the Signale: "an" to the end, "aus" back). The level editor draws every Weg as a dashed line with a dashed frame at its end; with the select tool, a handle in that frame drags the end to where the platform should go.

With *man kann nicht von oben reinfallen* the platform carries whoever stands on it: the player, enemies and companions; a rising platform also picks up a figure whose feet it passes. It never squashes anybody: a lift waits rather than push a rider's head into a ceiling, and a solid platform waits for somebody in its way. Only the player starts a lift. The logic is in `src/static/platforms.js` (a pure plan per platform and `MovingPlatforms.step`, which runs before the characters each simulation step and keeps the collision trees where the platform is drawn). Old games have no such trait and play exactly as before. The recipe *Bewegte Plattformen und Aufzüge* shows a platform over spikes, a lift, a bridge a Schalter slides out of a cliff and a slanting platform.

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

A sprite with the trait **Begleiter** is a character the game controls that tries to stay with the player character – a dog, a robot, a fairy, a friend. It is not an enemy: it deals no damage, is never attacked, has no health and does not count for "alle Gegner besiegt". Because the player cannot control it, it never acts on the level: it collects nothing and presses, opens or sends nothing. Several companions line up behind the player.

*Begleiter* says that it follows; its own movement settings say **how**: Geschwindigkeit, *kann springen* with its own Sprungkraft, *kann schwimmen* (into a Bewegungsbereich "Schwimmen"; otherwise it waits at the shore) and *kann fliegen* (through the air, over gaps and water). It never takes over the player's abilities, so a weak jumper genuinely stays below a ledge the player jumped onto. When it has really lost the player – far away, out of sight and getting no closer for a few seconds – the game helps a little later: it comes back from just outside the screen behind the player and walks or flies in. When the player loses a life, companions come along to where it starts again. A companion can also wait where it stands until a signal arrives (*kommt erst bei Signal mit*) – a friend Pip has to find first.

Walking, jumping, slopes, Bewegungsbereiche and animation are the same engine code as for the player and the enemies (`app.js` `Character`); `src/static/companion_ai.js` only decides which keys a companion presses and when it is lost. Companions have the usual optional states (Stehen, Laufen, Springen, Fallen, and Schwimmen und Schweben: schwimmt, schwebt, treibt, taucht ab, taucht auf) plus *Begleiter fliegt*, *sitzt* and *beschäftigt sich*; there is no Klettern, Angriff, Treffer or tot, because a companion climbs no ladders, does not fight and has no energy. While the player stands still, a companion keeps busy (`COMPANION_IDLE`): a walker strolls a few steps on its side of the player, sits down or sniffs around, a flyer flutters from spot to spot, lands, hops and pecks and flies up again – with the optional states *Begleiter sitzt* and *Begleiter beschäftigt sich*. A flyer hops around on the ground only if it has a drawn walking picture; without one (the owl) it sits where it landed. The recipe *Ein Begleiter kommt mit* shows the dog and, in its text, the robot, the bird and the kitten, one companion at a time; these and the owl are in its scene and in the Sprite-Katalog.

### Saved games and versions

Games are stored as JSON.

Saving a game creates a short tag derived from its contents. The game JSON itself is written to the generated game-data directory, while Neo4j stores metadata and relationships between versions.

All saved games are public to anyone who has their game code or link. There are no accounts, owners or per-game permissions: anyone can open a game in the Studio, change it and save another version. This does not require a global catalogue of every game; discovery can remain based on shared codes and links.

When a saved game is opened, its tag becomes the parent for the next normal save. Saving creates a new immutable child version, and that new tag then becomes the parent for the following save. Older versions remain untouched, so the development of a game forms a version tree.

**Neues Spiel** (Einstellungen → Spiel, and in the dialog of *Spiel laden*) starts over with an empty game – one empty sprite and one empty level, as the studio starts without a game – without reloading the page (`src/static/new_game.js`). With unsaved changes it says so and offers *Erst speichern*; the address no longer names the old game, so a reload does not bring it back. Not during a live session.

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
src/static/level_flow.js
src/static/level_map.js
src/static/hud.js
src/static/screens.js
```

Movement regions, how levels follow each other and the Levelübersicht, the HUD, and Signale: keys, collectibles, switches, pressure plates, Signalbereiche, defeated enemies and the level's start send a Code; doors, layers, signs and the level react (a roof that disappears while the player is inside, a bridge that appears, an ambush, a sign that speaks when the player walks past, a level that is done once every enemy is defeated). Speech bubbles for signs and characters.

```text
src/static/image_import.js
src/static/palette_apply.js
src/static/sprite_basket.js
src/static/sprite_actions.js
src/static/own_game.js
src/static/new_game.js
src/static/sprite_filter.js
src/static/default_names.js
```

Authoring helpers: importing pictures, converting to a palette, borrowing sprites from other games, the sprite editor's right-click menus, starting an own game from an existing one or a new one, searching and filtering sprite lists, and names for new things. `AGENTS.md` has the complete code map.

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