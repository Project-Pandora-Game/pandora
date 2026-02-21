import { freeze, type Immutable } from 'immer';
import { diffString } from 'json-diff';
import { chain, cloneDeep, isEqual, omit } from 'lodash-es';
import {
	AccountId,
	ActionHandlerMessage,
	ActionLogShouldDeduplicate,
	ActionSpaceContext,
	AppearanceBundle,
	Assert,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkGlobalStateContainer,
	AssetFrameworkSpaceState,
	AssetManager,
	CardGameGame,
	CharacterId,
	ChatActionHidden,
	ChatCharacterStatus,
	CloneDeepMutable,
	CreateActionLogFromGameLogicAction,
	EMPTY_ARRAY,
	GameStateUpdate,
	IChatMessageActionTargetCharacter,
	IChatSegment,
	IClientMessage,
	IShardClient,
	IsNotNullable,
	Logger,
	ServerRoom,
	SpaceCharacterModifierEffectCalculateUpdate,
	SpaceClientInfo,
	SpaceDirectoryConfig,
	SpaceId,
	SpaceLoadData,
	type AppearanceActionProcessingResultValid,
	type ChatMessage,
	type ChatMessageAction,
	type ChatMessageActionLogEntry,
	type ChatMessageChatCharacter,
	type ChatMessageDirectoryAction,
	type ChatMessageFilterMetadata,
	type CurrentSpaceInfo,
	type IClientShardNormalResult,
	type RoomId,
	type SpaceCharacterModifierEffectData,
	type SpaceCharacterModifierEffectDataUpdate,
	type SpaceStateBundle,
	type SpaceSwitchStatus,
} from 'pandora-common';
import { assetManager } from '../assets/assetManager.ts';
import type { Character } from '../character/character.ts';

const MESSAGE_EDIT_TIMEOUT = 1000 * 60 * 20; // 20 minutes
const ACTION_CACHE_TIMEOUT = 60_000; // 10 minutes

/** Time (in ms) as interval for space's periodic actions (like saving of modified data or message cleanup) happen */
export const SPACE_TICK_INTERVAL = 60_000;

/** metadata about a chat message that was sent by a user. */
type MessageHistoryMetadata = {
	time: number;
	room: RoomId;
};

export abstract class Space extends ServerRoom<IShardClient> {
	public readonly id: SpaceId | null;

	protected readonly characters: Set<Character> = new Set();
	protected readonly history = new Map<CharacterId, Map<number, MessageHistoryMetadata>>();
	protected readonly status = new Map<CharacterId, { status: ChatCharacterStatus; targets?: readonly CharacterId[]; }>();
	protected readonly actionCache = new Map<CharacterId, {
		descriptor: IChatMessageActionTargetCharacter;
		lastAction: [entry: Immutable<ChatMessageActionLogEntry>, time: number] | null;
		leave?: number;
	}>();
	protected readonly tickInterval: NodeJS.Timeout;

	private readonly _gameState: AssetFrameworkGlobalStateContainer;

	public get currentState(): AssetFrameworkGlobalState {
		return this._gameState.currentState;
	}

	/** Data for what character modifier effects were sent to the room last, used for creating delta updates when effects change */
	private _lastSentModifierEffects: SpaceCharacterModifierEffectData = {};

	public abstract get owners(): readonly AccountId[];
	public abstract get ownerInvites(): readonly AccountId[];
	public abstract get spaceSwitchStatus(): Immutable<SpaceSwitchStatus[]>;
	public abstract get config(): SpaceDirectoryConfig;

	protected readonly logger: Logger;

	public cardGame: CardGameGame | null = null;

	constructor(id: SpaceId | null, spaceState: SpaceStateBundle, logger: Logger) {
		super();
		this.id = id;
		this.logger = logger;
		this.logger.verbose('Loaded');

		if (spaceState.clientOnly) {
			this.logger.error('Space state is client-only');
		}

		const initialState = AssetFrameworkGlobalState.createDefault(
			assetManager,
			AssetFrameworkSpaceState
				.loadFromBundle(assetManager, spaceState, id, this.logger.prefixMessages('Room inventory load:')),
		).runAutomaticActions();

		// Check if room state changed and if it did queue saving the changes
		{
			// HACK: The JSON wrapping is because exported bundle might have undefined fields, which lodash doesn't handle well
			const spaceStateBefore: unknown = JSON.parse(JSON.stringify(spaceState));
			const spaceStateAfter: unknown = JSON.parse(JSON.stringify(initialState.space.exportToBundle()));
			if (!isEqual(spaceStateBefore, spaceStateAfter)) {
				this.logger.verbose('Room inventory changed during load, queuing update of migrated data\n', diffString(spaceStateBefore, spaceStateAfter, { color: false }));
				queueMicrotask(() => {
					this._onDataModified('spaceState');
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
		// Suppress update during asset manager reload, as creating a delta update with different managers is illegal
		// This way clients will get new data as they receive new asset manager data later
		this.runWithSuppressedUpdates(() => {
			this._gameState.reloadAssetManager(manager);
		});

		this.checkSpaceSwitchStatusUpdates();

		// Background definition might have changed, make sure all characters are still inside range
		const update: GameStateUpdate = {};

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
			// Hide a message if both original and result state request hiding it
			if (ChatActionHidden(message, result.resultState) && ChatActionHidden(message, result.originalState))
				continue;

			this.handleActionMessage(message);
		}

		// Send action log entries
		const actor = this._getCharacterActionInfo(result.actor.id);
		const actorActionCacheEntry = this.actionCache.get(result.actor.id);
		const now = Date.now();
		for (const performedAction of result.performedActions) {
			const entry = CreateActionLogFromGameLogicAction(performedAction, actor);

			// Allow skipping action if last one was too similar
			if (actorActionCacheEntry?.lastAction != null &&
				ActionLogShouldDeduplicate(entry, now, actorActionCacheEntry.lastAction[0], actorActionCacheEntry.lastAction[1])
			) {
				continue;
			}

			if (actorActionCacheEntry != null) {
				actorActionCacheEntry.lastAction = [entry, now];
			}
			this._queueMessages([
				{
					type: 'actionLog',
					time: this.nextMessageTime(),
					entry: CloneDeepMutable(entry),
				},
			]);
		}
	}

	public runAutomaticActions(): void {
		const resultState = this._gameState.currentState.runAutomaticActions();
		if (resultState === this._gameState.currentState)
			return;

		const validationResult = resultState.validate();

		if (!validationResult.success) {
			this.logger.warning('Running automatic actions resulted in invalid state:', validationResult.error);
			return;
		}

		this._gameState.setState(resultState);
	}

	public onRemove(): void {
		clearInterval(this.tickInterval);
		this.logger.verbose('Unloaded');
	}

	protected _tick(): void {
		// Cleanup of old messages
		const now = Date.now();
		for (const [characterId, history] of this.history) {
			for (const [id, { time }] of history) {
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

		if (changes.space) {
			this._onDataModified('spaceState');
		}

		for (const character of changes.characters) {
			this.getCharacterById(character)?.onAppearanceChanged();
		}

		if (this._suppressUpdates)
			return;

		this.checkSpaceSwitchStatusUpdates();
		this.sendUpdateToAllCharacters({
			globalState: newState.exportToClientDeltaBundle(oldState),
			characterModifierEffects: this.getAndApplyCharacterModifierEffectsUpdate(),
		});
	}

	public onCharacterModifiersChanged(): void {
		this.checkSpaceSwitchStatusUpdates();
		this.sendUpdateToAllCharacters({
			characterModifierEffects: this.getAndApplyCharacterModifierEffectsUpdate(),
		});
	}

	protected abstract _onDataModified(data: 'spaceState'): void;

	public getInfo(): SpaceClientInfo {
		return {
			...this.config,
			owners: this.owners.slice(),
			ownerInvites: this.ownerInvites.slice(),
			spaceSwitchStatus: CloneDeepMutable(this.spaceSwitchStatus),
		};
	}

	public getLoadData(forCharacter: CharacterId): SpaceLoadData {
		const chatStatus: Record<CharacterId, ChatCharacterStatus> = {};
		for (const [c, status] of this.status) {
			if (this.getCharacterById(c) == null || status.status === 'none' || (status.targets != null && !status.targets.includes(forCharacter)))
				continue;

			chatStatus[c] = status.status;
		}

		return {
			id: this.id,
			info: this.getInfo(),
			characters: Array.from(this.characters).map((c) => c.getRoomData()),
			characterModifierEffects: this.getCharacterModifierEffects(),
			chatStatus,
		};
	}

	/** Calculates current modifier effects for all characters in the space */
	protected getCharacterModifierEffects(): SpaceCharacterModifierEffectData {
		const result: SpaceCharacterModifierEffectData = {};

		const gameState = this.currentState;
		const spaceInfo: CurrentSpaceInfo = {
			id: this.id,
			config: this.getInfo(),
		};
		for (const character of this.characters) {
			result[character.id] = freeze(cloneDeep(character.gameLogicCharacter.characterModifiers.getActiveEffects(gameState, spaceInfo)), true);
		}

		return result;
	}

	/** Calculates an update for character modifier effects from the last time this function was called. The update is idempotent. */
	protected getAndApplyCharacterModifierEffectsUpdate(): SpaceCharacterModifierEffectDataUpdate | undefined {
		const newEffects = this.getCharacterModifierEffects();
		const update = SpaceCharacterModifierEffectCalculateUpdate(this._lastSentModifierEffects, newEffects);
		this._lastSentModifierEffects = newEffects;
		return update;
	}

	/**
	 * Run checks for when space switch status might need updates, after space's state changes.
	 * If update is needed, send update request to Directory.
	 */
	public abstract checkSpaceSwitchStatusUpdates(): void;

	public getActionSpaceContext(): ActionSpaceContext {
		return {
			features: this.config.features,
			getAccountSpaceRole: (account) => {
				const characters = Array.from(this.characters).filter((c) => c.accountId === account);

				if (characters.some((c) => this.isOwner(c)))
					return 'owner';
				if (characters.some((c) => this.isAdmin(c)))
					return 'admin';
				if (characters.some((c) => this.isAllowed(c)))
					return 'allowlisted';

				return 'everyone';
			},
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

	/** Checks if the specified character is on the "allowed users" list */
	public isAllowed(character: Character): boolean {
		if (this.isAdmin(character))
			return true;

		if (this.config.allow.includes(character.accountId))
			return true;

		return false;
	}

	public getAllCharacters(): Character[] {
		return [...this.characters.values()];
	}

	public getCharacterById(id: CharacterId): Character | null {
		return Array.from(this.characters.values()).find((c) => c.id === id) ?? null;
	}

	public characterAdd(character: Character, appearance: AppearanceBundle): void {
		const logger = this.logger.prefixMessages(`Character ${character.id} join:`);

		this.runWithSuppressedUpdates(() => {
			const originalState = this._gameState.currentState;
			let newState = originalState;

			// Add the character to the space
			this.characters.add(character);
			const characterState = AssetFrameworkCharacterState
				.loadFromBundle(
					assetManager,
					character.id,
					appearance,
					newState.space,
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
			this.sendUpdateToAllCharacters({
				globalState: newState.exportToClientDeltaBundle(originalState),
				characterModifierEffects: this.getAndApplyCharacterModifierEffectsUpdate(),
				join: character.getRoomData(),
			});
			// Send update to joining character
			character.setSpace(this, newAppearanceBundle);
			character.connection?.sendMessage('gameStateLoad', {
				globalState: newState.exportToClientBundle(),
				space: this.getLoadData(character.id),
			});
			this.checkSpaceSwitchStatusUpdates();
		});

		this.logger.debug(`Character ${character.id} added`);
		// Make sure action info is in cache
		this._getCharacterActionInfo(character.id);
	}

	/**
	 * Removes a character from the space and stops any ongoing game, if it
	 * was initiated by the leaving player
	 * @param character - The character being removed
	 */
	public characterRemove(character: Character): void {
		this.runWithSuppressedUpdates(() => {
			if (this.cardGame) {
				// Stop a game, if character is dealer of a current game
				if (this.cardGame.isDealer(character.id)) {
					//Send an information to all but the leaving character
					const targets = this.cardGame.getPlayerIds().filter((id) => id !== character.id);

					this.handleActionMessage({
						id: 'gamblingCardGameStopped',
						rooms: null,
						character: {
							type: 'character',
							id: character.id,
						},
						sendTo: targets,
					});
					this.cardGame = null;
				} else {
					this.cardGame.leaveGame(character.id);
				}
			}
			// Remove character
			const originalState = this._gameState.currentState;
			let newState = originalState;
			const characterAppearance = newState.characters.get(character.id)?.exportToBundle();
			AssertNotNullable(characterAppearance);

			this.characters.delete(character);
			newState = newState.withCharacter(character.id, null);

			// Update the target character
			character.setSpace(null, characterAppearance);

			// Update anyone remaining in the space
			this._gameState.setState(newState);
			this.checkSpaceSwitchStatusUpdates();
			this.sendUpdateToAllCharacters({
				globalState: newState.exportToClientDeltaBundle(originalState),
				characterModifierEffects: this.getAndApplyCharacterModifierEffectsUpdate(),
				leave: character.id,
			});

			// Cleanup character data
			this.history.delete(character.id);
			this.status.delete(character.id);
			this._cleanActionCache();
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

	public updateStatus(character: Character, status: ChatCharacterStatus, targets?: readonly CharacterId[]): void {
		const last = this.status.get(character.id) ?? { status: 'none', targets: undefined };
		this.status.set(character.id, { status, targets: targets?.slice() });

		if (!isEqual(targets, last.targets) && last.status !== 'none') {
			if (last.targets != null) {
				for (const lastTarget of last.targets) {
					const conn = this.getCharacterById(lastTarget)?.connection;
					conn?.sendMessage('chatCharacterStatus', { id: character.id, status: 'none' });
				}
			} else {
				this.sendMessage('chatCharacterStatus', { id: character.id, status: 'none' });
			}
			if (status === 'none')
				return;
		}

		const sendTo = targets ? targets.map((t) => this.getCharacterById(t)?.connection) : [this];
		for (const conn of sendTo) {
			conn?.sendMessage('chatCharacterStatus', { id: character.id, status });
		}
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

		const queue: ChatMessage[] = [];
		const now = Date.now();
		let originRoom = player.appearance.characterState.currentRoom;
		let history = this.history.get(from.id);
		if (!history) {
			this.history.set(from.id, history = new Map<number, MessageHistoryMetadata>());
		} else if (history.has(id)) {
			// invalid message, already exists
			return {
				result: 'blocked',
				reason: 'Duplicate message',
			};
		}
		if (editId) {
			const originalMetadata = history.get(editId);
			if (!originalMetadata) {
				// invalid message, nothing to edit
				return {
					result: 'blocked',
					reason: 'Edited message not found',
				};
			}
			history.delete(editId);
			if (originalMetadata.time + MESSAGE_EDIT_TIMEOUT < now) {
				// invalid message, too old
				return {
					result: 'blocked',
					reason: 'Edited message is too old to be edited',
				};
			}
			originRoom = originalMetadata.room;
			queue.push({
				type: 'deleted',
				id: editId,
				from: from.id,
				time: this.nextMessageTime(),
			});
		}
		history.set(id, {
			time: now,
			room: originRoom,
		});
		for (const message of messages) {
			const finalMessage: ChatMessage = {
				type: message.type,
				id,
				insertId: editId,
				room: originRoom,
				from: { id: from.id, name: from.name, labelColor: from.getEffectiveSettings().labelColor },
				parts: message.parts,
				time: this.nextMessageTime(),
			};
			if (IsTargeted(message)) {
				Assert(finalMessage.type === 'chat' || finalMessage.type === 'ooc');
				finalMessage.to = message.to.map((t): ChatMessageChatCharacter | null => {
					const target = this.getCharacterById(t);
					return target != null ? { id: target.id, name: target.name, labelColor: target.getEffectiveSettings().labelColor } : null;
				}).filter(IsNotNullable);
			}
			queue.push(finalMessage);
		}
		this._queueMessages(queue);

		return { result: 'ok' };
	}

	public handleActionMessage(actionMessage: ActionHandlerMessage): void {
		this._queueMessages([this.mapActionMessageToChatMessage(actionMessage)]);
	}

	public mapActionMessageToChatMessage({
		id,
		rooms,
		character,
		target,
		sendTo,
		dictionary,
		...data
	}: ActionHandlerMessage): ChatMessage {
		// No reason to duplicate target if it matches character
		if (isEqual(target, character)) {
			target = undefined;
		}
		return {
			type: 'action',
			id,
			rooms,
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

	private _queueMessages(messages: ChatMessage[]): void {
		for (const character of this.characters) {
			character.queueMessages(messages.filter((msg) => {
				switch (msg.type) {
					case 'chat':
					case 'ooc':
						return msg.to === undefined || character.id === msg.from.id || msg.to.some((t) => t.id === character.id);
					case 'deleted':
						return true;
					case 'emote':
						return true;
					case 'me':
						return true;
					case 'action':
						return msg.sendTo === undefined || msg.sendTo.includes(character.id);
					case 'actionLog':
						return true;
					case 'serverMessage':
						return true;
					default:
						AssertNever(msg);
				}
			}));
		}
	}

	public processDirectoryMessages(messages: ChatMessageDirectoryAction[]): void {
		this._queueMessages(messages
			.filter((m) => m.directoryTime > this.lastDirectoryMessageTime)
			.map((m): ChatMessage => {
				let data: ChatMessageAction['data'];
				if (m.data) {
					data = {};

					if (m.data.character != null) {
						data.character = this._getCharacterActionInfo(m.data.character);
					}
					if (m.data.targetCharacter != null) {
						data.target = this._getCharacterActionInfo(m.data.targetCharacter);
					}
					if (m.data.account != null) {
						data.account = m.data.account;
					}
					if (m.data.accountTarget != null) {
						data.accountTarget = m.data.accountTarget;
					}
				}

				return ({
					...omit(m, ['directoryTime']),
					time: this.nextMessageTime(),
					rooms: null,
					data,
				});
			}));
		this.lastDirectoryMessageTime = chain(messages)
			.map((m) => m.directoryTime)
			.concat(this.lastDirectoryMessageTime)
			.max().value() ?? this.lastDirectoryMessageTime;
	}

	private _getCharacterActionInfo(id: CharacterId): IChatMessageActionTargetCharacter;
	private _getCharacterActionInfo(id?: CharacterId | null): IChatMessageActionTargetCharacter | undefined;
	private _getCharacterActionInfo(id?: CharacterId | null): IChatMessageActionTargetCharacter | undefined {
		if (!id)
			return undefined;

		const char = this.getCharacterById(id);
		if (!char)
			return this.actionCache.get(id)?.descriptor ?? {
				type: 'character',
				id,
				name: '[UNKNOWN]',
				pronoun: 'they',
				labelColor: '#ffffff',
			};

		const descriptor: IChatMessageActionTargetCharacter = {
			type: 'character',
			id: char.id,
			name: char.name,
			pronoun: char.getEffectiveSettings().pronoun,
			labelColor: char.getEffectiveSettings().labelColor,
		};
		const actionCacheEntry = this.actionCache.get(id);
		if (actionCacheEntry == null) {
			this.actionCache.set(id, {
				descriptor,
				lastAction: null,
			});
		} else {
			actionCacheEntry.descriptor = descriptor;
			// If we got here, then character is in space (possibly again), reset the leave flag
			delete actionCacheEntry.leave;
		}

		return descriptor;
	}

	private _cleanActionCache(): void {
		const now = Date.now();

		for (const [key, value] of Array.from(this.actionCache.entries())) {
			if (this.getCharacterById(key) != null) {
				// Character is in space, no deletion
				delete value.leave;
			} else if (value.leave == null) {
				// Character is no longer in space, mark for deletion
				// This is delayed to allow for delayed messages from Directory to be processed correctly
				value.leave = now;
			} else if (now > value.leave + ACTION_CACHE_TIMEOUT) {
				// The record is stale, prune it
				this.actionCache.delete(key);
			}
		}
	}
}

function IsTargeted(message: IClientMessage): message is { type: 'chat' | 'ooc'; parts: IChatSegment[]; to: CharacterId[]; } {
	return (message.type === 'chat' || message.type === 'ooc') && message.to !== undefined;
}
