import { CharacterId, EMPTY, GetLogger, PASSWORD_PREHASH_SALT } from 'pandora-common';
import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { useDirectoryConnector } from '../components/gameContext/directoryConnectorContextProvider';
import { useConnectToShard } from '../components/gameContext/shardConnectorContextProvider';
import { HashSHA512Base64 } from '../crypto/helpers';
import { LoginResponse } from './directoryConnector';
import { DirectoryConnector } from './socketio_directory_connector';

export function PrehashPassword(password: string): Promise<string> {
	return HashSHA512Base64(PASSWORD_PREHASH_SALT + password);
}

export function useLogin(): (username: string, password: string, verificationToken?: string) => Promise<LoginResponse> {
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

export function useCreateNewCharacter(): () => Promise<boolean> {
	const directoryConnector = useDirectoryConnector();
	const connectToShard = useConnectToShard();

	return useCallback(async () => {
		const data = await directoryConnector.awaitResponse('createCharacter', EMPTY);
		if (data.result !== 'ok') {
			GetLogger('useCreateNewCharacter').error('Failed to create character:', data);
			toast(`Failed to create character:\n${data.result}`, {
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

export function useConnectToCharacter(): (id: CharacterId) => Promise<boolean> {
	const directoryConnector = useDirectoryConnector();
	const connectToShard = useConnectToShard();

	return useCallback(async (id) => {
		const data = await directoryConnector.awaitResponse('connectCharacter', { id });
		if (data.result !== 'ok') {
			GetLogger('useConnectToCharacter').error('Failed to connect to character:', data);
			toast(`Failed to connect to character:\n${data.result}`, {
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

/**
 * Attempt to register a new account with Directory
 * @param username - The username to use
 * @param password - The plaintext password
 * @param email - A plaintext email
 * @returns Promise of response from Directory
 */
export async function DirectoryRegister(username: string, password: string, email: string, betaKey?: string): Promise<'ok' | 'usernameTaken' | 'emailTaken' | 'invalidBetaKey'> {
	const passwordSha512 = await PrehashPassword(password);
	const result = await DirectoryConnector.awaitResponse('register', { username, passwordSha512, email, betaKey });
	return result.result;
}

/**
 * Attempt to request a new verification email
 * @param email - A plaintext email
 * @returns Promise of response from Directory
 */
export async function DirectoryResendVerificationMail(email: string): Promise<'maybeSent'> {
	const result = await DirectoryConnector.awaitResponse('resendVerificationEmail', { email });
	return result.result;
}

/**
 * Attempt to request a password reset
 * @param email - A plaintext email
 * @returns Promise of response from Directory
 */
export async function DirectoryPasswordReset(email: string): Promise<'maybeSent'> {
	const result = await DirectoryConnector.awaitResponse('passwordReset', { email });
	return result.result;
}

/**
 * Reset a password using a token
 * @param username - The username to use
 * @param token - The verification token
 * @param password - The plaintext password
 * @returns Promise of response from Directory
 */
export async function DirectoryPasswordResetConfirm(username: string, token: string, password: string): Promise<'ok' | 'unknownCredentials'> {
	const passwordSha512 = await PrehashPassword(password);
	const result = await DirectoryConnector.awaitResponse('passwordResetConfirm', { username, token, passwordSha512 });
	return result.result;
}
