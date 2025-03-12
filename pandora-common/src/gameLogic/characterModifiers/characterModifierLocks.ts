import { z } from 'zod';
import { AssetIdSchema } from '../../assets/base.ts';
import { LockDataBundleSchema, type LockSetup } from '../locks/index.ts';

export interface CharacterModifierLockDefinition {
	name: string;
	lockSetup: LockSetup;
}

export const CharacterModifierLockSchema = z.object({
	lockAsset: AssetIdSchema,
	lockData: LockDataBundleSchema,
});
