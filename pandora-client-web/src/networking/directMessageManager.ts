import type { IChatSegment, IDirectoryClientArgument, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryDirectMessageInfo } from 'pandora-common';
import type { SymmetricEncryption } from '../crypto/symmetric';
import type { DirectoryConnector } from './directoryConnector';
import { KeyExchange } from '../crypto/keyExchange';
import { BrowserStorage } from '../browserStorage';
import { Observable, ReadonlyObservable } from '../observable';
import { ChatParser } from '../components/chatroom/chatParser';
import { TypedEventEmitter } from '../event';

export class DirectMessageManager extends TypedEventEmitter<{ newMessage: DirectMessageChannel; close: number; }> {
	public readonly connector: DirectoryConnector;
	private readonly _cryptoPassword = BrowserStorage.create<string | undefined>('crypto-handler-password', undefined);
	private readonly _chats: Map<number, DirectMessageChannel> = new Map();
	private _info: IDirectoryDirectMessageInfo[] = [];
	private _lastCryptoKey?: string;
	#crypto?: KeyExchange;

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
		if (!cryptoPassword) {
			throw new Error('Assertion failed: key exchange password not set');
		}
		if (account.cryptoKey) {
			this.#crypto = await KeyExchange.import(account.cryptoKey, cryptoPassword);
			this._lastCryptoKey = account.cryptoKey;
		} else {
			this.#crypto = await KeyExchange.generate();
			this._lastCryptoKey = await this.#crypto.export(cryptoPassword);
			this.connector.sendMessage('setCryptoKey', { cryptoKey: this._lastCryptoKey });
		}
	}

	public deriveKey(publicKeyData: string): Promise<SymmetricEncryption> {
		if (!this.#crypto) {
			throw new Error('Not logged in');
		}
		return this.#crypto.deriveKey(publicKeyData);
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

	public async handleDirectMessage(data: IDirectoryClientArgument['directMessage']): Promise<void> {
		if ('info' in data && data.info) {
			this._info = data.info;
		} else if ('message' in data && data.message) {
			try {
				const id = data.message.account ? data.message.source : data.message.target;
				const chat = this._getChat(id);
				await chat.loadSingle(data.message, this._info);
				this.emit('newMessage', chat);
			} catch {
				// ignore
			}
		} else if ('id' in data && data.id && 'action' in data && data.action) {
			switch (data.action) {
				case 'read': {
					const info = this._info.find((i) => i.id === data.id);
					if (info) {
						delete info.hasUnread;
					}
					break;
				}
				case 'close': {
					this.emit('close', data.id);
					const index = this._info.findIndex((i) => i.id === data.id);
					if (index >= 0) {
						this._info.splice(index, 1);
					}
					this._chats.delete(data.id);
					break;
				}
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
	private _account!: IDirectoryDirectMessageAccount;
	private _mounts = 0;
	private _failed?: 'notFound' | 'denied';
	#encription!: SymmetricEncryption;

	public readonly connector: DirectoryConnector;

	get loaded(): boolean {
		return this._loaded;
	}

	get messages(): ReadonlyObservable<readonly DirectMessage[]> {
		return this._messages;
	}

	get account(): Readonly<IDirectoryDirectMessageAccount> {
		return this._account;
	}

	get mounted(): boolean {
		return this._mounts > 0;
	}

	get failed(): 'notFound' | 'denied' | undefined {
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
		const encrypted = await this.#encription.encrypt(message);
		const response = await this.connector.awaitResponse('sendDirectMessage', { id: this._id, content: encrypted, editing });
		if (response.result !== 'ok') {
			// TODO
			return;
		}
	}

	async load(): Promise<void> {
		if (this._loaded || this._failed) {
			return;
		}
		if (this._loading) {
			return this._loading;
		}
		this._loading = this._load();
		return this._loading;
	}

	async loadSingle(data: IDirectoryDirectMessage & { account?: IDirectoryDirectMessageAccount; }, infos: IDirectoryDirectMessageInfo[]): Promise<boolean> {
		const { content, time, edited } = data;
		if (data.account) {
			await this._loadKey(data.account.publicKeyData);
			this._account = data.account;
		}
		this._loadSingle({
			time,
			message: await this.#encription.decrypt(content),
			sent: data.account === undefined,
			edited,
		});
		const id = data.account?.id ?? data.source;
		let info = infos.find((i) => i.id === id);
		if (!info) {
			info = { id, account: this._account.name };
		}
		if (this._mounts > 0) {
			this.connector.sendMessage('directMessage', { id, action: 'read' });
			delete info.hasUnread;
			return true;
		}
		info.hasUnread = true;
		return false;
	}

	async _load(): Promise<void> {
		if (this._loaded || this._failed) {
			return;
		}
		const response = await this.connector.awaitResponse('getDirectMessages', { id: this._id });
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
		this._messages.value = [...this.messages.value, ...await Promise.all(response.messages.map(async (message) => ({
			time: message.time,
			message: ChatParser.parseStyle(await this.#encription.decrypt(message.content)),
			sent: message.source !== this._id,
			edited: message.edited,
		})))]
			.sort((a, b) => a.time - b.time);
	}

	private _loadSingle({ time, message, sent, edited }: { time: number; message: string; sent: boolean; edited?: number; }): void {
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
		this._publicKeyData = publicKeyData;
		this._messages.value = [];
		this.#encription = await this._manager.deriveKey(publicKeyData);
	}
}
