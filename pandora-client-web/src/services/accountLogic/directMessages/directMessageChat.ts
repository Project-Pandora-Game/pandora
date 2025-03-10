import type { Immutable } from 'immer';
import {
	Assert,
	AssertNever,
	AsyncSynchronized,
	GetLogger,
	type AccountId,
	type HexColorString,
	type IChatSegment,
	type IDirectoryDirectMessage,
	type IDirectoryDirectMessageInfo,
	type Logger,
} from 'pandora-common';
import { HashSHA256Base64 } from '../../../crypto/helpers.ts';
import { SymmetricEncryption } from '../../../crypto/symmetric.ts';
import { Observable, type ReadonlyObservable } from '../../../observable.ts';
import { ChatParser } from '../../../ui/components/chat/chatParser.ts';
import type { DirectMessageManager } from './directMessageManager.ts';

export type DirectMessageChatState = 'notLoaded' | 'ready' | 'errorNotFound' | 'errorNoKeyAvailable' | 'errorDenied' | 'error';
export type ChatEncryption = {
	service: SymmetricEncryption;
	keyHash: string;
};

export type DirectMessageChatDisplayInfo = {
	displayName: string | null;
	labelColor: HexColorString;
	hasUnread: boolean;
	/** The time the last message was sent/received. 0 if none exist. */
	lastMessageTime: number;
};

export type LoadedDirectMessage = IDirectoryDirectMessage & {
	/** A cached decrypted value. */
	decrypted: IChatSegment[] | null;
};

export class DirectMessageChat {
	private readonly logger: Logger;
	public readonly manager: DirectMessageManager;
	public readonly id: AccountId;

	/** List of loaded messages, ordered by time (most recent last). */
	private readonly _messages = new Observable<readonly Immutable<LoadedDirectMessage>[]>([]);

	public get messages(): ReadonlyObservable<readonly Immutable<LoadedDirectMessage>[]> {
		return this._messages;
	}

	private readonly _state = new Observable<DirectMessageChatState>('notLoaded');

	public get state(): ReadonlyObservable<DirectMessageChatState> {
		return this._state;
	}

	// Account info for showing the data
	/** Display info for the other account */
	private readonly _displayInfo = new Observable<DirectMessageChatDisplayInfo>({
		displayName: null,
		labelColor: '#FFFFFF',
		hasUnread: false,
		lastMessageTime: 0,
	});
	/** Display name for the other account */
	public get displayInfo(): ReadonlyObservable<Immutable<DirectMessageChatDisplayInfo>> {
		return this._displayInfo;
	}

	private readonly _encryption = new Observable<ChatEncryption | null>(null);
	public get encryption(): ReadonlyObservable<ChatEncryption | null> {
		return this._encryption;
	}

	/** Public key of the account */
	private _publicKeyData?: string;

	constructor(manager: DirectMessageManager, id: number) {
		this.logger = GetLogger('DirectMessageChannel', `[DirectMessageChannel ${id}]`);
		this.manager = manager;
		this.id = id;
	}

	@AsyncSynchronized()
	public async load(): Promise<void> {
		if (this._state.value === 'ready') {
			return;
		}
		const response = await this.manager.connector.awaitResponse('getDirectMessages', { id: this.id });
		this.logger.debug(`Got response to 'getDirectMessages': ${response.result}`);
		if (response.result !== 'ok') {
			if (response.result === 'denied') {
				this._state.value = 'errorDenied';
			} else if (response.result === 'notFound') {
				this._state.value = 'errorNotFound';
			} else if (response.result === 'noKeyAvailable') {
				this._state.value = 'errorNoKeyAvailable';
			} else {
				AssertNever(response.result);
			}
			return;
		}

		// Apply the received messages first and any already-known messages later
		// (we could have received delta while the request for messages was in progress, in that case the delta is actually newer)
		const oldMessages = this._messages.value;
		this._messages.value = response.messages.map((m): LoadedDirectMessage => ({
			...m,
			decrypted: null,
		}));
		for (const oldMessage of oldMessages) {
			this.addMessage(oldMessage);
		}

		// Finally load account info
		this._displayInfo.value = {
			displayName: response.account.displayName,
			labelColor: response.account.labelColor,
			hasUnread: this._displayInfo.value.hasUnread,
			lastMessageTime: this._messages.value.length > 0 ? this._messages.value[this._messages.value.length - 1].time : 0,
		};
		this._publicKeyData = response.account.publicKeyData;
		this._state.value = 'ready';

		try {
			const encryptionLoadResult = await this.loadKey();
			Assert(encryptionLoadResult, 'Failed to load encryption key');
			this.logger.debug(`Successfully loaded encryption`);
		} catch (error) {
			this.logger.error('Error loading encryption key:', error);
		}
	}

	public reloadIfLoaded(): void {
		if (this._state.value === 'ready') {
			this._state.value = 'notLoaded';
			this.load()
				.catch((err) => {
					GetLogger('DirectMessageChat')
						.error('Failed to re-load chat:', err);
				});
		}
	}

	@AsyncSynchronized()
	public async loadKey(): Promise<boolean> {
		if (this._publicKeyData == null)
			return false;

		const keyA = this._publicKeyData;
		const keyB = await this.manager.getPublicKey();
		const text = keyA.localeCompare(keyB) < 0 ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;
		const keyHash = await HashSHA256Base64(text);

		if (this._encryption.value?.keyHash === keyHash)
			return true;

		const service = await this.manager.deriveChatKey(this._publicKeyData);
		this._encryption.value = {
			service,
			keyHash,
		};
		return true;
	}

	public loadInfo(info: IDirectoryDirectMessageInfo): void {
		Assert(this.id === info.id);
		this._displayInfo.produceImmer((di) => {
			di.displayName = info.displayName;
			di.hasUnread = info.hasUnread != null;
			di.lastMessageTime = info.time;
		});
	}

	public addMessage(message: IDirectoryDirectMessage, markUnread: boolean = false): void {
		this._messages.produce((messages) => {
			// Fast path (message is newer than all we know)
			if (messages.length === 0 || messages[messages.length - 1].time < message.time) {
				// Skip empty (deleted) messages
				if (message.content !== '') {
					return [
						...messages,
						{
							...message,
							decrypted: null,
						},
					];
				}
				return messages;
			}
			// Find the expected index of this message and insert it (possibly replacing existing one)
			// The searched index is first message that was later than the one being added (or the message itself if it already exists)
			const insertIndex = messages.findIndex((m) => m.time >= message.time);
			// Holds from the fast-path if - the last message exists and definitely has bigger or equal time
			Assert(insertIndex >= 0 && insertIndex < messages.length);
			// Ignore this message if tries to replace more recently edited message
			if (messages[insertIndex].time === message.time && (messages[insertIndex].edited ?? 0) >= (message.edited ?? 0))
				return messages;
			// Insert or replace the message
			const newMessages = messages.slice();
			newMessages.splice(insertIndex, (messages[insertIndex].time === message.time) ? 1 : 0, {
				...message,
				decrypted: null,
			});
			return newMessages;
		});

		this._displayInfo.produceImmer((info) => {
			info.lastMessageTime = Math.max(info.lastMessageTime, message.time);
			if (markUnread) {
				info.hasUnread = true;
			}
		});
	}

	public async decryptMessage(message: Immutable<LoadedDirectMessage>): Promise<boolean> {
		if (message.decrypted)
			return true;
		if (this.encryption.value == null)
			return false;

		const decryptedContent = ChatParser.parseStyle(await this.encryption.value.service.decrypt(message.content), true);

		const index = this._messages.value.findIndex((m) => m.time === message.time);
		this._messages.produceImmer((messages) => {
			if (index >= 0 && messages[index].decrypted == null && messages[index].content === message.content) {
				messages[index].decrypted = decryptedContent;
			}
		});
		return true;
	}

	public markRead() {
		this._displayInfo.produceImmer((info) => {
			info.hasUnread = false;
		});
	}
}
