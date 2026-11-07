import type { Application, FilterSystem, Matrix, Mesh, Texture as PixiTexture } from 'pixi.js';

const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const { GraphicsMaskLayer } = await import('../../src/graphics/graphicsMaskLayer.ts');
const { GetAlphaMaskGpuProgram } = await import('../../src/graphics/graphicsMaskShader.ts');
const { Sprite, Texture, RenderTexture, MeshGeometry, RendererType } = await import('pixi.js');

afterAll(() => canvasProbe.mockRestore());

function CreateLayer() {
	const rendered: { container: Mesh; target: PixiTexture; }[] = [];
	const render = jest.fn((options: { container: Mesh; target: PixiTexture; }) => {
		rendered.push(options);
	});
	const app = { renderer: { render } } as unknown as Application;
	const sprite = new Sprite(Texture.WHITE);
	const layer = new GraphicsMaskLayer(app, sprite, { x: 250, y: 0, width: 1500, height: 1500 });
	return { layer, sprite, render, rendered };
}

describe('custom mask filter backend resources', () => {
	it('provides a cached WebGPU program with Pixi filter globals and an independent mask sampler', () => {
		const program = GetAlphaMaskGpuProgram();
		expect(GetAlphaMaskGpuProgram()).toBe(program);
		expect(program.layout).toEqual([
			{ gfu: 0, uTexture: 1, uSampler: 2 },
			{ filterUniforms: 0, uMaskTexture: 1, uMaskSampler: 2 },
		]);
		expect(program.attributeData.aPosition.location).toBe(0);
	});

	it('retains both renderer backends and samples the rasterized mask rather than the source artwork', () => {
		const { layer, sprite } = CreateLayer();
		// eslint-disable-next-line no-bitwise
		expect(layer.filter.compatibleRenderers).toBe(RendererType.WEBGPU | RendererType.WEBGL);
		expect(layer.filter.glProgram).toBeDefined();
		expect(layer.filter.gpuProgram).toBe(GetAlphaMaskGpuProgram());
		expect(layer.filter.resources.uMaskTexture).toBe(sprite.texture.source);
		expect(layer.filter.resources.uMaskSampler).toBe(sprite.texture.source.style);
		expect(sprite.texture).not.toBe(Texture.WHITE);
		layer.destroy();
	});

	it('refreshes the mask texture and sampler together when the mask sprite is rebound', () => {
		const { layer, sprite } = CreateLayer();
		const replacement = RenderTexture.create({ width: 64, height: 64 });
		replacement.source.scaleMode = 'nearest';
		sprite.texture = replacement;
		const calculateSpriteMatrix = jest.fn((matrix: Matrix) => matrix.identity());
		const applyFilter = jest.fn();
		const filterManager = { calculateSpriteMatrix, applyFilter } as unknown as FilterSystem;
		layer.filter.apply(filterManager, Texture.WHITE, Texture.WHITE, false);
		expect(calculateSpriteMatrix).toHaveBeenCalledWith(expect.anything(), sprite);
		expect(layer.filter.resources.uMaskTexture).toBe(replacement.source);
		expect(layer.filter.resources.uMaskSampler).toBe(replacement.source.style);
		expect(applyFilter).toHaveBeenCalledWith(layer.filter, Texture.WHITE, Texture.WHITE, false);
		layer.destroy();
		replacement.destroy(true);
	});

	it('preserves the existing geometry and content update lifecycle without drawing through stencil', () => {
		const { layer, sprite, render, rendered } = CreateLayer();
		const raster = sprite.texture;
		const geometry = new MeshGeometry({
			positions: new Float32Array([0, 0, 100, 0, 0, 100]),
			uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
			indices: new Uint32Array([0, 1, 2]),
		});
		layer.updateGeometry(geometry);
		layer.updateContent(Texture.WHITE);
		layer.updateContent(Texture.WHITE);
		layer.updateGeometry(geometry);
		expect(render).toHaveBeenCalledTimes(3);
		for (const options of rendered) {
			expect(options.target).toBe(raster);
			expect(options.container.geometry).toBe(geometry);
			expect(options.container.position.x).toBe(250);
		}
		layer.destroy();
		expect(sprite.texture).toBe(Texture.WHITE);
		expect(raster.destroyed).toBe(true);
		geometry.destroy();
	});
});
