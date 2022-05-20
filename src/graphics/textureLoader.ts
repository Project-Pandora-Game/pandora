import { Texture } from 'pixi.js';

export class TextureLoader {
	prefix: string = '';

	loadTexture(path: string): Promise<Texture> {
		return Promise.resolve(Texture.from(this.prefix + path));
	}
}

let loader: TextureLoader | null = null;

export function GetTextureLoader(): TextureLoader {
	return loader ??= new TextureLoader();
}

export function OverrideTextureLoader(value: TextureLoader): void {
	loader = value;
}
