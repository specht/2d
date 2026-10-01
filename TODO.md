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
- undo and redo

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

Possible triggers:

- level starts
- actor enters an area
- actor leaves an area
- action key pressed
- sprite collected
- switch activated
- enemy defeated
- all enemies defeated

Possible actions:

- show / hide object
- enable / disable object
- open / close door
- spawn object
- remove object
- display text
- change layer visibility
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
- remote switches
- remotely controlled passages or trapdoors
- paired or teleporting doors

Prefer implementing these through the trigger/action system where possible.

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
3. Add undo/redo and strong selection manipulation.
4. Improve layers and large-level navigation.
5. Shorten the playtest loop.
6. Make game lineage understandable and add an explicit independent-fork action.
7. Polish sprite-animation workflows.
8. Add generic triggers/actions.
9. Build new gameplay systems on those foundations.

The central question for new work should be:

> Does this make it easier to build games, or does it merely make the engine capable of one more thing?

Prefer the former.