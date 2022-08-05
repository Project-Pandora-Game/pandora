import { CharacterId, EMPTY, GetLogger } from 'pandora-common';
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useDirectoryConnector } from '../components/gameContext/directoryConnectorContextProvider';
import { useConnectToShard } from '../components/gameContext/shardConnectorContextProvider';
import { PrehashPassword } from '../crypto/helpers';
import { LoginResponse } from './directoryConnector';

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

/**
 * Attempt to connect to a character by character ID
 * @param id - The ID of the character to connect to
 * @returns Promise resolving to a boolean indicating whether or not the connection was successful
 */
type ConnectToCharacterCallback = (id: CharacterId) => Promise<boolean>;

export type RegisterResponse = 'ok' | 'usernameTaken' | 'emailTaken' | 'invalidBetaKey';

/**
 * Attempt to register a new account with the directory
 * @param username - The username to use
 * @param password - The plaintext password
 * @param email - A plaintext email
 * @param betaKey - Beta key string, if required
 * @returns Promise of the response from the directory
 */
type RegisterCallback = (
	username: string,
	password: string,
	email: string,
	betaKey?: string,
) => Promise<RegisterResponse>;

/**
 * Attempt to request a new verification email
 * @param email - A plaintext email
 * @returns Promise of response from the directory
 */
type ResendVerificationCallback = (email: string) => Promise<'maybeSent'>;

/**
 * Attempt to request a password reset
 * @param email - A plaintext email
 * @returns Promise of response from the directory
 */
type PasswordResetCallback = (email: string) => Promise<'maybeSent'>;

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
	const directoryConnector = useDirectoryConnector();
	return useCallback((username, password, verificationToken) => {
		return directoryConnector.login(username, password, verificationToken);
	}, [directoryConnector]);
}

export function useLogout(): () => void {
	const directoryConnector = useDirectoryConnector();
	return useCallback(() => {
		directoryConnector.logout();
		window.location.reload();
	}, [directoryConnector]);
}

export function useCreateNewCharacter(): CreateNewCharacterCallback {
	const directoryConnector = useDirectoryConnector();
	const connectToShard = useConnectToShard();

	return useCallback(async () => {
		const data = await directoryConnector.awaitResponse('createCharacter', EMPTY);
		if (data.result !== 'ok') {
			GetLogger('useCreateNewCharacter').error('Failed to create character:', data);
			toast(`Failed to create character:\n${ data.result }`, {
				type: 'error',
				autoClose: 10_000,
				closeOnClick: true,
				closeButton: true,
				draggable: true,
			});
			return false;
		}
		await connectToShard(data);
		return true;
	}, [directoryConnector, connectToShard]);
}

export function useConnectToCharacter(): ConnectToCharacterCallback {
	const directoryConnector = useDirectoryConnector();
	const connectToShard = useConnectToShard();

	return useCallback(async (id) => {
		const data = await directoryConnector.awaitResponse('connectCharacter', { id });
		if (data.result !== 'ok') {
			GetLogger('useConnectToCharacter').error('Failed to connect to character:', data);
			toast(`Failed to connect to character:\n${ data.result }`, {
				type: 'error',
				autoClose: 10_000,
				closeOnClick: true,
				closeButton: true,
				draggable: true,
			});
			return false;
		}
		await connectToShard(data);
		return true;
	}, [directoryConnector, connectToShard]);
}

export function useDirectoryRegister(): RegisterCallback {
	const directoryConnector = useDirectoryConnector();
	return useCallback(async (username, password, email, betaKey) => {
		const passwordSha512 = await PrehashPassword(password);
		const result = await directoryConnector.awaitResponse('register', { username, passwordSha512, email, betaKey });
		return result.result;
	}, [directoryConnector]);
}

export function useDirectoryResendVerification(): ResendVerificationCallback {
	const directoryConnector = useDirectoryConnector();
	return useCallback(async (email) => {
		const result = await directoryConnector.awaitResponse('resendVerificationEmail', { email });
		return result.result;
	}, [directoryConnector]);
}

export function useDirectoryPasswordReset(): PasswordResetCallback {
	const directoryConnector = useDirectoryConnector();
	return useCallback(async (email) => {
		const result = await directoryConnector.awaitResponse('passwordReset', { email });
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
