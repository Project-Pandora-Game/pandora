import AccountSecure, { GenerateAccountSecureData, GenerateEmailHash } from '../../src/account/accountSecure';
import { InitDatabase } from '../../src/database/databaseProvider';
import GetEmailSender from '../../src/services/email';

describe('GenerateEmailHash()', () => {
	it('should return a string', () => {
		expect(typeof GenerateEmailHash('blabla')).toBe('string');
	});
});

describe('GenerateAccountSecureData()', () => {
	it('should return an object', async () => {
		expect(typeof await GenerateAccountSecureData('pass', 'email', true)).toBe('object');
	});
});

describe('AccountSecure', () => {
	const email = GetEmailSender();
	const mockReset = jest.spyOn(email, 'sendPasswordReset').mockImplementation((_email: string, _username: string, _token: string): Promise<void> => {
		return Promise.resolve();
	});
	const mockRegistration = jest.spyOn(email, 'sendRegistrationConfirmation').mockImplementation((_email: string, _username: string, _token: string): Promise<void> => {
		return Promise.resolve();
	});

	let active: AccountSecure;
	let inactive: AccountSecure;
	beforeAll(async () => {
		await InitDatabase();
		active = new AccountSecure({
			id: 0,
			username: 'active',
		}, await GenerateAccountSecureData('pass', 'email@example.com', true));
		inactive = new AccountSecure({
			id: 1,
			username: 'inactive',
		}, await GenerateAccountSecureData('pass', 'email@example.com', false));
	});

	describe('isActivated()', () => {
		it('should return true for activated account', () => {
			expect(active.isActivated()).toBe(true);
		});

		it('should return false for inactivated account', () => {
			expect(inactive.isActivated()).toBe(false);
		});
	});

	describe('sendActivation()', () => {
		//skips verifyEmail check
		const mockVerify = jest.spyOn(AccountSecure.prototype, 'verifyEmail').mockReturnValue(true);
		afterAll(() => {
			mockVerify.mockRestore();
		});

		it('should not call send email if account is activated', async () => {
			await active.sendActivation('example@example.com');
			expect(mockRegistration.mock.calls.length).toBe(0);
		});
		it('should call email send if account is not activated', async () => {
			await inactive.sendActivation('example@example.com');
			expect(mockRegistration.mock.calls.length).toBe(1);
		});
	});

	describe('activateAccount()', () => {
		it('should return false if activated', async () => {
			expect(await active.activateAccount('anything really')).toBe(false);
		});
	});

	describe('changePassword()', () => {
		it('should false if old password is incorrect', async () => {
			expect(await active.changePassword('meh', 'meh2')).toBe(false);
			expect(await inactive.changePassword('meh', 'meh2')).toBe(false);
		});
		it('should false if account is not activated', async () => {
			expect(await inactive.changePassword('pass', 'pass')).toBe(false);
		});
		it('should true if old password is correct & account is activated', async () => {
			expect(await active.changePassword('pass', 'pass')).toBe(true);
		});
	});

	describe('resetPassword()', () => {
		it('should return false if email is incorrect', async () => {
			expect(await active.resetPassword('wrong@gmail.com')).toBe(false);
			expect(await inactive.resetPassword('wrong@gmail.com')).toBe(false);
		});
		it('should return true if email is correct', async () => {
			expect(await active.resetPassword('email@example.com')).toBe(true);
			expect(await inactive.resetPassword('email@example.com')).toBe(true);
		});

		it('should call email sender for password reset if true', async () => {
			expect(await active.resetPassword('email@example.com')).toBe(true);
			expect(mockReset.mock.calls.length).toBe(1);
			expect(await inactive.resetPassword('email@example.com')).toBe(true);
			expect(mockReset.mock.calls.length).toBe(2);
		});
	});

	describe('finishPasswordReset()', () => {
		it('should return false if token is invalid', async () => {
			expect(await active.finishPasswordReset('invalid token', 'meh')).toBe(false);
			expect(await inactive.finishPasswordReset('invalid token', 'meh')).toBe(false);
		});

		it('should return true if token is valid', async () => {
			await active.resetPassword('email@example.com');
			const token = mockReset.mock.calls[0][2];
			await inactive.resetPassword('email@example.com');
			const token2 = mockReset.mock.calls[1][2];
			expect(await active.finishPasswordReset(token, 'pass')).toBe(true);
			expect(await inactive.finishPasswordReset(token2, 'pass')).toBe(true);
		});
	});

	describe('generateNewLoginToken()', () => {
		it('should return a string', async () => {
			let token = await active.generateNewLoginToken();
			expect(token.expires).toBeGreaterThan(Date.now());
			expect(token.reason).toBe(AccountTokenReason.LOGIN);

			token = await inactive.generateNewLoginToken();
			expect(token.expires).toBeGreaterThan(Date.now());
			expect(token.reason).toBe(AccountTokenReason.LOGIN);
		});
	});

	describe('verifyEmail()', () => {
		it('should return false with wrong email', () => {
			expect(active.verifyEmail('wrong@email.com')).toBe(false);
			expect(inactive.verifyEmail('wrong@email.com')).toBe(false);
		});

		it('should return true with correct email', () => {
			expect(active.verifyEmail('email@example.com')).toBe(true);
			expect(inactive.verifyEmail('email@example.com')).toBe(true);
		});
	});

	describe('verifyEmailHash()', () => {
		it('should return false with wrong email hash', () => {
			expect(active.verifyEmailHash('wronghaha')).toBe(false);
			expect(inactive.verifyEmailHash('wronghaha')).toBe(false);
		});
		it('should return true with correct email hash', () => {
			expect(active.verifyEmailHash(GenerateEmailHash('email@example.com'))).toBe(true);
			expect(inactive.verifyEmailHash(GenerateEmailHash('email@example.com'))).toBe(true);
		});
	});

	describe('verifyPassword()', () => {
		it('should return false with wrong pasword', async () => {
			expect(await active.verifyPassword('wronghaha')).toBe(false);
			expect(await inactive.verifyPassword('wronghaha')).toBe(false);
		});
		it('should return true with correct password', async () => {
			expect(await active.verifyPassword('pass')).toBe(true);
			expect(await inactive.verifyPassword('pass')).toBe(true);
		});
	});

	describe('verifyLoginToken()', () => {
		it('should return false with wrong login token', () => {
			expect(active.verifyLoginToken('wronghaha')).toBe(false);
			expect(inactive.verifyLoginToken('wronghaha')).toBe(false);
		});
		it('should return true with correct login token', async () => {
			const token1 = await active.generateNewLoginToken();
			const token2 = await inactive.generateNewLoginToken();
			expect(active.verifyLoginToken(token1.value)).toBe(true);
			expect(inactive.verifyLoginToken(token2.value)).toBe(true);
		});
	});
});
