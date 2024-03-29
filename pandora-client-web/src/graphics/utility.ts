import { AppContext } from '@pixi/react';
import type { Immutable } from 'immer';
import type { Condition, AtomicCondition, AssetId } from 'pandora-common';
import { Application, ImageResource, Resource } from 'pixi.js';
import { useContext } from 'react';

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
			reject();
		};
		image.src = URL.createObjectURL(blob);
	});
}

export function useAppOptional(): Application | null {
	return useContext(AppContext) as (Application | null);
}
