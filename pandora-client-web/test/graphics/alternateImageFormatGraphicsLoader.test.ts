import { TypedEventEmitter } from 'pandora-common';
import { Texture } from 'pixi.js';
import { AlternateImageFormatGraphicsLoader, type IGraphicsLoader, type IGraphicsLoaderEvents } from '../../src/assets/graphicsManager.ts';

it('keeps mask PNGs lossless through every texture-loading entry point while ordinary images use AVIF', async () => {
	const requested: string[] = [];
	class TestLoader extends TypedEventEmitter<IGraphicsLoaderEvents> implements IGraphicsLoader {
		public getCachedTexture(path: string) {
			requested.push(path); return Texture.EMPTY;
		}
		public useTexture(path: string) {
			requested.push(path); return () => {
				return;
			};
		}
		public loadTextureSource(path: string) {
			requested.push(path); return Promise.resolve(Texture.EMPTY.source);
		}
		public loadTextFile(path: string) {
			requested.push(path); return Promise.resolve('');
		}
		public loadFileArrayBuffer(path: string) {
			requested.push(path); return Promise.resolve(new ArrayBuffer(0));
		}
		public pathToUrl(path: string) {
			requested.push(path); return Promise.resolve(path);
		}
		public gc() {
			return;
		}
		public getDebugStats() {
			return { inUseTextures: 0, loadedTextures: 0, trackedTextures: 0, loadedPixels: 0, estLoadedSize: 0 };
		}
	}
	const loader = new AlternateImageFormatGraphicsLoader(new TestLoader(), ['png', 'jpg'], 'avif', 'formatHash');
	for (const name of ['mask_hash_mask_v1.png', 'mask_hash_5_0_95_100_mask_v1_r0.5.png', 'ordinary.png', 'photo.jpg']) {
		requested.length = 0;
		loader.getCachedTexture(name);
		loader.useTexture(name, () => {
			return;
		});
		await loader.loadTextureSource(name);
		await loader.pathToUrl(name);
		const expected = name.includes('_mask_v1') ? name : name.replace(/\.(png|jpg)$/, '_formatHash.avif');
		expect(requested).toEqual([expected, expected, expected, expected]);
	}
});
