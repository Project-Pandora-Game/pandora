import { MAX_BONE_COUNT } from 'pandora-common';

const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const P = await import('pixi.js');
const { GetDirectMaskPrograms, DIRECT_MASK_MAX_DEPTH } = await import('../../src/graphics/graphicsDirectMaskShader.ts');
const { GetSkinnedMeshGlProgram } = await import('../../src/graphics/graphicsSkinnedMesh.ts');
const { GetNormalMeshGlProgram, GetNormalMeshDebugNormalsGlProgram } = await import('../../src/graphics/layers/graphicsLayerMeshNormalsShader.ts');
const batch = new P.DefaultShader(4);
const filter = new P.ColorMatrixFilter();
const programs = [
	['ordinary', P.compileHighShaderGlProgram({ name: 'direct-test-base', bits: [P.localUniformBitGl, P.textureBitGl, P.roundPixelsBitGl] })],
	['skinned', GetSkinnedMeshGlProgram()],
	['normal', GetNormalMeshGlProgram()],
	['debug', GetNormalMeshDebugNormalsGlProgram()],
	['sprite and batched Graphics', batch.glProgram],
	['filter output', filter.glProgram],
] as const;
canvasProbe.mockRestore();
afterAll(() => {
	batch.destroy();
	filter.destroy();
});

describe('fused direct binary mask shader programs', () => {
	it.each(programs)('preserves %s material programs and resources', (_name, gl) => {
		for (const depth of [1, DIRECT_MASK_MAX_DEPTH]) {
			const fused = GetDirectMaskPrograms(gl, depth);
			expect(GetDirectMaskPrograms(gl, depth)).toBe(fused);
			// GlProgram adds its compatibility/precision prologue again. Vertex math is unchanged.
			expect(fused.glProgram.vertex?.slice(fused.glProgram.vertex.indexOf('void main')).trim()).toBe(gl.vertex?.slice(gl.vertex.indexOf('void main')).trim());
			const resources = {
				uTexture: P.Texture.WHITE.source, uSampler: P.Texture.WHITE.source.style,
				textureUniforms: new P.UniformGroup({ uTextureMatrix: { type: 'mat3x3<f32>', value: new P.Matrix() } }),
				directMaskUniforms: new P.UniformGroup(Object.fromEntries(Array.from({ length: depth }, (_, i) => [`uDirectMaskMatrix${i}`, { type: 'mat3x3<f32>' as const, value: new P.Matrix() }]))),
				skinningUniforms: new P.UniformGroup({ uBoneQuat: { type: 'vec4<f32>', size: 2 * MAX_BONE_COUNT, value: new Float32Array(8 * MAX_BONE_COUNT) } }),
			};
			const shader = new P.Shader({ ...fused, resources });
			expect(shader.resources.uTexture).toBe(P.Texture.WHITE.source);
			expect(shader.resources.directMaskUniforms).toBe(resources.directMaskUniforms);
			shader.destroy();
		}
	});

	it('supports early main returns', () => {
		const gl = P.GlProgram.from({
			vertex: 'in vec2 aPosition; void main() { gl_Position=vec4(aPosition,0.,1.); }',
			fragment: 'void main(void) { if(gl_FragCoord.x < 1.) { gl_FragColor=vec4(1.); return; } gl_FragColor=vec4(.5); }',
		});
		const fused = GetDirectMaskPrograms(gl, 1);
		expect(fused.glProgram.fragment).toContain('#define main pandoraDirectMaskMaterial\n');
		expect(fused.glProgram.fragment).toContain(gl.fragment!.replace('#version 300 es', ''));
		expect(fused.glProgram.fragment).toContain('#undef main\n');
		expect(fused.glProgram.fragment).toContain('void main() { pandoraDirectMaskMaterial();');
		expect(fused.glProgram.fragment!.indexOf('pandoraDirectMaskMaterial();')).toBeLessThan(fused.glProgram.fragment!.indexOf('if (pandoraDirectMask0.g'));
	});

	it('preserves comments, unusual entry formatting and colliding helper names verbatim', () => {
		const gl = P.GlProgram.from({
			vertex: 'in vec2 aPosition; void main() { gl_Position=vec4(aPosition,0.,1.); }',
			fragment: `// void main() is not an entry here.
float pandoraDirectMaskMaterial = 0.;
void /* an entry comment */ main
(void) { gl_FragColor=vec4(pandoraDirectMaskMaterial); }`,
		});
		const fused = GetDirectMaskPrograms(gl, 1);
		expect(fused.glProgram.fragment).toContain('#define main pandoraDirectMaskMaterial_\n');
		expect(fused.glProgram.fragment).toContain(gl.fragment!.replace('#version 300 es', ''));
		expect(fused.glProgram.fragment).toContain('void main() { pandoraDirectMaskMaterial_();');
	});

	it('specializes RG8 and compacted keep textures independently and caches by formats', () => {
		const [, gl] = programs[0];
		const formats = ['rg8unorm', 'keep'] as const;
		const fused = GetDirectMaskPrograms(gl, 2, formats);
		expect(GetDirectMaskPrograms(gl, 2, formats)).toBe(fused);
		expect(GetDirectMaskPrograms(gl, 2)).not.toBe(fused);
		expect(fused.glProgram.fragment).toContain('pandoraDirectMask0.g > 0.5 && pandoraDirectMask0.r < 0.5');
		expect(fused.glProgram.fragment).toContain('if (pandoraDirectMask1.r < 0.5)');
	});

	it('rejects missing programs, bad depth and mismatched formats', () => {
		const [, gl] = programs[0];
		expect(() => GetDirectMaskPrograms(undefined, 1)).toThrow();
		expect(() => GetDirectMaskPrograms(gl, DIRECT_MASK_MAX_DEPTH + 1)).toThrow();
		expect(() => GetDirectMaskPrograms(gl, 1.5)).toThrow();
		expect(() => GetDirectMaskPrograms(gl, 1, [])).toThrow('Direct mask formats must match mask depth');
	});
});
