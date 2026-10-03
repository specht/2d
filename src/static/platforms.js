// Bewegte Plattformen und Aufzüge: a sprite with the trait "bewegt sich"
// (traits.moving) travels between where it is placed and the end of its Weg.
//
// The drawing has the Geschwindigkeit (pixels per step, like a Förderband)
// and the Pause at the ends; each placed copy has its own Weg (path_x /
// path_y in pixels from where it stands, + right / up) and how it starts
// (start):
//   always  "immer hin und her": end, pause, back, pause, …
//   ride    "Aufzug": rests until the player steps on it, then goes to the
//           other end and stays while the player is still on it. Left alone
//           at the end it comes back after the Pause; stepping on again at
//           the end takes it back at once.
//   signal  "bei Signal" (signals.js): "an" sends it to the end, "aus" back.
// Absent placed values are the defaults, so a game never needs new JSON.
//
// What it does to others (MovingPlatforms.step, once per simulation step,
// before any character moves):
// - Whoever stands on it ("von oben", block_above) goes along – the player,
//   enemies and Begleiter. A rising platform also picks up a figure whose
//   feet it passes (a one-way platform coming up from below).
// - It never squashes anyone: a platform that would push a rider's head into
//   a ceiling, or a solid one (Seiten / unten) that would run into somebody,
//   waits until the way is free.
// - Riders are carried sideways like on a Förderband: a wall stops them,
//   the platform goes on.
// - Only the player starts an Aufzug: a Begleiter never acts on the level.
// The level's collision trees follow the platform, so everything that asks
// "what is here" (standing, walls, Druckplatten, Stacheln) sees it where it
// is drawn.

const PLATFORM_START_MODES = {
    always: 'immer hin und her',
    ride: 'wenn die Spielfigur draufsteht (Aufzug)',
    signal: 'bei Signal',
};

const PLATFORM = {
    SPEED: 1.0,            // pixels per step (60 per second); a figure walks with about 3
    PAUSE: 1.0,            // seconds at each end
    PATH_X: 96,            // default Weg: four blocks to the right
    PATH_Y: 0,
    RIDE_TOLERANCE: 1.0,   // feet this close to the top surface stand on it
};

function platform_number(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// What one placed copy does: drawn = traits.moving of its sprite, placed =
// its placed[3].moving (or the entry the game made of it).
function platform_settings(drawn, placed) {
    const path_x = platform_number(placed?.path_x, PLATFORM.PATH_X);
    const path_y = platform_number(placed?.path_y, PLATFORM.PATH_Y);
    const start = placed?.start in PLATFORM_START_MODES ? placed.start : 'always';
    return {
        speed: Math.max(0, platform_number(drawn?.speed, PLATFORM.SPEED)),
        pause: Math.max(0, platform_number(drawn?.pause, PLATFORM.PAUSE)),
        path_x, path_y, start,
        length: Math.hypot(path_x, path_y),
    };
}

// Where the copy is at the end of its Weg (for the level editor, too).
function platform_end(x, y, settings) {
    return { x: x + settings.path_x, y: y + settings.path_y };
}

// d: how far along the Weg (pixels), s = d / length: 0 at the start, 1 at
// the end; target: where it goes (0 or 1). Whole pixels per step stay exact.
function platform_new_state(settings) {
    return {
        d: 0,
        s: 0,
        // "immer hin und her" sets off at once; the others wait at the start
        target: settings.start === 'always' ? 1 : 0,
        wait_until: null,    // always: the pause at an end
        hold: false,         // ride: the player who came along is still on it
        empty_since: null,   // ride: left alone at the end since
        signal_on: false,    // signal: the last signal was "an"
    };
}

// One step of the platform's own plan. Returns a new state (the old one is
// untouched, so the game can keep it when the platform has to wait).
// input: { t (seconds), player_on (the player stands on it) }
function platform_plan(state, settings, input) {
    const next = { ...state };
    const t = input.t;
    const length = settings.length;
    if (!(length > 0) || !(settings.speed > 0)) return next;
    const resting = next.s === next.target;
    if (settings.start === 'signal') {
        next.target = next.signal_on ? 1 : 0;
    } else if (settings.start === 'ride') {
        if (resting && !input.player_on) next.hold = false;
        if (input.player_on && !next.hold) {
            // stepped on: off to the other end – also onto one that is just
            // coming back by itself (a jump while riding changes nothing)
            if (resting) next.target = 1 - next.target;
            else if (next.target === 0) next.target = 1;
            next.hold = true;
            next.empty_since = null;
        } else if (resting) {
            if (next.s === 1 && !input.player_on) {
                // alone at the end: back to the start after the pause
                if (next.empty_since === null) next.empty_since = t;
                if (t - next.empty_since >= settings.pause) {
                    next.target = 0;
                    next.empty_since = null;
                }
            }
        }
    } else if (resting) {
        if (next.wait_until === null) next.wait_until = t + settings.pause;
        if (t >= next.wait_until) {
            next.target = 1 - next.target;
            next.wait_until = null;
        }
    }
    if (next.s !== next.target) {
        const goal = next.target * length;
        next.d = goal > next.d ? Math.min(goal, next.d + settings.speed) : Math.max(goal, next.d - settings.speed);
        next.s = next.d === goal ? next.target : next.d / length;
        if (next.s === next.target) {
            // arrived: whoever came along stays until they step off
            next.hold = Boolean(input.player_on);
            next.wait_until = null;
        }
    }
    return next;
}

// ------------------------------------------------------------ in the game
const MovingPlatforms = (() => {
    const rect_of = (x, y, sprite) => ({ x0: x - sprite.width / 2, x1: x + sprite.width / 2, y0: y, y1: y + sprite.height });

    function box_of(c) {
        const x = c.mesh.position.x, y = c.mesh.position.y;
        const w = c.sprite.width / 2, ex = c.traits ?? {};
        return { x0: x - w * (ex.ex_left ?? 1), x1: x + w * (ex.ex_right ?? 1), y0: y, y1: y + c.sprite.height * (ex.ex_top ?? 1) };
    }

    const overlaps = (a, b) => a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.y0 < b.y1 - 0.01 && b.y0 < a.y1 - 0.01;

    // Every figure a platform can carry or run into: the player, enemies and
    // Begleiter that are there (not on a layer a signal took away). Flyers
    // (no gravity) are never carried.
    function characters(game) {
        const list = [];
        const pc = game.player_character;
        if (pc?.mesh) list.push(pc);
        for (const c of [...(game.baddies ?? []), ...(game.companions ?? [])])
            if (c?.mesh && c.active !== false && !c.signal_hidden) list.push(c);
        return list;
    }

    // also stands on something that does not move (like standing_on_block_top):
    // a platform level with the ground slides away under the figure's feet –
    // a bridge coming out of a cliff does not take along who stands on the cliff
    function on_fixed_ground(game, c) {
        const x = c.mesh.position.x, y = c.mesh.position.y;
        const ids_x = new Set(game.interval_tree_x.search([x - 0.5, x + 0.5]));
        for (const i of game.interval_tree_y.search([y - 0.5, y - 0.01])) {
            const entry = game.active_level_sprites[i];
            if (!ids_x.has(i) || !entry || entry.platform || entry.signal_hidden) continue;
            const sprite = game.data.sprites[entry.sprite_index];
            const carries = 'block_above' in sprite.traits || ('door' in sprite.traits && entry.door_closed);
            if (carries && y >= entry.mesh.position.y + sprite.height - 1.0) return true;
        }
        return false;
    }

    // stands on the top surface (the middle of its feet over the platform)
    function stands_on(game, c, rect) {
        if (c.ai_no_gravity || (c.vy ?? 0) > 0.01) return false;
        const x = c.mesh.position.x, y = c.mesh.position.y;
        return x >= rect.x0 - 0.5 && x <= rect.x1 + 0.5 && Math.abs(y - rect.y1) <= PLATFORM.RIDE_TOLERANCE &&
            !on_fixed_ground(game, c);
    }

    // a rising platform passes the feet of somebody standing or falling
    function picked_up(c, rect, rise) {
        if (c.ai_no_gravity || (c.vy ?? 0) > 0.01) return false;
        const x = c.mesh.position.x, y = c.mesh.position.y;
        return x >= rect.x0 - 0.5 && x <= rect.x1 + 0.5 && y >= rect.y1 - PLATFORM.RIDE_TOLERANCE && y <= rect.y1 + rise;
    }

    function setup(game) {
        const platforms = [];
        (game.active_level_sprites ?? []).forEach((entry, entry_index) => {
            const sprite = game.data.sprites[entry.sprite_index];
            if (!('moving' in (sprite?.traits ?? {}))) return;
            const settings = platform_settings(sprite.traits.moving, {
                path_x: entry.path_x, path_y: entry.path_y, start: entry.platform_start });
            if (!(settings.length > 0) || !(settings.speed > 0)) return;
            const platform = { entry_index, settings, state: platform_new_state(settings),
                x0: entry.mesh.position.x, y0: entry.mesh.position.y,
                // what happened, for the recipes' checks (rezepte/tools/record.mjs)
                waiting: false, waited: 0, travelled: 0, player_ridden: 0 };
            entry.platform = platform;
            platforms.push(platform);
        });
        return platforms;
    }

    // "bei Signal": what the bus calls (signals.js)
    function signal(platform, value) {
        platform.state.signal_on = Boolean(value);
    }

    function move_entry(game, entry_index, sprite, x, y) {
        const entry = game.active_level_sprites[entry_index];
        const old = rect_of(entry.mesh.position.x, entry.mesh.position.y, sprite);
        const now = rect_of(x, y, sprite);
        game.interval_tree_x.remove([old.x0, old.x1], entry_index);
        game.interval_tree_y.remove([old.y0, old.y1], entry_index);
        game.interval_tree_x.insert([now.x0, now.x1], entry_index);
        game.interval_tree_y.insert([now.y0, now.y1], entry_index);
        const dx = x - entry.mesh.position.x, dy = y - entry.mesh.position.y;
        entry.mesh.position.x = x;
        entry.mesh.position.y = y;
        // the "F" above a door or sign goes along
        if (entry.overlay_mesh) {
            entry.overlay_mesh.position.x += dx;
            entry.overlay_mesh.position.y += dy;
        }
    }

    function step_one(game, platform, t) {
        const entry = game.active_level_sprites[platform.entry_index];
        // away (a signal took its layer), falling down, or collected: it rests
        if (!entry || entry.signal_hidden || game.falling_sprite_indices?.[platform.entry_index] ||
            game.transitioning_sprites?.pickup?.[platform.entry_index]) return;
        const sprite = game.data.sprites[entry.sprite_index];
        const traits = sprite.traits;
        const carries = 'block_above' in traits;
        const solid = 'block_sides' in traits || 'block_below' in traits;
        const here = rect_of(entry.mesh.position.x, entry.mesh.position.y, sprite);
        const everyone = characters(game);
        const on_top = carries ? everyone.filter(c => stands_on(game, c, here)) : [];
        const player_on = on_top.includes(game.player_character);
        const next = platform_plan(platform.state, platform.settings, { t, player_on });
        const x = platform.x0 + platform.settings.path_x * next.d / platform.settings.length;
        const y = platform.y0 + platform.settings.path_y * next.d / platform.settings.length;
        const dx = x - entry.mesh.position.x, dy = y - entry.mesh.position.y;
        if (dx === 0 && dy === 0) {
            platform.state = next;
            platform.waiting = false;
            return;
        }
        const there = rect_of(x, y, sprite);
        const riders = carries ? everyone.filter(c => on_top.includes(c) || (dy > 0 && picked_up(c, here, dy))) : [];
        // a solid platform does not run into anybody (who is not riding it)
        const wait = () => { platform.waiting = true; platform.waited++; };
        if (solid && everyone.some(c => !riders.includes(c) && overlaps(box_of(c), there) && !overlaps(box_of(c), here)))
            return wait();
        // nobody's head is pushed into a ceiling
        if (dy > 0) {
            for (const c of riders) {
                const lift = there.y1 - c.mesh.position.y;
                const top = c.sprite.height * (c.traits?.ex_top ?? 1);
                if (lift > 0 && c.intersect_y_with_trait(lift, ['block_below'], -0.5, 0.5, top + 0.1, top + lift + 0.1) < lift - 0.01)
                    return wait();
            }
        }
        move_entry(game, platform.entry_index, sprite, x, y);
        platform.state = next;
        platform.waiting = false;
        const way = Math.hypot(dx, dy);
        platform.travelled += way;
        for (const c of riders) {
            if (dx !== 0) c.try_move_x(dx);
            const drop = there.y1 - c.mesh.position.y;
            if (drop > 0) c.mesh.position.y += drop;
            // going down: the rider stays on whatever else is below
            else if (drop < 0) c.mesh.position.y += c.intersect_y_with_trait(drop, ['block_above', 'slope'], -0.5, 0.5, drop, 0);
            if (c === game.player_character) platform.player_ridden += way;
        }
    }

    // once per simulation step, before the characters move
    function step(game, t) {
        for (const platform of game.moving_platforms ?? []) step_one(game, platform, t);
    }

    return { setup, step, signal, characters, stands_on };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PLATFORM, PLATFORM_START_MODES, platform_settings, platform_end, platform_new_state, platform_plan, MovingPlatforms };
}
