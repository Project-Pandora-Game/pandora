import { z } from 'zod';

/** Id of an account */
export const AccountIdSchema = z.number().int().nonnegative();
/** Id of an account */
export type AccountId = z.infer<typeof AccountIdSchema>;
