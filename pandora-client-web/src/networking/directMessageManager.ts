import type { IChatSegment, IDirectoryClientArgument } from 'pandora-common';
import type { SymmetricEncryption } from '../crypto/symmetric';
import type { DirectoryConnector } from './directoryConnector';
import { KeyExchange } from '../crypto/keyExchange';
import { BrowserStorage } from '../browserStorage';
import { Observable, ReadonlyObservable } from '../observable';
import { ChatParser } from '../components/chatroom/chatParser';
import { TypedEventEmitter } from '../event';

export class DirectMessageManager extends TypedEventEmitter<{ newMessage: DirectMessageChannel; }> {
	public readonly connector: DirectoryConnector;
	private readonly _cryptoPassword = BrowserStorage.create<string | undefined>('crypto-handler-password', undefined);
	private readonly _chats: Map<number, DirectMessageChannel> = new Map();
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
		if (chat.loaded) {
			return chat;
		}
		// eslint-disable-next-line @typescript-eslint/no-throw-literal
		throw chat.load();
	}

	public async handleNewMessage(message: IDirectoryClientArgument['newDirectMessage']): Promise<void> {
		try {
			const channel = this._getChat(message.account.id);
			await channel.loadSingle(message);
			this.emit('newMessage', channel);
		} catch {
			// ignore
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
	private _account!: IDirectoryClientArgument['newDirectMessage']['account'];
	private _mounts = 0;
	#encription!: SymmetricEncryption;

	public readonly connector: DirectoryConnector;

	get loaded(): boolean {
		return this._loaded;
	}

	get messages(): ReadonlyObservable<readonly DirectMessage[]> {
		return this._messages;
	}

	get account(): Readonly<IDirectoryClientArgument['newDirectMessage']['account']> {
		return this._account;
	}

	get mounted(): boolean {
		return this._mounts > 0;
	}

	constructor(manager: DirectMessageManager, id: number) {
		this._manager = manager;
		this._id = id;
		this.connector = manager.connector;
	}

	public addMount(): () => void {
		if (this._mounts === 0) {
			this.connector.sendMessage('directMessageAck', { id: this._id, ack: 'all' });
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
		const response = await this.connector.awaitResponse('sendDirectMessage', { id: this._id, message: encrypted, editing });
		if (response.result !== 'ok') {
			// TODO
			return;
		}
		this._loadSingle({
			time: response.time,
			message,
			sent: true,
			edited: editing,
		});
	}

	async load(): Promise<void> {
		if (this._loaded) {
			return;
		}
		if (this._loading) {
			return this._loading;
		}
		this._loading = this._load();
		return this._loading;
	}

	async loadSingle({ account, message, time, edited }: IDirectoryClientArgument['newDirectMessage']): Promise<void> {
		await this._loadKey(account.publicKeyData);
		this._account = account;
		this._loadSingle({
			time,
			message: await this.#encription.decrypt(message),
			sent: account.id !== this._id,
			edited,
		});
		if (this._mounts > 0) {
			this.connector.sendMessage('directMessageAck', { id: this._id, ack: time });
		}
	}

	async _load(): Promise<void> {
		if (this._loaded) {
			return;
		}
		const response = await this.connector.awaitResponse('getDirectMessages', { id: this._id });
		if (response.result !== 'ok') {
			this._loading = undefined;
			// TODO
			return;
		}
		this._account = response.account;
		await this._loadKey(response.account.publicKeyData);
		this._loaded = true;
		this._loading = undefined;
		this._messages.value = [...this.messages.value, ...await Promise.all(response.messages.map(async (message) => ({
			time: message.time,
			message: ChatParser.parseStyle(await this.#encription.decrypt(message.message)),
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
