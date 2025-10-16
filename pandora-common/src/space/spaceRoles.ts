import * as z from 'zod';

/**
 * Role of an account inside a space.
 * Note, that lower roles are supersets of higher roles (i.e. all `admin`s are also `allowlisted` and `everyone`)
 */
export const SpaceRoleSchema = z.enum([
	'owner',
	'admin',
	'allowlisted',
	'everyone',
]);
/**
 * Role of an account inside a space.
 * Note, that lower roles are supersets of higher roles (i.e. all `admin`s are also `allowlisted` and `everyone`)
 */
export type SpaceRole = z.infer<typeof SpaceRoleSchema>;

/**
 * Role of an account inside a space.
 * Note, that lower roles are supersets of higher roles (i.e. all `admin`s are also `allowlisted` and `everyone`).
 *
 * `none` is the **highest** role - no one has this role.
 */
export const SpaceRoleOrNoneSchema = SpaceRoleSchema.or(z.literal('none'));
/**
 * Role of an account inside a space.
 * Note, that lower roles are supersets of higher roles (i.e. all `admin`s are also `allowlisted` and `everyone`).
 *
 * `none` is the **highest** role - no one has this role.
 */
export type SpaceRoleOrNone = z.infer<typeof SpaceRoleOrNoneSchema>;

const SPACE_ROLE_ORDERING: Record<SpaceRoleOrNone, number> = {
	none: 5,
	owner: 4,
	admin: 3,
	allowlisted: 2,
	everyone: 1,
};

/**
 * Compares two space roles (or none). Higher role is more specific (none is highest, followed by owner... everyone is lowest).
 * @returns Comparison result as `-1`, `0`, or `1`
 * @example
 * CompareSpaceRoles('owner', 'admin') > 0 // => true (owner > admin)
 */
export function CompareSpaceRoles(a: SpaceRoleOrNone, b: SpaceRoleOrNone): number {
	return Math.sign(SPACE_ROLE_ORDERING[a] - SPACE_ROLE_ORDERING[b]);
}
