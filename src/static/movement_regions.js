// Bewegungsbereiche: where the player character (and every walking enemy) moves differently – in a layer
// of type 'movement_region' (rectangles, like Sichtbarkeitsbereiche) or in the
// whole level (level.properties.movement). Absent everywhere in old games: then
// nothing changes.
//
// Saved as { mode, gravity, glide, speed, stroke, current: { speed, angle } }:
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
// The frontmost region that contains the centre of the figure decides the mode
// and its settings; the currents of all regions there add up.
const MovementRegions = (() => {
    const MODES = ['normal', 'swim', 'float', 'inherit'];
    const DEFAULTS = {
        normal: { gravity: 100, glide: 0, speed: 1, stroke: 0 },
        swim: { gravity: 20, glide: 90, speed: 0.8, stroke: 0.6 },
        float: { gravity: 0, glide: 97, speed: 0.7, stroke: 0 },
    };
    const LIMITS = { gravity: [0, 300], glide: [0, 99], speed: [0.1, 5], stroke: [0, 3] };

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
            if (rects.length && s) regions.push({ rects, settings: s });
        }
        return { base, regions };
    }

    const inside = (rect, x, y) => x >= rect.left && x <= rect.left + rect.width &&
        y >= rect.bottom && y <= rect.bottom + rect.height;

    // What applies at (x, y) – the figure's centre. null: move as always.
    function at(resolved, x, y) {
        if (!resolved || (!resolved.base && !resolved.regions?.length)) return null;
        let effective = resolved.base ? { ...resolved.base, surface: Infinity } : null;
        let cx = resolved.base?.current.x ?? 0, cy = resolved.base?.current.y ?? 0;
        for (const region of resolved.regions) {
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
        if (effective.mode === 'normal' && effective.gravity === 100 && cx === 0 && cy === 0) return null;
        return effective;
    }

    // One simulation step (1/60 s) in the water or in space – velocities in px
    // per frame. input: { x, y } in -1 … 1 (arrow keys), stroke: the jump key was
    // just pressed. env: { vrun, vjump, gravity } of the figure and the game,
    // near_surface: the figure is just below the surface.
    function fluid_step(v, input, p, env) {
        const response = Math.max(0.01, 1 - p.glide / 100);
        const vmax = env.vrun * p.speed;
        const tx = (input.x || 0) * vmax + p.current.x;
        const ty = (input.y || 0) * vmax + p.current.y;
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

    return { MODES, DEFAULTS, settings, resolve, at, fluid_step, valid_rect };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MovementRegions;
