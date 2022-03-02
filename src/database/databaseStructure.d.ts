declare const enum AccountTokenReason {
	/** Account activation token */
	ACTIVATION = 1,
	/** Account password reset token */
	PASSWORD_RESET = 2,
	/** Account login token */
	LOGIN = 3,
}

interface DatabaseAccountToken {
	/** The token secret */
	value: string;
	/** Time when will this token expire (timestamp from `Date.now()`) */
	expires: number;
	/** The reason for this token */
	reason: AccountTokenReason;
}

interface DatabaseAccountSecure {
	activated: boolean;
	password: string;
	emailHash: string;
	tokens: DatabaseAccountToken[];
}

/** Representation of account stored in database */
interface DatabaseAccount {
	username: string;
	id: number;
	created: number;
	/** Secure account data - should never leave this server; all related to account security */
	secure?: DatabaseAccountSecure;
	characters: import('./databaseProvider').ICharacterSelfInfoDb[];
}

/** Representation of account stored in database */
interface DatabaseAccountWithSecure extends DatabaseAccount {
	/** Secure account data - should never leave this server; all related to account security */
	secure: DatabaseAccountSecure;
}
