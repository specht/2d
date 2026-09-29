// https://www.glslsandbox.com/e#36547.0
//--- hatsuyuki ---
// by Catzpaw 2016
precision mediump float;

//#extension GL_OES_standard_derivatives : enable

uniform float time;
uniform float scale;
uniform vec2 cpa, cpb;
varying vec2 vuv;
uniform vec4 color;
float l;
float t;

float gradient(vec2 uv) {
  return 1.0 - clamp(dot((uv - cpa), (cpb - cpa) * l), 0.0, 1.0);
}

// density ("Menge", 1 = normal): below 1 some flakes are left out, above 1
// more layers of flakes are added.
uniform float density;
float keep;

float snow(vec2 uvu0, vec2 uv, float scale)
{
  float w = gradient(uvu0);
  uv+=t/scale;uv.y+=t*2./scale;uv.x+=sin(uv.y+t*.5)/scale;
  uv*=scale;vec2 s=floor(uv),f=fract(uv),p;float k=3.,d;
  if (fract(sin(dot(s + scale, vec2(12.9898, 78.233))) * 43758.5453) >= keep) return 0.0;
  p=.5+.35*sin(11.*fract(sin((s+p+scale)*mat2(7,3,6,5))*5.))-f;d=length(p);k=min(d,k);
  k=smoothstep(0.,k,sin(f.x+f.y)*0.01);
  return k*w;
}

void main(void) {
  l = 1.0 / (pow(length(cpb - cpa), 2.0));
  t = time * 0.4;
  vec2 uv = vec2(vuv.x, vuv.y) / scale / 100.0;

  vec3 finalColor=vec3(0);
  float c = 0.0;
  float amount = clamp(density, 0.0, 3.0);
  for (int pass = 0; pass < 3; pass++) {
    keep = clamp(amount - float(pass), 0.0, 1.0);
    // keep = 1 keeps every flake (fract() < 1): exactly the old snow
    if (keep <= 0.0) break;
    vec2 o = vec2(0.37, 0.61) * float(pass);
    c += snow(vuv, uv + o, 30.)*.3;
    c += snow(vuv, uv + o, 20.)*.5;
    c += snow(vuv, uv + o, 15.)*.8;
    c += snow(vuv, uv + o, 10.);
    c += snow(vuv, uv + o, 8.);
    c += snow(vuv, uv + o, 6.);
    c += snow(vuv, uv + o, 5.);
  }
  finalColor=(vec3(c));
  //gl_FragColor = vec4(finalColor.rgb,1.0);
  gl_FragColor = vec4(color.r, color.g, color.b, color.a * finalColor.r);
}

