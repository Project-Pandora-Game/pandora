export interface DatabaseAccountToken {
	/** The token secret */
	value: string;
	/** Time when will this token expire (timestamp from `Date.now()`) */
	expires: number;
	/** The reason for this token */
	reason: import('../account/accountSecure').AccountTokenReason;
}

export interface GitHubInfo {
	id: number;
	login: string;
	role: 'admin' | 'member' | 'collaborator' | 'none';
	date: number;
	teams?: import('../services/github/githubVerify').GitHubTeam[];
}

export interface DatabaseAccountSecure {
	activated: boolean;
	password: string;
	emailHash: string;
	tokens: DatabaseAccountToken[];
	github?: GitHubInfo;
	cryptoKey?: import('pandora-common').IAccountCryptoKey;
}

/** Direct message key create from the 2 accounts' id where the first is always the lowest */
export type DirectMessageAccounts = `${number}-${number}`;

export type DatabaseDirectMessageInfo = import('pandora-common').IDirectoryDirectMessageInfo & {
	/** Flag to indicate the conversation was closed and the info should not be sent to the account */
	closed?: true;
};

/** Representation of account stored in database */
export interface DatabaseAccount {
	username: string;
	id: number;
	created: number;
	/** Secure account data - should never leave this server; all related to account security */
	secure?: DatabaseAccountSecure;
	roles?: import('pandora-common').IAccountRoleManageInfo;
	characters: import('./databaseProvider').ICharacterSelfInfoDb[];
	settings: import('pandora-common').IDirectoryAccountSettings;
	directMessages?: DatabaseDirectMessageInfo[];
}

export type DatabaseAccountRelationship = {
	type: 'friend' | 'mutualBlock';
} | {
	type: 'request' | 'oneSidedBlock';
	from: import('pandora-common').AccountId;
};

export interface DatabaseRelationship {
	accounts: [import('pandora-common').AccountId, import('pandora-common').AccountId];
	updated: number;
	relationship: DatabaseAccountRelationship;
}

/** Representation of account stored in database */
export interface DatabaseAccountWithSecure extends DatabaseAccount {
	/** Secure account data - should never leave this server; all related to account security */
	secure: DatabaseAccountSecure;
	roles?: import('pandora-common').IAccountRoleManageInfo;
}

export type DatabaseConfig = {
	shardTokens: (import('pandora-common').IShardTokenInfo & { token: string; })[];
	betaKeys: (import('pandora-common').IBetaKeyInfo & { token: string; })[];
};

export type DatabaseConfigType = keyof DatabaseConfig;
export type DatabaseConfigData<T extends DatabaseConfigType> = DatabaseConfig[T];
