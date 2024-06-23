import {
	AccountId,
	Assert,
	AssertNotNullable,
	AsyncSynchronized,
	EMPTY,
	GetLogger,
	IAccountCryptoKey,
	IChatSegment,
	IDirectoryClientArgument,
	IDirectoryDirectMessage,
	IDirectoryDirectMessageAccount,
	IDirectoryDirectMessageInfo,
	LIMIT_DIRECT_MESSAGE_LENGTH_BASE64,
	PromiseOnce,
	TypedEventEmitter,
	type Logger,
} from 'pandora-common';
import { toast } from 'react-toastify';
import { z } from 'zod';
import { BrowserStorage } from '../browserStorage';
import { HashSHA256Base64 } from '../crypto/helpers';
import { KeyExchange } from '../crypto/keyExchange';
import type { SymmetricEncryption } from '../crypto/symmetric';
import { Observable, ReadonlyObservable } from '../observable';
import { TOAST_OPTIONS_ERROR } from '../persistentToast';
import { ChatParser } from '../ui/components/chat/chatParser';
import type { DirectoryConnector } from './directoryConnector';

export class DirectMessageManager extends TypedEventEmitter<{ newMessage: DirectMessageChannel; close: AccountId; }> {
	public readonly connector: DirectoryConnector;
	private readonly _cryptoPassword = BrowserStorage.create<string | undefined>('crypto-handler-password', undefined, z.string().optional());
	private readonly _chats: Map<AccountId, DirectMessageChannel> = new Map();
	private readonly _info = new Observable<readonly IDirectoryDirectMessageInfo[]>([]);
	private readonly _selected = new Observable<AccountId | undefined>(undefined);
	private _lastCryptoKey?: Readonly<IAccountCryptoKey>;
	#crypto?: KeyExchange;

	public get info(): ReadonlyObservable<readonly IDirectoryDirectMessageInfo[]> {
		return this._info;
	}

	public get selected(): ReadonlyObservable<AccountId | undefined> {
		return this._selected;
	}

	public setSelected(id: AccountId) {
		this._selected.value = id;
	}

	constructor(connector: DirectoryConnector) {
		super();
		this.connector = connector;
	}

	public clear() {
		this._lastCryptoKey = undefined;
		this.#crypto = undefined;
		this._selected.value = undefined;
		this._cryptoPassword.value = undefined;
		this._chats.clear();
	}

	public async initCryptoPassword(username: string, password: string) {
		this._cryptoPassword.value = await KeyExchange.generateKeyPassword(username, password);
	}

	public async passwordChange(username: string, password: string): Promise<{ cryptoKey: IAccountCryptoKey; onSuccess: () => void; }> {
		if (this.#crypto == null) {
			throw new Error('Not logged in');
		}

		const cryptoPassword = await KeyExchange.generateKeyPassword(username, password);
		const cryptoKey = await this.#crypto.export(cryptoPassword);

		return {
			cryptoKey,
			onSuccess: () => {
				this._cryptoPassword.value = cryptoPassword;
				this._lastCryptoKey = cryptoKey;
			},
		};
	}

	public async accountChanged() {
		const account = this.connector.currentAccount.value;
		if (!account) {
			this.clear();
			return;
		}
		if (this.#crypto && this._lastCryptoKey === account.cryptoKey) {
			return;
		}
		const cryptoPassword = this._cryptoPassword.value;
		AssertNotNullable(cryptoPassword);
		if (account.cryptoKey) {
			this.#crypto = await KeyExchange.import(account.cryptoKey, cryptoPassword);
			this._lastCryptoKey = account.cryptoKey;
		} else {
			this.#crypto = await KeyExchange.generate();
			this._lastCryptoKey = await this.#crypto.export(cryptoPassword);
			const { result } = await this.connector.awaitResponse('setInitialCryptoKey', { cryptoKey: this._lastCryptoKey });
			if (result !== 'ok') {
				throw new Error(`Failed to set crypto key: ${result}`);
			}
		}
		await this._loadInfo();
	}

	public deriveKey(publicKeyData: string): Promise<SymmetricEncryption> {
		if (!this.#crypto) {
			throw new Error('Not logged in');
		}
		return this.#crypto.deriveKey(publicKeyData);
	}

	public publicKey(): Promise<string> {
		if (!this.#crypto) {
			throw new Error('Not logged in');
		}
		return this.#crypto.exportPublicKey();
	}

	/**
	 * designed for use in &lt;Suspense&gt; element
	 */
	public loadChat(id: AccountId): DirectMessageChannel {
		const chat = this._getChat(id);
		if (chat.loaded || chat.failed) {
			return chat;
		}
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw chat.load();
	}

	public async handleDirectMessageGet(data: IDirectoryClientArgument['directMessageGet']): Promise<void> {
		const chat = this._getChat(data.account.id);
		await chat.loadSingle(data, this._info);
		this.emit('newMessage', chat);
	}

	public async handleDirectMessageSent(data: IDirectoryClientArgument['directMessageSent']): Promise<void> {
		const chat = this._getChat(data.target);
		await chat.loadSingle(data, this._info);
		this.emit('newMessage', chat);
	}

	public handleDirectMessageAction({ id, action }: IDirectoryClientArgument['directMessageAction']): void {
		switch (action) {
			case 'read': {
				const info = this._info.value.find((i) => i.id === id);
				if (info) {
					delete info.hasUnread;
					this._info.value = [...this._info.value];
				}
				break;
			}
			case 'close': {
				this.emit('close', id);
				const index = this._info.value.findIndex((i) => i.id === id);
				if (index >= 0) {
					this._info.value = [...this._info.value.slice(0, index), ...this._info.value.slice(index + 1)];
				}
				if (this._selected.value === id) {
					this._selected.value = undefined;
				}
				this._chats.delete(id);
				break;
			}
		}
	}

	public getChat(id: AccountId): DirectMessageChannel | undefined {
		return this._chats.get(id);
	}

	private _getChat(id: AccountId): DirectMessageChannel {
		let chat = this._chats.get(id);
		if (chat === undefined) {
			chat = new DirectMessageChannel(this, id);
			this._chats.set(id, chat);
		}
		return chat;
	}

	private async _loadInfo(): Promise<void> {
		const { info } = await this.connector.awaitResponse('getDirectMessageInfo', EMPTY);
		this._info.value = info;
	}
}

export type DirectMessage = {
	time: number;
	message: IChatSegment[];
	sent: boolean;
	edited?: number;
};

export type DirectMessageChannelLoadError = 'notFound' | 'denied' | 'error';

export class DirectMessageChannel {
	private readonly _manager: DirectMessageManager;
	private readonly _id: number;
	private readonly _messages = new Observable<readonly DirectMessage[]>([]);
	private _loaded = false;
	private _publicKeyData?: string;
	private _keyHash?: string;
	private _account?: IDirectoryDirectMessageAccount;
	private _mounts = 0;
	private _failed?: DirectMessageChannelLoadError;
	#encryption: SymmetricEncryption | null = null;

	public readonly connector: DirectoryConnector;
	private readonly logger: Logger;

	public get id(): number {
		return this._id;
	}

	public get loaded(): boolean {
		return this._loaded;
	}

	public get messages(): ReadonlyObservable<readonly DirectMessage[]> {
		return this._messages;
	}

	public get account(): Readonly<IDirectoryDirectMessageAccount> | undefined {
		return this._account;
	}

	public get mounted(): boolean {
		return this._mounts > 0;
	}

	public get failed(): DirectMessageChannelLoadError | undefined {
		return this._failed;
	}

	constructor(manager: DirectMessageManager, id: number) {
		this.logger = GetLogger('DirectMessageChannel', `[DirectMessageChannel ${id}]`);
		this._manager = manager;
		this._id = id;
		this.connector = manager.connector;
	}

	public addMount(): () => void {
		if (this._mounts === 0) {
			this.connector.sendMessage('directMessage', { id: this._id, action: 'read' });
		}
		++this._mounts;
		return () => {
			--this._mounts;
		};
	}

	public async sendMessage(message: string, editing?: number): Promise<void> {
		if (!this._loaded) {
			throw new Error('Channel not loaded');
		}
		Assert(this.#encryption != null, 'Send message: Channel is loaded, but encryption helper is not.');
		const encrypted = message.length === 0 ? '' : await this.#encryption.encrypt(message);
		if (encrypted.length > LIMIT_DIRECT_MESSAGE_LENGTH_BASE64) {
			toast(`Encrypted message too long: ${encrypted.length} > ${LIMIT_DIRECT_MESSAGE_LENGTH_BASE64}`, TOAST_OPTIONS_ERROR);
			return;
		}
		const response = await this.connector.awaitResponse('sendDirectMessage', { id: this._id, content: encrypted, editing });
		if (response.result !== 'ok') {
			toast(`Failed to send message: ${response.result}`, TOAST_OPTIONS_ERROR);
		}
	}

	public readonly load = PromiseOnce(() => this._load());

	public async loadSingle(data: IDirectoryDirectMessage & { account?: IDirectoryDirectMessageAccount; }, infos: Observable<readonly IDirectoryDirectMessageInfo[]>): Promise<void> {
		const { content, time, edited } = data;
		if (data.account) {
			await this._loadKey(data.account.publicKeyData);
			this._account = data.account;
		}
		Assert(this.#encryption != null, 'Load message: Encryption helper is not loaded.');
		this._loadSingle({
			time,
			message: await this.#encryption.decrypt(content),
			sent: data.account === undefined,
			edited,
		});
		AssertNotNullable(this._account);
		const id = this._account.id;
		let info = infos.value.find((i) => i.id === id);
		if (!info) {
			info = { id, time, displayName: this._account.displayName };
			infos.value = [...infos.value, info];
		}
		if (data.edited === undefined) {
			info.time = time;
		}
		if (this._mounts > 0) {
			this.connector.sendMessage('directMessage', { id, action: 'read' });
			if (info.hasUnread) {
				delete info.hasUnread;
			}
			infos.value = [...infos.value];
			return;
		}
		if (!info.hasUnread) {
			info.hasUnread = true;
		}
		infos.value = [...infos.value];
	}

	private async _load(): Promise<void> {
		if (this._loaded || this._failed) {
			return;
		}
		const response = await this.connector.awaitResponse('getDirectMessages', { id: this._id });
		this.logger.debug(`Got response to 'getDirectMessages': ${response.result}`);
		if (response.result !== 'ok') {
			this._failed = response.result;
			return;
		}
		try {
			this._account = response.account;
			await this._loadKey(response.account.publicKeyData);
			Assert(this.#encryption != null);
			this.logger.debug(`Successfully loaded encryption`);
			this._loaded = true;
			this._failed = undefined;
			this._messages.value = [
				...this.messages.value.filter((old) => !response.messages.some((message) => message.time === old.time)),
				...await this._decryptMany(response.messages),
			]
				.sort((a, b) => a.time - b.time);
			this.logger.debug(`Decrypted old messages`);
		} catch (error) {
			this.logger.error('Error decrypting existing messages: ', error);
			this._loaded = false;
			this._failed = 'error';
		}
	}

	private async _decryptMany(messages: IDirectoryDirectMessage[]): Promise<DirectMessage[]> {
		const decrypt = this._decrypt.bind(this);
		const result = await Promise.all(messages.map(decrypt));
		return result.filter<DirectMessage>((r): r is DirectMessage => r !== undefined);
	}

	private async _decrypt({ keyHash, time, content, source, edited }: IDirectoryDirectMessage): Promise<DirectMessage | undefined> {
		if (keyHash !== this._keyHash) {
			return undefined;
		}
		Assert(this.#encryption != null, 'Decrypt: key hash is valid, but encryption helper is not loaded.');
		return {
			time,
			message: ChatParser.parseStyle(await this.#encryption.decrypt(content), true),
			sent: source !== this._id,
			edited,
		};
	}

	private _loadSingle({ time, message, sent, edited }: { time: number; message: string; sent: boolean; edited?: number; }): void {
		if (edited !== undefined) {
			const index = this._messages.value.findIndex((m) => m.time === edited);
			if (index < 0) {
				return;
			}
			const begin = this._messages.value.slice(0, index);
			const end = this._messages.value.slice(index + 1);
			if (!message) {
				this._messages.value = [...begin, ...end];
				return;
			}
			this._messages.value = [
				...begin,
				{
					time,
					message: ChatParser.parseStyle(message, true),
					sent,
					edited,
				},
				...end,
			];
			return;
		}
		this._messages.value = [...this.messages.value, {
			time,
			message: ChatParser.parseStyle(message, true),
			sent,
			edited,
		}];
	}

	@AsyncSynchronized()
	private async _loadKey(publicKeyData: string): Promise<void> {
		if (this._publicKeyData === publicKeyData) {
			return;
		}
		const keyA = publicKeyData;
		const keyB = await this._manager.publicKey();
		const text = keyA.localeCompare(keyB) < 0 ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;
		const keyHash = await HashSHA256Base64(text);
		const encryption = await this._manager.deriveKey(publicKeyData);
		// Set the properties atomically in a way that can't throw in the middle
		this._messages.value = [];
		this._publicKeyData = publicKeyData;
		this._keyHash = keyHash;
		this.#encryption = encryption;
	}
}
