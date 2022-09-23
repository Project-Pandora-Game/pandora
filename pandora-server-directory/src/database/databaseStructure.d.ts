interface DatabaseAccountToken {
	/** The token secret */
	value: string;
	/** Time when will this token expire (timestamp from `Date.now()`) */
	expires: number;
	/** The reason for this token */
	reason: import('../account/accountSecure').AccountTokenReason;
}

interface GitHubInfo {
	id: number;
	login: string;
	role: 'admin' | 'member' | 'collaborator' | 'none';
	date: number;
}

interface DatabaseAccountSecure {
	activated: boolean;
	password: string;
	emailHash: string;
	tokens: DatabaseAccountToken[];
	github?: GitHubInfo;
	cryptoKey?: string;
}

/** Representation of account stored in database */
interface DatabaseAccount {
	username: string;
	id: number;
	created: number;
	/** Secure account data - should never leave this server; all related to account security */
	secure?: DatabaseAccountSecure;
	roles?: import('pandora-common').IAccountRoleManageInfo;
	characters: import('./databaseProvider').ICharacterSelfInfoDb[];
	settings: import('pandora-common').IDirectoryAccountSettings;
}

/** Representation of account stored in database */
interface DatabaseAccountWithSecure extends DatabaseAccount {
	/** Secure account data - should never leave this server; all related to account security */
	secure: DatabaseAccountSecure;
	roles?: import('pandora-common').IAccountRoleManageInfo;
}

type DatabaseConfig = {
	type: 'shardTokens',
	data: [string, Omit<import('pandora-common').IShardTokenInfo, 'id'> & { token: string; }][];
};
