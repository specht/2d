// Nordlicht: waving curtains of light between the two control points
// (bright at the first, fading out towards the second).
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
    float s = max(scale, 0.1);
    vec2 d = cpb - cpa;
    float l = dot(d, d);
    float t = l > 0.000001 ? dot(vuv - cpa, d) / l : 0.5;
    float x = vuv.x / (120.0 * s);
    float wave = 0.12 * sin(x * 2.1 + time * 0.35) + 0.07 * sin(x * 5.3 - time * 0.6)
        + 0.06 * (value_noise(vec2(x * 3.0, time * 0.2)) - 0.5);
    float tt = t - wave;
    float band = smoothstep(0.0, 0.18, tt) * (1.0 - smoothstep(0.2, 1.0, tt));
    float curtains = 0.55 + 0.45 * sin(vuv.x / (7.0 * s) + 3.0 * sin(x * 1.3 + time * 0.5));
    curtains *= 0.7 + 0.3 * value_noise(vec2(vuv.x / (4.0 * s), time * 0.8));
    vec3 top = vec3(0.55, 0.35, 0.85);
    vec3 col = mix(color.rgb, top, smoothstep(0.3, 0.9, tt));
    gl_FragColor = vec4(col, color.a * band * curtains);
}
