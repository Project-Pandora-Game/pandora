import { IChatRoomClientData, IChatRoomMessage, GetLogger, CharacterId, ICharacterPublicData, IChatRoomMessageChat, IChatRoomMessageAction, RoomId, IChatRoomMessageDeleted, IChatRoomUpdate, IShardClientArgument, IChatRoomStatus } from 'pandora-common';
import { ChatActionDictionaryMetaEntry } from 'pandora-common/dist/chatroom/chatActions';
import { useSyncExternalStore } from 'react';
import { BrowserStorage } from '../browserStorage';
import { USER_DEBUG } from '../config/Environment';
import { TypedEventEmitter } from '../event';
import type { SocketIOShardConnector } from '../networking/socketio_shard_connector';
import { Observable } from '../observable';
import { Character } from './character';
import { Player } from './player';

const logger = GetLogger('Room');

export type IChatroomMessageChatProcessed = (IChatRoomMessageChat | IChatRoomMessageDeleted) & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};

export type IChatroomMessageActionProcessed = IChatRoomMessageAction & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};

export type IChatroomMessageProcessed = (IChatroomMessageChatProcessed | IChatroomMessageActionProcessed) & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
	edited?: boolean;
};

export function IsUserMessage(message: IChatroomMessageProcessed): message is IChatroomMessageChatProcessed & { time: number; } {
	return message.type !== 'action' && message.type !== 'serverMessage';
}

function ProcessMessage(message: IChatRoomMessageAction & { time: number; }): IChatroomMessageActionProcessed {
	const metaDictionary: Partial<Record<ChatActionDictionaryMetaEntry, string>> = {};

	const source = message.data?.character;
	const target = message.data?.targetCharacter ?? source;

	if (source) {
		const { id, name, pronoun } = source;
		metaDictionary.SOURCE_CHARACTER_NAME = name;
		metaDictionary.SOURCE_CHARACTER_ID = id;
		metaDictionary.SOURCE_CHARACTER_PRONOUN = pronoun;
		metaDictionary.SOURCE_CHARACTER_PRONOUN_SELF = `${pronoun}self`;
		metaDictionary.SOURCE_CHARACTER = `${name} (${id})`;
	}

	if (target) {
		const { id, name, pronoun } = target;
		metaDictionary.TARGET_CHARACTER_NAME = name;
		metaDictionary.TARGET_CHARACTER_ID = id;
		metaDictionary.TARGET_CHARACTER_PRONOUN = pronoun;
		metaDictionary.TARGET_CHARACTER_PRONOUN_SELF = `${pronoun}self`;
		metaDictionary.TARGET_CHARACTER = `${name} (${id})`;
		if (id === source?.id) {
			metaDictionary.TARGET_CHARACTER_DYNAMIC = pronoun;
			metaDictionary.TARGET_CHARACTER_DYNAMIC_SELF = `${pronoun}self`;
		} else {
			metaDictionary.TARGET_CHARACTER_DYNAMIC = `${name}'s (${id})`;
			metaDictionary.TARGET_CHARACTER_DYNAMIC_SELF = `${name} (${id})`;
		}
	}

	return {
		...message,
		dictionary: {
			...metaDictionary,
			...message.dictionary,
		},
	};
}

/** Used for restoring chat contents on window reload */
export const LastRoomChat = BrowserStorage.createSession<undefined | {
	roomId: RoomId;
	messages: IChatroomMessageProcessed[];
}>('lastRoomChat', undefined);

export const Room = new class Room extends TypedEventEmitter<RoomEvents> {
	private _lastMessageId = 0;
	public getNextMessageId(): number {
		let id = Date.now();
		if (id <= this._lastMessageId) {
			id = this._lastMessageId + 1;
		}
		this._lastMessageId = id;
		return id;
	}

	public readonly data = new Observable<IChatRoomClientData | null>(null);
	public get loaded(): boolean {
		return this.data.value != null;
	}

	public characters: readonly Character[] = [];

	public readonly messages = new Observable<IChatroomMessageProcessed[]>([]);
	private lastMessageTime: number = 0;

	public update(data: IChatRoomUpdate): void {
		const player = Player.value;
		if (!player) {
			throw new Error('Cannot update room when player is not loaded');
		}
		const oldData = this.data.value;
		if ('room' in data) {
			const room = data.room;
			this.data.value = room;
			if (room) {
				if (oldData && oldData.id !== room.id) {
					logger.debug('Changed room');
					this.onLeave();
				}
				if (USER_DEBUG && oldData?.id !== room.id && LastRoomChat.value?.roomId === room.id) {
					this.messages.value = LastRoomChat.value.messages;
				}
				this.updateCharacters(room.characters);
				this.emit('load', room);
				logger.debug('Loaded room data', data);
			} else {
				logger.debug('Left room');
				this.onLeave();
			}
			return;
		}
		const { info, join, leave, update } = data;
		if (join?.id === player.data.id) {
			return; // Ignore self-join
		}
		if (!this.data.value) {
			logger.error('Cannot update room when it is not loaded');
			return;
		}
		let next = this.data.value;

		if (info) {
			next = { ...next, ...info };
			this.emit('info', info);
		}
		if (join) {
			let char = this.characters.find((oc) => oc.data.id === join.id);
			if (!char) {
				this.characters = [...this.characters, char = new Character(join)];
				next.characters.push(join);
				this.characterNameMap.set(join.id, join.name);
			} else {
				char.update(join);
				next.characters = next.characters.map((c) => c.id === join.id ? join : c);
			}
			this.emit('join', char);
		}
		if (leave) {
			next.characters = next.characters.filter((c) => c.id !== leave);
			this.characters = this.characters.filter((oc) => oc.data.id !== leave);
			this._status.delete(leave);
			this.emit('leave', leave);
		}
		if (update) {
			const char = this.characters.find((oc) => oc.data.id === update.id);
			if (!char) {
				logger.error('Character not found', update);
			} else {
				char.update(update);
				next.characters = next.characters.map((c) => c.id === update.id ? { ...c, ...update } : c);
				this.emit('update', char);
			}
		}
		this.data.value = { ...next };
		logger.debug('Updated room data', data);
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
		for (const character of this.characters) {
			this.characterNameMap.set(character.data.id, character.data.name);
		}
	}

	private readonly characterNameMap = new Map<CharacterId, string>();

	public onMessage(messages: IChatRoomMessage[], connector?: SocketIOShardConnector): void {
		messages = messages.filter((m) => m.time > this.lastMessageTime);
		for (const message of messages) {
			this.lastMessageTime = Math.max(this.lastMessageTime, message.time);
		}
		connector?.sendMessage('chatRoomMessageAck', {
			lastTime: this.lastMessageTime,
		});
		let nextMessages = [...this.messages.value];
		const insertIndexes = new Map<number, number>();

		for (const message of messages) {
			if (!IsUserMessage(message))
				nextMessages.push(ProcessMessage(message));
			else if (message.type === 'deleted') {
				let found = false;
				const acc: IChatroomMessageProcessed[] = [];
				for (const m of nextMessages) {
					if (m.id !== message.id)
						acc.push(m);
					else if (!found) {
						found = true;
						acc.push(message);
					}
				}
				nextMessages = acc;
			} else if ('insertId' in message && message.insertId) {
				const deleteIndex = nextMessages.findIndex((m) => (m.type === 'deleted' && m.id === message.insertId && m.from === message.from.id));
				if (deleteIndex >= 0) {
					nextMessages.splice(deleteIndex, 1, { ...message, edited: true });
					insertIndexes.set(message.id, deleteIndex + 1);
					continue;
				}
				const insertIndex = insertIndexes.get(message.id);
				if (insertIndex !== undefined) {
					nextMessages.splice(insertIndex, 0, { ...message, edited: true });
					insertIndexes.set(message.id, insertIndex + 1);
					continue;
				}
			} else {
				nextMessages.push(message);
			}
		}
		this.messages.value = nextMessages;
		if (USER_DEBUG && this.data.value) {
			LastRoomChat.value = {
				roomId: this.data.value.id,
				messages: this.messages.value,
			};
		}
	}

	private readonly _status = new Map<CharacterId, IChatRoomStatus>();
	public onStatus({ id, status }: IShardClientArgument['chatRoomStatus']): void {
		if (id === Player.value?.data?.id)
			return;

		if (this._status.get(id) !== status) {
			this._status.set(id, status);
			this.emit('status', id);
		}
	}
	public getStatus(id: CharacterId): IChatRoomStatus {
		return this._status.get(id) ?? 'none';
	}
	public setPlayerStatus(status: IChatRoomStatus): void {
		const id = Player.value?.data.id;
		if (id && this._status.get(id) !== status) {
			this._status.set(id, status);
			this.emit('status', id);
		}
	}

	private onLeave() {
		this._status.clear();
		this.messages.value = [];
		this.updateCharacters([]);
		this.emit('exit', true);
	}
};

/**
 * Observes a character's status, only updating when the character is in the room.
 */
export function useChatRoomStatus(id: CharacterId): IChatRoomStatus {
	return useSyncExternalStore((cb) => Room.on('status', (actualId) => {
		if (actualId === id) {
			cb();
		}
	}), () => Room.getStatus(id));
}

type RoomEvents = {
	'load': IChatRoomClientData;
	'join': Character;
	'update': Character;
	'leave': CharacterId;
	'info': Partial<IChatRoomClientData>;
	'exit': true;
	'status': CharacterId;
};

// Debug helper
if (USER_DEBUG) {
	//@ts-expect-error: Development link
	window.Room = Room;
} else {
	// Clear the info that should be saved only in debug mode
	LastRoomChat.value = undefined;
}
