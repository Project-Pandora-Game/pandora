import { Assert, MAX_BONE_COUNT } from 'pandora-common';
import { Buffer, BufferUsage, Shader, UniformGroup, type ShaderWithResources } from 'pixi.js';

type SkinningUniforms = UniformGroup<{ uBoneQuat: { type: 'vec4<f32>'; size: number; value: Float32Array; }; }>;

/** One mutable GPU buffer per live character, shared by all of its mesh shaders. */
export class GraphicsBonePalette {
	private _references = 0;
	private _bones: Float32Array | undefined;
	private _uniforms: SkinningUniforms | undefined;

	public get referenceCount(): number {
		return this._references;
	}

	/** Arrays from the pose evaluator are immutable; repeated layer updates need no upload. */
	public update(bones: Float32Array): boolean {
		Assert(bones.length === 8 * MAX_BONE_COUNT, 'Invalid boneTransforms length');
		if (bones === this._bones)
			return false;
		this._bones = bones;
		if (this._uniforms !== undefined) {
			this._uniforms.uniforms.uBoneQuat = bones;
			this._uniforms.update();
		}
		return true;
	}

	public acquire(): SkinningUniforms {
		Assert(this._bones !== undefined, 'Update bone palette before acquiring it');
		if (this._uniforms === undefined) {
			const uniforms = new UniformGroup({
				uBoneQuat: { type: 'vec4<f32>', size: 2 * MAX_BONE_COUNT, value: this._bones },
			}, { ubo: true, isStatic: true });
			// Allocate once per live palette, never once per pose. GLSL std140
			// vec4 arrays use a 16-byte stride.
			uniforms.buffer = new Buffer({
				data: new Float32Array(8 * MAX_BONE_COUNT),
				// eslint-disable-next-line no-bitwise
				usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
				label: 'pandora-bone-palette',
				shrinkToFit: false,
			});
			this._uniforms = uniforms;
		}
		this._references++;
		return this._uniforms;
	}

	public release(): void {
		Assert(this._references > 0, 'Bone palette released without a matching acquire');
		if (--this._references === 0) {
			this._uniforms?.buffer?.destroy();
			this._uniforms = undefined;
		}
	}
}

type ShaderBinding = { palette: GraphicsBonePalette; externalPalette: GraphicsBonePalette | undefined; };
const shaderBindings = new WeakMap<Shader, ShaderBinding>();

/** Shaders own their palette lease, including shaders replaced by debug/material switches. */
export function CreateGraphicsSkinningShader(options: ShaderWithResources, bones: Float32Array, externalPalette?: GraphicsBonePalette): Shader {
	const palette = externalPalette ?? new GraphicsBonePalette();
	palette.update(bones);
	const skinningUniforms = palette.acquire();
	let shader: Shader;
	try {
		shader = new Shader({ ...options, resources: { ...options.resources, skinningUniforms } });
	} catch (error) {
		palette.release();
		throw error;
	}
	const binding: ShaderBinding = { palette, externalPalette };
	shaderBindings.set(shader, binding);
	shader.once('destroy', () => {
		// Pixi destroys this shader's bind groups immediately after this event.
		// Other live shaders retain their own leases and keep the buffer alive.
		shaderBindings.delete(shader);
		binding.palette.release();
	});
	return shader;
}

export function UpdateGraphicsSkinningShaderPalette(shader: Shader, bones: Float32Array, externalPalette?: GraphicsBonePalette): void {
	const binding = shaderBindings.get(shader);
	Assert(binding !== undefined, 'Shader does not own a bone palette');
	if (binding.externalPalette === externalPalette) {
		binding.palette.update(bones);
		return;
	}
	const palette = externalPalette ?? new GraphicsBonePalette();
	palette.update(bones);
	const uniforms = palette.acquire();
	shader.resources.skinningUniforms = uniforms;
	binding.palette.release();
	binding.palette = palette;
	binding.externalPalette = externalPalette;
}
