import { RenderHookResult } from '@testing-library/react';
import { EMPTY } from 'pandora-common';
import {
	RegisterResponse,
	useCreateNewCharacter,
	useDirectoryPasswordReset,
	useDirectoryPasswordResetConfirm,
	useDirectoryRegister,
	useDirectoryResendVerification,
	useLogin,
	useLogout,
} from '../../src/networking/account_manager';
import { MockDirectoryConnector } from '../mocks/networking/mockDirectoryConnector';
import { MockShardConnector } from '../mocks/networking/mockShardConnector';
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

			const original = window.location;
			const reload = jest.fn();
			Object.defineProperty(window, 'location', {
				value: {
					reload,
				},
				writable: true,
			});

			result.current();
			expect(directoryConnector.logout).toHaveBeenCalledTimes(1);
			// It triggers window reload
			expect(reload).toHaveBeenCalledTimes(1);

			// Restore
			Object.defineProperty(window, 'location', {
				value: original,
				writable: true,
			});
		});
	});

	describe('useCreateNewCharacter', () => {
		it('should return false if character creation was not successful', async () => {
			directoryConnector.awaitResponse.mockResolvedValue({ result: 'failed' });
			const { result } = renderHookWithTestProviders(useCreateNewCharacter);
			expect(await result.current()).toBe(false);
		});

		it('should create a new character successfully', async () => {
			directoryConnector.awaitResponse.mockResolvedValue({ result: 'ok' });
			const { result } = renderHookWithTestProviders(useCreateNewCharacter, { setShardConnector });

			const success = await result.current();
			expect(success).toBe(true);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledTimes(1);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledWith('createCharacter', EMPTY);
		});
	});

	describe('useDirectoryRegister', () => {
		const registerResponses: RegisterResponse[] = [
			'ok',
			'usernameTaken',
			'emailTaken',
			'invalidBetaKey',
		];

		it.each(registerResponses)(
			'should make a register request to the directory with the provided username, password and email [%p]',
			async (response) => {
				await testRegister(
					'test-user',
					'123456',
					'TyVsAI5QPt44dp/57gYlN1U0BhgLBVV6B3rLlRoyXNmD2eL8XlC74qTa9AdNaEcI4k7pA7zYbv38ahQkT3aqQQ==',
					'test@test.com',
					response,
				);
			},
		);

		it.each(registerResponses)(
			'should make a register request to the directory with the provided username, password and email [%p]',
			async (response) => {
				await testRegister(
					'test-user',
					'123456789',
					'i67CRYOrMlOjOcZHXI+hJSbNNnboweM2Ku2utFasNC35HRX4bghzXFS1RHR7BMmaX0CrHn7v6gfrAbEHe4vFPw==',
					'test@test.com',
					response,
					'test-beta-key',
				);
			},
		);

		async function testRegister(
			username: string,
			password: string,
			passwordSha512: string,
			email: string,
			expectedResponse: RegisterResponse,
			betaKey?: string,
		): Promise<void> {
			directoryConnector.awaitResponse.mockResolvedValue({ result: expectedResponse });
			const { result } = renderHookWithTestProviders(useDirectoryRegister);

			const response = await result.current(username, password, email, betaKey);
			expect(response).toBe(expectedResponse);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledTimes(1);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledWith('register', {
				username, passwordSha512, email, betaKey,
			});
		}
	});

	describe('useDirectoryResendVerification', () => {
		it('should make a request to the directory to resend a verification email', async () => {
			directoryConnector.awaitResponse.mockResolvedValue({ result: 'maybeSent' });
			const { result } = renderHookWithTestProviders(useDirectoryResendVerification);

			const response = await result.current('test@test.com');
			expect(response).toBe('maybeSent');
			expect(directoryConnector.awaitResponse).toHaveBeenCalledTimes(1);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledWith(
				'resendVerificationEmail',
				{ email: 'test@test.com' },
			);
		});
	});

	describe('useDirectoryPasswordReset', () => {
		it('should make a password reset request to the directory', async () => {
			directoryConnector.awaitResponse.mockResolvedValue({ result: 'maybeSent' });
			const { result } = renderHookWithTestProviders(useDirectoryPasswordReset);

			const response = await result.current('test@test.com');
			expect(response).toBe('maybeSent');
			expect(directoryConnector.awaitResponse).toHaveBeenCalledTimes(1);
			expect(directoryConnector.awaitResponse).toHaveBeenCalledWith(
				'passwordReset',
				{ email: 'test@test.com' },
			);
		});
	});

	describe('useDirectoryPasswordResetConfirm', () => {
		it.each(['ok', 'unknownCredentials'])(
			'should make a password reset confirmation request to the directory',
			async (directoryResponse) => {
				directoryConnector.awaitResponse.mockResolvedValue({ result: directoryResponse });
				const { result } = renderHookWithTestProviders(useDirectoryPasswordResetConfirm);

				const response = await result.current('test-user', '123456', 'qwerty');
				expect(response).toBe(directoryResponse);
				expect(directoryConnector.awaitResponse).toHaveBeenCalledTimes(1);
				expect(directoryConnector.awaitResponse).toHaveBeenCalledWith('passwordResetConfirm', {
					username: 'test-user',
					token: '123456',
					passwordSha512: '3pxNDzPgVbuz9CUcrKZkup3gCVgXvECda7tiSrTHaoUiDf7E7hjtAtJEFm4tdnlgGV17x+Gm6AxkisMHP3iNrA==',
				});
			},
		);
	});

	function renderHookWithTestProviders<Result, Props>(
		hook: (initialProps?: Props) => Result,
		providerPropOverrides?: Partial<Omit<ProvidersProps, 'children'>>,
	): RenderHookResult<Result, Props> {
		const props = { directoryConnector, shardConnector, setShardConnector, ...providerPropOverrides };
		return RenderHookWithProviders(hook, props);
	}
});
