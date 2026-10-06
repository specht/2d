# 2D Game Studio — TODO

Only what is open. Remove an entry when it is done. The test for anything new: does it make building games easier, or only the engine able to do one more thing? Prefer the former.

## Priorities

1. The level editor as a comfortable scene editor; changing things as easy as placing them.
2. Layers and large levels.
3. A shorter playtest loop.
4. Polish for sprite animation.
5. More Signale, then new gameplay on those foundations.

## Level editor

- Several selected sprites: show their shared settings ("verschieden" where they differ) and write to all – careful with Codes.
- Align or arrange a selection; zoom with keys, "Zur Auswahl"; Strg+click takes one sprite out of a selection.
- Clearer layer management (what a layer is for, grouping) without a pro graphics UI.
- Large levels: find objects ("where is the key for this door?"), more on the Übersichtskarte, picking in dense areas.
- Reusable groups (prefabs) only once children keep building the same things by hand.
- Erasing rectangles with the pen (Strg + drag while Radieren).

## Levels and how they connect

- Tell the player what is still missing (an exit that does not open yet says nothing).
- A recipe for a hub with doors to several levels (the recipe build records one level per scene).
- Teleporting doors within a level; points as a condition; "oder" between Codes.

## Inventory and currency

1. Shop: a sprite bought with F for points, sending a Code; a speech bubble when points are missing.
2. Items that stay for the whole game, shown in the HUD, with a sender "wenn du … hast" (keys "für das ganze Spiel").
3. Maybe rename "gibt Punkte" once points are mainly coins.

Not planned: equipping and using items, ammunition.

## Signale

- Senders: enemies on a Druckplatte (opt-in), a visible timer.
- Receivers: spawn or remove a sprite, traps that switch, enable/disable an object.
- A Zähler that counts down or resets; showing names whose Code nothing uses any more.
- Signals across levels only together with items, never implicitly.

## Sprites and pictures

- Wer zeigt was?: create a missing state (mirrored copy); frames held longer; an airbrush spray mode; onion skin of another state; a key for *Sprite verschieben* if missed.
- Sprites holen: recently opened games, a class list of source games, more catalogue sprites.
- Picture import: a hand-drawn grid for frames of different widths; remember the last choice.

## Gameplay

- Trapdoors; falling blocks that respawn; platforms with several stretches or circles, decoration that moves, lifts that can be called.
- Trampolines, spawning, shields, time limits; gliding; directional gravity only for concrete games.
- Combat (always for player and enemies through the same path, recipe once verified): an instant ray, area attacks (stomp, pulse), a cooldown display.
- Companions that stop following or climb ladders; conversations between two speakers; simple tasks only when games ask for them.
- HUD: timer, cooldown, items, choosing the corners; high scores and progression (decide where the data lives first).

## Help and recipes

- Guides: more on Signale (Signalbereich, Druckplatte); Zusammenarbeiten needs a second browser in the recorder.
- Fold rarely needed trait fields under "Mehr Einstellungen …".
- Recipe scenes: more room outside the recorded frame; a short "look here" hint per recipe.

## Classroom

- Playtesting: check the survey and the 3 minutes in class; show feedback in the studio; start a test with chosen items or states; testing during a live session.
- Collaboration: check lock lease and limits in class; several Ruby processes; fine-grained editing of one frame or region only if really needed (it would need IDs for states, frames, layers and placed objects).

## Screens and devices

Touch is missing for Strg + drag shapes, arrow-key nudging, multi-selecting frames, hover texts and the overview cards. Portrait and phones are out of scope (only Hilfe and playing work there).

## Large or experimental

Multiplayer and a full inventory – only for a concrete project; they would dominate the architecture.
