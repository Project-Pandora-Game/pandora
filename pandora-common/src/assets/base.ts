import { z } from 'zod';
import { ZodTemplateString } from '../validation.ts';

export const AssetIdSchema = ZodTemplateString<`a/${string}`>(z.string(), /^a\//);
export type AssetId = z.infer<typeof AssetIdSchema>;
