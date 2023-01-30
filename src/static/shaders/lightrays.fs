uniform float time;
uniform float scale;
uniform float resolution;
varying vec2 vuv;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed)
{
	vec2 sourceToCoord = coord - raySource;
	float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
	
	return clamp(
		(0.45 + 0.15 * sin(cosAngle * seedA + time * speed)) +
		(0.3 + 0.2 * cos(-cosAngle * seedB + time * speed)),
		0.0, 1.0) *
		clamp((resolution.x - length(sourceToCoord)) / resolution.x, 0.5, 1.0);
}

void main(void){
{
	vec2 uv = vuv.xy / resolution.xy;
	uv.y = 1.0 - uv.y;
	vec2 coord = vec2(vuv.x, resolution.y - vuv.y);
	
	
	// Set the parameters of the sun rays
	vec2 rayPos1 = vec2(resolution.x * 0.7, resolution.y * -0.4);
	vec2 rayRefDir1 = normalize(vec2(1.0, -0.116));
	float raySeedA1 = 36.2214;
	float raySeedB1 = 21.11349;
	float raySpeed1 = 2.0;
	
	vec2 rayPos2 = vec2(resolution.x * 0.8, resolution.y * -0.6);
	vec2 rayRefDir2 = normalize(vec2(1.0, 0.241));
	const float raySeedA2 = 22.39910;
	const float raySeedB2 = 18.0234;
	const float raySpeed2 = 2.0;
	
	// Calculate the colour of the sun rays on the current fragment
	vec4 rays1 =
		vec4(1.0, 1.0, 1.0, 1.0) *
		rayStrength(rayPos1, rayRefDir1, coord, raySeedA1, raySeedB1, raySpeed1);
	 
	vec4 rays2 =
		vec4(1.0, 1.0, 1.0, 1.0) *
		rayStrength(rayPos2, rayRefDir2, coord, raySeedA2, raySeedB2, raySpeed2);
	
	vec4 fragColor = rays1 * 0.5 + rays2 * 0.4;
	
	// Attenuate brightness towards the bottom, simulating light-loss due to depth.
	// Give the whole thing a blue-green tinge as well.
	float brightness = 1.0 - (coord.y / resolution.y);
    //brightness = 1.0;
    float r = fragColor.r * brightness;
	fragColor.x *= 0.1 + (brightness * 0.8);
	fragColor.y *= 0.3 + (brightness * 0.6);
	fragColor.z *= 0.5 + (brightness * 0.5);
    fragColor = vec4(r, r, r, 1.0);

    gl_FragColor = fragColor;
}
