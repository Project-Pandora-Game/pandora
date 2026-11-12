import { MAX_BONE_COUNT } from 'pandora-common';
import type { UniformGroup } from 'pixi.js';

const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const { Texture, BufferImageSource } = await import('pixi.js');
const { GraphicsBonePalette } = await import('../../src/graphics/graphicsBonePalette.ts');
const {
	CreateOrUpdateNormalMeshShader, DEFAULT_NORMAL_TEXTURE,
	GetNormalMeshGlProgram, GetNormalMeshDebugNormalsGlProgram,
} = await import('../../src/graphics/layers/graphicsLayerMeshNormalsShader.ts');
GetNormalMeshGlProgram();
GetNormalMeshDebugNormalsGlProgram();
canvasProbe.mockRestore();

function Bones(): Float32Array {
	const bones = new Float32Array(8 * MAX_BONE_COUNT);
	bones[0] = 1;
	return bones;
}

function Options() {
	return {
		texture: Texture.WHITE,
		normalMapTexture: Texture.WHITE,
		normalMapData: { specularStrength: 0.5, roughness: 0.2 },
		color: 0x804020,
		boneTransforms: Bones(),
		bonePalette: new GraphicsBonePalette(),
	};
}

describe('normal mesh shaders', () => {
	it('uploads the neutral normal texture', () => {
		expect(DEFAULT_NORMAL_TEXTURE.source).toBeInstanceOf(BufferImageSource);
		expect(Array.from(DEFAULT_NORMAL_TEXTURE.source.resource as Uint8Array)).toEqual([127, 127, 255, 255]);
	});

	it('shares the bone palette between lit and debug materials', () => {
		const options = Options();
		const shader = CreateOrUpdateNormalMeshShader(undefined, options);
		const debug = CreateOrUpdateNormalMeshShader(undefined, { ...options, displayNormalMap: true });
		expect(shader.glProgram).toBeDefined();
		expect(debug.glProgram).toBeDefined();
		expect(shader.resources.uNormalMap).toBe(DEFAULT_NORMAL_TEXTURE.source);
		expect(shader.resources.skinningUniforms).toBe(debug.resources.skinningUniforms);
		expect(options.bonePalette.referenceCount).toBe(2);
		const buffer = (shader.resources.skinningUniforms as UniformGroup).buffer!;
		shader.destroy();
		expect(buffer.destroyed).toBe(false);
		debug.destroy();
		expect(buffer.destroyed).toBe(true);
		expect(options.bonePalette.referenceCount).toBe(0);
	});

	it('updates material, texture and pose resources without recreating the shader', () => {
		const options = Options();
		const shader = CreateOrUpdateNormalMeshShader(undefined, options);
		const material = shader.resources.pbrUniforms as UniformGroup;
		const texture = shader.resources.textureUniforms as UniformGroup;
		const palette = shader.resources.skinningUniforms as UniformGroup;
		const normalMapTexture = new Texture();
		const next = { ...options, normalMapTexture, color: 0xffffff, boneTransforms: Bones(), normalMapData: { roughness: 0.8, specularStrength: 0.1 } };
		expect(CreateOrUpdateNormalMeshShader(shader, next)).toBe(shader);
		expect(shader.resources.uNormalMap).toBe(normalMapTexture.source);
		expect(material.uniforms).toMatchObject({ uRoughness: 0.8, uSpecularStrength: 0.1, uAmbientStrength: 0.1 });
		expect(Array.from(texture.uniforms.uBaseColor as Float32Array)).toEqual([1, 1, 1, 1]);
		expect(palette.uniforms.uBoneQuat).toBe(next.boneTransforms);
		expect(options.bonePalette.referenceCount).toBe(1);
		shader.destroy();
		normalMapTexture.destroy();
	});

	it('replaces lit/debug programs while retaining live shared palette leases', () => {
		const options = Options();
		const lit = CreateOrUpdateNormalMeshShader(undefined, options);
		const debug = CreateOrUpdateNormalMeshShader(lit, { ...options, displayNormalMap: true });
		expect(debug).not.toBe(lit);
		expect(debug.resources.skinningUniforms).toBe(lit.resources.skinningUniforms);
		lit.destroy();
		expect(options.bonePalette.referenceCount).toBe(1);
		const resumed = CreateOrUpdateNormalMeshShader(debug, options);
		expect(resumed).not.toBe(debug);
		debug.destroy();
		expect(options.bonePalette.referenceCount).toBe(1);
		resumed.destroy();
		expect(options.bonePalette.referenceCount).toBe(0);
	});
});
