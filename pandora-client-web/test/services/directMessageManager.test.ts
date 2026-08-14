import { waitFor } from '@testing-library/react';
import { Assert, type ServiceManager } from 'pandora-common';
import type { IAccountCryptoKey, IDirectoryAccountInfo } from 'pandora-common/networking/api/directory_client';
import { KeyExchange } from '../../src/crypto/keyExchange.ts';
import { DirectoryConnector } from '../../src/networking/directoryConnector.ts';
import type { PasskeyDirectMessageUnlock } from '../../src/services/accountLogic/accountManager.ts';
import { ClearDirectMessageCryptoUnlocks, DirectMessageManager } from '../../src/services/accountLogic/directMessages/directMessageManager.ts';
import type { ClientServices } from '../../src/services/clientServices.ts';
import { MockServiceManager } from '../testUtils.tsx';
const jest = import.meta.jest; // Jest is not properly injected in ESM

describe('DirectMessageManager', () => {
	let serviceManager: ServiceManager<ClientServices>;
	let directoryConnector: DirectoryConnector;
	let directMessageManager: DirectMessageManager;

	beforeEach(async () => {
		localStorage.clear();
		ClearDirectMessageCryptoUnlocks();

		await loadServices();
	});

	afterEach(async () => {
		await serviceManager.destroy();
		ClearDirectMessageCryptoUnlocks();
		localStorage.clear();
	});

	it('unlocks direct messages after token reconnect from stored passkey unlock data', async () => {
		const username = 'passkey-user';
		const wrappingSecret = 'passkey-wrapping-secret';
		const crypto = await KeyExchange.generate();
		const passkeyCryptoKey = await crypto.export(wrappingSecret);

		await sendConnectionState({
			account: CreateAccount(username, {
				...passkeyCryptoKey,
				salt: 'password-salt',
			}),
			character: null,
		});
		await waitFor(() => expect(directMessageManager.cryptoState.value).toBe('noPassword'));

		await sendConnectionState({
			account: CreateAccount(username, {
				...passkeyCryptoKey,
				salt: 'password-salt',
			}),
			character: null,
			passkeyUnlock: {
				cryptoKey: passkeyCryptoKey,
				wrappingSecret,
			},
		});
		await waitFor(() => expect(directMessageManager.cryptoState.value).toBe('ready'));

		await serviceManager.destroy();
		await loadServices();
		expect(directMessageManager.cryptoState.value).toBe('notLoaded');

		await sendConnectionState({
			account: CreateAccount(username, {
				...passkeyCryptoKey,
				salt: 'password-salt',
			}),
			character: null,
		});

		await waitFor(() => expect(directMessageManager.cryptoState.value).toBe('ready'));
	});

	async function loadServices(): Promise<void> {
		serviceManager = MockServiceManager();
		Assert(serviceManager.services.directoryConnector != null);
		directoryConnector = serviceManager.services.directoryConnector;
		Assert(serviceManager.services.directMessageManager != null);
		directMessageManager = serviceManager.services.directMessageManager;
		jest.spyOn(directoryConnector, 'awaitResponse').mockResolvedValue({ info: [] });
		await serviceManager.load();
		jest.spyOn(directoryConnector, 'setActiveCharacterInfo').mockImplementation(() => { /* NOOP */ });
	}

	async function sendConnectionState(data: {
		account: IDirectoryAccountInfo;
		character: null;
		passkeyUnlock?: PasskeyDirectMessageUnlock;
	}): Promise<void> {
		const handler = directoryConnector.messageHandlers.connectionState as ((message: typeof data) => void | Promise<void>) | undefined;
		await handler?.(data);
	}
});

function CreateAccount(username: string, cryptoKey: IAccountCryptoKey): IDirectoryAccountInfo {
	return {
		id: 1,
		username,
		displayName: username,
		created: Date.now(),
		spaceOwnershipLimit: 0,
		settings: {},
		settingsCooldowns: {},
		cryptoKey,
	};
}
