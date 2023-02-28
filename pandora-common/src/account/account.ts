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
