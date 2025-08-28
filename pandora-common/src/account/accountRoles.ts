import * as z from 'zod';
import type { KeysMatching } from '../utility/misc.ts';

export type IAccountRoleConfig = {
	/** List of roles that are implied by this one, NOT transitive */
	readonly implies?: readonly AccountRole[];
	/** If this rule can be manually given to someone */
	readonly assignable?: true;
};

//#region List of account roles

const ACCOUNT_ROLES_DEFINITION = {
	'admin': {
		implies: ['lead-developer', 'developer', 'contributor', 'moderator'],
	},
	'lead-developer': {
		implies: ['developer', 'contributor', 'moderator'],
	},
	'developer': {
		implies: ['contributor', 'moderator'],
	},
	'contributor': {
		assignable: true,
	},
	'moderator': {
		assignable: true,
	},
} as const;

//#endregion

export type AccountRole = keyof typeof ACCOUNT_ROLES_DEFINITION;
export const AccountRoleSchema = z.enum(Object.keys(ACCOUNT_ROLES_DEFINITION) as [AccountRole, ...(AccountRole)[]]);

// Both validate and export the config
export const ACCOUNT_ROLES_CONFIG: Readonly<Record<AccountRole, IAccountRoleConfig>> = ACCOUNT_ROLES_DEFINITION;

export type ConfiguredAccountRole = KeysMatching<typeof ACCOUNT_ROLES_DEFINITION, { assignable: true; }>;

export const ConfiguredAccountRoleSchema = z.enum([
	...Object
		.entries(ACCOUNT_ROLES_CONFIG)
		.filter((r): r is [ConfiguredAccountRole, IAccountRoleConfig] => !!r[1].assignable)
		.map((r) => r[0]),
] as [ConfiguredAccountRole, ...(ConfiguredAccountRole)[]]);

// Saved data definitions
export const RoleSelfInfoSchema = z.object({
	expires: z.number().optional(),
});
export type IRoleSelfInfo = z.infer<typeof RoleSelfInfoSchema>;

// changes to this type may require database migration
export type IRoleManageInfo = IRoleSelfInfo & {
	grantedBy: 'GitHub' | { id: number; username: string; };
	grantedAt: number;
};

type IAccountRoleInfoT<T> = Partial<Record<AccountRole, T>>;

export const AccountRoleInfoSchema = z.partialRecord(AccountRoleSchema, RoleSelfInfoSchema);
export type IAccountRoleInfo = z.infer<typeof AccountRoleInfoSchema>;
export type IAccountRoleManageInfo = IAccountRoleInfoT<IRoleManageInfo>;

/**
 * Check if account is authorized with specific role
 * @param held - The roles the account has
 * @param required - Which role is required
 */
export function IsAuthorized(held: IAccountRoleInfoT<{ expires?: number; }> | undefined = {}, required: AccountRole): boolean {
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
