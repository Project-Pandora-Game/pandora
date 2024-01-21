import {
	AccountId,
	AsyncSynchronized,
	SPACE_SHARD_UPDATEABLE_PROPERTIES,
	SpaceDataSchema,
	GetLogger,
	SpaceData,
	SpaceDataShardUpdate,
	SpaceDirectoryConfig,
	GameStateUpdate,
	IShardSpaceDefinition,
	ResolveBackground,
	SpaceId,
} from 'pandora-common';
import { GenerateInitialRoomPosition, Space } from './space';
import { assetManager } from '../assets/assetManager';
import { GetDatabase } from '../database/databaseProvider';
import _, { omit, pick } from 'lodash';
import { diffString } from 'json-diff';

export class PublicSpace extends Space {
	private readonly data: IShardSpaceDefinition;
	private readonly _modified: Set<keyof SpaceDataShardUpdate> = new Set();

	public override get id(): SpaceId {
		return this.data.id;
	}

	public get accessId(): string {
		return this.data.accessId;
	}

	public override get owners(): readonly AccountId[] {
		return this.data.owners;
	}

	public override get config(): SpaceDirectoryConfig {
		return this.data.config;
	}

	constructor(data: SpaceData) {
		super(data.inventory, GetLogger('Space', `[PublicSpace ${data.id}]`));
		this.data = data;
	}

	public update(data: IShardSpaceDefinition): void {
		if (data.id !== this.data.id) {
			throw new Error('Space id cannot change');
		}
		if (data.accessId !== this.data.accessId) {
			this.logger.warning('Access id changed! This could be a bug');
			this.data.accessId = data.accessId;
		}
		this.data.config = data.config;

		const update: GameStateUpdate = {
			info: this.getInfo(),
		};

		// Put characters into correct place if needed
		const roomBackground = ResolveBackground(assetManager, this.data.config.background);
		for (const character of this.characters) {
			if (character.position[0] > roomBackground.floorArea[0] || character.position[1] > roomBackground.floorArea[1]) {
				character.position = GenerateInitialRoomPosition();

				update.characters ??= {};
				update.characters[character.id] = {
					position: character.position,
				};
			}
		}

		this.sendUpdateToAllCharacters(update);
	}

	protected override _tick(): void {
		super._tick();

		// Save any modified data
		this.save().catch((err) => {
			this.logger.error('Periodic save failed:', err);
		});
	}

	protected override _onDataModified(data: 'inventory'): void {
		this._modified.add(data);
	}

	@AsyncSynchronized()
	public async save(): Promise<void> {
		const keys = [...this._modified];
		this._modified.clear();

		// Nothing to save
		if (keys.length === 0)
			return;

		const data: SpaceDataShardUpdate = {};

		if (keys.includes('inventory')) {
			const roomState = this.gameState.currentState.room;
			data.inventory = roomState.exportToBundle();
		}

		try {
			if (!await GetDatabase().setSpaceData(this.id, data, this.accessId)) {
				throw new Error('Database returned failure');
			}
		} catch (error) {
			for (const key of keys) {
				this._modified.add(key);
			}
			this.logger.warning(`Failed to save data:`, error);
		}
	}

	public static async load(id: SpaceId, accessId: string): Promise<Omit<SpaceData, 'config' | 'accessId' | 'owners'> | null> {
		const space = await GetDatabase().getSpaceData(id, accessId);
		if (space === false) {
			return null;
		}
		const result = await SpaceDataSchema
			.omit({ config: true, accessId: true, owners: true })
			.safeParseAsync(space);
		if (!result.success) {
			GetLogger('Space').error(`Failed to load space ${id}: `, result.error);
			return null;
		}
		const spaceWithoutDbData = omit(space, '_id');
		if (!_.isEqual(result.data, spaceWithoutDbData)) {
			const diff = diffString(spaceWithoutDbData, result.data, { color: false });
			GetLogger('Space').warning(`Space ${id} has invalid data, fixing...\n`, diff);
			await GetDatabase().setSpaceData(id, pick(result.data, SPACE_SHARD_UPDATEABLE_PROPERTIES), accessId);
		}
		return result.data;
	}
}
