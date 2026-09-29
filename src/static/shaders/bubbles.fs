// Blasen: bubbles that wobble upwards, with a small highlight.
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
    float a = 0.0;
    for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float cw = (26.0 + 9.0 * fk) * s;
        float col = floor(p.x / cw);
        if (hash12(vec2(col * 1.3, fk + 0.5)) > 0.55) continue;
        vec2 r = hash22(vec2(col, fk * 7.0 + 1.0));
        float speed = 18.0 + 24.0 * r.x;
        float period = (130.0 + 60.0 * r.y) * s;
        float y = mod(p.y - time * speed - r.y * period, period);
        float radius = (1.5 + 3.0 * r.x) * s;
        float cx = (col + 0.3 + 0.4 * r.y) * cw + 2.5 * sin(time * 2.0 + r.x * 6.2831 + (p.y - y) * 0.05);
        vec2 d = vec2(p.x - cx, y - radius - 1.0);
        float dist = length(d);
        float ring = smoothstep(radius + 0.8, radius, dist) * smoothstep(radius - 1.6, radius - 0.6, dist);
        float glint = smoothstep(1.1, 0.2, length(d + vec2(radius * 0.45, -radius * 0.45)));
        a = max(a, max(ring * 0.75, glint));
    }
    gl_FragColor = vec4(color.rgb, color.a * a * fade());
}
