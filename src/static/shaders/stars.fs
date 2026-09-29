// Sternenhimmel: twinkling stars, each exactly one game pixel (big ones with a cross).
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
    vec2 p = floor(vuv);
    float s = max(scale, 0.1);
    float a = 0.0;
    for (int k = 0; k < 2; k++) {
        float big = float(k);
        float cell = mix(9.0, 23.0, big) * s;
        vec2 c = floor(p / cell);
        if (hash12(c * 1.7 + big * 5.3) > mix(0.45, 0.3, big)) continue;
        vec2 r = hash22(c + big * 17.0);
        vec2 star = c * cell + floor(r * max(cell - 2.0, 1.0)) + 1.0;
        vec2 d = abs(p - star);
        float twinkle = 0.55 + 0.45 * sin(time * (1.5 + 3.0 * r.x) + r.y * 6.2831);
        if (d.x + d.y < 0.5) a = max(a, mix(0.6, 1.0, big) * twinkle);
        else if (big > 0.5 && d.x + d.y < 1.5) a = max(a, 0.45 * twinkle);
    }
    gl_FragColor = vec4(color.rgb, color.a * a * fade());
}
