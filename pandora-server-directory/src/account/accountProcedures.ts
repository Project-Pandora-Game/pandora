import { accountManager } from './accountManager.ts';
import { GenerateEmailHash } from './accountSecure.ts';

/**
 * Create and send password reset email
 * @param email - Plaintext email
 */
export async function AccountProcedurePasswordReset(email: string): Promise<void> {
	const hash = GenerateEmailHash(email);
	const account = await accountManager.loadAccountByEmailHash(hash);
	if (!account)
		return;

	await account.secure.resetPassword(email);
}

/**
 * Create and send a new verification email, if account isn't active
 * @param email - Plaintext email
 */
export async function AccountProcedureResendVerifyEmail(email: string): Promise<void> {
	const hash = GenerateEmailHash(email);
	const account = await accountManager.loadAccountByEmailHash(hash);
	if (!account)
		return;

	await account.secure.sendActivation(email);
}
