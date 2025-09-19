import { freeze, Immutable } from 'immer';
import { isEqual, noop } from 'lodash-es';
import {
	ActionSpaceContext,
	AssertNever,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkGlobalStateClientBundle,
	AssetFrameworkGlobalStateContainer,
	CharacterId,
	CharacterIdSchema,
	CharacterRestrictionsManager,
	ChatCharacterStatus,
	ChatTypeSchema,
	CloneDeepMutable,
	EMPTY_ARRAY,
	GameStateUpdate,
	GetLogger,
	ICharacterPrivateData,
	ICharacterRoomData,
	IChatMessage,
	IClientMessage,
	IDirectoryAccountInfo,
	IsAuthorized,
	IShardClientArgument,
	Item,
	ItemPath,
	KnownObject,
	LIMIT_CHAT_MESSAGE_LENGTH,
	Logger,
	MakePermissionConfigFromDefault,
	Nullable,
	PermissionConfig,
	PermissionGroup,
	PermissionSetup,
	SpaceClientInfo,
	SpaceFeature,
	SpaceId,
	SpaceIdSchema,
	TypedEventEmitter,
	ZodCast,
	type AccountId,
	type ActionRoomSelector,
	type ActionTargetSelector,
	type AppearanceAction,
	type AssetFrameworkGlobalStateClientDeltaBundle,
	type CurrentSpaceInfo,
	type IClientShardPromiseResult,
	type ItemContainerPath,
	type ItemId,
	type RoomId,
	type SpaceCharacterModifierEffectData,
} from 'pandora-common';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import * as z from 'zod';
import { GetCurrentAssetManager } from '../../assets/assetManager.tsx';
import { BrowserStorage } from '../../browserStorage.ts';
import { Character, useCharacterDataOptional } from '../../character/character.ts';
import { PlayerCharacter } from '../../character/player.ts';
import { ShardConnector } from '../../networking/shardConnector.ts';
import { Observable, useNullableObservable, useObservable, type ReadonlyObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { GetAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { RenderChatMessageToString } from '../../ui/components/chat/chat.tsx';
import { IChatMessageProcessed, type ChatMessageProcessedRoomData } from '../../ui/components/chat/chatMessages.tsx';
import { ChatParser } from '../../ui/components/chat/chatParser.ts';
import { useAccountContacts } from '../accountContacts/accountContactContext.ts';
import { useShardConnector } from './shardConnectorContextProvider.tsx';

const logger = GetLogger('GameState');

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

export interface IChatMessageSender {
	sendMessage(message: string, options?: IMessageParseOptions): void;
	deleteMessage(deleteId: number): void;
	getMessageEditTimeout(id: number): number | undefined;
	getMessageEdit(id: number): ISavedMessage | undefined;
	getLastMessageEdit(): number | undefined;
}

export type PermissionPromptData = {
	source: Character<ICharacterRoomData>;
	requiredPermissions: Immutable<Partial<Record<PermissionGroup, [PermissionSetup, PermissionConfig][]>>>;
	actions: AppearanceAction[];
};

export class ChatSendError extends Error {
	public readonly reason: string;

	constructor(reason: string) {
		super(reason);
		this.reason = reason;
	}
}

export class GameState extends TypedEventEmitter<{
	globalStateChange: true;
	permissionPrompt: PermissionPromptData;
	/** Request for navigating to some URL. Used by notification click mechanism to show chat. */
	uiNavigate: string;
}> implements IChatMessageSender {
	public readonly globalState: AssetFrameworkGlobalStateContainer;

	public readonly messages = new Observable<readonly IChatMessageProcessed[]>([]);
	public readonly currentSpace: Observable<CurrentSpaceInfo>;
	public readonly characters: Observable<readonly Character<ICharacterRoomData>[]>;
	public readonly characterModifierEffects: Observable<Immutable<SpaceCharacterModifierEffectData>>;
	public readonly player: PlayerCharacter;

	public get playerId() {
		return this.player?.data.id;
	}

	protected readonly logger: Logger;

	private readonly _restore = BrowserStorage.createSession('chatRestore', undefined, z.object({
		spaceId: SpaceIdSchema.nullable(),
		messages: z.array(ZodCast<IChatMessageProcessed>()),
		sent: z.array(z.tuple([z.number(), SavedMessageSchema])),
	}).optional());

	private _setRestore(): void {
		const spaceId = this.currentSpace.value.id;
		this._restore.value = {
			spaceId,
			messages: CloneDeepMutable(this.messages.value),
			sent: [...this._sent.entries()],
		};
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

	constructor(shard: ShardConnector, characterData: ICharacterPrivateData & ICharacterRoomData, { globalState, space }: IShardClientArgument['gameStateLoad']) {
		super();
		this.logger = GetLogger('GameState');
		this._shard = shard;
		this.player = new PlayerCharacter(characterData);
		this.characters = new Observable<readonly Character<ICharacterRoomData>[]>([this.player]);

		const { id, info, characters, characterModifierEffects } = space;
		this.currentSpace = new Observable<CurrentSpaceInfo>({
			id,
			config: info,
		});
		if (this._restore.value?.spaceId === id) {
			this.messages.value = this._restore.value.messages;
			const now = Date.now();
			for (const [messageId, message] of this._restore.value.sent) {
				if (message.time + MESSAGE_EDIT_TIMEOUT < now) {
					this._sent.set(messageId, message);
				}
			}
		}

		const loadedGlobalState = AssetFrameworkGlobalState
			.loadFromBundle(GetCurrentAssetManager(), globalState, id, this.logger.prefixMessages('State bundle load:'));

		this.globalState = new AssetFrameworkGlobalStateContainer(
			this.logger,
			() => this.emit('globalStateChange', true),
			loadedGlobalState,
		);

		this._updateCharacters(characters);

		this.characterModifierEffects = new Observable<Immutable<SpaceCharacterModifierEffectData>>(freeze(characterModifierEffects, true));

		setInterval(() => this._cleanupEdits(), MESSAGE_EDIT_TIMEOUT / 2);
	}

	public async doImmediateAction(action: Immutable<AppearanceAction>): IClientShardPromiseResult['gameLogicAction'] {
		return await this._shard.awaitResponse('gameLogicAction', {
			operation: 'doImmediately',
			action: CloneDeepMutable(action),
		});
	}

	public async startActionAttempt(action: Immutable<AppearanceAction>): IClientShardPromiseResult['gameLogicAction'] {
		return await this._shard.awaitResponse('gameLogicAction', {
			operation: 'start',
			action: CloneDeepMutable(action),
		});
	}

	public async completeCurrentActionAttempt(): IClientShardPromiseResult['gameLogicAction'] {
		return await this._shard.awaitResponse('gameLogicAction', {
			operation: 'complete',
		});
	}

	public async abortCurrentActionAttempt(): IClientShardPromiseResult['gameLogicAction'] {
		return await this._shard.awaitResponse('gameLogicAction', {
			operation: 'abortCurrentAction',
		});
	}

	public getCurrentSpaceContext(): ActionSpaceContext {
		return MakeActionSpaceContext(
			this.currentSpace.value,
			this._shard.serviceDeps.accountManager.currentAccount.value,
			this.characterModifierEffects.value,
		);
	}

	//#region Handler

	public onLoad(data: IShardClientArgument['gameStateLoad']): void {
		const oldSpace = this.currentSpace.value;
		const { id, info, characters, characterModifierEffects, chatStatus } = data.space;
		this.currentSpace.value = {
			id,
			config: info,
		};
		if (oldSpace.id !== id) {
			logger.debug('Changed space');
			this._onSpaceChange();
		}
		if (oldSpace.id !== id && this._restore.value?.spaceId === id) {
			this.messages.value = this._restore.value.messages;
			const now = Date.now();
			for (const [messageId, message] of this._restore.value.sent) {
				if (message.time + MESSAGE_EDIT_TIMEOUT < now) {
					this._sent.set(messageId, message);
				}
			}
		}
		this._updateCharacters(characters);
		// Update chat typing status
		{
			const playerStatus = this._status.value.get(this.playerId);
			const newStatus = new Map<CharacterId, ChatCharacterStatus>();
			for (const c of characters) {
				const status = chatStatus[c.id];
				if (status != null && status !== 'none' && c.id !== this.playerId) {
					newStatus.set(c.id, status);
				}
			}
			if (playerStatus != null) {
				newStatus.set(this.playerId, playerStatus);
			}
			this._status.value = newStatus;
			// Always send our current typing status right after reconnect,
			// as server can clear it itself
			if (this._indicatorStatus !== 'none') {
				queueMicrotask(() => {
					this._shard.sendMessage('chatStatus', { status: this._indicatorStatus, target: this._indicatorTarget });
				});
			}
		}
		logger.debug('Loaded data', data);
		this._updateGlobalState(id, data.globalState);
		this.characterModifierEffects.value = freeze(characterModifierEffects, true);
	}

	public onUpdate(data: GameStateUpdate): void {
		if (!this.player) {
			throw new Error('Cannot update room when player is not loaded');
		}
		const { info, globalState, join, leave, characters, characterModifierEffects } = data;
		if (join?.id === this.playerId) {
			return; // Ignore self-join
		}

		if (info) {
			this.currentSpace.produce((oldValue) => {
				return {
					...oldValue,
					config: {
						...oldValue.config,
						...info,
					},
				};
			});
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
			this._status.produceImmer((s) => {
				s.delete(leave);
			});
		}
		if (characters) {
			for (const [id, characterData] of Object.entries(characters)) {
				if (characterData == null)
					continue;
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
			this._updateGlobalStateDelta(globalState);
		}
		if (characterModifierEffects != null) {
			freeze(characterModifierEffects, true);
			this.characterModifierEffects.produceImmer((d) => {
				for (const [k, v] of KnownObject.entries(characterModifierEffects)) {
					if (v == null) {
						delete d[k];
					} else {
						d[k] = v;
					}
				}
			});
		}
		logger.debug('Updated data', data);
	}

	private _onSpaceChange() {
		this.messages.value = [];
		this.characters.value = [this.player];
		this._status.value = new Map();
		this._sent.clear();
		this._setRestore();
	}

	private _updateCharacters(characters: readonly ICharacterRoomData[]): void {
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
		this._status.produceImmer((s) => {
			for (const k of Array.from(s.keys())) {
				if (k !== playerId && !characters.some((c) => c.id === k)) {
					s.delete(k);
				}
			}
		});
	}

	private _updateGlobalState(spaceId: SpaceId | null, bundle: AssetFrameworkGlobalStateClientBundle): void {
		if (!bundle.clientOnly) {
			this.logger.error('Received global state update that is not client-only');
		}
		this.globalState.setState(
			AssetFrameworkGlobalState
				.loadFromBundle(GetCurrentAssetManager(), bundle, spaceId, this.logger.prefixMessages('State bundle load:')),
		);
	}

	private _updateGlobalStateDelta(bundle: AssetFrameworkGlobalStateClientDeltaBundle): void {
		this.globalState.setState(
			this.globalState.currentState.applyClientDeltaBundle(bundle, this.logger.prefixMessages('State bundle delta update:')),
		);
	}

	public onMessage(incoming: IChatMessage[]): number {
		const spaceId = this.currentSpace.value.id;
		const roomId = this.player.getAppearance(this.globalState.currentState).characterState.currentRoom;

		const processRoom = (id: RoomId): ChatMessageProcessedRoomData => ({
			id,
			name: this.globalState.currentState.space.getRoom(id)?.displayName ?? id,
		});

		const messages = incoming
			.filter((m) => m.time > this._lastMessageTime)
			.map((m): IChatMessageProcessed => {
				switch (m.type) {
					case 'chat':
					case 'ooc':
					case 'me':
					case 'emote':
						return ({ ...m, spaceId, roomData: processRoom(m.room), receivedRoomId: roomId });
					case 'action':
					case 'serverMessage':
						return ({ ...m, spaceId, roomsData: m.rooms?.map(processRoom) ?? null, receivedRoomId: roomId });
					case 'deleted':
						return ({ ...m, spaceId, receivedRoomId: roomId });
				}
				AssertNever(m);
			});

		this._lastMessageTime = messages
			.map((m) => m.time)
			.reduce((a, b) => Math.max(a, b), this._lastMessageTime);

		let nextMessages = [...this.messages.value];
		const insertIndexes = new Map<number, number>();

		for (const message of messages) {
			if (message.type === 'deleted') {
				let found = false;
				const acc: IChatMessageProcessed[] = [];
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
				const { accountManager, notificationHandler } = this._shard.serviceDeps;
				//#region Notifications
				try {
					const messageContent = RenderChatMessageToString(message, GetAccountSettings(accountManager));
					const showChat = () => {
						this.emit('uiNavigate', '/room');
					};
					if (message.type === 'chat') {
						if (message.from.id !== this.player.id) {
							notificationHandler.notify({
								type: message.to != null ? 'chatMessagesWhisper' : 'chatMessagesMessage',
								metadata: {
									from: message.from.id,
								},
								time: message.time,
								title: `Chat message from ${message.from.name} (${message.from.id})`,
								content: messageContent,
								onClick: showChat,
							});
						}
					} else if (message.type === 'me' || message.type === 'emote') {
						if (message.from.id !== this.player.id) {
							notificationHandler.notify({
								type: 'chatMessagesEmote',
								metadata: {
									from: message.from.id,
								},
								time: message.time,
								title: `Chat message from ${message.from.name} (${message.from.id})`,
								content: messageContent,
								onClick: showChat,
							});
						}
					} else if (message.type === 'ooc') {
						if (message.from.id !== this.player.id) {
							notificationHandler.notify({
								type: message.to != null ? 'chatMessagesOOCWhisper' : 'chatMessagesOOC',
								metadata: {
									from: message.from.id,
								},
								time: message.time,
								title: `OOC Chat message from ${message.from.name} (${message.from.id})`,
								content: messageContent,
								onClick: showChat,
							});
						}
					} else if (message.type === 'action') {
						if (message.data?.character?.id == null || message.data.character.id !== this.player.id) {
							notificationHandler.notify({
								type: 'chatMessagesAction',
								metadata: {
									from: message.data?.character?.id ?? null,
									action: message.id,
								},
								time: message.time,
								title: message.data?.character != null ? `Action from ${message.data.character.name} (${message.data.character.id})` : 'Action',
								content: messageContent,
								onClick: showChat,
							});
						}
					} else if (message.type === 'serverMessage') {
						if (message.id === 'characterEntered' && message.data?.character?.type === 'character') {
							if (message.data.character.id !== this.playerId) {
								notificationHandler.notify({
									type: 'spaceCharacterJoined',
									metadata: {
										id: message.data.character.id,
									},
									time: message.time,
									title: `${message.data.character.name} (${message.data.character.id}) joined the space`,
									onClick: showChat,
								});
							}
						} else {
							if (message.data?.character?.id == null || message.data.character.id !== this.player.id) {
								notificationHandler.notify({
									type: 'chatMessagesServer',
									metadata: {
										from: message.data?.character?.id ?? null,
										action: message.id,
									},
									time: message.time,
									title: 'Server message',
									content: messageContent,
									onClick: showChat,
								});
							}
						}
					}
				} catch (e) {
					this.logger.error('Error delivering message notification:', e, '\nFor message:', message);
				}
				//#endregion

				// Action messages can get deduplicated
				let skip = false;
				if (message.type === 'action' && nextMessages.length > 0) {
					const lastMessage = nextMessages[nextMessages.length - 1];
					if (
						lastMessage.type === 'action' &&
						lastMessage.id === message.id &&
						lastMessage.customText === message.customText &&
						isEqual(lastMessage.sendTo, message.sendTo) &&
						isEqual(lastMessage.data, message.data) &&
						isEqual(lastMessage.dictionary, message.dictionary)
					) {
						nextMessages[nextMessages.length - 1] = {
							...lastMessage,
							repetitions: (lastMessage.repetitions ?? 1) + 1,
						};
						skip = true;
					}
				}

				// Add the message to chat
				if (!skip) {
					nextMessages.push(message);
				}
			}
		}
		this.messages.value = nextMessages;
		this._setRestore();

		return this._lastMessageTime;
	}

	private readonly _status = new Observable<ReadonlyMap<CharacterId, ChatCharacterStatus>>(new Map());
	public get status(): ReadonlyObservable<ReadonlyMap<CharacterId, ChatCharacterStatus>> {
		return this._status;
	}

	public onStatus({ id, status }: IShardClientArgument['chatCharacterStatus']): void {
		if (id === this.playerId)
			return;

		if (this._status.value.get(id) !== status) {
			this._status.produceImmer((s) => {
				s.set(id, status);
			});
		}
	}

	public onPermissionPrompt({ characterId, requiredPermissions, actions }: IShardClientArgument['permissionPrompt']): void {
		const source = this.characters.value.find((c) => c.data.id === characterId);
		if (!source) {
			this.logger.warning('Permission prompt for unknown character', characterId);
			return;
		}

		const groups: Partial<Record<PermissionGroup, [PermissionSetup, PermissionConfig][]>> = {};
		for (const [setup, config] of requiredPermissions) {
			const group = groups[setup.group] ??= [];
			group.push([setup, config ?? MakePermissionConfigFromDefault(setup.defaultConfig)]);
		}
		if (Object.keys(groups).length === 0) {
			logger.warning('Permission prompt for no permissions');
			return;
		}

		this.emit('permissionPrompt', {
			source,
			requiredPermissions: groups,
			actions,
		});
	}

	//#endregion Handler

	//#region Typing indicator

	private _indicatorStatus: ChatCharacterStatus = 'none';
	private _indicatorTarget: CharacterId | undefined;

	public setPlayerStatus(status: ChatCharacterStatus, target?: CharacterId): void {
		const id = this.playerId;
		if (id && this._status.value.get(id) !== status) {
			this._status.produceImmer((s) => {
				s.set(id, status);
			});
		}
		if (this._indicatorStatus !== status || this._indicatorTarget !== target) {
			this._indicatorStatus = status;
			this._indicatorTarget = target;
			this._shard.sendMessage('chatStatus', { status, target });
		}
	}

	//#endregion

	//#region MessageSender

	private readonly _sent = new Map<number, ISavedMessage>();
	public sendMessage(message: string, options: IMessageParseOptions = {}): void {
		const { editing, type, raw, target } = options;
		if (editing !== undefined) {
			const edit = this._sent.get(editing);
			if (!edit || edit.time + MESSAGE_EDIT_TIMEOUT < Date.now()) {
				throw new ChatSendError('Message not found');
			}
		}
		if (target !== undefined) {
			if (!this.characters.value.some((c) => c.data.id === target)) {
				throw new ChatSendError('Target not found in the room');
			}
			if (target === this.playerId) {
				throw new ChatSendError('Cannot send targeted message to yourself');
			}
			if (type === 'me' || type === 'emote') {
				throw new ChatSendError('Emote and me messages cannot be sent to a specific target');
			}
		}
		if (message.length > LIMIT_CHAT_MESSAGE_LENGTH) {
			throw new ChatSendError(`Message must not be longer than ${LIMIT_CHAT_MESSAGE_LENGTH} characters (currently: ${message.length})`);
		}
		let messages: IClientMessage[] = [];
		if (type !== undefined) {
			messages = [{ type, parts: raw ? [['normal', message]] : ChatParser.parseStyle(message, type === 'ooc'), to: target }];
		} else if (raw) {
			throw new ChatSendError('Raw is not implemented for multi-part messages');
		} else {
			messages = ChatParser.parse(message, target);
		}
		// Test restrictions
		{
			const restrictionManager = this.player.getRestrictionManager(
				this.globalState.currentState,
				this.getCurrentSpaceContext(),
			);
			for (const checkMessage of messages) {
				const blockCheck = restrictionManager.checkChatMessage(checkMessage);
				if (blockCheck.result !== 'ok') {
					throw new ChatSendError(blockCheck.reason);
				}
			}
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
		this._shard.awaitResponse('chatMessage', { id, messages, editId: editing })
			.then((result) => {
				if (result.result !== 'ok') {
					toast('Failed to send message:\n' + result.reason, TOAST_OPTIONS_ERROR);
				}
			}, (error) => {
				this.logger.error('Error sending chat message:', error);
				toast('Error while sending chat message', TOAST_OPTIONS_ERROR);
			});
		this._setRestore();
	}

	public deleteMessage(deleteId: number): void {
		const edit = this._sent.get(deleteId);
		if (!edit || edit.time + MESSAGE_EDIT_TIMEOUT < Date.now()) {
			throw new ChatSendError('Message not found');
		}
		this._sent.delete(deleteId);
		const id = this._getNextMessageId();
		this._shard.awaitResponse('chatMessage', { id, messages: [], editId: deleteId })
			.then((result) => {
				if (result.result !== 'ok') {
					toast('Failed to delete message:\n' + result.reason, TOAST_OPTIONS_ERROR);
				}
			}, (error) => {
				this.logger.error('Error deleting chat message:', error);
				toast('Error while deleting chat message', TOAST_OPTIONS_ERROR);
			});
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

export function useGameStateOptional(): GameState | null {
	return useNullableObservable(useShardConnector()?.gameState);
}

export function useGameState(): GameState {
	const gameState = useGameStateOptional();
	if (!gameState) {
		throw new Error('Attempt to access GameState outside of context');
	}
	return gameState;
}

export function useChatMessageSender(): IChatMessageSender {
	return useGameState();
}

export function useChatMessages(): readonly IChatMessageProcessed[] {
	const context = useGameState();
	return useObservable(context.messages);
}

export function useSpaceCharacters(): readonly Character<ICharacterRoomData>[] {
	const context = useGameStateOptional();
	return useNullableObservable(context?.characters) ?? EMPTY_ARRAY;
}

export function useResolveCharacterName(characterId: CharacterId): string | null {
	// Look through space characters to see if we find matching one
	const characters = useSpaceCharacters();
	const character = characters.find((c) => c.id === characterId);

	const data = useCharacterDataOptional(character ?? null);

	return (data != null) ? data.name : null;
}

export function useResolveAccountName(accountId: AccountId): string | null {
	const currentAccount = useCurrentAccount();

	// Look through contacts
	const contacts = useAccountContacts(null);
	const contact = contacts.find((a) => a.id === accountId);

	// Look through space characters to see if we find character of this account
	const characters = useSpaceCharacters();
	const character = characters.find((c) => c.data.accountId === accountId);
	const characterData = useCharacterDataOptional(character ?? null);

	if (accountId === 0) {
		return '[[Pandora]]';
	} else if (currentAccount?.id === accountId) {
		return currentAccount.displayName;
	} else if (contact != null) {
		return contact.displayName;
	} else if (characterData != null) {
		return characterData.accountDisplayName;
	}

	return null;
}

export function useSpaceInfo(): Immutable<CurrentSpaceInfo> {
	const context = useGameState();
	return useObservable(context.currentSpace);
}

export function useSpaceInfoOptional(): Immutable<CurrentSpaceInfo> | null {
	const context = useGameStateOptional();
	return useNullableObservable(context?.currentSpace);
}

export function useSpaceFeatures(): readonly SpaceFeature[] {
	const info = useSpaceInfo();
	return info.config.features;
}

export function MakeActionSpaceContext(
	spaceInfo: CurrentSpaceInfo,
	playerAccount: IDirectoryAccountInfo | null,
	playerModifierEffects: Immutable<SpaceCharacterModifierEffectData>,
): ActionSpaceContext {
	return {
		features: spaceInfo.config.features,
		isAdmin: (accountId) => {
			if (accountId === playerAccount?.id) {
				return IsSpaceAdmin(spaceInfo.config, playerAccount);
			}
			return IsSpaceAdmin(spaceInfo.config, { id: accountId });
		},
		development: spaceInfo.config.development,
		getCharacterModifierEffects: (characterId) => {
			return playerModifierEffects[characterId] ?? EMPTY_ARRAY;
		},
	};
}

export function useActionSpaceContext(): ActionSpaceContext {
	const context = useGameState();
	const info = useObservable(context.currentSpace);
	const characterModifierEffects = useObservable(context.characterModifierEffects);
	const playerAccount = useCurrentAccount();
	return useMemo((): ActionSpaceContext => (MakeActionSpaceContext(info, playerAccount, characterModifierEffects)), [info, playerAccount, characterModifierEffects]);
}

export function useCharacterRestrictionsManager<T>(globalState: AssetFrameworkGlobalState, character: Character, use: (manager: CharacterRestrictionsManager) => T): T {
	const spaceContext = useActionSpaceContext();
	const manager = useMemo(() => character.getRestrictionManager(globalState, spaceContext), [character, globalState, spaceContext]);
	return useMemo(() => use(manager), [use, manager]);
}

export function useChatSetPlayerStatus(): (status: ChatCharacterStatus, target?: CharacterId) => void {
	const gameState = useGameState();
	return useCallback((status: ChatCharacterStatus, target?: CharacterId) => gameState.setPlayerStatus(status, target), [gameState]);
}

export function useChatCharacterStatus(): { data: ICharacterRoomData; status: ChatCharacterStatus; }[] {
	const gameState = useGameState();
	const characters = useObservable(gameState.characters);
	const status = useObservable(gameState.status);
	return useMemo(() => {
		const result: { data: ICharacterRoomData; status: ChatCharacterStatus; }[] = [];
		for (const c of characters) {
			const s = status.get(c.id);
			if (s != null && s !== 'none') {
				result.push({ data: c.data, status: s });
			}
		}
		return result;
	}, [characters, status]);
}

export function useGlobalState(context: GameState): AssetFrameworkGlobalState;
export function useGlobalState(context: GameState | null): AssetFrameworkGlobalState | null;
export function useGlobalState(context: GameState | null): AssetFrameworkGlobalState | null {
	return useSyncExternalStore((onChange) => {
		if (context == null)
			return noop;

		return context.on('globalStateChange', () => {
			onChange();
		});
	}, () => (context?.globalState.currentState ?? null));
}

export function useCharacterState(globalState: AssetFrameworkGlobalState, id: CharacterId | null): AssetFrameworkCharacterState | null {
	return useMemo(() => (id != null ? globalState.characters.get(id) ?? null : null), [globalState, id]);
}

export type FindItemResultEntry = {
	item: Item;
	target: ActionTargetSelector;
	path: ItemPath;
	room: ActionRoomSelector;
};
export type FindItemResult = readonly Readonly<FindItemResultEntry>[];
const FindItemByIdCache = new WeakMap<AssetFrameworkGlobalState, Map<ItemId, FindItemResult>>();
export function FindItemById(globalState: AssetFrameworkGlobalState, id: ItemId): FindItemResult {
	let cache = FindItemByIdCache.get(globalState);
	if (cache == null) {
		cache = new Map();
		FindItemByIdCache.set(globalState, cache);
	}

	const cachedResult = cache.get(id);
	if (cachedResult != null) {
		return cachedResult;
	}
	const result: Readonly<FindItemResultEntry>[] = [];

	function processContainer(items: readonly Item[], target: ActionTargetSelector, container: ItemContainerPath, room: ActionRoomSelector): void {
		for (const item of items) {
			if (item.id === id) {
				result.push({
					item,
					target,
					path: {
						container,
						itemId: item.id,
					},
					room,
				});
			}

			for (const [moduleName, module] of item.getModules()) {
				processContainer(module.getContents(), target, [
					...container,
					{ item: item.id, module: moduleName },
				], room);
			}
		}
	}

	for (const character of globalState.characters.values()) {
		processContainer(character.items, { type: 'character', characterId: character.id }, [], { type: 'room', roomId: character.currentRoom });
	}
	for (const room of globalState.space.rooms) {
		processContainer(room.items, { type: 'room', roomId: room.id }, [], { type: 'room', roomId: room.id });
	}

	freeze(result);
	cache.set(id, result);
	return result;
}

export function useStateFindItemById(globalState: AssetFrameworkGlobalState, id: ItemId): FindItemResult {
	return useMemo(() => FindItemById(globalState, id), [globalState, id]);
}

export function IsSpaceAdmin(data: Immutable<SpaceClientInfo>, account: Nullable<Partial<IDirectoryAccountInfo>>): boolean {
	if (!account?.id)
		return false;

	if (data.owners.includes(account.id))
		return true;
	if (data.admin.includes(account.id))
		return true;

	if (data.development?.autoAdmin && IsAuthorized(account.roles, 'developer'))
		return true;

	return false;
}
