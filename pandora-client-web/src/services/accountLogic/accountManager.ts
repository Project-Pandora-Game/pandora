import { freeze } from 'immer';
import {
	Assert,
	AsyncSynchronized,
	CharacterIdSchema,
	EMPTY,
	GetLogger,
	IDirectoryAccountInfo,
	IDirectoryCharacterConnectionInfo,
	Service,
	type CharacterId,
	type IClientDirectoryArgument,
	type Satisfies,
	type SecondFactorData,
	type SecondFactorResponse,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { toast } from 'react-toastify';
import { BrowserStorage } from '../../browserStorage.ts';
import { AccountContactContext } from '../../components/accountContacts/accountContactContext.ts';
import { PrehashPassword } from '../../crypto/helpers.ts';
import type { LoginResponse } from '../../networking/directoryConnector.ts';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import type { ClientServices } from '../clientServices.ts';
import { InitDirectMessageCryptoPassword } from './directMessages/directMessageManager.ts';

type AccountManagerServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, 'directoryConnector'>;
	events: {
		logout: undefined;
		accountChanged: { account: IDirectoryAccountInfo | null; character: IDirectoryCharacterConnectionInfo | null; };
	};
}, ServiceConfigBase>;

/**
 * Service containing the currently logged in account and selected character data.
 */
export class AccountManager extends Service<AccountManagerServiceConfig> {
	private readonly logger = GetLogger('AccountManager');

	private readonly _currentAccount = new Observable<IDirectoryAccountInfo | null>(null);
	private readonly _lastSelectedCharacter = BrowserStorage.createSession<CharacterId | undefined>('lastSelectedCharacter', undefined, CharacterIdSchema.optional());
	private _shardConnectionInfo: IDirectoryCharacterConnectionInfo | null = null;

	/** Currently logged in account data or null if not logged in */
	public get currentAccount(): ReadonlyObservable<IDirectoryAccountInfo | null> {
		return this._currentAccount;
	}

	/** The Id of the last selected character for this session. On reconnect this character will be re-selected. */
	public get lastSelectedCharacter(): ReadonlyObservable<CharacterId | undefined> {
		return this._lastSelectedCharacter;
	}

	/** Handler for second factor authentication */
	public secondFactorHandler: ((response: SecondFactorResponse) => Promise<SecondFactorData | null>) | null = null;

	protected override serviceInit(): void {
		const { directoryConnector } = this.serviceDeps;

		directoryConnector.messageHandlers.connectionState = async (message) => {
			await this.handleAccountChange(message);
		};
	}

	/**
	 * Attempt to login to Directory and handle response
	 * @param username - The username to use for login
	 * @param password - The plaintext password to use for login
	 * @param verificationToken - Verification token to verify email
	 * @returns Promise of response from Directory
	 */
	public async login(username: string, password: string, verificationToken?: string): Promise<LoginResponse> {
		// Init DM crypto password before attempting login, so it can load directly at login
		await InitDirectMessageCryptoPassword(username, password);
		const passwordSha512 = await PrehashPassword(password);
		const result = await this.loginDirect({ username, passwordSha512, verificationToken });
		if (result !== 'ok') {
			await this.handleAccountChange({ account: null, character: null });
		}
		return result;
	}

	private async loginDirect(data: IClientDirectoryArgument['login']): Promise<LoginResponse> {
		const { directoryConnector } = this.serviceDeps;

		const result = await directoryConnector.awaitResponse('login', data);
		switch (result.result) {
			case 'ok':
				directoryConnector.authToken.value = { ...result.token, username: result.account.username };
				await this.handleAccountChange({ account: result.account, character: null });
				return 'ok';
			case 'secondFactorRequired':
			case 'secondFactorInvalid':
				if (this.secondFactorHandler) {
					const secondFactor = await this.secondFactorHandler(result);
					if (secondFactor) {
						return this.loginDirect({ ...data, secondFactor });
					}
				}
				return 'invalidSecondFactor';
			case 'accountDisabled':
				return result;
			default:
				return result.result;
		}
	}

	public logout(): void {
		const { directoryConnector } = this.serviceDeps;

		directoryConnector.sendMessage('logout', { type: 'self' });
		this.emit('accountChanged', { account: null, character: null });
		this.emit('logout', undefined);
		AccountContactContext.handleLogout();
		this._lastSelectedCharacter.value = undefined;
		directoryConnector.authToken.value = undefined;
	}

	private async handleAccountChange({ account, character }: { account: IDirectoryAccountInfo | null; character: IDirectoryCharacterConnectionInfo | null; }): Promise<void> {
		const { directoryConnector } = this.serviceDeps;

		// Update current account
		this._currentAccount.value = account ? freeze(account) : null;
		// Clear saved token if no account
		if (account == null) {
			directoryConnector.authToken.value = undefined;
			Assert(character == null);
		}

		// Update current character
		if (character != null) {
			this._lastSelectedCharacter.value = character.characterId;
			this._shardConnectionInfo = character;
			directoryConnector.setActiveCharacterInfo(character);
		} else {
			directoryConnector.setActiveCharacterInfo(null);

			// If we already have a character and we are requested to unload it, clear the last character
			if (this._shardConnectionInfo != null) {
				this._lastSelectedCharacter.value = undefined;
				this._shardConnectionInfo = null;
			}
		}

		this.emit('accountChanged', { account, character });

		// If we have account, but not character, then try doing auto-connect
		if (account != null && character == null) {
			await this.autoConnectCharacter();
		}
	}

	@AsyncSynchronized('object')
	private async autoConnectCharacter(): Promise<void> {
		const { directoryConnector } = this.serviceDeps;

		const characterId = this._lastSelectedCharacter.value;
		if (characterId == null || this._shardConnectionInfo != null) {
			return;
		}
		// Try to directly connect to the last selected character
		this.logger.verbose('Requesting auto-connect to character', characterId);
		try {
			const data = await directoryConnector.awaitResponse('connectCharacter', { id: characterId });
			if (data.result !== 'ok') {
				this.logger.alert('Failed to auto-connect to previous character:', data);
				this._lastSelectedCharacter.value = undefined;
			}
		} catch (error) {
			this.logger.warning('Error auto-connecting to previous character:', error);
			this._lastSelectedCharacter.value = undefined;
		}
	}

	@AsyncSynchronized('object')
	public async connectToCharacter(id: CharacterId): Promise<boolean> {
		const { directoryConnector } = this.serviceDeps;

		this.logger.verbose('Requesting connect to character', id);
		try {
			const data = await directoryConnector.awaitResponse('connectCharacter', { id });
			if (data.result !== 'ok') {
				this.logger.warning('Failed to connect to character:', data);
				toast(`Failed to connect to character:\n${data.result}`, TOAST_OPTIONS_ERROR);
				this._lastSelectedCharacter.value = undefined;
				return false;
			}
		} catch (error) {
			this.logger.warning('Error connecting to character:', error);
			toast(`Error connecting to character.`, TOAST_OPTIONS_ERROR);
			this._lastSelectedCharacter.value = undefined;
			return false;
		}
		return true;
	}

	public disconnectFromCharacter(): void {
		const { directoryConnector } = this.serviceDeps;

		directoryConnector.sendMessage('disconnectCharacter', EMPTY);
		this._lastSelectedCharacter.value = undefined;
	}
}

export const AccountManagerServiceProvider: ServiceProviderDefinition<ClientServices, 'accountManager', AccountManagerServiceConfig> = {
	name: 'accountManager',
	ctor: AccountManager,
	dependencies: {
		directoryConnector: true,
	},
};
