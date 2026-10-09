// The CRT effect ("Röhrenbildschirm", app.js render): the picture of the game
// as an old tube TV would show it – after Timothy Lottes' public-domain CRT
// shader, as in PixelRAM's shell (github.com/specht/pixelram, shell.html).
// Every game pixel is read from its centre (resolution: the game's pixels on
// the screen, at least two screen pixels each), blurred a little sideways,
// drawn as a scanline, through a shadow mask, on a slightly curved glass with
// darker corners.

uniform sampler2D texture1;
uniform vec2 resolution;
varying vec2 vuv;

const float hardScan = -12.0;
const float hardPix = -3.0;
const vec2 warp = vec2(1.0 / 64.0, 1.0 / 48.0);
const float maskDark = 0.5;
const float maskLight = 1.5;

float toLinear1(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
vec3 toLinear(vec3 c) { return vec3(toLinear1(c.r), toLinear1(c.g), toLinear1(c.b)); }
float toSrgb1(float c) { c = max(c, 0.0); return c < 0.0031308 ? c * 12.92 : 1.055 * pow(c, 0.41666) - 0.055; }
vec3 toSrgb(vec3 c) { return vec3(toSrgb1(c.r), toSrgb1(c.g), toSrgb1(c.b)); }

vec3 fetchPixel(vec2 pos, vec2 off) {
    vec2 p = (floor(pos * resolution + off) + vec2(0.5)) / resolution;
    if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return vec3(0.0);
    return toLinear(1.2 * texture2D(texture1, p).rgb);
}

vec2 distToPixel(vec2 pos) {
    vec2 p = pos * resolution;
    return -((p - floor(p)) - vec2(0.5));
}

float gaus(float p, float s) { return exp2(s * p * p); }

vec3 horz3(vec2 pos, float off) {
    vec3 b = fetchPixel(pos, vec2(-1.0, off)), c = fetchPixel(pos, vec2(0.0, off)), d = fetchPixel(pos, vec2(1.0, off));
    float x = distToPixel(pos).x;
    float wb = gaus(x - 1.0, hardPix), wc = gaus(x, hardPix), wd = gaus(x + 1.0, hardPix);
    return (b * wb + c * wc + d * wd) / (wb + wc + wd);
}

vec3 horz5(vec2 pos, float off) {
    vec3 a = fetchPixel(pos, vec2(-2.0, off)), b = fetchPixel(pos, vec2(-1.0, off)), c = fetchPixel(pos, vec2(0.0, off));
    vec3 d = fetchPixel(pos, vec2(1.0, off)), e = fetchPixel(pos, vec2(2.0, off));
    float x = distToPixel(pos).x;
    float wa = gaus(x - 2.0, hardPix), wb = gaus(x - 1.0, hardPix), wc = gaus(x, hardPix), wd = gaus(x + 1.0, hardPix), we = gaus(x + 2.0, hardPix);
    return (a * wa + b * wb + c * wc + d * wd + e * we) / (wa + wb + wc + wd + we);
}

float scan(vec2 pos, float off) { return gaus(distToPixel(pos).y + off, hardScan); }

vec3 tri(vec2 pos) {
    return horz3(pos, -1.0) * scan(pos, -1.0) + horz5(pos, 0.0) * scan(pos, 0.0) + horz3(pos, 1.0) * scan(pos, 1.0);
}

vec2 warpUv(vec2 p) {
    p = p * 2.0 - 1.0;
    p *= vec2(1.0 + p.y * p.y * warp.x, 1.0 + p.x * p.x * warp.y);
    return p * 0.5 + 0.5;
}

vec3 shadowMask(vec2 p) {
    p.x += p.y * 3.0;
    float x = fract(p.x / 6.0);
    vec3 m = vec3(maskDark);
    if (x < 0.333333) m.r = maskLight;
    else if (x < 0.666666) m.g = maskLight;
    else m.b = maskLight;
    return m;
}

float vignette(vec2 uv) {
    vec2 p = uv * 2.0 - 1.0;
    float e = dot(p * p, vec2(0.30, 0.42));
    return 1.0 - smoothstep(0.34, 1.08, e) * 0.26;
}

void main() {
    vec2 pos = warpUv(vuv);
    if (pos.x < 0.0 || pos.y < 0.0 || pos.x > 1.0 || pos.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    vec3 color = tri(pos) * shadowMask(gl_FragCoord.xy) * vignette(pos) * 1.15;
    gl_FragColor = vec4(toSrgb(color), 1.0);
}
