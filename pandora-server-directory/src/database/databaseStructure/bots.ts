import { ArrayToRecordKeys } from 'pandora-common';
import { BotDefinitionSchema } from 'pandora-common/bots';
import * as z from 'zod';

/** Representation of bot stored in database */
export const DatabaseBotSchema = BotDefinitionSchema.extend({
	/** Timestamp of when the bot definition was created. */
	created: z.int().nonnegative(),
	/** Timestamp of when the bot definition was last updated. */
	updated: z.int().nonnegative(),
	/**
	 * Timestamp of last interaction with the bot from API.
	 */
	lastUse: z.number().nullable(),
});
/** Representation of account stored in database */
export type DatabaseBot = z.infer<typeof DatabaseBotSchema>;

export const DATABASE_BOT_UPDATEABLE_PROPERTIES = [
	'name',
	'description',
	'requestedPermissions',
	'private',
	'updated',
	'lastUse',
] as const satisfies readonly (keyof DatabaseBot)[];
export type DatabaseBotUpdateableProperties = (typeof DATABASE_BOT_UPDATEABLE_PROPERTIES)[number];

export const DatabaseBotUpdateSchema = DatabaseBotSchema
	.pick(ArrayToRecordKeys(DATABASE_BOT_UPDATEABLE_PROPERTIES, true))
	.partial()
	.strict();
export type DatabaseBotUpdate = z.infer<typeof DatabaseBotUpdateSchema>;
