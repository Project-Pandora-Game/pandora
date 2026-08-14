import { Satisfies } from '../../../utility/misc.ts';
import { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from '../../helpers.ts';

/** Directory->API messages */
export const DirectoryApiSchema = {
	// Nothing here yet
} as const satisfies SocketInterfaceDefinition;

export type IDirectoryApi = Satisfies<typeof DirectoryApiSchema, SocketInterfaceDefinitionVerified<typeof DirectoryApiSchema>>;
export type IDirectoryApiArgument = SocketInterfaceRequest<IDirectoryApi>;
export type IDirectoryApiResult = SocketInterfaceHandlerResult<IDirectoryApi>;
export type IDirectoryApiPromiseResult = SocketInterfaceHandlerPromiseResult<IDirectoryApi>;
export type IDirectoryApiNormalResult = SocketInterfaceResponse<IDirectoryApi>;
