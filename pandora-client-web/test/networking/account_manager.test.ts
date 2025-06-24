import { RenderHookResult } from '@testing-library/react';
import { Assert, EMPTY, type ServiceManager } from 'pandora-common';
import {
	RegisterResponse,
	useCreateNewCharacter,
	useDirectoryPasswordReset,
	useDirectoryPasswordResetConfirm,
	useDirectoryRegister,
	useDirectoryResendVerification,
	useLogin,
	useLogout,
} from '../../src/networking/account_manager.ts';
import { DirectoryConnector } from '../../src/networking/directoryConnector.ts';
import type { AccountManager } from '../../src/services/accountLogic/accountManager.ts';
import type { ClientServices } from '../../src/services/clientServices.ts';
import { MockServiceManager, ProvidersProps, RenderHookWithProviders } from '../testUtils.tsx';
const jest = import.meta.jest; // Jest is not properly injected in ESM

describe('Account Manager', () => {
	let serviceManager: ServiceManager<ClientServices>;
	let directoryConnector: DirectoryConnector;
	let accountManager: AccountManager;

	beforeEach(() => {
		serviceManager = MockServiceManager();
		Assert(serviceManager.services.directoryConnector != null);
		directoryConnector = serviceManager.services.directoryConnector;
		Assert(serviceManager.services.accountManager != null);
		accountManager = serviceManager.services.accountManager;
	});

	describe('useLogin', () => {
		it('should login with the provided username and password', async () => {
			await testLogin('test-user', 'password123');
		});

		it('should login with the provided username, password and verification token', async () => {
			await testLogin('test-user', 'password123', '304222');
		});

		async function testLogin(username: string, password: string, verificationToken?: string): Promise<void> {
			const loginMock = jest.spyOn(accountManager, 'login')
				.mockResolvedValue('ok');

			const { result } = renderHookWithTestProviders(useLogin);
			expect(loginMock).not.toHaveBeenCalled();

			const loginResponse = await result.current(username, password, verificationToken);

			expect(loginMock).toHaveBeenCalledTimes(1);
			expect(loginMock).toHaveBeenCalledWith(username, password, verificationToken);
			expect(loginResponse).toBe('ok');
		}
	});

	describe('useLogout', () => {
		it('should logout from the directory', () => {
			const logoutMock = jest.spyOn(accountManager, 'logout');
			const { result } = renderHookWithTestProviders(useLogout);
			expect(logoutMock).not.toHaveBeenCalled();

			const jsdomImplSymbol = Reflect.ownKeys(window.location).find((i) => typeof i === 'symbol')!;
			const reload = jest
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
				.spyOn((window.location as any)[jsdomImplSymbol], 'reload')
				.mockImplementation(() => { /* NOOP */ });
			reload.mockImplementation();

			result.current();
			expect(logoutMock).toHaveBeenCalledTimes(1);
			// It triggers window reload
			expect(reload).toHaveBeenCalledTimes(1);
		});
	});

	describe('useCreateNewCharacter', () => {
		it('should return false if character creation was not successful', async () => {
			jest.spyOn(directoryConnector, 'awaitResponse').mockResolvedValue({ result: 'failed' });
			const { result } = renderHookWithTestProviders(useCreateNewCharacter);
			expect(await result.current()).toBe(false);
		});

		it('should create a new character successfully', async () => {
			const awaitResponseMock = jest.spyOn(directoryConnector, 'awaitResponse')
				.mockResolvedValue({ result: 'ok' });
			const { result } = renderHookWithTestProviders(useCreateNewCharacter);

			const success = await result.current();
			expect(success).toBe(true);
			expect(awaitResponseMock).toHaveBeenCalledTimes(1);
			expect(awaitResponseMock).toHaveBeenCalledWith('createCharacter', EMPTY);
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
					'test-user-display',
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
					'test-user-display',
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
			displayName: string,
			password: string,
			passwordSha512: string,
			email: string,
			expectedResponse: RegisterResponse,
			betaKey?: string,
		): Promise<void> {
			const awaitResponseMock = jest.spyOn(directoryConnector, 'awaitResponse')
				.mockResolvedValue({ result: expectedResponse });
			const { result } = renderHookWithTestProviders(useDirectoryRegister);

			const response = await result.current(username, displayName, password, email, betaKey);
			expect(response).toBe(expectedResponse);
			expect(awaitResponseMock).toHaveBeenCalledTimes(1);
			expect(awaitResponseMock).toHaveBeenCalledWith('register', {
				username, displayName, passwordSha512, email, betaKey,
			});
		}
	});

	describe('useDirectoryResendVerification', () => {
		it('should make a request to the directory to resend a verification email', async () => {
			const awaitResponseMock = jest.spyOn(directoryConnector, 'awaitResponse')
				.mockResolvedValue({ result: 'maybeSent' });
			const { result } = renderHookWithTestProviders(useDirectoryResendVerification);

			const response = await result.current('test@test.com');
			expect(response).toBe('maybeSent');
			expect(awaitResponseMock).toHaveBeenCalledTimes(1);
			expect(awaitResponseMock).toHaveBeenCalledWith(
				'resendVerificationEmail',
				{ email: 'test@test.com' },
			);
		});
	});

	describe('useDirectoryPasswordReset', () => {
		it('should make a password reset request to the directory', async () => {
			const awaitResponseMock = jest.spyOn(directoryConnector, 'awaitResponse')
				.mockResolvedValue({ result: 'maybeSent' });
			const { result } = renderHookWithTestProviders(useDirectoryPasswordReset);

			const response = await result.current('test@test.com');
			expect(response).toBe('maybeSent');
			expect(awaitResponseMock).toHaveBeenCalledTimes(1);
			expect(awaitResponseMock).toHaveBeenCalledWith(
				'passwordReset',
				{ email: 'test@test.com' },
			);
		});
	});

	describe('useDirectoryPasswordResetConfirm', () => {
		it.each(['ok', 'unknownCredentials'] as const)(
			'should make a password reset confirmation request to the directory',
			async (directoryResponse) => {
				const awaitResponseMock = jest.spyOn(directoryConnector, 'awaitResponse')
					.mockResolvedValue({ result: directoryResponse });
				const { result } = renderHookWithTestProviders(useDirectoryPasswordResetConfirm);

				const response = await result.current('test-user', '123456', 'qwerty');
				expect(response).toBe(directoryResponse);
				expect(awaitResponseMock).toHaveBeenCalledTimes(1);
				expect(awaitResponseMock).toHaveBeenCalledWith('passwordResetConfirm', {
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
		return RenderHookWithProviders(hook, { serviceManager, ...providerPropOverrides });
	}
});
