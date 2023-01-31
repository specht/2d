// https://www.shadertoy.com/view/XtlSD7

uniform sampler2D texture1;
uniform vec2 resolution;
varying vec2 vuv;

vec2 CRTCurveUV( vec2 uv )
{
    uv = uv * 2.0 - 1.0;
    vec2 offset = abs( uv.yx ) / vec2( 6.0, 4.0 );
    uv = uv + uv * offset * offset;
    uv = uv * 0.5 + 0.5;
    return uv;
}

void DrawVignette( inout vec3 color, vec2 uv )
{
    float vignette = uv.x * uv.y * ( 1.0 - uv.x ) * ( 1.0 - uv.y );
    vignette = clamp( pow( 16.0 * vignette, 0.3 ), 0.0, 1.0 );
    color *= vignette;
}

void DrawScanline( inout vec3 color, vec2 uv )
{
    float scanline 	= clamp( 0.95 + 0.05 * pow(cos( 3.14 * uv.y * resolution.y * 2.0), 3.0), 0.0, 1.0 );
    float grille 	= 0.95 + 0.05 * clamp( 1.5 * pow(cos( 3.14 * uv.x * resolution.x * 2.0), 3.0), 0.0, 1.0 );
    color *= scanline * grille * 1.2;
}

void main() {
    vec3 color = texture2D(texture1, vuv).rgb;
    vec2 crtUV = CRTCurveUV( vuv );
    if ( crtUV.x < 0.0 || crtUV.x > 1.0 || crtUV.y < 0.0 || crtUV.y > 1.0 )
    {
        color = vec3( 0.0, 0.0, 0.0 );
    }
    DrawVignette( color, crtUV );
    DrawScanline( color, vuv );
    gl_FragColor = vec4(color, 1.0);
}
