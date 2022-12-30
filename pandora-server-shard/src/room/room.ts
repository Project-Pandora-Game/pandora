import { CharacterId, GetLogger, IChatRoomClientData, IChatRoomMessage, Logger, IChatRoomFullInfo, RoomId, AssertNever, IChatRoomMessageDirectoryAction, IChatRoomUpdate, ServerRoom, IShardClient, IClientMessage, IChatSegment, IChatRoomStatus, IChatRoomMessageActionCharacter, ICharacterRoomData, AppearanceActionHandlerMessage, CharacterSize, AppearanceActionRoomContext, CalculateCharacterMaxYForBackground, ResolveBackground } from 'pandora-common';
import type { Character } from '../character/character';
import _, { omit } from 'lodash';
import { assetManager } from '../assets/assetManager';

const MESSAGE_EDIT_TIMEOUT = 1000 * 60 * 20; // 20 minutes
const ACTION_CACHE_TIMEOUT = 60_000; // 10 minutes

export class Room extends ServerRoom<IShardClient> {

	private readonly data: IChatRoomFullInfo;
	private readonly characters: Set<Character> = new Set();
	private readonly history = new Map<CharacterId, Map<number, number>>();
	private readonly status = new Map<CharacterId, { status: IChatRoomStatus; target?: CharacterId; }>();
	private readonly actionCache = new Map<CharacterId, { result: IChatRoomMessageActionCharacter, leave?: number; }>();
	private readonly cleanInterval: NodeJS.Timeout;

	public get id(): RoomId {
		return this.data.id;
	}

	private logger: Logger;

	constructor(data: IChatRoomFullInfo) {
		super();
		this.data = data;
		this.logger = GetLogger('Room', `[Room ${data.id}]`);
		this.logger.verbose('Created');
		this.cleanInterval = setInterval(() => this._clean(), MESSAGE_EDIT_TIMEOUT / 2);
	}

	public onRemove(): void {
		clearInterval(this.cleanInterval);
		this.logger.verbose('Destroyed');
	}

	private _clean(): void {
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

	public update(data: IChatRoomFullInfo): void {
		if (data.id !== this.data.id) {
			throw new Error('Chatroom id cannot change');
		}
		for (const key of Object.keys(data) as (keyof IChatRoomFullInfo)[]) {
			(this.data as Record<string, unknown>)[key] = data[key];
		}
		this.sendUpdateToAllInRoom({ info: this.getClientData() });

		// Put characters into correct place if needed
		const roomBackground = ResolveBackground(assetManager, this.data.background);
		const maxY = CalculateCharacterMaxYForBackground(roomBackground);
		for (const character of this.characters) {
			if (character.position[0] > roomBackground.size[0] || character.position[1] > maxY) {
				character.position = [Math.floor(CharacterSize.WIDTH * (0.7 + 0.4 * (Math.random() - 0.5))), 0];
				this.sendUpdateToAllInRoom({ update: { id: character.id, position: character.position } });
			}
		}
	}

	public getInfo(): IChatRoomFullInfo {
		return this.data;
	}

	public getAppearanceActionRoomContext(): AppearanceActionRoomContext {
		return {
			features: this.data.features,
		};
	}

	public getClientData(): IChatRoomClientData {
		return {
			...this.getInfo(),
			characters: Array.from(this.characters).map((c) => this.getCharacterData(c)),
		};
	}

	public isAdmin(character: Character): boolean {
		if (this.data.admin.includes(character.accountId))
			return true;

		if (this.data.development?.autoAdmin && character.isAuthorized('developer'))
			return true;

		return false;
	}

	public updateCharacterPosition(source: Character, id: CharacterId, [x, y]: [number, number]): void {
		const roomBackground = ResolveBackground(assetManager, this.data.background);
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
			const restrictionManager = character.appearance.getRestrictionManager(this.getAppearanceActionRoomContext());
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
		character.position = [Math.floor(CharacterSize.WIDTH * (0.7 + 0.4 * (Math.random() - 0.5))), 0];
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
		const player = from.appearance.getRestrictionManager(this.getAppearanceActionRoomContext());
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

	public handleAppearanceActionMessage({
		id,
		customText,
		character,
		targetCharacter,
		sendTo,
		dictionary,
		...data
	}: AppearanceActionHandlerMessage): void {
		this._queueMessages([
			{
				type: 'action',
				id,
				customText,
				sendTo,
				time: this.nextMessageTime(),
				data: {
					character: this._getCharacterActionInfo(character),
					targetCharacter: targetCharacter !== character ? this._getCharacterActionInfo(targetCharacter) : undefined,
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

	private _getCharacterActionInfo(id?: CharacterId | null): IChatRoomMessageActionCharacter | undefined {
		if (!id)
			return undefined;

		const char = this.getCharacterById(id);
		if (!char)
			return this.actionCache.get(id)?.result ?? { id, name: '[UNKNOWN]', pronoun: 'they', labelColor: '#ffffff' };

		const result: IChatRoomMessageActionCharacter = { id: char.id, name: char.name, pronoun: char.settings.pronoun, labelColor: char.settings.labelColor };
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
