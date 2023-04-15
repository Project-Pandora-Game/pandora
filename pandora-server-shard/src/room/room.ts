import { CharacterId, GetLogger, IChatRoomClientData, IChatRoomMessage, Logger, IChatRoomFullInfo, RoomId, AssertNever, IChatRoomMessageDirectoryAction, IChatRoomUpdate, ServerRoom, IShardClient, IClientMessage, IChatSegment, IChatRoomStatus, IChatRoomMessageActionTargetCharacter, ICharacterRoomData, ActionHandlerMessage, CharacterSize, ActionRoomContext, CalculateCharacterMaxYForBackground, ResolveBackground, IShardChatRoomDefinition, IChatRoomDataShardUpdate, IChatRoomData, AccountId, RoomInventory, AssetManager, ROOM_INVENTORY_BUNDLE_DEFAULT } from 'pandora-common';
import type { Character } from '../character/character';
import _, { isEqual, omit } from 'lodash';
import { assetManager } from '../assets/assetManager';
import AsyncLock from 'async-lock';
import { GetDatabase } from '../database/databaseProvider';

const MESSAGE_EDIT_TIMEOUT = 1000 * 60 * 20; // 20 minutes
const ACTION_CACHE_TIMEOUT = 60_000; // 10 minutes

/** Time (in ms) as interval when rooms's periodic actions (like saving of modified data or message cleanup) happen */
export const ROOM_TICK_INTERVAL = 120_000;

export class Room extends ServerRoom<IShardClient> {

	private readonly data: IShardChatRoomDefinition;
	private readonly characters: Set<Character> = new Set();
	private readonly history = new Map<CharacterId, Map<number, number>>();
	private readonly status = new Map<CharacterId, { status: IChatRoomStatus; target?: CharacterId; }>();
	private readonly actionCache = new Map<CharacterId, { result: IChatRoomMessageActionTargetCharacter; leave?: number; }>();
	private readonly tickInterval: NodeJS.Timeout;

	public readonly inventory: RoomInventory;

	private readonly _lock = new AsyncLock();
	private modified: Set<keyof IChatRoomDataShardUpdate> = new Set();

	public get id(): RoomId {
		return this.data.id;
	}

	public get accessId(): string {
		return this.data.accessId;
	}

	public get owners(): readonly AccountId[] {
		return this.data.owners;
	}

	private logger: Logger;

	constructor(data: IChatRoomData) {
		super();
		this.data = data;
		this.logger = GetLogger('Room', `[Room ${data.id}]`);
		this.logger.verbose('Created');
		this.inventory = new RoomInventory(assetManager);

		this.inventory.importFromBundle(data.inventory ?? ROOM_INVENTORY_BUNDLE_DEFAULT, this.logger.prefixMessages('Room inventory load:'));
		this.inventory.onChangeHandler = this.onInventoryChanged.bind(this);

		this.tickInterval = setInterval(() => this._tick(), ROOM_TICK_INTERVAL);
	}

	public reloadAssetManager(manager: AssetManager) {
		this.inventory.reloadAssetManager(manager, this.logger.prefixMessages('Asset manager reload:'));
	}

	public onRemove(): void {
		clearInterval(this.tickInterval);
		this.logger.verbose('Destroyed');
	}

	private _tick(): void {
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

	public onInventoryChanged(): void {
		this.modified.add('inventory');

		this.sendUpdateToAllInRoom({
			roomInventoryChange: this.inventory.exportToBundle(),
		});
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
		this.sendUpdateToAllInRoom({ info: this.getClientData() });

		// Put characters into correct place if needed
		const roomBackground = ResolveBackground(assetManager, this.data.config.background);
		const maxY = CalculateCharacterMaxYForBackground(roomBackground);
		for (const character of this.characters) {
			if (character.position[0] > roomBackground.size[0] || character.position[1] > maxY) {
				character.position = [Math.floor(CharacterSize.WIDTH * (0.7 + 0.4 * (Math.random() - 0.5))), 0];
				this.sendUpdateToAllInRoom({ update: { id: character.id, position: character.position } });
			}
		}
	}

	public getInfo(): IChatRoomFullInfo {
		return {
			...this.data.config,
			id: this.id,
			owners: this.owners.slice(),
		};
	}

	public getActionRoomContext(): ActionRoomContext {
		return {
			features: this.data.config.features,
		};
	}

	public getClientData(): IChatRoomClientData {
		return {
			...this.getInfo(),
			characters: Array.from(this.characters).map((c) => this.getCharacterData(c)),
			inventory: this.inventory.exportToBundle(),
		};
	}

	public isAdmin(character: Character): boolean {
		if (this.data.owners.includes(character.accountId))
			return true;

		if (this.data.config.admin.includes(character.accountId))
			return true;

		if (this.data.config.development?.autoAdmin && character.isAuthorized('developer'))
			return true;

		return false;
	}

	public updateCharacterPosition(source: Character, id: CharacterId, [x, y]: [number, number]): void {
		const roomBackground = ResolveBackground(assetManager, this.data.config.background);
		const maxY = CalculateCharacterMaxYForBackground(roomBackground);

		if (x > roomBackground.size[0] || y > maxY) {
			return;
		}
		const character = this.getCharacterById(id);
		if (!character) {
			return;
		}
		// If moving self, must not be restricted by items
		if (character.id === source.id) {
			const restrictionManager = character.appearance.getRestrictionManager(this.getActionRoomContext());
			if (restrictionManager.getEffects().blockRoomMovement)
				return;
		}
		// Only admin can move other characters
		if (character.id !== source.id && !this.isAdmin(source)) {
			return;
		}
		character.position = [x, y];
		this.sendUpdateToAllInRoom({ update: { id: character.id, position: character.position } });
	}

	public getCharacterData(c: Character): ICharacterRoomData {
		return {
			name: c.name,
			id: c.id,
			accountId: c.accountId,
			appearance: c.appearance.exportToBundle(),
			settings: c.settings,
			position: c.position,
		};
	}

	public getAllCharacters(): Character[] {
		return [...this.characters.values()];
	}

	public getCharacterById(id: CharacterId): Character | null {
		return Array.from(this.characters.values()).find((c) => c.id === id) ?? null;
	}

	public characterEnter(character: Character): void {
		// Position character to the side of the room ±20% of character width randomly (to avoid full overlap with another characters)
		const roomBackground = ResolveBackground(assetManager, this.data.config.background);
		const maxY = CalculateCharacterMaxYForBackground(roomBackground);
		character.initRoomPosition(this.id, [Math.floor(CharacterSize.WIDTH * (0.7 + 0.4 * (Math.random() - 0.5))), 0], [roomBackground.size[0], maxY]);
		this.characters.add(character);
		character.setRoom(this);
		this.sendUpdateTo(character, { room: this.getClientData() });
		this.sendUpdateToAllInRoom({ join: this.getCharacterData(character) });
		this.logger.debug(`Character ${character.id} entered`);

		this._getCharacterActionInfo(character.id); // make sure it is added to the cache
	}

	public characterLeave(character: Character): void {
		this.characters.delete(character);
		character.setRoom(null);
		this.history.delete(character.id);
		this.status.delete(character.id);
		this._cleanActionCache(character.id);
		character.connection?.sendMessage('chatRoomUpdate', { room: null });
		this.logger.debug(`Character ${character.id} left`);
		this.sendUpdateToAllInRoom({ leave: character.id });
	}

	public sendUpdateTo(character: Character, data: IChatRoomUpdate): void {
		character.connection?.sendMessage('chatRoomUpdate', data);
	}

	public sendUpdateToAllInRoom(data: IChatRoomUpdate): void {
		this.sendMessage('chatRoomUpdate', data);
	}

	public save(): Promise<void> {
		return this._lock.acquire('save', async () => {
			const keys = [...this.modified];
			this.modified.clear();

			// Nothing to save
			if (keys.length === 0)
				return;

			const data: IChatRoomDataShardUpdate = {};

			if (keys.includes('inventory')) {
				data.inventory = this.inventory.exportToBundle();
			}

			try {
				if (!await GetDatabase().setChatRoom(this.id, data, this.accessId)) {
					throw new Error('Database returned failure');
				}
			} catch (error) {
				for (const key of keys) {
					this.modified.add(key);
				}
				this.logger.warning(`Failed to save data:`, error);
			}
		});
	}

	public static async load(id: RoomId, accessId: string): Promise<Omit<IChatRoomData, 'config' | 'accessId' | 'owners'> | null> {
		const room = await GetDatabase().getChatRoom(id, accessId);
		if (room === false) {
			return null;
		}
		return room;
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

	public updateStatus(character: Character, status: IChatRoomStatus, target?: CharacterId): void {
		const last = this.status.get(character.id) ?? { status: 'none', target: undefined };
		this.status.set(character.id, { status, target });

		if (target !== last.target && last.status !== 'none') {
			const lastTarget = last.target ? this.getCharacterById(last.target)?.connection : this;
			lastTarget?.sendMessage('chatRoomStatus', { id: character.id, status: 'none' });
			if (status === 'none')
				return;
		}

		const sendTo = target ? this.getCharacterById(target)?.connection : this;
		sendTo?.sendMessage('chatRoomStatus', { id: character.id, status });
	}

	public handleMessages(from: Character, messages: IClientMessage[], id: number, insertId?: number): void {
		// Handle speech muffling
		const player = from.appearance.getRestrictionManager(this.getActionRoomContext());
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

		const queue: IChatRoomMessage[] = [];
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

	public handleActionMessage({
		id,
		customText,
		character,
		target,
		sendTo,
		dictionary,
		...data
	}: ActionHandlerMessage): void {
		// No reason to duplicate target if it matches character
		if (isEqual(target, character)) {
			target = undefined;
		}

		this._queueMessages([
			{
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
			},
		]);
	}

	private _queueMessages(messages: IChatRoomMessage[]): void {
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

	public processDirectoryMessages(messages: IChatRoomMessageDirectoryAction[]): void {
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

	private _getCharacterActionInfo(id?: CharacterId | null): IChatRoomMessageActionTargetCharacter | undefined {
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

		const result: IChatRoomMessageActionTargetCharacter = {
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
