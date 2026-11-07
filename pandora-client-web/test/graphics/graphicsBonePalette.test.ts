import type { UniformGroup } from 'pixi.js';
import { MAX_BONE_COUNT } from 'pandora-common';

const jest = import.meta.jest;
// Pixi probes optional Canvas blend support when imported. These lifecycle
// tests exercise its real Buffer/UniformGroup classes without a canvas renderer.
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const { GraphicsBonePalette, CreateGraphicsSkinningShader, UpdateGraphicsSkinningShaderPalette } = await import('../../src/graphics/graphicsBonePalette.ts');
const { GetSkinnedMeshGpuProgram } = await import('../../src/graphics/graphicsSkinnedMesh.ts');
canvasProbe.mockRestore();
const shaderOptions = { gpuProgram: GetSkinnedMeshGpuProgram(), resources: {} };

function Bones(value = 1): Float32Array {
	const bones = new Float32Array(8 * MAX_BONE_COUNT);
	bones[0] = value;
	return bones;
}

describe('persistent shared GPU bone palettes', () => {
	it('retains one buffer across pose updates and destroys it at the final release', () => {
		const palette = new GraphicsBonePalette();
		const firstPose = Bones();
		palette.update(firstPose);
		const a = palette.acquire();
		const b = palette.acquire();
		const buffer = a.buffer!;
		expect(a).toBe(b);
		expect(palette.referenceCount).toBe(2);
		expect(a.ubo).toBe(true);
		expect(a.isStatic).toBe(true);
		expect(palette.update(firstPose)).toBe(false);
		for (let pose = 0; pose < 1000; pose++) {
			const bones = Bones(pose);
			expect(palette.update(bones)).toBe(true);
			expect(a.uniforms.uBoneQuat).toBe(bones);
			expect(a.buffer).toBe(buffer);
		}
		palette.release();
		expect(buffer.destroyed).toBe(false);
		palette.release();
		expect(buffer.destroyed).toBe(true);
		expect(palette.referenceCount).toBe(0);
		// A mounted owner can become visible again after all its meshes were hidden.
		const recreated = palette.acquire();
		expect(recreated.buffer).not.toBe(buffer);
		expect(recreated.buffer!.destroyed).toBe(false);
		palette.release();
		expect(recreated.buffer!.destroyed).toBe(true);
	});

	it('lets shaders own and release independent leases on the same palette', () => {
		const palette = new GraphicsBonePalette();
		const bones = Bones();
		const a = CreateGraphicsSkinningShader(shaderOptions, bones, palette);
		const b = CreateGraphicsSkinningShader(shaderOptions, bones, palette);
		expect(a.resources.skinningUniforms).toBe(b.resources.skinningUniforms);
		const buffer = (a.resources.skinningUniforms as UniformGroup).buffer!;
		expect(palette.referenceCount).toBe(2);
		a.destroy();
		expect(buffer.destroyed).toBe(false);
		expect(palette.referenceCount).toBe(1);
		b.destroy();
		expect(buffer.destroyed).toBe(true);
		expect(palette.referenceCount).toBe(0);
		b.destroy();
		expect(palette.referenceCount).toBe(0);
	});

	it('switches palette ownership without invalidating other shaders', () => {
		const oldPalette = new GraphicsBonePalette();
		const newPalette = new GraphicsBonePalette();
		const a = CreateGraphicsSkinningShader(shaderOptions, Bones(), oldPalette);
		const b = CreateGraphicsSkinningShader(shaderOptions, Bones(), oldPalette);
		const oldBuffer = (a.resources.skinningUniforms as UniformGroup).buffer!;
		UpdateGraphicsSkinningShaderPalette(a, Bones(2), newPalette);
		expect(a.resources.skinningUniforms).not.toBe(b.resources.skinningUniforms);
		expect(oldPalette.referenceCount).toBe(1);
		expect(newPalette.referenceCount).toBe(1);
		expect(oldBuffer.destroyed).toBe(false);
		const newBuffer = (a.resources.skinningUniforms as UniformGroup).buffer!;
		UpdateGraphicsSkinningShaderPalette(a, Bones(3), newPalette);
		expect((a.resources.skinningUniforms as UniformGroup).buffer).toBe(newBuffer);
		a.destroy();
		expect(newBuffer.destroyed).toBe(true);
		b.destroy();
		expect(oldBuffer.destroyed).toBe(true);
	});
});
