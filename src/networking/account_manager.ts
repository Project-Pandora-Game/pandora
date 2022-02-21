import { IDirectoryClientArgument, IsObject, PASSWORD_PREHASH_SALT } from 'pandora-common';
import { BrowserStorage } from '../browserStorage';
import { Observable } from '../observable';
import { DirectoryConnector } from './socketio_directory_connector';

/** Current username or `null` if not logged in */
export const currentAccount = new Observable<string | null>(null);

/** Storage of login authentication token */
const authToken = new BrowserStorage<{ username: string; token: string; } | null>('authToken', null, IsObject);

/**
 * Handle incoming `connectionState` message from Directory server
 * @param message - The received message
 */
export function HandleDirectoryConnectionState(message: IDirectoryClientArgument['connectionState']): void {
	// Update current account
	currentAccount.value = message.account;
	// Clear saved token if login using it failed
	if (!message.account) {
		authToken.set(null);
	}
}

/**
 * Get data to use to authenticate to Directory using socket.io auth mechanism
 */
export function GetAuthData(callback: (data: unknown) => void): void {
	const token = authToken.get();
	if (token) {
		callback(token);
	} else {
		callback({});
	}
}

async function HashSHA512Base64(text: string): Promise<string> {
	const msgUint8 = new TextEncoder().encode(text);
	const hashBuffer = await globalThis.crypto.subtle.digest('SHA-512', msgUint8);
	const hashArray = new Uint8Array(hashBuffer);
	return btoa(String.fromCharCode.apply(null, Array.from(hashArray)));
}

function PrehashPassword(password: string): Promise<string> {
	return HashSHA512Base64(PASSWORD_PREHASH_SALT + password);
}

export function Logout() {
	const currentToken = authToken.get();
	DirectoryConnector.sendMessage('logout', { invalidateToken: currentToken ? currentToken.token : undefined });
	authToken.set(null);
	currentAccount.value = null;
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
	// On success
	if (result.result === 'ok' && result.token && result.update.account) {
		authToken.set({
			username: result.update.account,
			token: result.token,
		});
	}
	// Handle the current login state
	HandleDirectoryConnectionState(result.update);
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
