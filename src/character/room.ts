import { IChatRoomClientData, IChatRoomMessage, GetLogger, CharacterId } from 'pandora-common';
import { TypedEventEmitter } from '../event';
import { Observable } from '../observable';

const logger = GetLogger('Room');

export interface IChatRoomMessageSaved extends IChatRoomMessage {
	fromName: string;
}

export const Room = new class Room extends TypedEventEmitter<RoomEvents> {

	public readonly data = new Observable<IChatRoomClientData | null>(null);
	public get loaded(): boolean {
		return this.data.value != null;
	}

	public readonly messages = new Observable<IChatRoomMessageSaved[]>([]);

	constructor() {
		super();
		this.on('leave', this.onLeave.bind(this));
	}

	public update(data: IChatRoomClientData | null): void {
		const oldData = this.data.value;
		this.data.value = data;
		if (data) {
			if (oldData && oldData.id !== data.id) {
				this.emit('leave', undefined);
				logger.debug('Changed room');
			}
			this.emit('load', data);
			logger.debug('Loaded room data', data);
		} else {
			this.emit('leave', undefined);
			logger.debug('Left room');
		}
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
	}
};

type RoomEvents = {
	'load': IChatRoomClientData;
	'leave': undefined;
	'message': IChatRoomMessage;
};
