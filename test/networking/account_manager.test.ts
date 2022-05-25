import { authToken, currentAccount, DirectoryLogin, DirectoryPasswordReset, DirectoryPasswordResetConfirm, DirectoryRegister, DirectoryResendVerificationMail, GetAuthData, HandleDirectoryAccountChange, HandleDirectoryCharacterChange, Logout } from '../../src/networking/account_manager';
import { IDirectoryAccountInfo, IDirectoryCharacterConnectionInfo } from 'pandora-common';
import * as MockConnector from '../../src/networking/socketio_shard_connector';
import { DirectoryConnector } from '../../src/networking/socketio_directory_connector';
describe('currentAccount', () => {
	it('should defaults to null before login', () => {
		expect(currentAccount.value).toBeNull();
	});
});

describe('authToken', () => {
	it('should defaults to undefined before login', () => {
		expect(authToken.value).toBeUndefined();
	});
});

describe('HandleDirectoryConnectionState()', () => {
	it.todo('should call HandleDirectoryAccountChange and HandleDirectoryCharacterChange');
});

const mockToken = {
	value: 'test',
	expires: Date.now() + 10000,
	username: 'tech',
};

describe('HandleDirectoryAccountChange()', () => {
	it('should update current account', () => {
		const data: IDirectoryAccountInfo = {
			id: 0,
			username: 'test',
			created: 0,
		};
		HandleDirectoryAccountChange(data);
		expect(currentAccount.value).toStrictEqual(data);
		HandleDirectoryAccountChange(null);
		expect(currentAccount.value).toBeNull();
	});

	it('should clear saved token if login failed', () => {
		authToken.value = mockToken;
		HandleDirectoryAccountChange(null);
		expect(authToken.value).toBeUndefined();
	});
});

describe('HandleDirectoryCharacterChange()', () => {
	const mockData: IDirectoryCharacterConnectionInfo = {
		characterId: 'c123',
	} as unknown as IDirectoryCharacterConnectionInfo;
	it('should invoke DisconnectFromShard when character is null', () => {
		const spyDisconnect = jest.spyOn(MockConnector, 'DisconnectFromShard');

		HandleDirectoryCharacterChange(null);
		expect(spyDisconnect).toBeCalledTimes(1);

	});

	it('should invoke ConnectToShard when character is provided', () => {
		const spyConnect = jest.spyOn(MockConnector, 'ConnectToShard')
			.mockImplementation(() => Promise.resolve({} as unknown as MockConnector.SocketIOShardConnector));

		HandleDirectoryCharacterChange(mockData);
		expect(spyConnect).toBeCalledTimes(1);

		spyConnect.mockImplementation(() => Promise.reject('mock connect error'));
		HandleDirectoryCharacterChange(mockData);
		expect(spyConnect).toBeCalledTimes(2);

		spyConnect.mockRestore();
	});
});

describe('GetAuthData()', () => {
	it('should invoke undefined on callback if authToken is undefined', () => {
		const mock = jest.fn();
		GetAuthData(mock);
		expect(mock).toBeCalledTimes(1);
		expect(mock).nthCalledWith(1, undefined);
	});

	it('should invoke callback with authToken data if valid', () => {

		const mock = jest.fn();
		authToken.value = mockToken;
		GetAuthData(mock);
		expect(mock).toBeCalledTimes(1);
		expect(mock).nthCalledWith(1, { username: 'tech', token: 'test', character: null });
	});
});

describe('Logout()', () => {
	it('should logout gracefully', () => {
		expect(() => {
			Logout();
		}).not.toThrow();
	});
});

describe('Directory Authentication', () => {
	const mockDirectory = jest.spyOn(DirectoryConnector, 'awaitResponse')
		.mockImplementation(() => Promise.resolve({ result: 'invalidToken' }));

	afterAll(() => {
		mockDirectory.mockRestore();
	});
	describe('DirectoryLogin()', () => {
		it('should emit "login" event to DirectoryConnector.awaitResponse', async () => {

			expect(await DirectoryLogin('tech', 'test')).toBe('invalidToken');
			expect(mockDirectory).toBeCalledTimes(1);
			expect(mockDirectory).nthCalledWith(1, 'login', expect.anything());
		});
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

