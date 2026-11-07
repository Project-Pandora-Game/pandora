import { Container, MeshGeometry, SystemRunner, Texture, type Application } from 'pixi.js';
import { GraphicsRasterStencilMask } from '../../src/graphics/graphicsStencilMask.ts';

describe('mask raster format ownership', () => {
	it('shares equal formats within a scope and isolates RG8 from RGBA resources', () => {
		const prerender = new SystemRunner('prerender');
		const app = { renderer: { gpu: {}, runners: { prerender } } } as unknown as Application;
		const scope = {};
		const geometry = new MeshGeometry({
			positions: new Float32Array([0, 0, 100, 0, 0, 100]),
			uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
			indices: new Uint32Array([0, 1, 2]),
		});
		const rgba = new GraphicsRasterStencilMask(app, Texture.WHITE, geometry, scope, 'rgba8unorm');
		const rg = new GraphicsRasterStencilMask(app, Texture.WHITE, geometry, scope, 'rg8unorm');
		const anotherRg = new GraphicsRasterStencilMask(app, Texture.WHITE, geometry, scope, 'rg8unorm');
		const defaultRaster = new GraphicsRasterStencilMask(app, Texture.WHITE, geometry, scope);
		const target = new Container();
		target.addChild(rgba.effect.root, rg.effect.root, anotherRg.effect.root, defaultRaster.effect.root);
		try {
			expect(rgba.cache).not.toBe(rg.cache);
			expect(rg.cache).toBe(anotherRg.cache);
			expect(defaultRaster.cache).toBe(rg.cache);
			expect(prerender.items).toHaveLength(1);
			// A pending format switch or unmount must not allocate a render texture.
			expect(rgba.cache.resourceCount).toBe(0);
			expect(rg.cache.resourceCount).toBe(0);
		} finally {
			rgba.destroy();
			rg.destroy();
			anotherRg.destroy();
			defaultRaster.destroy();
			geometry.destroy();
			target.destroy();
		}
		expect(prerender.items).toHaveLength(0);
	});
});
