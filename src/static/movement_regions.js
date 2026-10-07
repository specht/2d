// Bewegungsbereiche: where the player character (and every walking enemy) moves differently – in a layer
// of type 'movement_region' (rectangles, like Sichtbarkeitsbereiche) or in the
// whole level (level.properties.movement). Absent everywhere in old games: then
// nothing changes.
//
// Saved as { mode, gravity, glide, speed, stroke, current: { speed, angle }, direction }:
//   mode     normal  walking and jumping as usual (only gravity and the current
//                    may differ – a moon crater, a strong wind)
//            swim    Schwimmen: buoyancy, drag, the arrow keys steer in all four
//                    directions, the jump key is a swim stroke
//            float   Schweben: no gravity, the figure glides on (space)
//            inherit "wie darunter": only adds its current – a Sog or a
//                    Strömung on top of the water below
//   gravity  percent of the game's gravity
//   glide    percent: how long the figure keeps drifting (0 = stops at once)
//   speed    × the figure's own speed
//   stroke   × the jump strength: a swim stroke with the jump key (swim only)
//   current  a push in one direction: speed in px/s, angle in degrees
//            (0 = right, 90 = up, 180 = left, 270 = down)
//   direction where gravity pulls: 'left', 'up' or 'right' (absent = down,
//            as always). The figure turns with it: its floor is where gravity
//            pulls, the camera turns along with the player (app.js
//            Character gravity_k). Slopes and ladders only work with gravity
//            pulling down; in a turned gravity a slope is a block.
//   turn_seconds  how long the turn into this region's gravity takes on the
//            screen (absent = 2 s; 0 = at once, at most 5 s). Gravity itself changes
//            halfway through the turn. Turning back out of the region takes
//            as long as turning in.
//   camera   (with a direction) what the camera does: absent = it turns
//            with the player, so the player stays upright on the screen;
//            'fixed' = it stays as it is, and the arrow keys mean the
//            screen's directions (on the right wall "up" walks up it);
//            'fixed_figure' = it stays as it is, and the arrow keys mean the
//            figure's own directions (on the ceiling "right" walks to the
//            left of the screen).
// The frontmost region that contains the centre of the figure decides the mode
// and its settings; the currents of all regions there add up. A region whose
// layer a Signal has taken away (layer properties signal_code /
// signal_reaction, like any layer) does not count.
const MovementRegions = (() => {
    const MODES = ['normal', 'swim', 'float', 'inherit'];
    const DEFAULTS = {
        normal: { gravity: 100, glide: 0, speed: 1, stroke: 0 },
        swim: { gravity: 20, glide: 90, speed: 0.8, stroke: 0.6 },
        float: { gravity: 0, glide: 97, speed: 0.7, stroke: 0 },
    };
    const LIMITS = { gravity: [0, 300], glide: [0, 99], speed: [0.1, 5], stroke: [0, 3] };
    // where gravity pulls; the index is the number of quarter turns (counter-clockwise)
    const DIRECTIONS = ['down', 'right', 'up', 'left'];
    // how long a turn takes on the screen (s): the figure and the camera turn
    // together; gravity changes halfway (absent turn_seconds = this)
    const TURN_SECONDS = 2;
    const TURN_LIMITS = [0, 5];
    const CAMERA_MODES = ['turn', 'fixed', 'fixed_figure'];

    const number = (value, [lo, hi], fallback) =>
        typeof value === 'number' && Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : fallback;

    function valid_rect(rect) {
        return rect && ['left', 'bottom', 'width', 'height'].every(key =>
            typeof rect[key] === 'number' && Number.isFinite(rect[key])) &&
            rect.width > 0 && rect.height > 0;
    }

    // One region's settings with defaults filled in; the current in px per frame.
    function settings(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const mode = MODES.includes(raw.mode) ? raw.mode : 'swim';
        const out = { mode };
        if (mode !== 'inherit') {
            for (const key of Object.keys(LIMITS))
                out[key] = number(raw[key], LIMITS[key], DEFAULTS[mode][key]);
        }
        // a turned gravity (absent or unknown: down, as always)
        const k = direction_k(raw.direction);
        if (k && mode !== 'inherit') out.direction = k;
        if (mode !== 'inherit') out.turn_seconds = number(raw.turn_seconds, TURN_LIMITS, TURN_SECONDS);
        // the camera with a turned gravity (absent or unknown: it turns along)
        if (out.direction && CAMERA_MODES.includes(raw.camera) && raw.camera !== 'turn') out.camera = raw.camera;
        const speed = number(raw.current?.speed, [0, 1200], 0);
        const angle = number(raw.current?.angle, [-360, 720], 0) * Math.PI / 180;
        out.current = speed > 0 ? { x: Math.cos(angle) * speed / 60, y: Math.sin(angle) * speed / 60 } : { x: 0, y: 0 };
        return out;
    }

    // The level's regions, back to front (the saved layer list is front first).
    function resolve(level) {
        let base = settings(level?.properties?.movement);
        // the whole level "wie darunter": normal movement with that current
        if (base?.mode === 'inherit') base = { ...settings({ mode: 'normal' }), current: base.current };
        const regions = [];
        const layers = Array.isArray(level?.layers) ? level.layers : [];
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            // (the eye in the layer list only hides a layer in the editor, as for every layer)
            if (layer?.type !== 'movement_region') continue;
            const rects = Array.isArray(layer.rects) ? layer.rects.filter(valid_rect) : [];
            const s = settings(layer.movement ?? {});
            if (rects.length && s) regions.push({ rects, settings: s, layer_index: i });
        }
        // anything that turns gravity (else the figures never ask: app.js)
        const turns = Boolean(base?.direction) || regions.some(region => region.settings.direction);
        return { base, regions, turns };
    }

    const inside = (rect, x, y) => x >= rect.left && x <= rect.left + rect.width &&
        y >= rect.bottom && y <= rect.bottom + rect.height;

    // What applies at (x, y) – the figure's centre. null: move as always.
    // hidden: the indices of layers a Signal has taken away (a Set), or null.
    function at(resolved, x, y, hidden = null) {
        if (!resolved || (!resolved.base && !resolved.regions?.length)) return null;
        let effective = resolved.base ? { ...resolved.base, surface: Infinity } : null;
        let cx = resolved.base?.current.x ?? 0, cy = resolved.base?.current.y ?? 0;
        for (const region of resolved.regions) {
            if (hidden?.has?.(region.layer_index)) continue;
            const hits = region.rects.filter(rect => inside(rect, x, y));
            if (!hits.length) continue;
            const s = region.settings;
            cx += s.current.x;
            cy += s.current.y;
            if (s.mode === 'inherit') continue;
            // the water's surface: the top of the rectangle the figure is in
            effective = { ...s, surface: Math.max(...hits.map(rect => rect.bottom + rect.height)) };
        }
        if (!effective) {
            if (cx === 0 && cy === 0) return null;
            effective = { ...settings({ mode: 'normal' }), surface: Infinity };
        }
        effective.current = { x: cx, y: cy };
        if (effective.mode === 'normal' && effective.gravity === 100 && cx === 0 && cy === 0 && !effective.direction) return null;
        return effective;
    }

    // ---------------------------------------------------- turned gravity
    // k: quarter turns (0 down, 1 right, 2 up, 3 left). A figure's own
    // coordinates: x along its floor, y up from its feet. Turning by quarter
    // turns keeps every rectangle a rectangle – the collision trees, tiles and
    // hitboxes stay as they are.
    function direction_k(value) {
        const k = DIRECTIONS.indexOf(value);
        return k > 0 ? k : 0;
    }

    // the figure's own coordinates (or a vector) → the world's
    function to_world(k, x, y) {
        switch (k & 3) {
            case 1: return [-y, x];
            case 2: return [-x, -y];
            case 3: return [y, -x];
            default: return [x, y];
        }
    }

    function to_local(k, x, y) {
        return to_world((4 - (k & 3)) & 3, x, y);
    }

    // a rectangle [x0, x1, y0, y1] in the figure's coordinates → the world's (and back)
    function box_to_world(k, x0, x1, y0, y1) {
        const [ax, ay] = to_world(k, x0, y0), [bx, by] = to_world(k, x1, y1);
        return [Math.min(ax, bx), Math.max(ax, bx), Math.min(ay, by), Math.max(ay, by)];
    }

    function box_to_local(k, x0, x1, y0, y1) {
        return box_to_world((4 - (k & 3)) & 3, x0, x1, y0, y1);
    }

    // Which sides of a block stop the figure, in its own directions: up is the
    // side it stands on ("von oben"), down the one it bumps its head on ("von
    // unten"), left and right are walls ("von der Seite"). A slope is a block
    // to a turned figure.
    function local_faces(traits, k) {
        const t = traits ?? {};
        const solid = 'slope' in t;
        const world = { up: solid || 'block_above' in t, down: solid || 'block_below' in t,
            left: solid || 'block_sides' in t, right: solid || 'block_sides' in t };
        const side = (lx, ly) => {
            const [wx, wy] = to_world(k, lx, ly);
            return wx > 0 ? 'right' : wx < 0 ? 'left' : wy > 0 ? 'up' : 'down';
        };
        return { up: world[side(0, 1)], down: world[side(0, -1)], left: world[side(-1, 0)], right: world[side(1, 0)] };
    }

    // The angle (radians) from one direction to another: the short way round,
    // half a turn counter-clockwise.
    function turn_delta(from_k, to_k) {
        const d = ((to_k - from_k) % 4 + 4) % 4;
        return (d === 3 ? -1 : d) * Math.PI / 2;
    }

    // One simulation step (1/60 s) in the water or in space – velocities in px
    // per frame. input: { x, y } in -1 … 1 (arrow keys), stroke: the jump key was
    // just pressed. env: { vrun, vjump, gravity } of the figure and the game,
    // near_surface: the figure is just below the surface.
    function fluid_step(v, input, p, env) {
        const response = Math.max(0.01, 1 - p.glide / 100);
        const vmax = env.vrun * p.speed;
        // two arrow keys at once swim diagonally – at the same top speed as
        // straight ahead, not √2 times faster
        const ix = input.x || 0, iy = input.y || 0;
        const len = Math.max(1, Math.hypot(ix, iy));
        const tx = ix / len * vmax + p.current.x;
        const ty = iy / len * vmax + p.current.y;
        let vx = v.vx + (tx - v.vx) * response;
        let vy = v.vy + (ty - v.vy) * response;
        vy -= env.gravity * p.gravity / 100;
        // water brakes hard what comes in fast – a jump into the water ends in
        // a splash, not on the sea floor (space does not brake)
        if (p.mode === 'swim') {
            const fast = Math.max(vmax, 1) * 1.5;
            if (Math.abs(vx) > fast) vx *= 0.8;
            if (Math.abs(vy) > fast) vy *= 0.8;
        }
        if (input.stroke && p.mode === 'swim' && p.stroke > 0) {
            // at the surface a stroke leaps out of the water, like a jump
            if (env.near_surface) vy = Math.max(vy, env.vjump);
            else vy = Math.max(vy, 0) + env.vjump * p.stroke;
        }
        vx = Math.max(-10, Math.min(10, vx));
        vy = Math.max(-10, Math.min(10, vy));
        return { vx, vy };
    }

    return { MODES, DEFAULTS, DIRECTIONS, TURN_SECONDS, TURN_LIMITS, CAMERA_MODES, settings, resolve, at, fluid_step, valid_rect,
        direction_k, to_world, to_local, box_to_world, box_to_local, local_faces, turn_delta };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MovementRegions;
