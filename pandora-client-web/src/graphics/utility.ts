import type { Immutable } from 'immer';
import { Assert, type AssetId, type AtomicCondition, type Condition } from 'pandora-common';
import { ImageSource, type TextureSource } from 'pixi.js';

export function EvaluateCondition(condition: Immutable<Condition>, evaluate: (condition: Immutable<AtomicCondition>) => boolean): boolean {
	return condition.some((clause) => clause.every(evaluate));
}

export function StripAssetIdPrefix(id: AssetId): string {
	return id.replace(/^a\//, '');
}

function ImageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
	Assert(image.complete);

	const canvas = document.createElement('canvas');
	canvas.width = image.width;
	canvas.height = image.height;
	const context = canvas.getContext('2d');
	Assert(context != null);
	context.drawImage(image, 0, 0, image.width, image.height);

	return canvas;
}

export function LoadArrayBufferImageResource(buffer: ArrayBuffer): Promise<TextureSource> {
	const blob = new Blob([buffer], { type: 'image/png' });
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(image.src);
			resolve(new ImageSource({
				resource: ImageToCanvas(image),
				alphaMode: 'premultiply-alpha-on-upload',
				resolution: 1,
			}));
		};
		image.onerror = () => {
			URL.revokeObjectURL(image.src);
			reject(new Error('Load failed'));
		};
		image.src = URL.createObjectURL(blob);
	});
}

export function LoadInlineImageResource(data: string): Promise<TextureSource> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => {
			resolve(new ImageSource({
				resource: ImageToCanvas(image),
				alphaMode: 'premultiply-alpha-on-upload',
				resolution: 1,
			}));
		};
		image.onerror = () => {
			URL.revokeObjectURL(image.src);
			reject(new Error('Load failed'));
		};
		image.src = data;
	});
}

/** Calculate if mesh face is defined clockwise */
export function MeshFaceIsCW(...points: readonly [number, number, number, number, number, number]): boolean {
	// This is shortened form of a determinant of a matrix of the points in rows
	const shoelaceArea = (points[2] - points[0]) * (points[5] - points[1]) - (points[4] - points[0]) * (points[3] - points[1]);
	return shoelaceArea < 0;
}
