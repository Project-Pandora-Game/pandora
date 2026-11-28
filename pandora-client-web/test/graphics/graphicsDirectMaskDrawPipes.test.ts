import type { Batch, Shader, Texture, WebGLRenderer } from 'pixi.js';

const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const P = await import('pixi.js');
const { InstallDirectMaskDrawPipes } = await import('../../src/graphics/graphicsDirectMaskDrawPipes.ts');
afterAll(() => canvasProbe.mockRestore());

function Fixture() {
	let masked = false;
	const submitted: { shader: Shader; geometry: InstanceType<typeof P.BatchGeometry>; size: number; start: number; locals?: InstanceType<typeof P.UniformGroup>; transform?: InstanceType<typeof P.Matrix>; }[] = [];
	let currentShader: Shader;
	let currentGeometry: InstanceType<typeof P.BatchGeometry>;
	const nativeStart = jest.fn();
	const nativeExecute = jest.fn();
	const nativeGraphics = jest.fn();
	const bindTexture = jest.fn();
	const world = new P.Matrix(2, 0, 0, 3, 5, 7);
	const prepare = jest.fn((shader: Shader) => {
		if (!masked) return undefined;
		// The owner snapshots material accessors before drawing. Late-bound batch
		// texture groups must already exist at this point, including on first draw.
		for (const name of Object.getOwnPropertyNames(shader.resources)) {
			if (name !== 'globalUniforms') expect(shader.resources[name]).toBeDefined();
		}
		return shader;
	});
	const renderer = {
		limits: { maxBatchableTextures: 16 },
		globalUniforms: { bindGroup: new P.BindGroup() },
		gl: {},
		state: { set: jest.fn() },
		shader: {
			bind: (shader: Shader) => {
				currentShader = shader;
			},
		},
		texture: { bind: bindTexture, unbindIntegerTextures: jest.fn() },
		geometry: {
			bind: (geometry: InstanceType<typeof P.BatchGeometry>) => {
				currentGeometry = geometry;
			},
			draw: (_topology: string, size: number, start: number) => {
				const locals = currentShader.resources.localUniforms as InstanceType<typeof P.UniformGroup> | undefined;
				submitted.push({ shader: currentShader, geometry: currentGeometry, size, start, locals, transform: (locals?.uniforms.uTransformMatrix as InstanceType<typeof P.Matrix> | undefined)?.clone() });
			},
		},
		renderPipes: { graphics: { execute: nativeGraphics } },
		graphicsContext: { updateGpuContext: jest.fn() },
		_roundPixels: 0,
	} as unknown as WebGLRenderer;
	const pipe = new P.BatcherPipe(renderer, { start: nativeStart, execute: nativeExecute });
	renderer.renderPipes.batch = pipe;
	const releasePipes = InstallDirectMaskDrawPipes(renderer, {
		isBuildingMasked: () => masked, isRenderingMasked: () => masked,
		getRenderGroupWorld: () => world, prepare,
	});
	let released = false;
	function release() {
		if (released) return;
		released = true;
		releasePipes();
	}
	const instructions = new P.InstructionSet();
	function Sprite(texture: Texture = P.Texture.WHITE) {
		const sprite = new P.Sprite(texture);
		const element = new P.BatchableSprite();
		element.renderable = sprite;
		element.transform = sprite.groupTransform;
		element.texture = texture;
		element.bounds = sprite.visualBounds;
		return element;
	}
	return {
		renderer, pipe, release, submitted, prepare, nativeStart, nativeExecute, nativeGraphics, bindTexture, instructions, world, Sprite, setMasked: (value: boolean) => {
			masked = value;
		},
	};
}

describe('direct mask draw family adapters', () => {
	it('preserves native unmasked batching and limits owned batches to the reserved sampler budget', () => {
		const f = Fixture();
		const textures = Array.from({ length: 9 }, () => new P.Texture({ source: new P.TextureSource({ width: 1, height: 1 }) }));
		try {
			f.pipe.buildStart(f.instructions);
			f.pipe.addToBatch(f.Sprite(), f.instructions);
			f.setMasked(true);
			for (const texture of textures) f.pipe.addToBatch(f.Sprite(texture), f.instructions);
			f.pipe.break(f.instructions);
			f.setMasked(false);
			f.pipe.addToBatch(f.Sprite(), f.instructions);
			f.pipe.buildEnd(f.instructions);
			const batches = f.instructions.instructions.slice(0, f.instructions.instructionSize) as Batch[];
			expect(batches.map((batch) => batch.textures.count)).toEqual([1, 8, 1, 1]);
			expect(batches[0].batcher.maxTextures).toBe(16);
			expect(batches[3].batcher).toBe(batches[0].batcher);
			const owned = batches[1].batcher;
			expect(owned.maxTextures).toBe(8);
			const samplers = owned.shader.resources.batchSamplers as InstanceType<typeof P.UniformGroup>;
			expect(Array.from(samplers.uniforms.uTextures as Int32Array)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
			const nativeSamplers = batches[0].batcher.shader.resources.batchSamplers as InstanceType<typeof P.UniformGroup>;
			expect(Array.from(nativeSamplers.uniforms.uTextures as Int32Array)).toEqual(Array.from({ length: 16 }, (_, i) => i));
		} finally {
			f.release();
			f.pipe.destroyInstructionSet(f.instructions);
			for (const texture of textures) texture.destroy(true);
		}
	});

	it('rebinds native batches after direct draws and releases owned geometry without destroying textures', () => {
		const f = Fixture();
		const cached = new P.Container({ isRenderGroup: true });
		cached.cacheAsTexture(true);
		const child = new P.Container({ isRenderGroup: true });
		cached.addChild(child);
		try {
			f.setMasked(true);
			f.pipe.buildStart(f.instructions);
			const sprite = f.Sprite();
			child.addChild(sprite.renderable);
			f.pipe.addToBatch(sprite, f.instructions);
			f.pipe.break(f.instructions);
			f.setMasked(false);
			f.pipe.addToBatch(f.Sprite(), f.instructions);
			f.pipe.buildEnd(f.instructions);
			const batches = f.instructions.instructions.slice(0, f.instructions.instructionSize) as Batch[];
			f.setMasked(true);
			f.pipe.execute(batches[0]);
			expect(f.submitted).toHaveLength(1);
			expect(f.prepare).toHaveBeenCalledWith(batches[0].batcher.shader, { worldTransform: f.world, groupTransform: new P.Matrix() });
			const geometry = batches[0].batcher.geometry;
			expect(f.bindTexture).toHaveBeenCalledWith(P.Texture.WHITE.source, 8);
			batches[1].action = 'renderBatch';
			f.setMasked(false);
			f.pipe.execute(batches[1]);
			expect(f.nativeStart).toHaveBeenCalledTimes(1);
			expect(batches[1].action).toBe('renderBatch');
			child.renderGroup.structureDidChange = false;
			cached.renderGroup.structureDidChange = false;
			cached.renderGroup.textureNeedsUpdate = false;
			geometry.once('destroy', () => {
				expect(child.renderGroup.structureDidChange).toBe(true);
				expect(cached.renderGroup.textureNeedsUpdate).toBe(true);
			});
			f.release();
			expect(geometry.buffers).toBeNull();
			expect(child.renderGroup.structureDidChange).toBe(true);
			expect(cached.renderGroup.structureDidChange).toBe(true);
			expect(cached.renderGroup.textureNeedsUpdate).toBe(true);
			expect(P.Texture.WHITE.source.destroyed).toBe(false);
		} finally {
			f.release();
			f.pipe.destroyInstructionSet(f.instructions);
			cached.destroy({ children: true });
		}
	});

	it('draws unbatched Graphics with native base color and separate local transform/tint', () => {
		const f = Fixture();
		const graphics = new P.Graphics().rect(0, 0, 10, 20).fill(0x336699);
		const second = new P.Graphics(graphics.context);
		graphics.context.batchMode = 'no-batch';
		graphics.position.set(17, 23);
		const source = new P.BatchableGraphics();
		source.geometryData = { vertices: [0, 0, 10, 0, 0, 20], uvs: [0, 0, 1, 0, 0, 1], indices: [0, 1, 2] };
		source.attributeOffset = 0;
		source.attributeSize = 3;
		source.indexOffset = 0;
		source.indexSize = 3;
		source.texture = P.Texture.WHITE;
		source.baseColor = 0x336699;
		source.alpha = 0.6;
		const initialBatcher = source._batcher;
		const getContext = jest.fn(() => ({ batches: [source] }));
		f.renderer.graphicsContext.updateGpuContext = getContext as unknown as typeof f.renderer.graphicsContext.updateGpuContext;
		try {
			f.setMasked(false);
			f.renderer.renderPipes.graphics.execute(graphics);
			expect(f.nativeGraphics).toHaveBeenCalledWith(graphics);
			f.setMasked(true);
			f.renderer.renderPipes.graphics.execute(graphics);
			expect(f.submitted).toHaveLength(1);
			expect(f.submitted[0].size).toBe(3);
			expect(source._batcher).toBe(initialBatcher);
			const local = f.submitted[0].locals!;
			expect(local.uniforms.uTransformMatrix).toBe(graphics.groupTransform);
			expect(f.prepare).toHaveBeenCalledWith(f.submitted[0].shader, { worldTransform: graphics.worldTransform, groupTransform: graphics.groupTransform });
			const vertices = f.submitted[0].geometry.buffers[0].data as Float32Array;
			expect(Array.from(vertices.slice(0, 2))).toEqual([0, 0]);
			expect(Array.from(vertices.slice(6, 8))).toEqual([10, 0]);
			second.groupTransform.tx = 100;
			f.renderer.renderPipes.graphics.execute(second);
			expect(f.submitted[0].transform?.tx).toBe(0);
			expect(f.submitted[1].transform?.tx).toBe(100);
			f.renderer.renderPipes.graphics.execute(graphics);
			expect(getContext).toHaveBeenCalledTimes(1);
			graphics.context.clear();
			f.renderer.renderPipes.graphics.execute(graphics);
			expect(getContext).toHaveBeenCalledTimes(2);
		} finally {
			f.release();
			second.destroy();
			graphics.destroy(true);
		}
	});

	it('splits textured Graphics at the mask sampler budget and releases owned uniforms', () => {
		const f = Fixture();
		const graphics = new P.Graphics();
		const textures = Array.from({ length: 9 }, () => new P.Texture({ source: new P.TextureSource({ width: 1, height: 1 }) }));
		const batches = textures.map((texture) => {
			const batch = new P.BatchableGraphics();
			batch.geometryData = { vertices: [0, 0, 10, 0, 0, 10], uvs: [0, 0, 1, 0, 0, 1], indices: [0, 1, 2] };
			batch.attributeOffset = 0;
			batch.attributeSize = 3;
			batch.indexOffset = 0;
			batch.indexSize = 3;
			batch.texture = texture;
			batch.baseColor = 0xffffff;
			batch.alpha = 1;
			return batch;
		});
		f.renderer.graphicsContext.updateGpuContext = jest.fn(() => ({ batches })) as unknown as typeof f.renderer.graphicsContext.updateGpuContext;
		try {
			f.setMasked(true);
			f.renderer.renderPipes.graphics.execute(graphics);
			expect(f.submitted.map((draw) => draw.size)).toEqual([24, 3]);
			const ownSamplers = f.submitted[0].shader.resources.batchSamplers as InstanceType<typeof P.UniformGroup>;
			expect(Array.from(ownSamplers.uniforms.uTextures as Int32Array)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
			const locals = f.submitted[0].locals!;
			locals.buffer = new P.Buffer({ data: new Float32Array(16), usage: P.BufferUsage.UNIFORM });
			const buffer = locals.buffer;
			f.release();
			expect(buffer.destroyed).toBe(true);
			expect(textures.every((texture) => !texture.source.destroyed)).toBe(true);
		} finally {
			f.release();
			graphics.destroy(true);
			for (const texture of textures) texture.destroy(true);
		}
	});
});
