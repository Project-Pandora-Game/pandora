import { z } from 'zod';

/**
 * Id of an account
 *
 * @note Normal user accounts start from id `1`, the account `0` is a meta-account for Pandora itself.
 */
export const AccountIdSchema = z.number().int().nonnegative();
/**
 * Id of an account
 *
 * @note Normal user accounts start from id `1`, the account `0` is a meta-account for Pandora itself.
 */
export type AccountId = z.infer<typeof AccountIdSchema>;

export function CompareAccountIds(a: AccountId, b: AccountId): number {
	return a - b;
}

export const AccountManagementDisableInfoSchema = z.object({
	time: z.number(),
	publicReason: z.string(),
	internalReason: z.string(),
	disabledBy: AccountIdSchema,
});
export type AccountManagementDisableInfo = z.infer<typeof AccountManagementDisableInfoSchema>;
