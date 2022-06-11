import { RenderHookResult } from '@testing-library/react';
import { EMPTY, IDirectoryCharacterConnectionInfo } from 'pandora-common';
import {
	DirectoryPasswordReset,
	DirectoryPasswordResetConfirm,
	DirectoryRegister,
	DirectoryResendVerificationMail, useConnectToCharacter,
	useCreateNewCharacter,
	useLogin,
	useLogout,
} from '../../src/networking/account_manager';
import { DirectoryConnector } from '../../src/networking/socketio_directory_connector';
import { MockDirectoryConnector } from '../mocks/networking/mockDirectoryConnector';
import { MockConnectionInfo, MockShardConnector } from '../mocks/networking/mockShardConnector';
import { ProvidersProps, RenderHookWithProviders } from '../testUtils';

describe('Account Manager', () => {
	const setShardConnector = jest.fn();
	let directoryConnector: MockDirectoryConnector;
	let shardConnector: MockShardConnector;

	beforeEach(() => {
		directoryConnector = new MockDirectoryConnector();
		shardConnector = new MockShardConnector();
	});

	describe('useLogin', () => {
		it('should login with the provided username and password', async () => {
			await testLogin('test-user', 'password123');
		});

		it('should login with the provided username, password and verification token', async () => {
			await testLogin('test-user', 'password123', '304222');
		});

		async function testLogin(username: string, password: string, verificationToken?: string): Promise<void> {
			directoryConnector.login.mockResolvedValue('ok');
			const { result } = renderHookWithTestProviders(useLogin);
			expect(directoryConnector.login).not.toHaveBeenCalled();

			const loginResponse = await result.current(username, password, verificationToken);

			expect(directoryConnector.login).toHaveBeenCalledTimes(1);
			expect(directoryConnector.login).toHaveBeenCalledWith(username, password, verificationToken);
			expect(loginResponse).toBe('ok');
		}
	});

	describe('useLogout', () => {
		it('should logout from the directory', () => {
			const { result } = renderHookWithTestProviders(useLogout);
			expect(directoryConnector.logout).not.toHaveBeenCalled();

			result.current();
			expect(directoryConnector.logout).toHaveBeenCalledTimes(1);
		});
	});

	describe('useCreateNewCharacter', () => {
		it('should return false if character creation was not successful', async () => {
			directoryConnector.awaitResponse.mockResolvedValue({ result: 'failed' });
			const { result } = renderHookWithTestProviders(useCreateNewCharacter);
			expect(await result.current()).toBe(false);
		});

		it('should create a new character successfully and connect to the given shard', async () => {
			const connectionInfo = { ...MockConnectionInfo({ id: 'useCreateNewCharacter' }), result: 'ok' };
			directoryConnector.awaitResponse.mockResolvedValue(connectionInfo);
			const { result } = renderHookWithTestProviders(useCreateNewCharacter, { setShardConnector });

			const success = await result.current();
			expect(success).toBe(true);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledTimes(1);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledWith('createCharacter', EMPTY);
			expectNewShardConnection(connectionInfo);
		});
	});

	describe('useConnectToCharacter', () => {
		const characterId = 'c12345';

		it('should return false if the directory was unable to connect to the given character', async () => {
			directoryConnector.awaitResponse.mockResolvedValue({ result: 'failed' });
			const { result } = renderHookWithTestProviders(useConnectToCharacter);
			expect(await result.current(characterId)).toBe(false);
		});

		it('should connect to the given character successfully and connect to the provided shard', async () => {
			const connectionInfo = { ...MockConnectionInfo({ characterId }), result: 'ok' };
			directoryConnector.awaitResponse.mockResolvedValue(connectionInfo);
			const { result } = renderHookWithTestProviders(useConnectToCharacter);

			const success = await result.current(characterId);
			expect(success).toBe(true);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledTimes(1);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledWith('connectCharacter', { id: characterId });
			expectNewShardConnection(connectionInfo);
		});
	});

	function renderHookWithTestProviders<Result, Props>(
		hook: (initialProps?: Props) => Result,
		providerPropOverrides?: Partial<Omit<ProvidersProps, 'children'>>,
	): RenderHookResult<Result, Props> {
		const props = { directoryConnector, shardConnector, setShardConnector, ...providerPropOverrides };
		return RenderHookWithProviders(hook, props);
	}

	function expectNewShardConnection(connectionInfo: IDirectoryCharacterConnectionInfo): void {
		expect(directoryConnector.setShardConnectionInfo).toHaveBeenCalledTimes(1);
		expect(directoryConnector.setShardConnectionInfo).toHaveBeenCalledWith(connectionInfo);
		expect(setShardConnector).toHaveBeenCalledTimes(2);
		const setShardConnectorCalls = setShardConnector.mock.calls;
		expect(setShardConnectorCalls).toEqual([[null], [expect.any(MockShardConnector)]]);
		const newShardConnector = (setShardConnectorCalls[1] as [MockShardConnector])[0];
		expect(newShardConnector).not.toBe(shardConnector);
		expect(newShardConnector.connectionInfo.value).toBe(connectionInfo);
		expect(newShardConnector.connect).toHaveBeenCalledTimes(1);
	}
});

describe('Directory Authentication', () => {
	const mockDirectory = jest.spyOn(DirectoryConnector, 'awaitResponse')
		.mockImplementation(() => Promise.resolve({ result: 'invalidToken' }));

	afterAll(() => {
		mockDirectory.mockRestore();
	});

	describe('DirectoryRegister()', () => {
		it('should emit "register" event to DirectoryConnector.awaitResponse', async () => {

			expect(await DirectoryRegister('tech', 'test', 'test@email.com')).toBe('invalidToken');

			expect(mockDirectory).toBeCalledTimes(1);
			expect(mockDirectory).nthCalledWith(1, 'register', expect.anything());
		});
	});

	describe('DirectoryResendVerificationMail()', () => {
		it('should emit "resendVerificationEmail" event to DirectoryConnector.awaitResponse', async () => {

			expect(await DirectoryResendVerificationMail('test@email.com')).toBe('invalidToken');

			expect(mockDirectory).toBeCalledTimes(1);

			expect(mockDirectory).nthCalledWith(1, 'resendVerificationEmail', expect.anything());
		});
	});

	describe('DirectoryPasswordReset()', () => {
		it('should emit "passwordReset" event to DirectoryConnector.awaitResponse', async () => {

			expect(await DirectoryPasswordReset('test@email.com')).toBe('invalidToken');

			expect(mockDirectory).toBeCalledTimes(1);

			expect(mockDirectory).nthCalledWith(1, 'passwordReset', expect.anything());
		});
	});

	describe('DirectoryPasswordResetConfirm()', () => {
		it('should emit "passwordResetConfirm" event to DirectoryConnector.awaitResponse', async () => {

			expect(await DirectoryPasswordResetConfirm('tech', 'token', 'pass')).toBe('invalidToken');

			expect(mockDirectory).toBeCalledTimes(1);

			expect(mockDirectory).nthCalledWith(1, 'passwordResetConfirm', expect.anything());
		});
	});
});

