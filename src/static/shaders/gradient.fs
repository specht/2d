uniform int n;
uniform lowp vec4 ca, cb, cc, cd;
uniform lowp vec2 pa, pb, pc, pd;
uniform lowp vec2 na, nb, nc, nd;
uniform lowp float la, lb, lc, ld;
// two colours only: 1 = round (ca in the middle at pa, cb from the distance
// pa–pb on), 0 = straight, as always (backdrops.js backdrop_gradient_radial)
uniform int radial;
varying vec2 vuv;
// Optional crunchy pixel-art look (backdrops.js): 0 = smooth, 1 = noise, 2 = Bayer raster.
// Like a pixel artist, the gradient is reduced to `dither_levels` colours between
// its end colours, and each game pixel takes one of them – no colour speckles.
uniform int dither_mode;
uniform float dither_levels;

// Ordered 4×4 Bayer threshold in [0, 1) for a game pixel.
float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
    return bayer2(0.5 * a) * 0.25 + bayer2(a);
}
// Fixed white noise per game pixel (the same pixel always gets the same value).
float pixel_noise(vec2 a) {
    highp vec2 p = floor(a);
    highp vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
}

float threshold(vec2 offset) {
    return dither_mode == 1 ? pixel_noise(vuv + offset) : bayer4(vuv + offset);
}

// Position along the gradient (0…1) snapped to one of the colour steps.
float dithered(float x, vec2 offset) {
    if (dither_mode == 0) return x;
    float steps = max(dither_levels - 1.0, 1.0);
    return clamp(floor(x * steps + threshold(offset)) / steps, 0.0, 1.0);
}

void main() {
    if (n == 1) {
        gl_FragColor = ca;
    } else if (n == 2 && radial == 1) {
        float wb = clamp(length(vuv - pa) / max(la, 0.0001), 0.0, 1.0);
        gl_FragColor = mix(ca, cb, dithered(wb, vec2(0.0)));
    } else if (n == 2) {
        float wa = clamp(1.0 - dot(vuv - pa, na) / la, 0.0, 1.0);
        float wb = clamp(1.0 - dot(vuv - pb, nb) / lb, 0.0, 1.0);
        float sum = wa + wb;
        wa /= sum;
        wb /= sum;
        if (dither_mode == 0) {
            gl_FragColor = ca * wa + cb * wb;
        } else {
            gl_FragColor = mix(ca, cb, dithered(wb, vec2(0.0)));
        }
    } else if (n == 4) {
        // code from https://johnflux.com/2016/03/16/four-point-gradient-as-a-shader/
        lowp vec2 Q = pa - pc;
        lowp vec2 R = pb - pa;
        lowp vec2 S = R + pc - pd;
        lowp vec2 T = pa - vuv;
        lowp float u;
        lowp float t;
        if(Q.x == 0.0 && S.x == 0.0) {
            u = -T.x/R.x;
            t = (T.y + u*R.y) / (Q.y + u*S.y);
        } else if(Q.y == 0.0 && S.y == 0.0) {
            u = -T.y/R.y;
            t = (T.x + u*R.x) / (Q.x + u*S.x);
        } else {
            float A = S.x * R.y - R.x * S.y;
            float B = S.x * T.y - T.x * S.y + Q.x*R.y - R.x*Q.y;
            float C = Q.x * T.y - T.x * Q.y;
            // Solve Au^2 + Bu + C = 0
            if(abs(A) < 0.0001)
                u = -C/B;
            else
                u = (-B+sqrt(B*B-4.0*A*C))/(2.0*A);
            t = (T.y + u*R.y) / (Q.y + u*S.y);
        }
        u = clamp(u,0.0,1.0);
        t = clamp(t,0.0,1.0);
        // These two lines smooth out t and u to avoid visual 'lines' at the boundaries.  They can be removed to improve performance at the cost of graphics quality.
        t = smoothstep(0.0, 1.0, t);
        u = smoothstep(0.0, 1.0, u);
        // dithered: both directions snap to colour steps (with different patterns)
        u = dithered(u, vec2(0.0));
        t = dithered(t, vec2(2.0, 1.0));
        lowp vec4 colorA = mix(ca,cb,u);
        lowp vec4 colorB = mix(cc,cd,u);
        gl_FragColor = mix(colorA, colorB, t);
    } else {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
