# 2D Game Studio — Combat system design and teaching recipes

**Status:** design proposal, not implemented. Prepared for the `specht/2d` project on 2026-09-20, based on the read-only `master` source reviewed during this conversation (latest observed commit `9bec498142cdd7351ea393996b33743e1e066af3`). This document is an implementation handoff, not a description of features currently available to students.

**Non-negotiable requirement: player and baddies are supported from the first combat release.** Do **not** ship a player-only combat implementation and defer enemy use of weapons. The first playable slice must allow *player vs. baddie melee combat*; the first ranged slice must let both fire projectiles using the same mechanics.

## 1. Existing engine constraints

- `src/static/app.js` has a shared `Character` class for `actor` and `baddie`, fixed-rate simulation (`SIMULATION_RATE = 60`), `Game.player_character`, and `Game.baddies`. `Character` has a facing/direction concept; existing baddie behavior includes patrols. `Game.has_baddie_at(...)` uses a dynamic interval tree and excludes inactive baddies.
- Enemy hit points are held per `Character` instance (`this.energy`); the player's health remains `Game.energy`. Enemy death currently deactivates the enemy and switches to its `dead` state. Do not replace these storage arrangements as a prerequisite.
- Existing enemy **contact damage** (`baddie.damage`) and traps/falling-block damage are separate legacy mechanics. Do not silently reinterpret or remove them. In particular, an archer that should *only* shoot needs its **Berührungsschaden** set to `0`.
- Existing player controls include arrows/WASD for movement, Space for jumping, and **F for interaction**. Do not use F, WASD, arrows, or Space as new default attack keys. The engine also has touch controls; combat controls should be shown only when available on that character.
- Sprite traits and their German labels/help live in `src/static/traits.js`; the sprite-property editor uses these definitions (`src/static/game.js`), and the existing `?` hint dialog is built in `src/static/widgets.js`. Character sprites have optional state images, including `dead`. A new attack animation must have a fallback if no state is drawn.
- Existing games and JSON must continue to load and play unchanged. The following proposed property names, defaults, controls, and UI labels are **new designs**, not current code or existing student-facing instructions.

## 2. Minimal mental model

A character can have zero, one, or both of these **optional** traits:

- **`melee_attack` — Nahkampfangriff**: one short-lived hit region immediately in front of its owner.
- **`ranged_attack` — Fernkampfangriff**: spawn a moving projectile owned by the attacking character.

The *same trait schema and runtime attack code* apply whether the owning character is an `actor` or a `baddie`. Only the **attack intent provider** differs: player input versus an enemy's simple attack decision. A trait on an ordinary block or decoration is not valid; the editor should offer combat traits only for sprites with `actor` or `baddie`, and the runtime should safely ignore invalid legacy/malformed combinations.

An attack has an **owner instance**, an **owner team** (`player` or `baddie`), a damage value, a collision shape, an activation time/cooldown, and a record of targets already hit. This is *not* a shared mutable property of the underlying sprite. An enemy's current health, attack cooldowns, active swing, and projectiles must be per-instance runtime state; two placed copies of one enemy sprite must not share them.

### Targeting and damage rules (both attack types)

1. With friendly fire **off** in v1, player attacks may hit living baddies; baddie attacks may hit the living player. They never hit their owner, another baddie, a door, or a collectible. A baddie attack must not hit a different baddie even when they share a sprite definition. All attack queries recheck `active`/alive status rather than trusting a possibly stale collision index.
2. Attack damage is positive and is dealt **once per target per attack instance**. For melee, a single swing can hit more than one distinct opponent. For ranged, a normal arrow hits the first eligible character or solid obstacle and is then removed. No piercing or area damage in v1.
3. Route combat hits to a **shared damage gateway** that dispatches to the existing player-health and baddie-health handling. Respect the player's current invincibility/death/level-transition states and existing respawn behavior. Use the existing enemy death animation/state. A baddie must not attack after deactivation; the player must not attack while dead, during curtains/paused play, or after reaching an exit.
4. Keep damage attributable to an *attacker instance + attack instance*, not just to a sprite index. When multiple baddies use the same sprite, they are independent attackers and independent targets. Validate finite positive damage, nonnegative cooldown, and valid target before applying it.
5. Keep legacy **contact damage** and falling-block behavior unchanged. New combat hit rules apply to new melee/projectile attacks only. Do not apply attack hitboxes as contact damage merely because sprites overlap.

### Facing and geometry

- **Melee:** one player key, one baddie AI action. The swing projects in the horizontal direction the character faces (`left`/`right`); no four-directional melee key scheme. Remember last horizontal facing even when standing still or when an animation uses `front`/`back`. Use the owner's configured collision box and world-space sprite size as the anchor. Attack reach is *extra distance in game pixels outside the owner's collision box*; target must also overlap the swing's vertical band. Obstacles between owner and target must block an ordinary sword swing (avoid attacks through walls/closed doors).
- **Projectiles:** spawn at the edge of the owner's collision box, not inside the owner. Simulate using fixed-time steps and `px/s` velocity; use a swept collision or suitably bounded substeps so fast arrows cannot pass through thin targets. Closed doors and solid level geometry stop arrows; open doors do not. Remove projectiles on impact, when the configured range/lifetime expires, and at level setup/reset. Do not insert a projectile into `active_level_sprites` as a normal placed object or accidentally let its artwork's pickup/trap traits take effect.
- **Player ranged direction:** default to last horizontal facing for keyboard firing. Optional mouse-target aiming belongs in a later, separately testable slice; if active, use the cursor's **world position** accounting for camera/zoom, with a clear facing-direction fallback when the pointer is unavailable.
- **Baddie ranged direction:** aim a velocity vector at the player's current position *when fired*, with a finite detection range and line of sight. The arrow is not homing. An enemy can remain stationary or continue its existing patrol; adding combat must not implicitly force pursuit/pathfinding.

## 3. Proposed editor properties and defaults

**Proposal:** add `melee_attack` and `ranged_attack` as independently selectable sprite traits under a new **Kampf** category. Their property schemas, hints, and defaults are identical for actors and baddies. The editor shows only applicable fields and a link to the corresponding Markdown recipe. Removing a trait disables its attack. Ordinary games without these traits have zero new attacks and retain existing controls.

| Trait | Property (proposed JSON key) | German editor label | Default | Meaning |
|---|---|---|---|---|
| `melee_attack` | `damage` | Schaden pro Treffer | `20` | Health taken per eligible target hit. |
| `melee_attack` | `reach` | Reichweite | `20` px | Extra forward extent beyond the owner's collision box. |
| `melee_attack` | `height_percent` | Trefferhöhe | `75` % | Vertical part of the owner's collision box covered by a swing. |
| `melee_attack` | `active_time` | Dauer eines Hiebs | `0.15` s | How long the one-hit-per-target swing exists. |
| `melee_attack` | `cooldown` | Pause zwischen Hieben | `0.45` s | Time between *beginnings* of two swings by the same character. |
| `ranged_attack` | `projectile_sprite_index` | Geschoss-Sprite | **unset** | Which existing sprite supplies the arrow/ball artwork; no projectile without a valid choice. Editor selection must survive sprite reorder/delete (or warn and disable safely). |
| `ranged_attack` | `damage` | Schaden pro Treffer | `20` | Damage from a projectile. |
| `ranged_attack` | `speed` | Geschossgeschwindigkeit | `180` px/s | Fixed-step projectile speed. |
| `ranged_attack` | `max_range` | Schussweite | `400` px | Maximum flight distance, also the baddie's maximum engagement distance in v1. |
| `ranged_attack` | `cooldown` | Pause zwischen Schüssen | `0.8` s | Time between launches per character. |

Values above are *proposed* starting points for a first playable test, not verified balancing. `projectile_sprite_index` is particularly important: the repository uses sprite indices elsewhere, so index remapping when sprites are reordered/deleted must be explicitly included in the implementation or replaced with a stable reference. Do not silently target the wrong artwork.

**Enemy AI settings:** do not introduce a second enemy-only weapon format. Baddies automatically request an enabled melee attack when the player is in forward reach with sufficient vertical overlap and unobstructed contact; they request an enabled ranged attack when the player is in range and visible. Attack cooldowns and disabled/dead states are the same as for player-triggered attacks. If both attacks are enabled, prioritize melee when its conditions are met; otherwise use ranged. This priority is a documented rule, not a hidden special case. Enemy fire is limited by the same cooldown as player fire, and enemies must not attack through solid terrain.

**Controls (initial proposal, confirm against the full runtime and browser before shipping):** `J` = player melee; `K` = player ranged. Press once for one attack; holding can repeat at the configured cooldown only if intentionally enabled and documented. Keep `F` for doors/text and existing movement keys unchanged. Show separate touch attack buttons only for attack traits actually available on the player's sprite. Neither key nor touch input is needed for baddie attacks. Mouse aiming/click-to-fire is *not* required for the first release, but the shared attack request API must accept an optional aim vector so that adding it does not fork ranged combat.

## 4. Runtime architecture

Proposed interfaces (illustrative pseudocode, **not** drop-in JavaScript):

```text
AttackIntent(ownerCharacter, kind, optionalAimVector)
    -> validate owner is alive/active, attack trait exists, game is running
    -> check owner-local nextAllowedAttackTime[kind]
    -> start melee swing OR spawn projectile with owner/team/damage snapshot

CombatSystem.update(fixedDelta)
    -> collect intent from player input and from baddie AI
    -> simulate active swings and projectiles
    -> find eligible targets; check world obstacles and target active state
    -> applyCombatHit(targetCharacter, attackerCharacter, attackId, damage)
    -> expire completed attacks and remove projectiles
```

- Use `Game` (or a small dedicated combat component owned by `Game`) to manage active attack instances and projectiles; use `Character` to own cooldowns, health references, and AI/player attack intent. **Do not create separate `playerShoot()` and `baddieShoot()` damage/collision engines.**
- Process combat once per fixed simulation step, consistently relative to character movement and dynamic enemy-index updates. Add a check for the player hitbox when the owner is a baddie; the existing enemy index covers only baddies. Collision tests must not depend on iteration order or leave a killed enemy available as a live target later in the step.
- Use explicit attack IDs or per-attack `Set` of target *instances* for once-per-target behavior, independent of sprite IDs. Discard all projectiles and hit records on level transition/reset. The player's existing invincibility window must be respected even for simultaneous arrows; do not create a second conflicting health system.
- Use a nullable, optional attack animation state for **both** actor and baddie; falling back to current standing/walking images must not stop a hit from working. An optional projectile sprite is visual only, while its trajectory and collisions are computed by the combat system. Support flipping/rotating that visual to match travel direction without changing the source artwork.
- UI/runtime validation: no attack if no character trait, no valid projectile sprite, zero or invalid speed, invalid target, expired projectile, or a paused/finished game; show a useful German editor hint for invalid setup rather than letting play crash.

## 5. Student-facing German online help (draft text)

The following is **proposed text for new editor fields/help**, not text already present in the current UI. Reuse the compact `?` dialogs already used for doors. Keep each field's hint short; use a clearly labeled **„Anleitung: Schwertkampf“ / „Anleitung: Bogenschütze“ / „Anleitung: Gegner mit Waffen“** link for the full recipes.

| Context | Suggested heading | Suggested short help |
|---|---|---|
| `melee_attack` trait | **Nahkampfangriff** | „Diese Figur kann vor sich zuschlagen. Das funktioniert bei der Spielfigur und bei Gegnern. Die Reichweite wird ab dem Rand ihrer Kollisionsbox gemessen. Ein Ziel kann pro Hieb nur einmal getroffen werden.“ |
| `melee_attack.damage` | **Schaden pro Treffer** | „So viel Energie verliert ein getroffenes Ziel durch einen Hieb. Bei der Spielfigur greift die Taste J an; ein Gegner greift automatisch an, wenn die Spielfigur vor ihm in Reichweite ist.“ |
| `melee_attack.reach` | **Reichweite** | „Wie weit reicht der Hieb vor die Figur? Die Zahl ist die zusätzliche Entfernung in Spielpixeln ab ihrer Kollisionsbox.“ |
| `melee_attack.cooldown` | **Pause zwischen Hieben** | „Wie lange muss die Figur warten, bis sie erneut zuschlagen kann?“ |
| `ranged_attack` trait | **Fernkampfangriff** | „Diese Figur kann Geschosse abschießen. Wähle ein Geschoss-Sprite aus und stelle Schaden, Geschwindigkeit und Schussweite ein. Auch Gegner können schießen.“ |
| `ranged_attack.projectile_sprite_index` | **Geschoss-Sprite** | „Wähle das Bild für den Pfeil oder Feuerball. Ohne gültiges Geschoss-Sprite kann die Figur nicht schießen.“ |
| `ranged_attack.max_range` | **Schussweite** | „Nach dieser Strecke verschwindet das Geschoss. Ein Gegner schießt nur auf die Spielfigur, wenn sie in Reichweite und nicht hinter einer Wand ist.“ |
| Player controls | **Angreifen** | „J: Nahkampf · K: Schießen. Beim Nahkampf greifst du in Blickrichtung an. Beim Schießen fliegt das Geschoss zunächst in Blickrichtung.“ |
| Baddie setup | **Angreifender Gegner** | „Ein Gegner kann dieselben Nah- und Fernkampfangriffe wie die Spielfigur nutzen. Er greift automatisch an, sobald die Spielfigur vor ihm in Reichweite ist. Berührungsschaden ist davon unabhängig.“ |

**Help implementation notes:** hide player-key instructions for a purely baddie-focused context or phrase them as an explicit comparison; distinguish attack cooldown from the existing `baddie.damage_cool_down` for *contact* damage. Link recipes from both the trait summary and the property panel. If a setting has no supported behavior yet (e.g. mouse aiming before its milestone), do not present it as a working option.

## 6. Static documentation: three draft recipes (publish only with the corresponding functionality)

Suggested repository layout: `docs/kampf/README.md`, `docs/kampf/schwertkampf.md`, `docs/kampf/bogenschuetze.md`, `docs/kampf/gegner-mit-waffen.md`. Keep the authoring source in Markdown, rendered through the existing site if possible. **The instructions below name proposed UI options; do not publish them as working tutorials until those options exist and are manually verified.**

### Rezept A — Wie baue ich einen Schwertkampf?

**Ziel:** Die Spielfigur und ein Gegner können sich mit Nahkampfangriffen gegenseitig treffen.

1. Zeichne eine Spielfigur und einen Gegner. Gib ihnen die Eigenschaften **Spielfigur** beziehungsweise **Gegner**, und platziere beide im selben Level.
2. Gib **beiden** Sprites die neue Eigenschaft **Nahkampfangriff**. Trage beispielsweise bei beiden **Schaden pro Treffer = 20**, **Reichweite = 20 px** und **Pause zwischen Hieben = 0,45 s** ein.
3. Lass die **Energie** des Gegners auf `100`. Die Energie der Spielfigur wird weiterhin in den Spieleinstellungen festgelegt. Setze beim Gegner **Schaden bei Berührung = 0**, wenn nur sein Schwert Schaden verursachen soll.
4. Starte das Spiel. Schaue nach links oder rechts und drücke **J**. Gehe zum Gegner: Er schlägt ebenfalls zu, sobald du in seiner Reichweite bist. Die Schwerthiebe müssen auch ohne eigenes Angriffsbild funktionieren.
5. Prüfe: Ein Hieb zieht einem Ziel nur einmal Energie ab; zwischen den Hieben liegt eine Pause; der Gegner verschwindet beziehungsweise wechselt in seinen Todeszustand, wenn seine Energie verbraucht ist.

**Häufige Fehler:** Der Gegner verursacht sofort Schaden beim Berühren? Prüfe seinen separaten Berührungsschaden. Der Hieb trifft nicht? Prüfe Blickrichtung, Reichweite, vertikalen Abstand und Hindernisse. Eine Angriffsanimation ist nur für die Darstellung nötig, nicht für die Treffererkennung.

**Erweiterung:** Gib Spielfigur und Gegnern optionale Angriffsanimationen, erhöhe die Reichweite eines längeren Schwertes oder verändere die Pause zwischen Hieben.

### Rezept B — Wie baue ich einen Bogenschützen?

**Ziel:** Die Spielfigur und ein gegnerischer Bogenschütze können Pfeile verschießen.

1. Zeichne ein kleines **Pfeil-Sprite** als Bild für das Geschoss. Es muss **nicht** als normales Objekt ins Level gestellt werden.
2. Gib sowohl der Spielfigur als auch dem Gegner die Eigenschaft **Fernkampfangriff**. Wähle bei beiden **Geschoss-Sprite = Pfeil** und beginne mit **Schaden = 20**, **Geschossgeschwindigkeit = 180 px/s**, **Schussweite = 400 px** und **Pause zwischen Schüssen = 0,8 s**.
3. Setze beim gegnerischen Bogenschützen **Schaden bei Berührung = 0**, wenn er ausschließlich mit Pfeilen angreifen soll. Er darf sich weiterhin mit seinem normalen Patrouillenverhalten bewegen oder für einen stationären Bogenschützen nicht patrouillieren.
4. Starte das Spiel und drücke **K**, um in Blickrichtung zu schießen. Der gegnerische Bogenschütze schießt automatisch, sobald die Spielfigur in Reichweite und sichtbar ist.
5. Prüfe: Jeder Pfeil trifft höchstens ein Ziel, Wände und geschlossene Türen halten ihn auf, Pfeile verletzen nicht den Schützen oder andere Gegner, und das Spiel räumt alle Pfeile beim Levelwechsel auf.

**Häufige Fehler:** Kein Pfeil sichtbar? Prüfe, ob ein gültiges Geschoss-Sprite ausgewählt wurde. Gegner schießt nicht? Prüfe Schussweite und Hindernisse. Der Pfeil zeigt in die falsche Richtung? Prüfe die Bildausrichtung; die Flugrichtung muss unabhängig vom Bild korrekt sein.

**Erweiterung:** Sobald Maussteuerung separat implementiert ist, kann die Spielfigur gezielt mit der Maus schießen. Ein Gegner könnte später vor dem Schuss eine Zielanimation zeigen; für das Grundrezept ist das nicht erforderlich.

### Rezept C — Wie lasse ich Gegner Waffen benutzen?

**Ziel:** Ein Gegner wählt aus denselben Nah- und Fernkampfangriffen wie die Spielfigur, ohne eine eigene Skriptsprache lernen zu müssen.

1. Erstelle ein Sprite mit der Eigenschaft **Gegner** und platziere es im Level. Stelle **Energie** und nach Bedarf seine bisherige Patrouille ein.
2. Für einen Schwertkämpfer füge **Nahkampfangriff** hinzu. Für einen Bogenschützen füge **Fernkampfangriff** hinzu und wähle ein Geschoss-Sprite. Für einen Gegner mit beiden Waffen aktiviere **beide** Eigenschaften.
3. Der Gegner sucht ein lebendes Spielerziel. Ist die Spielfigur vor ihm in Nahkampfreichweite, verwendet er den Nahkampf. Andernfalls schießt er nur, wenn sie sichtbar und innerhalb seiner Schussweite ist. Ein Gegner braucht keine Angriffstaste.
4. Stelle **Schaden bei Berührung = 0** ein, wenn ausschließlich Waffen treffen sollen. Die Pause zwischen Waffenangriffen stellst du bei den entsprechenden Waffen ein; die bisherige Pause für Berührungsschaden ist etwas anderes.
5. Teste den Gegner einmal mit der Spielfigur links und einmal rechts von ihm. Prüfe außerdem, dass zwei Gegner desselben Sprites unabhängig angreifen und unabhängig Schaden erhalten.

**Häufige Fehler:** Der Gegner verursacht zusätzlichen Schaden, sobald du ihn berührst? Prüfe **Schaden bei Berührung**. Ein Bogenschütze schießt durch eine Wand? Das wäre ein Fehler in der Sichtprüfung, nicht eine zusätzliche Einstellung. Der Gegner greift nach seinem Tod weiter an? Das wäre ein Laufzeitfehler.

**Erweiterung:** Angriffstelegraphie, Nachladeanimationen, individuellere KI sowie Team-/Friendly-Fire-Regeln sind spätere Ausbaustufen.

## 7. Implementation sequence: deliver both sides at every playable stage

**M0 — Small design and editor skeleton (non-playable, not student-advertised).** Agree on property units/labels, default keys, attack target rules, and asset selection; add pure/common combat helpers and owner-local runtime state. Keep existing games unchanged. Do not label half-wired properties as functional.

**M1 — First playable swordfight: player AND baddie together.** Add `melee_attack` to actor and baddie sprites using the same trait, `requestAttack`, hit detection, one-hit-per-target, damage routing, cooldowns, baddie in-range decision, player key/touch input, optional shared attack-state animation fallback, and German help. Publish recipe A and the melee portion of recipe C together. **Do not call M1 done if only the player can swing or only the baddie can receive hits.**

**M2 — First playable archery: player AND baddie together.** Add `ranged_attack`, projectile sprite picker/reference maintenance, launch/movement/collision/expiry, owner/team handling, player key/touch input, baddie aiming with visibility/range constraints, and German help. Publish recipe B and complete recipe C. **Do not call M2 done if only one side can fire.**

**M3 — Optional aiming and polish.** Mouse aim/click-to-fire without hijacking editor canvas input, mouse-to-world conversion under camera/zoom, optional state animations, optional visible swing area in editor, concise warnings for invalid combinations. Keep keyboard-only controls fully usable.

**M4 — Separate features only if requested.** Enemy projectile variants, advanced AI, knockback, dropped weapons, equipment/inventory, weapon upgrades, parrying, friendly fire, extra attack types, multi-hit/piercing and ranged enemies that pursue the player. None is required for basic swordfights or archers.

## 8. Manual acceptance checks (run beside each patch; no large mandatory test suite)

- **Legacy:** an old game without either trait plays with unchanged movement, F interaction, contact damage, and JSON; no attack key side effects or attack sprites are created.
- **Symmetry:** a player sword hits a baddie, and a baddie sword hits the player; later, both can shoot. Each uses identical range/damage/cooldown logic and a different intent provider only.
- **Independence:** two placed baddies of the same sprite have independent health, cooldowns, active swings, and projectiles. Dead baddies cannot attack or be hit again via stale collision results.
- **Contact separation:** contact damage still works for old games; setting it to zero produces a weapon-only enemy, without disabling its attacks.
- **Geometry:** melee cannot hit behind the owner or through a wall/closed door; arrows collide reliably at high speed, stop at solids, and expire. Baddies cannot fire when the player is outside range or behind an obstacle.
- **Multiple targets:** one swing can hit distinct eligible baddies once each; a normal projectile hits only the first eligible target or obstacle; simultaneous enemy attacks respect player invincibility.
- **Reset and authoring:** restart and level changes remove in-flight attacks and restore default cooldown/health. Reordering or deleting sprites cannot silently substitute a different projectile image. Missing visuals/configuration fail gracefully and display clear German hints.
- **Documentation:** each recipe works when followed literally in the student-facing German UI; help is readable beside the corresponding property, matching the compact approach used for doors.

## 9. Open decisions to confirm before the first patch

- Confirm suggested keys **J = Nahkampf** and **K = Schießen** and whether holding each key should auto-repeat at the cooldown. Avoid conflicting with existing development/editor shortcuts.
- Confirm the starting balance values in §3 using a tiny demonstration level; they are provisional.
- Confirm whether baddie archers should stand still by default in the *recipe* (via existing patrol setting) versus whether the engine should introduce a separate engagement movement behavior later. **No new pathfinding in v1.**
- Confirm the documentation serving route for repository Markdown (do not assume an existing static docs endpoint). Until available, the `?` dialog can link to a hosted Markdown rendering, but avoid broken student-facing links.

**Next concrete task in a new chat:** verify the current `master` code again, agree on the small open decisions above, and prepare **M0/M1 as incremental downloadable patches with `git apply --check` verified against the exact current file contents**. Do not write, commit, or push to the user's GitHub repository; the user applies/tests/commits each patch locally.
