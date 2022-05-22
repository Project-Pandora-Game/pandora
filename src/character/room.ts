import { IChatRoomClientData, IChatRoomMessage, GetLogger, CharacterId, ICharacterPublicData, IChatroomMessageChat, IChatroomMessageAction, IChatroomMessageEmote, AssertNever } from 'pandora-common';
import { ChatActionDictionaryMetaEntry } from 'pandora-common/dist/chatroom/chatActions';
import { NODE_ENV } from '../config/Environment';
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
export type IChatroomMessageEmoteProcessed = IChatroomMessageEmote & {
	fromName: string;
};
export type IChatroomMessageActionProcessed = IChatroomMessageAction;

export type IChatroomMessageProcessed = (IChatroomMessageChatProcessed | IChatroomMessageEmoteProcessed | IChatroomMessageActionProcessed) & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};

function ProcessMessage(message: IChatRoomMessage): IChatroomMessageProcessed {
	if (message.type === 'chat') {
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
	} else if (message.type === 'action') {
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

export const Room = new class Room extends TypedEventEmitter<RoomEvents> {

	public readonly data = new Observable<IChatRoomClientData | null>(null);
	public get loaded(): boolean {
		return this.data.value != null;
	}

	public characters: Character[] = [];

	public readonly messages = new Observable<IChatroomMessageProcessed[]>([]);
	private lastMessageTime: number = 0;

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

	public getCharacterName(id: CharacterId): string {
		const character = this.data.value?.characters.find((c) => c.id === id);
		return character?.name ?? '[UNKNOWN]';
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
if (NODE_ENV === 'development') {
	//@ts-expect-error: Development link
	window.Room = Room;
}
