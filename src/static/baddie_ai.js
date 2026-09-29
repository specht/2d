// Enemy behaviours ("Verhalten"). A behaviour decides which virtual keys an
// enemy presses; walking, jumping, gravity, slopes and attacks stay the same
// engine code as before. Old games have no `traits.baddie.behavior` and keep
// the original patrol code in app.js exactly.
//
// Saved as: traits.baddie.behavior = { type: 'hunter', sight: 160, … }
// Only the type and values changed in the editor are stored. Loading a game
// gives every enemy without a type the one that matches what it already does
// (promote_baddie_behavior): Wächter, or Steht still if it does not patrol. The
// classic fields (patrouilliert, Startrichtung, …) stay in the file and keep
// driving the classic patrol code, so the movement stays exactly the same.

const BADDIE_BEHAVIORS = {
    guard: {
        label: 'Wächter',
        hint: 'Läuft hin und her und bewacht ein Gebiet – so wie Gegner schon immer. Ohne Schwerkraft fliegt er geradeaus hin und her.',
        settings: {
            range: { label: 'Bereich', hint: 'So viele Blöcke läuft der Wächter höchstens von seinem Startplatz weg. 0 bedeutet: bis zur nächsten Wand oder Kante.', min: 0, max: 100, step: 1, decimalPlaces: 0, suffix: 'Blöcke', default: 0 },
        },
    },
    still: {
        label: 'Steht still',
        hint: 'Bleibt an seinem Platz – zum Beispiel ein Geschützturm, der nur schießt, oder eine Pflanze mit Stacheln.',
        settings: {},
    },
    hunter: {
        label: 'Jäger',
        hint: 'Läuft hin und her. Sieht er die Spielfigur, rennt er hinterher (Zustand „Gegner jagt“). Verliert er sie aus den Augen, gibt er nach einer Weile auf.',
        settings: {
            sight: { label: 'Sichtweite', hint: 'So weit sieht der Jäger nach vorn. Wände verdecken die Sicht.', min: 0, max: 1000, step: 8, decimalPlaces: 0, suffix: 'px', default: 144 },
            chase: { label: 'Tempo beim Verfolgen', hint: 'Das Vielfache seiner normalen Geschwindigkeit.', min: 0, max: 10, step: 0.1, decimalPlaces: 1, suffix: '×', default: 2.0 },
            alert: { type: 'bool', label: 'zeigt „!“', hint: 'Über dem Gegner erscheint kurz ein Ausrufezeichen, sobald er die Spielfigur bemerkt. So weiß man, dass es gleich losgeht.', default: false },
            forget: { label: 'gibt auf nach', hint: 'So lange sucht der Jäger noch weiter, nachdem er die Spielfigur nicht mehr sieht.', min: 0, max: 60, step: 0.5, decimalPlaces: 1, suffix: 's', default: 2.0 },
        },
    },
    coward: {
        label: 'Angsthase',
        hint: 'Läuft hin und her. Kommt die Spielfigur zu nah, rennt er davon (Zustand „Gegner flieht“).',
        settings: {
            panic: { label: 'Angst ab', hint: 'Ist die Spielfigur näher als so viele Pixel, flieht er – egal, in welche Richtung er schaut.', min: 0, max: 1000, step: 8, decimalPlaces: 0, suffix: 'px', default: 72 },
            alert: { type: 'bool', label: 'zeigt „!“', hint: 'Über dem Gegner erscheint kurz ein Ausrufezeichen, sobald er die Spielfigur bemerkt. So weiß man, dass es gleich losgeht.', default: false },
            flee: { label: 'Tempo auf der Flucht', hint: 'Das Vielfache seiner normalen Geschwindigkeit.', min: 0, max: 10, step: 0.1, decimalPlaces: 1, suffix: '×', default: 2.5 },
        },
    },
    lurker: {
        label: 'Lauerer',
        hint: 'Wartet still. Kommt die Spielfigur in Sicht, holt er kurz Anlauf und stürmt los (Zustand „Gegner jagt“). Prallt er gegen eine Wand, ist er eine Weile benommen (Zustand „Gegner ist benommen“).',
        settings: {
            sight: { label: 'Sichtweite', hint: 'So weit sieht der Lauerer – nach links und nach rechts.', min: 0, max: 1000, step: 8, decimalPlaces: 0, suffix: 'px', default: 168 },
            charge: { label: 'Tempo beim Angriff', hint: 'Das Vielfache seiner normalen Geschwindigkeit.', min: 0, max: 20, step: 0.1, decimalPlaces: 1, suffix: '×', default: 5.0 },
            alert: { type: 'bool', label: 'zeigt „!“', hint: 'Über dem Gegner erscheint kurz ein Ausrufezeichen, sobald er die Spielfigur bemerkt. So weiß man, dass es gleich losgeht.', default: false },
            stun: { label: 'benommen nach Aufprall', hint: 'So lange bleibt er stehen, nachdem er gegen eine Wand gerannt ist.', min: 0, max: 20, step: 0.1, decimalPlaces: 1, suffix: 's', default: 1.5 },
        },
    },
    hopper: {
        label: 'Hüpfer',
        hint: 'Bewegt sich nur mit Sprüngen vorwärts – wie ein Frosch. Sieht er die Spielfigur, hüpft er auf sie zu.',
        settings: {
            interval: { label: 'Sprung alle', hint: 'So viel Zeit vergeht zwischen zwei Sprüngen.', min: 0.1, max: 20, step: 0.1, decimalPlaces: 1, suffix: 's', default: 1.0 },
            sight: { label: 'Sichtweite', hint: 'Ist die Spielfigur näher, hüpft er auf sie zu. 0 bedeutet: Er hüpft einfach hin und her.', min: 0, max: 1000, step: 8, decimalPlaces: 0, suffix: 'px', default: 120 },
        },
    },
    flutter: {
        label: 'Flatterer',
        hint: 'Fliegt hin und her und dabei in Wellen auf und ab. Die Schwerkraft wirkt auf ihn nicht.',
        settings: {
            height: { label: 'Wellenhöhe', hint: 'So weit fliegt er über und unter seinen Startplatz.', min: 0, max: 200, step: 1, decimalPlaces: 0, suffix: 'px', default: 16 },
            period: { label: 'Dauer einer Welle', hint: 'So lange dauert einmal hoch und wieder runter.', min: 0.2, max: 20, step: 0.1, decimalPlaces: 1, suffix: 's', default: 1.6 },
        },
    },
    stomper: {
        label: 'Stampfer',
        hint: 'Hängt oben und wartet. Läuft die Spielfigur darunter durch, kracht er nach unten (Zustand „Gegner fällt“, unten „Gegner ist aufgeschlagen“) und hebt sich danach langsam wieder – oder bleibt liegen.',
        settings: {
            trigger: { label: 'fällt ab Abstand', hint: 'So nah (waagerecht) muss die Spielfigur kommen, damit er fällt.', min: 0, max: 200, step: 1, decimalPlaces: 0, suffix: 'px', default: 12 },
            warn: { label: 'wackelt vorher', hint: 'So lange zittert er, bevor er fällt – die Warnung für die Spielfigur.', min: 0, max: 5, step: 0.05, decimalPlaces: 2, suffix: 's', default: 0.2 },
            fall: { label: 'Tempo beim Fallen', hint: 'Die höchste Fallgeschwindigkeit in Pixeln pro Sekunde. Er wird schneller, bis er sie erreicht.', min: 30, max: 1200, step: 10, decimalPlaces: 0, suffix: 'px/s', default: 600 },
            once: { type: 'bool', label: 'fällt nur einmal', hint: 'Ist das eingeschaltet, bleibt er nach dem Aufprall liegen – wie ein Felsbrocken, der den Weg versperrt.', default: false },
            wait: { label: 'wartet unten', hint: 'So lange bleibt er nach dem Aufprall unten.', min: 0, max: 20, step: 0.1, decimalPlaces: 1, suffix: 's', default: 1.0 },
            rise: { label: 'Tempo nach oben', hint: 'So viele Pixel pro Sekunde hebt er sich wieder.', min: 1, max: 1000, step: 1, decimalPlaces: 0, suffix: 'px/s', default: 40 },
            rest: { label: 'Pause oben', hint: 'So lange wartet er oben, bevor er wieder fallen kann.', min: 0, max: 20, step: 0.1, decimalPlaces: 1, suffix: 's', default: 0.5 },
        },
    },
};
const BADDIE_BEHAVIOR_ORDER = ['guard', 'still', 'hunter', 'coward', 'lurker', 'hopper', 'flutter', 'stomper'];

// Which classic enemy settings each behaviour uses (the editor hides the rest).
const BEHAVIORS_WITH_PATROL = new Set(['guard', 'hunter', 'coward', 'flutter']);
const BEHAVIORS_WITH_SPEED = new Set(['guard', 'hunter', 'coward', 'lurker', 'hopper', 'flutter']);
const BEHAVIORS_WITH_JUMP = new Set(['guard', 'hunter', 'hopper']);
// walking enemies that may learn to take slopes, jump obstacles and gaps, drop down
const BEHAVIORS_WITH_MOVE = new Set(['guard', 'hunter', 'coward']);
// How far a chasing Jäger looks for a ladder to another floor (5 blocks).
const LADDER_REACH = 120;
const BEHAVIORS_WITH_GRAVITY_SWITCH = new Set(['guard', 'still']);

function baddie_behavior_type(traits) {
    const type = traits?.behavior?.type;
    if (type in BADDIE_BEHAVIORS) return type;
    return traits?.patrols === false ? 'still' : 'guard';
}

// Loading a game: an enemy without a behaviour gets the one it already acts
// like. Idempotent; returns true if something was added.
function promote_baddie_behavior(traits) {
    if (!traits || (traits.behavior && traits.behavior.type in BADDIE_BEHAVIORS)) return false;
    traits.behavior = { type: traits.patrols === false ? 'still' : 'guard' };
    return true;
}

// The editor switches the type: classic fields that the new type decides are set
// so that the classic patrol code does the right thing.
function set_baddie_behavior_type(traits, type) {
    if (!(type in BADDIE_BEHAVIORS)) return;
    if (type === traits.behavior?.type) return;
    traits.behavior = { type };
    if (type === 'still') traits.patrols = false;
    if (type === 'guard' || type === 'hunter' || type === 'coward' || type === 'flutter') traits.patrols = true;
}

function behavior_uses(traits, what) {
    const type = baddie_behavior_type(traits);
    return ({ patrol: BEHAVIORS_WITH_PATROL, speed: BEHAVIORS_WITH_SPEED, jump: BEHAVIORS_WITH_JUMP, move: BEHAVIORS_WITH_MOVE,
        gravity: BEHAVIORS_WITH_GRAVITY_SWITCH })[what]?.has(type) ?? true;
}

// Resolved settings with defaults, or null for games without a behaviour
// (those run the original code unchanged).
// smart: the sprite's "Intelligenz" trait (traits.js), if it has one.
function baddie_behavior(traits, smart = null) {
    const saved = traits?.behavior;
    if (!saved || typeof saved !== 'object' || !(saved.type in BADDIE_BEHAVIORS)) return null;
    const result = { type: saved.type };
    for (const [key, setting] of Object.entries(BADDIE_BEHAVIORS[saved.type].settings)) {
        if (setting.type === 'bool') { result[key] = typeof saved[key] === 'boolean' ? saved[key] : setting.default; continue; }
        const v = Number(saved[key]);
        result[key] = Number.isFinite(v) ? Math.min(setting.max, Math.max(setting.min, v)) : setting.default;
    }
    // "Intelligenz" (traits.js): optional abilities, all off in old games
    result.moves = baddie_moves(BEHAVIORS_WITH_MOVE.has(saved.type) ? smart : null);
    return result;
}

// What the "Intelligenz" trait allows. No trait (or an old game): nothing extra.
function baddie_moves(smart) {
    return {
        // the trait itself: a chasing Jäger then never jumps into an abyss
        smart: Boolean(smart) && typeof smart === 'object',
        slopes: smart?.walks_slopes === true, obstacles: smart?.jumps_obstacles === true,
        gaps: smart?.jumps_gaps === true, drop: smart?.drops_down === true, ladders: smart?.climbs_ladders === true,
    };
}

function behavior_uses_patrol(traits) {
    return BEHAVIORS_WITH_PATROL.has(baddie_behavior_type(traits));
}

const AI_TILE = 24;
const AI_VERTICAL_SIGHT = 36;      // px: roughly "on the same floor"

// Decide one simulation step. `mem` is the enemy's own memory (kept between
// steps), `w` describes what the enemy perceives:
//   now, on_ground, on_ladder, facing ('left'|'right'), x, y, x0, y0 (start position),
//   clearable(dir)  the wall ahead is low enough to jump over
//   safe_drop(dir)  below the ledge ahead there is ground (at most 5 blocks down)
//   ladder_up / ladder_down   a ladder to climb up from here / down from here
//   ladder_near(way, reach)  offset (px, ±) of the nearest ladder at this height that
//                   leads 'up' or 'down', at most `reach` away – or null
//   player: null | { dx, dy }   (player minus enemy, dy > 0 = player higher)
//   clear(dx)      no wall between the enemy and dx (line of sight)
//   wall(dir)      a wall directly ahead
//   ground(dir)    ground directly ahead (false = a ledge)
//   landing(dir)   ground where a hop in this direction would land
//   half_width     half the enemy's width
// Returns { patrol } to fall back to the classic patrol, or
//   { keys: { left, right, jump }, speed, alert, stun, dy, no_gravity, pose }.
// `pose`: an optional animation state – 'hunt' (chasing / charging), 'flee'
// (a coward running away or trembling in a corner), 'stunned'
// (after hitting a wall), 'landed' (a stomper at the bottom). Sprites without
// such a state keep their normal movement animation.
// `alert` means "just noticed the player"; the "!" is only drawn if the
// behaviour's optional `alert` setting is switched on.
function baddie_decide(b, mem, w) {
    const toward = dx => (dx < 0 ? 'left' : 'right');
    const away = dx => (dx < 0 ? 'right' : 'left');
    const walk = (dir, extra = {}) => ({ keys: { left: dir === 'left', right: dir === 'right', jump: false }, ...extra });
    const stand = (extra = {}) => ({ keys: { left: false, right: false, jump: false }, ...extra });
    const climb = (way, extra = {}) => ({ keys: { left: false, right: false, jump: false, up: way === 'up', down: way === 'down' }, ...extra });
    const p = w.player;

    if (b.type === 'guard' || b.type === 'still') return { patrol: true };

    if (b.type === 'hunter') {
        const in_front = p && (mem.mode === 'chase' || toward(p.dx) === w.facing || Math.abs(p.dx) < 4);
        const seen = p && in_front && Math.abs(p.dx) <= b.sight && Math.abs(p.dy) <= AI_VERTICAL_SIGHT * 2 && w.clear(p.dx);
        let alert = false;
        if (seen) {
            if (mem.mode !== 'chase') alert = true;
            mem.mode = 'chase';
            mem.last_seen = w.now;
        } else if (mem.mode === 'chase' && w.now - (mem.last_seen ?? 0) > b.forget) {
            mem.mode = 'idle';
        }
        if (mem.mode !== 'chase' || !p) return { patrol: true };
        if (!w.on_ground) return { keys: mem.air ?? stand().keys, speed: b.chase, pose: 'hunt' };
        const m = b.moves ?? {};
        // Leitern klettern: the player is on another floor – climb the ladder here,
        // or walk to one nearby (LADDER_REACH) that leads there.
        // Once on the way, he climbs to the end of the ladder (as long as the player
        // is still above or below) – stopping halfway would leave him stuck below the edge.
        let target = p.dx;
        if (m.ladders) {
            const way = mem.climbing ?? (Math.abs(p.dy) > 20 ? (p.dy > 0 ? 'up' : 'down') : null);
            const wanted = way === 'up' ? p.dy > 0 : way === 'down' ? p.dy < 0 : false;
            if (wanted && (way === 'up' ? w.ladder_up : w.ladder_down)) {
                mem.climbing = way;
                return climb(way, { alert, speed: b.chase, pose: 'hunt' });
            }
            mem.climbing = null;
            if (wanted && Math.abs(p.dy) > 20) {
                const ladder = w.ladder_near?.(way, LADDER_REACH);
                if (Number.isFinite(ladder)) target = ladder;
            }
        }
        if (Math.abs(target) < 4) return stand({ alert, speed: b.chase, pose: 'hunt' });
        const dir = toward(target);
        let out;
        // Hop over walls – but not from a ladder (ladders count as ground, he would climb it).
        if (w.wall(dir)) out = { keys: { left: dir === 'left', right: dir === 'right', jump: !w.on_ladder } };
        else if (!w.ground(dir)) {
            // At a ledge: after the player if he is below (with Intelligenz only onto
            // ground at most five blocks down), across a gap, or wait.
            if (p.dy <= -8 && (!m.smart || w.safe_drop?.(dir))) out = walk(dir);
            else if (m.gaps && w.landing(dir)) out = { keys: { left: dir === 'left', right: dir === 'right', jump: true } };
            else out = stand({ face: dir });
        } else out = walk(dir);
        mem.air = out.keys;
        return { ...out, alert, speed: b.chase, pose: 'hunt' };
    }

    if (b.type === 'coward') {
        const scared = p && Math.abs(p.dx) <= b.panic && Math.abs(p.dy) <= AI_VERTICAL_SIGHT * 2 && w.clear(p.dx);
        let alert = false;
        if (scared) {
            if (!(mem.scared_until > w.now)) alert = true;
            mem.scared_until = w.now + 1.0;
            mem.flee_dir = away(p.dx);
        }
        if (!(mem.scared_until > w.now)) return { patrol: true };
        const dir = mem.flee_dir;
        if (!w.on_ground) return { keys: mem.air ?? stand().keys, speed: b.flee, pose: 'flee' };
        // Cornered: stay and tremble (face the danger) – unless it has learned a way out.
        const m = b.moves ?? {};
        const hop = { keys: { left: dir === 'left', right: dir === 'right', jump: true } };
        let out;
        // Leitern klettern: every ladder on the way is an escape – but not towards the player.
        if (m.ladders && w.ladder_up && !(p && p.dy > 20)) out = climb('up');
        else if (m.ladders && w.ladder_down && !(p && p.dy < -20)) out = climb('down');
        else if (w.wall(dir)) out = m.obstacles && w.clearable?.(dir) ? hop : stand({ face: p ? toward(p.dx) : dir });
        else if (!w.ground(dir)) {
            if (m.gaps && w.landing(dir)) out = hop;
            else if (m.drop && w.safe_drop?.(dir)) out = walk(dir);
            else out = stand({ face: p ? toward(p.dx) : dir });
        } else out = walk(dir);
        mem.air = out.keys;
        return { ...out, alert, speed: b.flee, pose: 'flee' };
    }

    if (b.type === 'lurker') {
        mem.mode ??= 'wait';
        if (mem.mode === 'wait') {
            const seen = p && Math.abs(p.dx) <= b.sight && Math.abs(p.dy) <= AI_VERTICAL_SIGHT && w.clear(p.dx);
            if (!seen) return stand();
            mem.mode = 'windup'; mem.until = w.now + 0.35; mem.dir = toward(p.dx);
            return stand({ alert: true, face: mem.dir });
        }
        if (mem.mode === 'windup') {
            if (w.now < mem.until) return stand({ face: mem.dir });
            mem.mode = 'charge'; mem.until = w.now + 3.0;
        }
        if (mem.mode === 'charge') {
            if (!w.on_ground) return walk(mem.dir, { speed: b.charge, pose: 'hunt' });
            if (w.wall(mem.dir)) {
                mem.mode = 'rest'; mem.until = w.now + b.stun + 0.5; mem.stunned_until = w.now + b.stun;
                return stand({ stun: b.stun, pose: 'stunned' });
            }
            if (!w.ground(mem.dir) || w.now > mem.until) { mem.mode = 'rest'; mem.until = w.now + 0.8; return stand(); }
            return walk(mem.dir, { speed: b.charge, pose: 'hunt' });
        }
        if (w.now >= mem.until) mem.mode = 'wait';
        return stand(w.now < (mem.stunned_until ?? 0) ? { pose: 'stunned' } : {});
    }

    if (b.type === 'hopper') {
        mem.dir ??= w.facing;
        if (!w.on_ground) return { keys: mem.air ?? stand().keys };
        mem.next ??= w.now + b.interval * 0.5;
        if (w.now < mem.next || w.on_ladder) return stand();
        mem.next = w.now + b.interval;
        if (p && b.sight > 0 && Math.abs(p.dx) <= b.sight && Math.abs(p.dy) <= AI_VERTICAL_SIGHT * 3 && w.clear(p.dx))
            mem.dir = toward(p.dx);
        if (w.wall(mem.dir) || !w.landing(mem.dir)) mem.dir = mem.dir === 'left' ? 'right' : 'left';
        const go = !w.wall(mem.dir) && w.landing(mem.dir);
        mem.air = { left: go && mem.dir === 'left', right: go && mem.dir === 'right', jump: true };
        return { keys: mem.air, face: mem.dir };
    }

    if (b.type === 'flutter') {
        mem.t0 ??= w.now;
        const target = w.y0 + b.height * Math.sin((w.now - mem.t0) / b.period * 2 * Math.PI);
        return { patrol: true, dy: target - w.y };
    }

    if (b.type === 'stomper') {
        mem.mode ??= 'wait';
        const out = stand({ no_gravity: true, dy: 0 });
        if (mem.mode === 'wait') {
            if (p && p.dy < 0 && Math.abs(p.dx) <= b.trigger + (w.half_width ?? 0)) {
                mem.mode = 'shake'; mem.until = w.now + b.warn;
            }
            return out;
        }
        if (mem.mode === 'shake') {
            if (w.now >= mem.until) { mem.mode = 'drop'; mem.vy = 0; mem.blocked = false; }
            else return { ...out, jitter: true };
        }
        if (mem.mode === 'drop') {
            // mem.blocked: the engine stopped last step's fall (it hit the ground)
            if (mem.blocked) {
                mem.mode = b.once ? 'done' : 'bottom'; mem.until = w.now + b.wait;
                return { ...out, pose: 'landed' };
            }
            mem.vy = Math.max((mem.vy ?? 0) - 0.6, -b.fall / 60);
            return { ...out, dy: mem.vy };
        }
        if (mem.mode === 'done') return { ...out, pose: 'landed' };      // fällt nur einmal
        if (mem.mode === 'bottom') {
            if (w.now >= mem.until) mem.mode = 'rise';
            else return { ...out, pose: 'landed' };
        }
        if (mem.mode === 'rise') {
            const step = b.rise / 60;
            if (w.y + step >= w.y0) { mem.mode = 'cool'; mem.until = w.now + b.rest; return { ...out, dy: w.y0 - w.y }; }
            return { ...out, dy: step };
        }
        if (w.now >= mem.until) mem.mode = 'wait';
        return out;
    }
    return { patrol: true };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BADDIE_BEHAVIORS, BADDIE_BEHAVIOR_ORDER, BEHAVIORS_WITH_PATROL,
        baddie_behavior, baddie_behavior_type, behavior_uses_patrol, behavior_uses, baddie_decide, baddie_moves,
        promote_baddie_behavior, set_baddie_behavior_type,
    };
}
