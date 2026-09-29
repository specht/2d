// Schwebestaub: fine dust or ash that hangs in the air. Nothing falls – every
// speck drifts slowly with the air, turns small circles and is nudged along by
// gentle gusts that move its neighbours the same way. Near specks (bigger,
// brighter, faster) and far specks (tiny, dim, slow) give the air depth.
// Control points: fade from the first point (full) to the second (gone), like
// snow; both at the bottom edge by default = no fade.
precision highp float;

uniform float time;
uniform float scale;
uniform float density;
uniform vec2 cpa, cpb;
uniform vec4 color;
varying vec2 vuv;

const float TAU = 6.28318530718;

// 1 at the first control point, 0 at the second and beyond (no fade if unset).
float fade() {
    vec2 d = cpb - cpa;
    float l = dot(d, d);
    if (l < 0.000001) return 1.0;
    return 1.0 - clamp(dot(vuv - cpa, d) / l, 0.0, 1.0);
}

vec3 hash32(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    q += dot(q, q.yxz + 33.33);
    return fract((q.xxy + q.yzz) * q.zyx);
}

float hash12(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

float value_noise(vec2 x) {
    vec2 i = floor(x), f = fract(x);
    float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    float s = max(scale, 0.1);
    // Menge: 1 = about every second cell holds a speck
    float keep = clamp(0.45 * density, 0.0, 1.0);
    float a = 0.0;
    for (int k = 0; k < 4; k++) {
        float fk = float(k);
        float depth = 0.4 + 0.2 * fk;                 // 0.4 far … 1.0 near
        float cell = (22.0 + 12.0 * fk) * s;
        // the air moves very slowly to the right and a little upwards
        vec2 drift = vec2(6.0, 2.0) * depth * time * s;
        vec2 p = vuv - drift + fk * vec2(37.0, 91.0);
        vec2 c0 = floor(p / cell);
        for (int dj = -1; dj <= 1; dj++) {
            for (int di = -1; di <= 1; di++) {
                vec2 c = c0 + vec2(float(di), float(dj));
                vec3 h = hash32(c + fk * 17.0);
                if (h.z >= keep) continue;
                vec3 g = hash32(c * 1.7 + 5.3 + fk);
                vec2 base = (c + 0.2 + 0.6 * h.xy) * cell;
                // a small, slow circle – each speck with its own pace and phase
                float w = 0.25 + 0.35 * g.x;
                float phase = TAU * g.y;
                vec2 circle = (2.0 + 4.0 * g.z) * s * vec2(cos(time * w + phase), sin(time * w * 0.8 + phase));
                // gusts: a slow flow that nudges neighbouring specks together
                vec2 q = base / (cell * 5.0) + vec2(time * 0.06, -time * 0.04);
                vec2 gust = (vec2(value_noise(q), value_noise(q + 19.1)) - 0.5) * 14.0 * s;
                vec2 pos = base + circle + gust;
                // mostly single pixels, now and then a bigger flake
                float size = (0.5 + 0.4 * fk + 0.9 * step(0.86, g.x)) * s;
                float dist = length(p - pos);
                // specks catch the light now and then
                float glint = 0.7 + 0.3 * sin(time * (0.7 + g.z) + phase * 3.0);
                a = max(a, (1.0 - smoothstep(size * 0.5, size + 0.5, dist)) * depth * glint);
            }
        }
    }
    gl_FragColor = vec4(color.rgb, color.a * a * fade());
}
