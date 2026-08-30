import * as z from 'zod';
import { BotIdSchema } from '../../../bots/botBaseTypes.ts';
import { BotDirectoryStateInfoSchema } from '../../../bots/botDirectoryState.ts';
import { Satisfies } from '../../../utility/misc.ts';
import { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from '../../helpers.ts';

/** Directory->API messages */
export const DirectoryApiSchema = {
	//#region Bots

	/** Notifies the API about changes to spaces managed by a bot the connection registered to using `botRunRegister`.
	 * Each such message contains complete data about the bot - any previous state can be discarded.
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 */
	botStateChanged: {
		request: z.object({
			bot: BotIdSchema,
			state: BotDirectoryStateInfoSchema,
		}),
		response: null,
	},

	//#endregion
} as const satisfies SocketInterfaceDefinition;

export type IDirectoryApi = Satisfies<typeof DirectoryApiSchema, SocketInterfaceDefinitionVerified<typeof DirectoryApiSchema>>;
export type IDirectoryApiArgument = SocketInterfaceRequest<IDirectoryApi>;
export type IDirectoryApiResult = SocketInterfaceHandlerResult<IDirectoryApi>;
export type IDirectoryApiPromiseResult = SocketInterfaceHandlerPromiseResult<IDirectoryApi>;
export type IDirectoryApiNormalResult = SocketInterfaceResponse<IDirectoryApi>;
