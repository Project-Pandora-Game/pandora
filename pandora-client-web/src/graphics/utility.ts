import type { Immutable } from 'immer';
import type { AssetId, AtomicCondition, Condition } from 'pandora-common';
import { ImageResource, Resource } from 'pixi.js';

export function GetAngle(x: number, y: number): number {
	const angle = Math.atan2(y, x);
	const degrees = 180 * angle / Math.PI;
	return (360 + Math.round(degrees)) % 360;
}

export function RotateVector(x: number, y: number, angle: number): [number, number] {
	angle *= (Math.PI / 180);
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return [x * cos - y * sin, x * sin + y * cos];
}

export function EvaluateCondition(condition: Immutable<Condition>, evaluate: (condition: Immutable<AtomicCondition>) => boolean): boolean {
	return condition.some((clause) => clause.every(evaluate));
}

export function Conjunction<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
	if (a.size > b.size) [a, b] = [b, a];
	return [...a].some((x) => b.has(x));
}

export function StripAssetIdPrefix(id: AssetId): string {
	return id.replace(/^a\//, '');
}

export function StripAssetHash(name: string): string {
	return name.replace(/_[a-z0-9_-]{43}(?=\.[a-z]+$)/i, '');
}

export function LoadArrayBufferImageResource(buffer: ArrayBuffer): Promise<Resource> {
	const blob = new Blob([buffer], { type: 'image/png' });
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(image.src);
			resolve(new ImageResource(image));
		};
		image.onerror = () => {
			URL.revokeObjectURL(image.src);
			reject(new Error('Load failed'));
		};
		image.src = URL.createObjectURL(blob);
	});
}

/** Calculate if mesh face is defined clockwise */
export function MeshFaceIsCW(...points: readonly [number, number, number, number, number, number]): boolean {
	// This is shortened form of a determinant of a matrix of the points in rows
	const shoelaceArea = (points[2] - points[0]) * (points[5] - points[1]) - (points[4] - points[0]) * (points[3] - points[1]);
	return shoelaceArea < 0;
}
