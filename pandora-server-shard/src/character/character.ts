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
	CHARACTER_PUBLIC_SETTINGS,
	CHARACTER_SETTINGS_DEFAULT,
	CHARACTER_SHARD_UPDATEABLE_PROPERTIES,
	CalculateObjectKeysDelta,
	CharacterDataShardSchema,
	CharacterId,
	CharacterRestrictionsManager,
	CleanupAssetPreferences,
	CloneDeepMutable,
	GameLogicCharacterServer,
	GetDefaultAppearanceBundle,
	GetLogger,
	ICharacterDataShardUpdate,
	ICharacterPrivateData,
	ICharacterRoomData,
	IShardAccountDefinition,
	IShardCharacterDefinition,
	IShardClientChangeEvents,
	IsAuthorized,
	KnownObject,
	Logger,
	NOT_NARROWING_FALSE,
	ResolveAssetPreference,
	SPACE_STATE_BUNDLE_DEFAULT_PERSONAL_SPACE,
	SpaceId,
	type AppearanceActionProcessingResult,
	type CharacterSettings,
	type CharacterSettingsKeys,
	type ChatMessage,
	type ChatMessageFilterMetadata,
	type ICharacterDataShard,
	type SpaceSwitchCharacterStatus,
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
import { clone, cloneDeep, isEqual, pick } from 'lodash-es';

/** Time (in ms) after which manager prunes character without any active connection */
export const CHARACTER_TIMEOUT = 30_000;

/** Time (in ms) as interval when character's periodic actions (like saving of modified data) happen */
export const CHARACTER_TICK_INTERVAL = 60_000;

const logger = GetLogger('Character');

/** Keys that are not stored in raw form while loaded, but instead need to be generated while saving */
type ManuallyGeneratedKeys = 'appearance' | 'personalRoom';
type ImmutableKeys = 'id' | 'accountId';

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

	public get loadedSpace(): Space | undefined {
		return this._context.state === 'space' ? this._context.space : undefined;
	}

	public setSpace(space: Space | null, appearance: AppearanceBundle): void {
		if (this.connection) {
			if (this._context.state === 'space') {
				this._context.space.leave(this.connection);
			}
			if (space) {
				space.join(this.connection);
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

	public get assetPreferences(): Immutable<AssetPreferencesPublic> {
		return this.gameLogicCharacter.assetPreferences.currentPreferences;
	}

	public readonly gameLogicCharacter: GameLogicCharacterServer;

	private logger: Logger;

	constructor(data: ICharacterDataShard, account: IShardAccountDefinition, connectSecret: string | null, spaceId: SpaceId | null) {
		this.logger = GetLogger('Character', `[Character ${data.id}]`);
		this.data = data;
		this.accountData = account;
		this.connectSecret = connectSecret;
		this.lastOnline = Date.now();

		this._personalSpace = new PersonalSpace(this, data.personalSpace?.spaceState ?? CloneDeepMutable(SPACE_STATE_BUNDLE_DEFAULT_PERSONAL_SPACE));

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
				this.setValue('interactionConfig', this.gameLogicCharacter.interactions.getData());
				this._emitSomethingChanged('permissions');
			} else if (type === 'assetPreferences') {
				this.setValue('assetPreferences', this.gameLogicCharacter.assetPreferences.getData());
				this._sendDataUpdate({
					assetPreferences: this.assetPreferences,
				});
				this._emitSomethingChanged('permissions');
			} else if (type === 'characterModifiers') {
				this.setValue('characterModifiers', this.gameLogicCharacter.characterModifiers.getData());
				this._emitSomethingChanged('permissions');
			} else {
				AssertNever(type);
			}
			this.loadedSpace?.checkSpaceSwitchStatusUpdates();
		});
		this.gameLogicCharacter.characterModifiers.on('modifiersChanged', () => {
			this._emitSomethingChanged('characterModifiers');
			this.loadedSpace?.onCharacterModifiersChanged();
		});

		const currentInteractionConfig = this.gameLogicCharacter.interactions.getData();
		if (!isEqual(originalInteractionConfig, currentInteractionConfig)) {
			this.logger.debug('Migrated interaction config');
			this.setValue('interactionConfig', currentInteractionConfig);
		}
		const currentAssetPreferencesConfig = this.gameLogicCharacter.assetPreferences.getData();
		if (!isEqual(originalAssetPreferencesConfig, currentAssetPreferencesConfig)) {
			this.logger.debug('Migrated asset preferences');
			this.setValue('assetPreferences', currentAssetPreferencesConfig);
		}
		const currentCharacterModifiersData = this.gameLogicCharacter.characterModifiers.getData();
		if (!isEqual(originalCharacterModifiersData, currentCharacterModifiersData)) {
			this.logger.debug('Migrated character modifiers');
			this.setValue('characterModifiers', currentCharacterModifiersData);
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
		const oldData = this.getRoomData();
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
			}
		}
		this.linkSpace(data.space);
		const roomDataUpdate = CalculateObjectKeysDelta(oldData, this.getRoomData());
		if (roomDataUpdate != null) {
			this._sendDataUpdate(roomDataUpdate);
		}
	}

	public isAuthorized(role: AccountRole): boolean {
		return IsAuthorized(this.accountData.roles ?? {}, role);
	}

	private linkSpace(id: SpaceId | null): void {
		Assert(this.isValid, 'Character state should not load while invalid');

		let space: Space | null = null;
		if (id != null) {
			space = SpaceManager.getSpace(id) ?? null;
		} else {
			space = this._personalSpace;
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
			this.logger.error(`Failed to link character to space ${id}; not found`);
			// Trigger fallback load into personal space
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
			// Clear connection-specific data
			this.loadedSpace?.updateStatus(this, 'none');
		}
		if (connection) {
			this.logger.debug(`Connected (${connection.id})`);
			connection.character = this;
			if (this._context.state === 'space') {
				this._context.space.join(connection);
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

		this.setValue('name', name);
		this._sendDataUpdate({ name });
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
		this.loadedSpace?.characterRemove(this);

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

	/**
	 * Resolves full character settings to their effective values.
	 * @returns The settings that apply to this character.
	 */
	public getEffectiveSettings(): Readonly<CharacterSettings> {
		return {
			...CHARACTER_SETTINGS_DEFAULT,
			...this.data.settings,
		};
	}

	public getRoomData(): ICharacterRoomData {
		return {
			id: this.id,
			accountId: this.accountId,
			accountDisplayName: this.accountData.displayName,
			name: this.name,
			profileDescription: this.profileDescription,
			publicSettings: cloneDeep(pick(this.data.settings, CHARACTER_PUBLIC_SETTINGS)),
			// Send offline only if the character is offline. If character is online send account status (replacing invisible by online)
			onlineStatus: this.isOnline ? (this.accountData.onlineStatus !== 'offline' ? this.accountData.onlineStatus : 'online') : 'offline',
			assetPreferences: this.assetPreferences,
		};
	}

	public getPrivateData(): ICharacterPrivateData & ICharacterRoomData {
		return {
			...this.getRoomData(),
			settings: cloneDeep(this.data.settings),
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
			Assert(this.isValid, 'Character state should not load while invalid');
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
		return this.loadedSpace?.id ?? null;
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

	public checkSpaceSwitchStatus(initiator: Character): Pick<SpaceSwitchCharacterStatus, 'permission' | 'restriction'> {
		const result: ReturnType<typeof this.checkSpaceSwitchStatus> = {
			permission: null,
			restriction: null,
		};

		const restrictionManager = this.getRestrictionManager();

		// Check if initiator has appropriate permission for space switch
		if (this.id === initiator.id) {
			result.permission = 'accept-enforce';
		} else {
			const check = initiator.checkAction((ctx) => {
				const player = ctx.getPlayerRestrictionManager();
				const checkTarget = ctx.getCharacter(this.id);
				if (checkTarget == null)
					return ctx.invalid();

				player.checkInteractWithTarget(ctx, checkTarget.appearance);
				ctx.addInteraction(checkTarget.character, 'interact');

				return ctx.finalize();
			});

			if (check.valid) {
				let autoApprove = false;
				let enforce = false;

				for (const e of restrictionManager.getModifierEffectsByType('misc_space_switch_auto_approve')) {
					if (e.config.characters.length === 0 || e.config.characters.includes(initiator.id)) {
						autoApprove = true;
						enforce ||= e.config.enforce;
					}
				}

				result.permission = enforce ? 'accept-enforce' : autoApprove ? 'accept' : 'prompt';
			} else {
				result.permission = 'rejected';
			}
		}

		// Check restrictions
		const inPublicSpace = this.getCurrentPublicSpaceId() != null;

		if (restrictionManager.getRoomDeviceLink() != null) {
			result.restriction = 'inRoomDevice';
		} else if (restrictionManager.forceAllowRoomLeave()) {
			// Skips any checks if force-allow is enabled
			result.restriction = 'ok';
		} else if (restrictionManager.getEffects().blockSpaceLeave && inPublicSpace) {
			// The character must not have leave-restricting effect (this doesn't affect personal spaces)
			result.restriction = 'restricted';
		} else {
			result.restriction = 'ok';
		}

		return result;
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
			} else if (key === 'personalSpace') {
				const spaceState = this._personalSpace.currentState.space;
				data.personalSpace = {
					spaceState: spaceState.exportToBundle(),
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

	private setValue<Key extends keyof Omit<ICharacterDataShardUpdate, ManuallyGeneratedKeys>>(key: Key, value: ICharacterDataShard[Key]): void {
		if (this.data[key] === value)
			return;

		this.data[key] = value;
		this.modified.add(key);
	}

	private _sendDataUpdate(updatedData: Partial<ICharacterRoomData>): void {
		if (this.loadedSpace != null) {
			this.loadedSpace.sendUpdateToAllCharacters({
				characters: {
					[this.id]: updatedData,
				},
			});
		} else {
			this.connection?.sendMessage('updateCharacter', updatedData);
		}
	}

	private _sendPrivateDataUpdate(updatedData: Partial<Omit<ICharacterPrivateData, keyof ICharacterRoomData | ManuallyGeneratedKeys | ImmutableKeys>>): void {
		this.connection?.sendMessage('updateCharacter', updatedData);
	}

	private _emitSomethingChanged(...changes: IShardClientChangeEvents[]): void {
		if (this.loadedSpace != null) {
			this.loadedSpace.sendMessage('somethingChanged', {
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
		this.modified.add('personalSpace');
	}

	private _onPublicSettingsChanged(): void {
		this._sendDataUpdate({
			publicSettings: this.getRoomData().publicSettings,
		});
	}

	public changeSettings(settings: Partial<CharacterSettings>): void {
		this.setValue('settings', {
			...this.data.settings,
			...settings,
		});
		this._sendPrivateDataUpdate({ settings: this.data.settings });

		if (CHARACTER_PUBLIC_SETTINGS.some((setting) => Object.hasOwn(settings, setting))) {
			this._onPublicSettingsChanged();
		}
	}

	public resetSettings(settings: readonly CharacterSettingsKeys[]): void {
		const newSettings = clone(this.data.settings);
		for (const setting of settings) {
			delete newSettings[setting];
		}

		this.setValue('settings', newSettings);
		this._sendPrivateDataUpdate({ settings: this.data.settings });

		if (CHARACTER_PUBLIC_SETTINGS.some((setting) => settings.includes(setting))) {
			this._onPublicSettingsChanged();
		}
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
		this.setValue('profileDescription', newDescription);
		this._sendDataUpdate({ profileDescription: this.data.profileDescription });
	}

	private tick(): void {
		this.save().catch((err) => {
			this.logger.error('Periodic save failed:', err);
		});
	}

	//#region Chat messages

	private readonly messageQueue: ChatMessage[] = [];

	public queueMessages(messages: ChatMessage[]): void {
		if (messages.length === 0)
			return;
		// Do not store messages for offline characters
		if (!this.isOnline)
			return;

		let transformed: ChatMessage[];

		const hearingFilter = this.getRestrictionManager().getHearingFilter();
		if (hearingFilter.isActive()) {
			transformed = messages.map((message) => {
				if (message.type === 'chat') {
					const metadata: ChatMessageFilterMetadata = {
						from: message.from.id,
						to: message.to?.map((t) => t.id) ?? null,
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
