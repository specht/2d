# 2D Game Studio — TODO

The Game Studio should remain a complete browser-based environment for creating games.

External tools may improve individual workflows, but the Studio itself should always be sufficient for building and editing a game.

The main current weakness is not the game engine or sprite editor, but the **level-authoring workflow**.

---

# Level Editor

## Make editing a level feel like editing a scene

The level editor should move beyond placing individual sprites and become a proper visual scene editor.

Important areas:

- selecting one or many objects
- moving selections naturally
- duplicating and copying selections
- moving objects between layers
- deleting and replacing groups of objects
- keyboard nudging
- predictable drag behaviour
- rectangular fill and other bulk-placement operations

Undo and redo exist (Strg+Z / Strg+Y, per level, `level_history.js`); levels themselves (adding, deleting, reordering) and sprites in the sprite editor's lists are not part of it yet.

The goal is that constructing and restructuring a level should remain comfortable even after the level has become fairly large.

---

## Better manipulation of existing content

Placing sprites already works reasonably well.

Editing something that already exists should become equally convenient.

Typical operations should include:

- move
- duplicate
- copy / paste
- replace
- move to another layer
- align or arrange where useful

Avoid requiring users to delete and recreate things simply because they changed their mind.

---

## Layers

Layers should become easier to work with as levels become more complex.

Possible improvements:

- clearer layer management
- reorder layers
- show / hide layers
- lock layers against accidental editing
- move selections between layers
- make the active layer obvious
- make it easy to understand which layer a selected object belongs to

Layer management should remain simple enough for students and should not turn into a professional graphics-editor UI.

---

## Larger levels

Editing should continue to feel good when a level extends beyond one screen.

Areas to improve:

- navigation
- zooming and panning
- finding existing objects
- maintaining spatial orientation
- selecting objects in dense areas
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

**Milestone 1 exists (Signale, `src/static/signals.js`):** senders send their Code with *an* or *aus*: a collected key (an), a Schalter (F, on the rising edge), a Druckplatte (an on stepping on, aus on leaving, player only). Receivers react in their own way: a door (`door_reaction`: aufschließen = the old key behaviour and the default, öffnen, schließen, offen solange an, wechseln) and a layer (`signal_code` / `signal_reaction`: erscheint, verschwindet, da/weg solange an, wechselt; a layer that is away has no collisions either). One bus per level, state lives in the receivers, a depth limit stops loops. The level editor shows under every Code what else in the level has it. Recipes *Ein Schalter öffnet das Tor* and *Eine Druckplatte baut eine Brücke* check it end to end.

Next steps, roughly in order of usefulness (each must stay an understandable choice in the editor, not scripting):

- more senders: enemy defeated, all enemies defeated, sprite collected (any pickup with a Code), actor enters / leaves an area (a rectangle layer like the Bewegungsbereiche), level starts; enemies pressing a Druckplatte
- more receivers: show text, spawn / remove a sprite, a trap that switches on and off, a moving platform that starts, complete the level, set a simple game flag
- delays (send *an* 2 s later; a door that closes again by itself) – one optional field on the sender, not a timeline
- signals across levels only with an explicit design (flags), never implicitly: keys and Codes are per level
- an overview of all Codes of a level (who sends, who reacts), and highlighting partners in the level editor

Possible triggers still open:

- level starts
- actor enters an area
- actor leaves an area
- enemy defeated
- all enemies defeated

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

The editing/testing loop should be very short.

Improve support for:

- testing the level currently being edited
- restarting quickly
- returning to the same place in the editor afterwards
- testing without having to restructure the game first

Eventually it may also be useful to start playtesting near the part of the level currently being edited.

---

# Game History and Independent Forks

The no-account model is intentional.

Games are public to anyone who has their code or link, and anybody may open, edit and save them. Do not add user ownership, private games or a permissions system merely to support branching. A global browser containing every saved game is not required.

Normal saving should continue the current version lineage. Opening a game makes that version the parent of the next save; later saves form a version tree without modifying older versions.

Add an explicit way to start an **independent game from the current state**. In the student-facing UI, prefer an understandable German label such as **Als eigenes Spiel weiterführen** over Git terminology.

The operation should:

- work for any loaded game
- leave the source game and its complete history untouched
- save the current state as a new root with no version-parent relationship to the source
- make the new root the parent for subsequent normal saves
- give the independent game its own code even if nothing has been edited yet
- allow two people to fork the same version into genuinely independent lineages
- require no accounts, ownership or copy permissions
- remain discoverable by code/link rather than requiring a global game catalogue

There is an important storage constraint: game tags are currently derived from the saved JSON. Merely setting `parent` to `null` cannot guarantee a distinct identity for an unchanged root game or for repeated identical forks. Design a small explicit lineage identity for independent forks, for example an optional non-gameplay lineage/root identifier. Games without that field must retain their existing tags, graph relationships and behaviour.

The version graph and an independent fork are different concepts. Do not delete or rewrite existing graph edges when forking, and do not use the version `PARENT` relationship for optional attribution back to the source. If provenance is ever wanted, model it separately from version ancestry.

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

Independent forks and live collaboration remain orthogonal. **Als eigenes Spiel weiterführen** starts a new lineage; **Gemeinsam bearbeiten** lets several named participants edit one working copy within whichever lineage they started from.

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

- easier frame duplication
- easier frame reordering
- copying frames between animation states
- onion skinning
- better animation preview
- convenient FPS adjustment

---

# Image and Animation Import

Improve generic image import rather than building around one external application.

Support:

- clipboard paste
- drag and drop
- individual PNG frames
- horizontal animation strips
- vertical animation strips

For animation strips:

- estimate frame count and dimensions
- show the estimate before importing
- allow the user to correct it
- preserve transparency
- never silently scale or crop pixel art

PNG should remain the main interchange format.

This naturally allows working with Aseprite, LibreSprite, Krita, Pixelorama and other tools without making any one of them part of the expected workflow.

Exporting animation states as PNG strips would make this workflow bidirectional.

---

# Existing Systems to Finish

## Doors and switches

Basic doors, locks, keys and automatic behaviour already exist.

Remaining useful extensions include:

- delayed automatic closing
- sensible behaviour when something occupies a closing door
- trapdoors (a layer that disappears under the player already works through Signale)
- paired or teleporting doors

Remote switches and remotely controlled passages exist (Signale). Build the rest on them where possible.

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
- speech bubbles / dialogue
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

# Current Priorities

The next phase should concentrate heavily on **authoring rather than engine breadth**.

In particular:

1. Turn the level editor into a comfortable scene editor.
2. Make editing existing level content as easy as placing new content.
3. Add strong selection manipulation (level undo/redo exists).
4. Improve layers and large-level navigation.
5. Shorten the playtest loop.
6. Make game lineage understandable and add an explicit independent-fork action.
7. Make deliberate, named multi-browser collaboration practical without introducing accounts.
8. Polish sprite-animation workflows.
9. Extend the Signale (generic triggers/actions; milestone 1 exists).
10. Build new gameplay systems on those foundations.

The central question for new work should be:

> Does this make it easier to build games, or does it merely make the engine capable of one more thing?

Prefer the former.