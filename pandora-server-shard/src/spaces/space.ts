import {
	CharacterId,
	IChatMessage,
	Logger,
	SpaceClientInfo,
	SpaceId,
	AssertNever,
	IChatMessageDirectoryAction,
	GameStateUpdate,
	ServerRoom,
	IShardClient,
	IClientMessage,
	IChatSegment,
	ChatCharacterStatus,
	IChatMessageActionTargetCharacter,
	ActionHandlerMessage,
	ActionSpaceContext,
	ResolveBackground,
	AccountId,
	AssetManager,
	AssetFrameworkGlobalStateContainer,
	AssetFrameworkGlobalState,
	AssetFrameworkRoomState,
	AppearanceBundle,
	AssetFrameworkCharacterState,
	AssertNotNullable,
	RoomInventory,
	CharacterRoomPosition,
	RoomInventoryBundle,
	SpaceDirectoryConfig,
	SpaceLoadData,
	CloneDeepMutable,
	IsValidRoomPosition,
	GenerateInitialRoomPosition,
} from 'pandora-common';
import type { Character } from '../character/character';
import _, { isEqual, omit } from 'lodash';
import { assetManager } from '../assets/assetManager';

const MESSAGE_EDIT_TIMEOUT = 1000 * 60 * 20; // 20 minutes
const ACTION_CACHE_TIMEOUT = 60_000; // 10 minutes

/** Time (in ms) as interval for space's periodic actions (like saving of modified data or message cleanup) happen */
export const SPACE_TICK_INTERVAL = 120_000;

export abstract class Space extends ServerRoom<IShardClient> {

	protected readonly characters: Set<Character> = new Set();
	protected readonly history = new Map<CharacterId, Map<number, number>>();
	protected readonly status = new Map<CharacterId, { status: ChatCharacterStatus; target?: CharacterId; }>();
	protected readonly actionCache = new Map<CharacterId, { result: IChatMessageActionTargetCharacter; leave?: number; }>();
	protected readonly tickInterval: NodeJS.Timeout;

	public readonly gameState: AssetFrameworkGlobalStateContainer;

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

		this.gameState = new AssetFrameworkGlobalStateContainer(
			this.logger,
			this.onStateChanged.bind(this),
			initialState,
		);

		this.tickInterval = setInterval(() => this._tick(), SPACE_TICK_INTERVAL);
	}

	public reloadAssetManager(manager: AssetManager) {
		this.gameState.reloadAssetManager(manager);

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

	public onStateChanged(newState: AssetFrameworkGlobalState, oldState: AssetFrameworkGlobalState): void {
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
		};
	}

	public getActionSpaceContext(): ActionSpaceContext {
		return {
			features: this.config.features,
			isAdmin: (account) => Array.from(this.characters).some((character) => character.accountId === account && this.isAdmin(character)),
		};
	}

	public isAdmin(character: Character): boolean {
		if (this.owners.includes(character.accountId))
			return true;

		if (this.config.admin.includes(character.accountId))
			return true;

		if (this.config.development?.autoAdmin && character.isAuthorized('developer'))
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
		const state = this.gameState.currentState.room;
		AssertNotNullable(state);
		return new RoomInventory(state);
	}

	public characterAdd(character: Character, appearance: AppearanceBundle): void {
		// Position character to the side of the room ±20% of character width randomly (to avoid full overlap with another characters)
		const roomBackground = ResolveBackground(assetManager, this.config.background);
		character.initRoomPosition(this.id, roomBackground);

		this.runWithSuppressedUpdates(() => {
			let newState = this.gameState.currentState;

			// Add the character to the room
			this.characters.add(character);
			const characterState = AssetFrameworkCharacterState
				.loadFromBundle(
					assetManager,
					character.id,
					appearance,
					newState.room,
					this.logger.prefixMessages(`Character ${character.id} join:`),
				);
			newState = newState.withCharacter(character.id, characterState);

			this.gameState.setState(newState);

			// Send update to current characters
			const globalState = this.gameState.currentState.exportToClientBundle();
			this.sendUpdateToAllCharacters({
				globalState,
				join: character.getRoomData(),
			});
			// Send update to joining character
			character.setSpace(this, appearance);
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
			let newState = this.gameState.currentState;
			const characterAppearance = newState.characters.get(character.id)?.exportToBundle();
			AssertNotNullable(characterAppearance);

			this.characters.delete(character);
			newState = newState.withCharacter(character.id, null);

			// Update the target character
			character.setSpace(null, characterAppearance);

			// Update anyone remaining in the space
			this.gameState.setState(newState);
			this.sendUpdateToAllCharacters({
				globalState: this.gameState.currentState.exportToClientBundle(),
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

	public handleMessages(from: Character, messages: IClientMessage[], id: number, insertId?: number): void {
		// Handle speech muffling
		const player = from.getRestrictionManager();
		const muffler = player.getMuffler();
		if (muffler.isActive()) {
			for (const message of messages) {
				if (message.type === 'chat') {
					for (const part of message.parts) {
						part[1] = muffler.muffle(part[1]);
					}
				}
			}
		}

		const queue: IChatMessage[] = [];
		const now = Date.now();
		let history = this.history.get(from.id);
		if (!history) {
			this.history.set(from.id, history = new Map<number, number>());
			if (insertId) {
				return; // invalid message, nothing to edit
			}
		} else {
			if (history.has(id)) {
				return; // invalid message, already exists
			}
			if (insertId) {
				const insert = history.get(insertId);
				if (!insert) {
					return; // invalid message, nothing to edit
				}
				history.delete(insertId);
				if (insert + MESSAGE_EDIT_TIMEOUT < now) {
					return; // invalid message, too old
				}
				queue.push({
					type: 'deleted',
					id: insertId,
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
					insertId,
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
					insertId,
					from: { id: from.id, name: from.name, labelColor: from.settings.labelColor },
					to: { id: target.id, name: target.name, labelColor: target.settings.labelColor },
					parts: message.parts,
					time: this.nextMessageTime(),
				});
			}
		}
		this._queueMessages(queue);
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
					targetCharacter: this._getCharacterActionInfo(m.data.targetCharacter),
				} : undefined,
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
