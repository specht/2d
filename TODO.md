# 2D Game Studio — TODO

Only what is not implemented yet, and open design questions. What exists is described in `README.md` (and its contracts in `AGENTS.md`); remove an entry here when it is done.

The Game Studio should remain a complete browser-based environment for creating games: external tools may improve individual workflows, but the Studio itself should always be sufficient for building and editing a game.

The central question for new work:

> Does this make it easier to build games, or does it merely make the engine capable of one more thing?

Prefer the former.

---

# Current Priorities

The **Erste Schritte** guides are there (see below). The next phase concentrates on **authoring rather than engine breadth**:

1. Turn the level editor into a comfortable scene editor.
2. Make editing existing level content as easy as placing new content.
3. Improve layers and large-level navigation.
4. Shorten the playtest loop.
5. Make game lineage understandable.
6. Polish sprite-animation workflows.
7. Extend the Signale further.
8. Build new gameplay systems on those foundations.

---

# Level Editor

## Editing existing content

- several selected sprites show no settings: show the ones they share ("verschieden" where they differ) and write to all of them – careful with Codes
- align or arrange several selected sprites
- zoom with keys, "Zur Auswahl"; Strg+click to take one sprite out of a selection

Avoid requiring children to delete and recreate things simply because they changed their mind.

## Layers

- clearer layer management (grouping, naming conventions, what a layer is *for*) – without turning into a professional graphics-editor UI

## Larger levels

- finding existing objects (e.g. "where is the key for this door?" beyond the Signale-Übersicht)
- whether the Übersichtskarte should show more than the picture (the player, signals, the current layer)
- selecting objects in dense areas (a repeated double-click reaches what lies behind; more may be needed)
- working comfortably at different zoom levels

## Repeated structures

If children repeatedly build the same arrangements by hand (houses, rooms, enemy groups, puzzle elements), consider a lightweight reusable group or prefab. Not before there is a real need.

## Level objects and properties

As more systems are added, keep it easy to see what an object is, which traits it has, which settings belong to the drawing and which to this placed copy – discoverable, not a long list of unrelated fields.

---

# Levels and How They Connect

- telling the player what is still missing (an exit that does not open yet says nothing)
- a recipe for doors to different levels, a hub and a shop: the recipe build records one level per scene
- teleporting doors within one level
- points as a condition ("geschafft bei 100 Punkten")
- combinations of conditions – a Zähler does "und" (several senders on one Code) and "so viele"; "oder" is open (see Signale)

---

# Inventory and Currency

Points are the game's currency now: the HUD shows them as a counter with the sprite that gives them. Still open, in this order:

1. **Shop:** a sprite that can be bought with F for a price in points ("kostet"), with the pickup's effects and a Code it sends; a speech bubble when there are too few points.
2. **Items:** a collected sprite that stays for the whole game ("kommt ins Inventar"), shown in the HUD, and a Signale sender "wenn du … hast" (at level start and when it is collected), so doors, Zähler and the end of the game can depend on items across levels. Keys "für das ganze Spiel" are the most common case.
3. Whether "gibt Punkte" should be called something else once points are mainly coins.

Not planned: items that are selected and used (equipping, ammunition). Ammunition waits for the item model above.

---

# Signale

Each must stay an understandable choice in the editor, not scripting. Roughly in order of usefulness:

- more senders: enemies pressing a Druckplatte (opt-in per Druckplatte, or old levels change); a timer that shows how much time is left (today a "sendet beim Start" timer is invisible to the player – the HUD could show it)
- more receivers: spawn / remove a single sprite, a trap that switches on and off, enable / disable an object
- "oder" between different Codes, and a Zähler that counts down or resets
- names: a name whose Code nothing uses any more is invisible (no card) and keeps its number taken – offer a way to see or remove such names if children run into it
- signals across levels only with an explicit design (items, see Inventory), never implicitly: keys and Codes are per level

Recipe ideas possible with what exists:

- **Eine Falle mit Verzögerung** – a Druckplatte lets spikes appear a second later, so Pip can still run. Worth it once something can drop stones on a Signal.
- **Licht an** – a Schalter that switches a dark colour layer (abdunkeln) off and a Lichtschein on.

---

# Playtesting

- from classroom use: whether the survey's categories and the default of 3 minutes fit, and whether children should see their feedback in the studio, not only on paper
- starting a test run with chosen items or state (keys, switches)
- a quick way to test while somebody else edits in a live session (today the test uses the local copy)

---

# Live Collaboration

From classroom use: whether the lock lease (3 minutes without a change) and the limits (200 sessions, 40 people per session) are right, and whether sessions should ever run on more than one Ruby process (they are kept in the memory of one).

Fine-grained simultaneous editing of the same frame or level region only if real use shows the need – a separate design problem, not a CRDT. States, frames, layers and placed objects would then need IDs too.

---

# Sprites and Pictures

- Sprite editor: Wer zeigt was? could offer to create a missing state (e.g. "laufen links" as a mirrored copy of "laufen rechts"); a frame that is held longer than the others (needs the engine); the spray can sprays over an area of one colour rather than around the mouse (an airbrush mode?); + adds an empty frame (a copy of the current one may be what animators want); onion skin of another state. *Sprite verschieben* has no key since X became Farbe ↔ durchsichtig – give it one if children miss it (the tool grid follows the keyboard rows, so it would mean moving a button). Rectangles of erasing in the level editor (Strg + ziehen while Radieren is on) are not there yet.
- Sprites holen: remembering recently opened source games; a small list of recommended source games for a class; a second player character, more enemies and a few more backgrounds for the catalogue.
- Picture import: a hand-drawn grid in the dialog when the guess is wrong in a way the numbers cannot fix (frames of different widths); remembering the last choice of "Einfügen" per sprite.

---

# Gameplay Mechanics

Add mechanics when they enable clearly useful kinds of games; avoid isolated novelty features when the same effort would improve authoring for every game.

- doors: trapdoors as a mechanic of their own (a layer that disappears under the player already works through Signale)
- falling blocks: configurable respawn, restart behaviour, avoiding repeated damage from the same event
- moving platforms: a Weg with more than one stretch, or a circle; moving decoration in layers without collisions; a lift that can be called from the other end
- trampoline / bounce surfaces, generic sprite spawning, shields, timers and time limits
- movement: directional gravity, gliding / fluttering as an explicit ability, more general force fields if concrete games need them – do not generalise physics for completeness

## Combat

Any new attack family must work for player characters and enemies through the same combat path from its first playable version; publish a recipe only once it works and the recipe build verifies it.

- laser / ray attacks: actor and enemy versions, blocked by walls and closed doors, nearest valid target, a visual beam, existing damage handling. An instant ray first; a continuous beam is a later mechanic with its own re-hit and interruption rules.
- area attacks: stomp, horizontal pulse, other short-range area attacks
- an optional cooldown display (in the HUD)

## Companions and characters

- a companion that stops following again (today "kommt erst bei Signal mit" is one-way)
- companions that climb ladders (today a walker waits below a ladder and finds the player again)
- a conversation between two speakers (today one speaker says one sentence after the other)
- collect-and-return, defeat-enemy and location-based tasks – only when simple concrete games ask for them, never an elaborate quest framework first

---

# Game-Level Features

- HUD: a visible timer, a cooldown display, items once there is an inventory, choosing which corner shows what
- high scores, persistent progression (decide first whether data belongs to the run, the browser, the game or the server)
- actor health configuration closer to the actor definition

---

# Erste Schritte: more guides

The twelve guides exist (see README, *Erste Schritte*; `rezepte/README.md` for writing them). Open:

- Signale beyond Schalter and Tor (Signalbereich, Druckplatte, a layer that appears) could get a guide of its own; the recipes in *Signale* cover them as finished scenes.
- Zusammenarbeiten cannot be recorded with one browser yet (it needs a second studio and the server); a guide would need a second page in the recorder.
- The sprite pictures in the drawing guide are drawn by the steps themselves; a guide that needs a real figure starts from a `szene`. If a guide should show drawing a whole figure, keep it short – every frame is a screenshot.

**Also for newcomers, smaller:** fold the rarely needed fields of a trait (Spielfigur: Kollisionsbox, Kraft in X-Richtung, Trefferreaktion …) under "Mehr Einstellungen …", so a new trait first shows the two or three that matter (Geschwindigkeit, Sprungkraft). Decide per trait which fields are shown; the data does not change.

---

# Recipe Scenes in the Studio

- give a scene room outside the recorded frame (an extra map only the studio scene contains), so children have more space to explore and sprites to borrow
- a short "look here" hint per recipe (which layer, which sprite, which setting matters)

---

# Screens and Devices

The studio is made for 1920 × 1080 and works down to about 1366 × 768; tablets in landscape (from about 1024 × 768) work with fingers only (README: On a tablet). Portrait and phones are not usable – only the Hilfe tab and playing are. Open for touch: Strg + drag shapes and the arrow-key nudge in the level editor, the frames' multi-select (Shift / Strg + click), a way to see hover texts, the level editor's Signale-Übersicht cards (their lines show on hover), and dragging list items without the handle. In the Levelübersicht, a door in front of an exit is not shown (only placement links them; a heuristic by position could).

# Large or Experimental

Outside the core roadmap unless a concrete project requires them: multiplayer, and a full inventory with items that are selected and used. They can easily dominate the architecture while benefiting few games.
