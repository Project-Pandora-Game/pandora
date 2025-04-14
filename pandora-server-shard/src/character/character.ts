import {
	AccountRole,
	AppearanceActionContext,
	AppearanceActionProcessingContext,
	AppearanceBundle,
	Assert,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkCharacterState,
	AssetManager,
	AssetPreferencesPublic,
	AsyncSynchronized,
	CHARACTER_SHARD_UPDATEABLE_PROPERTIES,
	CharacterDataShardSchema,
	CharacterId,
	CharacterRestrictionsManager,
	CharacterRoomPosition,
	CleanupAssetPreferences,
	CloneDeepMutable,
	GameLogicCharacterServer,
	GenerateInitialRoomPosition,
	GetDefaultAppearanceBundle,
	GetLogger,
	ICharacterDataShardUpdate,
	ICharacterPrivateData,
	ICharacterPublicData,
	ICharacterPublicSettings,
	ICharacterRoomData,
	IChatMessage,
	IShardAccountDefinition,
	IShardCharacterDefinition,
	IShardClientChangeEvents,
	IsAuthorized,
	IsValidRoomPosition,
	KnownObject,
	Logger,
	NOT_NARROWING_FALSE,
	ROOM_INVENTORY_BUNDLE_DEFAULT,
	ResolveAssetPreference,
	RoomBackgroundData,
	SpaceId,
	type AppearanceActionProcessingResult,
	type ChatMessageFilterMetadata,
	type ICharacterDataShard,
} from 'pandora-common';
import { assetManager } from '../assets/assetManager.ts';
import { GetDatabase } from '../database/databaseProvider.ts';
import { ClientConnection } from '../networking/connection_client.ts';
import { DirectoryConnector } from '../networking/socketio_directory_connector.ts';
import { PersonalSpace } from '../spaces/personalSpace.ts';
import type { Space } from '../spaces/space.ts';
import { SpaceManager } from '../spaces/spaceManager.ts';

import { Immutable } from 'immer';
import { diffString } from 'json-diff';
import { isEqual, pick } from 'lodash-es';

/** Time (in ms) after which manager prunes character without any active connection */
export const CHARACTER_TIMEOUT = 30_000;

/** Time (in ms) as interval when character's periodic actions (like saving of modified data) happen */
export const CHARACTER_TICK_INTERVAL = 60_000;

const logger = GetLogger('Character');

type ICharacterPublicDataChange = Omit<
	Pick<ICharacterDataShardUpdate, (keyof ICharacterDataShardUpdate) & (keyof ICharacterPublicData)>,
	'id' | ManuallyGeneratedKeys
>;
type ICharacterPrivateDataChange = Omit<ICharacterDataShardUpdate, keyof ICharacterPublicData | ManuallyGeneratedKeys>;
/** Keys that are not stored in raw for while loaded, but instead need to be generated while saving */
type ManuallyGeneratedKeys = 'appearance' | 'personalRoom';

export class Character {
	private readonly data: Omit<ICharacterDataShard, ManuallyGeneratedKeys>;
	public accountData: IShardAccountDefinition;
	public connectSecret: string | null;
	public lastOnline: number;

	private readonly _personalSpace: PersonalSpace;

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
		state: 'space';
		space: Space;
	} | {
		state: 'unloaded';
		appearanceBundle: AppearanceBundle;
	};

	private get _loadedSpace(): Space | undefined {
		return this._context.state === 'space' ? this._context.space : undefined;
	}

	public setSpace(space: Space | null, appearance: AppearanceBundle): void {
		if (this.connection) {
			if (this._context.state === 'space') {
				this.connection.leaveRoom(this._context.space);
			}
			if (space) {
				this.connection.joinRoom(space);
			}
		}
		if (space) {
			this._context = {
				state: 'space',
				space,
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

	public get assetPreferences(): Immutable<AssetPreferencesPublic> {
		return this.gameLogicCharacter.assetPreferences.currentPreferences;
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

	public initRoomPosition(spaceId: SpaceId | null, roomBackground: Immutable<RoomBackgroundData>) {
		if (this.data.roomId === spaceId && IsValidRoomPosition(roomBackground, this.data.position)) {
			return;
		}
		this.data.roomId = spaceId;
		this.data.position = GenerateInitialRoomPosition(roomBackground);
		this.modified.add('roomId');
		this.modified.add('position');
	}

	constructor(data: ICharacterDataShard, account: IShardAccountDefinition, connectSecret: string | null, spaceId: SpaceId | null) {
		this.logger = GetLogger('Character', `[Character ${data.id}]`);
		this.data = data;
		this.accountData = account;
		this.connectSecret = connectSecret;
		this.lastOnline = Date.now();

		this._personalSpace = new PersonalSpace(this, data.personalRoom?.inventory ?? CloneDeepMutable(ROOM_INVENTORY_BUNDLE_DEFAULT));

		const originalInteractionConfig = data.interactionConfig;
		const originalAssetPreferencesConfig = CloneDeepMutable(data.assetPreferences);
		const originalCharacterModifiersData = CloneDeepMutable(data.characterModifiers);
		this.gameLogicCharacter = new GameLogicCharacterServer(data, assetManager, this.logger.prefixMessages('[GameLogic]'));

		this.setConnection(null);
		Assert(this._clientTimeout == null || connectSecret != null);

		if (data.appearance?.clientOnly) {
			this.logger.error(`Character ${data.id} has client-only appearance!`);
		}

		this._context = {
			state: 'unloaded',
			appearanceBundle: data.appearance ?? GetDefaultAppearanceBundle(),
		};

		// Load into the space
		this.linkSpace(spaceId);

		// Link events from game logic parts
		this.gameLogicCharacter.on('dataChanged', (type) => {
			if (type === 'interactions') {
				this.setValue('interactionConfig', this.gameLogicCharacter.interactions.getData(), false);
				this._emitSomethingChanged('permissions');
			} else if (type === 'assetPreferences') {
				this.setValue('assetPreferences', this.gameLogicCharacter.assetPreferences.getData(), false);
				this._sendDataUpdate({
					assetPreferences: this.assetPreferences,
				});
				this._emitSomethingChanged('permissions');
			} else if (type === 'characterModifiers') {
				this.setValue('characterModifiers', this.gameLogicCharacter.characterModifiers.getData(), false);
				this._emitSomethingChanged('permissions');
			} else {
				AssertNever(type);
			}
		});
		this.gameLogicCharacter.characterModifiers.on('modifiersChanged', () => {
			this._emitSomethingChanged('characterModifiers');
			this._loadedSpace?.onCharacterModifiersChanged();
		});

		const currentInteractionConfig = this.gameLogicCharacter.interactions.getData();
		if (!isEqual(originalInteractionConfig, currentInteractionConfig)) {
			this.logger.debug('Migrated interaction config');
			this.setValue('interactionConfig', currentInteractionConfig, false);
		}
		const currentAssetPreferencesConfig = this.gameLogicCharacter.assetPreferences.getData();
		if (!isEqual(originalAssetPreferencesConfig, currentAssetPreferencesConfig)) {
			this.logger.debug('Migrated asset preferences');
			this.setValue('assetPreferences', currentAssetPreferencesConfig, false);
		}
		const currentCharacterModifiersData = this.gameLogicCharacter.characterModifiers.getData();
		if (!isEqual(originalCharacterModifiersData, currentCharacterModifiersData)) {
			this.logger.debug('Migrated character modifiers');
			this.setValue('characterModifiers', currentCharacterModifiersData, false);
		}

		this.tickInterval = setInterval(this.tick.bind(this), CHARACTER_TICK_INTERVAL);
	}

	public reloadAssetManager(manager: AssetManager) {
		// Spaces need to be updated first
		// By this point we can assume all public spaces were reloaded
		this._personalSpace.reloadAssetManager(manager);

		// Reload character logic after space is reloaded - data from character logic is asynchronously presented to clients anyway
		this.gameLogicCharacter.reloadAssetManager(manager);
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
			if (oldOnline || this.isOnline) {
				this.lastOnline = Date.now();
			}
			if (this.isOnline !== oldOnline) {
				// Clear waiting messages when going offline
				if (!this.isOnline) {
					this.messageQueue.length = 0;
				}
				this._loadedSpace?.sendUpdateToAllCharacters({
					characters: {
						[this.id]: {
							isOnline: this.isOnline,
						},
					},
				});
			}
		}
		this.linkSpace(data.space);
	}

	public isAuthorized(role: AccountRole): boolean {
		return IsAuthorized(this.accountData.roles ?? {}, role);
	}

	private linkSpace(id: SpaceId | null): void {
		let space: Space | null = null;
		if (id != null) {
			space = SpaceManager.getSpace(id) ?? null;
			if (!space) {
				this.logger.error(`Failed to link character to space ${id}; not found`);
			}
		}
		// Short path: No change
		if (this._context.state === 'space' && this._context.space === space)
			return;

		if (this._context.state === 'space') {
			this._context.space.characterRemove(this);
		}
		Assert(NOT_NARROWING_FALSE || this._context.state === 'unloaded');

		if (space) {
			space.characterAdd(
				this,
				this.getCharacterAppearanceBundle(),
			);
			Assert(NOT_NARROWING_FALSE || this._context.state === 'space');
		} else {
			// Trigger load into personal space
			this.getOrLoadSpace();
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
			if (this._context.state === 'space') {
				connection.joinRoom(this._context.space);
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

		// Leave space after disconnecting client (so change propagates to other people in the space)
		this._loadedSpace?.characterRemove(this);

		// Finally unload personal space
		this._personalSpace.onRemove();

		if (reason === 'error') {
			DirectoryConnector.sendMessage('characterError', { id: this.id });
		}
	}

	public static async load(id: CharacterId, accessId: string): Promise<ICharacterDataShard | null> {
		const character = await GetDatabase().getCharacter(id, accessId);
		if (character === false) {
			return null;
		}
		const result = await CharacterDataShardSchema.safeParseAsync(character);
		if (!result.success) {
			logger.error(`Failed to load character ${id}: `, result.error);
			return null;
		}
		// Save migrated data into database
		{
			const shardUpdatableResult = pick(result.data, ...CHARACTER_SHARD_UPDATEABLE_PROPERTIES);
			const originalUpdatableData = pick(character, ...CHARACTER_SHARD_UPDATEABLE_PROPERTIES);
			if (!isEqual(shardUpdatableResult, originalUpdatableData)) {
				const diff = diffString(originalUpdatableData, shardUpdatableResult, { color: false });
				logger.warning(`Character ${id} has invalid data, fixing...\n`, diff);
				await GetDatabase().setCharacter(id, shardUpdatableResult, accessId);
			}
		}
		return result.data;
	}

	public getRoomData(): ICharacterRoomData {
		return {
			id: this.id,
			accountId: this.accountId,
			name: this.name,
			profileDescription: this.profileDescription,
			settings: this.settings,
			position: this.position,
			isOnline: this.isOnline,
			assetPreferences: this.assetPreferences,
		};
	}

	public getPrivateData(): ICharacterPrivateData & ICharacterRoomData {
		return {
			...this.getRoomData(),
			inCreation: this.data.inCreation,
			created: this.data.created,
		};
	}

	/**
	 * Gets the current space or loads the character into a personal space before returning it
	 */
	public getOrLoadSpace(): Space {
		// Perform lazy-load if needed
		if (this._context.state === 'unloaded') {
			Assert(this.invalid == null, 'Character state should not load while invalid');
			// Load into the personal space
			this._personalSpace.characterAdd(
				this,
				this._context.appearanceBundle,
			);
		}
		Assert(this._context.state === 'space');
		return this._context.space;
	}

	public getCurrentPublicSpaceId(): SpaceId | null {
		return this._loadedSpace?.id ?? null;
	}

	public getCharacterState(): AssetFrameworkCharacterState {
		const state = this.getOrLoadSpace().currentState.characters.get(this.id);
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
		const space = this.getOrLoadSpace();
		return this.gameLogicCharacter.getRestrictionManager(space.currentState, space.getActionSpaceContext());
	}

	public getAppearanceActionContext(): AppearanceActionContext {
		return {
			executionContext: 'act',
			player: this.gameLogicCharacter,
			spaceContext: this.getOrLoadSpace().getActionSpaceContext(),
			getCharacter: (id) => {
				const char = this.id === id ? this : this.getOrLoadSpace().getCharacterById(id);
				return char?.gameLogicCharacter ?? null;
			},
		};
	}

	/**
	 * Runs a simulation of a custom action, returning its result.
	 */
	public checkAction(action: (processingContext: AppearanceActionProcessingContext) => AppearanceActionProcessingResult): AppearanceActionProcessingResult {
		const processingContext = new AppearanceActionProcessingContext(
			this.getAppearanceActionContext(),
			this.getOrLoadSpace().currentState,
		);

		return action(processingContext);
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
			} else if (key === 'personalRoom') {
				const roomState = this._personalSpace.currentState.room;
				data.personalRoom = {
					inventory: roomState.exportToBundle(),
				};
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

	private setValue<Key extends keyof ICharacterPublicDataChange>(key: Key, value: ICharacterDataShard[Key], intoSpace: true): void;
	private setValue<Key extends keyof ICharacterPrivateDataChange>(key: Key, value: ICharacterDataShard[Key], intoSpace: false): void;
	private setValue<Key extends keyof Omit<ICharacterDataShardUpdate, ManuallyGeneratedKeys>>(key: Key, value: ICharacterDataShard[Key], intoSpace: boolean): void {
		if (this.data[key] === value)
			return;

		this.data[key] = value;
		this.modified.add(key);

		if (intoSpace) {
			this._sendDataUpdate({
				[key]: value,
			});
		} else {
			this.connection?.sendMessage('updateCharacter', { [key]: value });
		}
	}

	private _sendDataUpdate(updatedData: Partial<ICharacterRoomData>): void {
		if (this._loadedSpace != null) {
			this._loadedSpace.sendUpdateToAllCharacters({
				characters: {
					[this.id]: updatedData,
				},
			});
		} else {
			this.connection?.sendMessage('updateCharacter', updatedData);
		}
	}

	private _emitSomethingChanged(...changes: IShardClientChangeEvents[]): void {
		if (this._loadedSpace != null) {
			this._loadedSpace.sendMessage('somethingChanged', {
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
	}

	public onPersonalSpaceChanged(): void {
		this.modified.add('personalRoom');
	}

	public setPublicSettings(settings: Partial<ICharacterPublicSettings>): void {
		if (Object.keys(settings).length === 0)
			return;

		this.setValue('settings', {
			...this.settings,
			...settings,
		}, true);
	}

	public setAssetPreferences(newPreferences: Partial<AssetPreferencesPublic>): 'ok' | 'invalid' {
		if (CleanupAssetPreferences(assetManager, newPreferences))
			return 'invalid';

		let changed = false;
		const updated = CloneDeepMutable(this.assetPreferences);

		if (newPreferences.attributes != null) {
			for (const key of new Set([...KnownObject.keys(newPreferences.attributes), ...KnownObject.keys(updated.attributes)])) {
				const newValue = newPreferences.attributes[key];

				if (isEqual(updated.attributes[key], newValue))
					continue;

				if (newValue == null) {
					delete updated.attributes[key];
				} else {
					updated.attributes[key] = newValue;
				}
				changed = true;
			}
		}

		if (newPreferences.assets != null) {
			for (const key of new Set([...KnownObject.keys(newPreferences.assets), ...KnownObject.keys(updated.assets)])) {
				const newValue = newPreferences.assets[key];

				if (isEqual(updated.assets[key], newValue))
					continue;

				if (newValue == null) {
					delete updated.assets[key];
				} else {
					updated.assets[key] = newValue;
				}
				changed = true;
			}
		}

		if (!changed)
			return 'ok';

		const state = this.getCharacterState();
		for (const item of state.items) {
			const preference = ResolveAssetPreference(updated, item.asset);
			if (preference.preference === 'doNotRender') {
				return 'invalid';
			}
		}

		this.gameLogicCharacter.assetPreferences.setPreferences(updated);
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

	private readonly messageQueue: IChatMessage[] = [];

	public queueMessages(messages: IChatMessage[]): void {
		if (messages.length === 0)
			return;
		// Do not store messages for offline characters
		if (!this.isOnline)
			return;

		let transformed: IChatMessage[];

		const hearingFilter = this.getRestrictionManager().getHearingFilter();
		if (hearingFilter.isActive()) {
			transformed = messages.map((message) => {
				if (message.type === 'chat') {
					const metadata: ChatMessageFilterMetadata = {
						from: message.from.id,
						to: message.to?.id ?? null,
					};
					return {
						...message,
						parts: hearingFilter.processMessage(CloneDeepMutable(message.parts), metadata),
					};
				} else {
					return message;
				}
			});
		} else {
			transformed = messages;
		}

		this.messageQueue.push(...transformed);
		this.connection?.sendMessage('chatMessage', {
			messages: transformed,
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
		this.connection?.sendMessage('chatMessage', {
			messages: this.messageQueue,
		});
	}

	//#endregion
}
