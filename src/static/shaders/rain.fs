// Regen: slanted streaks in three depths, falling fast.
precision highp float;

uniform float time;
uniform float scale;
uniform vec2 cpa, cpb;
uniform vec4 color;
varying vec2 vuv;

// 1 at the first control point, 0 at the second and beyond (no fade if unset).
float fade() {
    vec2 d = cpb - cpa;
    float l = dot(d, d);
    if (l < 0.000001) return 1.0;
    return 1.0 - clamp(dot(vuv - cpa, d) / l, 0.0, 1.0);
}

float hash12(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

vec2 hash22(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yzx + 33.33);
    return fract((q.xx + q.yz) * q.zy);
}

float value_noise(vec2 x) {
    vec2 i = floor(x), f = fract(x);
    float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// density ("Menge", 1 = normal): fewer streaks below 1, narrower columns above.
uniform float density;

// The streaks are the same in both looks: per depth k, cells in a sheared grid
// (q), one streak at a random place in some of them.
//   pixelig (pixel_size > 0, backdrops.js): one game pixel wide, in steps –
//   exactly the rain as it always was
//   smooth: thin slanted lines with soft edges, at the screen's resolution
float rain(vec2 world, bool pixels) {
    float s = max(scale, 0.1);
    float amount = clamp(density, 0.0, 4.0);
    float a = 0.0;
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float speed = 240.0 + 90.0 * fk;
        vec2 q = vec2(world.x + world.y * 0.25, world.y + time * speed);
        vec2 cell_size = vec2((7.0 + 2.0 * fk) * s / max(amount, 1.0), (70.0 + 20.0 * fk) * s);
        // Every column of cells starts at its own height: no horizontal bands.
        float column = floor(q.x / cell_size.x);
        q.y += hash12(vec2(column, fk * 17.0 + 3.0)) * cell_size.y;
        vec2 c = floor(q / cell_size);
        if (hash12(c + fk * 31.0) > 0.55 * min(amount, 1.0)) continue;
        vec2 r = hash22(c * 1.3 + fk * 7.0);
        vec2 local = q - c * cell_size;
        float len = (5.0 + 2.0 * fk) * s;
        float x0 = floor(r.x * cell_size.x);
        float y0 = floor(r.y * max(cell_size.y - len, 1.0));
        float strength = 0.45 + 0.2 * fk;
        if (pixels) {
            if (abs(floor(local.x) - x0) < 0.5 && local.y >= y0 && local.y < y0 + len)
                a = max(a, strength);
        } else {
            // across: a core of half a game pixel, soft beyond; along: soft ends
            float across = 1.0 - smoothstep(0.2, 0.55, abs(local.x - (x0 + 0.5)));
            float along = smoothstep(y0, y0 + 1.5, local.y) * (1.0 - smoothstep(y0 + len - 1.5, y0 + len, local.y));
            a = max(a, strength * across * along);
        }
    }
    return a;
}

void main() {
    // pixel_size: declared by backdrops.js (backdrop_fragment_shader), which
    // also puts vuv on the centre of its game pixel when it is > 0
    float a = pixel_size > 0.0 ? rain(floor(vuv), true) : rain(vuv, false);
    gl_FragColor = vec4(color.rgb, color.a * a * fade());
}
