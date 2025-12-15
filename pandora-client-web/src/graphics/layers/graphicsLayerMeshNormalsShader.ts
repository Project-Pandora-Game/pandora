import { noop } from 'lodash-es';
import { MAX_BONE_COUNT } from 'pandora-common';
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

/* Helper for calculating normals from height (to be reused later when we want to do that)

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
*/

const SHADER_NORMALS_BIT_GL: PIXI.HighShaderBit = {
	name: 'normals-bit',
	vertex: {
		header: /* glsl */`
uniform mat3 uTextureMatrix;
uniform vec4 uBoneQuat[${2 * MAX_BONE_COUNT}];
in uvec4 aBoneIndices; // Indices of bones, in uBoneQuat
in vec4 aBoneWeights; // Weights of bones, in uBoneQuat
out mat3 vTBN;

mat4x4 SkinQuaternionToTransformationmatrix(mat2x4 skinQuaterion) {
	// Input is ordered (abcd), with meanings (wxyz), so reorder to work with it easier
	vec4 b0 = skinQuaterion[0].yzwx;
	vec4 be = skinQuaterion[1].yzwx;
	float b0norm = 1. / length(b0);
	b0 *= b0norm;
	be *= b0norm;

	float t0 = 2. * (- be.w * b0.x + be.x * b0.w - be.y * b0.z + be.z * b0.y);
	float t1 = 2. * (- be.w * b0.y + be.x * b0.z + be.y * b0.w - be.z * b0.x);
	float t2 = 2. * (- be.w * b0.z - be.x * b0.y + be.y * b0.x + be.z * b0.w);

	return mat4x4(
		(1. - 2. * b0.y * b0.y - 2. * b0.z * b0.z), (2. * b0.x * b0.y + 2. * b0.w * b0.z), (2. * b0.x * b0.z - 2. * b0.w * b0.y), 0.,
		(2. * b0.x * b0.y - 2. * b0.w * b0.z), (1. - 2. * b0.x * b0.x - 2. * b0.z * b0.z), (2. * b0.y * b0.z + 2. * b0.w * b0.x), 0.,
		(2. * b0.x * b0.z + 2. * b0.w * b0.y), (2. * b0.y * b0.z - 2. * b0.w * b0.x), (1. - 2. * b0.x * b0.x - 2. * b0.y * b0.y), 0.,
		t0, t1, t2, 1.
	);
}
		`,
		main: /* glsl */`
uv = (uTextureMatrix * vec3(uv, 1.0)).xy;

mat2x4 skinQuaterion = mat2x4(0, 0, 0, 0, 0, 0, 0, 0);
float remainingWeight = 1.;
for (int si = 0; si < 4; si++) {
	float weight = aBoneWeights[si];
	uint boneIndex = aBoneIndices[si];
	if (boneIndex == 0u || weight == 0.)
		continue;

	mat2x4 quat = mat2x4(uBoneQuat[2u * boneIndex], uBoneQuat[2u * boneIndex + 1u]);
	skinQuaterion += weight * quat;
	remainingWeight -= weight;
}
if (remainingWeight != 0.) {
	mat2x4 quat = mat2x4(uBoneQuat[0], uBoneQuat[1]);
	skinQuaterion += remainingWeight * quat;
}

mat4x4 skinMatrix = SkinQuaternionToTransformationmatrix(skinQuaterion);

position.xy = (skinMatrix * vec4(position, 0, 1)).xy;

vec3 T = vec3(1., 0., 0.);
vec3 B = vec3(0., 1., 0.);
vec3 N = vec3(0., 0., 1.);

T = normalize((skinMatrix * vec4(T, 0)).xyz);
B = normalize((skinMatrix * vec4(B, 0)).xyz);
N = normalize((skinMatrix * vec4(N, 0)).xyz);
// TODO: Figure out how to mix the 2d transform directly into the above calculations
mat2 model2D = mat2(worldTransformMatrix * modelMatrix);
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
	},
};

export const NORMAL_MESH_GL_PROGRAM = PIXI.compileHighShaderGlProgram({
	name: 'mesh',
	bits: [
		PIXI.localUniformBitGl,
		SHADER_NORMALS_BIT_GL,
		{
			name: 'normal-mesh-texture-bit',
			fragment: {
				header: /* glsl */`
vec3 ambientColour = vec3(1., 1., 1.);
vec3 lightColour = vec3(1., 1., 1.);
uniform vec4 uBaseColor;

vec3 lightDir = normalize(vec3(2.7, -2.5, 3.7));

uniform float uAmbientStrength;
uniform float uSpecularStrength;
uniform float uRoughness;
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

export const NORMAL_MESH_DEBUG_NORMALS_GL_PROGRAM = PIXI.compileHighShaderGlProgram({
	name: 'mesh',
	bits: [
		PIXI.localUniformBitGl,
		SHADER_NORMALS_BIT_GL,
		{
			name: 'normal-mesh-texture-bit',
			fragment: {
				main: /* glsl */`
vec3 normal = getNormal(vUV);
outColor = texture(uTexture, vUV);

outColor.xyz = packNormal(normal) * outColor.w;
		`,
			},
		},
		PIXI.roundPixelsBitGl,
	],
});
