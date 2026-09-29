// Wolken: soft drifting clouds from layered noise.
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

float fbm(vec2 x) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * value_noise(x);
        x = x * 2.03 + 17.1;
        amp *= 0.5;
    }
    return v;
}

void main() {
    float s = max(scale, 0.1);
    vec2 q = vuv / (90.0 * s) * vec2(1.0, 2.2) + vec2(time * 0.03, 0.0);
    float n = fbm(q);
    float a = smoothstep(0.47, 0.7, n);
    // lighter tops, slightly darker bellies
    float light = 0.82 + 0.18 * smoothstep(0.5, 0.85, fbm(q + vec2(0.0, 0.08)));
    gl_FragColor = vec4(color.rgb * light, color.a * a * fade());
}
