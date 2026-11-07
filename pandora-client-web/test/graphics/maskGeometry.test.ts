import { CompactMaskMeshPoints, RasterMaskGeometryState } from '../../src/graphics/graphicsMaskGeometry.ts';

const indices = new Uint32Array([0, 1, 2]);
const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0]);
const triangle = () => new Float32Array([10, 100, 20, 100, 10, 110, 1200, 1400]);

describe('raster mask input tracking and bounds', () => {
	it('bounds indexed triangles on the original pixel grid with sampling padding', () => {
		const state = new RasterMaskGeometryState();
		expect(state.update(triangle(), uvs, indices)).toBe(true);
		expect(state.bounds).toEqual({ x: 256, y: 96, width: 32, height: 32 });
	});

	it('ignores unused vertices and reuses equal inputs across pose evaluators', () => {
		const state = new RasterMaskGeometryState();
		const vertices = triangle();
		state.update(vertices, uvs, indices);
		expect(state.update(vertices.slice(), uvs.slice(), indices.slice())).toBe(false);
		vertices[6] = -200;
		expect(state.update(vertices, uvs, indices)).toBe(false);
		vertices[0] += 1;
		expect(state.update(vertices, uvs, indices)).toBe(true);
	});

	it('detects UV changes and triangle ordering needed for white-over-black compositing', () => {
		const state = new RasterMaskGeometryState();
		state.update(triangle(), uvs, indices);
		const changedUv = uvs.slice();
		changedUv[0] = 0.5;
		expect(state.update(triangle(), changedUv, indices)).toBe(true);
		expect(state.update(triangle(), changedUv, new Uint32Array([2, 1, 0]))).toBe(true);
	});

	it('retains the union during motion rather than resizing back and forth', () => {
		const state = new RasterMaskGeometryState();
		state.update(triangle(), uvs, indices);
		const moved = triangle();
		moved[0] -= 100;
		state.update(moved, uvs, indices);
		const grown = { ...state.bounds };
		expect(grown.x).toBeLessThan(256);
		state.update(triangle(), uvs, indices);
		expect(state.bounds).toEqual(grown);
	});

	it('clips bounds to the original mask domain without reducing pixel density', () => {
		const state = new RasterMaskGeometryState();
		state.update(new Float32Array([-300, -100, 2000, 0, 0, 2000]), uvs, indices);
		expect(state.bounds).toEqual({ x: 0, y: 0, width: 1500, height: 1500 });
	});
});

describe('mask point compaction', () => {
	it('preserves triangle winding, order, repeated vertices and point identity', () => {
		const points = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }];
		const triangles = new Uint32Array([3, 1, 2, 2, 1, 3]);
		const result = CompactMaskMeshPoints(points, triangles);
		expect(result.points).toEqual([points[3], points[1], points[2]]);
		expect([...result.triangles]).toEqual([0, 1, 2, 2, 1, 0]);
		expect(CompactMaskMeshPoints(points, triangles)).toBe(result);
	});
});
