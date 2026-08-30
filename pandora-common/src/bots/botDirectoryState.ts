import * as z from 'zod';
import { SpaceIdSchema, type SpaceId } from '../space/space.ts';

/** Maximum length (in characters) of `BotSpaceAssignmentApiData`. */
export const BOT_SPACE_ASSIGNMENT_API_DATA_MAX_LENGTH = 1024;

/**
 * Arbitrary data that API can attach to a (bot;space) combination to mark it in a way opaque to Pandora.
 * This mechanism is optional and can be used by bot orchestrator for any purpose.
 */
export type BotSpaceAssignmentApiData = string;
/** @see {@link BotSpaceAssignmentApiData} */
export const BotSpaceAssignmentApiDataSchema: z.ZodString = z.string().max(BOT_SPACE_ASSIGNMENT_API_DATA_MAX_LENGTH);

/** Information about state of a space assigned to a bot. */
export interface BotSpaceStateInfo {
	/** Id of the space. */
	id: SpaceId;
	/** If the bot has active assignment to this space. If yes, then the specified data is set, otherwise `null` is set. */
	assignment: BotSpaceAssignmentApiData | null;
}
/** Information about state of a space assigned to a bot. */
export const BotSpaceStateInfoSchema: z.ZodType<BotSpaceStateInfo> = z.object({
	id: SpaceIdSchema,
	assignment: BotSpaceAssignmentApiDataSchema.nullable(),
});

/** Information about state of the whole bot that an API connection manages. */
export interface BotDirectoryStateInfo {
	/** All active spaces assigned to this bot (there might be inactive spaces too). */
	spaces: BotSpaceStateInfo[];
}
/** Information about state of the whole bot that an API connection manages. */
export const BotDirectoryStateInfoSchema: z.ZodType<BotDirectoryStateInfo> = z.object({
	spaces: BotSpaceStateInfoSchema.array(),
});

/**
 * Information about how API can connect to a shard with a Space the Bot is running.
 */
export interface BotShardConnectionInfo {
	/** URL to be passed to an BotShardConnector. */
	connectUrl: string;
	/** Secret the connector will use to authenticate to the Shard, alongside the Bot's Id and Space's Id. */
	secret: string;
}
/** @see {@link BotShardConnectionInfo} */
export const BotShardConnectionInfoSchema: z.ZodType<BotShardConnectionInfo> = z.object({
	connectUrl: z.string(),
	secret: z.string(),
});
