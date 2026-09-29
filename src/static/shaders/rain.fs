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

void main() {
    vec2 p = floor(vuv);
    float s = max(scale, 0.1);
    float amount = clamp(density, 0.0, 4.0);
    float a = 0.0;
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float speed = 240.0 + 90.0 * fk;
        vec2 q = vec2(p.x + p.y * 0.25, p.y + time * speed);
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
        if (abs(floor(local.x) - x0) < 0.5 && local.y >= y0 && local.y < y0 + len)
            a = max(a, 0.45 + 0.2 * fk);
    }
    gl_FragColor = vec4(color.rgb, color.a * a * fade());
}
