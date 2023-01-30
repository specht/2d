//--- hatsuyuki ---
// by Catzpaw 2016
precision mediump float;

//#extension GL_OES_standard_derivatives : enable

uniform float time;
uniform float scale;
uniform vec2 mouse;
uniform vec2 resolution;
varying vec2 vuv;
uniform vec4 color;


float snow(vec2 uv,float scale)
{
  float w=smoothstep(1.,0.,-uv.y*(scale/10.));if(w<.1)return 0.;
  uv+=time/scale;uv.y+=time*2./scale;uv.x+=sin(uv.y+time*.5)/scale;
  uv*=scale;vec2 s=floor(uv),f=fract(uv),p;float k=3.,d;
  p=.5+.35*sin(11.*fract(sin((s+p+scale)*mat2(7,3,6,5))*5.))-f;d=length(p);k=min(d,k);
  k=smoothstep(0.,k,sin(f.x+f.y)*0.01);
  return k*w;
}

void main(void){
  //gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  //return;
  //vec2 uv=(gl_FragCoord.xy*2.-resolution.xy)/min(resolution.x,resolution.y);
  float mr = min(resolution.x, resolution.y);
  float ar = resolution.x / resolution.y;
  vec2 uv = vec2(vuv.x * mr * ar, vuv.y * mr) / 240.0 / scale;
  vec3 finalColor=vec3(0);
  float c=0.0;//smoothstep(1.,0.3,clamp(uv.y*.3+.8,0.,.75));
  c+=snow(uv,30.)*.3;
  c+=snow(uv,20.)*.5;
  c+=snow(uv,15.)*.8;
  c+=snow(uv,10.);
  c+=snow(uv,8.);
  c+=snow(uv,6.);
  c+=snow(uv,5.);
  finalColor=(vec3(c));
  //gl_FragColor = vec4(finalColor.rgb,1.0);
  gl_FragColor = vec4(color.r, color.g, color.b, color.a * finalColor.r);
}

