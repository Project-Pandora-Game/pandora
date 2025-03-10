import {
	AccountId,
	Assert,
	AsyncSynchronized,
	EMPTY,
	GetLogger,
	IAccountCryptoKey,
	IDirectoryClientArgument,
	IDirectoryDirectMessage,
	Service,
	type IDirectoryAccountInfo,
	type Logger,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { z } from 'zod';
import { BrowserStorage } from '../../../browserStorage.ts';
import { KeyExchange } from '../../../crypto/keyExchange.ts';
import type { SymmetricEncryption } from '../../../crypto/symmetric.ts';
import type { DirectoryConnector } from '../../../networking/directoryConnector.ts';
import { Observable, type ReadonlyObservable } from '../../../observable.ts';
import type { ClientServices } from '../../clientServices.ts';
import { DirectMessageChat } from './directMessageChat.ts';

export type DirectMessageCryptoState = 'notLoaded' | 'ready' | 'noPassword' | 'loadError' | 'generateError';

type DirectMessageManagerServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, 'directoryConnector' | 'accountManager'>;
	events: {
		newMessage: DirectMessageChat;
		close: AccountId;
	};
}, ServiceConfigBase>;

const DmCryptoPassword = BrowserStorage.create<string | undefined>('crypto-handler-password', undefined, z.string().optional());

export async function InitDirectMessageCryptoPassword(username: string, password: string): Promise<void> {
	DmCryptoPassword.value = await KeyExchange.generateKeyPassword(username, password);
}

export class DirectMessageManager extends Service<DirectMessageManagerServiceConfig> {
	private readonly logger: Logger = GetLogger('DirectMessageManager');
	private readonly _chats = new Observable<readonly DirectMessageChat[]>([]);

	private readonly _cryptoState = new Observable<DirectMessageCryptoState>('notLoaded');
	#crypto?: KeyExchange;

	public get chats(): ReadonlyObservable<readonly DirectMessageChat[]> {
		return this._chats;
	}

	public get cryptoState(): ReadonlyObservable<DirectMessageCryptoState> {
		return this._cryptoState;
	}

	public get connector(): DirectoryConnector {
		return this.serviceDeps.directoryConnector;
	}

	protected override serviceInit(): void {
		const { directoryConnector, accountManager } = this.serviceDeps;

		// Register handlers to directoryConnector
		directoryConnector.messageHandlers.directMessageNew = ({ target, message }) => {
			this.handleNewDirectMessage(target, message);
		};
		directoryConnector.messageHandlers.directMessageAction = (data) => {
			this.handleDirectMessageAction(data);
		};
		// Register handlers to accountManager
		accountManager.on('logout', () => {
			this.clear();
		});
		accountManager.on('accountChanged', ({ account }) => {
			this.accountChanged(account)
				.catch((error) => {
					this.logger.error('Error processing account change:', error);
				});
		});

	}

	public clear() {
		DmCryptoPassword.value = undefined;
		this._chats.value = [];
		this.#crypto = undefined;
		this._cryptoState.value = 'notLoaded';
	}

	public async passwordChange(username: string, password: string): Promise<{ cryptoKey: IAccountCryptoKey; onSuccess: () => void; }> {
		if (this.#crypto == null) {
			throw new Error('Crypto not loaded');
		}

		const cryptoPassword = await KeyExchange.generateKeyPassword(username, password);
		const cryptoKey = await this.#crypto.export(cryptoPassword);

		return {
			cryptoKey,
			onSuccess: () => {
				DmCryptoPassword.value = cryptoPassword;
			},
		};
	}

	@AsyncSynchronized()
	private async accountChanged(account: IDirectoryAccountInfo | null) {
		if (!account) {
			this.logger.debug('No account, clear');
			this.clear();
			return;
		}

		this.logger.debug('Account or key changed, reloading crypto');
		// Clear the existing info, it will be re-fetched anyway
		this._chats.value = [];
		this.#crypto = undefined;
		this._cryptoState.value = 'notLoaded';

		const cryptoPassword = DmCryptoPassword.value;
		if (cryptoPassword != null) {
			if (account.cryptoKey) {
				const loadResult = await this.loadKey(account.cryptoKey, cryptoPassword);
				if (loadResult !== 'ok') {
					this._cryptoState.value = 'loadError';
				}
			} else {
				if (!await this.regenerateKey(cryptoPassword)) {
					this._cryptoState.value = 'generateError';
				}
			}
		} else {
			this.logger.error('Failed to load crypto: We have an account, but no crypto password');
			this._cryptoState.value = 'noPassword';
		}

		// Load chats only after we attempted to decode key - chats might decrypt themselves eagerly if they can.
		try {
			await this._loadExistingChats();
		} catch (error) {
			this.logger.error('Failed to load DM info:', error);
		}
	}

	public async loadKey(cryptoKey: IAccountCryptoKey, password: string): Promise<'ok' | 'error' | 'selftestFailed'> {
		this.logger.verbose('Loading crypto key...');
		try {
			const newCrypto = await KeyExchange.import(cryptoKey, password);
			if (!await newCrypto.selfTest()) {
				this.logger.warning('Failed to load crypto key: selftest failed');
				return 'selftestFailed';
			}

			this.#crypto = newCrypto;
			this._cryptoState.value = 'ready';
			await this._refreshChatCrypto();
			this.logger.info('Successfully loaded crypto key');
			return 'ok';
		} catch (error) {
			this.logger.error('Error loading crypto key:', error);
		}
		return 'error';
	}

	/** Update key stored on server. Mainly for the purpose of migrating off of old key formats. */
	public async updateSavedKey(): Promise<void> {
		const { directoryConnector } = this.serviceDeps;

		this.logger.verbose('Uploading current key to server...');
		const password = DmCryptoPassword.value;
		Assert(password != null, 'Missing password while updating saved key');
		Assert(this.#crypto != null, 'Missing crypto while updating saved key');

		const { result } = await directoryConnector.awaitResponse('setCryptoKey', {
			cryptoKey: await this.#crypto.export(password),
			allowReset: 'same-key',
		});
		if (result !== 'ok') {
			this.logger.warning('Failed to update cryptokey:', result);
			throw new Error('Failed to update cryptokey');
		}
		this.logger.verbose('Successfully updated server crypto key.');
	}

	/** Attempt to eagerly refresh all chat crypto keys, allowing for smoother transitions and possibly decrypting message contents in the background. */
	private async _refreshChatCrypto(): Promise<void> {
		// We don't care if the loads succeed or fail - this is just ahead-of-time optimization.
		await Promise.allSettled(
			this._chats.value.map((c) => c.loadKey()),
		);
	}

	/**
	 * Regenerates cryptographic key. (or generates it if it doesn't exist)
	 * This causes all past DMs to be lost.
	 * @param password - Password to use to encrypt the new key (default to stored password)
	 */
	@AsyncSynchronized()
	public async regenerateKey(password?: string): Promise<boolean> {
		const { directoryConnector } = this.serviceDeps;

		if (password == null) {
			password = DmCryptoPassword.value;
		}
		if (password == null) {
			this.logger.error('Unable to regenerate key with no crypto password.');
			return false;
		}

		this.logger.verbose('Regenerating the crypto key...');
		try {
			const newCrypto = await KeyExchange.generate();
			Assert(await newCrypto.selfTest(), 'Selftest failed');

			const { result } = await directoryConnector.awaitResponse('setCryptoKey', {
				cryptoKey: await newCrypto.export(password),
			});
			if (result !== 'ok') {
				this.logger.warning('Failed to set cryptokey:', result);
				return false;
			}
			DmCryptoPassword.value = password;
			this.#crypto = newCrypto;
			this._cryptoState.value = 'ready';
			await this._refreshChatCrypto();
			this.logger.info('Successfully generated and loaded new crypto key');
			return true;
		} catch (error) {
			this.logger.error('Error regenerating cryptokey:', error);
		}
		return false;
	}

	public deriveChatKey(publicKeyData: string): Promise<SymmetricEncryption> {
		if (!this.#crypto) {
			throw new Error('Crypto not loaded');
		}
		return this.#crypto.deriveKey(publicKeyData);
	}

	public getPublicKey(): Promise<string> {
		if (!this.#crypto) {
			throw new Error('Crypto not loaded');
		}
		return this.#crypto.exportPublicKey();
	}

	public handleNewDirectMessage(target: AccountId, message: IDirectoryDirectMessage): void {
		const { accountManager } = this.serviceDeps;

		const chat = this.getChat(target);
		const newMessage = message.edited == null && message.source !== accountManager.currentAccount.value?.id;
		chat.addMessage(message, newMessage);
		this._sortChats();
		this.emit('newMessage', chat);
	}

	public handleDirectMessageAction({ id, action }: IDirectoryClientArgument['directMessageAction']): void {
		switch (action) {
			case 'read': {
				const chat = this.getChat(id);
				chat.markRead();
				break;
			}
			case 'close': {
				this.emit('close', id);
				this._chats.produce((chats) => chats.filter((c) => c.id !== id));
				break;
			}
		}
	}

	public getChat(id: AccountId): DirectMessageChat {
		const chats = this._chats.value;
		let chat = chats.find((c) => c.id === id);
		if (chat == null) {
			chat = new DirectMessageChat(this, id);
			this._chats.value = [...chats, chat];
		}

		return chat;
	}

	private async _loadExistingChats(): Promise<void> {
		const { directoryConnector } = this.serviceDeps;

		const { info } = await directoryConnector.awaitResponse('getDirectMessageInfo', EMPTY);
		for (const chatInfo of info) {
			const chat = this.getChat(chatInfo.id);
			chat.loadInfo(chatInfo);
			chat.reloadIfLoaded();
		}
		this._sortChats();
		this.logger.debug('Loaded DM info');
	}

	/** Sorts the loaded chats so the last-modified is the first */
	private _sortChats(): void {
		this._chats.produce((chats) => chats.slice()
			.sort((a, b) => b.displayInfo.value.lastMessageTime - a.displayInfo.value.lastMessageTime),
		);
	}
}

export const DirectMessageManagerServiceProvider: ServiceProviderDefinition<ClientServices, 'directMessageManager', DirectMessageManagerServiceConfig> = {
	name: 'directMessageManager',
	ctor: DirectMessageManager,
	dependencies: {
		directoryConnector: true,
		accountManager: true,
	},
};
