import type { KeysMatching } from '../utility';
import { CreateOneOfValidator } from '../validation';

export type IAccountRoleConfig = {
	/** List of roles that are implied by this one, NOT transitive */
	readonly implies?: readonly AccountRole[];
	/** If this rule can be manually given to someone */
	readonly assignable?: true;
};

//#region List of account roles

const ACCOUNT_ROLES_DEFINITION = {
	admin: {
		implies: ['developer', 'contributor', 'moderator'],
	},
	developer: {
		implies: ['contributor', 'moderator'],
	},
	contributor: {},
	moderator: {
		assignable: true,
	},
} as const;

//#endregion

export type AccountRole = keyof typeof ACCOUNT_ROLES_DEFINITION;

export const IsAccountRole = CreateOneOfValidator<AccountRole>(
	...(Object.keys(ACCOUNT_ROLES_DEFINITION) as AccountRole[]),
);

// Both validate and export the config
export const ACCOUNT_ROLES_CONFIG: Readonly<Record<AccountRole, IAccountRoleConfig>> = ACCOUNT_ROLES_DEFINITION;

export type ConfiguredAccountRole = KeysMatching<typeof ACCOUNT_ROLES_DEFINITION, { assignable: true; }>;

export const IsConfiguredAccountRole = CreateOneOfValidator<ConfiguredAccountRole>(
	...Object
		.entries(ACCOUNT_ROLES_CONFIG)
		.filter((r): r is [ConfiguredAccountRole, IAccountRoleConfig] => !!r[1].assignable)
		.map((r) => r[0]),
);

// Saved data definitions
export type IRoleSelfInfo = {
	expires?: number;
};

export type IRoleManageInfo = IRoleSelfInfo & {
	grantedBy: 'GitHub' | { id: number; username: string; };
	grantedAt: number;
};

type IAccountRoleInfoT<T> = Partial<Record<AccountRole, T>>;

export type IAccountRoleInfo = IAccountRoleInfoT<IRoleSelfInfo>;
export type IAccountRoleManageInfo = IAccountRoleInfoT<IRoleManageInfo>;

/**
 * Check if account is authorized with specific role
 * @param held - The roles the account has
 * @param required - Which role is required
 */
export function IsAuthorized(held: IAccountRoleInfoT<{ expires?: number; }>, required: AccountRole): boolean {
	const now = Date.now();
	for (const [role, { expires }] of Object.entries(held)) {
		// Skip expired roles
		if (expires !== undefined && expires < now) {
			continue;
		}
		// Role is the one we want or it implies the role we want
		if (role === required || ACCOUNT_ROLES_CONFIG[role as AccountRole]?.implies?.includes(required)) {
			return true;
		}
	}
	return false;
}
