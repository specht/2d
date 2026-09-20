# 2D Game Studio — Combat contracts, implementation status and student recipes

**Source-verified status (2026-09-20, `master` @ `d716258a` → `combat` @ `f21468fd`, 10 commits):** Shared `CombatSystem` and player/baddie forward swing are implemented; the generic **Nahkampfangriff** editor trait now exposes damage, hit reach, cooldown and independent optional swoosh direction/length. Legacy `sword` JSON is read via an adapter, J and the opt-in touch button activate melee, and compact editor hints/CSS are present. M1h **Trefferstern/POW** is present in the branch (`visual.hit_kind` and impact renderer), and its visuals were user-tested; the separate `test/combat_hit_effect.test.cjs` is not tracked in the inspected branch. Optional character attack/hit states, pixel-grid visual polish, symmetric area attacks, cooldown HUD, inventory costs, ranged/projectiles/lasers and published recipes remain proposed. Reinspect the HEAD before treating this snapshot as current.

**Core requirement:** **every attack type uses the same combat machinery for the player (`actor`) and baddies (`baddie`) from the first release of that type.** Do not implement a player-only laser, enemy-only arrow, or separate enemy damage engine. A new attack shape or delivery method must be usable by either side, even if their input/AI presets differ.

## 1. Existing engine: preserve what works

`src/static/app.js` has `Character` for actors and baddies, a fixed-step simulation, `Game.player_character`, `Game.baddies`, and a dynamic enemy collision index. Baddie health is per character (`Character.energy`); the player currently uses `Game.energy`. Dead baddies become inactive and change to their `dead` state. `src/static/traits.js` defines sprite traits, property labels, defaults and hints; `src/static/game.js` renders property controls; `src/static/widgets.js` supplies compact `?` help dialogs. Existing player controls include WASD/arrows, Space, and F for interaction. There are touch controls.

Do not alter legacy contact damage (`baddie.damage`), traps, falling-block damage, movement, door interactions, stored game JSON, or old games' default controls. Combat is **opt-in**. An enemy with only a bow or sword should have **Berührungsschaden = 0** explicitly; the existing contact-damage setting is separate from weapon damage. Missing assets/invalid definitions must disable that attack safely, with a useful German editor message rather than a runtime crash. No large mandatory automated test suite: pair each small patch with focused manual checks.

## 2. Generic attack traits in the editor, shared attacks in the runtime

**Editor decision:** Expose separate, generic **Nahkampfangriff** and later **Fernkampfangriff** sprite traits that can be attached to either actor or baddie. A sword, claw, punch, bow, laser or torpedo is an editable example/preset, **not** a distinct trait or damage system. **Runtime decision:** Each trait configures one or more shared attack definitions with an owner, slot, delivery, hit geometry, effect, timing and optional visual. A character can have zero or more attacks; its controller (player or AI) decides when to request them. This distinction must also work for non-platformer characters such as submarines.

The current player melee slot uses J and the conditional Angriff touch control; the baddie AI calls the same attack machinery. K/Fernkampf and additional equip/trigger slots are future features. Do **not** constrain the runtime to exactly two attack types or two buttons. Keep cooldowns and hit history per character *instance* and per stable attack ID: two placed copies of one enemy sprite must not share attack state, projectiles, targets or health.

The **implemented Nahkampfangriff** trait configures one swing attack (name, damage, hit reach, cooldown, swoosh direction/length) for both roles. Its stored data is an optional attack definition; `sword` IDs remain valid legacy data. Do not create separate Faust/Schwert/Kralle/Unterwasser-Ramme implementations. The authoring UI may offer simple presets later, but only show advanced fields for working mechanics; the engine must not assume that melee always means a forward sword swing.

### Review: keep extension seams small and independent

- **Attack identity and activation:** A character can have zero or more named attacks with stable IDs, and the input/AI layer selects an attack. The existing player/AI trigger in `app.js` explicitly filters `slot === 'nah'` and `delivery.kind === 'swing'`; generalize selection when a second melee shape is actually implemented. `actor`/`baddie` currently encode ownership and opposing targets, **not** movement physics; keep this playable with future free-swimming vehicles rather than duplicating the combat system. Grounded-only, landing-triggered and item-required attacks are *future optional preconditions*, not new hardcoded character classes.
- **Delivery and geometry:** `register_delivery(kind, handler)` is already an extension point, but `swing` currently checks only a forward rectangle with a local obstacle helper. A **ground stomp** should use a short-lived `area`/`pulse` delivery with a horizontal band centered on the owner: configurable half-width to **both left and right**, small vertical tolerance near the ground, no self/friendly hits, and once-per-target hit history. Choose and test wall/closed-door blocking deliberately; do not make a circle's visual radius its hitbox. Player and baddie use the same handler. If implemented as a shockwave travelling outwards, that is a different delivery/timing policy, not a renamed instant stomp. `requires_ground` and `on_landing` may be offered separately later; an immediate symmetric attack does not require landing-event infrastructure.
- **Effects versus presentation:** Collision/accepted hits remain authoritative. An *attacker-owned* swing/attack visual may play on a miss; a *target-owned* Treffer state, red flash or flicker happens only on an accepted hit; an optional *attack-owned* POW/star appears at the impact position. The combat gateway should eventually emit an accepted-hit event shared by every delivery, instead of implementing each target reaction only inside `swing`. A lethal hit prioritizes `dead`. Reactions never alter hit counts, knock back, energy or cooldown unless a distinct gameplay effect explicitly says so. Missing frames/effect assets retain normal gameplay. In the committed M1h renderer, effect drawing currently extends the attack instance's lifetime; separate visual cleanup from damage/activation lifetime before relying on that pattern across projectiles and area attacks.
- **Pixel-art contract:** Render procedural swooshes, stars and comic text using logical game-pixel sizes, nearest-neighbour texture sampling, discrete frames/coordinates and bounded transient objects; avoid smooth 128px canvas scaling and shared-material tinting. Quantize effect positions relative to the game's pixel grid while preserving the established camera/physics behaviour. For red flashing, use per-*character-instance* render state/overlay, not a mutation of a shared sprite material; otherwise every placed enemy of the same type may turn red.
- **Cooldown feedback (future, opt-in):** The attack already stores `timing.cooldown_s`, and the runtime tracks the last accepted activation in an owner-local `WeakMap`. Expose a **read-only remaining-time/ready query** from that same source; do not add another countdown or persist a timer in JSON. The default HUD stays unchanged. A compact indicator can be enabled per equipped **player** attack (e.g. readiness overlay on its touch/action button; more than one attack must remain distinguishable). Keep enemy cooldowns available to AI/debugging, not as compulsory on-screen bars. A resource shortage is an unavailable status, separate from cooldown.
- **Consumable costs (future, opt-in):** Add a small reusable resource/item stock only when a real pickup-and-use example exists (e.g. collect 3 torpedoes, spend 1 per shot). Define stable item IDs, quantities, explicit pickup grants, optional attack prerequisites/costs, and whether stocks reset on death or level change. Keep existing keys, score and pickups unchanged unless the creator explicitly opts into a new item resource. Preflight owner, attack validity, cooldown and sufficient stock; **reserve/spend once per accepted activation, before a delivery can apply an immediate hit**, never per struck target or per visual frame. A rejected activation consumes nothing, and two simultaneous requests cannot spend the same final item twice. The same underlying rules must be owner-neutral (baddies can have finite stocks later); an absent cost means unlimited ordinary attacks. Do not require an inventory trait, item icon or counter for legacy games.
- **Editorial simplicity:** Show the existing essentials by default: attack name, damage, reach, cooldown and relevant optional appearance. Reveal a delivery shape, *Bodenkontakt nötig*, *Cooldown anzeigen*, *benötigt Gegenstand* or advanced AI triggers only when implemented and selected. Do not expose generic attack JSON to children or create one sprite trait per weapon. Drawings, UI indicators, gameplay conditions and resource consumption are orthogonal options; no obligatory animation/HUD/inventory for a one-image game.
### Five reusable pieces

| Piece | Responsibility | Examples |
|---|---|---|
| **Activation** | Who requests an attack and when | Key/touch, baddie in range + line of sight, later proximity trigger, charged shot |
| **Delivery** | How an attack reaches space over time | Brief melee sweep, flying projectile, instantaneous ray, sustained beam, expanding wave, placed zone |
| **Collision/targets** | What can be hit and how obstacles matter | Single target, every target in an arc, first obstacle, pierce N targets, splash with wall occlusion |
| **Effect** | What happens on a valid hit | Health damage first; later knockback, burn, slow, stun, healing, switches or environment effects |
| **Presentation** | How students see and hear it | Optional sprite/animation/particles/line/sound; missing art must never silently change hit detection |

**Separation is essential:** laser drawing is not laser collision; projectile artwork is not a placed pickup; an explosion animation is not an automatic area hit. The same effect pipeline applies to `actor` and `baddie` targets, dispatching to their current health storage without moving/migrating it.

## 3. Attack families this architecture must accommodate

**Support as a design requirement** means the data model, lifecycle, hit policy and editor vocabulary can represent each family without replacing the combat engine. It does **not** mean every family ships in the first patch. Each family's first playable milestone must support **both player and baddie owners**.

| Family / student example | Delivery and hit semantics | Key design requirement |
|---|---|---|
| **Sword, fist, claw, spear** | A short-lived directional hit area; hits each eligible target once per swing | Shape and reach independent of animation; a spear has a narrower/longer hit area than a fist |
| **Bow, pistol, fireball, thrown rock** | Projectile moves on a path and collides with targets/world | Straight or arcing trajectory; lifetime/range, spawn offset, swept collision against thin objects |
| **Instant laser / railgun** | **Raycast on firing**: hit first obstacle or eligible target along a narrow line, then show a brief visual | No visible projectile travel is required; range, beam width, wall occlusion, optional later piercing/reflection |
| **Continuous laser / energy beam** | **Sustained ray/segment** while firing; deals damage at an explicit interval or damage-per-second rate | Never apply full damage every 1/60-second tick accidentally; owner death, interruption, direction and release stop the beam |
| **Flamethrower / dragon breath** | Short-range directional **cone** or repeated short-lived area | Multiple targets; explicit tick interval, obstacle blocking, visual particles optional |
| **Bomb / grenade / rocket** | Projectile or timed object followed by **radial area-of-effect** burst | Trigger on hit or fuse expiry; radius/falloff and whether walls shelter targets; projectile and explosion are distinct phases |
| **Shockwave / ground slam** | Expanding ring or directional travelling wave | Outward progression and per-target hit history so an overlapping ring doesn't repeatedly deal full damage |
| **Chain lightning** | One initial target then jumps to nearby eligible targets | Deterministic target selection, maximum jumps, no revisits, maximum chain radius and wall/LOS policy |
| **Homing missile / seeking orb** | Projectile adjusts velocity toward a target | Maximum turn rate and lifetime; handle target death/disappearance; explicit acquisition and wall collisions |
| **Boomerang / returning blade** | Projectile flies out and returns to its owner | Outbound/return phases, ownership, optional hit-on-return policy, remove if owner/level vanishes |
| **Mine / spike trap / persistent magic circle** | A placed or spawned **zone** triggers on entry or at a controlled interval | Arming delay, lifetime, owner/team, per-target rehit interval; do not silently modify old static `trap` behavior |
| **Shield bash / push / ice spell** | Any delivery shape with a different **effect** | Knockback/slow belong to effect handling, not separate collision systems; guard against stacking abuse |
| **Healing beam / allied support** | Ray, projectile or zone with a beneficial effect | Explicit team/target filters and max-health limits; not covered by an enemy-only damage path |
| **Spread shot / shotgun** | Multiple child projectiles from one activation | Bounded count and per-shot IDs; configurable pellet damage and duplicate-target policy |

**Laser distinction:** an *instant laser* samples one line at the moment of firing (hitscan); a *continuous laser* stays active for a duration and applies controlled periodic damage. They can share ray/obstacle geometry but **must not** share accidental per-frame damage behavior. A visible charging phase, warning line, reflection, piercing, or moving turret is a later option—not a prerequisite for the first working laser.

**Controlled v1 defaults:** no friendly fire; player attacks affect living baddies, baddie attacks affect the living player; never hit owner. Wall/closed-door occlusion by default. Piercing, explosion-through-walls, ricochet, status stacking, and friendly fire are **explicit optional policies**, never accidental consequences of a new attack family.

## 4. What children must draw, and how they can improve it

**Design rule: combat works before any attack animation is drawn.** A student starts with an ordinary actor and baddie sprite (one standing image per character is sufficient for a visually identifiable first test); selecting an attack preset adds the mechanical hit behavior. A child should not have to draw a complete animation, separate equipment, a hit effect, or a new sprite for *each character* just to make a working fight. The editor offers a functional, readable **simple visual fallback** (short swipe/flash/line/circle) for every delivered attack; the gameplay shape is computed separately from the picture. Player and baddie owners have **identical asset requirements** for a given attack. The **current swing delivery** supplies a configurable, optional swoosh; other attack families need their own fallback when implemented.

### Sprite checklist for the smallest playable example

- **Swordfight:** draw or reuse a **player sprite and an enemy sprite**. A single standing image for each is enough. The engine draws a brief simple slash or hit flash automatically, so **no separate sword sprite or attack frames are required**. To show a sword being held, draw it into a character's attack frame later; a separately drawn sword overlay is an optional advanced variation, not a prerequisite. The enemy can use the same sprite definition in multiple places without shared attack state.
- **Archer vs archer:** draw/reuse the **two character sprites and one small arrow sprite**. The arrow can be shared by player and enemies; the bow may be drawn directly into their character image if desired, but does not have to be a separate sprite. Provide a neutral default projectile marker if no arrow art is chosen for a generic shot; a named **Pfeil** recipe should explicitly guide the child to draw/select the arrow to make the result recognizable. An arrow sprite is a *visual asset*, not a pickup or normal placed object. Changing the art must not change flight speed/hitbox/damage.
- **Laser duel:** draw/reuse **only the two character sprites**. A bright straight line is drawn by the engine, ending at the first obstacle or target; **no bullet sprite** and no frame-by-frame beam image needed. An optional glowing muzzle, charging frame or impact sparkle can be drawn later. A continuous laser uses the same procedural line, updated while firing.
- **Magic/fireball shooter:** two character sprites plus **one small fireball sprite** if the child wants a recognizable travelling fireball; a default coloured orb is enough to test the mechanic. Later make the fireball an animated sprite with several frames, and optionally add a separate impact effect.
- **Bomb or grenade:** two character sprites plus **one bomb/grenade sprite** for a recognizable flying object. A temporary circle/flash visual can show the explosion by default; drawing an explosion sprite or animation is optional. The explosive object and its blast are *two gameplay phases*, not two required student-created sprites.
- **Flamethrower/dragon breath, shockwave, chain lightning:** only the two character sprites are strictly needed; draw a default cone/particles, ring or branching lines procedurally. A fire-breath/strike pose and decorative effect sprites can be added later.
- **Boomerang or homing missile:** two character sprites plus **one shared travelling-object sprite** if the weapon's identity matters; the return/turning path is gameplay, not a required second set of pictures. Rotation/flipping should align a single drawing with travel. A fallback geometric shape permits testing before artwork is ready.
- **Mine/trap or persistent magic circle:** two character sprites plus **one visible marker** (a simple sprite or an engine-drawn sign/circle) if placed on the ground, so students can tell where the hazard is. Do not require animation or silently treat an old static trap as a new combat attack.

**Minimum art means minimum *new* art:** existing games already have their own actor/baddie graphics. A student adding a sword to an existing game need not redraw either sprite. One projectile sprite may be reused by several attackers and by multiple presets with different damage or speed. A preset can offer `Bild: automatisch` as its default, with `eigenes Sprite wählen` where relevant; for a named arrow/bomb tutorial, explain when the extra drawing makes the type visually clear. Never auto-spawn an arbitrary chosen sprite as a placed world object or activate its unrelated traits.

### An explicit creativity ladder, using the existing sprite editor

| Stage | Child-facing goal | Drawing work | Engine/editor contract |
|---|---|---|---|
| **1 · Es funktioniert** | A player and enemy can both attack and take damage. | Only the existing character images; perhaps one projectile image for a recognizable arrow/bomb. | Preset supplies collision, damage and simple procedural feedback. Gameplay must work with no attack/death animation. |
| **2 · Man erkennt den Angriff** | Make a sword swing, bow shot or laser charge visible. | Draw an optional **Angriff** pose/state on the player **and/or** baddie. For projectile attacks, add one projectile sprite if using a generic fallback. | Reuse the current character **states and their frames**; new optional state tags/pickers can be added without rewriting the art editor. One attack frame is valid, multiple frames animate. |
| **3 · Es bewegt sich schön** | Animate anticipation, swing, recoil, a spinning projectile. | Add frames to the attack state or the chosen projectile sprite; optionally draw distinct left/right poses. | Use existing frame playback and horizontal flip fallback. Anchor the weapon/projectile to the character's position. Animation playback must not change the hitbox or allow extra hits. |
| **4 · Treffer zeigen** | Make hits feel satisfying and readable. | Optionally draw **Treffer** and **Tod** states, an arrow-hit sparkle, blast frames, or a beam start/end glow. | Default short flash/shape remains when images are absent. Distinguish attacker animation, projectile animation and target reaction; do not overwrite an already-dead character state. |
| **5 · Meine eigene Waffe** | Give several characters distinctive looks without rewriting combat. | Swap sword pose/overlay, arrow/fireball/bomb image, beam colour, impact animation or sound. | Visuals may vary by attack and owner while using the **same** delivery/collision/effect code and saved attack preset. |

**Existing framework vs planned additions:** `src/static/traits.js` currently exposes character standing/walking/jumping/falling/death state tags; character states already hold frames. It does **not** yet have a fully wired `Angriff`, `Treffer`, or `Aufladen` state and attack-to-animation binding. The implementation must add these optional state tags/pickers in a focused patch for **both** actor and baddie, using existing state/frame editing and a safe stand/walk fallback. The visual system must not require students to draw all left/right/front/back variants: preserve last horizontal facing and use flipping if a matching direction image is absent. A child may draw one attack pose and see it work from either side, with optional separate directional poses later.

**Timing rule:** combat collision uses configured world-space hit shapes and fixed simulation timing, **never image pixels, frame count, or sprite colour**. By default a swing starts when the attack is accepted, not when an optional animation reaches a particular frame. Later an explicit advanced *Trefferzeitpunkt* may synchronize the hit to a chosen animation moment; absent such a setting, a 1-frame attack pose and a 6-frame attack animation inflict exactly the same damage. Movement, gravity and attack ownership continue normally during optional animation unless a separately documented setting changes that. Projectiles are spawned independently of the attacker's animation and their sprite frames play while in flight. Beam visuals track the measured ray, so drawing a long static beam is unnecessary.

### German contextual help: art and animation (proposed wording)

| Where | Short `?` help text / guidance |
|---|---|
| **Angriff hinzufügen** | „Zum Ausprobieren reichen die Bilder deiner Spielfigur und deines Gegners. Ein Angriff funktioniert auch ohne eigene Angriffsanimation.“ |
| **Angriffsbild** | „Du kannst ein Bild für einen Pfeil, Feuerball oder eine Bombe zeichnen. Die Bewegung und der Schaden hängen von den Angriffseinstellungen ab, nicht von der Größe oder den Einzelbildern des Bildes.“ |
| **Angriffsanimation** | „Zeichne einen neuen Zustand für den Angriff. Ein Bild genügt; mit mehreren Einzelbildern wird daraus eine Animation. Ohne diesen Zustand verwendet die Figur weiterhin ihr normales Bild.“ |
| **Trefferanimation** | „Diese Zeichnung zeigt, dass eine Figur getroffen wurde. Sie ändert nicht, wie viel Schaden der Angriff verursacht.“ |
| **Laser** | „Für einen Laser brauchst du kein Geschoss-Sprite: Der Strahl wird automatisch gezeichnet. Du kannst später einen leuchtenden Startpunkt oder eine Ladeanimation ergänzen.“ |
| **Angriff auf beiden Seiten** | „Diese Angriffsart können Spielfigur und Gegner benutzen. Du kannst für beide eigene Animationen zeichnen, musst es aber nicht.“ |

### Recipe-writing rule for children

Every published combat recipe must open with **„Das musst du zeichnen“** and **„Das kannst du später dazumalen“**, followed by the exact editor steps for **both the player and the baddie**, a small game test, and one visual upgrade exercise. Distinguish **Figuren-Sprite**, **Geschoss-Sprite**, **Angriffs-Zustand** (frames belonging to the character sprite), and **Treffer-/Effektbild** so students do not mistakenly draw an entire extra character to create an attack animation. Use the existing sprite/state/frame vocabulary visible in the live UI; revise these draft names if the final interface uses different labels.

**First three example recipes, in that order:**

1. **Schwertkampf:** draw/reuse player + enemy; enable a shared melee preset on both; test damage both directions **without** attack art; add a one-frame raised-sword state to one character; add two or three frames to show a swing; optionally draw a distinct enemy swing and hit/death images.
2. **Bogenschützen:** draw/reuse player + enemy and draw **one arrow sprite**; configure the same projectile preset for both, each selecting that single arrow; test that both can shoot; add one bow-drawing or release frame to each character; add optional arrow-flight or impact frames. No separate bow sprite is required.
3. **Laser / Geschützturm:** draw/reuse player + enemy; configure the same instant-ray preset for each, with a stationary baddie as turret; test lines/wall blocking **with zero new attack sprites**; then add optional charge frames and a muzzle glow to make the turret look different from the player's laser. A continuous beam is a separate preset with timed repeat damage, not simply an animation of the instant laser.

## 5. Current attack storage and proposed extensions

**Current storage:** `actor.attacks` / `baddie.attacks` arrays remain readable. The new optional `melee_attack.attack` trait configures a shared attack; `resolved_character_attacks` projects it into the character's runtime view, taking precedence over a shadowed old `sword` without editing stored JSON. Adding the trait explicitly transfers an old sword's custom values; unrelated legacy attacks remain. The current trait configures **one** attack; multiple equipped/alternate attacks and generic ability activation need a deliberate extension later, not duplicate `sword` IDs. The following laser example is **illustrative and not executable**. Proposed area geometry, HUD preference and item costs are **not** part of the current parser/runtime schema; do not save them as apparently functional settings until their handlers exist.

```json
{
  "attacks": [
    {
      "id": "basic_laser",
      "slot": "fern",
      "label": "Laser",
      "preset": "instant_laser",
      "delivery": { "kind": "ray", "range_px": 350, "width_px": 3 },
      "hit": { "max_targets": 1, "stop_at_solid": true },
      "effect": { "kind": "damage", "amount": 20 },
      "timing": { "cooldown_s": 0.8 },
      "visual": { "kind": "beam", "duration_s": 0.1 }
    }
  ]
}
```

The structure shows the **separation of concerns**, not a mandate to expose raw JSON to students. `preset` selects a small bundle of compatible defaults; an advanced editor may override documented fields. Use stable attack IDs within a sprite; select visual sprites by a robust reference or correctly maintain/revalidate any sprite indices on reorder/delete. Never use a visual sprite's `pickup`, `trap` or other placed-sprite traits as attack behavior. The runtime validates finite quantities, bounded projectile counts, finite durations/positions, positive damage where required, and supported delivery/effect combinations.

### Runtime interfaces (illustrative)

```text
requestAttack(ownerCharacter, attackId, optionalAim)
    -> verify owner, game phase, attack definition, owner-local cooldown/energy
    -> player input OR baddie decision supplies the same request
    -> create AttackInstance (unique id, owner, team, snapshots, lifetime, hit history)

CombatSystem.step(fixedDelta)
    -> update and retire active deliveries (swing, projectile, ray, beam, zone, wave)
    -> query candidate targets and solids using shared world-space geometry
    -> verify live/eligible targets, visibility, obstacle precedence, hit/rehit policy
    -> applyEffect(target, attacker, attackInstance, effect)
    -> expire projectiles/zones, remove visuals and hit history on reset/level change
```

**Ownership and targeting:** the player and each baddie are character instances, not sprite indices. One shared `applyEffect`/damage gateway respects player invincibility, baddie inactivity/death, levels ending, and game pause. Store `lastHitAt` per *(attack instance, target instance)* where periodic hits are allowed; use a one-hit `Set` where not. A sustained beam's periodic hits must not be throttled by unrelated legacy contact-damage cooldowns. An instant ray uses a **single collision snapshot**; a continuous beam rechecks occlusion/targets at its documented interval or fixed step. Sort candidate collisions by distance along travel so a target behind a solid object isn't hit first. Define overlap and tie behavior deterministically.

**Direction:** one melee attack key; no four-directional melee controls. Remember the last horizontal facing for keyboard melee and default ranged fire. Player mouse aiming is optional and converts cursor position into world coordinates. Baddie attacks can use the same chosen aim vector, determined by basic AI from the player's current position and line of sight; a fired arrow is not homing unless its delivery explicitly says so. Stationary turrets are ordinary baddies with zero movement/patrol disabled and an attack. Active beams attached to owners update their origin/direction (or lock aim) according to a stated setting.

**Obstacles and performance:** reuse a shared collision/line-of-sight API across projectile, ray, beam, cone and blast families, not a new enemy-only geometry engine. Include world collision geometry and closed doors; open doors don't block. Swept collisions prevent fast arrows from tunnelling. Bound the number of active attack instances, projectiles, chain hops and zone duration to prevent accidental infinite loops and browser stalls. Collision debug visualization can come later, but shape semantics must be testable without animations.

## 6. Trigger rules and player/editor usability

The studio already offers **Nahkampfangriff** for actor and baddie, with its name, damage, reach, cooldown, swoosh direction/length and compact `?` hints. **Fernkampfangriff**, a symmetric Flächenangriff delivery, optional animation and HUD/inventory controls appear only when implemented. A child can call a generic attack Faustschlag, Schwert or U-Boot-Ramme; its name never determines its physics. Avoid a long row of unused toggles: show relevant geometry/visual controls for the selected delivery, and keep advanced conditions/costs collapsed or hidden by default.

Currently **J and the conditional Angriff touch button** activate the existing melee swing while held (repeating according to the configured cooldown); **F remains interaction**. K/Fernkampf, freely selectable attack slots and several simultaneous equipped attacks are proposed, not working UI. A laser/torpedo should later occupy a ranged slot independent of its delivery. For baddies, add explicit readable AI trigger choices only with their supported delivery; never duplicate player-only geometry/damage. The cooldown HUD is opt-in for the player, not an extra compulsory UI element for all enemies.

**Shared German help examples** (draft, publish with implementation):

- **Angriff hinzufügen:** „Wähle, wie deine Figur angreifen soll. Die gleichen Angriffe funktionieren bei der Spielfigur und bei Gegnern. Für die Spielfigur legst du die Taste fest; Gegner greifen nach ihrem Angriffsverhalten an.“
- **Angriffsart – Laser:** „Ein Laser trifft sofort entlang einer geraden Linie. Normalerweise stoppt er an einer Wand oder am ersten Ziel. Für einen anhaltenden Laserstrahl wähle die Angriffsart ›Dauerstrahl‹.“
- **Dauerstrahl – Schaden:** „Ein Dauerstrahl verursacht Schaden in festgelegten Zeitabständen. Die angezeigte Schadenszahl gilt **pro Trefferintervall**, nicht pro Bildschirmbild.“
- **Flächenschaden – Radius:** „Alle erlaubten Ziele im Umkreis können getroffen werden. Wände schützen standardmäßig vor der Explosion.“
- **Trefferregel:** „Ein Schwert trifft jedes Ziel höchstens einmal pro Hieb. Bei einem Dauerstrahl kannst du einstellen, nach welcher Zeit dasselbe Ziel erneut getroffen werden darf.“
- **Gegner mit Waffen:** „Gegner können dieselben Angriffe wie die Spielfigur nutzen. Berührungsschaden ist eine eigene Einstellung und wird durch eine Waffe nicht automatisch ausgeschaltet.“

Keep `?` modal text short as with doors; make it immediately clear when a sprite or animation is **optional**. Link it to real rendered Markdown recipes under `docs/kampf/` only when their features work. The design document and inactive recipes must not mislead children into believing unimplemented attack families are available.

## 7. Static teaching recipes: grow a small, testable catalogue

Proposed files: `docs/kampf/README.md` (gallery of **available** recipes), `schwertkampf.md`, `bogenschuetze.md`, `laser.md`, `feueratem.md`, `bomben.md`, `blitzkette.md`, `geschuetzturm.md`, `gegner-mit-waffen.md`. Use **Ziel → Das musst du zeichnen → Das kannst du später dazumalen → Vorbereitung → Einstellungen → Ausprobieren → Häufige Fehler → Erweiterung**, exact German editor labels, one small example level, and troubleshooting for player and baddie versions. A full tutorial should be published **only when its steps are playable**. Keep the earlier sword/archer/enemy recipes as drafts until matched against actual implemented controls.

### Draft recipe — „Wie baue ich einen Laser?“ (player **and** baddie)

**Ziel:** Both sides can fire a straight laser that stops at walls and damages the first opposing character. **Not yet available.** **Das musst du zeichnen:** keine zusätzlichen Geschoss-Sprites — die vorhandenen Bilder von Spielfigur und Gegner reichen. **Das kannst du später dazumalen:** Aufladezustand, Mündungsleuchten, Trefferfunken.

1. Create an actor and a baddie; give each an **Angriff** using the **Laser (sofort)** preset. Put the player's laser in a keyboard/touch slot, and give the baddie *bei freier Sicht und in Reichweite* activation. A stationary laser turret is a baddie that does not patrol.
2. Set example values **Reichweite = 350 px**, **Schaden = 20**, **Pause zwischen Schüssen = 0,8 s**. For a purely ranged baddie, separately set **Berührungsschaden = 0**.
3. Fire the player's laser with its configured key; move the player into the turret's visible range to make the baddie fire. Each beam should stop at the closest wall/closed door or eligible opposing character.
4. Place a wall between them: neither laser should hit through it. Put two baddies in line: a default laser should hit only the first one. Verify that two placed turret copies have separate cooldowns and cannot fire after death.

**Häufige Fehler:** A visible line with no damage means the ray/effect has not been configured; a laser that hurts on every frame without interval control is a **Dauerstrahl** bug, not an intended default; a turret not shooting may be blocked or out of range. **Erweiterung:** continuous laser, charging warning line, piercing or ricochet as explicit advanced rules.

### Additional draft recipe targets

- **„Wie baue ich einen Flammenwerfer?“** A short-range cone that damages player or baddie at a documented interval, never on every render frame.
- **„Wie baue ich einen Gegner mit Bomben?“** An arcing projectile and a timed blast with radius; the same bomb is available to the player.
- **„Wie baue ich eine Blitzkette?“** Bounded jumps across eligible targets; no duplicate hits; walls/visibility tested.
- **„Wie baue ich einen Geschützturm?“** A stationary baddie with a laser, bow, spread shot or flamethrower preset; no second turret-only combat system.

## 8. Implementation milestones: symmetry and extensibility first

**M0 — Implemented (shared foundation).** `src/static/combat.js` defines attack validation, owner-local cooldowns, instance/hit history, common player/enemy damage dispatch and reset/expiry. No new gameplay occurs in games without optional attacks. Non-melee deliveries and a general shared obstacle-query API are **not yet implemented**.

**M1a–M1h — Forward melee, editor/touch polish and hit art present on inspected branch.** Both actor and baddie use `swing`, once-per-target hits, separate owner cooldowns, solid/closed-door blocking, J/AI and conditional touch attack. Generic `melee_attack.attack` with legacy `sword` adapter, damage/reach/cooldown/swoosh UI and compact help/CSS are in the branch. The user has tested melee gameplay, not a general old-game regression suite. **M1h Trefferstern/POW is committed and user-tested.** Its separate focused test file is not tracked; add coverage when refactoring effects. **Still pending:** character attack/hit states and interruption priority, grid-pixel rendering, a common accepted-hit notification and a published/tested German melee recipe. Existing `dead` artwork (including transparent frames) remains authoritative; do not add corpse-removal timers.

**M2 — Projectile playable for player AND baddie.** Shared projectile delivery, neutral visual fallback, selectable **one shared arrow sprite** with reorder/delete safety, animation of the chosen projectile sprite's existing frames, collision, expiry, baddie aim and visibility rules, simple straight shot/arrow, recipe for bow + archer enemy. Projectile damage uses M0 effect gateway, not new damage code.

**M3 — LASERS playable for player AND baddie (planned core family, not vague future polish).** Instant raycast, solid occlusion, nearest valid target, **procedural** short-lived beam visual (zero extra sprites required), optional charging/impact character-state hookup, per-owner cooldown, same player slots and baddie AI, German online help and **tested laser/turret recipe**. Add continuous laser in a separate small M3b patch with explicit per-target rehit interval, release/interrupt handling, beam attachment rules and a tested recipe. No silent per-frame full damage.

**M4 — Area and alternate travel.** Implement radial explosion, cone/flamethrower and wave, one family per patch. Each release works for player and baddies and has its own verified recipe. Support wall occlusion and per-target hit policy; distinguish single burst from sustained zones.

**M5 — Richer combinations.** Pierce, bounce/ricochet, returning or homing projectile, spread, chain lightning and mines/zones; keep explicit bounds/hit histories. Status effects (burn, slow, knockback, healing) are orthogonal additions to `applyEffect`, not new ownership/damage systems. Prioritize with student feedback rather than promising all at once.

**M6 — Optional aiming and advanced polish.** Mouse aim/click-to-fire and touch aiming, richer charge/telegraph/impact visuals beyond the **basic optional actor/baddie attack-state and projectile-frame support supplied at each family's first release**, sound, equipment and upgrades, priority editing, friendly-fire controls; implement as focused opt-in patches. The basic design must accommodate them already.

At **every** playable milestone, acceptance requires that both an actor **and** a baddie can originate the attack, receive eligible attacks according to team rules, and respect independent instance health/cooldowns. A one-sided implementation is an incomplete milestone, not a successful player-only release.

## 9. Focused manual checks to accompany each patch

- **Legacy unchanged:** when neither old `actor.attacks` / `baddie.attacks` nor the new `melee_attack.attack` is present, there is no new attack-key/touch/HUD behavior. Old F interaction, contact damage, doors and saved JSON remain unchanged; an absent new cost/visual/HUD option must not be fabricated on load. Unimplemented presets are visibly unavailable, never silent no-ops.
- **Symmetry:** player sword vs baddie sword; player arrow vs archer enemy; player laser vs laser turret. Each uses the same geometry, hit effect and owner-local cooldown path.
- **Per-instance:** two baddies using one sprite definition independently take damage, attack, and die. Inactive enemy cannot be hit/attack due to a stale index. Reset clears swings, projectiles, rays, beams and hit records.
- **Collision:** solid geometry/closed door stops default sword/projectile/ray, open door permits it; fast arrows do not tunnel, nearest ray hit wins, laser does not hit behind a wall, target behind another target requires explicit piercing.
- **Timing:** one sword swing hits a given target once; beam/cone periodic damage is determined by elapsed simulation time, not render frame rate; death, key release, game pause and level exit terminate sustained attacks properly.
- **Authoring:** sprite reorder/delete never substitutes wrong projectile art; missing art/configuration shows German help; keyboard-only and touch controls can fire where enabled; baddie priorities and contact damage are clearly separate.
- **Minimum art and animation:** player and baddie melee work with only one still frame per character; an archer pair can share one arrow sprite; laser requires no extra attack sprite. An optional character attack state with one or several frames changes visuals but not damage/timing, and missing frames fall back safely for both owners. Animated projectile art must not change hitboxes or hit count.
- **Recipe check:** a student following each published recipe literally obtains the described result with the labels and controls actually shown in the editor; each recipe distinguishes required drawings from optional visual upgrades.

## 10. Settled decisions and remaining design questions

**Settled:** One shared owner-neutral combat path handles actor and baddie; generic traits are editor capabilities, not distinct systems per weapon. J (plus opt-in touch) activates current forward melee; F remains interaction. Damage/reach/cooldown are independent of artwork. Ground stomp should be a symmetric horizontal area hit, not an enlarged one-sided sword sweep. Cooldown display and stockable-item costs are optional and must not affect existing games. A visual reaction belongs to the struck character; the attacking ability chooses its own impact graphic. Death overrides Treffer and Angriff states. **Open to test/design:** exact area height/wall semantics and activation trigger; per-game/per-level resource reset; multiple attack slots/AI priorities; renderer pixel-grid details and colour/flicker accessibility; attack-state timing/interruptions; K/ranged aiming and documentation hosting.

**Next action (documentation review complete):** Use the committed M1h implementation as the baseline. Then implement optional Angriff/Treffer character states and shared, grid-aligned hit feedback in small patches with actor/baddie tests; keep collision/cooldowns unchanged. Next use a centered two-sided area stomp as an architecture test, followed independently by opt-in cooldown HUD and consumable pickup/cost support. Publish recipes only for steps verifiably playable in the editor. Do not modify GitHub on the user's behalf.
