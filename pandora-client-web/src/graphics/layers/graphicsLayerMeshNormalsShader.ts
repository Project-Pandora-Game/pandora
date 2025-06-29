import { noop } from 'lodash-es';
import * as PIXI from 'pixi.js';

export const DEFAULT_NORMAL_TEXTURE = new PIXI.Texture({
	source: new PIXI.BufferImageSource({
		resource: new Uint8Array([127, 127, 255, 255]),
		width: 1,
		height: 1,
		alphaMode: 'premultiply-alpha-on-upload',
		label: 'DEFAULT_NORMAL',
	}),
	label: 'DEFAULT_NORMAL',
});
DEFAULT_NORMAL_TEXTURE.destroy = noop;

/* TODO: Helpers

// Normals from height
float getHeight(vec2 pos) {
	return 1. - texture(uDepthTexture, pos).x;
}

float h = 150.;
float l = h * getHeight(pos - uPix.xz);
float r = h * getHeight(pos + uPix.xz);
float d = h * getHeight(pos - uPix.zy);
float u = h * getHeight(pos + uPix.zy);
return normalize(vec3(l-r, u-d, 1.));

// Display normals
outColor.xyz = packNormal(getNormal(vUV)) * outColor.w;

*/

export const NORMAL_MESH_GL_PROGRAM = PIXI.compileHighShaderGlProgram({
	name: 'mesh',
	bits: [
		PIXI.localUniformBitGl,
		{
			name: 'texture-bit',
			vertex: {
				header: /* glsl */`
uniform mat3 uTextureMatrix;
in float aRotation; // Rotation in radians per vertex
out mat3 vTBN;
		`,
				main: /* glsl */`
uv = (uTextureMatrix * vec3(uv, 1.0)).xy;

float cosA = cos(aRotation);
float sinA = sin(aRotation);
mat2 rotateMatrix = mat2(
	vec2(cosA, sinA),
	vec2(-sinA, cosA)
);

vec3 T = vec3(1., 0., 0.);
vec3 B = vec3(0., 1., 0.);
vec3 N = vec3(0., 0., 1.);

mat2 model2D = mat2(worldTransformMatrix * modelMatrix) * rotateMatrix;
T.xy = normalize(model2D * T.xy);
B.xy = normalize(model2D * B.xy);

vTBN = mat3(T, B, N);
		`,
			},
			fragment: {
				header: /* glsl */`
#version 300 es

uniform sampler2D uTexture;
uniform sampler2D uNormalMap;

vec3 ambientColour = vec3(1., 1., 1.);
vec3 lightColour = vec3(1., 1., 1.);
uniform vec4 uBaseColor;

vec3 lightDir = normalize(vec3(2.7, -2.5, 3.7));

uniform float uAmbientStrength;
uniform float uSpecularStrength;
uniform float uRoughness;

in mat3 vTBN;

vec3 unpackNormal(vec3 color) {
	vec3 normal = color * 2. - 1.;
	// We are working in Pixi's coordinate system - X is right, Y is down, Z toward camera
	normal.y = -normal.y;
	return normal;
}

vec3 packNormal(vec3 normal) {
	normal.y = -normal.y;
	return (normal + 1.) / 2.;
}

vec3 getNormal(vec2 pos) {
	vec3 normal = unpackNormal(texture(uNormalMap, pos).rgb);
	normal = normalize(vTBN * normal);
	return normal;
}
		`,
				main: /* glsl */`
vec3 normal = getNormal(vUV);
outColor = texture(uTexture, vUV);

vec3 ambient = clamp(ambientColour * uAmbientStrength, 0., 1.);

float lambertian = clamp(dot(lightDir, normal), 0., 1.);
vec3 diffuse = (0.4 + 0.6 * lambertian) * lightColour;

vec3 specular = vec3(0.);
if (lambertian > 0.) {
	vec3 viewDir = normalize(vec3(0., 0., 1.));
	float shininess = pow(2., (1.0 - uRoughness) * 4.);

	vec3 reflection = 2.0 * dot(normal, lightDir) * normal - lightDir;
	float specularStrength = clamp(dot(reflection, viewDir), 0.0, 1.0);
	specularStrength = pow(specularStrength, shininess);
	specularStrength *= uSpecularStrength;

	// The specular color is from the light source, not the object
	if (specularStrength > 0.) {
		specular = lightColour * specularStrength;
		diffuse *= 1. - specularStrength;
	}
}

outColor *= uBaseColor;
outColor.xyz *= (ambient + diffuse);
outColor.xyz += specular * outColor.w;
		`,
			},
		},
		PIXI.roundPixelsBitGl,
	],
});
