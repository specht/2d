// Begleiter (companions): a character the game controls that tries to stay
// with the player character – with its own way of moving.
//
//   traits.companion = { vrun, can_fly, can_jump, vjump, can_swim }
//
// "Begleiter" says that it follows the player; the movement settings say how
// it can follow. A companion never takes over the player's abilities: a weak
// jumper stays below a ledge the player jumped onto, a walker that cannot swim
// waits at the shore. That is intended – it gives the companion character.
// Only when it has really lost the player (far away, out of sight and no
// progress for a while) does the game help: a little later it comes back from
// just outside the screen ("Oh, da bist du ja!") instead of being stranded.
//
// A companion is not an enemy: it lives in game.companions, never in
// game.baddies, so combat, contact damage, "alle Gegner besiegt", drops and
// enemy signals never see it. It has no health and collects nothing.
//
// This file holds the decisions only (pure functions, tested in
// test/companion_ai.test.cjs). Walking, jumping, gravity, slopes,
// Bewegungsbereiche and animation are the same Character code in app.js that
// moves the player and the enemies.

const COMPANION = {
    // following on foot (px between the centres, sideways): stop when closer
    // than STOP, start again when farther than FOLLOW – in between it keeps
    // doing what it did, so it does not jitter between walking and standing
    STOP: 28,
    FOLLOW: 52,
    // farther than this it runs faster to catch up
    SPRINT: 96,
    SPRINT_SPEED: 1.35,
    // several Begleiter line up: each one more stays this much farther back
    // (walkers and flyers counted separately – Game.setup gives the slots)
    SLOT_SPACING: 22,
    // a flyer stays a little behind and above the player, not on top of it
    FLY_SIDE: 30,
    FLY_ABOVE: 22,
    FLY_STOP: 8,
    FLY_FOLLOW: 30,
    // lost: farther than LOST_FAR, out of sight, and no PROGRESS (px closer)
    // for STUCK_SECONDS; it comes back RETURN_DELAY seconds after that
    LOST_FAR: 144,
    PROGRESS: 24,
    STUCK_SECONDS: 4,
    RETURN_DELAY: 2,
    // how many steps the jump key is held (a short press, like the player's)
    JUMP_HOLD_STEPS: 6,
};

// The settings of a companion with their defaults (absent fields as in a new
// trait). Pure, never changes the traits.
function companion_abilities(traits) {
    const t = traits ?? {};
    const number = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
    const fly = t.can_fly === true;
    return {
        fly,
        // a flyer needs no jumps; it swims in no water either – it flies over it
        jump: !fly && t.can_jump !== false,
        swim: !fly && t.can_swim === true,
        vrun: Math.max(0, number(t.vrun, 3.0)),
        vjump: Math.max(0, number(t.vjump, 6.0)),
    };
}

// Following with hysteresis: is it (still) on its way to the player?
function companion_keeps_following(moving, distance, stop = COMPANION.STOP, follow = COMPANION.FOLLOW) {
    if (distance > follow) return true;
    if (distance < stop) return false;
    return Boolean(moving);
}

// How high a jump with this strength goes (px): the engine adds vy every step
// and takes gravity off it, until vy is no longer positive.
function companion_jump_height(vjump, gravity) {
    const g = gravity > 0 ? gravity : 0.5;
    let h = 0;
    for (let v = vjump; v > 0; v -= g) h += v;
    return h;
}

// One simulation step: which virtual keys the companion presses.
// a: companion_abilities(); mem: its own memory (kept between steps);
// w: what it perceives –
//   now, on_ground, fluid ('swim' | 'float' | null), near_surface
//   slot            0 for the first Begleiter (of its kind), 1 for the next …
//   player: null | { dx, dy, facing }   (player minus companion; dy > 0 = higher)
//   wall(dir)       a wall directly ahead
//   clearable(dir)  that wall is lower than its own jump
//   ground(dir)     ground directly ahead (false = a ledge)
//   landing(dir)    ground where its own jump in this direction would land
//   safe_drop(dir)  ground below the ledge ahead (at most five blocks down)
//   water(dir)      water ahead (a Bewegungsbereich "Schwimmen")
// Returns { keys: { left, right, jump, up, down }, speed, dy, no_gravity, face }.
function companion_decide(a, mem, w) {
    const toward = dx => (dx < 0 ? 'left' : 'right');
    const keys = (dir, extra = {}) => ({ left: dir === 'left', right: dir === 'right', jump: false, up: false, down: false, ...extra });
    const stand = (extra = {}) => ({ keys: keys(null), speed: 1, dy: 0, no_gravity: a.fly, face: null, ...extra });
    const p = w.player;
    if (!p) { mem.moving = false; return stand(); }
    // the second, third … Begleiter keep a place farther back
    const extra = (w.slot ?? 0) * COMPANION.SLOT_SPACING;

    // ---- flying: through the air to a spot behind and above the player
    if (a.fly) {
        const behind = p.facing === 'left' ? -1 : 1;
        const tx = p.dx - behind * (COMPANION.FLY_SIDE + extra);
        const ty = p.dy + COMPANION.FLY_ABOVE + ((w.slot ?? 0) % 2) * 10;
        const distance = Math.hypot(tx, ty);
        mem.moving = companion_keeps_following(mem.moving, distance, COMPANION.FLY_STOP, COMPANION.FLY_FOLLOW);
        const speed = distance > COMPANION.SPRINT ? COMPANION.SPRINT_SPEED : 1;
        if (!mem.moving) {
            // hovering: a gentle bob, facing the player
            const bob = Math.sin((w.now ?? 0) * Math.PI * 1.6) * 0.25;
            return stand({ dy: bob, face: toward(p.dx) });
        }
        const step = a.vrun * speed;
        const dir = Math.abs(tx) > 2 ? toward(tx) : null;
        const dy = Math.max(-step, Math.min(step, ty));
        return { keys: keys(dir), speed, dy, no_gravity: true, face: dir ? null : toward(p.dx) };
    }

    const distance = Math.abs(p.dx);
    const speed = Math.hypot(p.dx, p.dy) > COMPANION.SPRINT ? COMPANION.SPRINT_SPEED : 1;

    // ---- in the water (only a swimmer gets here) or floating in space:
    // straight towards the player in all four directions
    if (w.fluid) {
        const near = Math.hypot(p.dx, p.dy) < COMPANION.STOP + extra;
        mem.moving = companion_keeps_following(mem.moving, Math.hypot(p.dx, p.dy), COMPANION.STOP + extra, COMPANION.FOLLOW + extra);
        if (near || !mem.moving) return stand({ face: toward(p.dx) });
        // at the surface and the player is higher (on land): leap out with a swim
        // stroke – as high as its own Sprungkraft carries it
        let jump = false;
        if (w.fluid === 'swim' && w.near_surface && p.dy > 8) {
            mem.stroke = !mem.stroke;
            jump = mem.stroke;
        }
        const swim = { left: p.dx < -4, right: p.dx > 4, up: p.dy > 6, down: p.dy < -6, jump };
        // leaping out of the water it keeps heading for the player (the air keys)
        mem.air = { left: swim.left, right: swim.right, jump: false, up: false, down: false };
        mem.air_speed = speed;
        return { keys: swim, speed, dy: 0, no_gravity: false, face: null };
    }

    // ---- in the air: the same keys as when it took off, the jump key only briefly
    if (!w.on_ground) {
        const held = mem.air ?? keys(null);
        if (held.jump) {
            mem.jump_hold = (mem.jump_hold ?? 0) - 1;
            if (mem.jump_hold <= 0) held.jump = false;
        }
        // a jump never carries it into the player or past it
        if ((held.right && p.dx < COMPANION.STOP + extra) || (held.left && p.dx > -COMPANION.STOP - extra)) {
            held.left = false;
            held.right = false;
        }
        return { keys: held, speed: mem.air_speed ?? speed, dy: 0, no_gravity: false, face: null };
    }

    // ---- on the ground
    mem.moving = companion_keeps_following(mem.moving, distance, COMPANION.STOP + extra, COMPANION.FOLLOW + extra);
    if (!mem.moving) {
        mem.air = null;
        return stand({ face: toward(p.dx) });
    }
    const dir = toward(p.dx);
    let out;
    if (w.wall(dir)) {
        // a wall: jump over it – only if its own jump is high enough
        out = a.jump && w.clearable(dir) ? keys(dir, { jump: true }) : null;
    } else if (!a.swim && w.water?.(dir)) {
        // it cannot swim: it waits at the shore
        out = null;
    } else if (!w.ground(dir)) {
        // a ledge: down after the player, across a gap its jump can make, or wait
        if (p.dy <= -8 && w.safe_drop(dir)) out = keys(dir);
        else if (a.jump && w.landing(dir, speed)) out = keys(dir, { jump: true });
        else out = null;
    } else {
        out = keys(dir);
    }
    if (!out) {
        mem.air = null;
        return stand({ face: dir, waiting: true });
    }
    mem.air = { ...out };
    mem.air_speed = speed;
    mem.jump_hold = out.jump ? COMPANION.JUMP_HOLD_STEPS : 0;
    return { keys: out, speed, dy: 0, no_gravity: false, face: null };
}

// Has the companion lost the player? One step of a small state machine:
// 'following' → 'lost' (far, out of sight, no progress for STUCK_SECONDS) →
// 'return' (RETURN_DELAY later: the game puts it back near the player).
// Seen again, or close again, it simply follows on. Being far away alone is
// never enough – a companion that is on its way (getting closer) or that can
// still be seen is not lost.
// w: { now, distance, visible, busy (in the air), fell_out (below the level) }
function companion_lost_step(mem, w) {
    const reset = () => { mem.best = w.distance; mem.best_at = w.now; };
    if (w.fell_out && mem.state !== 'lost') { mem.state = 'lost'; mem.lost_at = w.now; }
    if (mem.state === 'lost') {
        if (!w.fell_out && (w.visible || w.distance <= COMPANION.LOST_FAR)) {
            mem.state = 'following';
            reset();
            return 'following';
        }
        return w.now - mem.lost_at >= COMPANION.RETURN_DELAY ? 'return' : 'lost';
    }
    mem.state = 'following';
    const far = w.distance > COMPANION.LOST_FAR && !w.visible;
    if (!far || mem.best === undefined) { reset(); return 'following'; }
    if (w.distance < mem.best - COMPANION.PROGRESS) { reset(); return 'following'; }
    if (!w.busy && w.now - mem.best_at >= COMPANION.STUCK_SECONDS) {
        mem.state = 'lost';
        mem.lost_at = w.now;
        return 'lost';
    }
    return 'following';
}

// After coming back: it starts over as a follower.
function companion_returned(mem, now, distance) {
    mem.state = 'following';
    mem.best = distance;
    mem.best_at = now;
    mem.lost_at = undefined;
    mem.air = null;
    mem.moving = true;
}

// Where a lost companion may come back: x positions just outside the visible
// area, first on the side behind the player (it runs in after the player),
// then ahead of it. view: { left, right } of the screen in the world, margin:
// how far outside (about the companion's width).
function companion_return_xs(view, player_x, behind, margin, steps = 6, spacing = 12) {
    const side = (s, k) => s === 'left' ? view.left - margin - k * spacing : view.right + margin + k * spacing;
    const ahead = behind === 'left' ? 'right' : 'left';
    const xs = [];
    for (const s of [behind, ahead])
        for (let k = 0; k < steps; k++) xs.push(side(s, k));
    return xs;
}

// The best of the places found: as close to the player's height as possible,
// then in the order of companion_return_xs. spots: [{ x, y, order }].
function companion_pick_spot(spots, player_y) {
    if (!spots.length) return null;
    return [...spots].sort((a, b) => {
        const da = Math.round(Math.abs(a.y - player_y) / 12), db = Math.round(Math.abs(b.y - player_y) / 12);
        return da - db || a.order - b.order;
    })[0];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        COMPANION, companion_abilities, companion_keeps_following, companion_jump_height, companion_decide,
        companion_lost_step, companion_returned, companion_return_xs, companion_pick_spot,
    };
}
