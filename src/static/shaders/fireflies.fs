// Glühwürmchen: glowing dots that wander and blink.
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

void main() {
    vec2 p = vuv;
    float s = max(scale, 0.1);
    float cell = 48.0 * s;
    vec2 c0 = floor(p / cell);
    float a = 0.0;
    for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
            vec2 c = c0 + vec2(float(i), float(j));
            if (hash12(c + 3.1) > 0.6) continue;
            vec2 r = hash22(c);
            vec2 wander = vec2(sin(time * (0.5 + r.x) + r.y * 6.2831), cos(time * (0.4 + r.y) + r.x * 6.2831));
            vec2 center = (c + 0.5) * cell + wander * cell * 0.3;
            float blink = smoothstep(0.25, 1.0, 0.5 + 0.5 * sin(time * (0.8 + 1.5 * r.x) + r.y * 20.0));
            float d = length(p - center);
            a += blink * (smoothstep(2.2, 0.6, d) + 0.3 * smoothstep(9.0, 1.5, d));
        }
    }
    gl_FragColor = vec4(color.rgb, color.a * clamp(a, 0.0, 1.0) * fade());
}
