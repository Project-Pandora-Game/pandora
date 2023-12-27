import { AccountId, AsyncSynchronized, CHATROOM_SHARD_UPDATEABLE_PROPERTIES, CalculateCharacterMaxYForBackground, ChatRoomDataSchema, GetLogger, IChatRoomData, IChatRoomDataShardUpdate, IChatRoomDirectoryConfig, IChatRoomUpdate, IShardChatRoomDefinition, ResolveBackground, RoomId } from 'pandora-common';
import { GenerateInitialRoomPosition, Room } from './room';
import { assetManager } from '../assets/assetManager';
import { GetDatabase } from '../database/databaseProvider';
import _, { omit, pick } from 'lodash';
import { diffString } from 'json-diff';

export class PublicRoom extends Room {
	private readonly data: IShardChatRoomDefinition;
	private readonly _modified: Set<keyof IChatRoomDataShardUpdate> = new Set();

	public override get id(): RoomId {
		return this.data.id;
	}

	public get accessId(): string {
		return this.data.accessId;
	}

	public override get owners(): readonly AccountId[] {
		return this.data.owners;
	}

	public override get config(): IChatRoomDirectoryConfig {
		return this.data.config;
	}

	constructor(data: IChatRoomData) {
		super(data.inventory, GetLogger('Room', `[PublicRoom ${data.id}]`));
		this.data = data;
	}

	public update(data: IShardChatRoomDefinition): void {
		if (data.id !== this.data.id) {
			throw new Error('Chatroom id cannot change');
		}
		if (data.accessId !== this.data.accessId) {
			this.logger.warning('Access id changed! This could be a bug');
			this.data.accessId = data.accessId;
		}
		this.data.config = data.config;

		const update: IChatRoomUpdate = {
			info: this.getInfo(),
		};

		// Put characters into correct place if needed
		const roomBackground = ResolveBackground(assetManager, this.data.config.background);
		const maxY = CalculateCharacterMaxYForBackground(roomBackground);
		for (const character of this.characters) {
			if (character.position[0] > roomBackground.size[0] || character.position[1] > maxY) {
				character.position = GenerateInitialRoomPosition();

				update.characters ??= {};
				update.characters[character.id] = {
					position: character.position,
				};
			}
		}

		this.sendUpdateToAllInRoom(update);
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

		const data: IChatRoomDataShardUpdate = {};

		if (keys.includes('inventory')) {
			const roomState = this.roomState.currentState.room;
			data.inventory = roomState.exportToBundle();
		}

		try {
			if (!await GetDatabase().setChatRoom(this.id, data, this.accessId)) {
				throw new Error('Database returned failure');
			}
		} catch (error) {
			for (const key of keys) {
				this._modified.add(key);
			}
			this.logger.warning(`Failed to save data:`, error);
		}
	}

	public static async load(id: RoomId, accessId: string): Promise<Omit<IChatRoomData, 'config' | 'accessId' | 'owners'> | null> {
		const room = await GetDatabase().getChatRoom(id, accessId);
		if (room === false) {
			return null;
		}
		const result = await ChatRoomDataSchema
			.omit({ config: true, accessId: true, owners: true })
			.safeParseAsync(room);
		if (!result.success) {
			GetLogger('Room').error(`Failed to load room ${id}: `, result.error);
			return null;
		}
		const roomWithoutDbData = omit(room, '_id');
		if (!_.isEqual(result.data, roomWithoutDbData)) {
			const diff = diffString(roomWithoutDbData, result.data, { color: false });
			GetLogger('Room').warning(`Room ${id} has invalid data, fixing...\n`, diff);
			await GetDatabase().setChatRoom(id, pick(result.data, CHATROOM_SHARD_UPDATEABLE_PROPERTIES), accessId);
		}
		return result.data;
	}
}
