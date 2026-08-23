import * as z from 'zod';
import { AccountIdSchema, type AccountId } from '../account/account.ts';
import { LIMIT_SPACE_DESCRIPTION_LENGTH } from '../inputLimits.ts';
import type { ZodObjectShape } from '../validation.ts';
import { BotIdSchema, BotNameSchema, PandoraBotSpacePermissionListSchema, type BotId, type BotName, type PandoraBotSpacePermissionList } from './botBaseTypes.ts';

/** Public definition of a bot assignable to a space. */
export interface BotDefinition {
	/** Unique ID of the bot. */
	id: BotId;
	/** Developer-specified name of the bot (might not be unique). */
	name: BotName;
	/** Developer-specified description of the bot. */
	description: string;
	/** Which pandora (bot-developer) account owns this bot. */
	ownerAccount: AccountId;
	/**
	 * Which permissions the bot requests when it is being added to a space.
	 * These permissions might or might not be granted by the space admin assigning the bot.
	 *
	 * Permissions not on this list cannot be given to the bot and are automatically removed on existing assigned spaces.
	 * Newly added requested permissions are not automatically added to existing assigned spaces.
	 */
	requestedPermissions: PandoraBotSpacePermissionList;
	/** If set, then this bot is private. This means that only the bot owner account can see it in bot list and assign it to spaces. */
	private: boolean;
}
/** Public definition of a bot assignable to a space. */
export const BotDefinitionSchema: z.ZodObject<ZodObjectShape<BotDefinition>> = z.object({
	id: BotIdSchema,
	name: BotNameSchema,
	description: z.string().max(LIMIT_SPACE_DESCRIPTION_LENGTH),
	ownerAccount: AccountIdSchema,
	requestedPermissions: PandoraBotSpacePermissionListSchema,
	private: z.boolean(),
});

/** Developer-specified configuration of a bot */
export type BotConfig = Pick<BotDefinition, 'name' | 'description' | 'requestedPermissions' | 'private'>;
export const BotConfigSchema: z.ZodObject<ZodObjectShape<BotConfig>> = BotDefinitionSchema.pick({
	name: true,
	description: true,
	requestedPermissions: true,
	private: true,
} satisfies { [p in keyof BotConfig]: true });
