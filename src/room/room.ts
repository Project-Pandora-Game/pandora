import { CharacterId, GetLogger, IChatRoomClientData, IChatRoomMessage, Logger, IChatRoomFullInfo, RoomId, IChatRoomLeaveReason, AssertNever, IChatRoomMessageBase } from 'pandora-common';
import type { Character } from '../character/character';

export class Room {

	private readonly data: IChatRoomFullInfo;
	private readonly characters: Set<Character> = new Set();

	public get id(): RoomId {
		return this.data.id;
	}

	private logger: Logger;

	constructor(data: IChatRoomFullInfo) {
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
		this.sendUpdateToAllInRoom();
	}

	getInfo(): IChatRoomFullInfo {
		return this.data;
	}

	getClientData(): IChatRoomClientData {
		return {
			...this.getInfo(),
			characters: Array.from(this.characters).map((c) => ({
				name: c.name,
				id: c.id,
				accountId: c.accountId,
				appearance: c.appearance.exportToBundle(),
			})),
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
		character.room = this;
		this.sendUpdateToAllInRoom();
		this.logger.verbose(`Character ${character.id} entered`);
		this.sendMessage({
			type: 'action',
			id: 'characterEntered',
			data: {
				character: character.id,
			},
		});
	}

	public characterLeave(character: Character, reason: IChatRoomLeaveReason): void {
		this.characters.delete(character);
		character.room = null;
		character.connection?.sendMessage('chatRoomUpdate', { room: null });

		// Report the leave
		this.logger.verbose(`Character ${character.id} left (${reason})`);
		if (reason === 'leave') {
			this.sendMessage({
				type: 'action',
				id: 'characterLeft',
				data: {
					character: character.id,
				},
			});
		} else if (reason === 'disconnect' || reason === 'destroy') {
			this.sendMessage({
				type: 'action',
				id: 'characterDisconnected',
				data: {
					character: character.id,
				},
			});
		} else if (reason === 'kick') {
			this.sendMessage({
				type: 'action',
				id: 'characterKicked',
				data: {
					character: character.id,
				},
			});
		} else if (reason === 'ban') {
			this.sendMessage({
				type: 'action',
				id: 'characterBanned',
				data: {
					character: character.id,
				},
			});
		} else {
			AssertNever(reason);
		}

		this.sendUpdateToAllInRoom();
	}

	public sendUpdateTo(character: Character): void {
		character.connection?.sendMessage('chatRoomUpdate', { room: this.getClientData() });
	}

	public sendUpdateToAllInRoom(): void {
		const room = this.getClientData();
		for (const character of this.characters) {
			character.connection?.sendMessage('chatRoomUpdate', { room });
		}
	}

	private lastMessageTime: number = 0;

	private nextMessageTime(): number {
		let time = Date.now();
		// Make sure the time is unique
		if (time <= this.lastMessageTime) {
			time = this.lastMessageTime + 1;
		}
		return this.lastMessageTime = time;
	}

	public sendMessage(...messages: IChatRoomMessageBase[]): void {
		const processedMessages = messages.map<IChatRoomMessage>(
			(msg) => ({
				time: this.nextMessageTime(),
				...msg,
			}),
		);
		for (const character of this.characters) {
			character.queueMessages(processedMessages.filter((msg) => {
				if (msg.type === 'chat') {
					return msg.to === undefined || character.id === msg.from || character.id === msg.to;
				} else if (msg.type === 'emote' || msg.type === 'me') {
					return true;
				} else if (msg.type === 'action') {
					return true;
				}
				AssertNever(msg.type);
			}));
		}
	}
}
