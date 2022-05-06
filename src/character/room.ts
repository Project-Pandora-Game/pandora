import { IChatRoomClientData, IChatRoomMessage, GetLogger, CharacterId, ICharacterPublicData } from 'pandora-common';
import { NODE_ENV } from '../config/Environment';
import { TypedEventEmitter } from '../event';
import { Observable } from '../observable';
import { Character } from './character';
import { Player } from './player';

const logger = GetLogger('Room');

export interface IChatRoomMessageSaved extends IChatRoomMessage {
	fromName: string;
}

export const Room = new class Room extends TypedEventEmitter<RoomEvents> {

	public readonly data = new Observable<IChatRoomClientData | null>(null);
	public get loaded(): boolean {
		return this.data.value != null;
	}

	public characters: Character[] = [];

	public readonly messages = new Observable<IChatRoomMessageSaved[]>([]);

	public update(data: IChatRoomClientData | null): void {
		const player = Player.value;
		if (!player) {
			throw new Error('Cannot update room when player is not loaded');
		}
		const oldData = this.data.value;
		this.data.value = data;
		if (data) {
			if (oldData && oldData.id !== data.id) {
				logger.debug('Changed room');
				this.onLeave();
			}
			this.updateCharacters(data.characters);
			this.emit('load', data);
			logger.debug('Loaded room data', data);
		} else {
			logger.debug('Left room');
			this.onLeave();
		}
	}

	private updateCharacters(characters: ICharacterPublicData[]): void {
		const oldCharacters = this.characters;
		const player = Player.value;
		if (!player) {
			throw new Error('Cannot update room characters when player is not loaded');
		}
		const playerId = player.data.id;
		this.characters = characters.map((c) => {
			let char = c.id === playerId ? player : oldCharacters.find((oc) => oc.data.id === c.id);
			if (char) {
				char.update(c);
			} else {
				char = new Character(c);
			}
			return char;
		});
	}

	public getCharacterName(id: CharacterId | 'server'): string {
		if (id === 'server')
			return '[SERVER]';
		const character = this.data.value?.characters.find((c) => c.id === id);
		return character?.name ?? '[UNKNOWN]';
	}

	public onMessage(message: IChatRoomMessage): void {
		this.messages.value = [
			...this.messages.value,
			{
				...message,
				fromName: this.getCharacterName(message.from),
			},
		];
		this.emit('message', message);
	}

	private onLeave() {
		this.messages.value = [];
		this.updateCharacters([]);
		this.emit('leave', undefined);
	}
};

type RoomEvents = {
	'load': IChatRoomClientData;
	'leave': undefined;
	'message': IChatRoomMessage;
};

// Debug helper
if (NODE_ENV === 'development') {
	//@ts-expect-error: Development link
	window.Room = Room;
}
