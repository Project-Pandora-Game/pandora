import {
	Container, Mesh, MeshGeometry, RenderTexture, Shader, Texture,
	type Application, type RenderOptions, type WebGLRenderer,
} from 'pixi.js';
import { RasterMaskGeometryState, type RasterMaskBounds } from './graphicsMaskGeometry.ts';
import { GraphicsMaskRenderFrame } from './graphicsMaskRenderFrame.ts';
import { ExactMaskRasterCache, type ExactMaskRasterRequest, type ExactMaskRasterSnapshot } from './graphicsExactMaskRasterCache.ts';
import { GraphicsMaskPackingShader } from './graphicsMaskTexture.ts';

type MaskRenderer = WebGLRenderer;
const retirementObservers = new WeakMap<MaskRenderer, Set<(texture: Texture) => void>>();

/** Notify consumers before a shared raster's final lease frees its texture. */
export function ObserveMaskRasterRetirement(renderer: MaskRenderer, callback: (texture: Texture) => void): () => void {
	let observers = retirementObservers.get(renderer);
	if (!observers) retirementObservers.set(renderer, observers = new Set<(texture: Texture) => void>());
	observers.add(callback);
	return () => {
		observers.delete(callback);
		if (observers.size === 0) retirementObservers.delete(renderer);
	};
}

type MaskRasterCache = ExactMaskRasterCache<MaskRasterResource, Texture>;

/** One queue per renderer; rasterize before renderStart, never inside an active draw pass. */
class MaskRasterQueue {
	private readonly _pending = new Set<GraphicsMaskRaster>();
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
	public enqueue(mask: GraphicsMaskRaster): void {
		this._pending.add(mask);
	}
	public release(mask: GraphicsMaskRaster): void {
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
					const mask = owner as GraphicsMaskRaster;
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
const maskRasterScopes = new WeakMap<MaskRenderer, WeakMap<object, Map<number, MaskRasterCache>>>();

/** A shared raster owns its source geometry; clothing owners can safely disappear independently. */
class MaskRasterResource {
	public readonly texture: RenderTexture;
	private readonly _geometry: MeshGeometry;
	private readonly _source: Mesh<MeshGeometry, Shader>;
	private readonly _state = new RasterMaskGeometryState();
	private readonly _renderer: MaskRenderer;
	private readonly _packingShader: GraphicsMaskPackingShader;

	public get bounds(): Readonly<RasterMaskBounds> {
		return this._state.bounds;
	}

	constructor(renderer: MaskRenderer, snapshot: ExactMaskRasterSnapshot<Texture>, resolution: number) {
		this._renderer = renderer;
		this.texture = RenderTexture.create({ width: 1500, height: 1500, resolution, format: 'rg8unorm' });
		this._geometry = new MeshGeometry({ positions: snapshot.positions, uvs: snapshot.uvs, indices: snapshot.indices });
		this._geometry.batchMode = 'no-batch';
		this._geometry.getBuffer('aPosition').static = false;
		this._packingShader = new GraphicsMaskPackingShader(snapshot.texture);
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
		this._packingShader.updateTexture(snapshot.texture);
		this._state.update(snapshot.positions, snapshot.uvs, snapshot.indices);
		// Keep skinning in logical character coordinates at every texture quality.
		// Scissor only the union of current and previously drawn geometry bounds.
		const renderer = this._renderer;
		const gl = renderer.gl;
		const wasEnabled = gl.isEnabled(gl.SCISSOR_TEST);
		const previous = wasEnabled ? gl.getParameter(gl.SCISSOR_BOX) as Int32Array : null;
		const area = this._state.bounds;
		const resolution = this.texture.source.resolution;
		const x = Math.floor(area.x * resolution);
		const y = Math.floor(area.y * resolution);
		gl.enable(gl.SCISSOR_TEST);
		gl.scissor(x, y, Math.ceil((area.x + area.width) * resolution) - x, Math.ceil((area.y + area.height) * resolution) - y);
		try {
			renderer.render({ container: this._source, target: this.texture, clear: true });
		} finally {
			if (previous) {
				gl.scissor(previous[0], previous[1], previous[2], previous[3]);
			} else {
				gl.disable(gl.SCISSOR_TEST);
			}
		}
	}

	public destroy(): void {
		for (const observer of retirementObservers.get(this._renderer) ?? []) observer(this.texture);
		this._source.destroy({ texture: false, textureSource: false });
		this._packingShader.destroy();
		this._geometry.destroy();
		this.texture.destroy(true);
	}
}

/** Preserve legacy compositing; coalesce pose changes and share only exact rasters in an explicit scope. */
export class GraphicsMaskRaster {
	public readonly anchor = new Container();
	public texture: Texture = Texture.EMPTY;
	public revision = 0;
	public readonly cache: MaskRasterCache;
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

	constructor(app: Application, texture: Texture, geometry: MeshGeometry, scope: object = {}, resolution: number = 1) {
		const renderer = app.renderer;
		if (!('gl' in renderer))
			throw new Error('Masking requires WebGL');
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
		let resolutions = scopes.get(scope);
		if (!resolutions) {
			resolutions = new Map();
			scopes.set(scope, resolutions);
		}
		let cache = resolutions.get(resolution);
		if (!cache) {
			cache = new ExactMaskRasterCache({
				create: (snapshot) => new MaskRasterResource(renderer, snapshot, resolution),
				update: (resource, snapshot) => resource.update(snapshot),
				destroy: (resource) => resource.destroy(),
			});
			resolutions.set(resolution, cache);
		}
		this.cache = cache;
		this._inputTexture = texture;
		this._inputGeometry = geometry;
		this._listen(texture);
		this.anchor.measurable = false;
		this.anchor.includeInBuild = false;
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
		if (!frame.contains(this.anchor.parent))
			return false;
		const geometry = this._inputGeometry;
		if (this._inputsChanged) {
			this._dirty = this._state.update(geometry.positions, geometry.uvs, geometry.indices) || this._dirty;
			this._inputsChanged = false;
		}
		if (!this._dirty)
			return true;
		if (!frame.isVisible(this.anchor.parent, this._state.bounds)) {
			// A previous pose must not cut visible pixels while this pose's mask is
			// offscreen. Empty sampling leaves visible clothing uncut.
			if (this.texture !== Texture.EMPTY) {
				this.texture = Texture.EMPTY;
				this.revision++;
				this._invalidateCachedAncestors();
			}
			this.cache.release(this);
			return false;
		}
		return { owner: this, texture: this._inputTexture, positions: geometry.positions, uvs: geometry.uvs, indices: geometry.indices };
	}

	/** @internal Called after all pending masks in this scope have reconciled together. */
	public apply(resource: MaskRasterResource): void {
		this.texture = resource.texture;
		this.revision++;
		this._invalidateCachedAncestors();
		this._dirty = false;
	}

	private _invalidateCachedAncestors(): void {
		for (let parent = this.anchor.parent; parent; parent = parent.parent) {
			if (parent.renderGroup?.isCachedAsTexture) parent.updateCacheTexture();
		}
	}

	public destroy(): void {
		this._queue.release(this);
		this._unlisten(this._inputTexture);
		this.anchor.destroy();
		this.texture = Texture.EMPTY;
		this.cache.release(this);
	}
}
