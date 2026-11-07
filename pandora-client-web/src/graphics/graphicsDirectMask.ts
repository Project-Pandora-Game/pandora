/* eslint-disable @typescript-eslint/no-deprecated -- Intercept both Pixi renderer overloads without changing their behavior. */
import { Assert } from 'pandora-common';
import {
	Container, ExtensionType, Matrix, Mesh, Shader, Texture, UniformGroup, extensions,
	compileHighShaderGlProgram, compileHighShaderGpuProgram, localUniformBit, localUniformBitGl,
	roundPixelsBit, roundPixelsBitGl, textureBit, textureBitGl,
	type Effect, type RenderOptions, type Instruction, type InstructionPipe, type InstructionSet, type TextureShader, type WebGLRenderer, type WebGPURenderer,
} from 'pixi.js';
import { GraphicsRasterStencilMask, GraphicsStencilMask } from './graphicsStencilMask.ts';
import type { MaskRasterFormat } from './graphicsMaskTexture.ts';
import { DIRECT_MASK_MAX_DEPTH, GetDirectMaskPrograms } from './graphicsDirectMaskShader.ts';

type Renderer = WebGLRenderer | WebGPURenderer;
export type DirectMaskFallbackReason = 'unsupported-renderable' | 'filter' | 'depth' | 'render-group' | 'format';
export interface DirectMaskStatistics {
	directGroups: number;
	directDraws: number;
	fallbackGroups: number;
	fallbackReasons: Partial<Record<DirectMaskFallbackReason, number>>;
}
interface DirectInstruction extends Instruction { effect: GraphicsDirectMask; action: string; }
interface FusedShader { shader: Shader; uniforms: UniformGroup; }
interface MeshShaders {
	mesh: Mesh;
	base: Shader;
	variants: Map<Shader, Map<number, FusedShader>>;
	listeners: Map<Shader, () => void>;
	onDestroyed: () => void;
}
const states = new WeakMap<Renderer, DirectMaskState>();

/** Exposed for qualification: counts execution, including every explicit correctness fallback. */
export function GetDirectMaskStatistics(renderer: Renderer, reset = false): DirectMaskStatistics {
	const state = states.get(renderer);
	const result = state ? { ...state.statistics, fallbackReasons: { ...state.statistics.fallbackReasons } } : { directGroups: 0, directDraws: 0, fallbackGroups: 0, fallbackReasons: {} };
	if (reset && state) state.statistics = { directGroups: 0, directDraws: 0, fallbackGroups: 0, fallbackReasons: {} };
	return result;
}

const defaultGl = () => compileHighShaderGlProgram({ name: 'pandora-direct-base', bits: [localUniformBitGl, textureBitGl, roundPixelsBitGl] });
const defaultGpu = () => compileHighShaderGpuProgram({ name: 'pandora-direct-base', bits: [localUniformBit, textureBit, roundPixelsBit] });
let basePrograms: { glProgram: ReturnType<typeof defaultGl>; gpuProgram: ReturnType<typeof defaultGpu>; } | undefined;

/** Renderer-local interception is installed only while this experimental mode has live owners. */
class DirectMaskState {
	public readonly active: GraphicsDirectMask[] = [];
	public readonly building: GraphicsDirectMask[] = [];
	public statistics: DirectMaskStatistics = { directGroups: 0, directDraws: 0, fallbackGroups: 0, fallbackReasons: {} };
	public owners = 0;
	private readonly _renderer: Renderer;
	private readonly _original: Renderer['renderPipes']['mesh']['execute'];
	private readonly _wrapped: Renderer['renderPipes']['mesh']['execute'];
	private readonly _shaders = new WeakMap<Mesh, MeshShaders>();
	private readonly _entries = new Set<MeshShaders>();
	private readonly _knownShaders = new WeakMap<Mesh, Shader | null>();
	private readonly _originalRender: Renderer['render'];
	private readonly _wrappedRender: Renderer['render'];
	private readonly _clipToLocal = new Matrix();
	private readonly _matrix = new Matrix();
	private readonly _worldUniform = new Matrix();
	private readonly _pixelToClip = new Matrix();

	constructor(renderer: Renderer) {
		this._renderer = renderer;
		const pipe = renderer.renderPipes.mesh;
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Called explicitly with the native pipe as receiver.
		this._original = pipe.execute;
		this._wrapped = (mesh) => this._draw(mesh);
		pipe.execute = this._wrapped;
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Called with Reflect.apply and the original renderer receiver.
		this._originalRender = renderer.render;
		this._wrappedRender = (options: Container | RenderOptions, legacyOptions?: unknown) => {
			// Nested previews/raster renders are independent scopes. Always restore
			// the enclosing render's stack, including when the renderer throws.
			const active = this.active.splice(0);
			const building = this.building.splice(0);
			const container = options instanceof Container ? options : options.container;
			try {
				if (container.renderGroup) this._validateShaderChanges(container.renderGroup);
				Reflect.apply(this._originalRender, renderer, legacyOptions === undefined ? [options] : [options, legacyOptions]);
			} finally {
				this.active.splice(0, this.active.length, ...active);
				this.building.splice(0, this.building.length, ...building);
			}
		};
		renderer.render = this._wrappedRender;
	}

	public remember(mesh: Mesh): void {
		this._knownShaders.set(mesh, mesh.shader);
	}

	private _validateShaderChanges(group: NonNullable<Container['renderGroup']>): void {
		const changed = group.childrenRenderablesToUpdate;
		for (let i = 0; i < changed.index; i++) {
			const mesh = changed.list[i];
			if (!IsMesh(mesh) || !this._knownShaders.has(mesh) || this._knownShaders.get(mesh) === mesh.shader) continue;
			this._knownShaders.set(mesh, mesh.shader);
			// Unbatched shader changes don't normally rebuild Pixi instructions.
			// Recheck group eligibility before the next draw, including debug/foreign materials.
			for (let parent = mesh.parent; parent; parent = parent.parent) {
				if (!parent.effects?.some((effect) => effect instanceof GraphicsDirectMask)) continue;
				const owner = parent.renderGroup ?? parent.parentRenderGroup;
				if (owner) owner.structureDidChange = true;
			}
		}
		for (const child of group.renderGroupChildren) this._validateShaderChanges(child);
	}

	public release(): void {
		if (--this.owners > 0) return;
		const pipe = this._renderer.renderPipes.mesh;
		if (pipe.execute === this._wrapped) pipe.execute = this._original;
		if (this._renderer.render === this._wrappedRender) this._renderer.render = this._originalRender;
		for (const entry of this._entries) this._cleanupEntry(entry);
		this.active.length = 0;
		states.delete(this._renderer);
	}

	private _meshShaders(mesh: Mesh): MeshShaders {
		let result = this._shaders.get(mesh);
		if (result) return result;
		basePrograms ??= { glProgram: defaultGl(), gpuProgram: defaultGpu() };
		result = {
			mesh, listeners: new Map(), onDestroyed: () => undefined,
			base: new Shader({
				...basePrograms, resources: {
					uTexture: mesh.texture.source, uSampler: mesh.texture.source.style,
					textureUniforms: new UniformGroup({ uTextureMatrix: { type: 'mat3x3<f32>', value: mesh.texture.textureMatrix.mapCoord } }),
				},
			}),
			variants: new Map(),
		};
		const entry = result;
		entry.onDestroyed = () => this._cleanupEntry(entry);
		mesh.once('destroyed', entry.onDestroyed);
		this._entries.add(entry);
		this._shaders.set(mesh, result);
		return result;
	}

	private _cleanupEntry(entry: MeshShaders): void {
		entry.mesh.off('destroyed', entry.onDestroyed);
		for (const [shader, listener] of entry.listeners) shader.off('destroy', listener);
		entry.listeners.clear();
		for (const variants of entry.variants.values()) for (const fused of variants.values()) this._destroyFused(fused);
		entry.variants.clear();
		(entry.base.resources.textureUniforms as UniformGroup).buffer?.destroy();
		entry.base.destroy();
		this._entries.delete(entry);
		this._shaders.delete(entry.mesh);
	}

	private _destroyFused(fused: FusedShader): void {
		// Destroy only owned bindings/buffer. Original textures, material and palette are borrowed.
		fused.shader.destroy();
		fused.uniforms.buffer?.destroy();
	}

	private _draw(mesh: Mesh): void {
		const renderer = this._renderer;
		const pipe = renderer.renderPipes.mesh;
		if (this.active.length === 0 || !mesh.isRenderable || GraphicsStencilMask.isHelperMesh(mesh)) {
			this._original.call(pipe, mesh);
			return;
		}
		const entry = this._meshShaders(mesh);
		const original = mesh.shader;
		const base = original ?? entry.base;
		if (!original) {
			base.resources.uTexture = mesh.texture.source;
			base.resources.uSampler = mesh.texture.source.style;
			const textureUniforms = base.resources.textureUniforms as UniformGroup;
			textureUniforms.uniforms.uTextureMatrix = mesh.texture.textureMatrix.mapCoord;
			textureUniforms.update();
		}
		Assert(base.glProgram && base.gpuProgram, 'Unsupported direct mask shader');
		let variants = entry.variants.get(base);
		if (!variants) {
			entry.variants.set(base, variants = new Map<number, FusedShader>());
			const onDestroy = () => {
				for (const cached of variants!.values()) this._destroyFused(cached);
				variants!.clear();
				entry.variants.delete(base);
				entry.listeners.delete(base);
			};
			base.once('destroy', onDestroy);
			entry.listeners.set(base, onDestroy);
		}
		const depth = this.active.length;
		let fused = variants.get(depth);
		if (!fused) {
			const matrices: Record<string, { type: 'mat3x3<f32>'; value: Matrix; }> = {};
			for (let i = 0; i < depth; i++) matrices[`uDirectMaskMatrix${i}`] = { type: 'mat3x3<f32>', value: new Matrix() };
			const uniforms = new UniformGroup(matrices);
			const resources: Record<string, unknown> = {};
			for (const key of MaterialResourceNames(base)) resources[key] = base.resources[key];
			resources.directMaskUniforms = uniforms;
			for (let i = 0; i < depth; i++) {
				resources[`uDirectMask${i}`] = this.active[i].texture.source;
				resources[`uDirectMaskSampler${i}`] = this.active[i].texture.source.style;
			}
			const shader = new Shader({ ...GetDirectMaskPrograms(base.glProgram, base.gpuProgram, depth), resources });
			variants.set(depth, fused = { shader, uniforms });
		}
		for (const key of MaterialResourceNames(base)) fused.shader.resources[key] = (base.resources as Record<string, unknown>)[key];
		// Derive mask coordinates from physical fragment pixels, independent of the
		// clothing triangle interpolation. Preserve active viewport and projection flips.
		const globals = renderer.globalUniforms.globalUniformData;
		this._worldUniform.copyFrom(globals.worldTransformMatrix);
		this._worldUniform.tx -= globals.offset.x;
		this._worldUniform.ty -= globals.offset.y;
		this._clipToLocal.copyFrom(globals.projectionMatrix).append(this._worldUniform).append(mesh.groupTransform).invert();
		const viewport = renderer.renderTarget.viewport;
		let viewportY = viewport.y;
		const gl = 'gl' in renderer;
		if (gl && renderer.renderTarget.renderTarget.isRoot)
			viewportY = renderer.renderTarget.renderTarget.pixelHeight - viewport.height - viewport.y;
		const directionY = gl ? 1 : -1;
		this._pixelToClip.set(2 / viewport.width, 0, 0, directionY * 2 / viewport.height,
			-1 - 2 * viewport.x / viewport.width, -directionY - directionY * 2 * viewportY / viewport.height);
		for (let i = 0; i < depth; i++) {
			const mask = this.active[i];
			this._matrix.copyFrom(mask.anchor.worldTransform).invert().append(mesh.worldTransform).append(this._clipToLocal);
			const uv = fused.uniforms.uniforms[`uDirectMaskMatrix${i}`] as Matrix;
			uv.set(1 / 1500, 0, 0, 1 / 1500, 250 / 1500, 0).append(this._matrix).append(this._pixelToClip);
			fused.shader.resources[`uDirectMask${i}`] = mask.texture.source;
			fused.shader.resources[`uDirectMaskSampler${i}`] = mask.texture.source.style;
		}
		fused.uniforms.update();
		// The temporary shader changes neither batch eligibility nor the retained
		// scene view. Avoid the public setter's per-draw invalidation notification.
		mesh._shader = fused.shader as TextureShader;
		try {
			this.statistics.directDraws++;
			this._original.call(pipe, mesh);
		} finally {
			mesh._shader = original;
		}
	}
}

/** Binary masking across the exact accumulated-layer subtree, with explicit stencil fallback. */
export class GraphicsDirectMask implements Effect {
	public readonly pipe = 'pandoraDirectMask';
	public readonly priority = 0;
	public readonly anchor: Container;
	public readonly raster: GraphicsRasterStencilMask;
	public readonly state: DirectMaskState;
	public readonly format: MaskRasterFormat;

	constructor(renderer: Renderer, raster: GraphicsRasterStencilMask, format: MaskRasterFormat = 'rg8unorm') {
		this.format = format;
		this.raster = raster;
		this.anchor = raster.effect.root;
		let state = states.get(renderer);
		if (!state) states.set(renderer, state = new DirectMaskState(renderer));
		state.owners++;
		this.state = state;
	}

	public get texture(): Texture {
		return this.raster.effect.cut.texture;
	}
	public destroy(): void {
		this.state.release();
	}
}

function IsMesh(container: Container): container is Mesh {
	return container instanceof Mesh;
}

function MaterialResourceNames(shader: Shader): string[] {
	return Object.getOwnPropertyNames(shader.resources).filter((name) => name !== 'globalUniforms' && name !== 'localUniforms');
}

function FallbackReason(container: Container, depth: number, state: DirectMaskState, root = container): DirectMaskFallbackReason | undefined {
	if (container !== root && container.renderGroup) return 'render-group';
	if (container.effects?.some((effect) => effect.pipe === 'filter')) return 'filter';
	if ('renderPipeId' in container && !IsMesh(container)) return 'unsupported-renderable';
	if (IsMesh(container)) {
		state.remember(container);
		if (container.batched) return 'unsupported-renderable';
	}
	if (IsMesh(container) && container.shader) {
		const { glProgram, gpuProgram } = container.shader;
		if (!glProgram || !gpuProgram) return 'unsupported-renderable';
		try {
			GetDirectMaskPrograms(glProgram, gpuProgram, depth);
		} catch {
			return 'unsupported-renderable';
		}
	}
	for (const child of container.children) {
		if (!child.includeInBuild || !child.visible || !child.renderable) continue;
		const reason = FallbackReason(child, depth, state, root);
		if (reason) return reason;
	}
	return undefined;
}

function AncestorDepth(target: Container): number {
	let depth = 0;
	for (let parent = target.parent; parent; parent = parent.parent)
		for (const effect of parent.effects ?? []) if (effect instanceof GraphicsDirectMask) depth++;
	return depth;
}

class DirectMaskPipe implements InstructionPipe<DirectInstruction> {
	public static readonly extension = { type: [ExtensionType.WebGLPipes, ExtensionType.WebGPUPipes], name: 'pandoraDirectMask' };
	private readonly _renderer: Renderer;
	private readonly _fallback = new WeakSet<GraphicsDirectMask>();

	constructor(renderer: Renderer) {
		this._renderer = renderer;
	}

	public push(effect: Effect, target: Container, instructions: InstructionSet): void {
		Assert(effect instanceof GraphicsDirectMask);
		const renderer = this._renderer;
		const state = effect.state;
		const depth = Math.max(state.building.length, AncestorDepth(target)) + 1;
		const reason = effect.format !== 'rg8unorm' ? 'format' : depth > DIRECT_MASK_MAX_DEPTH ? 'depth' : FallbackReason(target, depth, state);
		if (reason) {
			this._fallback.add(effect);
			(renderer.renderPipes as unknown as Record<string, Required<Pick<InstructionPipe<Instruction>, 'push' | 'pop'>>>).pandoraStencilMask.push(effect.raster.effect, target, instructions);
			const fallbackInstruction: DirectInstruction = { renderPipeId: effect.pipe, action: `fallback:${reason}`, effect, canBundle: false };
			instructions.add(fallbackInstruction);
			return;
		}
		this._fallback.delete(effect);
		state.building.push(effect);
		renderer.renderPipes.batch.break(instructions);
		const instruction: DirectInstruction = { renderPipeId: effect.pipe, action: 'push', effect, canBundle: false };
		instructions.add(instruction);
	}

	public pop(effect: Effect, target: Container, instructions: InstructionSet): void {
		Assert(effect instanceof GraphicsDirectMask);
		if (this._fallback.has(effect)) {
			(this._renderer.renderPipes as unknown as Record<string, Required<Pick<InstructionPipe<Instruction>, 'push' | 'pop'>>>).pandoraStencilMask.pop(effect.raster.effect, target, instructions);
			return;
		}
		Assert(effect.state.building.pop() === effect, 'Unbalanced direct mask build stack');
		this._renderer.renderPipes.batch.break(instructions);
		const instruction: DirectInstruction = { renderPipeId: effect.pipe, action: 'pop', effect, canBundle: false };
		instructions.add(instruction);
	}

	public execute(instruction: DirectInstruction): void {
		const state = instruction.effect.state;
		if (instruction.action === 'push') {
			state.active.push(instruction.effect);
			state.statistics.directGroups++;
		} else if (instruction.action === 'pop') {
			Assert(state.active.pop() === instruction.effect, 'Unbalanced direct mask draw stack');
		} else {
			const reason = instruction.action.slice('fallback:'.length) as DirectMaskFallbackReason;
			state.statistics.fallbackGroups++;
			state.statistics.fallbackReasons[reason] = (state.statistics.fallbackReasons[reason] ?? 0) + 1;
		}
	}

	public destroy(): void { /* Owners release interception; native pipes retain their own resources. */ }
}

extensions.add(DirectMaskPipe);
