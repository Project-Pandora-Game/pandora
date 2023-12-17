import { AppearanceActionContext, AssertNever, AssetManager, CharacterId, GetLogger, ICharacterData, ICharacterDataShardUpdate, ICharacterPublicData, ICharacterPublicSettings, IChatRoomMessage, IShardCharacterDefinition, Logger, RoomId, IsAuthorized, AccountRole, IShardAccountDefinition, CharacterDataSchema, AssetFrameworkGlobalState, AssetFrameworkGlobalStateContainer, AssetFrameworkCharacterState, AppearanceBundle, Assert, AssertNotNullable, ICharacterPrivateData, CharacterRestrictionsManager, AsyncSynchronized, GetDefaultAppearanceBundle, CharacterRoomPosition, GameLogicCharacterServer, IShardClientChangeEvents, NOT_NARROWING_FALSE, AssetPreferences, ResolveAssetPreference, KnownObject, CleanupAssetPreferences, CHARACTER_SHARD_UPDATEABLE_PROPERTIES } from 'pandora-common';
import { DirectoryConnector } from '../networking/socketio_directory_connector';
import type { Room } from '../room/room';
import { RoomManager } from '../room/roomManager';
import { GetDatabase } from '../database/databaseProvider';
import { ClientConnection } from '../networking/connection_client';
import { assetManager } from '../assets/assetManager';

import _, { cloneDeep, isEqual } from 'lodash';
import { diffString } from 'json-diff';

/** Time (in ms) after which manager prunes character without any active connection */
export const CHARACTER_TIMEOUT = 30_000;

/** Time (in ms) as interval when character's periodic actions (like saving of modified data) happen */
export const CHARACTER_TICK_INTERVAL = 60_000;

/** Time (in ms) for how long is update delayed before being sent; used for batching changes before updating room */
const UPDATE_DEBOUNCE = 50;

const logger = GetLogger('Character');

type ICharacterPublicDataChange = Omit<
	Pick<ICharacterDataShardUpdate, (keyof ICharacterDataShardUpdate) & (keyof ICharacterPublicData)>,
	'id' | ManuallyGeneratedKeys
>;
type ICharacterPrivateDataChange = Omit<ICharacterDataShardUpdate, keyof ICharacterPublicData | ManuallyGeneratedKeys>;
/** Keys that are not stored in raw for while loaded, but instead need to be generated while saving */
type ManuallyGeneratedKeys = 'appearance';

export class Character {
	private readonly data: Omit<ICharacterData, ManuallyGeneratedKeys>;
	public accountData: IShardAccountDefinition;
	public connectSecret: string | null;

	private modified: Set<keyof ICharacterDataShardUpdate> = new Set();

	private tickInterval: NodeJS.Timeout | null = null;

	private invalid: null | 'timeout' | 'error' | 'remove' = null;

	/** Timeout (interval) for when directory should be notified that client is disconnected */
	private _clientTimeout: NodeJS.Timeout | null = null;

	private _connection: ClientConnection | null = null;
	public get connection(): ClientConnection | null {
		return this._connection;
	}

	private _context: {
		state: 'isolated';
		globalState: AssetFrameworkGlobalStateContainer;
	} | {
		state: 'room';
		room: Room;
	} | {
		state: 'unloaded';
		appearanceBundle: AppearanceBundle;
	};

	public get room(): Room | null {
		return this._context.state === 'room' ? this._context.room : null;
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
				state: 'room',
				room,
			};
		} else {
			this._context = {
				state: 'unloaded',
				appearanceBundle: appearance,
			};
		}
	}

	public get id(): CharacterId {
		return this.data.id;
	}

	public get name(): string {
		return this.data.name;
	}

	public get profileDescription(): string {
		return this.data.profileDescription;
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

	public get isOnline(): boolean {
		return this.connectSecret != null;
	}

	public get settings(): Readonly<ICharacterPublicSettings> {
		return this.data.settings;
	}

	public get assetPreferences(): Readonly<AssetPreferences> {
		return this.data.assetPreferences;
	}

	public readonly gameLogicCharacter: GameLogicCharacterServer;

	private logger: Logger;

	public set position(value: CharacterRoomPosition) {
		this.data.position = value;
		this.modified.add('position');
	}

	public get position(): CharacterRoomPosition {
		return this.data.position;
	}

	public initRoomPosition(roomId: RoomId, value: CharacterRoomPosition, [maxX, maxY]: readonly [number, number]) {
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

	constructor(data: ICharacterData, account: IShardAccountDefinition, connectSecret: string | null, roomId: RoomId | null) {
		this.logger = GetLogger('Character', `[Character ${data.id}]`);
		this.data = data;
		this.accountData = account;
		this.connectSecret = connectSecret;

		const originalInteractionConfig = data.interactionConfig;
		this.gameLogicCharacter = new GameLogicCharacterServer(data, this.logger.prefixMessages('[GameLogic]'));

		this.setConnection(null);
		Assert(this._clientTimeout == null || connectSecret != null);

		if (data.appearance?.clientOnly) {
			this.logger.error(`Character ${data.id} has client-only appearance!`);
		}

		this._context = {
			state: 'unloaded',
			appearanceBundle: data.appearance ?? GetDefaultAppearanceBundle(),
		};

		// Load into room directly (to avoid cleanup of appearance outside of the room)
		if (roomId != null) {
			this.linkRoom(roomId);
		}

		// Link events from game logic parts
		this.gameLogicCharacter.on('dataChanged', (type) => {
			if (type === 'interactions') {
				this.setValue('interactionConfig', this.gameLogicCharacter.interactions.getData(), false);
				this._emitSomethingChanged('permissions');
			} else {
				AssertNever(type);
			}
		});

		const currentInteractionConfig = this.gameLogicCharacter.interactions.getData();
		if (!isEqual(originalInteractionConfig, currentInteractionConfig)) {
			this.setValue('interactionConfig', currentInteractionConfig, false);
		}
		const assetPreferences = cloneDeep(this.data.assetPreferences);
		if (CleanupAssetPreferences(assetManager, assetPreferences, false)) {
			this.setValue('assetPreferences', assetPreferences, true);
		}

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
						.loadFromBundle(
							assetManager,
							this.id,
							appearance,
							null,
							this.logger.prefixMessages('Appearance load:'),
						),
				),
		);
	}

	public reloadAssetManager(manager: AssetManager) {
		if (this._context.state === 'isolated') {
			this._context.globalState.reloadAssetManager(manager);
		}
	}

	public update(data: IShardCharacterDefinition) {
		Assert(this.isValid);
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
			const oldOnline = this.isOnline;
			this.connectSecret = data.connectSecret;
			if (this.connection) {
				this.connection.abortConnection();
			}
			if (data.connectSecret == null && this._clientTimeout != null) {
				clearInterval(this._clientTimeout);
				this._clientTimeout = null;
			}
			if (this.isOnline !== oldOnline) {
				// Clear waiting messages when going offline
				if (!this.isOnline) {
					this.messageQueue.length = 0;
				}
				this.room?.sendUpdateToAllInRoom({
					characters: {
						[this.id]: {
							isOnline: this.isOnline,
						},
					},
				});
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
			this.room?.characterRemove(this, true);
			Assert(NOT_NARROWING_FALSE || this._context.state !== 'room');

			if (room) {
				room.characterAdd(
					this,
					this.getCharacterAppearanceBundle(),
				);
				Assert(NOT_NARROWING_FALSE || this._context.state === 'room');
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
		if (this._clientTimeout !== null) {
			clearInterval(this._clientTimeout);
			this._clientTimeout = null;
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
		} else if (this.isValid && this.connectSecret != null) {
			this._clientTimeout = setInterval(this._handleTimeout.bind(this), CHARACTER_TIMEOUT);
		}
	}

	private _handleTimeout(): void {
		if (!this.isValid || this.connectSecret == null)
			return;
		this.logger.verbose('Client timed out');
		DirectoryConnector.sendMessage('characterClientDisconnect', { id: this.id, reason: 'timeout' });
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
		this.invalidate('remove');
	}

	private invalidate(reason: 'error' | 'remove'): void {
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
		if (this._clientTimeout !== null) {
			clearInterval(this._clientTimeout);
			this._clientTimeout = null;
		}

		// Leave room after disconnecting client (so change propagates to other people in the room)
		this.room?.characterRemove(this, false);

		if (reason === 'error') {
			DirectoryConnector.sendMessage('characterError', { id: this.id });
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
		// Save migrated data into database
		{
			const shardUpdatableResult = _.pick(result.data, ...CHARACTER_SHARD_UPDATEABLE_PROPERTIES);
			const originalUpdatableData = _.pick(character, ...CHARACTER_SHARD_UPDATEABLE_PROPERTIES);
			if (!_.isEqual(shardUpdatableResult, originalUpdatableData)) {
				const diff = diffString(originalUpdatableData, shardUpdatableResult, { color: false });
				logger.warning(`Character ${id} has invalid data, fixing...\n`, diff);
				await GetDatabase().setCharacter(id, shardUpdatableResult, accessId);
			}
		}
		return result.data;
	}

	public getPublicData(): ICharacterPublicData {
		return {
			id: this.id,
			accountId: this.accountId,
			name: this.name,
			profileDescription: this.profileDescription,
			settings: this.settings,
			assetPreferences: this.assetPreferences,
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
		// Perform lazy-load if needed
		if (this._context.state === 'unloaded') {
			Assert(this.invalid == null, 'Character state should not load while invalid');
			this._context = {
				state: 'isolated',
				globalState: this._createIsolatedState(this._context.appearanceBundle),
			};
		}
		return this._context.state === 'room' ? this._context.room.roomState : this._context.globalState;
	}

	public getCharacterState(): AssetFrameworkCharacterState {
		const state = this.getGlobalState().currentState.characters.get(this.id);
		AssertNotNullable(state);
		return state;
	}

	public getCharacterAppearanceBundle(): AppearanceBundle {
		if (this._context.state === 'unloaded') {
			return this._context.appearanceBundle;
		}
		return this.getCharacterState().exportToBundle();
	}

	public getRestrictionManager(): CharacterRestrictionsManager {
		const state = this.getGlobalState().currentState.characters.get(this.id);
		AssertNotNullable(state);

		return this.gameLogicCharacter.getRestrictionManager(state, this.room?.getActionRoomContext() ?? null);
	}

	public getAppearanceActionContext(): AppearanceActionContext {
		const globalState = this.getGlobalState();
		return {
			player: this.gameLogicCharacter,
			globalState,
			roomContext: this.room?.getActionRoomContext() ?? null,
			getCharacter: (id) => {
				const char = this.id === id ? this : this.room?.getCharacterById(id);
				return char?.gameLogicCharacter ?? null;
			},
		};
	}

	@AsyncSynchronized()
	public async save(): Promise<void> {
		const keys: (keyof ICharacterDataShardUpdate)[] = [...this.modified];
		this.modified.clear();

		// Nothing to save
		if (keys.length === 0)
			return;

		const data: ICharacterDataShardUpdate = {};

		for (const key of keys) {
			if (key === 'appearance') {
				data.appearance = this.getCharacterAppearanceBundle();
			} else {
				(data as Record<string, unknown>)[key] = this.data[key];
			}
		}

		try {
			if (!await GetDatabase().setCharacter(this.data.id, data, this.data.accessId)) {
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
	private setValue<Key extends keyof Omit<ICharacterDataShardUpdate, ManuallyGeneratedKeys>>(key: Key, value: ICharacterData[Key], room: boolean): void {
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

	private _emitSomethingChanged(...changes: IShardClientChangeEvents[]): void {
		if (this.room != null) {
			this.room.sendMessage('somethingChanged', {
				changes,
			});
		} else {
			this.connection?.sendMessage('somethingChanged', {
				changes,
			});
		}
	}

	public onAppearanceChanged(): void {
		this.modified.add('appearance');
		this.sendUpdateDebounced();
	}

	private readonly sendUpdateDebounced = _.debounce(this.sendUpdate.bind(this), UPDATE_DEBOUNCE, { maxWait: 5 * UPDATE_DEBOUNCE });
	private sendUpdate(): void {
		if (this.connection != null) {
			// Only send update if not in room, as otherwise the room handles it
			if (this.room == null) {
				const bundle = this.getGlobalState().currentState.exportToClientBundle();
				this.connection.sendMessage('chatRoomLoad', {
					room: null,
					globalState: bundle,
				});
			}
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

	public setAssetPreferences(preferences: Partial<AssetPreferences>): 'ok' | 'invalid' {
		if (CleanupAssetPreferences(assetManager, preferences, true))
			return 'invalid';

		let changed = false;
		const updated = cloneDeep(this.assetPreferences);

		if (preferences.attributes != null) {
			for (const [key, value] of KnownObject.entries(preferences.attributes)) {
				if (isEqual(updated.attributes[key], value))
					continue;

				if (Object.keys(value).length === 1 && value.base === 'normal')
					delete updated.attributes[key];
				else
					updated.attributes[key] = value;

				changed = true;
			}
		}

		if (preferences.assets != null) {
			for (const [key, value] of KnownObject.entries(preferences.assets)) {
				const asset = assetManager.getAssetById(key);
				if (!asset)
					return 'invalid';

				if (isEqual(updated.assets[key], value))
					continue;

				updated.assets[key] = value;
				changed = true;
			}
		}

		if (!changed)
			return 'ok';

		const state = this.getCharacterState();
		for (const item of state.items) {
			const preference = ResolveAssetPreference(updated, item.asset);
			if (preference === 'doNotRender') {
				return 'invalid';
			}
		}

		this.setValue('assetPreferences', updated, true);
		return 'ok';
	}

	public updateCharacterDescription(newDescription: string): void {
		this.setValue('profileDescription', newDescription, true);
	}

	private tick(): void {
		this.save().catch((err) => {
			this.logger.error('Periodic save failed:', err);
		});
	}

	//#region Chat messages

	private readonly messageQueue: IChatRoomMessage[] = [];

	public queueMessages(messages: IChatRoomMessage[]): void {
		if (messages.length === 0)
			return;
		// Do not store messages for offline characters
		if (!this.isOnline)
			return;
		this.messageQueue.push(...messages);
		this.connection?.sendMessage('chatRoomMessage', {
			messages,
		});
	}

	public onMessageAck(time: number): void {
		const nextIndex = this.messageQueue.findIndex((m) => m.time > time);
		if (nextIndex < 0) {
			this.messageQueue.length = 0;
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
