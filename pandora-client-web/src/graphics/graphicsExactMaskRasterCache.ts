/** Inputs use the original ordered triangles; white-over-black compositing is order dependent. */
export interface ExactMaskRasterInput<TTexture extends object> {
	texture: TTexture;
	positions: Float32Array;
	uvs: Float32Array;
	indices: ArrayLike<number>;
}

export interface ExactMaskRasterRequest<TTexture extends object> extends ExactMaskRasterInput<TTexture> {
	owner: object;
}

/** Cache-owned copies; resource callbacks must not modify these arrays. */
export interface ExactMaskRasterSnapshot<TTexture extends object> extends ExactMaskRasterInput<TTexture> {
	indices: Uint32Array;
}

export interface ExactMaskRasterFactory<TResource, TTexture extends object> {
	create(snapshot: ExactMaskRasterSnapshot<TTexture>): TResource;
	update(resource: TResource, snapshot: ExactMaskRasterSnapshot<TTexture>): void;
	destroy(resource: TResource): void;
}

type Entry<TResource, TTexture extends object> = {
	resource: TResource;
	snapshot: ExactMaskRasterSnapshot<TTexture>;
	used: number[];
	revision: number;
	owners: number;
};
type Group<TResource, TTexture extends object> = {
	input: ExactMaskRasterInput<TTexture>;
	revision: number;
	owners: object[];
	used: number[];
	entry?: Entry<TResource, TTexture>;
};

/**
 * One explicitly scoped character's live exact mask rasters. No pose history is
 * retained: zero-owner entries survive only during reconcile(), where they can be
 * reused for the next pose. Separate characters must use separate cache instances.
 * The caller must reconcile all pending owners of this scope together before drawing.
 */
export class ExactMaskRasterCache<TResource, TTexture extends object = object> {
	private readonly _entries = new Set<Entry<TResource, TTexture>>();
	private readonly _owners = new Map<object, Entry<TResource, TTexture>>();
	private readonly _revisions = new WeakMap<TTexture, number>();
	private _destroyed = false;
	private readonly _factory: ExactMaskRasterFactory<TResource, TTexture>;

	constructor(factory: ExactMaskRasterFactory<TResource, TTexture>) {
		this._factory = factory;
	}

	public get resourceCount(): number {
		return this._entries.size;
	}
	public get ownerCount(): number {
		return this._owners.size;
	}

	/** Texture/source update listeners call this before queuing their owners. */
	public invalidate(texture: TTexture): void {
		this._revisions.set(texture, (this._revisions.get(texture) ?? 0) + 1);
	}

	public reconcile(requests: readonly ExactMaskRasterRequest<TTexture>[]): ReadonlyMap<object, TResource> {
		if (this._destroyed)
			throw new Error('Cannot update a destroyed mask raster cache');
		const pending = new Set<object>();
		for (const request of requests) {
			if (pending.has(request.owner))
				throw new Error('A mask raster owner may occur only once per reconcile');
			pending.add(request.owner);
		}
		const oldEntries = new Map<object, Entry<TResource, TTexture>>();
		for (const owner of pending) {
			const old = this._owners.get(owner);
			if (old) {
				oldEntries.set(owner, old);
				old.owners--;
				this._owners.delete(owner);
			}
		}

		const groups: Group<TResource, TTexture>[] = [];
		const reserved = new Set<Entry<TResource, TTexture>>();
		for (const input of requests) {
			const revision = this._revisions.get(input.texture) ?? 0;
			let group = groups.find((candidate) => candidate.revision === revision && EqualInput(candidate.input, input, candidate.used));
			if (group) {
				group.owners.push(input.owner);
				continue;
			}
			let entry: Entry<TResource, TTexture> | undefined;
			for (const candidate of this._entries) {
				if (candidate.revision === revision && EqualEntry(candidate, input)) {
					entry = candidate;
					break;
				}
			}
			if (entry)
				reserved.add(entry);
			group = { input, revision, owners: [input.owner], used: entry?.used ?? [...new Set(Array.from(input.indices))], entry };
			groups.push(group);
		}

		// Reserve all exact matches BEFORE recycling. Two owners exchanging poses
		// must keep both matching rasters instead of overwriting one prematurely.
		const reusable = [...this._entries].filter((entry) => entry.owners === 0 && !reserved.has(entry));
		const available = new Set(reusable);
		const touched = new Set<Entry<TResource, TTexture>>();
		try {
			for (const group of groups) {
				if (group.entry)
					continue;
				const used = group.used;
				let entry: Entry<TResource, TTexture> | undefined;
				// Keep a moving mask on its previous render target when possible.
				// Arbitrary recycling makes scissor history accumulate unrelated limbs.
				for (const owner of group.owners) {
					const previous = oldEntries.get(owner);
					if (previous && available.delete(previous)) {
						entry = previous;
						break;
					}
				}
				while (!entry && reusable.length > 0) {
					const candidate = reusable.pop()!;
					if (available.delete(candidate))
						entry = candidate;
				}
				const snapshot = CopyInput(group.input, entry?.snapshot);
				if (entry) {
					// If an update fails, this resource cannot represent its old raster.
					touched.add(entry);
					this._factory.update(entry.resource, snapshot);
					entry.snapshot = snapshot;
					entry.used = used;
					entry.revision = group.revision;
				} else {
					entry = { resource: this._factory.create(snapshot), snapshot, used, revision: group.revision, owners: 0 };
					this._entries.add(entry);
					touched.add(entry);
				}
				group.entry = entry;
			}
		} catch (error) {
			// Restore unchanged ownership after a preparation failure. Updated
			// resources are retired rather than exposing their previous key again.
			for (const [owner, entry] of oldEntries) {
				if (!touched.has(entry)) {
					this._owners.set(owner, entry);
					entry.owners++;
				}
			}
			for (const entry of touched) {
				this._entries.delete(entry);
				this._factory.destroy(entry.resource);
			}
			this._destroyUnused();
			throw error;
		}

		const result = new Map<object, TResource>();
		for (const group of groups) {
			const entry = group.entry!;
			for (const owner of group.owners) {
				entry.owners++;
				this._owners.set(owner, entry);
				result.set(owner, entry.resource);
			}
		}
		this._destroyUnused();
		return result;
	}

	/** Return the last assigned raster without retaining another ownership reference. */
	public get(owner: object): TResource | undefined {
		return this._owners.get(owner)?.resource;
	}

	public release(owner: object): void {
		const entry = this._owners.get(owner);
		if (!entry)
			return;
		this._owners.delete(owner);
		if (--entry.owners === 0) {
			this._entries.delete(entry);
			this._factory.destroy(entry.resource);
		}
	}

	public destroy(): void {
		if (this._destroyed)
			return;
		this._destroyed = true;
		for (const entry of this._entries)
			this._factory.destroy(entry.resource);
		this._entries.clear();
		this._owners.clear();
	}

	private _destroyUnused(): void {
		for (const entry of this._entries) {
			if (entry.owners !== 0)
				continue;
			this._entries.delete(entry);
			this._factory.destroy(entry.resource);
		}
	}
}

function EqualEntry<TResource, TTexture extends object>(entry: Entry<TResource, TTexture>, input: ExactMaskRasterInput<TTexture>): boolean {
	return EqualInput(entry.snapshot, input, entry.used);
}

function EqualInput<TTexture extends object>(a: ExactMaskRasterInput<TTexture>, b: ExactMaskRasterInput<TTexture>, used?: readonly number[]): boolean {
	if (a.texture !== b.texture || a.indices.length !== b.indices.length)
		return false;
	for (let i = 0; i < a.indices.length; i++) {
		if (a.indices[i] !== b.indices[i])
			return false;
	}
	for (const i of used ?? new Set(Array.from(a.indices))) {
		const index = 2 * i;
		if (!Object.is(a.positions[index], b.positions[index]) || !Object.is(a.positions[index + 1], b.positions[index + 1]) ||
			!Object.is(a.uvs[index], b.uvs[index]) || !Object.is(a.uvs[index + 1], b.uvs[index + 1]))
			return false;
	}
	return true;
}

function EqualValues(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
	if (a.length !== b.length)
		return false;
	for (let i = 0; i < a.length; i++) {
		if (!Object.is(a[i], b[i]))
			return false;
	}
	return true;
}

function CopyInput<TTexture extends object>(input: ExactMaskRasterInput<TTexture>, previous?: ExactMaskRasterSnapshot<TTexture>): ExactMaskRasterSnapshot<TTexture> {
	// Retain equal immutable buffers. Fresh UV/index copies on every pose would
	// cause the mesh to upload static attributes/topology again for each raster.
	return {
		texture: input.texture,
		positions: previous && EqualValues(previous.positions, input.positions) ? previous.positions : input.positions.slice(),
		uvs: previous && EqualValues(previous.uvs, input.uvs) ? previous.uvs : input.uvs.slice(),
		indices: previous && EqualValues(previous.indices, input.indices) ? previous.indices : Uint32Array.from(input.indices),
	};
}
