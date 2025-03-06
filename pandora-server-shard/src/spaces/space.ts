import { diffString } from 'json-diff';
import _, { isEqual, omit } from 'lodash';
import {
	AccountId,
	ActionHandlerMessage,
	ActionSpaceContext,
	AppearanceBundle,
	Assert,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkGlobalStateContainer,
	AssetFrameworkRoomState,
	AssetManager,
	CharacterId,
	CharacterRoomPosition,
	ChatCharacterStatus,
	CloneDeepMutable,
	EMPTY_ARRAY,
	GameStateUpdate,
	GenerateInitialRoomPosition,
	IChatMessage,
	IChatMessageActionTargetCharacter,
	IChatMessageDirectoryAction,
	IChatSegment,
	IClientMessage,
	IShardClient,
	IsValidRoomPosition,
	Logger,
	ResolveBackground,
	RoomInventory,
	RoomInventoryBundle,
	ServerRoom,
	SpaceClientInfo,
	SpaceDirectoryConfig,
	SpaceId,
	SpaceLoadData,
	type AppearanceActionProcessingResultValid,
	type ChatMessageFilterMetadata,
	type CurrentSpaceInfo,
	type IChatMessageAction,
	type IClientShardNormalResult,
	type SpaceCharacterModifierEffectData,
} from 'pandora-common';
import { assetManager } from '../assets/assetManager';
import type { Character } from '../character/character';

const MESSAGE_EDIT_TIMEOUT = 1000 * 60 * 20; // 20 minutes
const ACTION_CACHE_TIMEOUT = 60_000; // 10 minutes

/** Time (in ms) as interval for space's periodic actions (like saving of modified data or message cleanup) happen */
export const SPACE_TICK_INTERVAL = 60_000;

export abstract class Space extends ServerRoom<IShardClient> {

	protected readonly characters: Set<Character> = new Set();
	protected readonly history = new Map<CharacterId, Map<number, number>>();
	protected readonly status = new Map<CharacterId, { status: ChatCharacterStatus; target?: CharacterId; }>();
	protected readonly actionCache = new Map<CharacterId, { result: IChatMessageActionTargetCharacter; leave?: number; }>();
	protected readonly tickInterval: NodeJS.Timeout;

	private readonly _gameState: AssetFrameworkGlobalStateContainer;

	public get currentState(): AssetFrameworkGlobalState {
		return this._gameState.currentState;
	}

	public abstract get id(): SpaceId | null;
	public abstract get owners(): readonly AccountId[];
	public abstract get config(): SpaceDirectoryConfig;

	protected readonly logger: Logger;

	constructor(inventory: RoomInventoryBundle, logger: Logger) {
		super();
		this.logger = logger;
		this.logger.verbose('Loaded');

		if (inventory.clientOnly) {
			this.logger.error('Room inventory is client-only');
		}

		const initialState = AssetFrameworkGlobalState.createDefault(
			assetManager,
			AssetFrameworkRoomState
				.loadFromBundle(assetManager, inventory, this.logger.prefixMessages('Room inventory load:')),
		);

		// Check if room state changed and if it did queue saving the changes
		{
			// HACK: The JSON wrapping is because exported bundle might have undefined fields, which lodash doesn't handle well
			const inventoryBefore: unknown = JSON.parse(JSON.stringify(inventory));
			const inventoryAfter: unknown = JSON.parse(JSON.stringify(initialState.room.exportToBundle()));
			if (!isEqual(inventoryBefore, inventoryAfter)) {
				this.logger.verbose('Room inventory changed during load, queuing update of migrated data\n', diffString(inventoryBefore, inventoryAfter, { color: false }));
				queueMicrotask(() => {
					this._onDataModified('inventory');
				});
			}
		}

		this._gameState = new AssetFrameworkGlobalStateContainer(
			this.logger,
			this._onStateChanged.bind(this),
			initialState,
		);

		this.tickInterval = setInterval(() => this._tick(), SPACE_TICK_INTERVAL);
	}

	public reloadAssetManager(manager: AssetManager) {
		this._gameState.reloadAssetManager(manager);

		// Background definition might have changed, make sure all characters are still inside range
		const update: GameStateUpdate = {};

		// Put characters into correct place if needed
		// Development rooms don't have position enforcement to allow fine-tuning positioning arguments
		if (!this.getInfo().features.includes('development')) {
			const roomBackground = ResolveBackground(assetManager, this.config.background);
			for (const character of this.characters) {
				if (!IsValidRoomPosition(roomBackground, character.position)) {
					character.position = GenerateInitialRoomPosition(roomBackground);

					update.characters ??= {};
					update.characters[character.id] = {
						position: character.position,
					};
				}
			}
		}

		if (update.characters) {
			this.sendUpdateToAllCharacters(update);
		}
	}

	public applyAction(result: AppearanceActionProcessingResultValid): void {
		Assert(this._gameState.currentState === result.originalState, 'Attempt to apply action originating from a different state than the current one');

		// Apply the action
		this._gameState.setState(result.resultState);

		// Send chat messages as needed
		for (const message of result.pendingMessages) {
			this.handleActionMessage(message);
		}
	}

	public onRemove(): void {
		clearInterval(this.tickInterval);
		this.logger.verbose('Unloaded');
	}

	protected _tick(): void {
		// Cleanup of old messages
		const now = Date.now();
		for (const [characterId, history] of this.history) {
			for (const [id, time] of history) {
				if (time + MESSAGE_EDIT_TIMEOUT < now) {
					history.delete(id);
				}
			}
			if (history.size === 0) {
				this.history.delete(characterId);
			}
		}
	}

	private _suppressUpdates: boolean = false;
	/** Immediately invokes passed function, but suppresses sending any automated updates */
	private runWithSuppressedUpdates(fn: () => void): void {
		try {
			this._suppressUpdates = true;
			fn();
		} finally {
			this._suppressUpdates = false;
		}
	}

	private _onStateChanged(newState: AssetFrameworkGlobalState, oldState: AssetFrameworkGlobalState): void {
		const changes = newState.listChanges(oldState);

		if (changes.room) {
			this._onDataModified('inventory');
		}

		for (const character of changes.characters) {
			this.getCharacterById(character)?.onAppearanceChanged();
		}

		if (this._suppressUpdates)
			return;

		this.sendUpdateToAllCharacters({
			globalState: newState.exportToClientBundle(),
			characterModifierEffects: this.getCharacterModifierEffects(),
		});
	}

	public onCharacterModifiersChanged(): void {
		this.sendUpdateToAllCharacters({
			characterModifierEffects: this.getCharacterModifierEffects(),
		});
	}

	protected abstract _onDataModified(data: 'inventory'): void;

	public getInfo(): SpaceClientInfo {
		return {
			...this.config,
			owners: this.owners.slice(),
		};
	}

	public getLoadData(): SpaceLoadData {
		return {
			id: this.id,
			info: this.getInfo(),
			characters: Array.from(this.characters).map((c) => c.getRoomData()),
			characterModifierEffects: this.getCharacterModifierEffects(),
		};
	}

	public getCharacterModifierEffects(): SpaceCharacterModifierEffectData {
		const result: SpaceCharacterModifierEffectData = {};

		const gameState = this.currentState;
		const spaceInfo: CurrentSpaceInfo = {
			id: this.id,
			config: this.getInfo(),
		};
		for (const character of this.characters) {
			result[character.id] = character.gameLogicCharacter.characterModifiers.getActiveEffects(gameState, spaceInfo);
		}

		return result;
	}

	public getActionSpaceContext(): ActionSpaceContext {
		return {
			features: this.config.features,
			isAdmin: (account) => Array.from(this.characters).some((character) => character.accountId === account && this.isAdmin(character)),
			development: this.config.development,
			getCharacterModifierEffects: (characterId, gameState) => {
				const character = Array.from(this.characters).find((c) => c.id === characterId);
				const spaceInfo: CurrentSpaceInfo = {
					id: this.id,
					config: this.getInfo(),
				};
				return character == null ? EMPTY_ARRAY :
					character.gameLogicCharacter.characterModifiers.getActiveEffects(gameState, spaceInfo);
			},
		};
	}

	public isOwner(character: Character): boolean {
		return this.owners.includes(character.accountId);
	}

	public isAdmin(character: Character): boolean {
		if (this.isOwner(character))
			return true;

		if (this.config.admin.includes(character.accountId))
			return true;

		if (this.config.development?.autoAdmin && character.isAuthorized('developer'))
			return true;

		return false;
	}

	/** Checks if the specified character is on the allowlist */
	public isAllowed(character: Character): boolean {
		if (this.isAdmin(character))
			return true;

		if (this.config.allow.includes(character.accountId))
			return true;

		return false;
	}

	public updateCharacterPosition(source: Character, id: CharacterId, newPosition: CharacterRoomPosition): void {
		// Development rooms don't have position enforcement to allow fine-tuning positioning arguments
		if (!this.getInfo().features.includes('development')) {
			const roomBackground = ResolveBackground(assetManager, this.config.background);

			if (!IsValidRoomPosition(roomBackground, newPosition)) {
				return;
			}
		}

		const character = this.getCharacterById(id);
		if (!character) {
			return;
		}
		// If moving self, must not be restricted by items
		if (character.id === source.id) {
			const restrictionManager = character.getRestrictionManager();
			if (restrictionManager.getEffects().blockRoomMovement)
				return;
		}
		// Only admin can move other characters
		if (character.id !== source.id && !this.isAdmin(source)) {
			return;
		}
		character.position = CloneDeepMutable(newPosition);
		this.sendUpdateToAllCharacters({
			characters: {
				[character.id]: {
					position: character.position,
				},
			},
		});
	}

	public getAllCharacters(): Character[] {
		return [...this.characters.values()];
	}

	public getCharacterById(id: CharacterId): Character | null {
		return Array.from(this.characters.values()).find((c) => c.id === id) ?? null;
	}

	public getRoomInventory(): RoomInventory {
		const state = this.currentState.room;
		AssertNotNullable(state);
		return new RoomInventory(state);
	}

	public characterAdd(character: Character, appearance: AppearanceBundle): void {
		// Position character to the side of the room ±20% of character width randomly (to avoid full overlap with another characters)
		const roomBackground = ResolveBackground(assetManager, this.config.background);
		character.initRoomPosition(this.id, roomBackground);
		const logger = this.logger.prefixMessages(`Character ${character.id} join:`);

		this.runWithSuppressedUpdates(() => {
			let newState = this._gameState.currentState;

			// Add the character to the room
			this.characters.add(character);
			const characterState = AssetFrameworkCharacterState
				.loadFromBundle(
					assetManager,
					character.id,
					appearance,
					newState.room,
					logger,
				);
			newState = newState.withCharacter(character.id, characterState);
			const newAppearanceBundle = characterState.exportToBundle();
			{
				// HACK: The JSON wrapping is because exported bundle might have undefined fields, which lodash doesn't handle well
				const appearanceBefore: unknown = JSON.parse(JSON.stringify(appearance));
				const appearanceAfter: unknown = JSON.parse(JSON.stringify(newAppearanceBundle));
				if (!isEqual(appearanceBefore, appearanceAfter)) {
					if (!character.isInCreation) { // It is normal for appearance to change sporadically for character in creation - it is just being initialized
						logger.verbose('Character appearance changed during load, queuing update of migrated data\n', diffString(appearanceBefore, appearanceAfter, { color: false }));
					}
					queueMicrotask(() => {
						character.onAppearanceChanged();
					});
				}
			}

			this._gameState.setState(newState);

			// Send update to current characters
			const globalState = this._gameState.currentState.exportToClientBundle();
			this.sendUpdateToAllCharacters({
				globalState,
				characterModifierEffects: this.getCharacterModifierEffects(),
				join: character.getRoomData(),
			});
			// Send update to joining character
			character.setSpace(this, newAppearanceBundle);
			character.connection?.sendMessage('gameStateLoad', {
				globalState,
				space: this.getLoadData(),
			});
		});

		this.logger.debug(`Character ${character.id} added`);
		// Make sure action info is in cache
		this._getCharacterActionInfo(character.id);
	}

	/**
	 * Removes a character from the space
	 * @param character - The character being removed
	 */
	public characterRemove(character: Character): void {
		this.runWithSuppressedUpdates(() => {
			// Remove character
			let newState = this._gameState.currentState;
			const characterAppearance = newState.characters.get(character.id)?.exportToBundle();
			AssertNotNullable(characterAppearance);

			this.characters.delete(character);
			newState = newState.withCharacter(character.id, null);

			// Update the target character
			character.setSpace(null, characterAppearance);

			// Update anyone remaining in the space
			this._gameState.setState(newState);
			this.sendUpdateToAllCharacters({
				globalState: this._gameState.currentState.exportToClientBundle(),
				characterModifierEffects: this.getCharacterModifierEffects(),
				leave: character.id,
			});

			// Cleanup character data
			this.history.delete(character.id);
			this.status.delete(character.id);
			this._cleanActionCache(character.id);
		});
		this.logger.debug(`Character ${character.id} removed`);
	}

	public sendUpdateToAllCharacters(data: GameStateUpdate): void {
		this.sendMessage('gameStateUpdate', data);
	}

	private lastMessageTime: number = 0;
	private lastDirectoryMessageTime: number = 0;

	private nextMessageTime(): number {
		let time = Date.now();
		// Make sure the time is unique
		if (time <= this.lastMessageTime) {
			time = this.lastMessageTime + 1;
		}
		return this.lastMessageTime = time;
	}

	public updateStatus(character: Character, status: ChatCharacterStatus, target?: CharacterId): void {
		const last = this.status.get(character.id) ?? { status: 'none', target: undefined };
		this.status.set(character.id, { status, target });

		if (target !== last.target && last.status !== 'none') {
			const lastTarget = last.target ? this.getCharacterById(last.target)?.connection : this;
			lastTarget?.sendMessage('chatCharacterStatus', { id: character.id, status: 'none' });
			if (status === 'none')
				return;
		}

		const sendTo = target ? this.getCharacterById(target)?.connection : this;
		sendTo?.sendMessage('chatCharacterStatus', { id: character.id, status });
	}

	public handleMessages(from: Character, messages: IClientMessage[], id: number, editId?: number): IClientShardNormalResult['chatMessage'] {
		const player = from.getRestrictionManager();
		// Handle speech blocking
		for (const message of messages) {
			const blockCheck = player.checkChatMessage(message);
			if (blockCheck.result !== 'ok') {
				return {
					result: 'blocked',
					reason: 'At least one part of the message was blocked with reason:\n' + blockCheck.reason,
				};
			}
		}

		// Handle speech muffling
		const speechFilter = player.getSpeechFilter();
		if (speechFilter.isActive()) {
			for (const message of messages) {
				const metadata: ChatMessageFilterMetadata = {
					from: from.id,
					to: IsTargeted(message) ? message.to : null,
				};
				if (message.type === 'chat') {
					message.parts = speechFilter.processMessage(message.parts, metadata);
				}
			}
		}

		const queue: IChatMessage[] = [];
		const now = Date.now();
		let history = this.history.get(from.id);
		if (!history) {
			this.history.set(from.id, history = new Map<number, number>());
			if (editId) {
				// invalid message, nothing to edit
				return {
					result: 'blocked',
					reason: 'Edited message not found',
				};
			}
		} else {
			if (history.has(id)) {
				// invalid message, already exists
				return {
					result: 'blocked',
					reason: 'Duplicate message',
				};
			}
			if (editId) {
				const insert = history.get(editId);
				if (!insert) {
					// invalid message, nothing to edit
					return {
						result: 'blocked',
						reason: 'Edited message not found',
					};
				}
				history.delete(editId);
				if (insert + MESSAGE_EDIT_TIMEOUT < now) {
					// invalid message, too old
					return {
						result: 'blocked',
						reason: 'Edited message is too old to be edited',
					};
				}
				queue.push({
					type: 'deleted',
					id: editId,
					from: from.id,
					time: this.nextMessageTime(),
				});
			}
		}
		history.set(id, now);
		for (const message of messages) {
			if (!IsTargeted(message)) {
				queue.push({
					type: message.type,
					id,
					insertId: editId,
					from: { id: from.id, name: from.name, labelColor: from.settings.labelColor },
					parts: message.parts,
					time: this.nextMessageTime(),
				});
			} else {
				const target = this.getCharacterById(message.to);
				if (!target) {
					continue; // invalid message, target not found
				}
				queue.push({
					type: message.type,
					id,
					insertId: editId,
					from: { id: from.id, name: from.name, labelColor: from.settings.labelColor },
					to: { id: target.id, name: target.name, labelColor: target.settings.labelColor },
					parts: message.parts,
					time: this.nextMessageTime(),
				});
			}
		}
		this._queueMessages(queue);

		return { result: 'ok' };
	}

	public handleActionMessage(actionMessage: ActionHandlerMessage): void {
		this._queueMessages([this.mapActionMessageToChatMessage(actionMessage)]);
	}

	public mapActionMessageToChatMessage({
		id,
		customText,
		character,
		target,
		sendTo,
		dictionary,
		...data
	}: ActionHandlerMessage): IChatMessage {
		// No reason to duplicate target if it matches character
		if (isEqual(target, character)) {
			target = undefined;
		}
		return {
			type: 'action',
			id,
			customText,
			sendTo,
			time: this.nextMessageTime(),
			data: {
				character: this._getCharacterActionInfo(character?.id),
				target: target?.type === 'character' ? this._getCharacterActionInfo(target.id) :
					target,
				...data,
			},
			dictionary,
		};
	}

	private _queueMessages(messages: IChatMessage[]): void {
		for (const character of this.characters) {
			character.queueMessages(messages.filter((msg) => {
				switch (msg.type) {
					case 'chat':
					case 'ooc':
						return msg.to === undefined || character.id === msg.from.id || character.id === msg.to.id;
					case 'deleted':
						return true;
					case 'emote':
						return true;
					case 'me':
						return true;
					case 'action':
						return msg.sendTo === undefined || msg.sendTo.includes(character.id);
					case 'serverMessage':
						return true;
					default:
						AssertNever(msg);
				}
			}));
		}
	}

	public processDirectoryMessages(messages: IChatMessageDirectoryAction[]): void {
		this._queueMessages(messages
			.filter((m) => m.directoryTime > this.lastDirectoryMessageTime)
			.map((m) => ({
				...omit(m, ['directoryTime']),
				time: this.nextMessageTime(),
				data: m.data ? {
					character: this._getCharacterActionInfo(m.data.character),
					target: this._getCharacterActionInfo(m.data.targetCharacter),
				} satisfies IChatMessageAction['data'] : undefined,
			})));
		this.lastDirectoryMessageTime = _(messages)
			.map((m) => m.directoryTime)
			.concat(this.lastDirectoryMessageTime)
			.max() ?? this.lastDirectoryMessageTime;
	}

	private _getCharacterActionInfo(id?: CharacterId | null): IChatMessageActionTargetCharacter | undefined {
		if (!id)
			return undefined;

		const char = this.getCharacterById(id);
		if (!char)
			return this.actionCache.get(id)?.result ?? {
				type: 'character',
				id,
				name: '[UNKNOWN]',
				pronoun: 'they',
				labelColor: '#ffffff',
			};

		const result: IChatMessageActionTargetCharacter = {
			type: 'character',
			id: char.id,
			name: char.name,
			pronoun: char.settings.pronoun,
			labelColor: char.settings.labelColor,
		};
		this.actionCache.set(id, { result });

		return result;
	}

	private _cleanActionCache(id: CharacterId): void {
		const cached = this.actionCache.get(id);
		if (cached)
			cached.leave = Date.now();

		for (const [key, value] of this.actionCache) {
			if (value.leave && value.leave + ACTION_CACHE_TIMEOUT < Date.now())
				this.actionCache.delete(key);
		}
	}
}

function IsTargeted(message: IClientMessage): message is { type: 'chat' | 'ooc'; parts: IChatSegment[]; to: CharacterId; } {
	return (message.type === 'chat' || message.type === 'ooc') && message.to !== undefined;
}
