import { z } from 'zod';
import { ZodTemplateString } from '../validation';

export const AssetIdSchema = ZodTemplateString<`a/${string}`>(z.string(), /^a\//);
export type AssetId = z.infer<typeof AssetIdSchema>;
