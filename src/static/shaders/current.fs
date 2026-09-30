// Strömung: short streaks drifting in one direction – shows where a current,
// a Sog or a wind pulls (a Bewegungsbereich with Strömung). Nearer streaks are
// longer, brighter and faster. The head of a streak is brighter than its tail.
// Settings (backdrops.js BACKDROP_EFFECT_OPTIONS):
//   angle     the direction in degrees: 0 = right, 90 = up, 180 = left, 270 = down
// Speed: the layer's Geschwindigkeit (1 = about 60 px/s). Menge: density.
// Control points: fade from the first point (full) to the second (gone), like
// snow; both at the bottom edge by default = no fade.
precision highp float;

uniform float time;
uniform float scale;
uniform float density;
uniform float angle;
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

void main() {
    vec2 p = floor(vuv) + 0.5;
    float s = max(scale, 0.1);
    float amount = clamp(density, 0.0, 4.0);
    float rad = radians(angle);
    vec2 dir = vec2(cos(rad), sin(rad));
    vec2 across = vec2(-dir.y, dir.x);
    // the pixel in the frame of the flow: x along it, y across it
    vec2 q0 = vec2(dot(p, dir), dot(p, across));
    float a = 0.0;
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float speed = 45.0 + 25.0 * fk;
        vec2 q = vec2(q0.x - time * speed, q0.y);
        vec2 cell = vec2((44.0 + 18.0 * fk) * s, (8.0 + 3.0 * fk) * s / max(amount, 1.0));
        // every lane of cells starts at its own place: no bands across the flow
        float lane = floor(q.y / cell.y);
        q.x += hash12(vec2(lane, fk * 13.0 + 1.0)) * cell.x;
        vec2 c = floor(q / cell);
        if (hash12(c + fk * 31.0) > 0.55 * min(amount, 1.0)) continue;
        vec2 r = hash22(c * 1.7 + fk * 5.0);
        vec2 local = q - c * cell;
        float len = (7.0 + 4.0 * fk) * s;
        float x0 = r.x * max(cell.x - len, 1.0);
        float y0 = floor(r.y * cell.y) + 0.5;
        if (abs(local.y - y0) < 0.5 && local.x >= x0 && local.x < x0 + len) {
            float head = (local.x - x0) / len;
            a = max(a, (0.3 + 0.2 * fk) * (0.25 + 0.75 * head));
        }
    }
    gl_FragColor = vec4(color.rgb, color.a * a * fade());
}
