import type { IDirectoryClientArgument } from 'pandora-common';
import type { SymmetricEncryption } from '../crypto/symmetric';
import type { DirectoryConnector } from './directoryConnector';
import { KeyExchange } from '../crypto/keyExchange';
import { BrowserStorage } from '../browserStorage';

export class DirectMessageManager {
	private readonly _connector: DirectoryConnector;
	private readonly _cryptoPassword = BrowserStorage.create<string | undefined>('crypto-handler-password', undefined);
	private _lastCryptoKey?: string;
	#crypto?: KeyExchange;

	constructor(connector: DirectoryConnector) {
		this._connector = connector;
	}

	public clear() {
		this._lastCryptoKey = undefined;
		this.#crypto = undefined;
		this._cryptoPassword.value = undefined;
	}

	public async initCryptoPassword(username: string, password: string) {
		this._cryptoPassword.value = await KeyExchange.generateKeyPassword(username, password);
	}

	public async accountChanged() {
		const account = this._connector.currentAccount.value;
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
			this._connector.sendMessage('setCryptoKey', { cryptoKey: this._lastCryptoKey });
		}
	}

	public deriveKey(publicKeyData: string): Promise<SymmetricEncryption> {
		if (!this.#crypto) {
			throw new Error('Not logged in');
		}
		return this.#crypto.deriveKey(publicKeyData);
	}

	public handleNewMessage(_: IDirectoryClientArgument['newDirectMessage']): Promise<void> {
		return Promise.resolve();
		// TODO
	}
}
