export interface RasterMaskBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Tracks only indexed vertices. Unused points in shared automesh templates must
 * neither enlarge the clear bounds nor invalidate a mask when another limb moves.
 * Bounds use the legacy mask's pixel coordinates (character x + 250, y).
 */
export class RasterMaskGeometryState {
	private _positions = new Float32Array();
	private _uvs = new Float32Array();
	private _indices = new Uint32Array();
	private _used: number[] = [];
	private _initialized = false;
	private _bounds: RasterMaskBounds | undefined;

	public get bounds(): Readonly<RasterMaskBounds> {
		return this._bounds ?? { x: 0, y: 0, width: 1, height: 1 };
	}

	public update(positions: Float32Array, uvs: Float32Array, indices: ArrayLike<number>): boolean {
		let topologyChanged = !this._initialized || indices.length !== this._indices.length;
		if (!topologyChanged) {
			for (let i = 0; i < indices.length; i++) {
				if (indices[i] !== this._indices[i]) {
					topologyChanged = true;
					break;
				}
			}
		}
		if (topologyChanged) {
			this._indices = Uint32Array.from(indices);
			this._used = Array.from(new Set(this._indices));
		}
		let changed = topologyChanged;
		for (const i of this._used) {
			if (positions[2 * i] !== this._positions[2 * i] || positions[2 * i + 1] !== this._positions[2 * i + 1] ||
				uvs[2 * i] !== this._uvs[2 * i] || uvs[2 * i + 1] !== this._uvs[2 * i + 1]) {
				changed = true;
				break;
			}
		}
		if (!changed)
			return false;
		this._initialized = true;
		this._positions = positions.slice();
		this._uvs = uvs.slice();

		let minX = 1500;
		let minY = 1500;
		let maxX = 0;
		let maxY = 0;
		for (const i of this._used) {
			const pointX = positions[2 * i] + 250;
			const pointY = positions[2 * i + 1];
			if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) {
				minX = minY = 0;
				maxX = maxY = 1500;
				break;
			}
			minX = Math.min(minX, pointX);
			minY = Math.min(minY, pointY);
			maxX = Math.max(maxX, pointX);
			maxY = Math.max(maxY, pointY);
		}
		// Pad conservative clear bounds for edge sampling, rounding outward in 32px steps.
		// Retain their union so moving geometry cannot leave stale texels behind.
		// The render texture and projection stay at the original full size.
		const x = Math.max(0, Math.min(1499, Math.floor((minX - 2) / 32) * 32));
		const y = Math.max(0, Math.min(1499, Math.floor((minY - 2) / 32) * 32));
		const right = Math.min(1500, Math.max(x + 1, Math.ceil((maxX + 2) / 32) * 32));
		const bottom = Math.min(1500, Math.max(y + 1, Math.ceil((maxY + 2) / 32) * 32));
		if (this._used.length > 0) {
			const old = this._bounds;
			const left = Math.min(x, old?.x ?? x);
			const top = Math.min(y, old?.y ?? y);
			this._bounds = {
				x: left, y: top,
				width: Math.max(right, old ? old.x + old.width : right) - left,
				height: Math.max(bottom, old ? old.y + old.height : bottom) - top,
			};
		}
		return true;
	}
}

type MaskPointSet<T> = { readonly points: readonly T[]; readonly triangles: Uint32Array; };
const compactedPoints = new WeakMap<readonly object[], WeakMap<Uint32Array, MaskPointSet<object>>>();

/** Remove unused points only AFTER triangulation, keeping triangle order/winding exactly. */
export function CompactMaskMeshPoints<T extends object>(points: readonly T[], triangles: Uint32Array): MaskPointSet<T> {
	let byTriangles = compactedPoints.get(points);
	if (byTriangles === undefined) {
		byTriangles = new WeakMap();
		compactedPoints.set(points, byTriangles);
	}
	let result = byTriangles.get(triangles);
	if (result === undefined) {
		const used = [...new Set(triangles)];
		const remap = new Map(used.map((index, i) => [index, i]));
		result = {
			points: used.map((index) => points[index]),
			triangles: triangles.map((index) => remap.get(index)!),
		};
		byTriangles.set(triangles, result);
	}
	return result as MaskPointSet<T>;
}
