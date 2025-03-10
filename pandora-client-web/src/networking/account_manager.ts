import { EMPTY, GetLogger, type IClientDirectoryPromiseResult } from 'pandora-common';
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useDirectoryConnector } from '../components/gameContext/directoryConnectorContextProvider.tsx';
import { PrehashPassword } from '../crypto/helpers.ts';
import { TOAST_OPTIONS_ERROR } from '../persistentToast.ts';
import { useService } from '../services/serviceProvider.tsx';
import { LoginResponse } from './directoryConnector.ts';

//#region Callback type definitions

/**
 * Attempt to login to the directory with a username & password
 * @param username - The username to use
 * @param password - The plaintext password
 * @param verificationToken - The account verification token, if required
 * @returns Promise of the response from the directory
 */
type LoginCallback = (username: string, password: string, verificationToken?: string) => Promise<LoginResponse>;

/**
 * Attempt to create and connect to a new character
 * @returns Promise resolving to a boolean indicating whether or not the creation was successful
 */
type CreateNewCharacterCallback = () => Promise<boolean>;

export type RegisterResponse = 'ok' | 'usernameTaken' | 'emailTaken' | 'invalidBetaKey' | 'invalidCaptcha';

/**
 * Attempt to register a new account with the directory
 * @param username - The username to use
 * @param displayName - The user display name of the account, shown to other users
 * @param password - The plaintext password
 * @param email - A plaintext email
 * @param betaKey - Beta key string, if required
 * @param captchaToken - Captcha token, if required
 * @returns Promise of the response from the directory
 */
type RegisterCallback = (
	username: string,
	displayName: string,
	password: string,
	email: string,
	betaKey?: string,
	captchaToken?: string,
) => Promise<RegisterResponse>;

/**
 * Attempt to request a new verification email
 * @param email - A plaintext email
 * @param captchaToken - Captcha token, if required
 * @returns Promise of response from the directory
 */
type ResendVerificationCallback = (email: string, captchaToken?: string) => Promise<'maybeSent' | 'invalidCaptcha'>;

/**
 * Attempt to request a new verification email
 * @param username - Account username
 * @param password - Account password
 * @param email - Account email
 * @param overrideEmail - Override email
 * @param captchaToken - Captcha token, if required
 */
type ResendVerificationAdvancedCallback = (username: string, password: string, email: string, overrideEmail: boolean, captchaToken?: string) => IClientDirectoryPromiseResult['resendVerificationEmailAdvanced'];

/**
 * Attempt to request a password reset
 * @param email - A plaintext email
 * @param captchaToken - Captcha token, if required
 * @returns Promise of response from the directory
 */
type PasswordResetCallback = (email: string, captchaToken?: string) => Promise<'maybeSent' | 'invalidCaptcha'>;

/**
 * Reset a password using a token
 * @param username - The username to use
 * @param token - The verification token
 * @param password - The plaintext password
 * @returns Promise of response from the directory
 */
type PasswordResetConfirmCallback = (username: string,
	token: string,
	password: string) => Promise<'ok' | 'unknownCredentials'>;

//#endregion

export function useLogin(): LoginCallback {
	const accountManager = useService('accountManager');
	return useCallback((username, password, verificationToken) => {
		return accountManager.login(username, password, verificationToken);
	}, [accountManager]);
}

export function useLogout(): () => void {
	const accountManager = useService('accountManager');
	return useCallback(() => {
		accountManager.logout();
		window.location.reload();
	}, [accountManager]);
}

export function useCreateNewCharacter(): CreateNewCharacterCallback {
	const directoryConnector = useDirectoryConnector();

	return useCallback(async () => {
		const data = await directoryConnector.awaitResponse('createCharacter', EMPTY);
		if (data.result !== 'ok') {
			GetLogger('useCreateNewCharacter').error('Failed to create character:', data);
			toast(`Failed to create character:\n${data.result}`, TOAST_OPTIONS_ERROR);
			return false;
		}
		return true;
	}, [directoryConnector]);
}

export function useDirectoryRegister(): RegisterCallback {
	const directoryConnector = useDirectoryConnector();
	return useCallback(async (username, displayName, password, email, betaKey, captchaToken) => {
		const passwordSha512 = await PrehashPassword(password);
		const result = await directoryConnector.awaitResponse('register', { username, displayName, passwordSha512, email, betaKey, captchaToken });
		return result.result;
	}, [directoryConnector]);
}

export function useDirectoryResendVerification(): ResendVerificationCallback {
	const directoryConnector = useDirectoryConnector();
	return useCallback(async (email, captchaToken) => {
		const result = await directoryConnector.awaitResponse('resendVerificationEmail', { email, captchaToken });
		return result.result;
	}, [directoryConnector]);
}

export function useDirectoryResendVerificationAdvanced(): ResendVerificationAdvancedCallback {
	const directoryConnector = useDirectoryConnector();
	return useCallback(async (username, password, email, overrideEmail, captchaToken) => {
		const passwordSha512 = await PrehashPassword(password);
		return await directoryConnector.awaitResponse('resendVerificationEmailAdvanced', { username, passwordSha512, email, overrideEmail, captchaToken });
	}, [directoryConnector]);
}

export function useDirectoryPasswordReset(): PasswordResetCallback {
	const directoryConnector = useDirectoryConnector();
	return useCallback(async (email, captchaToken) => {
		const result = await directoryConnector.awaitResponse('passwordReset', { email, captchaToken });
		return result.result;
	}, [directoryConnector]);
}

export function useDirectoryPasswordResetConfirm(): PasswordResetConfirmCallback {
	const directoryConnector = useDirectoryConnector();
	return useCallback(async (username, token, password) => {
		const passwordSha512 = await PrehashPassword(password);
		const result = await directoryConnector.awaitResponse('passwordResetConfirm',
			{ username, token, passwordSha512 });
		return result.result;
	}, [directoryConnector]);
}
