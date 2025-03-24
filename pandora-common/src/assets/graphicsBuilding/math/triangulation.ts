import Delaunator from 'delaunator';
import { Immutable } from 'immer';
import type { PointDefinitionCalculated } from '../../graphics/mirroring.ts';
import type { BitField } from '../../../utility/bitfield.ts';
import { Assert } from '../../../utility/misc.ts';

const delaunatorCache = new WeakMap<Immutable<PointDefinitionCalculated[]>, Delaunator<number[]>>();

export function CalculatePointsTriangles(points: Immutable<PointDefinitionCalculated[]>, pointFilter?: BitField): [number, number, number][] {
	const result: [number, number, number][] = [];
	let delaunator: Delaunator<number[]> | undefined = delaunatorCache.get(points);
	if (delaunator === undefined) {
		delaunator = new Delaunator(points.flatMap((point) => point.pos));
		delaunatorCache.set(points, delaunator);
	}
	Assert(delaunator.triangles.length % 3 === 0);
	for (let i = 0; i < delaunator.triangles.length; i += 3) {
		const t = [i, i + 1, i + 2].map((tp) => delaunator.triangles[tp]);
		if (pointFilter == null || t.every((tp) => pointFilter.get(tp))) {
			Assert(t.length === 3);
			result.push([t[0], t[1], t[2]]);
		}
	}
	return result;
}

export function CalculatePointsTrianglesFlat(points: Immutable<PointDefinitionCalculated[]>, pointFilter?: BitField): Uint32Array {
	const result: number[] = [];
	let delaunator: Delaunator<number[]> | undefined = delaunatorCache.get(points);
	if (delaunator === undefined) {
		delaunator = new Delaunator(points.flatMap((point) => point.pos));
		delaunatorCache.set(points, delaunator);
	}
	Assert(delaunator.triangles.length % 3 === 0);
	for (let i = 0; i < delaunator.triangles.length; i += 3) {
		const t = [i, i + 1, i + 2].map((tp) => delaunator.triangles[tp]);
		if (pointFilter == null || t.every((tp) => pointFilter.get(tp))) {
			result.push(...t);
		}
	}
	return new Uint32Array(result);
}

export function CalculatePointsTrianglesRaw(points: [number, number][]): Uint32Array {
	const delaunator = new Delaunator(points.flat());
	return delaunator.triangles;
}
