/** Definition of an auth token for account login */
interface DatabaseLoginToken {
	/** The token secret */
	token: string;
	/** Time when will this token expire (timestamp from `Date.now()`) */
	expiration: number;
}

/** Representation of account stored in database */
interface DatabaseAccount {
	username: string;
	id: number;
	/** Secure account data - should never leave this server; all related to acccount security */
	secure: {
		/** TODO: Plaintext for TESTING ONLY! */
		password: string;
		/** List of auth tokens usable instead of password */
		loginTokens: DatabaseLoginToken[];
	};
}
