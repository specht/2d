// Staubwirbel: dust and ash spiral into a whirl – slowly at the edge, violently
// near the eye. First control point: the eye; second: the edge of the whirl.
// The whirl is a flat disc seen at an angle ("Neigung"): 0° = straight from the
// front, 60° = from the side at an angle (the default), 85° = almost edge-on.
// Specks on the far half of the disc are a little fainter.
// Every speck moves on a closed-form path (no state), so any moment in time can
// be drawn directly: it drifts inwards on a logarithmic spiral while its angular
// speed grows like 1 / distance.
precision highp float;

uniform float time;
uniform float scale;
uniform float density;
uniform vec2 cpa, cpb;
uniform vec4 color;
uniform float tilt;
varying vec2 vuv;

const float TAU = 6.28318530718;

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
    // screen → the whirl's own plane: vertical distances are foreshortened
    float squash = cos(radians(clamp(tilt, 0.0, 85.0)));
    vec2 d = vuv - cpa;
    vec2 e = cpb - cpa;
    float R = length(vec2(e.x, e.y / squash));
    if (R < 1.0) R = 120.0;
    vec2 dd = vec2(d.x, d.y / squash);
    float r = max(length(dd), 0.5);
    float ang = atan(dd.y, dd.x);
    float L = log(r);
    float s = max(scale, 0.1);
    float keep = clamp(0.4 * density, 0.0, 1.0);

    // fades: nothing in the very eye, nothing far beyond the edge
    float fade = smoothstep(3.0, 14.0, r) * (1.0 - smoothstep(R * 1.1, R * 1.8, r));
    float a = 0.0;

    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float K = 40.0 + 16.0 * fk;          // specks around a ring
        float M = 7.0 + 2.0 * fk;            // rings per step of log(r)
        float v = 0.9 + 0.35 * fk;           // rings per second towards the eye
        float S = 1.1 + 0.45 * fk;           // angular speed at the edge (rad/s)
        float c = v / M;
        float u = L * M + v * time;
        float j0 = floor(u);
        for (int dj = -1; dj <= 1; dj++) {
            float j = j0 + float(dj);
            // angle turned so far by this ring (closed form of the growing spin)
            float rc = exp((j + 0.5) / M - c * time);
            float r0 = exp((j + 0.5) / M);
            float turned = S / c * (R / rc - R / r0);
            float spin = S * R / rc;         // current angular speed
            float sector = (ang - turned) / TAU * K;
            float i0 = floor(sector);
            for (int di = -1; di <= 1; di++) {
                float i = mod(i0 + float(di), K);
                vec3 h = hash32(vec2(i, j) + fk * 57.0);
                if (h.z >= keep) continue;
                float rp = exp((j + h.y) / M - c * time);
                float ap = (i + h.x) / K * TAU + turned;
                vec2 dir = vec2(cos(ap), sin(ap));
                // the speck on screen (the disc is foreshortened vertically)
                vec2 delta = d - rp * vec2(dir.x, dir.y * squash);
                // a short streak behind the speck: longer where it moves fast on screen
                vec2 motion = vec2(-dir.y, dir.x * squash);
                float motion_len = max(length(motion), 0.001);
                vec2 tangent = motion / motion_len;
                float along = dot(delta, tangent);
                float across = dot(delta, vec2(-tangent.y, tangent.x));
                float len = min(spin * rp * motion_len * 0.035, 9.0 * s);
                float w = (0.6 + 0.5 * fk) * s;
                // the far half of a tilted whirl is a little fainter
                float depth = 1.0 - 0.45 * (1.0 - squash) * smoothstep(-0.2, 0.6, dir.y);
                if (abs(across) < w && along < w && along > -len - w)
                    a = max(a, depth * (0.45 + 0.25 * fk) * (1.0 - 0.6 * clamp(-along / (len + w), 0.0, 1.0)));
            }
        }
    }

    // a faint haze of spiral arms that turn with the whirl
    float arms = 0.5 + 0.5 * sin(3.0 * ang - 5.0 * L + time * 3.5 + 2.0 * value_noise(vec2(cos(ang) * 2.0 + L * 3.0 - time, sin(ang) * 2.0)));
    // (noise from cos/sin of the angle: no seam where the angle wraps around)
    float haze = 0.12 * arms * arms * arms * value_noise(vec2(cos(ang) * 4.0 + L * 8.0 + time * 2.0, sin(ang) * 4.0 - time));

    gl_FragColor = vec4(color.rgb, color.a * clamp(max(a, haze), 0.0, 1.0) * fade);
}
