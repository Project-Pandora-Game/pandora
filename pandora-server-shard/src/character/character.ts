import {
	AppearanceActionContext,
	AssertNever,
	AssetManager,
	CharacterId,
	GetLogger,
	ICharacterData,
	ICharacterDataShardUpdate,
	ICharacterPublicData,
	ICharacterPublicSettings,
	IChatMessage,
	IShardCharacterDefinition,
	Logger,
	SpaceId,
	IsAuthorized,
	AccountRole,
	IShardAccountDefinition,
	CharacterDataSchema,
	AssetFrameworkGlobalStateContainer,
	AssetFrameworkCharacterState,
	AppearanceBundle,
	Assert,
	AssertNotNullable,
	ICharacterPrivateData,
	CharacterRestrictionsManager,
	AsyncSynchronized,
	GetDefaultAppearanceBundle,
	CharacterRoomPosition,
	GameLogicCharacterServer,
	IShardClientChangeEvents,
	NOT_NARROWING_FALSE,
	AssetPreferences,
	ResolveAssetPreference,
	KnownObject,
	CleanupAssetPreferences,
	CHARACTER_SHARD_UPDATEABLE_PROPERTIES,
	CloneDeepMutable,
	ROOM_INVENTORY_BUNDLE_DEFAULT,
} from 'pandora-common';
import { DirectoryConnector } from '../networking/socketio_directory_connector';
import type { Space } from '../spaces/space';
import { SpaceManager } from '../spaces/spaceManager';
import { GetDatabase } from '../database/databaseProvider';
import { ClientConnection } from '../networking/connection_client';
import { PersonalSpace } from '../spaces/personalSpace';
import { assetManager } from '../assets/assetManager';

import _, { cloneDeep, isEqual } from 'lodash';
import { diffString } from 'json-diff';

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
	private readonly data: Omit<ICharacterData, ManuallyGeneratedKeys>;
	public accountData: IShardAccountDefinition;
	public connectSecret: string | null;

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

	public initRoomPosition(spaceId: SpaceId | null, value: CharacterRoomPosition, [maxX, maxY]: readonly [number, number]) {
		if (this.data.roomId === spaceId) {
			if (this.data.position[0] > maxX || this.data.position[1] > maxY) {
				this.data.position = value;
				this.modified.add('position');
			}
			return;
		}
		this.data.roomId = spaceId;
		this.data.position = value;
		this.modified.add('roomId');
		this.modified.add('position');
	}

	constructor(data: ICharacterData, account: IShardAccountDefinition, connectSecret: string | null, spaceId: SpaceId | null) {
		this.logger = GetLogger('Character', `[Character ${data.id}]`);
		this.data = data;
		this.accountData = account;
		this.connectSecret = connectSecret;

		this._personalSpace = new PersonalSpace(this, data.personalRoom?.inventory ?? CloneDeepMutable(ROOM_INVENTORY_BUNDLE_DEFAULT));

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

		// Load into the space
		this.linkSpace(spaceId);

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
		if (CleanupAssetPreferences(assetManager, assetPreferences)) {
			this.setValue('assetPreferences', assetPreferences, true);
		}

		this.tickInterval = setInterval(this.tick.bind(this), CHARACTER_TICK_INTERVAL);
	}

	public reloadAssetManager(manager: AssetManager) {
		this._personalSpace.reloadAssetManager(manager);
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

	public getGlobalState(): AssetFrameworkGlobalStateContainer {
		const space = this.getOrLoadSpace();
		return space.gameState;
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

		return this.gameLogicCharacter.getRestrictionManager(state, this.getOrLoadSpace().getActionSpaceContext());
	}

	public getAppearanceActionContext(): AppearanceActionContext {
		const globalState = this.getGlobalState();
		return {
			player: this.gameLogicCharacter,
			globalState,
			spaceContext: this.getOrLoadSpace().getActionSpaceContext(),
			getCharacter: (id) => {
				const char = this.id === id ? this : this.getOrLoadSpace().getCharacterById(id);
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
			} else if (key === 'personalRoom') {
				const roomState = this._personalSpace.gameState.currentState.room;
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

	private setValue<Key extends keyof ICharacterPublicDataChange>(key: Key, value: ICharacterData[Key], intoSpace: true): void;
	private setValue<Key extends keyof ICharacterPrivateDataChange>(key: Key, value: ICharacterData[Key], intoSpace: false): void;
	private setValue<Key extends keyof Omit<ICharacterDataShardUpdate, ManuallyGeneratedKeys>>(key: Key, value: ICharacterData[Key], intoSpace: boolean): void {
		if (this.data[key] === value)
			return;

		this.data[key] = value;
		this.modified.add(key);

		if (intoSpace) {
			this._loadedSpace?.sendUpdateToAllCharacters({
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
		const space = this.getOrLoadSpace();
		if (!space.getInfo().features.includes('allowPronounChanges')) {
			delete settings.pronoun;
		}
		if (Object.keys(settings).length === 0)
			return;

		this.setValue('settings', {
			...this.settings,
			...settings,
		}, true);
	}

	public setAssetPreferences(newPreferences: Partial<AssetPreferences>): 'ok' | 'invalid' {
		if (CleanupAssetPreferences(assetManager, newPreferences))
			return 'invalid';

		let changed = false;
		const updated = cloneDeep(this.assetPreferences);

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

	private readonly messageQueue: IChatMessage[] = [];

	public queueMessages(messages: IChatMessage[]): void {
		if (messages.length === 0)
			return;
		// Do not store messages for offline characters
		if (!this.isOnline)
			return;
		this.messageQueue.push(...messages);
		this.connection?.sendMessage('chatMessage', {
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
		this.connection?.sendMessage('chatMessage', {
			messages: this.messageQueue,
		});
	}

	//#endregion
}
