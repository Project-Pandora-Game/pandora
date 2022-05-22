import { GetLogger, IClientDirectoryAuthMessage, IDirectoryAccountInfo, IDirectoryCharacterConnectionInfo, IDirectoryClientArgument, IsObject, IsString, PASSWORD_PREHASH_SALT } from 'pandora-common';
import { BrowserStorage } from '../browserStorage';
import { HashSHA512Base64 } from '../crypto/helpers';
import { Observable } from '../observable';
import { DirectoryConnector } from './socketio_directory_connector';
import { ConnectToShard, DisconnectFromShard, ShardConnector } from './socketio_shard_connector';

/** Current username or `null` if not logged in */
export const currentAccount = new Observable<IDirectoryAccountInfo | null>(null);

/** Storage of login authentication token */
export const authToken = BrowserStorage.create<{ value: string, expires: number; username: string; } | undefined>('authToken', undefined, (value) => {
	return IsObject(value) && IsString(value.value) && typeof value.expires === 'number' && value.expires > Date.now();
});

/**
 * Handle incoming `connectionState` message from Directory server
 * @param message - The received message
 */
export function HandleDirectoryConnectionState(message: IDirectoryClientArgument['connectionState']): void {
	HandleDirectoryAccountChange(message.account);
	HandleDirectoryCharacterChange(message.character);
}

export function HandleDirectoryAccountChange(account: IDirectoryAccountInfo | null): void {
	// Update current account
	currentAccount.value = account;
	// Clear saved token if login using it failed
	if (!account) {
		authToken.value = undefined;
	}
}

export function HandleDirectoryCharacterChange(character: IDirectoryCharacterConnectionInfo | null): void {
	if (character) {
		ConnectToShard(character)
			.catch((err) => {
				GetLogger('ConnectionState').fatal('Error while connecting to shard', err);
			});
	} else {
		DisconnectFromShard();
	}
}

/**
 * Get data to use to authenticate to Directory using socket.io auth mechanism
 */
export function GetAuthData(callback: (data: IClientDirectoryAuthMessage | undefined) => void): void {
	const token = authToken.value;
	if (token && token.expires > Date.now()) {
		const connector = ShardConnector.value;
		callback({
			username: token.username,
			token: token.value,
			character: connector ? {
				id: connector.connectionInfo.characterId,
				secret: connector.connectionInfo.secret,
			} : null,
		});
	} else {
		callback(undefined);
	}
}

function PrehashPassword(password: string): Promise<string> {
	return HashSHA512Base64(PASSWORD_PREHASH_SALT + password);
}

export function Logout() {
	DirectoryConnector.sendMessage('logout', { invalidateToken: authToken.value?.value });
	HandleDirectoryConnectionState({
		account: null,
		character: null,
	});
	window.location.reload();
}

/**
 * Attempt to login to Directory and handle response
 * @param username - The username to use for login
 * @param password - The plaintext password to use for login
 * @param verificationToken - Verification token to verify email
 * @returns Promise of response from Directory
 */
export async function DirectoryLogin(username: string, password: string, verificationToken?: string): Promise<'ok' | 'verificationRequired' | 'invalidToken' | 'unknownCredentials'> {
	const passwordSha512 = await PrehashPassword(password);
	const result = await DirectoryConnector.awaitResponse('login', { username, passwordSha512, verificationToken });

	if (result.result === 'ok') {
		authToken.value = { ...result.token, username: result.account.username };
		HandleDirectoryAccountChange(result.account);
	} else {
		HandleDirectoryAccountChange(null);
	}
	return result.result;
}

/**
 * Attempt to register a new account with Directory
 * @param username - The username to use
 * @param password - The plaintext password
 * @param email - A plaintext email
 * @returns Promise of response from Directory
 */
export async function DirectoryRegister(username: string, password: string, email: string): Promise<'ok' | 'usernameTaken' | 'emailTaken'> {
	const passwordSha512 = await PrehashPassword(password);
	const result = await DirectoryConnector.awaitResponse('register', { username, passwordSha512, email });
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
