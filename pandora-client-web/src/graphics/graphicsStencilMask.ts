import {
	Container, ExtensionType, GlProgram, GpuProgram, Matrix, Mesh, MeshGeometry, RenderTexture, Shader, State, StencilMask, STENCIL_MODES, Texture, UniformGroup,
	compileHighShaderGlProgram, compileHighShaderGpuProgram, extensions, localUniformBit, localUniformBitGl, roundPixelsBit, roundPixelsBitGl, textureBit, textureBitGl,
	type Application, type HighShaderBit, type Effect, type Instruction, type InstructionPipe, type InstructionSet, type RenderOptions, type WebGLRenderer, type WebGPURenderer,
} from 'pixi.js';
import { RasterMaskGeometryState, type RasterMaskBounds } from './graphicsMaskGeometry.ts';
import { GraphicsMaskRenderFrame } from './graphicsMaskRenderFrame.ts';
import { ExactMaskRasterCache, type ExactMaskRasterRequest, type ExactMaskRasterSnapshot } from './graphicsExactMaskRasterCache.ts';
import { GraphicsMaskPackingShader, type MaskRasterFormat } from './graphicsMaskTexture.ts';

export type { MaskRasterFormat } from './graphicsMaskTexture.ts';

// Legacy texture sampling clamps at the original canvas edges. When coverage
// touches an outer edge, sample across the viewport rather than silently stop
// cutting at the canvas boundary. Invert the 2D affine projection at four vertices.
const RASTER_EXTEND_GL: HighShaderBit = {
	name: 'raster-extend',
	vertex: {
		header: 'uniform vec4 uMaskRect; uniform float uMaskFullscreen;',
		end: `
if (uMaskFullscreen > 0.5) {
	vec2 clip = aUV * 2.0 - 1.0;
	mat3 m = modelViewProjectionMatrix;
	vec2 delta = clip - m[2].xy;
	float det = m[0].x * m[1].y - m[1].x * m[0].y;
	vec2 local = vec2(m[1].y * delta.x - m[1].x * delta.y, -m[0].y * delta.x + m[0].x * delta.y) / det;
	vUV = (local - uMaskRect.xy) / uMaskRect.zw;
	gl_Position = vec4(clip, 0.0, 1.0);
}`,
	},
};
const RASTER_EXTEND: HighShaderBit = {
	name: 'raster-extend',
	vertex: {
		header: 'struct RasterUniforms { uMaskRect: vec4<f32>, uMaskFullscreen: f32, } @group(3) @binding(0) var<uniform> rasterUniforms: RasterUniforms;',
		end: `
if (rasterUniforms.uMaskFullscreen > 0.5) {
	let clip = aUV * 2.0 - 1.0;
	let m = modelViewProjectionMatrix;
	let delta = clip - m[2].xy;
	let det = m[0].x * m[1].y - m[1].x * m[0].y;
	let local = vec2<f32>(m[1].y * delta.x - m[1].x * delta.y, -m[0].y * delta.x + m[0].x * delta.y) / det;
	vUV = (local - rasterUniforms.uMaskRect.xy) / rasterUniforms.uMaskRect.zw;
	vPosition = vec4<f32>(clip, 0.0, 1.0);
}`,
	},
};

/** Experimental hard-cut mask. The PNG is sampled; transparent/white pixels never cut a triangle wholesale. */
export class GraphicsStencilMask implements Effect {
	public readonly pipe = 'pandoraStencilMask';
	public readonly priority = 0;
	public readonly root = new Container();
	public readonly keep: StencilMask;
	public readonly cut: Mesh<MeshGeometry, Shader>;
	private readonly _fill: Mesh<MeshGeometry, Shader>;
	private readonly _cutShader: Shader;
	private readonly _rasterUniforms = new UniformGroup({
		uMaskRect: { type: 'vec4<f32>', value: new Float32Array(4) },
		uMaskFullscreen: { type: 'f32', value: 0 },
	});
	private readonly _textureUniforms = new UniformGroup({ uTextureMatrix: { type: 'mat3x3<f32>', value: new Matrix() } });

	constructor(texture: Texture, geometry: MeshGeometry, raster: boolean = false, format: MaskRasterFormat = 'rgba8unorm') {
		const packed = format === 'rg8unorm';
		const state = State.for2d();
		state.blend = false;
		const fillGeometry = new MeshGeometry({
			positions: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
			uvs: new Float32Array(8),
			indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
		});
		fillGeometry.batchMode = 'no-batch';
		const fillGpuSource = '@vertex fn mainVertex(@location(0) aPosition: vec2<f32>) -> @builtin(position) vec4<f32> { return vec4<f32>(aPosition, 0., 1.); } @fragment fn mainFragment() -> @location(0) vec4<f32> { return vec4<f32>(1.); }';
		this._fill = new Mesh({
			geometry: fillGeometry, state, shader: new Shader({
				gpuProgram: GpuProgram.from({ vertex: { source: fillGpuSource, entryPoint: 'mainVertex' }, fragment: { source: fillGpuSource, entryPoint: 'mainFragment' } }),
				glProgram: GlProgram.from({
					name: 'pandora-stencil-fill',
					vertex: 'in vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0., 1.); }',
					fragment: 'out vec4 finalColor; void main() { finalColor = vec4(1.); }',
				}),
			}),
		});
		const shader = new Shader({
			gpuProgram: compileHighShaderGpuProgram({
				name: packed ? 'pandora-stencil-cut-rg8' : 'pandora-stencil-cut', bits: [
					localUniformBit, textureBit, roundPixelsBit, ...(raster ? [RASTER_EXTEND] : []),
					{ name: packed ? 'pandora-cut-rg8' : 'pandora-cut', fragment: { end: `if (!(outColor.${packed ? 'g' : 'a'} > 0.5 && outColor.r < 0.5)) { discard; }` } },
				],
			}),
			glProgram: compileHighShaderGlProgram({
				name: packed ? 'pandora-stencil-cut-rg8' : 'pandora-stencil-cut', bits: [
					localUniformBitGl, textureBitGl, roundPixelsBitGl, ...(raster ? [RASTER_EXTEND_GL] : []),
					{ name: packed ? 'pandora-cut-rg8' : 'pandora-cut', fragment: { end: `if (!(outColor.${packed ? 'g' : 'a'} > 0.5 && outColor.r < 0.5)) discard;` } },
				],
			}),
			resources: {
				uTexture: texture.source,
				uSampler: texture.source.style,
				textureUniforms: this._textureUniforms,
				...(raster ? { rasterUniforms: this._rasterUniforms } : {}),
			},
		});
		this._cutShader = shader;
		geometry.batchMode = 'no-batch';
		this.cut = new Mesh({ geometry, shader, texture, state });
		this.root.addChild(this._fill, this.cut);
		this.keep = new StencilMask({ mask: this._fill });
		this.cut.includeInBuild = false;
		this.cut.measurable = false;
		this.root.measurable = false;
		this.root.includeInBuild = false;
		this.update(texture, geometry);
	}

	public update(texture: Texture, geometry: MeshGeometry): void {
		this.cut.geometry = geometry;
		this.cut.texture = texture;
		this._cutShader.resources.uTexture = texture.source;
		this._cutShader.resources.uSampler = texture.source.style;
		const uniforms = this._textureUniforms;
		uniforms.uniforms.uTextureMatrix = texture.textureMatrix.mapCoord;
		uniforms.update();
	}

	public updateRasterBounds(bounds: Readonly<RasterMaskBounds>, coverage: Readonly<RasterMaskBounds> = bounds): void {
		this._rasterUniforms.uniforms.uMaskRect.set([bounds.x - 250, bounds.y, bounds.width, bounds.height]);
		this._rasterUniforms.uniforms.uMaskFullscreen = coverage.x === 0 || coverage.y === 0 ||
			coverage.x + coverage.width === 1500 || coverage.y + coverage.height === 1500 ? 1 : 0;
		this._rasterUniforms.update();
	}

	public destroy(): void {
		this.keep.destroy();
		this._fill.geometry.destroy();
		this._fill.shader?.destroy();
		this._cutShader.destroy();
		this.root.destroy({ children: true, texture: false, textureSource: false });
	}
}

/**
 * Use Pixi's normal stencil stack for nesting: admit the parent region, then
 * subtract the PNG's black texels. Pop only decrements admitted pixels. This
 * avoids the incorrect intersection of nested inverse stencil masks.
 * Geometry belongs to the caller; no color render textures are allocated here.
 */
class PandoraStencilMaskPipe implements InstructionPipe<Instruction> {
	public static readonly extension = { type: [ExtensionType.WebGLPipes, ExtensionType.WebGPUPipes], name: 'pandoraStencilMask' };
	private readonly _renderer: WebGLRenderer | WebGPURenderer;

	constructor(renderer: WebGLRenderer | WebGPURenderer) {
		this._renderer = renderer;
	}

	public push(effect: Effect, target: Container, instructions: InstructionSet): void {
		if (!(effect instanceof GraphicsStencilMask))
			throw new Error('Unexpected stencil effect');
		const renderer = this._renderer;
		renderer.renderPipes.stencilMask.push(effect.keep, target, instructions);
		instructions.add({ renderPipeId: effect.pipe, action: 'cutBegin', canBundle: false });
		effect.root.includeInBuild = true;
		effect.cut.includeInBuild = true;
		// Pixi accepts a null current layer at runtime (as its built-in mask pipe does).
		effect.cut.collectRenderables(instructions, renderer, target.parentRenderLayer!);
		effect.cut.includeInBuild = false;
		effect.root.includeInBuild = false;
		renderer.renderPipes.batch.break(instructions);
		instructions.add({ renderPipeId: effect.pipe, action: 'cutEnd', canBundle: false });
	}

	public pop(effect: Effect, target: Container, instructions: InstructionSet): void {
		if (!(effect instanceof GraphicsStencilMask))
			throw new Error('Unexpected stencil effect');
		this._renderer.renderPipes.stencilMask.pop(effect.keep, target, instructions);
	}

	public execute(instruction: Instruction): void {
		const renderer = this._renderer;
		const gpuTarget = renderer.renderTarget.getGpuRenderTarget(renderer.renderTarget.renderTarget);
		const reference = gpuTarget.stencilReference;
		if (instruction.action === 'cutBegin') {
			renderer.colorMask.setMask(0);
			renderer.stencil.setStencilMode(STENCIL_MODES.RENDERING_MASK_REMOVE, reference);
		} else {
			renderer.stencil.setStencilMode(STENCIL_MODES.MASK_ACTIVE, reference);
			renderer.colorMask.setMask(15);
		}
	}

	public destroy(): void { /* Renderer owns the stencil stack. */ }
}

extensions.add(PandoraStencilMaskPipe);

type MaskRenderer = WebGLRenderer | WebGPURenderer;
type MaskRasterCache = ExactMaskRasterCache<MaskRasterResource, Texture>;

/** One queue per renderer; rasterize before renderStart, never inside an active draw pass. */
class MaskRasterQueue {
	private readonly _pending = new Set<GraphicsRasterStencilMask>();
	private readonly _renderer: MaskRenderer;
	private _owners = 0;
	private _flushing = false;

	constructor(renderer: MaskRenderer) {
		this._renderer = renderer;
		renderer.runners.prerender.add(this);
	}

	public retain(): void {
		this._owners++;
	}
	public enqueue(mask: GraphicsRasterStencilMask): void {
		this._pending.add(mask);
	}
	public release(mask: GraphicsRasterStencilMask): void {
		this._pending.delete(mask);
		if (--this._owners === 0) {
			this._renderer.runners.prerender.remove(this);
			maskRasterQueues.delete(this._renderer);
		}
	}

	public prerender(options: RenderOptions): void {
		if (this._flushing || this._pending.size === 0)
			return;
		this._flushing = true;
		try {
			const target = this._renderer.renderTarget.getRenderTarget(options.target!);
			const frame = new GraphicsMaskRenderFrame(options.container, target.width, target.height, options.transform);
			const groups = new Map<MaskRasterCache, ExactMaskRasterRequest<Texture>[]>();
			for (const mask of this._pending) {
				const request = mask.prepare(frame);
				if (request === true) {
					this._pending.delete(mask);
				} else if (request !== false) {
					let requests = groups.get(mask.cache);
					if (!requests) {
						requests = [];
						groups.set(mask.cache, requests);
					}
					requests.push(request);
				}
			}
			for (const [cache, requests] of groups) {
				const rasters = cache.reconcile(requests);
				for (const { owner } of requests) {
					const mask = owner as GraphicsRasterStencilMask;
					mask.apply(rasters.get(mask)!);
					this._pending.delete(mask);
				}
			}
		} finally {
			this._flushing = false;
		}
	}
}
const maskRasterQueues = new WeakMap<MaskRenderer, MaskRasterQueue>();
const maskRasterScopes = new WeakMap<MaskRenderer, WeakMap<object, Map<MaskRasterFormat, MaskRasterCache>>>();

/** A shared raster owns its source geometry; clothing owners can safely disappear independently. */
class MaskRasterResource {
	public readonly texture: RenderTexture;
	private readonly _geometry: MeshGeometry;
	private readonly _source: Mesh<MeshGeometry, Shader>;
	private readonly _state = new RasterMaskGeometryState();
	private readonly _renderer: MaskRenderer;
	private readonly _packingShader: GraphicsMaskPackingShader | undefined;

	public get bounds(): Readonly<RasterMaskBounds> {
		return this._state.bounds;
	}

	constructor(renderer: MaskRenderer, snapshot: ExactMaskRasterSnapshot<Texture>, format: MaskRasterFormat) {
		this._renderer = renderer;
		this.texture = RenderTexture.create({ width: 1500, height: 1500, format });
		this._geometry = new MeshGeometry({ positions: snapshot.positions, uvs: snapshot.uvs, indices: snapshot.indices });
		this._geometry.batchMode = 'no-batch';
		this._geometry.getBuffer('aPosition').static = false;
		this._packingShader = format === 'rg8unorm' ? new GraphicsMaskPackingShader(snapshot.texture) : undefined;
		this._source = new Mesh({ geometry: this._geometry, texture: snapshot.texture, shader: this._packingShader });
		this._source.position.set(250, 0);
		try {
			this.update(snapshot);
		} catch (error) {
			this.destroy();
			throw error;
		}
	}

	public update(snapshot: ExactMaskRasterSnapshot<Texture>): void {
		const geometry = this._geometry;
		if (geometry.positions !== snapshot.positions) geometry.positions = snapshot.positions;
		if (geometry.uvs !== snapshot.uvs) geometry.uvs = snapshot.uvs;
		if (geometry.indices !== snapshot.indices) geometry.indices = snapshot.indices;
		this._source.texture = snapshot.texture;
		this._packingShader?.updateTexture(snapshot.texture);
		this._state.update(snapshot.positions, snapshot.uvs, snapshot.indices);
		// Keep the original texture size/projection for identical threshold edges.
		// Scissor only the union of current and previously drawn geometry bounds.
		const renderer = this._renderer;
		if ('gl' in renderer) {
			const gl = renderer.gl;
			const wasEnabled = gl.isEnabled(gl.SCISSOR_TEST);
			const previous = wasEnabled ? gl.getParameter(gl.SCISSOR_BOX) as Int32Array : null;
			const area = this._state.bounds;
			gl.enable(gl.SCISSOR_TEST);
			gl.scissor(area.x, area.y, area.width, area.height);
			try {
				renderer.render({ container: this._source, target: this.texture, clear: true });
			} finally {
				if (previous) {
					gl.scissor(previous[0], previous[1], previous[2], previous[3]);
				} else {
					gl.disable(gl.SCISSOR_TEST);
				}
			}
		} else {
			renderer.render({ container: this._source, target: this.texture, clear: true });
		}
	}

	public destroy(): void {
		this._source.destroy({ texture: false, textureSource: false });
		this._packingShader?.destroy();
		this._geometry.destroy();
		this.texture.destroy(true);
	}
}

/** Preserve legacy compositing; coalesce pose changes and share only exact rasters in an explicit scope. */
export class GraphicsRasterStencilMask {
	public readonly effect: GraphicsStencilMask;
	public readonly cache: MaskRasterCache;
	private readonly _geometry = new MeshGeometry({
		positions: new Float32Array([-250, 0, 1250, 0, 1250, 1500, -250, 1500]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
	});
	private _inputTexture: Texture;
	private _inputGeometry: MeshGeometry;
	private readonly _queue: MaskRasterQueue;
	private readonly _state = new RasterMaskGeometryState();
	private _dirty = true;
	private _inputsChanged = true;
	private readonly _invalidate = () => {
		this.cache.invalidate(this._inputTexture);
		this._dirty = true;
		this._queue.enqueue(this);
	};

	constructor(app: Application, texture: Texture, geometry: MeshGeometry, scope: object = {}, format: MaskRasterFormat = 'rg8unorm') {
		const renderer = app.renderer;
		if (!('gl' in renderer) && !('gpu' in renderer))
			throw new Error('Stencil masking requires WebGL or WebGPU');
		let queue = maskRasterQueues.get(renderer);
		if (!queue) {
			queue = new MaskRasterQueue(renderer);
			maskRasterQueues.set(renderer, queue);
		}
		this._queue = queue;
		queue.retain();
		let scopes = maskRasterScopes.get(renderer);
		if (!scopes) {
			scopes = new WeakMap();
			maskRasterScopes.set(renderer, scopes);
		}
		let formats = scopes.get(scope);
		if (!formats) {
			formats = new Map();
			scopes.set(scope, formats);
		}
		let cache = formats.get(format);
		if (!cache) {
			cache = new ExactMaskRasterCache({
				create: (snapshot) => new MaskRasterResource(renderer, snapshot, format),
				update: (resource, snapshot) => resource.update(snapshot),
				destroy: (resource) => resource.destroy(),
			});
			formats.set(format, cache);
		}
		this.cache = cache;
		this._inputTexture = texture;
		this._inputGeometry = geometry;
		this._listen(texture);
		this.effect = new GraphicsStencilMask(Texture.EMPTY, this._geometry, true, format);
		this._queue.enqueue(this);
	}

	private _listen(texture: Texture): void {
		texture.on('update', this._invalidate);
		texture.source.on('update', this._invalidate);
	}

	private _unlisten(texture: Texture): void {
		texture.off('update', this._invalidate);
		texture.source.off('update', this._invalidate);
	}

	/** Queue the latest inputs. Several pose/texture updates before a draw need only one raster. */
	public update(texture: Texture, geometry: MeshGeometry): void {
		if (this._inputTexture !== texture) {
			this._unlisten(this._inputTexture);
			this._listen(texture);
			this._dirty = true;
		}
		this._inputGeometry = geometry;
		this._inputTexture = texture;
		this._inputsChanged = true;
		this._queue.enqueue(this);
	}

	/** @internal True = unchanged, false = waiting for visibility, otherwise a visible raster request. */
	public prepare(frame: GraphicsMaskRenderFrame): ExactMaskRasterRequest<Texture> | boolean {
		// Shared renderers can draw independent previews/captures. Rendering an
		// unrelated root must leave this owner's current raster and lease intact.
		if (!frame.contains(this.effect.root.parent))
			return false;
		const geometry = this._inputGeometry;
		if (this._inputsChanged) {
			this._dirty = this._state.update(geometry.positions, geometry.uvs, geometry.indices) || this._dirty;
			this._inputsChanged = false;
		}
		if (!this._dirty)
			return true;
		if (!frame.isVisible(this.effect.root.parent, this._state.bounds)) {
			// A previous pose must not cut visible pixels while this pose's mask is
			// offscreen. Empty sampling makes the stencil pass admit all pixels.
			if (this.effect.cut.texture !== Texture.EMPTY)
				this.effect.update(Texture.EMPTY, this._geometry);
			this.cache.release(this);
			return false;
		}
		return { owner: this, texture: this._inputTexture, positions: geometry.positions, uvs: geometry.uvs, indices: geometry.indices };
	}

	/** @internal Called after all pending masks in this scope have reconciled together. */
	public apply(resource: MaskRasterResource): void {
		if (this.effect.cut.texture !== resource.texture)
			this.effect.update(resource.texture, this._geometry);
		this.effect.updateRasterBounds({ x: 0, y: 0, width: 1500, height: 1500 }, this._state.bounds);
		this._dirty = false;
	}

	public destroy(): void {
		this._queue.release(this);
		this._unlisten(this._inputTexture);
		this.effect.destroy();
		this._geometry.destroy();
		this.cache.release(this);
	}
}
