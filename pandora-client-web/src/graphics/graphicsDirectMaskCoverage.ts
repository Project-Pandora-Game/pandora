import { GlProgram, Matrix, MeshGeometry, RenderTexture, Shader, State, UniformGroup, type Texture, type WebGLRenderer } from 'pixi.js';
import { CreateDirectMaskResources, UnbindDirectMaskTexture, UpdateDirectMaskResources, type DirectMaskSample } from './graphicsDirectMaskResources.ts';
import { DIRECT_MASK_MAX_DEPTH, GetDirectMaskPrograms } from './graphicsDirectMaskShader.ts';

/** Exact physical-pixel coverage for stacks exceeding one draw's sampler budget. */
export class GraphicsDirectMaskCoverage {
	private readonly _renderer: WebGLRenderer;
	private readonly _onRetireTexture: (texture: Texture) => void;
	private readonly _geometry = new MeshGeometry({ positions: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
	private readonly _state = State.for2d();
	private readonly _shaders = new Map<string, { shader: Shader; uniforms: UniformGroup; }>();
	private readonly _textures: RenderTexture[] = [];
	private _key = '';
	private _result?: DirectMaskSample;
	public draws = 0;

	constructor(renderer: WebGLRenderer, onRetireTexture: (texture: Texture) => void) {
		this._renderer = renderer;
		this._onRetireTexture = onRetireTexture;
		this._state.blend = false;
	}

	public compact(samples: readonly DirectMaskSample[]): DirectMaskSample {
		const renderer = this._renderer;
		const viewport = renderer.renderTarget.viewport;
		const x = viewport.x;
		const y = renderer.renderTarget.renderTarget.isRoot
			? renderer.renderTarget.renderTarget.pixelHeight - viewport.height - viewport.y : viewport.y;
		const width = viewport.width;
		const height = viewport.height;
		const key = `${x},${y},${width},${height};` + samples.map((s) => `${s.texture.source.uid}:${s.revision}:${s.format}:${Array.from(s.matrix.toArray(true)).join(',')}`).join(';');
		if (key === this._key && this._result) return this._result;
		this._key = '';
		if (this._textures[0]?.width !== width || this._textures[0]?.height !== height) {
			this._result = undefined;
			for (const texture of this._textures) {
				this._onRetireTexture(texture);
				texture.destroy(true);
			}
			this._textures.length = 0;
			for (let i = 0; i < 2; i++) this._textures.push(RenderTexture.create({ width, height, format: 'r8unorm', scaleMode: 'nearest' }));
		}
		let previous: DirectMaskSample | undefined;
		for (let offset = 0, pass = 0; offset < samples.length; pass++) {
			const chunk = samples.slice(offset, offset + DIRECT_MASK_MAX_DEPTH - (previous ? 1 : 0));
			offset += chunk.length;
			const inputs = previous ? [previous, ...chunk] : chunk;
			const formats = inputs.map((s) => s.format);
			const variant = formats.join(',');
			let fused = this._shaders.get(variant);
			if (!fused) {
				const resources = CreateDirectMaskResources(inputs);
				const gl = GlProgram.from({ name: 'pandora-mask-coverage', vertex: 'in vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0., 1.); }', fragment: 'out vec4 finalColor; void main() { finalColor = vec4(1.); }' });
				const shader = new Shader({ ...GetDirectMaskPrograms(gl, inputs.length, formats), resources });
				this._shaders.set(variant, fused = { shader, uniforms: resources.directMaskUniforms });
			}
			const target = this._textures[pass % 2];
			UpdateDirectMaskResources(fused, inputs, new Matrix(1, 0, 0, 1, x, y));
			const previousBinding = renderer.renderTarget.getBindState();
			renderer.renderTarget.bind({ target, clear: true });
			try {
				renderer.encoder.draw({ geometry: this._geometry, shader: fused.shader, state: this._state, topology: 'triangle-list' });
				this.draws++;
			} finally {
				renderer.renderTarget.finishRenderPass();
				renderer.renderTarget.bind({ ...previousBinding, clear: false });
			}
			previous = { texture: target, format: 'keep', revision: 0, matrix: new Matrix(1 / width, 0, 0, 1 / height, -x / width, -y / height) };
		}
		this._result = previous!;
		this._key = key;
		return previous!;
	}

	public forgetTexture(texture: Texture): void {
		for (const { shader } of this._shaders.values()) UnbindDirectMaskTexture(shader, texture);
		this._key = '';
	}

	public destroy(): void {
		for (const { shader, uniforms } of this._shaders.values()) {
			shader.destroy();
			uniforms.buffer?.destroy();
		}
		this._shaders.clear();
		for (const texture of this._textures) texture.destroy(true);
		this._geometry.destroy();
	}
}
