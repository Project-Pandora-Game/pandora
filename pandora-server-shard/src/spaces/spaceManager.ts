import { SpaceId, GetLogger, IShardSpaceDefinition, Assert } from 'pandora-common';
import { PublicSpace } from './publicSpace';
import promClient from 'prom-client';
import { assetManager } from '../assets/assetManager';

const logger = GetLogger('SpaceManager');

// TODO(spaces): Consider migrating metric ids
const spacesMetric = new promClient.Gauge({
	name: 'pandora_shard_rooms',
	help: 'Current count of spaces loaded on this shard',
});

export const SpaceManager = new class SpaceManager {
	private readonly _spaces: Map<SpaceId, PublicSpace> = new Map();

	public getSpace(id: SpaceId): PublicSpace | undefined {
		return this._spaces.get(id);
	}

	public listSpaces(): Pick<IShardSpaceDefinition, 'id' | 'accessId'>[] {
		return [...this._spaces.values()]
			.map((space) => ({
				id: space.id,
				accessId: space.accessId,
			}));
	}

	public listSpaceIds(): SpaceId[] {
		return Array.from(this._spaces.keys());
	}

	public async loadSpace(definition: IShardSpaceDefinition): Promise<PublicSpace | null> {
		const id = definition.id;

		let space = this._spaces.get(id);
		if (space) {
			space.update(definition);
			return space;
		}

		const data = await PublicSpace.load(id, definition.accessId);
		if (!data)
			return null;
		Assert(data.id === definition.id);

		space = this._spaces.get(id);
		if (space) {
			space.update(definition);
			return space;
		}

		logger.debug(`Adding space ${data.id}`);
		space = new PublicSpace({
			...data,
			id: definition.id,
			config: definition.config,
			accessId: definition.accessId,
			owners: definition.owners,
		});
		this._spaces.set(id, space);
		spacesMetric.set(this._spaces.size);
		return space;
	}

	public removeSpace(id: SpaceId): Promise<void> {
		const space = this._spaces.get(id);
		if (!space)
			return Promise.resolve();
		logger.verbose(`Removing space ${id}`);
		space.onRemove();
		this._spaces.delete(id);
		spacesMetric.set(this._spaces.size);

		// Save all data after removing the space
		return space.save();
	}

	public async removeAllSpaces(): Promise<void> {
		await Promise.allSettled(
			Array.from(this._spaces.keys())
				.map((id) => this.removeSpace(id)),
		);
	}

	public onAssetDefinitionsChanged() {
		for (const space of this._spaces.values()) {
			space.reloadAssetManager(assetManager);
		}
	}
};
