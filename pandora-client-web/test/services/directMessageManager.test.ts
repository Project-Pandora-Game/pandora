import { waitFor } from '@testing-library/react';
import { Assert, type ServiceManager } from 'pandora-common';
import type { IAccountCryptoKey, IClientDirectoryArgument, IDirectoryAccountInfo } from 'pandora-common/networking/api/directory_client';
import { PrehashPassword } from '../../src/crypto/helpers.ts';
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

	it('keeps passkey login usable but refuses a stale wrapped DM key after replacement', async () => {
		const oldCrypto = await KeyExchange.generate();
		const currentCrypto = await KeyExchange.generate();
		const oldKey = await oldCrypto.export('old-passkey-secret');
		const currentKey = await currentCrypto.export('current-password-secret');

		await sendConnectionState({
			account: CreateAccount('passkey-user', currentKey),
			character: null,
			passkeyUnlock: {
				cryptoKey: oldKey,
				wrappingSecret: 'old-passkey-secret',
			},
		});
		await waitFor(() => expect(directMessageManager.cryptoState.value).toBe('loadError'));
		await expect(directMessageManager.loadKey(currentKey, 'current-password-secret')).resolves.toBe('ok');
		expect(directMessageManager.cryptoState.value).toBe('ready');
	});

	it('confirms the current password before uploading a rewrapped legacy key', async () => {
		const crypto = await KeyExchange.generate();
		await expect(directMessageManager.loadKey(await crypto.export('legacy-secret'), 'legacy-secret')).resolves.toBe('ok');
		const response = jest.spyOn(directoryConnector, 'awaitResponse');
		response.mockResolvedValueOnce({ result: 'ok', expires: Date.now() + 60_000 });
		response.mockResolvedValueOnce({ result: 'ok' });

		await expect(directMessageManager.updateSavedKey('alice', 'current-password')).resolves.toBe(true);
		expect(response).toHaveBeenNthCalledWith(1, 'sudoAuthenticate', {
			passwordSha512: await PrehashPassword('current-password'),
		});
		expect(response.mock.calls[1]?.[0]).toBe('setCryptoKey');
		const upload = response.mock.calls[1]?.[1] as IClientDirectoryArgument['setCryptoKey'] | undefined;
		expect(upload?.allowReset).toBe('same-key');
		expect(upload?.cryptoKey.publicKey).toBe(await crypto.exportPublicKey());
	});

	it('does not upload a rewrapped key if sudo authentication fails', async () => {
		const crypto = await KeyExchange.generate();
		await expect(directMessageManager.loadKey(await crypto.export('legacy-secret'), 'legacy-secret')).resolves.toBe('ok');
		const response = jest.spyOn(directoryConnector, 'awaitResponse');
		response.mockResolvedValueOnce({ result: 'invalidPassword' });

		await expect(directMessageManager.updateSavedKey('alice', 'old-password')).resolves.toBe(false);
		expect(response).toHaveBeenCalledTimes(1);
		expect(response).toHaveBeenCalledWith('sudoAuthenticate', {
			passwordSha512: await PrehashPassword('old-password'),
		});
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
