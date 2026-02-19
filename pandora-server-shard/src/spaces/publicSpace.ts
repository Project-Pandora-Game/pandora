import type { Immutable } from 'immer';
import { diffString } from 'json-diff';
import { isEqual, omit, pick } from 'lodash-es';
import {
	AccountId,
	Assert,
	AssertNever,
	AsyncSynchronized,
	GameStateUpdate,
	GetLogger,
	IShardSpaceDefinition,
	KnownObject,
	SPACE_SHARD_UPDATEABLE_PROPERTIES,
	SpaceData,
	SpaceDataSchema,
	SpaceDataShardUpdate,
	SpaceDirectoryConfig,
	SpaceId,
	type SpaceSwitchShardStatusUpdate,
	type SpaceSwitchStatus,
} from 'pandora-common';
import { GetDatabase } from '../database/databaseProvider.ts';
import { DirectoryConnector } from '../networking/socketio_directory_connector.ts';
import { Space } from './space.ts';

export class PublicSpace extends Space {
	public override readonly id: SpaceId;
	private readonly data: IShardSpaceDefinition;
	private readonly _modified: Set<keyof SpaceDataShardUpdate> = new Set();

	public get accessId(): string {
		return this.data.accessId;
	}

	public override get owners(): readonly AccountId[] {
		return this.data.owners;
	}

	public override get ownerInvites(): readonly AccountId[] {
		return this.data.ownerInvites;
	}

	public override get spaceSwitchStatus(): Immutable<SpaceSwitchStatus[]> {
		return this.data.spaceSwitchStatus;
	}

	public override get config(): SpaceDirectoryConfig {
		return this.data.config;
	}

	constructor(shardData: IShardSpaceDefinition, data: Omit<SpaceData, 'config' | 'accessId' | 'owners' | 'ownerInvites'>) {
		Assert(shardData.id === data.id);
		super(data.id, data.spaceState, GetLogger('Space', `[PublicSpace ${data.id}]`));
		this.id = data.id;
		this.data = shardData;
	}

	/** Actions to do once space is fully loaded */
	public onLoad(): void {
		this.checkSpaceSwitchStatusUpdates();
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
		this.data.owners = data.owners;
		this.data.ownerInvites = data.ownerInvites;
		this.data.spaceSwitchStatus = data.spaceSwitchStatus;

		this.checkSpaceSwitchStatusUpdates();

		const update: GameStateUpdate = {
			info: this.getInfo(),
		};

		// Character modifiers might depend on space config
		update.characterModifierEffects = this.getAndApplyCharacterModifierEffectsUpdate();

		this.sendUpdateToAllCharacters(update);
	}

	public override checkSpaceSwitchStatusUpdates(): void {
		for (const status of this.spaceSwitchStatus) {
			let updateCharacters: SpaceSwitchShardStatusUpdate['characters'] | undefined;
			const initiator = this.getCharacterById(status.initiator);
			for (const [characterId, currentStatus] of KnownObject.entries(status.characters)) {
				const character = this.getCharacterById(characterId);
				if (character == null || initiator == null) {
					// If initiator or character is not found, invalidate its checks
					updateCharacters ??= {};
					updateCharacters[characterId] = { permission: null, restriction: null };
				} else {
					const checkResult = character.checkSpaceSwitchStatus(initiator);
					if (currentStatus.permission !== checkResult.permission || currentStatus.restriction !== checkResult.restriction) {
						updateCharacters ??= {};
						updateCharacters[characterId] = checkResult;
					}
				}
			}

			if (updateCharacters != null) {
				DirectoryConnector.sendMessage('spaceSwitchStatusUpdate', {
					id: this.id,
					status: {
						initiator: status.initiator,
						characters: updateCharacters,
					},
				});
			}
		}
	}

	protected override _tick(): void {
		super._tick();

		// Save any modified data
		this.save().catch((err) => {
			this.logger.error('Periodic save failed:', err);
		});

		// Automod characters
		if (this.config.ghostManagement != null) {
			for (const character of this.characters) {
				if (character.isOnline)
					continue;

				let ignore: boolean;

				switch (this.config.ghostManagement.ignore) {
					case 'allowed':
						ignore = this.isAllowed(character);
						break;
					case 'admin':
						ignore = this.isAdmin(character);
						break;
					case 'owner':
						ignore = this.isOwner(character);
						break;
					case 'none':
						ignore = false;
						break;
					default:
						AssertNever(this.config.ghostManagement.ignore);
				}

				if (ignore)
					continue;

				// Check if the character is in a room device
				if (!this.config.ghostManagement.affectCharactersInRoomDevice) {
					const restrictionManager = character.getRestrictionManager();

					if (restrictionManager.getRoomDeviceLink() != null)
						continue;
				}

				// Check if the character has been offline for long enough
				if (Date.now() > (character.lastOnline + (this.config.ghostManagement.timer * 60_000))) {
					DirectoryConnector.sendMessage('characterAutomod', {
						id: character.id,
						action: 'kick',
						reason: 'ghostManagement',
					});
				}
			}
		}
	}

	protected override _onDataModified(data: 'spaceState'): void {
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

		if (keys.includes('spaceState')) {
			data.spaceState = this.currentState.space.exportToBundle();
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

	public static async load(id: SpaceId, accessId: string): Promise<Omit<SpaceData, 'config' | 'accessId' | 'owners' | 'ownerInvites'> | null> {
		const space = await GetDatabase().getSpaceData(id, accessId);
		if (space === false) {
			return null;
		}
		const result = await SpaceDataSchema
			.omit({ config: true, accessId: true, owners: true, ownerInvites: true })
			.safeParseAsync(space);
		if (!result.success) {
			GetLogger('Space').error(`Failed to load space ${id}: `, result.error);
			return null;
		}
		const spaceWithoutDbData = omit(space, '_id');
		if (!isEqual(result.data, spaceWithoutDbData)) {
			const diff = diffString(spaceWithoutDbData, result.data, { color: false });
			GetLogger('Space').warning(`Space ${id} has invalid data, fixing...\n`, diff);
			await GetDatabase().setSpaceData(id, pick(result.data, SPACE_SHARD_UPDATEABLE_PROPERTIES), accessId);
		}
		return result.data;
	}
}
