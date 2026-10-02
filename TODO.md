# 2D Game Studio — TODO

The Game Studio should remain a complete browser-based environment for creating games.

External tools may improve individual workflows, but the Studio itself should always be sufficient for building and editing a game.

The main current weakness is not the game engine or sprite editor, but the **level-authoring workflow**.

---

# Level Editor

## Make editing a level feel like editing a scene

The level editor should move beyond placing individual sprites and become a proper visual scene editor.

Implemented (`level_selection.js`, select tool): selecting many (rectangle, Shift adds), dragging the selection in grid steps (Shift: pixel by pixel), arrow-key nudging, Strg+C/X/V/D (paste at the mouse, also into another layer or level), deleting, moving the selection to another layer ("In Ebene"), and Strg + drag with the pen to fill a rectangle, selecting every copy of the selected sprites ("Alle gleichen") and replacing the selection with another sprite ("Ersetzen durch").

Still open:

- predictable drag behaviour across parallax layers
- other bulk-placement operations (lines, outlines of a rectangle)

Undo and redo exist (Strg+Z / Strg+Y, per level, `level_history.js`); levels themselves (adding, deleting, reordering) and sprites in the sprite editor's lists are not part of it yet.

The goal is that constructing and restructuring a level should remain comfortable even after the level has become fairly large.

---

## Better manipulation of existing content

Placing sprites already works reasonably well.

Editing something that already exists should become equally convenient.

Typical operations should include (move, duplicate, copy / paste, move to another layer and replace exist):

- align or arrange where useful

Avoid requiring users to delete and recreate things simply because they changed their mind.

---

## Layers

Layers should become easier to work with as levels become more complex.

Possible improvements:

- clearer layer management (grouping, naming conventions, what a layer is *for*)

Reordering (drag in the layer list), moving a selection to another layer ("In Ebene"), show / hide (eye) and lock (padlock: nothing can be painted, moved or deleted in the layer, its settings still change) exist in the layer list. The current layer is named in a corner of the level view, and a double-click with the select tool picks a sprite in any layer and switches to it (again: the one behind).

Layer management should remain simple enough for students and should not turn into a professional graphics-editor UI.

---

## Larger levels

Editing should continue to feel good when a level extends beyond one screen.

Areas to improve:

- navigation
- zooming and panning
- finding existing objects
- maintaining spatial orientation
- selecting objects in dense areas (a repeated double-click reaches what lies behind; more may be needed)
- working comfortably at different zoom levels

Consider whether an overview/minimap or similar orientation aid becomes useful once genuinely large levels are common.

---

## Repeated structures

Watch for recurring patterns such as:

- platforms
- houses
- rooms
- enemy arrangements
- decorative groups
- puzzle elements

If users repeatedly construct the same arrangements manually, consider introducing a lightweight reusable-group or prefab concept.

Do not introduce this before there is a real need.

---

# Level Objects and Properties

The editor increasingly has objects with behaviour rather than just decorative sprites.

The UI should make it easy to understand:

- what an object is
- which traits it has
- which settings belong to those traits
- which settings belong to this particular placed instance

Avoid exposing engine-internal distinctions unnecessarily.

As more systems are added, object configuration should remain discoverable rather than becoming a long collection of unrelated fields.

---

# Triggers and Actions

Many requested mechanics are variations of:

> When something happens, do something else.

Examples include:

- open a door
- make a block appear
- spawn something
- display text
- activate a trap
- complete part of a mission
- change a level

Develop a small, understandable trigger/action system rather than implementing each of these as a separate special case.

**Signale exist (`src/static/signals.js`, see AGENTS.md):** senders send their Code with *an* or *aus*: a collected key, a Schalter, a Druckplatte (player only), a Bereich (the player enters / leaves rectangles), a defeated enemy and "alle Gegner besiegt". Every sender can send later (Verzögerung). Receivers: doors (`door_reaction`; a door can also close again by itself after some seconds) and sprite or backdrop layers that appear or disappear (with Überblendung; a layer that is away has no collisions, and its enemies wait). Sichtbarkeitsbereiche and door codes of older games are promoted to this on load. The level editor shows under every Code what else in the level has it.

## Next: names for signals (the Signale-Übersicht exists)

Wanted next. With five or six signals in a level, "Code 4" says little; a name ("Brücke") makes the overview, the lines and the Code fields readable.

**Done: the Signale-Übersicht** (S in the level editor; `signal_rules` in `signals.js`, `refresh_signal_overview` in `level_editor.js`): a panel at the right edge of the level view with one "Wenn … dann …" card per Code, warnings for Codes that nothing reacts to or nothing sends; hovering a card shows only its Code's lines, clicking a line selects the object in its layer, clicking the Code shows everything with it. The level pane's side columns are wider on wide screens, so the panel and the Eigenschaften both have room.

Still open for the overview:

- during "Level testen" a card lights up when its signal arrives, so children watch the rules happen while they play (needs a small message from the game frame to the studio)
- "+ Neue Regel" in the panel that starts the Verbinden tool

**Names for signals instead of bare numbers.** The Code stays a number in the saved game and in the engine (`free_signal_code`, the Verbinden tool, recipe checks, `fix_game_data` all keep working); a level may give its Codes names: optional `level.properties.signal_names`, e.g. `{ "4": "Brücke" }` (absent = numbers only, exactly as today; editor-only, never read by the game; renaming changes one place). Not strings as Codes: "Brücke" and "brücke " would be two different signals, an invisible and frustrating mistake.

**Done:** the data (`signal_name`/`set_signal_name` in `signals.js`; two Codes never share a name; a named Code stays taken for `free_signal_code`), names on the overview cards and in the line under every Code, and renaming in the overview (the name on a card, or the pencil next to its Code; Enter or leaving the field saves, Esc cancels, Strg+Z undoes). Every Code field (keys, doors, Schalter, Druckplatten, enemies and their Beute, layers, Bereiche, "alle Gegner besiegt") keeps its number field – the recipes still say "trag als Code 4 ein" – and has a button with the Code's name next to it: the level's Codes ("Brücke · 4"), "Neues Signal …" (a free Code, then its name) and "Namen geben …" / "umbenennen …". When the Verbinden tool makes a new Code, a field over the level asks for its name, prefilled "Schalter → Gittertor" (Enter keeps it, Esc leaves the Code without a name).

Still open for names:

- copying, pasting or duplicating between levels: a Code that arrives with a name the target level does not have takes the name along; a clash of the same number with a different name gets a free number (decide and test before implementing)
- the Signale recipes then use names ("Brücke") instead of "Code 4"
- a name whose Code nothing uses any more is invisible (no card) and keeps its number taken; offer a way to see or remove such names if children run into it

Order: names with the dropdown → cards lighting up in test runs.

## Further Signale extensions

Roughly in order of usefulness (each must stay an understandable choice in the editor, not scripting):

- "und" and counters: a receiver that waits for two Codes, or a Code that has to arrive three times ("drei Schalter umlegen")
- more receivers: "Level geschafft" (could answer the open level-completion question: "alle Gegner besiegt → Level geschafft"), a sign or figure that speaks on a Signal or when the figure walks past (speech.js is ready), a moving platform or lift that starts, spawn / remove a single sprite, a trap that switches on and off, set a simple game flag
- more senders: sprite collected (any pickup with a Code), level starts; enemies pressing a Druckplatte
- show a sender's Verzögerung on its connection line in the level editor, if children lose track of which signals are delayed
- signals across levels only with an explicit design (flags), never implicitly: keys and Codes are per level

Possible actions still open:

- enable / disable object
- spawn object
- remove object
- display text
- activate another object
- change level
- set a simple game flag

The editor should present these as understandable choices rather than as scripting.

---

# Playtesting

"Level testen" exists (▶ in the level editor's tools, key T): the Spielen pane runs the level being edited straight away, without the start screen; with the mouse over the level, the figure starts on the grid cell under it (lifted onto the floor if that cell is solid). R restarts the level, Esc goes back to the level editor exactly as it was. Nothing is saved or changed by a test run.

Still open:

- remembering game state between test runs (keys, switches) or starting with chosen items
- a quick way to test while somebody else edits in a live session (today the test uses the local copy)

---

# Live Collaboration

Facilitate working on one game from two or more browsers without introducing accounts.

**Current state:** the first milestone below is implemented and enabled in production (see README). Still open: deciding from classroom use whether the lock lease (3 minutes without a change) and the limits (200 sessions, 40 people per session) are right, and whether sessions should ever run on more than one Ruby process (they are kept in the memory of one).

Collaboration is an explicit temporary session, not a property of every public game. The ordinary game code remains enough to open, edit and save an independent descendant as it is today, but it must not allow somebody to enter an active shared editing session. Starting **Gemeinsam bearbeiten** should create a separate hard-to-guess collaboration link or code that can be shared deliberately.

## Joining and names

Everybody who starts or joins a collaboration session enters a name before entering the shared editor.

The name is a session-local display name, not an account, login or ownership identity. It should:

- be shown in the participant list
- be shown when somebody holds an editing lock, for example **„Mia bearbeitet gerade diese Ebene“**
- travel with that participant's live presence and editing operations
- disappear with the session rather than becoming permanent game metadata

Do not require names to be globally unique. Two children may legitimately have the same first name; the session UI can disambiguate duplicates with a small suffix, icon or colour while still displaying the name they entered.

## Session model

A session starts from a particular saved game version and holds one server-authoritative working state.

The server should:

- assign the session a secret capability link/code
- maintain a monotonically increasing revision
- receive editing operations from connected browsers in a defined order
- apply accepted operations to the shared state
- broadcast them to the other participants together with the participant identity needed for presence/UI
- let a reconnecting browser obtain the current state and revision
- keep collaboration state temporary rather than turning it into another saved-game format

Presence should show the names of the currently connected participants. Accounts, permanent identities and permanent membership are not required.

## Conflict model

Do not start with a general CRDT or Google-Docs-style merge system.

The Studio already has useful natural editing boundaries. The first implementation should allow people to work simultaneously on different resources while using short-lived leases/locks for conflicting work.

Useful lock scopes may include:

- a sprite or animation state/frame
- a level or layer
- a game-settings section

A browser should clearly show who is currently editing a conflicting resource. Locks must expire or be released when a browser disconnects so a crashed tab cannot block the project indefinitely.

If classroom use later shows a real need for two people to draw on the same frame or manipulate the same level region simultaneously, make that a separate later design problem rather than complicating the first implementation.

## Stable identities during a session

Concurrent editing cannot safely address changing arrays only by numeric index.

For example, one browser may be editing sprite 7 while another deletes sprite 3. The first browser's next operation must still refer to the original sprite, not whichever sprite has moved into array position 7.

Sprites and levels have durable IDs and references to sprites are stored as IDs (`src/static/game_ids.js`), so collaboration operations address them by ID. States, frames, layers and placed level objects are still addressed by index; that is safe as long as they are only edited by whoever holds the lock of their sprite or level. Give them IDs only if finer-grained locking is ever needed.

## Saving and lineage

A collaboration session should not create a permanent game version for every edit.

A normal shared save should:

- serialize saving so two browsers cannot create conflicting session bases
- write one ordinary immutable game version through the existing save path
- keep the existing parent/version relationship
- broadcast the resulting game tag to all connected browsers
- use that saved version as the parent of the next shared save

Independent forks and live collaboration remain orthogonal. **Als eigenes Spiel weiterführen** (implemented, see README) starts a new lineage; **Gemeinsam bearbeiten** lets several named participants edit one working copy within whichever lineage they started from.

## First useful milestone

Keep the first version deliberately small:

1. Start or join a collaboration session using a separate secret link/code.
2. Require a display name on entry and show named participant presence.
3. Maintain server-authoritative state with revision numbers.
4. Synchronize structured Studio editing operations.
5. Prevent conflicting edits with fine-grained temporary locks that identify who is editing.
6. Save through the existing game/version mechanism.
7. Reconnect safely after a temporary disconnect.

Do not require accounts, chat, permissions administration, persistent participant identities, collaborative cursors or a CRDT for this milestone.

---

# Sprite and Animation Editor

The sprite editor is already comparatively mature.

Focus on workflow improvements rather than redesigning it.

Useful additions include:

- better animation preview
- convenient FPS adjustment
- selecting several frames at once (for copying or moving a part of an animation)
- an undo for structural changes (states and frames added, moved or deleted)

Done: right-click menus to duplicate sprites, states and frames, copy/cut/paste frames (also between sprites of the same size), move a frame to another state, swap two states' animations, copy a state into another sprite; Zwiebelhaut (O).

---

# Sprites from Other Games

"Sprites aus einem anderen Spiel holen" exists (sprite list: the basket tile next to +): a game code or a recipe scene, a basket across several games, and one import with states, animations, traits and everything a sprite refers to. A global sprite catalogue was tried before and is intentionally not the plan: there are too many similar versions; children pick a known good game instead. Ideas: remembering recently opened source games; a small list of recommended source games for a class.

---

# Image and Animation Import

Implemented (`image_import.js`): clipboard paste and dropping an image file in the sprite editor go through an analysis (fake background, pixel size, frames of a strip or grid) and a dialog that shows the guess before importing, lets the child correct it and warns when the frames do not match the sprite's size; transparency is kept and nothing is silently scaled or cropped. Several files at once (or Funktionen → Sprite → Bilder öffnen …) become one animation, sorted by the number in their names.

Still open:

- a hand-drawn grid in the dialog when the guess is wrong in a way the numbers cannot fix (frames of different widths)
- remembering the last choice of "Einfügen" per sprite

---

# Existing Systems to Finish

## Doors and switches

Basic doors, locks, keys and automatic behaviour already exist.

Remaining useful extensions include:

- sensible behaviour when something occupies a closing door: "schließt wieder nach" waits until the door is free, but a door closed by a signal or the action key still closes onto whoever stands in it
- trapdoors (a layer that disappears under the player already works through Signale)
- paired or teleporting doors

Remote switches, remotely controlled passages and doors that close again by themselves exist (Signale). Build the rest on them where possible.

---

## Falling blocks

The basic falling/crumbling behaviour exists.

Possible extensions:

- configurable respawn
- restart behaviour
- avoiding repeated damage from the same event where appropriate

---

## Level completion

The basic level exit works.

Additional completion conditions may include:

- points
- required items
- defeated enemies
- combinations of conditions

Before expanding this, define:

- how multiple conditions combine
- how unmet conditions are communicated to the player
- how old games remain compatible

---

# Additional Gameplay Mechanics

Add mechanics when they enable clearly useful kinds of games.

Promising additions include:

- moving platforms
- lifts
- trampoline / bounce surfaces
- timers and time limits
- generic sprite spawning
- shields

Avoid growing the engine through isolated novelty features when the same effort would improve authoring for every game.

---

# Combat

The combat foundation is already broad enough for many games.

Existing capabilities include melee, projectiles, bombs, enemy health, hit reactions, death states and enemy drops.

Any new attack family should work for both player characters and enemies through the same combat path from its first playable version. Keep delivery, damage/timing and presentation separate so optional artwork never becomes game logic.

Publish a combat recipe only after the corresponding feature works in the current editor/runtime and can be verified by the recipe build.

Potential extensions:

## Laser / ray attacks

- actor and enemy versions
- obstruction by walls and closed doors
- nearest valid target
- visual beam
- reuse existing damage handling

Implement an instant ray first. Treat a continuous beam as a separate later mechanic with explicit re-hit timing and interruption rules.

## Area attacks

- stomp
- horizontal pulse
- other short-range area attacks

## Feedback

- optional cooldown display

Ammunition should wait until there is a clearer inventory model.

---

# NPCs and Adventure Mechanics

Once triggers/actions exist, build higher-level systems on top of them.

Possible progression:

- NPC interaction
- speech bubbles / dialogue (monologue exists: a sign or the figure says one sentence or `|`-part after the other, speech.js; a conversation between two speakers is still open)
- multi-line conversations
- collect-and-return tasks
- defeat-enemy tasks
- location-based tasks
- simple shops and upgrades

Avoid creating an elaborate quest framework before simple concrete games require one.

---

# Movement and Physics

Existing movement support is already broad:

- slopes
- slippery surfaces
- ladders
- conveyors
- swimming
- floating
- currents
- movement regions
- configurable gravity
- enemy support

Possible future work:

- directional gravity
- gliding / fluttering as an explicit ability
- more general force fields if concrete games need them

Do not generalise the physics system merely for completeness.

---

# Game-Level Features

Possible future systems:

- high scores
- persistent progression
- actor health configuration closer to the actor definition

Persistence should only be added after deciding whether data belongs to:

- the current run
- the browser
- the game
- the server

---

# Large or Experimental Features

Keep these outside the core roadmap unless a concrete project requires them:

- companions
- multiplayer
- full inventory system

They can easily dominate the architecture while benefiting relatively few games.

---

# Recipe Ideas: Signale

The Signale recipes have their own category, in this order: Schalter → Tor, Druckplatte → Brücke, Rote und grüne Blöcke (one Schalter, two layers "da, solange an" / "weg, solange an"), Tor mit Zeit, Wächter-Tor, Die Falle schnappt zu (Bereich closes the gate behind, "alle Gegner besiegt" opens the exit). The smaller ideas live as tips in them instead of recipes of their own: Verzögerung (Tor mit Zeit, Falle), "wechseln" (Schalter, Blöcke), a key or Schalter building a bridge (Druckplatte), a second wave of enemies (Falle), a secret passage with a Bereich (Falle → Höhle), an enemy leaving a key behind (Angsthase). Ideas for more, possible with what exists today:

- **Eine Falle mit Verzögerung** – a Druckplatte lets spikes appear a second later, so Pip can still run. Left out for now: it is the Druckplatte recipe with one more number (Verzögerung is a tip in Tor mit Zeit and Falle). Worth it once something can drop stones on a Signal.
- **Licht an** – a Schalter that switches a dark colour layer (abdunkeln) off and a Lichtschein on: a room that becomes light. Could also fit "Level gestalten".

Would need new features: two senders that must both be active (AND), a counter ("drei Schalter umlegen"), a text that is spoken on a Signal.

---

# Recipe Scenes in the Studio

Every recipe's scene can be opened in the studio (Hilfe → Selbst ausprobieren → Szene öffnen); saving it makes an own game. Ideas for later:

- give a scene room outside the recorded frame (an optional extra map in the recipe that only the studio scene contains), so children have more space to explore and sprites to borrow for their own games
- a short "look here" hint per recipe (which layer, which sprite, which setting matters)

---

# Current Priorities

The next phase should concentrate heavily on **authoring rather than engine breadth**.

In particular:

1. Turn the level editor into a comfortable scene editor.
2. Make editing existing level content as easy as placing new content.
3. Add strong selection manipulation (level undo/redo exists).
4. Improve layers and large-level navigation.
5. Shorten the playtest loop.
6. Make game lineage understandable (the independent-fork action exists: Als eigenes Spiel weiterführen).
7. Make deliberate, named multi-browser collaboration practical without introducing accounts.
8. Polish sprite-animation workflows.
9. Extend the Signale: next names for signals (the overview exists, see Triggers and Actions), then "und"/counters and new receivers.
10. Build new gameplay systems on those foundations.

The central question for new work should be:

> Does this make it easier to build games, or does it merely make the engine capable of one more thing?

Prefer the former.