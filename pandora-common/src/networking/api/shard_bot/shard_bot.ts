import * as z from 'zod';
import { AssetsDefinitionFileSchema } from '../../../assets/index.ts';
import { type AssetFrameworkGlobalStateClientBundle } from '../../../assets/state/globalState.ts';
import { BotCommandDescriptorSchema, BotCommandGetStructureResultSchema, BotCommandRunResultSchema } from '../../../bots/index.ts';
import { CharacterIdSchema } from '../../../character/characterTypes.ts';
import { BotPrivateDataSchema, GameStateUpdateSchema, SpaceLoadDataSchema, type IShardClientChangeEvents } from '../../../space/spaceClientData.ts';
import { Satisfies } from '../../../utility/misc.ts';
import { ZodCast } from '../../../validation.ts';
import type { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from '../../helpers.ts';

/** Shard->Bot messages */
export const ShardBotSchema = {

	//#region Space state
	load: {
		request: z.object({
			botPrivate: BotPrivateDataSchema,
			globalState: ZodCast<AssetFrameworkGlobalStateClientBundle>(),
			space: SpaceLoadDataSchema,
			assetsDefinition: AssetsDefinitionFileSchema,
			assetsDefinitionHash: z.string(),
			assetsSource: z.string(),
		}),
		response: null,
	},
	updateBotPrivateData: {
		request: BotPrivateDataSchema.partial(),
		response: null,
	},
	gameStateUpdate: {
		request: GameStateUpdateSchema,
		response: null,
	},
	somethingChanged: {
		request: z.object({
			changes: ZodCast<IShardClientChangeEvents>().array(),
		}),
		response: null,
	},
	//#endregion

	//#region Custom commands
	/**
	 * The client is asking the bot for list of valid commands.
	 * Return list of commands valid for this character.
	 */
	getCharacterCommands: {
		request: z.object({
			id: CharacterIdSchema,
		}),
		response: z.object({
			commands: BotCommandDescriptorSchema.array(),
		}),
	},
	/**
	 * The user wants to run a command.
	 * Supplied are the character that runs it, the command that is being run, and tokenized arguments (based on parsing defined using `getCharacterCommandStructurePart`).
	 *
	 * Return result of the command run.
	 */
	runCharacterCommand: {
		request: z.object({
			id: CharacterIdSchema,
			command: z.string(),
			args: z.string().array(),
		}),
		response: BotCommandRunResultSchema,
	},
	/**
	 * The user is in the process of entering command arguments and client needs parsing and autocomplete information about next argument.
	 * Supplied are the character that does this, the command that is being used, and arguments entered so far _in full_ (excluding the one in progress).
	 *
	 * Return information about which argument comes next, or error.
	 */
	getCharacterCommandStructurePart: {
		request: z.object({
			id: CharacterIdSchema,
			command: z.string(),
			args: z.string().array(),
		}),
		response: BotCommandGetStructureResultSchema,
	},
	//#endregion

} as const satisfies SocketInterfaceDefinition;

export type IShardBot = Satisfies<typeof ShardBotSchema, SocketInterfaceDefinitionVerified<typeof ShardBotSchema>>;
export type IShardBotArgument = SocketInterfaceRequest<IShardBot>;
export type IShardBotResult = SocketInterfaceHandlerResult<IShardBot>;
export type IShardBotPromiseResult = SocketInterfaceHandlerPromiseResult<IShardBot>;
export type IShardBotNormalResult = SocketInterfaceResponse<IShardBot>;
