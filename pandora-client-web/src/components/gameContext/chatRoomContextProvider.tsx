import type { CharacterId, ICharacterPublicData, IChatRoomClientData, IChatRoomMessage, IChatRoomMessageAction, IChatRoomMessageChat, IChatRoomMessageDeleted, IChatRoomStatus, IChatRoomUpdate, IClientMessage, IShardClientArgument, RoomId } from 'pandora-common';
// TODO: fix this import
import type { ChatActionDictionaryMetaEntry } from 'pandora-common/dist/chatroom/chatActions';
import { GetLogger } from 'pandora-common';
import { useCallback, useContext, useMemo } from 'react';
import { Character } from '../../character/character';
import { PlayerCharacter } from '../../character/player';
import { Observable, useObservable } from '../../observable';
import { ChatParser } from '../chatroom/chatParser';
import { ShardConnectionState, ShardConnector } from '../../networking/shardConnector';
import { BrowserStorage } from '../../browserStorage';
import { NotificationData } from './notificationContextProvider';
import { chatRoomContext } from './stateContextProvider';

const logger = GetLogger('ChatRoom');

const MESSAGE_EDIT_TIMOUT = 1000 * 60 * 10; // 10 minutes

export interface IChatRoomHandler {
	onUpdate(data: IChatRoomUpdate): void;
	onMessage(messages: IChatRoomMessage[]): number;
	onStatus(status: IShardClientArgument['chatRoomStatus']): void;
	setShard(shard: ShardConnector | null): void;
}

export interface IChatRoomMessageSender {
	sendMessage(message: string, options?: IMessageParseOptions): void;
	deleteMessage(deleteId: number): void;
	getMessageEditTimeout(id: number): number | undefined;
	getMessageEdit(id: number): { text: string, target?: CharacterId } | undefined;
	getLastMessageEdit(): number | undefined;
}

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

export type IMessageParseOptions = {
	editing?: number;
	type?: 'chat' | 'ooc' | 'me' | 'emote';
	raw?: true;
	target?: CharacterId;
};

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

export class ChatRoom implements IChatRoomHandler, IChatRoomMessageSender {
	public readonly messages = new Observable<readonly IChatroomMessageProcessed[]>([]);
	public readonly data = new Observable<IChatRoomClientData | null>(null);
	public readonly characters = new Observable<readonly Character[]>([]);
	public readonly status = new Observable<ReadonlySet<CharacterId>>(new Set<CharacterId>());
	private readonly _messageNotify: (data: NotificationData) => void;
	public get player(): PlayerCharacter | null {
		return this._shard?.player.value ?? null;
	}

	get playerId() {
		return this.player?.data.id;
	}

	private readonly _restore = BrowserStorage.createSession<undefined | {
		roomId: RoomId;
		messages: readonly IChatroomMessageProcessed[];
		sent: [number, { text: string; time: number; }][];
	}>('chatRoomRestore', undefined);

	private _setRestore(roomId?: RoomId): void {
		if (!roomId) {
			if (this.data.value) {
				roomId = this.data.value.id;
			} else {
				return;
			}
		}
		this._restore.value = { roomId, messages: this.messages.value, sent: [...this._sent.entries()] };
	}

	private _lastMessageTime: number = 0;
	private _shard: ShardConnector | null = null;

	private _lastMessageId = 0;
	private _getNextMessageId(): number {
		let id = Date.now();
		if (id <= this._lastMessageId) {
			id = this._lastMessageId + 1;
		}
		this._lastMessageId = id;
		return id;
	}

	constructor(messageNotify: (data: NotificationData) => void) {
		this._messageNotify = messageNotify;
		setInterval(() => this._cleanupEdits(), MESSAGE_EDIT_TIMOUT / 2);
	}

	//#region Handler

	public onUpdate(data: IChatRoomUpdate): void {
		if (!this.player) {
			throw new Error('Cannot update room when player is not loaded');
		}
		const oldData = this.data.value;
		if ('room' in data) {
			const room = data.room;
			this.data.value = room;
			if (room) {
				if (oldData && oldData.id !== room.id) {
					logger.debug('Changed room');
					this._onLeave();
				}
				if (oldData?.id !== room.id && this._restore.value?.roomId === room.id) {
					if (this._restore.value?.roomId === room.id) {
						this.messages.value = this._restore.value.messages;
						const now = Date.now();
						for (const [id, message] of this._restore.value.sent) {
							if (message.time + MESSAGE_EDIT_TIMOUT < now) {
								this._sent.set(id, message);
							}
						}
					} else {
						this.messages.value = [];
						this._sent.clear();
						this._setRestore(room.id);
					}
				}
				this._updateCharacters(room.characters);
				logger.debug('Loaded room data', data);
			} else {
				logger.debug('Left room');
				this._onLeave();
			}
			return;
		}
		const { info, join, leave, update } = data;
		if (join?.id === this.playerId) {
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
			let char = this.characters.value.find((oc) => oc.data.id === join.id);
			if (!char) {
				this.characters.value = [...this.characters.value, char = new Character(join)];
				next.characters.push(join);
			} else {
				char.update(join);
				next.characters = next.characters.map((c) => c.id === join.id ? join : c);
				this.characters.value = [...this.characters.value];
			}
		}
		if (leave) {
			next.characters = next.characters.filter((c) => c.id !== leave);
			this.characters.value = this.characters.value.filter((oc) => oc.data.id !== leave);
			this._status.delete(leave);
		}
		if (update) {
			const char = this.characters.value.find((oc) => oc.data.id === update.id);
			if (!char) {
				logger.error('Character not found', update);
			} else {
				char.update(update);
				next.characters = next.characters.map((c) => c.id === update.id ? { ...c, ...update } : c);
				this.characters.value = [...this.characters.value];
			}
		}
		this.data.value = { ...next };
		logger.debug('Updated room data', data);
	}

	private _onLeave() {
		this.messages.value = [];
		this._sent.clear();
		this._setRestore();
	}

	private _updateCharacters(characters: readonly ICharacterPublicData[]): void {
		if (!this.player)
			throw new Error('Cannot update room when player is not loaded');

		const oldCharacters = this.characters.value;
		const playerId = this.playerId;
		this.characters.value = characters.map((c) => {
			let char = c.id === playerId ? this.player : oldCharacters.find((oc) => oc.data.id === c.id);
			if (char) {
				char.update(c);
			} else {
				char = new Character(c);
			}
			return char;
		});
	}

	public onMessage(messages: IChatRoomMessage[]): number {
		messages = messages.filter((m) => m.time > this._lastMessageTime);
		this._lastMessageTime = messages
			.map((m) => m.time)
			.reduce((a, b) => Math.max(a, b), this._lastMessageTime);

		let nextMessages = [...this.messages.value];
		const insertIndexes = new Map<number, number>();

		let notified = false;

		for (const message of messages) {
			if (!IsUserMessage(message)) {
				nextMessages.push(ProcessMessage(message));
				if (!notified) {
					this._messageNotify({ time: Date.now() });
					notified = true;
				}
			} else if (message.type === 'deleted') {
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
				if (!notified) {
					this._messageNotify({ time: Date.now() });
					notified = true;
				}
			}
		}
		this.messages.value = nextMessages;
		this._setRestore();

		return this._lastMessageTime;
	}

	private readonly _status = new Map<CharacterId, IChatRoomStatus>();
	public onStatus({ id, status }: IShardClientArgument['chatRoomStatus']): void {
		if (id === this.playerId)
			return;

		if (this._status.get(id) !== status) {
			this._status.set(id, status);
			const chars = new Set([...this.status.value]);
			if (status === 'none') {
				chars.delete(id);
			} else {
				chars.add(id);
			}
			this.status.value = chars;
		}
	}

	//#endregion Handler

	public setPlayerStatus(status: IChatRoomStatus, target?: CharacterId): void {
		const id = this.playerId;
		if (id && this._status.get(id) !== status) {
			this._status.set(id, status);
			const chars = new Set([...this.status.value]);
			if (status === 'none') {
				chars.delete(id);
			} else {
				chars.add(id);
			}
			this.status.value = chars;
		}
		this._shard?.sendMessage('chatRoomStatus', { status, target });
	}

	public getStatus(id: CharacterId): IChatRoomStatus {
		return this._status.get(id) ?? 'none';
	}

	//#region MessageSender

	private readonly _sent = new Map<number, { text: string; time: number; target?: CharacterId }>();
	public sendMessage(message: string, { editing, type, raw, target }: IMessageParseOptions = {}): void {
		if (this._shard?.state.value !== ShardConnectionState.CONNECTED) {
			throw new Error('Shard is not connected');
		}
		if (editing !== undefined) {
			const edit = this._sent.get(editing);
			if (!edit || edit.time + MESSAGE_EDIT_TIMOUT < Date.now()) {
				throw new Error('Message not found');
			}
		}
		if (target === undefined) {
			if (!this.characters.value.find((c) => c.data.id === this.playerId)) {
				throw new Error('Target not in room');
			}
			if (target === this.playerId) {
				throw new Error('Target is self');
			}
			if (type === 'me' || type === 'emote') {
				throw new Error('Emote and me messages cannot be sent to a specific target');
			}
		}
		let messages: IClientMessage[] = [];
		if (type !== undefined) {
			messages = [{ type, parts: raw ? [['normal', message]] : ChatParser.parseStyle(message), to: target }];
		} else if (raw) {
			throw new Error('Raw is not implemented for multi-part messages');
		} else {
			messages = ChatParser.parse(message, target);
		}
		const id = this._getNextMessageId();
		this._sent.set(id, { text: message, time: Date.now(), target });
		if (editing !== undefined) {
			this._sent.delete(editing);
			this._shard.sendMessage('chatRoomMessage', { id, messages, editId: editing });
		}
		this._shard.sendMessage('chatRoomMessage', { id, messages });
		this._setRestore();
	}

	public deleteMessage(deleteId: number): void {
		if (this._shard?.state.value !== ShardConnectionState.CONNECTED) {
			throw new Error('Shard is not connected');
		}
		const edit = this._sent.get(deleteId);
		if (!edit || edit.time + MESSAGE_EDIT_TIMOUT < Date.now()) {
			throw new Error('Message not found');
		}
		this._sent.delete(deleteId);
		const id = this._getNextMessageId();
		this._shard.sendMessage('chatRoomMessage', { id, messages: [], editId: deleteId });
		this._setRestore();
	}

	public getMessageEditTimeout(id: number): number | undefined {
		const edit = this._sent.get(id);
		if (!edit)
			return undefined;

		return edit.time + MESSAGE_EDIT_TIMOUT - Date.now();
	}

	public getMessageEdit(id: number): { text: string, target?: CharacterId } | undefined {
		const edit = this._sent.get(id);
		if (!edit || edit.time + MESSAGE_EDIT_TIMOUT < Date.now()) {
			return undefined;
		}

		return edit;
	}

	public getLastMessageEdit(): number | undefined {
		const last = [...this._sent.entries()]
			.sort((a, b) => a[1].time - b[1].time)
			.pop();

		if (!last)
			return undefined;

		return last[0];
	}

	private _cleanupEdits(): void {
		const now = Date.now();
		for (const [id, edit] of this._sent) {
			if (edit.time + MESSAGE_EDIT_TIMOUT < now) {
				this._sent.delete(id);
			}
		}
	}

	//#endregion MessageSender

	public setShard(shard: ShardConnector | null): void {
		this._shard = shard;
	}
}

function useChatroom(): ChatRoom {
	const room = useContext(chatRoomContext);
	if (!room) {
		throw new Error('Attempt to access ChatRoom outside of context');
	}
	return room;
}

export function useChatRoomHandler(): IChatRoomHandler {
	return useChatroom();
}

export function useChatRoomMessageSender(): IChatRoomMessageSender {
	return useChatroom();
}

export function useChatRoomMessages(): readonly IChatroomMessageProcessed[] {
	const context = useChatroom();
	return useObservable(context.messages);
}

export function useChatRoomCharacters(): readonly Character[] {
	const context = useChatroom();
	return useObservable(context.characters);
}

export function useChatRoomData(): IChatRoomClientData | null {
	const context = useChatroom();
	return useObservable(context.data);
}

export function useChatRoomSetPlayerStatus(): (status: IChatRoomStatus, target?: CharacterId) => void {
	const context = useChatroom();
	return useCallback((status: IChatRoomStatus) => context.setPlayerStatus(status), [context]);
}

export function useChatRoomStatus(): { data: ICharacterPublicData, status: IChatRoomStatus }[] {
	const context = useChatroom();
	const characters = useObservable(context.characters);
	const status = useObservable(context.status);
	return useMemo(() => {
		const result: { data: ICharacterPublicData, status: IChatRoomStatus }[] = [];
		for (const c of characters) {
			if (status.has(c.data.id)) {
				result.push({ data: c.data, status: context.getStatus(c.data.id) });
			}
		}
		return result;
	}, [characters, status, context]);
}
