import { freeze } from 'immer';
import { Assert, type ImageBoundingBox } from 'pandora-common';
import { Sprite, type Application, type Texture } from 'pixi.js';

const TextureBoundingBoxCache = new WeakMap<Texture, ImageBoundingBox>();

/**
 * Calculates a bounding box of a texture, including all pixels with non-zero alpha.
 *
 * The result is cached.
 * @param texture - The texture to calculate the box for
 * @param app - Any Pixi application with multiView enabled
 * @returns The bounding box
 */
export function GetTextureBoundingBox(texture: Texture, app: Application): ImageBoundingBox {

	const cachedResult = TextureBoundingBoxCache.get(texture);
	if (cachedResult !== undefined)
		return cachedResult;

	const { width, height } = texture.frame;
	Assert(width === texture.source.pixelWidth);
	Assert(height === texture.source.pixelHeight);

	Assert(app.canvas instanceof HTMLCanvasElement, 'Expected app.view to be an HTMLCanvasElement');

	app.renderer.resolution = 1;
	app.renderer.resize(width, height);
	app.renderer.background.color = 0x000000;
	app.renderer.background.alpha = 0;

	app.stage.removeChildren();
	const sprite = new Sprite(texture);
	app.stage.addChild(sprite);
	app.render();
	app.stage.removeChild(sprite);

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	Assert(context != null);
	context.clearRect(0, 0, width, height);
	context.drawImage(app.canvas, 0, 0, width, height);
	const imageData = context.getImageData(0, 0, width, height, { colorSpace: 'srgb' });

	Assert(imageData.width === width);
	Assert(imageData.height === height);
	Assert(imageData.data.length === (4 * width * height));

	let left = width;
	let top = height;
	let rightExclusive = 0;
	let bottomExclusive = 0;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = 4 * (y * width + x) + 3;

			// Check if the pixel is non-transparent
			if (imageData.data[i] > 0) {
				left = Math.min(left, x);
				top = Math.min(top, y);
				rightExclusive = Math.max(rightExclusive, x + 1);
				bottomExclusive = Math.max(bottomExclusive, y + 1);
			}
		}
	}

	let result: ImageBoundingBox;

	// Special case if the image is empty
	if (left === width && top === height && rightExclusive === 0 && bottomExclusive === 0) {
		result = {
			left: 0,
			top: 0,
			rightExclusive: 0,
			bottomExclusive: 0,
			width,
			height,
		};
	} else {
		Assert(left < rightExclusive);
		Assert(top < bottomExclusive);
		result = {
			left,
			top,
			rightExclusive,
			bottomExclusive,
			width,
			height,
		};
	}

	freeze(result);
	TextureBoundingBoxCache.set(texture, result);
	return result;
}
