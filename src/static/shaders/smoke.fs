//#extension GL_OES_standard_derivatives : enable
#ifdef GL_ES
precision highp float;
#endif

#define NUM_OCTAVES 8

uniform float time;
uniform float scale;
uniform lowp vec2 cpa, cpb;
varying vec2 vuv;
uniform vec4 color;
float l;

float gradient(vec2 uv) {
  return 1.0 - clamp(dot((uv - cpa), (cpb - cpa) * l), 0.0, 1.0);
}

float random(vec2 pos) {
    return fract(sin(dot(pos.xy, vec2(1399.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 pos) {
    vec2 i = floor(pos);
    vec2 f = fract(pos);
    float a = random(i + vec2(0.0, 0.0));
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 pos) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i=0; i<NUM_OCTAVES; i++) {
        v += a * noise(pos);
        pos = rot * pos * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main(void) {
    l = 1.0 / (pow(length(cpb - cpa), 2.0));
    vec2 p = vec2(vuv.x, vuv.y) / 240.0 / scale;

    float t = 0.0, d;

    float time2 = 0.6 * time / 2.0;

    vec2 q = vec2(0.0);
    q.x = fbm(p + 0.30 * time2);
    q.y = fbm(p + vec2(1.0));
    vec2 r = vec2(0.0);
    r.x = fbm(p + 1.0 * q + vec2(1.2, 3.2) + 0.135 * time2);
    r.y = fbm(p + 1.0 * q + vec2(8.8, 2.8) + 0.126 * time2);
    float f = fbm(p + r);
    vec3 color_out = mix(
        vec3(0.0, 0.0, 0),
        vec3(1, 0, 0.7),
        clamp((f * f) * 8.0, 0.0, 5.0)
    );

    color_out = mix(
        color_out,
        vec3(0.7, 0.3, 0),
        clamp(length(q), 0.0, 1.0)
    );

    color_out = mix(
        color_out,
        vec3(0.7, 0.3, 0),
        clamp(length(r.x), 1.0, 1.0)
    );

    float alpha = gradient(vuv);
    f *= alpha;
    color_out = (f * f * f + 0.6 * f * f + 0.9 * f) * color_out;

    gl_FragColor = vec4(color.r, color.g, color.b, color.a * color_out.r * alpha);
}
