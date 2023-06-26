import { ITypedEventEmitter, TypedEventEmitter, ActionRoomContext, CharacterId, CharacterRestrictionsManager, ChatRoomFeature, ICharacterRoomData, IChatRoomFullInfo, IChatRoomMessage, IChatRoomStatus, IChatRoomUpdate, IClientMessage, IShardClientArgument, RoomId, ChatTypeSchema, CharacterIdSchema, RoomIdSchema, ZodCast, IsAuthorized, Nullable, IDirectoryAccountInfo, RoomInventory, Logger, ItemPath, Item, AssetFrameworkGlobalStateContainer, AssetFrameworkGlobalState, AssetFrameworkCharacterState, IChatRoomLoad, AssetFrameworkGlobalStateClientBundle } from 'pandora-common';
import { GetLogger } from 'pandora-common';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Character } from '../../character/character';
import { PlayerCharacter } from '../../character/player';
import { Observable, useNullableObservable, useObservable } from '../../observable';
import { ChatParser } from '../chatroom/chatParser';
import { ShardConnectionState, ShardConnector } from '../../networking/shardConnector';
import { BrowserStorage } from '../../browserStorage';
import { NotificationData } from './notificationContextProvider';
import { useShardConnector } from './shardConnectorContextProvider';
import { GetCurrentAssetManager } from '../../assets/assetManager';
import { z } from 'zod';
import { IChatroomMessageProcessed } from '../chatroom/chatroomMessages';

const logger = GetLogger('ChatRoom');

export const MESSAGE_EDIT_TIMEOUT = 1000 * 60 * 10; // 10 minutes

const MessageParseOptionsSchema = z.object({
	editing: z.number().optional(),
	type: ChatTypeSchema.optional(),
	raw: z.boolean().optional(),
	target: CharacterIdSchema.optional(),
});

export type IMessageParseOptions = z.infer<typeof MessageParseOptionsSchema>;

const SavedMessageSchema = z.object({
	text: z.string(),
	time: z.number(),
	options: MessageParseOptionsSchema,
});

export type ISavedMessage = z.infer<typeof SavedMessageSchema>;

export interface IChatRoomMessageSender {
	sendMessage(message: string, options?: IMessageParseOptions): void;
	deleteMessage(deleteId: number): void;
	getMessageEditTimeout(id: number): number | undefined;
	getMessageEdit(id: number): ISavedMessage | undefined;
	getLastMessageEdit(): number | undefined;
}

export type RoomInventoryEvents = {
	globalStateChange: true;
};

export type IChatRoomContext = ITypedEventEmitter<RoomInventoryEvents> & {
	readonly type: 'room';
	readonly globalState: AssetFrameworkGlobalStateContainer;
};

export class ChatRoom extends TypedEventEmitter<RoomInventoryEvents & {
	messageNotify: NotificationData;
}> implements IChatRoomMessageSender, IChatRoomContext {
	public readonly type = 'room';

	public readonly globalState: AssetFrameworkGlobalStateContainer;

	public readonly messages = new Observable<readonly IChatroomMessageProcessed[]>([]);
	public readonly info = new Observable<IChatRoomFullInfo | null>(null);
	public readonly characters = new Observable<readonly Character<ICharacterRoomData>[]>([]);
	public readonly status = new Observable<ReadonlySet<CharacterId>>(new Set<CharacterId>());
	public get player(): PlayerCharacter | null {
		return this._shard.player.value;
	}

	public get playerId() {
		return this.player?.data.id;
	}

	protected readonly logger: Logger;

	private readonly _restore = BrowserStorage.createSession<undefined | {
		roomId: RoomId;
		messages: readonly IChatroomMessageProcessed[];
		sent: [number, ISavedMessage][];
	}>('chatRoomRestore', undefined, z.object({
		roomId: RoomIdSchema,
		messages: z.array(ZodCast<IChatroomMessageProcessed>()),
		sent: z.array(z.tuple([z.number(), SavedMessageSchema])),
	}));

	private _setRestore(roomId?: RoomId): void {
		if (!roomId) {
			if (this.info.value) {
				roomId = this.info.value.id;
			} else {
				return;
			}
		}
		this._restore.value = { roomId, messages: this.messages.value, sent: [...this._sent.entries()] };
	}

	private _lastMessageTime: number = 0;
	private readonly _shard: ShardConnector;

	private _lastMessageId = 0;
	private _getNextMessageId(): number {
		let id = Date.now();
		if (id <= this._lastMessageId) {
			id = this._lastMessageId + 1;
		}
		this._lastMessageId = id;
		return id;
	}

	constructor(shard: ShardConnector) {
		super();
		this.logger = GetLogger('ChatRoom');
		this._shard = shard;

		this.globalState = new AssetFrameworkGlobalStateContainer(GetCurrentAssetManager(), this.logger, () => this.emit('globalStateChange', true));

		setInterval(() => this._cleanupEdits(), MESSAGE_EDIT_TIMEOUT / 2);
	}

	//#region Handler

	public onLoad(data: IChatRoomLoad): void {
		if (!this.player) {
			throw new Error('Cannot update room when player is not loaded');
		}
		const oldInfo = this.info.value;
		if (data.room) {
			const { info, characters } = data.room;
			this.info.value = info;
			if (oldInfo && oldInfo.id !== info.id) {
				logger.debug('Changed room');
				this._onLeave();
			}
			if (oldInfo?.id !== info.id && this._restore.value?.roomId === info.id) {
				this.messages.value = this._restore.value.messages;
				const now = Date.now();
				for (const [id, message] of this._restore.value.sent) {
					if (message.time + MESSAGE_EDIT_TIMEOUT < now) {
						this._sent.set(id, message);
					}
				}
			}
			this._updateCharacters(characters);
			logger.debug('Loaded room data', data);
		} else {
			this.info.value = null;
			logger.debug('Left room');
			this._onLeave();
		}
		this._updateGlobalState(data.globalState);
	}

	public onUpdate(data: IChatRoomUpdate): void {
		if (!this.player) {
			throw new Error('Cannot update room when player is not loaded');
		}
		const { info, globalState, join, leave, characters } = data;
		if (join?.id === this.playerId) {
			return; // Ignore self-join
		}
		if (!this.info.value) {
			logger.error('Cannot update room when it is not loaded');
			return;
		}

		if (info) {
			this.info.value = {
				...this.info.value,
				...info,
			};
		}
		if (join) {
			let char = this.characters.value.find((oc) => oc.data.id === join.id);
			if (!char) {
				this.characters.value = [...this.characters.value, char = new Character(join)];
			} else {
				char.update(join);
				this.characters.value = [...this.characters.value];
			}
		}
		if (leave) {
			this.characters.value = this.characters.value.filter((oc) => oc.data.id !== leave);
			this._status.delete(leave);
		}
		if (characters) {
			for (const [id, characterData] of Object.entries(characters)) {
				const char = this.characters.value.find((oc) => oc.data.id === id);
				if (!char) {
					logger.error('Character not found', id);
				} else {
					char.update(characterData);
					this.characters.value = [...this.characters.value];
				}
			}
		}
		if (globalState) {
			this._updateGlobalState(globalState);
		}
		logger.debug('Updated room data', data);
	}

	private _onLeave() {
		if (!this.player)
			throw new Error('Cannot update room when player is not loaded');

		this.messages.value = [];
		this.characters.value = [this.player];
		this._sent.clear();
		this._setRestore();
	}

	private _updateCharacters(characters: readonly ICharacterRoomData[]): void {
		if (!this.player)
			throw new Error('Cannot update room when player is not loaded');

		const oldCharacters = this.characters.value;
		const playerId = this.playerId;
		this.characters.value = characters.map((c) => {
			let char = c.id === playerId ? this.player : oldCharacters.find((oc) => oc.data.id === c.id);
			if (char) {
				char.update(c);
			} else {
				char = new Character<ICharacterRoomData>(c);
			}
			return char;
		});
	}

	private _updateGlobalState(bundle: AssetFrameworkGlobalStateClientBundle): void {
		if (!bundle.clientOnly) {
			this.logger.error('Received global state update that is not client-only');
		}
		this.globalState.setState(
			AssetFrameworkGlobalState
				.loadFromBundle(GetCurrentAssetManager(), bundle, this.logger.prefixMessages('State bundle load:')),
		);
	}

	public onMessage(incoming: IChatRoomMessage[]): number {
		const roomId = this.info.value?.id;
		if (!roomId) return 0;

		const messages = incoming
			.filter((m) => m.time > this._lastMessageTime)
			.map<IChatRoomMessage & { roomId: RoomId; }>((m) => ({ ...m, roomId }));

		this._lastMessageTime = messages
			.map((m) => m.time)
			.reduce((a, b) => Math.max(a, b), this._lastMessageTime);

		let nextMessages = [...this.messages.value];
		const insertIndexes = new Map<number, number>();

		let notified = false;

		for (const message of messages) {
			if (message.type === 'deleted') {
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
					this.emit('messageNotify', { time: Date.now() });
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

	private _indicatorStatus: IChatRoomStatus = 'none';
	private _indicatorTarget: CharacterId | undefined;

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
		if (this._indicatorStatus !== status || this._indicatorTarget !== target) {
			this._indicatorStatus = status;
			this._indicatorTarget = target;
			this._shard.sendMessage('chatRoomStatus', { status, target });
		}
	}

	public getStatus(id: CharacterId): IChatRoomStatus {
		return this._status.get(id) ?? 'none';
	}

	//#region MessageSender

	private readonly _sent = new Map<number, ISavedMessage>();
	public sendMessage(message: string, options: IMessageParseOptions = {}): void {
		const { editing, type, raw, target } = options;
		if (this._shard.state.value !== ShardConnectionState.CONNECTED) {
			throw new Error('Shard is not connected');
		}
		if (editing !== undefined) {
			const edit = this._sent.get(editing);
			if (!edit || edit.time + MESSAGE_EDIT_TIMEOUT < Date.now()) {
				throw new Error('Message not found');
			}
		}
		if (target !== undefined) {
			if (!this.characters.value.some((c) => c.data.id === target)) {
				throw new Error('Target not found in the room');
			}
			if (target === this.playerId) {
				throw new Error('Cannot send targeted message to yourself');
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
		if (messages.length > 0) {
			this._sent.set(id, {
				text: message,
				time: Date.now(),
				options: { ...options, type, raw },
			});
		}
		if (editing !== undefined) {
			this._sent.delete(editing);
		}
		this._shard.sendMessage('chatRoomMessage', { id, messages, editId: editing });
		this._setRestore();
	}

	public deleteMessage(deleteId: number): void {
		if (this._shard.state.value !== ShardConnectionState.CONNECTED) {
			throw new Error('Shard is not connected');
		}
		const edit = this._sent.get(deleteId);
		if (!edit || edit.time + MESSAGE_EDIT_TIMEOUT < Date.now()) {
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

		return edit.time + MESSAGE_EDIT_TIMEOUT - Date.now();
	}

	public getMessageEdit(id: number): ISavedMessage | undefined {
		const edit = this._sent.get(id);
		if (!edit || edit.time + MESSAGE_EDIT_TIMEOUT < Date.now()) {
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
			if (edit.time + MESSAGE_EDIT_TIMEOUT < now) {
				this._sent.delete(id);
			}
		}
	}

	//#endregion MessageSender
}

export function useChatroom(): ChatRoom | null {
	return useShardConnector()?.room ?? null;
}

export function useChatroomRequired(): ChatRoom {
	const room = useChatroom();
	if (!room) {
		throw new Error('Attempt to access ChatRoom outside of context');
	}
	return room;
}

export function useChatRoomMessageSender(): IChatRoomMessageSender {
	return useChatroomRequired();
}

export function useChatRoomMessages(): readonly IChatroomMessageProcessed[] {
	const context = useChatroomRequired();
	return useObservable(context.messages);
}

export function useChatRoomCharacters(): (readonly Character<ICharacterRoomData>[]) | null {
	const context = useChatroom();
	return useNullableObservable(context?.characters);
}

export function useChatRoomInfo(): IChatRoomFullInfo | null {
	const context = useChatroom();
	return useNullableObservable(context?.info);
}

/**
 * Returns whether character is in a chatroom or not
 * @returns `true` if character is in a room, `false` otherwise
 */
export function useCharacterIsInChatroom(): boolean {
	return useChatRoomInfo() != null;
}

export function useChatRoomFeatures(): ChatRoomFeature[] | null {
	const info = useChatRoomInfo();
	return useMemo(() => info?.features ?? null, [info]);
}

export function useActionRoomContext(): ActionRoomContext | null {
	const info = useChatRoomInfo();
	return useMemo(() => info ? ({
		features: info.features,
	}) : null, [info]);
}

export function useCharacterRestrictionsManager<T>(characterState: AssetFrameworkCharacterState, character: Character, use: (manager: CharacterRestrictionsManager) => T): T {
	const roomContext = useActionRoomContext();
	const manager = useMemo(() => character.getRestrictionManager(characterState, roomContext), [character, characterState, roomContext]);
	return useMemo(() => use(manager), [use, manager]);
}

export function useChatRoomSetPlayerStatus(): (status: IChatRoomStatus, target?: CharacterId) => void {
	const context = useChatroomRequired();
	return useCallback((status: IChatRoomStatus, target?: CharacterId) => context.setPlayerStatus(status, target), [context]);
}

export function useChatRoomStatus(): { data: ICharacterRoomData; status: IChatRoomStatus; }[] {
	const context = useChatroomRequired();
	const characters = useObservable(context.characters);
	const status = useObservable(context.status);
	return useMemo(() => {
		const result: { data: ICharacterRoomData; status: IChatRoomStatus; }[] = [];
		for (const c of characters) {
			if (status.has(c.data.id)) {
				result.push({ data: c.data, status: context.getStatus(c.data.id) });
			}
		}
		return result;
	}, [characters, status, context]);
}

export function useRoomState(context: IChatRoomContext): AssetFrameworkGlobalState {
	return useSyncExternalStore((onChange) => {
		return context.on('globalStateChange', () => {
			onChange();
		});
	}, () => context.globalState.currentState);
}

export function useCharacterState(context: IChatRoomContext, id: CharacterId | null): AssetFrameworkCharacterState | null {
	const globalState = useRoomState(context);

	return useMemo(() => (id != null ? globalState.characters.get(id) ?? null : null), [globalState, id]);
}

export function useRoomInventory(context: IChatRoomContext): RoomInventory | null {
	const state = useRoomState(context);

	return useMemo(() => (state.room ? new RoomInventory(state.room) : null), [state]);
}

export function useRoomInventoryItem(context: IChatRoomContext, item: ItemPath | null | undefined): Item | undefined {
	const roomInventory = useRoomInventory(context);

	return useMemo(() => (item ? roomInventory?.getItem(item) : undefined), [roomInventory, item]);
}

export function useRoomInventoryItems(context: IChatRoomContext): readonly Item[] {
	const roomInventory = useRoomInventory(context);

	return useMemo(() => (roomInventory?.getAllItems() ?? []), [roomInventory]);
}

export function IsChatroomAdmin(data: Nullable<IChatRoomFullInfo>, account: Nullable<Partial<IDirectoryAccountInfo>>): boolean {
	if (!data || !account?.id)
		return false;

	if (data.owners.includes(account.id))
		return true;
	if (data.admin.includes(account.id))
		return true;

	if (data.development?.autoAdmin && IsAuthorized(account.roles, 'developer'))
		return true;

	return false;
}
