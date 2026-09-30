// Gewitter: now and then a bolt of lightning cracks down from the sky, and the
// whole sky lights up with it – bright at once, then flickering out. Between
// the strikes the layer is fully transparent.
// Control points: the bolts start at the height of the first point and reach
// down to the second; they strike somewhere across the layer's width, centred
// on the first point. Farbe: the colour of the flash (its alpha = strength).
// Settings (backdrops.js BACKDROP_EFFECT_OPTIONS):
//   interval  seconds between two strikes on average
//   glow      how strongly the whole sky lights up (0 = only the bolt)
//   bolts     1 = visible bolts, 0 = only the sky flickers ("Wetterleuchten")
precision highp float;

uniform float time;
uniform float scale;
uniform vec2 resolution;
uniform vec2 cpa, cpb;
uniform vec4 color;
uniform float interval;
uniform float glow;
uniform float bolts;
varying vec2 vuv;

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

// Brightness of a strike dt seconds after it began: a bright first stroke,
// a second one right after, and a short afterglow.
float envelope(float dt) {
    if (dt < 0.0 || dt > 0.9) return 0.0;
    float first = exp(-dt * 18.0);
    float second = 0.8 * exp(-max(dt - 0.16, 0.0) * 14.0) * step(0.16, dt);
    float tail = 0.25 * exp(-dt * 4.0);
    return clamp(max(max(first, second), tail), 0.0, 1.0);
}

float dist_to_segment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    return length(p - a - ab * t);
}

void main() {
    float s = max(scale, 0.1);
    float every = max(interval, 0.3);
    // the current strike: one per interval, at a random moment inside it
    float k = floor(time / every);
    float start = (k + 0.1 + 0.5 * hash11(k * 7.13)) * every;
    float light = envelope(time - start);
    if (light <= 0.001) { gl_FragColor = vec4(0.0); return; }

    // where it strikes
    float top = cpa.y, bottom = min(cpb.y, cpa.y - 8.0);
    float x0 = cpa.x + (hash11(k * 3.71) - 0.5) * resolution.x * 0.8;

    float core = 0.0, halo = 0.0;
    // about three strikes in four show a bolt; the others only light the sky
    if (bolts > 0.5 && hash11(k * 1.93) < 0.75) {
        float seg = 9.0 * s;
        vec2 prev = vec2(x0, top);
        float d = 1e6;
        float branch_at = 2.0 + floor(hash11(k * 5.3) * 5.0);
        vec2 fork = prev;
        for (int i = 1; i <= 48; i++) {
            float fi = float(i);
            vec2 next = vec2(prev.x + (hash21(vec2(fi, k)) - 0.5) * seg * 1.6, top - fi * seg);
            if (next.y < bottom) next.y = bottom;
            d = min(d, dist_to_segment(vuv, prev, next));
            if (fi == branch_at) fork = next;
            prev = next;
            if (next.y <= bottom) break;
        }
        // one thinner branch, off to one side
        float side = hash11(k * 9.1) < 0.5 ? -1.0 : 1.0;
        float db = 1e6;
        vec2 bp = fork;
        for (int j = 1; j <= 7; j++) {
            float fj = float(j);
            vec2 bn = vec2(bp.x + side * seg * 0.7 + (hash21(vec2(fj, k + 50.0)) - 0.5) * seg, bp.y - seg * 0.8);
            db = min(db, dist_to_segment(vuv, bp, bn));
            bp = bn;
        }
        core = max(1.0 - smoothstep(0.7 * s, 1.6 * s, d), 0.7 * (1.0 - smoothstep(0.3 * s, 1.1 * s, db)));
        halo = max(exp(-d / (5.0 * s)), 0.6 * exp(-db / (4.0 * s)));
    }
    // the sky: brightest around the strike, but everywhere a little
    float near = exp(-abs(vuv.x - x0) / max(resolution.x * 0.35, 1.0));
    float sky = glow * (0.45 + 0.55 * near);

    float a = light * max(core, max(0.8 * halo, sky));
    vec3 rgb = mix(color.rgb, vec3(1.0), 0.7 * core);
    gl_FragColor = vec4(rgb, clamp(color.a * a, 0.0, 1.0));
}
