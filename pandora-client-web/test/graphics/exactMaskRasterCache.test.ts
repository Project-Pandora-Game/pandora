import { ExactMaskRasterCache, type ExactMaskRasterRequest, type ExactMaskRasterSnapshot } from '../../src/graphics/graphicsExactMaskRasterCache.ts';

type TestResource = { id: number; snapshot: ExactMaskRasterSnapshot<object>; destroyed: boolean; };
function Fixture() {
	let created = 0;
	const updated: number[] = [];
	const destroyed: number[] = [];
	const cache = new ExactMaskRasterCache<TestResource>({
		create(snapshot) {
			return { id: ++created, snapshot, destroyed: false };
		},
		update(resource, snapshot) {
			resource.snapshot = snapshot;
			updated.push(resource.id);
		},
		destroy(resource) {
			expect(resource.destroyed).toBe(false);
			resource.destroyed = true;
			destroyed.push(resource.id);
		},
	});
	return { cache, updated, destroyed, created: () => created };
}

const texture = {};
function Request(owner: object, x = 0, source: object = texture): ExactMaskRasterRequest<object> {
	return {
		owner, texture: source,
		positions: new Float32Array([x, 0, 100, 0, 0, 100, 800, 1400]),
		uvs: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0]),
		indices: new Uint32Array([0, 1, 2]),
	};
}

describe('character-scoped exact mask raster cache', () => {
	it('shares an exact raster across duplicate priority groups and releases the final owner', () => {
		const f = Fixture();
		const a = {};
		const b = {};
		const result = f.cache.reconcile([Request(a), Request(b)]);
		expect(result.get(a)).toBe(result.get(b));
		expect(f.cache.resourceCount).toBe(1);
		expect(f.cache.ownerCount).toBe(2);
		f.cache.release(a);
		expect(f.destroyed).toEqual([]);
		f.cache.release(b);
		f.cache.release(b);
		expect(f.destroyed).toEqual([1]);
		expect(f.cache.resourceCount).toBe(0);
	});

	it('reuses its resource across pose changes and rasterizes duplicates only once', () => {
		const f = Fixture();
		const a = {};
		const b = {};
		const first = f.cache.reconcile([Request(a), Request(b)]).get(a);
		const next = f.cache.reconcile([Request(a, 4), Request(b, 4)]);
		expect(next.get(a)).toBe(first);
		expect(next.get(b)).toBe(first);
		expect(f.created()).toBe(1);
		expect(f.updated).toEqual([1]);
		f.cache.reconcile([Request(a, 4), Request(b, 4)]);
		expect(f.updated).toEqual([1]);
	});

	it('retains static attribute buffers across poses and snapshots changed UVs/topology', () => {
		const f = Fixture();
		const owner = {};
		const resource = f.cache.reconcile([Request(owner)]).get(owner)!;
		const original = resource.snapshot;
		f.cache.reconcile([Request(owner, 5)]);
		expect(resource.snapshot.positions).not.toBe(original.positions);
		expect(resource.snapshot.uvs).toBe(original.uvs);
		expect(resource.snapshot.indices).toBe(original.indices);
		const changed = Request(owner, 5);
		changed.uvs[0] = 0.25;
		changed.indices = new Uint32Array([2, 1, 0]);
		const posed = resource.snapshot;
		f.cache.reconcile([changed]);
		expect(resource.snapshot.positions).toBe(posed.positions);
		expect(resource.snapshot.uvs).not.toBe(posed.uvs);
		expect(resource.snapshot.indices).not.toBe(posed.indices);
		expect(original.uvs[0]).toBe(0);
		expect([...original.indices]).toEqual([0, 1, 2]);
	});

	it('reserves matching rasters before recycling when owners exchange poses', () => {
		const f = Fixture();
		const a = {};
		const b = {};
		const first = f.cache.reconcile([Request(a), Request(b, 10)]);
		const swapped = f.cache.reconcile([Request(a, 10), Request(b)]);
		expect(swapped.get(a)).toBe(first.get(b));
		expect(swapped.get(b)).toBe(first.get(a));
		expect(f.updated).toEqual([]);
		expect(f.created()).toBe(2);
	});

	it('retains each owner render target across synchronized changes to distinct masks', () => {
		const f = Fixture();
		const a = {};
		const b = {};
		const c = {};
		const first = f.cache.reconcile([Request(a), Request(b, 10), Request(c, 20)]);
		const next = f.cache.reconcile([Request(a, 1), Request(b, 11), Request(c, 21)]);
		expect(next.get(a)).toBe(first.get(a));
		expect(next.get(b)).toBe(first.get(b));
		expect(next.get(c)).toBe(first.get(c));
		expect(f.updated).toEqual([1, 2, 3]);
		expect(f.created()).toBe(3);
		expect(f.destroyed).toEqual([]);
	});

	it('keeps nonpending owners intact when one owner diverges, then retires the extra resource on convergence', () => {
		const f = Fixture();
		const a = {};
		const b = {};
		const original = f.cache.reconcile([Request(a), Request(b)]).get(a);
		const changed = f.cache.reconcile([Request(a, 10)]).get(a);
		expect(changed).not.toBe(original);
		expect(f.cache.get(b)).toBe(original);
		expect(original?.destroyed).toBe(false);
		expect(f.cache.resourceCount).toBe(2);
		f.cache.reconcile([Request(a)]);
		expect(f.cache.get(a)).toBe(original);
		expect(changed?.destroyed).toBe(true);
		expect(f.cache.resourceCount).toBe(1);
	});

	it('snapshots mutable geometry, so an in-place pose edit invalidates its old raster', () => {
		const f = Fixture();
		const a = {};
		const input = Request(a);
		const original = f.cache.reconcile([input]).get(a)!;
		input.positions[0] = 4;
		expect(original.snapshot.positions[0]).toBe(0);
		f.cache.reconcile([input]);
		expect(original.snapshot.positions[0]).toBe(4);
		expect(f.updated).toEqual([1]);
		expect(f.created()).toBe(1);
	});

	it('includes texture identity, ordered triangles and indexed UV values in equivalence', () => {
		const f = Fixture();
		const a = Request({}); const b = Request({}, 0, {}); const c = Request({}); const d = Request({});
		c.indices = new Uint32Array([2, 1, 0]);
		d.uvs[0] = 0.25;
		f.cache.reconcile([a, b, c, d]);
		expect(f.cache.resourceCount).toBe(4);
	});

	it('ignores unused template points without merging different referenced geometry', () => {
		const f = Fixture();
		const a = Request({});
		const b = Request({});
		b.positions[6] = -1000;
		b.uvs[6] = 0.75;
		const result = f.cache.reconcile([a, b]);
		expect(result.get(a.owner)).toBe(result.get(b.owner));
		b.positions[0] = 1;
		f.cache.reconcile([b]);
		expect(f.cache.resourceCount).toBe(2);
	});

	it('invalidates updated texture content while preserving resource reuse', () => {
		const f = Fixture();
		const a = {};
		const b = {};
		f.cache.reconcile([Request(a), Request(b)]);
		f.cache.invalidate(texture);
		f.cache.invalidate(texture);
		f.cache.reconcile([Request(a), Request(b)]);
		expect(f.updated).toEqual([1]);
		expect(f.created()).toBe(1);
	});

	it('does not share independently scoped characters and destroys all retained resources exactly once', () => {
		const a = Fixture(); const b = Fixture(); const owner = {};
		const first = a.cache.reconcile([Request(owner)]).get(owner);
		const second = b.cache.reconcile([Request(owner)]).get(owner);
		expect(first).not.toBe(second);
		a.cache.destroy();
		a.cache.destroy();
		a.cache.release(owner);
		expect(a.destroyed).toEqual([1]);
		expect(second?.destroyed).toBe(false);
		expect(() => a.cache.reconcile([])).toThrow('destroyed');
	});

	it('rejects a duplicated request owner before detaching any existing resource', () => {
		const f = Fixture();
		const a = {};
		const original = f.cache.reconcile([Request(a)]).get(a);
		expect(() => f.cache.reconcile([Request(a), Request(a, 10)])).toThrow('only once');
		expect(f.cache.get(a)).toBe(original);
		expect(f.cache.ownerCount).toBe(1);
	});

	it('retires a resource whose raster update fails and retains unrelated owners', () => {
		const destroyed: number[] = [];
		let sequence = 0;
		let fail = false;
		const cache = new ExactMaskRasterCache<{ id: number; }>({
			create: () => ({ id: ++sequence }),
			update() {
				if (fail) throw new Error('raster failed');
			},
			destroy: (resource) => {
				destroyed.push(resource.id);
			},
		});
		const a = {}; const b = {};
		cache.reconcile([Request(a), Request(b, 10)]);
		fail = true;
		expect(() => cache.reconcile([Request(a, 20)])).toThrow('raster failed');
		expect(cache.get(a)).toBeUndefined();
		expect(cache.get(b)?.id).toBe(2);
		expect(destroyed).toEqual([1]);
		expect(cache.ownerCount).toBe(1);
		fail = false;
		cache.reconcile([Request(a, 20)]);
		expect(cache.ownerCount).toBe(2);
		expect(cache.resourceCount).toBe(2);
	});

});
