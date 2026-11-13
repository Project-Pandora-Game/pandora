import { Assert } from 'pandora-common';
import {
	BatchGeometry, Batcher, DefaultBatcher,
	Matrix, Shader, State, UniformGroup,
	colorBitGl, compileHighShaderGlProgram,
	generateTextureBatchBitGl,
	roundPixelsBitGl,
	type Batch, type Container, type InstructionSet, type WebGLRenderer,
} from 'pixi.js';
import { DIRECT_MASK_MAX_DEPTH } from './graphicsDirectMaskShader.ts';

type Renderer = WebGLRenderer;

export interface DirectMaskDrawTransform {
	worldTransform: Matrix;
	groupTransform: Matrix;
}

export interface DirectMaskDrawHooks {
	isBuildingMasked(renderable?: Container): boolean;
	isRenderingMasked(): boolean;
	getRenderGroupWorld(): Matrix;
	prepare(shader: Shader, transform: DirectMaskDrawTransform): Shader | undefined;
}

function Samplers(count: number): UniformGroup {
	// Pixi assigns the fused mask samplers from slot zero. The material's array
	// uses our reserved higher slots instead, without changing any shared group.
	return new UniformGroup({
		uTextures: { type: 'i32', size: count, value: Int32Array.from({ length: count }, (_, i) => i + DIRECT_MASK_MAX_DEPTH) },
	}, { isStatic: true });
}

/** Own buffers, own shader and native packing arithmetic; no DefaultBatcher singleton. */
class MaskBatcher extends Batcher {
	public readonly name = 'pandora-direct-mask';
	public readonly vertexSize = 6;
	public readonly geometry = new BatchGeometry();
	public readonly shader: Shader;
	// Native packers deliberately run with this owned batcher's matching layout.
	/* eslint-disable @typescript-eslint/unbound-method */
	public readonly packAttributes = DefaultBatcher.prototype.packAttributes;
	public readonly packQuadAttributes = DefaultBatcher.prototype.packQuadAttributes;
	/* eslint-enable @typescript-eslint/unbound-method */
	private readonly _samplers: UniformGroup;

	constructor(maxTextures: number) {
		super({ maxTextures });
		this._samplers = Samplers(maxTextures);
		this.shader = new Shader({
			glProgram: compileHighShaderGlProgram({ name: 'pandora-direct-batch', bits: [colorBitGl, generateTextureBatchBitGl(maxTextures), roundPixelsBitGl] }),
			resources: { batchSamplers: this._samplers },
		});
	}

	public uploadGeometry(): void {
		this.geometry.indexBuffer.setDataWithSize(this.indexBuffer, this.indexSize, true);
		this.geometry.buffers[0].setDataWithSize(this.attributeBuffer.float32View, this.attributeSize, false);
	}

	public override destroy(): void {
		super.destroy({ shader: true });
		this._samplers.buffer?.destroy();
	}
}

/**
 * Extend the native draw families rather than replacing sprites with meshes.
 * Geometry, packed color, atlas/trim UVs, blend mode and batch order stay native.
 * The owner must invalidate masked instructions when it releases the hooks.
 */
export function InstallDirectMaskDrawPipes(renderer: Renderer, hooks: DirectMaskDrawHooks): () => void {
	const pipe = renderer.renderPipes.batch;
	// Keep receiver-bound originals; teardown restores exactly these functions.
	/* eslint-disable @typescript-eslint/unbound-method */
	const original = {
		addToBatch: pipe.addToBatch, break: pipe.break, buildStart: pipe.buildStart,
		buildEnd: pipe.buildEnd, upload: pipe.upload, execute: pipe.execute,
		destroyInstructionSet: pipe.destroyInstructionSet,
	};
	/* eslint-enable @typescript-eslint/unbound-method */
	const maxTextures = renderer.limits.maxBatchableTextures - DIRECT_MASK_MAX_DEPTH;
	Assert(maxTextures > 0, 'Renderer has no material samplers available for direct masks');
	const batchers = new Map<InstructionSet, MaskBatcher>();
	const groupRoots = new Map<Container, () => void>();
	const state = State.for2d();
	const identity = new Matrix();
	let nativeNeedsStart = false;
	let released = false;
	function RememberGroups(renderable: Container | undefined): void {
		if (!renderable) return;
		for (const group of [renderable.renderGroup, renderable.parentRenderGroup]) {
			const root = group?.root;
			if (!root || groupRoots.has(root)) continue;
			const onDestroyed = () => {
				groupRoots.delete(root);
			};
			groupRoots.set(root, onDestroyed);
			root.once('destroyed', onDestroyed);
		}
	}
	function DestroyBatcher(batcher: MaskBatcher): void {
		batcher.destroy();
	}

	function Draw(batch: Batch, shader: Shader, batcher: MaskBatcher): void {
		shader.groups[0] = renderer.globalUniforms.bindGroup;
		state.blendMode = batch.blendMode;
		renderer.state.set(state);
		// Always sync: unlike the native batch shader, mask matrices and textures
		// change between groups even when the compiled program is unchanged.
		renderer.shader.bind(shader, false);
		renderer.geometry.bind(batcher.geometry, shader.glProgram);
		for (let i = 0; i < batch.textures.count; i++) renderer.texture.bind(batch.textures.textures[i], i + DIRECT_MASK_MAX_DEPTH);
		renderer.texture.unbindIntegerTextures(batch.textures.count + DIRECT_MASK_MAX_DEPTH);
		renderer.geometry.draw(batch.topology, batch.size, batch.start);
		// Native batches may resume with action=renderBatch. They must rebind their
		// shader and geometry after our draw, including on WebGL.
		nativeNeedsStart = true;
	}

	const wrappedAdd: typeof pipe.addToBatch = (element, instructions) => {
		const renderable = 'renderable' in element ? element.renderable as Container : undefined;
		if (!hooks.isBuildingMasked(renderable) || element.batcherName !== 'default') {
			batchers.get(instructions)?.break(instructions);
			original.addToBatch.call(pipe, element, instructions);
			return;
		}
		RememberGroups(renderable);
		original.break.call(pipe, instructions);
		let batcher = batchers.get(instructions);
		if (!batcher) {
			batchers.set(instructions, batcher = new MaskBatcher(maxTextures));
			batcher.begin();
		}
		batcher.add(element);
	};
	const wrappedBreak: typeof pipe.break = (instructions) => {
		batchers.get(instructions)?.break(instructions);
		original.break.call(pipe, instructions);
	};
	const wrappedBuildStart: typeof pipe.buildStart = (instructions) => {
		batchers.get(instructions)?.begin();
		original.buildStart.call(pipe, instructions);
	};
	const wrappedBuildEnd: typeof pipe.buildEnd = (instructions) => {
		batchers.get(instructions)?.break(instructions);
		original.buildEnd.call(pipe, instructions);
		batchers.get(instructions)?.uploadGeometry();
	};
	const wrappedUpload: typeof pipe.upload = (instructions) => {
		original.upload.call(pipe, instructions);
		const batcher = batchers.get(instructions);
		if (batcher?.dirty) {
			batcher.dirty = false;
			batcher.geometry.buffers[0].update(batcher.attributeSize * 4);
		}
	};
	const wrappedExecute: typeof pipe.execute = (batch) => {
		if (!(batch.batcher instanceof MaskBatcher)) {
			const action = batch.action;
			if (nativeNeedsStart) batch.action = 'startBatch';
			try {
				original.execute.call(pipe, batch);
				nativeNeedsStart = false;
			} finally {
				batch.action = action;
			}
			return;
		}
		const shader = hooks.prepare(batch.batcher.shader, { worldTransform: hooks.getRenderGroupWorld(), groupTransform: identity }) ?? batch.batcher.shader;
		Draw(batch, shader, batch.batcher);
	};
	const wrappedDestroy: typeof pipe.destroyInstructionSet = (instructions) => {
		const batcher = batchers.get(instructions);
		if (batcher) DestroyBatcher(batcher);
		batchers.delete(instructions);
		original.destroyInstructionSet.call(pipe, instructions);
	};
	pipe.addToBatch = wrappedAdd;
	pipe.break = wrappedBreak;
	pipe.buildStart = wrappedBuildStart;
	pipe.buildEnd = wrappedBuildEnd;
	pipe.upload = wrappedUpload;
	pipe.execute = wrappedExecute;
	pipe.destroyInstructionSet = wrappedDestroy;

	return () => {
		if (released) return;
		released = true;
		// Child render groups retain independent instruction sets. Removing an
		// ancestor's mask does not rebuild them, so invalidate before freeing the
		// geometry those instructions reference. Cached ancestors must also redraw
		// pixels which may contain masks introduced inside their cached subtree.
		for (const [root, listener] of groupRoots) {
			root.off('destroyed', listener);
			for (let group = root.renderGroup; group; group = group.renderGroupParent) {
				group.structureDidChange = true;
				if (group.isCachedAsTexture) group.root.updateCacheTexture();
			}
		}
		groupRoots.clear();
		if (pipe.addToBatch === wrappedAdd) pipe.addToBatch = original.addToBatch;
		if (pipe.break === wrappedBreak) pipe.break = original.break;
		if (pipe.buildStart === wrappedBuildStart) pipe.buildStart = original.buildStart;
		if (pipe.buildEnd === wrappedBuildEnd) pipe.buildEnd = original.buildEnd;
		if (pipe.upload === wrappedUpload) pipe.upload = original.upload;
		if (pipe.execute === wrappedExecute) pipe.execute = original.execute;
		if (pipe.destroyInstructionSet === wrappedDestroy) pipe.destroyInstructionSet = original.destroyInstructionSet;
		for (const batcher of batchers.values()) DestroyBatcher(batcher);
		batchers.clear();
	};
}
