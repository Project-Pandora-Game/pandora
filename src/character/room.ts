import { IChatRoomClientData, IChatRoomMessage, GetLogger, CharacterId, ICharacterPublicData, IChatroomMessageChat, IChatroomMessageAction, AssertNever, RoomId, ICharacterPublicSettings, IChatRoomUpdate } from 'pandora-common';
import { ChatActionDictionaryMetaEntry } from 'pandora-common/dist/chatroom/chatActions';
import { BrowserStorage } from '../browserStorage';
import { USER_DEBUG } from '../config/Environment';
import { TypedEventEmitter } from '../event';
import type { SocketIOShardConnector } from '../networking/socketio_shard_connector';
import { Observable } from '../observable';
import { Character } from './character';
import { Player } from './player';

const logger = GetLogger('Room');

export type IChatroomMessageChatProcessed = IChatroomMessageChat & {
	fromName: string;
	toName?: string;
};

export type IChatroomMessageActionProcessed = IChatroomMessageAction & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};

export type IChatroomMessageProcessed = (IChatroomMessageChatProcessed | IChatroomMessageActionProcessed) & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};

export function IsUserMessage(message: IChatroomMessageProcessed): message is IChatroomMessageChatProcessed & { time: number; } {
	return message.type !== 'action' && message.type !== 'serverMessage';
}

function ProcessMessage(message: IChatRoomMessage): IChatroomMessageProcessed {
	if (message.type === 'chat' || message.type === 'ooc') {
		return {
			...message,
			fromName: Room.getCharacterName(message.from),
			toName: message.to !== undefined ? Room.getCharacterName(message.to) : undefined,
		};
	} else if (message.type === 'emote' || message.type === 'me') {
		return {
			...message,
			fromName: Room.getCharacterName(message.from),
		};
	} else if (message.type === 'action' || message.type === 'serverMessage') {
		const metaDictionary: Partial<Record<ChatActionDictionaryMetaEntry, string>> = {};

		const sourceId = message.data?.character;
		const targetId = message.data?.targetCharacter ?? sourceId;

		if (sourceId != null) {
			const sourceName = Room.getCharacterName(sourceId);
			const sourcePronoun = Room.getCharacterPronoun(sourceId);
			metaDictionary.SOURCE_CHARACTER_NAME = sourceName;
			metaDictionary.SOURCE_CHARACTER_ID = sourceId;
			metaDictionary.SOURCE_CHARACTER_PRONOUN = sourcePronoun;
			metaDictionary.SOURCE_CHARACTER_PRONOUN_SELF = `${sourcePronoun}self`;
			metaDictionary.SOURCE_CHARACTER = `${sourceName} (${sourceId})`;
		}

		if (targetId != null) {
			const targetName = Room.getCharacterName(targetId);
			const targetPronoun = Room.getCharacterPronoun(targetId);
			metaDictionary.TARGET_CHARACTER_NAME = targetName;
			metaDictionary.TARGET_CHARACTER_ID = targetId;
			metaDictionary.TARGET_CHARACTER_PRONOUN = targetPronoun;
			metaDictionary.TARGET_CHARACTER_PRONOUN_SELF = `${targetPronoun}self`;
			metaDictionary.TARGET_CHARACTER = `${targetName} (${targetId})`;
			if (targetId === sourceId) {
				metaDictionary.TARGET_CHARACTER_DYNAMIC = targetPronoun;
				metaDictionary.TARGET_CHARACTER_DYNAMIC_SELF = `${targetPronoun}self`;
			} else {
				metaDictionary.TARGET_CHARACTER_DYNAMIC = `${targetName}'s (${targetId})`;
				metaDictionary.TARGET_CHARACTER_DYNAMIC_SELF = `${targetName} (${targetId})`;
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
	AssertNever(message.type);
}

/** Used for restoring chat contents on window reload */
export const LastRoomChat = BrowserStorage.createSession<undefined | {
	roomId: RoomId;
	messages: IChatroomMessageProcessed[];
}>('lastRoomChat', undefined);

export const Room = new class Room extends TypedEventEmitter<RoomEvents> {

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
		}
		if (join) {
			const char = this.characters.find((oc) => oc.data.id === join.id);
			if (!char) {
				this.characters = [...this.characters, new Character(join)];
				next.characters.push(join);
				this.characterNameMap.set(join.id, join.name);
			} else {
				char.update(join);
				next.characters = next.characters.map((c) => c.id === join.id ? join : c);
			}
		}
		if (leave) {
			next.characters = next.characters.filter((c) => c.id !== leave);
			this.characters = this.characters.filter((oc) => oc.data.id !== leave);
		}
		if (update) {
			const char = this.characters.find((oc) => oc.data.id === update.id);
			if (!char) {
				logger.error('Character not found', update);
			} else {
				char.update(update);
				next.characters = next.characters.map((c) => c.id === update.id ? { ...c, ...update } : c);
			}
		}
		this.data.value = { ...next };
		this.emit('load', this.data.value);
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

	public getCharacterSettings(characterId: CharacterId): Readonly<ICharacterPublicSettings> | undefined {
		return this.characters.find((c) => c.data.id === characterId)?.data.settings;
	}

	public getCharacterName(id: CharacterId): string {
		return this.characterNameMap.get(id) ?? '[UNKNOWN]';
	}

	public getCharacterPronoun(_id: CharacterId): string {
		// TODO
		return 'her';
	}

	public onMessage(messages: IChatRoomMessage[], connector?: SocketIOShardConnector): void {
		messages = messages.filter((m) => m.time > this.lastMessageTime);
		for (const message of messages) {
			this.lastMessageTime = Math.max(this.lastMessageTime, message.time);
		}
		connector?.sendMessage('chatRoomMessageAck', {
			lastTime: this.lastMessageTime,
		});
		const processedMessages = messages.map(ProcessMessage);
		this.messages.value = [
			...this.messages.value,
			...processedMessages,
		];
		if (USER_DEBUG && this.data.value) {
			LastRoomChat.value = {
				roomId: this.data.value.id,
				messages: this.messages.value,
			};
		}

		processedMessages.forEach((message) => {
			this.emit('message', message);
		});
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
	'message': IChatroomMessageProcessed;
};

// Debug helper
if (USER_DEBUG) {
	//@ts-expect-error: Development link
	window.Room = Room;
} else {
	// Clear the info that should be saved only in debug mode
	LastRoomChat.value = undefined;
}
