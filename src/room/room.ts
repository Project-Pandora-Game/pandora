import { CharacterId, GetLogger, IChatRoomClientData, IChatRoomMessage, Logger, IChatRoomFullInfo, RoomId, AssertNever, IChatRoomMessageBase, IChatroomMessageDirectoryAction, IChatRoomUpdate, ICharacterPublicData, ServerRoom, IShardClientBase } from 'pandora-common';
import type { Character } from '../character/character';
import _, { omit } from 'lodash';

export class Room extends ServerRoom<IShardClientBase> {

	private readonly data: IChatRoomFullInfo;
	private readonly characters: Set<Character> = new Set();

	public get id(): RoomId {
		return this.data.id;
	}

	private logger: Logger;

	constructor(data: IChatRoomFullInfo) {
		super();
		this.data = data;
		this.logger = GetLogger('Room', `[Room ${data.id}]`);
		this.logger.verbose('Created');
	}

	public update(data: IChatRoomFullInfo): void {
		if (data.id !== this.data.id) {
			throw new Error('Chatroom id cannot change');
		}
		for (const key of Object.keys(data) as (keyof IChatRoomFullInfo)[]) {
			(this.data as Record<string, unknown>)[key] = data[key];
		}
		this.sendUpdateToAllInRoom({ info: this.getClientData() });
	}

	getInfo(): IChatRoomFullInfo {
		return this.data;
	}

	getClientData(): IChatRoomClientData {
		return {
			...this.getInfo(),
			characters: Array.from(this.characters).map((c) => this.getCharacterData(c)),
		};
	}

	getCharacterData(c: Character): ICharacterPublicData {
		return {
			name: c.name,
			id: c.id,
			accountId: c.accountId,
			appearance: c.appearance.exportToBundle(),
			settings: c.settings,
		};
	}

	getAllCharacters(): Character[] {
		return [...this.characters.values()];
	}

	getCharacterById(id: CharacterId): Character | null {
		return Array.from(this.characters.values()).find((c) => c.id === id) ?? null;
	}

	public characterEnter(character: Character): void {
		this.characters.add(character);
		this.sendUpdateTo(character, { room: this.getClientData() });
		this.sendUpdateToAllInRoom({ join: this.getCharacterData(character) });
		this.logger.verbose(`Character ${character.id} entered`);
	}

	public characterLeave(character: Character): void {
		this.characters.delete(character);
		character.setRoom(null);
		character.connection?.sendMessage('chatRoomUpdate', { room: null });
		this.logger.verbose(`Character ${character.id} left`);
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

	public sendChatMessage(...messages: IChatRoomMessageBase[]): void {
		const processedMessages = messages.map<IChatRoomMessage>(
			(msg) => ({
				time: this.nextMessageTime(),
				...msg,
			}),
		);
		for (const character of this.characters) {
			character.queueMessages(processedMessages.filter((msg) => {
				switch (msg.type) {
					case 'chat':
					case 'ooc':
						return msg.to === undefined || character.id === msg.from || character.id === msg.to;
					case 'emote':
					case 'me':
					case 'action':
					case 'serverMessage':
						return true;
					default:
						AssertNever(msg);
				}
			}));
		}
	}

	public processDirectoryMessages(messages: IChatroomMessageDirectoryAction[]): void {
		this.sendChatMessage(
			...messages
				.filter((m) => m.directoryTime > this.lastDirectoryMessageTime)
				.map((m) => omit(m, ['directoryTime'])),
		);
		this.lastDirectoryMessageTime = _(messages)
			.map((m) => m.directoryTime)
			.concat(this.lastDirectoryMessageTime)
			.max() ?? this.lastDirectoryMessageTime;
	}
}
