import { AssertNotNullable, EMPTY, IAccountCryptoKey, IChatSegment, IDirectoryClientArgument, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryDirectMessageInfo } from 'pandora-common';
import type { SymmetricEncryption } from '../crypto/symmetric';
import type { DirectoryConnector } from './directoryConnector';
import { KeyExchange } from '../crypto/keyExchange';
import { BrowserStorage } from '../browserStorage';
import { Observable, ReadonlyObservable } from '../observable';
import { ChatParser } from '../components/chatroom/chatParser';
import { TypedEventEmitter } from '../event';
import { HashSHA256Base64 } from '../crypto/helpers';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../persistentToast';

export class DirectMessageManager extends TypedEventEmitter<{ newMessage: DirectMessageChannel; close: number }> {
	public readonly connector: DirectoryConnector;
	private readonly _cryptoPassword = BrowserStorage.create<string | undefined>('crypto-handler-password', undefined);
	private readonly _chats: Map<number, DirectMessageChannel> = new Map();
	private readonly _info = new Observable<readonly IDirectoryDirectMessageInfo[]>([]);
	private _lastCryptoKey?: Readonly<IAccountCryptoKey>;
	#crypto?: KeyExchange;

	public get info(): ReadonlyObservable<readonly IDirectoryDirectMessageInfo[]> {
		return this._info;
	}

	constructor(connector: DirectoryConnector) {
		super();
		this.connector = connector;
	}

	public clear() {
		this._lastCryptoKey = undefined;
		this.#crypto = undefined;
		this._cryptoPassword.value = undefined;
		this._chats.clear();
	}

	public async initCryptoPassword(username: string, password: string) {
		this._cryptoPassword.value = await KeyExchange.generateKeyPassword(username, password);
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
			this.connector.sendMessage('setCryptoKey', { cryptoKey: this._lastCryptoKey });
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
	public loadChat(id: number): DirectMessageChannel {
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
				this._chats.delete(id);
				break;
			}
		}
	}

	private _getChat(id: number): DirectMessageChannel {
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

export class DirectMessageChannel {
	private readonly _manager: DirectMessageManager;
	private readonly _id: number;
	private readonly _messages = new Observable<readonly DirectMessage[]>([]);
	private _loaded = false;
	private _loading?: Promise<void>;
	private _publicKeyData?: string;
	private _keyHash?: string;
	private _account!: IDirectoryDirectMessageAccount;
	private _mounts = 0;
	private _failed?: 'notFound' | 'denied';
	#encryption!: SymmetricEncryption;

	public readonly connector: DirectoryConnector;

	public get loaded(): boolean {
		return this._loaded;
	}

	public get messages(): ReadonlyObservable<readonly DirectMessage[]> {
		return this._messages;
	}

	public get account(): Readonly<IDirectoryDirectMessageAccount> {
		return this._account;
	}

	public get mounted(): boolean {
		return this._mounts > 0;
	}

	public get failed(): 'notFound' | 'denied' | undefined {
		return this._failed;
	}

	constructor(manager: DirectMessageManager, id: number) {
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
		const encrypted = message.length === 0 ? '' : await this.#encryption.encrypt(message);
		const response = await this.connector.awaitResponse('sendDirectMessage', { id: this._id, content: encrypted, editing });
		if (response.result !== 'ok') {
			toast(`Failed to send message: ${response.result}`, TOAST_OPTIONS_ERROR);
			return;
		}
	}

	public async load(): Promise<void> {
		if (this._loaded || this._failed) {
			return;
		}
		if (this._loading) {
			return this._loading;
		}
		this._loading = this._load();
		return this._loading;
	}

	public async loadSingle(data: IDirectoryDirectMessage & { account?: IDirectoryDirectMessageAccount }, infos: Observable<readonly IDirectoryDirectMessageInfo[]>): Promise<void> {
		const { content, time, edited } = data;
		if (data.account) {
			await this._loadKey(data.account.publicKeyData);
			this._account = data.account;
		}
		this._loadSingle({
			time,
			message: await this.#encryption.decrypt(content),
			sent: data.account === undefined,
			edited,
		});
		const id = this._account.id;
		let info = infos.value.find((i) => i.id === id);
		if (!info) {
			info = { id, time, account: this._account.name };
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
		const oldest = this._messages.value[0]?.time;
		const response = await this.connector.awaitResponse('getDirectMessages', { id: this._id, until: oldest });
		if (response.result !== 'ok') {
			this._loading = undefined;
			this._failed = response.result;
			return;
		}
		this._account = response.account;
		await this._loadKey(response.account.publicKeyData);
		this._loaded = true;
		this._failed = undefined;
		this._loading = undefined;
		this._messages.value = [
			...this.messages.value.filter((old) => !response.messages.some((message) => message.time === old.time)),
			...await this._decryptMany(response.messages),
		]
			.sort((a, b) => a.time - b.time);
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
		return {
			time,
			message: ChatParser.parseStyle(await this.#encryption.decrypt(content)),
			sent: source !== this._id,
			edited,
		};
	}

	private _loadSingle({ time, message, sent, edited }: { time: number; message: string; sent: boolean; edited?: number }): void {
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
					message: ChatParser.parseStyle(message),
					sent,
					edited,
				},
				...end,
			];
			return;
		}
		this._messages.value = [...this.messages.value, {
			time,
			message: ChatParser.parseStyle(message),
			sent,
			edited,
		}];
	}

	private async _loadKey(publicKeyData: string): Promise<void> {
		if (this._publicKeyData === publicKeyData) {
			return;
		}
		const keyA = this._publicKeyData = publicKeyData;
		const keyB = await this._manager.publicKey();
		const text = keyA.localeCompare(keyB) < 0 ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;
		this._keyHash = await HashSHA256Base64(text);
		this._messages.value = [];
		this.#encryption = await this._manager.deriveKey(publicKeyData);
	}
}
