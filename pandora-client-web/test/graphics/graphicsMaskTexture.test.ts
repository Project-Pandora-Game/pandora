import type { Application, WebGLRenderer } from 'pixi.js';

const canvasProbe = import.meta.jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const { Container, MeshGeometry, SystemRunner, Texture } = await import('pixi.js');
const { GraphicsMaskRaster, ObserveMaskRasterRetirement } = await import('../../src/graphics/graphicsMaskRaster.ts');
afterAll(() => canvasProbe.mockRestore());

describe('RG8 mask raster ownership', () => {
	it.each([
		[1, 1500, [224, 0, 64, 32]],
		[0.5, 750, [112, 0, 32, 16]],
		[0.25, 375, [56, 0, 16, 8]],
	] as const)('keeps logical mask coordinates at resolution %s while scaling storage and scissor', (resolution, pixels, scissor) => {
		const prerender = new SystemRunner('prerender');
		const setScissor = import.meta.jest.fn();
		const app = { renderer: { gl: { isEnabled: () => false, enable: () => undefined, scissor: setScissor, disable: () => undefined }, runners: { prerender }, render: () => undefined } } as unknown as Application;
		const geometry = new MeshGeometry({ positions: new Float32Array([0, 0, 10, 0, 0, 10]), uvs: new Float32Array([0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]) });
		const raster = new GraphicsMaskRaster(app, Texture.WHITE, geometry, {}, resolution);
		try {
			const resource = raster.cache.reconcile([{ owner: raster, texture: Texture.WHITE, positions: geometry.positions, uvs: geometry.uvs, indices: geometry.indices }]).get(raster)!;
			expect(resource.texture.width).toBe(1500);
			expect(resource.texture.height).toBe(1500);
			expect(resource.texture.source.pixelWidth).toBe(pixels);
			expect(resource.texture.source.pixelHeight).toBe(pixels);
			expect(setScissor).toHaveBeenCalledWith(...scissor);
		} finally {
			raster.destroy();
			geometry.destroy();
		}
	});

	it('notifies shader consumers before the last shared raster lease destroys its texture', () => {
		const prerender = new SystemRunner('prerender');
		const app = { renderer: { gl: { isEnabled: () => false, enable: () => undefined, scissor: () => undefined, disable: () => undefined }, runners: { prerender }, render: () => undefined } } as unknown as Application;
		const geometry = new MeshGeometry({ positions: new Float32Array([0, 0, 10, 0, 0, 10]), uvs: new Float32Array([0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]) });
		const raster = new GraphicsMaskRaster(app, Texture.WHITE, geometry);
		const beforeDestruction: boolean[] = [];
		const stop = ObserveMaskRasterRetirement(app.renderer as WebGLRenderer, (texture) => beforeDestruction.push(texture.source.destroyed));
		const resource = raster.cache.reconcile([{ owner: raster, texture: Texture.WHITE, positions: geometry.positions, uvs: geometry.uvs, indices: geometry.indices }]).get(raster)!;
		const source = resource.texture.source;
		try {
			expect(source.format).toBe('rg8unorm');
			raster.destroy();
			expect(beforeDestruction).toEqual([false]);
			expect(source.destroyed).toBe(true);
		} finally {
			stop();
			geometry.destroy();
		}
	});

	it('shares a cache within a scope and isolates independent scopes', () => {
		const prerender = new SystemRunner('prerender');
		const app = { renderer: { gl: { isEnabled: () => false, enable: () => undefined, scissor: () => undefined, disable: () => undefined }, runners: { prerender } } } as unknown as Application;
		const scope = {};
		const geometry = new MeshGeometry({
			positions: new Float32Array([0, 0, 100, 0, 0, 100]),
			uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
			indices: new Uint32Array([0, 1, 2]),
		});
		const separate = new GraphicsMaskRaster(app, Texture.WHITE, geometry);
		const rg = new GraphicsMaskRaster(app, Texture.WHITE, geometry, scope);
		const anotherRg = new GraphicsMaskRaster(app, Texture.WHITE, geometry, scope);
		const halfRg = new GraphicsMaskRaster(app, Texture.WHITE, geometry, scope, 0.5);
		const anotherHalfRg = new GraphicsMaskRaster(app, Texture.WHITE, geometry, scope, 0.5);
		const target = new Container();
		target.addChild(separate.anchor, rg.anchor, anotherRg.anchor);
		try {
			expect(separate.cache).not.toBe(rg.cache);
			expect(rg.cache).toBe(anotherRg.cache);
			expect(halfRg.cache).toBe(anotherHalfRg.cache);
			expect(halfRg.cache).not.toBe(rg.cache);
			expect(prerender.items).toHaveLength(1);
			// A pending mount or unmount must not allocate a render texture.
			expect(separate.cache.resourceCount).toBe(0);
			expect(rg.cache.resourceCount).toBe(0);
		} finally {
			separate.destroy();
			rg.destroy();
			anotherRg.destroy();
			halfRg.destroy();
			anotherHalfRg.destroy();
			geometry.destroy();
			target.destroy();
		}
		expect(prerender.items).toHaveLength(0);
	});
});
