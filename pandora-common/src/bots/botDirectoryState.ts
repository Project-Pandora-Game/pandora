import * as z from 'zod';
import { SpaceIdSchema, type SpaceId } from '../space/space.ts';

/** Maximum length (in characters) of `BotSpaceAssignmentApiData`. */
export const BOT_SPACE_ASSIGNMENT_API_DATA_MAX_LENGTH = 1024;

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

/** Information about state of a space assigned to a bot. */
export interface BotSpaceStateInfo {
	/** Id of the space. */
	id: SpaceId;
	connection: BotShardConnectionInfo | null;
}
/** Information about state of a space assigned to a bot. */
export const BotSpaceStateInfoSchema: z.ZodType<BotSpaceStateInfo> = z.object({
	id: SpaceIdSchema,
	connection: BotShardConnectionInfoSchema.nullable(),
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
