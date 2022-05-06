import { CharacterId, GetLogger, IChatRoomClientData, IChatRoomMessage, Logger,  IChatRoomFullInfo, RoomId, IChatRoomLeaveReason, AssertNever } from 'pandora-common';
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
		this.sendMessage('server', `(${character.name} (${character.id}) entered.)`);
	}

	public characterLeave(character: Character, reason: IChatRoomLeaveReason): void {
		this.characters.delete(character);
		character.room = null;
		character.connection?.sendMessage('chatRoomUpdate', { room: null });
		this.sendUpdateToAllInRoom();

		// Report the leave
		this.logger.verbose(`Character ${character.id} left (${reason})`);
		if (reason === 'leave') {
			this.sendMessage('server', `(${character.name} (${character.id}) left.)`);
		} else if (reason === 'disconnect' || reason === 'destroy') {
			this.sendMessage('server', `(${character.name} (${character.id}) disconnected.)`);
		} else if (reason === 'kick') {
			this.sendMessage('server', `(${character.name} (${character.id}) has been kicked.)`);
		} else if (reason === 'ban') {
			this.sendMessage('server', `(${character.name} (${character.id}) has been banned.)`);
		} else {
			AssertNever(reason);
		}
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

	private lastMessageId: number = 0;

	public sendMessage(from: CharacterId | 'server', message: string, targets?: CharacterId[]): void {
		let id = Date.now();
		if (id <= this.lastMessageId) {
			id = this.lastMessageId + 1;
		}
		this.lastMessageId = id;
		const msg: IChatRoomMessage = {
			id,
			from,
			message,
		};
		if (targets) {
			msg.private = true;
		}
		for (const character of this.characters) {
			if (!targets || targets.includes(character.id)) {
				character.connection?.sendMessage('chatRoomMessage', msg);
			}
		}
	}
}
