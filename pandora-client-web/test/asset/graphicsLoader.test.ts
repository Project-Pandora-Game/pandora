import { GetLogger } from 'pandora-common';
import { Texture, Resource } from 'pixi.js';
import { GraphicsLoaderBase } from '../../src/assets/graphicsLoader';

describe('GraphicsLoaderBase', () => {
	const mockGraphicsLoaderBase = new class MockGraphicsLoaderBase extends GraphicsLoaderBase {
		constructor() {
			super(GetLogger('GraphicsLoader'));
		}

		protected loadTexture(_path: string): Promise<Texture<Resource>> {
			throw new Error('Method not implemented.');
		}

		public loadTextFile(_path: string): Promise<string> {
			throw new Error('Method not implemented.');
		}
		public loadFileArrayBuffer(_path: string): Promise<ArrayBuffer> {
			throw new Error('Method not implemented.');
		}
		public loadAsUrl(_path: string): Promise<string> {
			throw new Error('Method not implemented.');
		}
	};

	describe('async getTexture()', () => {
		it('should return Texture.EMPTY', async () => {
			expect(await mockGraphicsLoaderBase.getTexture('')).toBe(Texture.EMPTY);
		});
	});
});

describe('URLGraphicsLoader', () => {

	describe('loadTextureFile()', () => {
		it.todo('should fetch texture file'); // fetch is not in jsdom
	});

	describe('loadFileArrayBuffer', () => {
		it.todo('load to array buffer');
	});
});
