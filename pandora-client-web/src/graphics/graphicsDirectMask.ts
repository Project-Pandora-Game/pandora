/* eslint-disable @typescript-eslint/no-deprecated -- Preserve Pixi renderer overloads. */
import { Assert } from 'pandora-common';
import {
	Container, ExtensionType, Matrix, Mesh, Shader, Texture, UniformGroup, extensions,
	compileHighShaderGlProgram, localUniformBitGl,
	roundPixelsBitGl, textureBitGl,
	type Effect, type RenderOptions, type Instruction, type InstructionPipe, type InstructionSet, type TextureShader, type WebGLRenderer,
} from 'pixi.js';
import { CreateDirectMaskResources, UnbindDirectMaskTexture, UpdateDirectMaskResources, type DirectMaskSample } from './graphicsDirectMaskResources.ts';
import { GraphicsMaskRaster, ObserveMaskRasterRetirement } from './graphicsMaskRaster.ts';
import { GraphicsDirectMaskCoverage } from './graphicsDirectMaskCoverage.ts';
import { InstallDirectMaskDrawPipes } from './graphicsDirectMaskDrawPipes.ts';
import { DIRECT_MASK_MAX_DEPTH, GetDirectMaskPrograms } from './graphicsDirectMaskShader.ts';

type Renderer = WebGLRenderer;
export interface DirectMaskStatistics { directGroups: number; directDraws: number; coverageDraws: number; }
interface DirectInstruction extends Instruction { effect: GraphicsDirectMask; action: 'push' | 'pop'; }
interface FusedShader { shader: Shader; uniforms: UniformGroup; }
interface MeshBase { shader: Shader; onDestroyed: () => void; }
const states = new WeakMap<Renderer, DirectMaskState>();

export function GetDirectMaskStatistics(renderer: Renderer, reset = false): DirectMaskStatistics {
	const state = states.get(renderer);
	const result = state ? { ...state.statistics, coverageDraws: state.coverage.draws } : { directGroups: 0, directDraws: 0, coverageDraws: 0 };
	if (reset && state) {
		state.statistics = { directGroups: 0, directDraws: 0, coverageDraws: 0 };
		state.coverage.draws = 0;
	}
	return result;
}

/** Borrow only initialized bindings; native global/local groups may be assigned later. */
function MaterialResources(shader: Shader): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [group, bindings] of Object.entries(shader._uniformBindMap)) {
		const resources = shader.groups[Number(group)];
		if (!resources) continue;
		for (const [binding, name] of Object.entries(bindings)) {
			if (name === 'globalUniforms') continue;
			const resource: unknown = resources.getResource(Number(binding));
			if (resource != null) result[name] = resource;
		}
	}
	return result;
}

let basePrograms: ReturnType<typeof BasePrograms> | undefined;
function BasePrograms() {
	return {
		glProgram: compileHighShaderGlProgram({ name: 'pandora-direct-base', bits: [localUniformBitGl, textureBitGl, roundPixelsBitGl] }),
	};
}

/** One renderer-local mask scope, shared by every native draw family. */
class DirectMaskState {
	public readonly active: GraphicsDirectMask[] = [];
	public readonly building: GraphicsDirectMask[] = [];
	public statistics: DirectMaskStatistics = { directGroups: 0, directDraws: 0, coverageDraws: 0 };
	public readonly coverage: GraphicsDirectMaskCoverage;
	public owners = 0;
	public readonly renderer: Renderer;
	private readonly _restore: (() => void)[] = [];
	private readonly _bases = new Map<Mesh, MeshBase>();
	private readonly _variants = new Map<Shader, Map<string, FusedShader>>();
	private readonly _listeners = new Map<Shader, () => void>();
	private readonly _pixelToClip = new Matrix();
	private readonly _maskToLocal = new Matrix();
	private readonly _samplesByDepth = new Map<number, DirectMaskSample[]>();
	private readonly _clipToLocal = new Matrix();
	private readonly _worldUniform = new Matrix();
	private _world = new Matrix();

	constructor(renderer: Renderer) {
		this.renderer = renderer;
		this.coverage = new GraphicsDirectMaskCoverage(renderer, (texture) => this.forgetTexture(texture));
		this._restore.push(ObserveMaskRasterRetirement(renderer, (texture) => this.forgetTexture(texture)));
		const pipe = renderer.renderPipes.mesh;
		// eslint-disable-next-line @typescript-eslint/unbound-method -- Called with its native receiver.
		const nativeDraw = pipe.execute;
		const draw: typeof pipe.execute = (mesh) => {
			if (!mesh.isRenderable || this.active.length === 0) return nativeDraw.call(pipe, mesh);
			const original = mesh.shader;
			const base = original ?? this._base(mesh);
			if (!original) {
				base.resources.uTexture = mesh.texture.source;
				base.resources.uSampler = mesh.texture.source.style;
				const uniforms = base.resources.textureUniforms as UniformGroup;
				uniforms.uniforms.uTextureMatrix = mesh.texture.textureMatrix.mapCoord;
				uniforms.update();
			}
			mesh._shader = this.prepare(base, mesh.worldTransform, mesh.groupTransform) as TextureShader;
			try {
				nativeDraw.call(pipe, mesh);
			} finally {
				mesh._shader = original;
			}
		};
		pipe.execute = draw;
		this._restore.push(() => {
			if (pipe.execute === draw) pipe.execute = nativeDraw;
		});
		this._installScopes();
		if (renderer.renderPipes.batch && renderer.renderPipes.graphics) {
			this._restore.push(InstallDirectMaskDrawPipes(renderer, {
				isBuildingMasked: (renderable) => {
					if (this.building.length > 0) return true;
					for (let parent = renderable; parent; parent = parent.parent ?? undefined)
						if (parent.effects?.some((effect) => effect instanceof GraphicsDirectMask)) return true;
					return false;
				},
				isRenderingMasked: () => this.active.length > 0,
				getRenderGroupWorld: () => this._world,
				prepare: (shader, transform) => this.active.length ? this.prepare(shader, transform.worldTransform, transform.groupTransform) : undefined,
			}));
		}
	}

	private _base(mesh: Mesh): Shader {
		let entry = this._bases.get(mesh);
		if (!entry) {
			const shader = new Shader({
				...(basePrograms ??= BasePrograms()), resources: {
					uTexture: mesh.texture.source, uSampler: mesh.texture.source.style,
					textureUniforms: new UniformGroup({ uTextureMatrix: { type: 'mat3x3<f32>', value: mesh.texture.textureMatrix.mapCoord } }),
				},
			});
			const onDestroyed = () => {
				mesh.off('destroyed', onDestroyed);
				(shader.resources.textureUniforms as UniformGroup).buffer?.destroy();
				shader.destroy();
				this._bases.delete(mesh);
			};
			entry = { shader, onDestroyed };
			this._bases.set(mesh, entry);
			mesh.once('destroyed', onDestroyed);
		}
		return entry.shader;
	}

	private _samples(world: Matrix, group: Matrix): DirectMaskSample[] {
		const renderer = this.renderer;
		const globals = renderer.globalUniforms.globalUniformData;
		this._worldUniform.copyFrom(globals.worldTransformMatrix);
		this._worldUniform.tx -= globals.offset.x;
		this._worldUniform.ty -= globals.offset.y;
		this._clipToLocal.copyFrom(globals.projectionMatrix).append(this._worldUniform).append(group).invert();
		const viewport = renderer.renderTarget.viewport;
		const y = renderer.renderTarget.renderTarget.isRoot ? renderer.renderTarget.renderTarget.pixelHeight - viewport.height - viewport.y : viewport.y;
		this._pixelToClip.set(2 / viewport.width, 0, 0, 2 / viewport.height,
			-1 - 2 * viewport.x / viewport.width, -1 - 2 * y / viewport.height);
		let samples = this._samplesByDepth.get(this.active.length);
		if (!samples) {
			samples = this.active.map(() => ({ texture: Texture.EMPTY, revision: 0, format: 'rg8unorm' as const, matrix: new Matrix() }));
			this._samplesByDepth.set(this.active.length, samples);
		}
		for (let i = 0; i < this.active.length; i++) {
			const mask = this.active[i];
			const sample = samples[i];
			this._maskToLocal.copyFrom(mask.anchor.worldTransform).invert().append(world).append(this._clipToLocal);
			sample.texture = mask.texture;
			sample.revision = mask.raster.revision;
			sample.matrix.set(1 / 1500, 0, 0, 1 / 1500, 250 / 1500, 0).append(this._maskToLocal).append(this._pixelToClip);
		}
		return samples;
	}

	public prepare(base: Shader, world: Matrix, group: Matrix): Shader {
		let samples = this._samples(world, group);
		if (samples.length > DIRECT_MASK_MAX_DEPTH) {
			samples = [this.coverage.compact(samples)];
		}
		const formats = samples.map((sample) => sample.format);
		const key = formats.join(',');
		let variants = this._variants.get(base);
		if (!variants) {
			this._variants.set(base, variants = new Map<string, FusedShader>());
			const onDestroy = () => this._releaseShader(base);
			base.once('destroy', onDestroy);
			this._listeners.set(base, onDestroy);
		}
		let fused = variants.get(key);
		if (!fused) {
			const resources = CreateDirectMaskResources(samples);
			Object.assign(resources, MaterialResources(base));
			const shader = new Shader({ ...GetDirectMaskPrograms(base.glProgram, samples.length, formats), resources, overrides: base._overrides ?? undefined });
			fused = { shader, uniforms: resources.directMaskUniforms };
			variants.set(key, fused);
		}
		// Material bindings live in the fused shader; native adaptors supply globals.
		for (const [name, resource] of Object.entries(MaterialResources(base))) fused.shader.resources[name] = resource;
		UpdateDirectMaskResources(fused, samples);
		this.statistics.directDraws++;
		return fused.shader;
	}

	private _releaseShader(base: Shader): void {
		const listener = this._listeners.get(base);
		if (listener) base.off('destroy', listener);
		this._listeners.delete(base);
		for (const fused of this._variants.get(base)?.values() ?? []) {
			fused.shader.destroy();
			fused.uniforms.buffer?.destroy();
		}
		this._variants.delete(base);
	}

	private _installScopes(): void {
		const renderer = this.renderer;
		/* eslint-disable @typescript-eslint/unbound-method -- Every original keeps its native receiver. */
		const nativeRender = renderer.render;
		const render = (options: Container | RenderOptions, legacy?: unknown) => {
			const active = this.active.splice(0); const building = this.building.splice(0);
			const world = this._world;
			const container = options instanceof Container ? options : options.container;
			container.enableRenderGroup();
			this._world = container.renderGroup.worldTransform;
			try {
				Reflect.apply(nativeRender, renderer, legacy === undefined ? [options] : [options, legacy]);
			} finally {
				this.active.splice(0, this.active.length, ...active);
				this.building.splice(0, this.building.length, ...building);
				this._world = world;
			}
		};
		renderer.render = render;
		this._restore.push(() => {
			if (renderer.render === render) renderer.render = nativeRender;
		});
		const groupPipe = renderer.renderPipes.renderGroup;
		if (groupPipe) {
			const native = groupPipe.execute;
			const execute: typeof native = (group) => {
				const world = this._world;
				this._world = group.root.worldTransform;
				const inherited = group.isCachedAsTexture ? this.active.splice(0) : undefined;
				try {
					native.call(groupPipe, group);
				} finally {
					this._world = world;
					if (inherited) this.active.splice(0, this.active.length, ...inherited);
				}
			};
			groupPipe.execute = execute;
			this._restore.push(() => {
				if (groupPipe.execute === execute) groupPipe.execute = native;
			});
		}
		/* eslint-enable @typescript-eslint/unbound-method */
	}

	public forgetTexture(texture: Texture): void {
		if (texture === Texture.EMPTY) return;
		for (const variants of this._variants.values())
			for (const { shader } of variants.values()) UnbindDirectMaskTexture(shader, texture);
		for (const samples of this._samplesByDepth.values())
			for (const sample of samples) if (sample.texture === texture) sample.texture = Texture.EMPTY;
		this.coverage.forgetTexture(texture);
	}

	public release(): void {
		if (--this.owners > 0) return;
		for (const restore of this._restore.reverse()) restore();
		for (const entry of [...this._bases.values()]) entry.onDestroyed();
		for (const shader of [...this._variants.keys()]) this._releaseShader(shader);
		this.coverage.destroy();
		this.active.length = 0;
		states.delete(this.renderer);
	}
}

/** Binary fragment clipping over the accumulated layers, across native draw families. */
export class GraphicsDirectMask implements Effect {
	public readonly pipe = 'pandoraDirectMask';
	public readonly priority = 0;
	public readonly anchor: Container;
	public readonly raster: GraphicsMaskRaster;
	public readonly state: DirectMaskState;

	constructor(renderer: Renderer, raster: GraphicsMaskRaster) {
		this.raster = raster;
		this.anchor = raster.anchor;
		let state = states.get(renderer);
		if (!state) states.set(renderer, state = new DirectMaskState(renderer));
		state.owners++;
		this.state = state;
	}
	public get texture(): Texture {
		return this.raster.texture;
	}
	public destroy(): void {
		this.state.forgetTexture(this.texture);
		this.state.release();
	}
}

class DirectMaskPipe implements InstructionPipe<DirectInstruction> {
	public static readonly extension = { type: ExtensionType.WebGLPipes, name: 'pandoraDirectMask' };
	public push(effect: Effect, _target: Container, instructions: InstructionSet): void {
		Assert(effect instanceof GraphicsDirectMask);
		effect.state.building.push(effect);
		const renderer = effect.state.renderer;
		renderer.renderPipes.batch.break(instructions);
		const instruction: DirectInstruction = { renderPipeId: effect.pipe, action: 'push', effect, canBundle: false };
		instructions.add(instruction);
	}
	public pop(effect: Effect, _target: Container, instructions: InstructionSet): void {
		Assert(effect instanceof GraphicsDirectMask);
		Assert(effect.state.building.pop() === effect, 'Unbalanced mask build stack');
		effect.state.renderer.renderPipes.batch.break(instructions);
		const instruction: DirectInstruction = { renderPipeId: effect.pipe, action: 'pop', effect, canBundle: false };
		instructions.add(instruction);
	}
	public execute(instruction: DirectInstruction): void {
		const state = instruction.effect.state;
		if (instruction.action === 'push') {
			state.active.push(instruction.effect);
			state.statistics.directGroups++;
		} else Assert(state.active.pop() === instruction.effect, 'Unbalanced mask draw stack');
	}
	public destroy(): void { /* Renderer-local owners restore their own draw hooks. */ }
}
extensions.add(DirectMaskPipe);
