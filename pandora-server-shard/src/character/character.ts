import { AppearanceActionContext, AssertNever, AssetManager, CharacterId, GetLogger, ICharacterData, ICharacterDataUpdate, ICharacterPublicData, ICharacterPublicSettings, IChatRoomMessage, IShardCharacterDefinition, Logger, RoomId, IsAuthorized, AccountRole, IShardAccountDefinition, CharacterAppearance, CharacterDataSchema, AssetFrameworkGlobalState, AssetFrameworkGlobalStateContainer, AssetFrameworkCharacterState, AppearanceBundle, Assert, AssertNotNullable, ICharacterPrivateData, CharacterRestrictionsManager, AsyncSynchronized } from 'pandora-common';
import { DirectoryConnector } from '../networking/socketio_directory_connector';
import type { Room } from '../room/room';
import { RoomManager } from '../room/roomManager';
import { GetDatabase } from '../database/databaseProvider';
import { ClientConnection } from '../networking/connection_client';
import { assetManager } from '../assets/assetManager';

import _, { omit } from 'lodash';
import { diffString } from 'json-diff';

/** Time (in ms) after which manager prunes character without any active connection */
export const CHARACTER_TIMEOUT = 30_000;

/** Time (in ms) as interval when character's periodic actions (like saving of modified data) happen */
export const CHARACTER_TICK_INTERVAL = 60_000;

/** Time (in ms) for how long is update delayed before being sent; used for batching changes before updating room */
const UPDATE_DEBOUNCE = 50;

const logger = GetLogger('Character');

type ICharacterDataChange = Omit<ICharacterDataUpdate, 'id' | 'appearance'>;
type ICharacterPublicDataChange = Omit<ICharacterPublicData, 'id' | 'appearance'>;
type ICharacterPrivateDataChange = Omit<ICharacterDataUpdate, keyof ICharacterPublicData | 'appearance'>;

export class Character {
	private readonly data: Omit<ICharacterData, 'appearance'>;
	public accountData: IShardAccountDefinition;
	public connectSecret: string;

	private modified: Set<keyof ICharacterDataChange | 'appearance'> = new Set();

	private tickInterval: NodeJS.Timeout | null = null;

	private invalid: null | 'timeout' | 'error' | 'remove' = null;
	private timeout: NodeJS.Timeout | null = null;

	private _connection: ClientConnection | null = null;
	public get connection(): ClientConnection | null {
		return this._connection;
	}

	private _context: {
		inRoom: false;
		globalState: AssetFrameworkGlobalStateContainer;
	} | {
		inRoom: true;
		room: Room;
	};

	public get room(): Room | null {
		return this._context.inRoom ? this._context.room : null;
	}

	public setRoom(room: Room | null, appearance: AppearanceBundle): void {
		if (this.connection) {
			if (this.room) {
				this.connection.leaveRoom(this.room);
			}
			if (room) {
				this.connection.joinRoom(room);
			}
		}
		if (room) {
			this._context = {
				inRoom: true,
				room,
			};
		} else {
			this._context = {
				inRoom: false,
				globalState: this._createIsolatedState(appearance),
			};
		}
	}

	public get id(): CharacterId {
		return this.data.id;
	}

	public get name(): string {
		return this.data.name;
	}

	public get accountId(): number {
		return this.data.accountId;
	}

	public get accessId(): string {
		return this.data.accessId;
	}

	public get isInCreation(): boolean {
		return this.data.inCreation === true;
	}

	public get isValid(): boolean {
		return this.invalid === null;
	}

	public get settings(): Readonly<ICharacterPublicSettings> {
		return this.data.settings;
	}

	private logger: Logger;

	public set position(value: readonly [number, number]) {
		this.data.position = value;
		this.modified.add('position');
	}

	public get position(): readonly [number, number] {
		return this.data.position;
	}

	public initRoomPosition(roomId: RoomId, value: readonly [number, number], [maxX, maxY]: readonly [number, number]) {
		if (this.data.roomId === roomId) {
			if (this.data.position[0] > maxX || this.data.position[1] > maxY) {
				this.data.position = value;
				this.modified.add('position');
			}
			return;
		}
		this.data.roomId = roomId;
		this.data.position = value;
		this.modified.add('roomId');
		this.modified.add('position');
	}

	constructor(data: ICharacterData, account: IShardAccountDefinition, connectSecret: string, room: RoomId | null) {
		this.logger = GetLogger('Character', `[Character ${data.id}]`);
		this.data = data;
		this.accountData = account;
		this.connectSecret = connectSecret;

		this.setConnection(null);

		if (data.appearance?.clientOnly) {
			this.logger.error(`Character ${data.id} has client-only appearance!`);
		}

		this._context = {
			inRoom: false,
			globalState: this._createIsolatedState(data.appearance),
		};

		this.linkRoom(room);

		this.tickInterval = setInterval(this.tick.bind(this), CHARACTER_TICK_INTERVAL);
	}

	/** Creates an isolated framework sate, for when the character is not in a room */
	private _createIsolatedState(appearance: AppearanceBundle | undefined): AssetFrameworkGlobalStateContainer {
		return new AssetFrameworkGlobalStateContainer(
			assetManager,
			this.logger,
			this.onAppearanceChanged.bind(this),
			AssetFrameworkGlobalState.createDefault(assetManager)
				.withCharacter(
					this.id,
					AssetFrameworkCharacterState
						.loadFromBundle(assetManager, this.id, appearance, this.logger.prefixMessages('Appearance load:'))
						.cleanupRoomDeviceWearables(null),
				),
		);
	}

	public reloadAssetManager(manager: AssetManager) {
		if (!this._context.inRoom) {
			this._context.globalState.reloadAssetManager(manager);
		}
	}

	public update(data: IShardCharacterDefinition) {
		if (data.id !== this.data.id) {
			throw new Error('Character update changes id');
		}
		if (data.account.id !== this.data.accountId) {
			throw new Error('Character update changes account');
		}
		this.accountData = data.account;
		if (data.accessId !== this.data.accessId) {
			this.logger.warning('Access id changed! This could be a bug');
			this.data.accessId = data.accessId;
		}
		if (data.connectSecret !== this.connectSecret) {
			this.logger.debug('Connection secret changed');
			this.connectSecret = data.connectSecret;
			if (this.connection) {
				this.connection.abortConnection();
			}
		}
		this.linkRoom(data.room);
	}

	public isAuthorized(role: AccountRole): boolean {
		return IsAuthorized(this.accountData.roles ?? {}, role);
	}

	private linkRoom(id: RoomId | null): void {
		let room: Room | null = null;
		if (id != null) {
			room = RoomManager.getRoom(id) ?? null;
			if (!room) {
				this.logger.error(`Failed to link character to room ${id}; not found`);
			}
		}
		if (this.room !== room) {
			this.room?.characterLeave(this);

			if (room) {
				Assert(!this._context.inRoom);
				const characterAppearance = this._context.globalState.currentState.characters.get(this.id)?.exportToBundle();
				AssertNotNullable(characterAppearance);
				room.characterEnter(
					this,
					characterAppearance,
				);
			}
		}
	}

	public isInUse(): boolean {
		return this.connection !== undefined;
	}

	public setConnection(connection: ClientConnection | null): void {
		if (this.invalid) {
			AssertNever();
		}
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		const oldConnection = this._connection;
		this._connection = null;
		if (oldConnection && oldConnection !== connection) {
			this.logger.debug(`Disconnected (${oldConnection.id})`);
			oldConnection.character = null;
			oldConnection.abortConnection();
		}
		if (connection) {
			this.logger.debug(`Connected (${connection.id})`);
			connection.character = this;
			if (this.room) {
				connection.joinRoom(this.room);
			}
			this._connection = connection;
		} else if (this.isValid) {
			this.timeout = setTimeout(this.handleTimeout.bind(this), CHARACTER_TIMEOUT);
		}
	}

	private handleTimeout(): void {
		if (this.invalid) {
			AssertNever();
		}
		this.logger.verbose('Timed out');
		this.invalidate('timeout');
	}

	public async finishCreation(name: string): Promise<boolean> {
		if (!this.data.inCreation)
			return false;

		this.setValue('name', name, true);
		await this.save();

		if (!this.modified.has('name')) {
			const { created } = await DirectoryConnector.awaitResponse('createCharacter', { id: this.data.id });
			this.data.created = created;
			this.data.inCreation = undefined;
			this.connection?.sendMessage('updateCharacter', {
				created,
			});
			return true;
		}

		return false;
	}

	public onRemove(): void {
		this.room?.characterLeave(this);
		this.invalidate('remove');
	}

	private invalidate(reason: 'timeout' | 'error' | 'remove'): void {
		if (this.invalid !== null)
			return;
		this.invalid = reason;

		if (this.tickInterval !== null) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}

		const oldConnection = this.connection;
		this._connection = null;
		if (oldConnection) {
			this.logger.debug(`Disconnected during invalidation (${oldConnection.id})`);
			oldConnection.character = null;
			oldConnection.abortConnection();
		}
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		if (reason !== 'remove') {
			DirectoryConnector.sendMessage('characterDisconnect', { id: this.id, reason });
		}
	}

	public static async load(id: CharacterId, accessId: string): Promise<ICharacterData | null> {
		const character = await GetDatabase().getCharacter(id, accessId);
		if (character === false) {
			return null;
		}
		const result = await CharacterDataSchema.safeParseAsync(character);
		if (!result.success) {
			logger.error(`Failed to load character ${id}: `, result.error);
			return null;
		}
		const characterWithoutDbData = omit(character, '_id');
		if (!_.isEqual(result.data, characterWithoutDbData)) {
			const diff = diffString(characterWithoutDbData, result.data, { color: false });
			logger.warning(`Character ${id} has invalid data, fixing...\n`, diff);
			await GetDatabase().setCharacter(_.omit(result.data, 'inCreation', 'accountId', 'created'));
		}
		return result.data;
	}

	public getPublicData(): ICharacterPublicData {
		return {
			id: this.data.id,
			accountId: this.data.accountId,
			name: this.data.name,
			settings: this.data.settings,
		};
	}

	public getPrivateData(): ICharacterPrivateData {
		return {
			...this.getPublicData(),
			inCreation: this.data.inCreation,
			created: this.data.created,
		};
	}

	public getGlobalState(): AssetFrameworkGlobalStateContainer {
		return this._context.inRoom ? this._context.room.roomState : this._context.globalState;
	}

	public getAppearance(): CharacterAppearance {
		const state = this.getGlobalState().currentState.characters.get(this.id);
		AssertNotNullable(state);

		return new CharacterAppearance(state, () => this.data);
	}

	public getRestrictionManager(): CharacterRestrictionsManager {
		return this.getAppearance().getRestrictionManager(this.room?.getActionRoomContext() ?? null);
	}

	public getAppearanceActionContext(): AppearanceActionContext {
		const globalState = this.getGlobalState();
		return {
			player: this.id,
			globalState,
			getCharacter: (id) => {
				const char = this.id === id ? this : this.room?.getCharacterById(id);
				return char?.getRestrictionManager() ?? null;
			},
			getTarget: (target) => {
				if (target.type === 'character') {
					const char = this.id === target.characterId ? this : this.room?.getCharacterById(target.characterId);
					return char?.getAppearance() ?? null;
				}

				if (target.type === 'roomInventory') {
					return this.room?.getRoomInventory() ?? null;
				}

				AssertNever(target);
			},
			actionHandler: (message) => {
				this.room?.handleActionMessage(message);
			},
		};
	}

	@AsyncSynchronized()
	public async save(): Promise<void> {
		const keys: (keyof Omit<ICharacterDataUpdate, 'id'>)[] = [...this.modified];
		this.modified.clear();

		// Nothing to save
		if (keys.length === 0)
			return;

		const data: ICharacterDataUpdate = {
			id: this.data.id,
			accessId: this.data.accessId,
		};

		for (const key of keys) {
			if (key === 'appearance') {
				const characterState = this.getGlobalState().currentState.getCharacterState(this.id);
				AssertNotNullable(characterState);
				data.appearance = characterState.exportToBundle();
			} else {
				(data as Record<string, unknown>)[key] = this.data[key];
			}
		}

		try {
			if (!await GetDatabase().setCharacter(data)) {
				throw new Error('Database returned failure');
			}
		} catch (error) {
			for (const key of keys) {
				this.modified.add(key);
			}
			this.logger.warning(`Failed to save data:`, error);
		}
	}

	private setValue<Key extends keyof ICharacterPublicDataChange>(key: Key, value: ICharacterData[Key], room: true): void;
	private setValue<Key extends keyof ICharacterPrivateDataChange>(key: Key, value: ICharacterData[Key], room: false): void;
	private setValue<Key extends keyof ICharacterDataChange>(key: Key, value: ICharacterData[Key], room: boolean): void {
		if (this.data[key] === value)
			return;

		this.data[key] = value;
		this.modified.add(key);

		if (room && this.room) {
			this.room.sendUpdateToAllInRoom({
				characters: {
					[this.id]: {
						[key]: value,
					},
				},
			});
		} else {
			this.connection?.sendMessage('updateCharacter', { [key]: value });
		}
	}

	public onAppearanceChanged(): void {
		this.modified.add('appearance');

		this.sendUpdateDebounced();
	}

	private readonly sendUpdateDebounced = _.debounce(this.sendUpdate.bind(this), UPDATE_DEBOUNCE, { maxWait: 5 * UPDATE_DEBOUNCE });
	private sendUpdate(): void {
		// Only send update if not in room, as otherwise the room handles it
		if (!this._context.inRoom) {
			this.connection?.sendMessage('chatRoomLoad', {
				room: null,
				globalState: this._context.globalState.currentState.exportToClientBundle(),
			});
		}
	}

	public setPublicSettings(settings: Partial<ICharacterPublicSettings>): void {
		if (this.room) {
			if (!this.room.getInfo().features.includes('allowPronounChanges')) {
				delete settings.pronoun;
			}
		}
		if (Object.keys(settings).length === 0)
			return;

		this.setValue('settings', {
			...this.settings,
			...settings,
		}, true);
	}

	private tick(): void {
		this.save().catch((err) => {
			this.logger.error('Periodic save failed:', err);
		});
	}

	//#region Chat messages

	private messageQueue: IChatRoomMessage[] = [];

	public queueMessages(messages: IChatRoomMessage[]): void {
		if (messages.length === 0)
			return;
		this.messageQueue.push(...messages);
		this.connection?.sendMessage('chatRoomMessage', {
			messages,
		});
	}

	public onMessageAck(time: number): void {
		const nextIndex = this.messageQueue.findIndex((m) => m.time > time);
		if (nextIndex < 0) {
			this.messageQueue = [];
		} else {
			this.messageQueue.splice(0, nextIndex);
		}
	}

	public sendAllPendingMessages(): void {
		this.connection?.sendMessage('chatRoomMessage', {
			messages: this.messageQueue,
		});
	}

	//#endregion
}
