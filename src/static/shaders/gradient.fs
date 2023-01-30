uniform int n;
uniform lowp vec4 ca, cb, cc, cd;
uniform lowp vec2 pa, pb, pc, pd;
uniform lowp vec2 na, nb, nc, nd;
uniform lowp float la, lb, lc, ld;
varying vec2 vuv;

void main() {
    if (n == 1) {
        gl_FragColor = ca;
    } else if (n == 2) {
        float wa = clamp(1.0 - dot(vuv - pa, na) / la, 0.0, 1.0);
        float wb = clamp(1.0 - dot(vuv - pb, nb) / lb, 0.0, 1.0);
        float sum = wa + wb;
        wa /= sum;
        wb /= sum;
        gl_FragColor = ca * wa + cb * wb;
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
        lowp vec4 colorA = mix(ca,cb,u);
        lowp vec4 colorB = mix(cc,cd,u);
        gl_FragColor = mix(colorA, colorB, t);
    } else {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
