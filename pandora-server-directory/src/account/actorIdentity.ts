import type { AccountId, AccountRole } from 'pandora-common';

export interface ActorIdentity {
	readonly id: AccountId;
	readonly username: string;
	readonly roles: ActorRoles;
}

export interface ActorRoles {
	isAuthorized(role: AccountRole): boolean;
}
