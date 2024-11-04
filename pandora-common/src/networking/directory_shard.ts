import type { SocketInterfaceRequest, SocketInterfaceResponse, SocketInterfaceHandlerResult, SocketInterfaceHandlerPromiseResult, SocketInterfaceDefinitionVerified, SocketInterfaceDefinition } from './helpers';
import { CharacterIdSchema } from '../character';
import { SpaceDataSchema, SpaceIdSchema } from '../space/space';
import type { IChatMessageDirectoryAction } from '../chat';
import { z } from 'zod';
import { AccountRoleInfoSchema } from '../account';
import { ZodCast } from '../validation';
import { Satisfies } from '../utility/misc';
import { Immutable } from 'immer';

// Fix for pnpm resolution weirdness
import type { } from '../assets/item/base';

export const ShardAccountDefinitionSchema = z.object({
	id: z.number(),
	roles: AccountRoleInfoSchema.optional(),
});
export type IShardAccountDefinition = z.infer<typeof ShardAccountDefinitionSchema>;

export const ShardCharacterDefinitionSchema = z.object({
	id: CharacterIdSchema,
	account: ShardAccountDefinitionSchema,
	accessId: z.string(),
	/** Secret for client to connect; `null` means this character is only loaded in a space, but not connected to by any client ("offline") */
	connectSecret: z.string().nullable(),
	/** Which space this character is in; `null` means this character is in their personal space */
	space: SpaceIdSchema.nullable(),
});
export type IShardCharacterDefinition = z.infer<typeof ShardCharacterDefinitionSchema>;

export const ShardSpaceDefinitionSchema = SpaceDataSchema.pick({
	id: true,
	config: true,
	accessId: true,
	owners: true,
});
export type IShardSpaceDefinition = z.infer<typeof ShardSpaceDefinitionSchema>;

export const DirectoryShardUpdateSchema = z.object({
	/** List of characters connected to this shard (both outside and in room) */
	characters: ShardCharacterDefinitionSchema.array(),
	/** List of spaces which are loaded on this shard */
	spaces: ShardSpaceDefinitionSchema.array(),
	messages: z.record(SpaceIdSchema, ZodCast<IChatMessageDirectoryAction>().array()),
});
export type IDirectoryShardUpdate = z.infer<typeof DirectoryShardUpdateSchema>;

/** Directory->Shard messages */
export const DirectoryShardSchema = {
	update: {
		request: DirectoryShardUpdateSchema.partial(),
		response: z.object({}),
	},
	stop: {
		request: z.object({}),
		response: z.object({}),
	},
	//#region Space manipulation
	spaceCheckCanEnter: {
		request: z.object({
			character: CharacterIdSchema,
			space: SpaceIdSchema,
		}),
		response: z.object({
			result: z.enum(['ok', 'targetNotFound']),
		}),
	},
	spaceCheckCanLeave: {
		request: z.object({
			character: CharacterIdSchema,
		}),
		response: z.object({
			result: z.enum(['ok', 'targetNotFound', 'restricted', 'inRoomDevice']),
		}),
	},
	//#endregion
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IDirectoryShard = Satisfies<typeof DirectoryShardSchema, SocketInterfaceDefinitionVerified<typeof DirectoryShardSchema>>;
export type IDirectoryShardArgument = SocketInterfaceRequest<IDirectoryShard>;
export type IDirectoryShardResult = SocketInterfaceHandlerResult<IDirectoryShard>;
export type IDirectoryShardPromiseResult = SocketInterfaceHandlerPromiseResult<IDirectoryShard>;
export type IDirectoryShardNormalResult = SocketInterfaceResponse<IDirectoryShard>;
