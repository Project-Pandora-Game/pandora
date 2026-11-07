import { MAX_BONE_COUNT } from 'pandora-common';

const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const P = await import('pixi.js');
const { GetDirectMaskPrograms, DIRECT_MASK_MAX_DEPTH } = await import('../../src/graphics/graphicsDirectMaskShader.ts');
const { GetSkinnedMeshGlProgram, GetSkinnedMeshGpuProgram } = await import('../../src/graphics/graphicsSkinnedMesh.ts');
const {
	GetNormalMeshGlProgram, GetNormalMeshGpuProgram,
	GetNormalMeshDebugNormalsGlProgram, GetNormalMeshDebugNormalsGpuProgram,
} = await import('../../src/graphics/layers/graphicsLayerMeshNormalsShader.ts');
const programPairs = [
	['ordinary', P.compileHighShaderGlProgram({ name: 'direct-test-base', bits: [P.localUniformBitGl, P.textureBitGl, P.roundPixelsBitGl] }), P.compileHighShaderGpuProgram({ name: 'direct-test-base', bits: [P.localUniformBit, P.textureBit, P.roundPixelsBit] })],
	['skinned', GetSkinnedMeshGlProgram(), GetSkinnedMeshGpuProgram()],
	['normal', GetNormalMeshGlProgram(), GetNormalMeshGpuProgram()],
	['debug', GetNormalMeshDebugNormalsGlProgram(), GetNormalMeshDebugNormalsGpuProgram()],
] as const;
canvasProbe.mockRestore();

describe('fused direct binary mask shader programs', () => {
	it.each(programPairs)('preserves %s material resources and adds collision-free nested mask bindings', (_name, gl, gpu) => {
		for (const depth of [1, DIRECT_MASK_MAX_DEPTH]) {
			const fused = GetDirectMaskPrograms(gl, gpu, depth);
			expect(GetDirectMaskPrograms(gl, gpu, depth)).toBe(fused);
			expect(fused.gpuProgram.vertex).toEqual(gpu.vertex);
			// GlProgram adds its compatibility/precision prologue again. Vertex math is unchanged.
			expect(fused.glProgram.vertex?.slice(fused.glProgram.vertex.indexOf('void main')).trim()).toBe(gl.vertex?.slice(gl.vertex.indexOf('void main')).trim());
			expect(fused.gpuProgram.layout.length).toBeLessThanOrEqual(4);
			for (let group = 0; group < gpu.layout.length; group++) expect(fused.gpuProgram.layout[group]).toMatchObject(gpu.layout[group]);
			const original = Object.values(gpu.layout[2]);
			const bindings = fused.gpuProgram.layout[2];
			expect(bindings.directMaskUniforms).toBeGreaterThan(Math.max(...original));
			for (let i = 0; i < depth; i++) {
				expect(bindings[`uDirectMask${i}`]).toBeGreaterThan(bindings.directMaskUniforms);
				expect(bindings[`uDirectMaskSampler${i}`]).toBeGreaterThan(bindings[`uDirectMask${i}`]);
			}
			expect(new Set(Object.values(bindings)).size).toBe(Object.keys(bindings).length);
			// Actually construct Pixi resource bindings; absent automatic global/local
			// groups must not be accessed while borrowing material resources.
			const resources = {
				uTexture: P.Texture.WHITE.source, uSampler: P.Texture.WHITE.source.style,
				textureUniforms: new P.UniformGroup({ uTextureMatrix: { type: 'mat3x3<f32>', value: new P.Matrix() } }),
				directMaskUniforms: new P.UniformGroup(Object.fromEntries(Array.from({ length: depth }, (_, i) => [`uDirectMaskMatrix${i}`, { type: 'mat3x3<f32>' as const, value: new P.Matrix() }]))),
				skinningUniforms: new P.UniformGroup({ uBoneQuat: { type: 'vec4<f32>', size: 2 * MAX_BONE_COUNT, value: new Float32Array(8 * MAX_BONE_COUNT) } }),
			};
			const shader = new P.Shader({ ...fused, resources });
			expect(shader.resources.uTexture).toBe(P.Texture.WHITE.source);
			shader.destroy();
		}
	});

	it('rejects unsupported source layouts and excessive depth before drawing', () => {
		const [, gl, gpu] = programPairs[0];
		expect(() => GetDirectMaskPrograms(gl, gpu, DIRECT_MASK_MAX_DEPTH + 1)).toThrow();
		const occupiedPosition = P.GpuProgram.from({
			vertex: gpu.vertex,
			fragment: { ...gpu.fragment, source: gpu.fragment!.source.replace('fn main(', 'fn main(@builtin(position) existingPosition: vec4<f32>,') },
		});
		expect(() => GetDirectMaskPrograms(gl, occupiedPosition, 1)).toThrow('Unsupported direct mask fragment position input');

		const foreign = P.GpuProgram.from({ vertex: { source: '@vertex fn main() -> @builtin(position) vec4<f32> { return vec4<f32>(0.); }' }, fragment: { source: '@fragment fn main() -> @location(0) vec4<f32> { return vec4<f32>(1.); }' } });
		expect(() => GetDirectMaskPrograms(gl, foreign, 1)).toThrow('Unsupported direct mask vertex output');
	});
});
