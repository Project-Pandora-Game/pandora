/** Definition of an auth token for account login */
interface DatabaseLoginToken {
	/** The token secret */
	token: string;
	/** Time when will this token expire (timestamp from `Date.now()`) */
	expiration: number;
}

declare const enum AccountTokenReason {
	/** Account activation token */
	ACTIVATION = 1,
	/** Account password reset token */
	PASSWORD_RESET = 2,
}

interface DatabaseAccountToken extends DatabaseLoginToken {
	/** The reason for this token */
	reason: AccountTokenReason;
}

interface DatabaseAccountSecure {
	activated: boolean;
	password: string;
	emailHash: string;
	token?: DatabaseAccountToken;
	/** List of auth tokens usable instead of password */
	loginTokens: DatabaseLoginToken[];
}

/** Representation of account stored in database */
interface DatabaseAccount {
	username: string;
	id: number;
	created: number;
	/** Secure account data - should never leave this server; all related to account security */
	secure?: DatabaseAccountSecure;
}

/** Representation of account stored in database */
interface DatabaseAccountWithSecure extends DatabaseAccount {
	/** Secure account data - should never leave this server; all related to account security */
	secure: DatabaseAccountSecure;
}
