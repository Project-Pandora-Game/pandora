import { GetLogger, PandoraAccessTokenSchema, Result } from 'pandora-common';
import { InternalApiDirectory } from '../internal/apiDirectory.ts';
import { PandoraApiToken } from './apis/token.ts';
import { WELL_KNOWN_SERVER_ADDRESSES } from './wellKnownServerAddresses.ts';

export type { PandoraApiToken } from './apis/token.ts';

/**
 * The main instance of Pandora Api. Includes connection to the server and all API methods.
 *
 * When you are done using the API, make sure you call `close`.
 * You can also use PandoraApi with `using` (see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#using-declarations-and-explicit-resource-management).
 */
export class PandoraApi implements Disposable {
	private readonly _internal: InternalApiDirectory;

	/** APIs related to working with Pandora tokens. */
	public readonly token: PandoraApiToken;

	private constructor(internal: InternalApiDirectory) {
		this._internal = internal;
		this.token = PandoraApiToken.create(internal);
	}

	/**
	 * Close the API, disconnecting from the server and cancelling any internal tasks.
	 * You cannot use the API after close is called - to continue interacting with Pandora create a new API instance.
	 */
	public close(): void {
		this._internal.close();
	}

	public [Symbol.dispose](): void {
		this.close();
	}

	public static async initAndConnect(options: PandoraApiCreateOptions): Promise<Result<PandoraApi, PandoraApiCreateError>> {
		const parsedToken = PandoraAccessTokenSchema.safeParse(options.token);
		if (!parsedToken.success) {
			return Result.Err('invalidTokenFormat');
		}

		const internalInstance = new InternalApiDirectory();
		await internalInstance.init();
		try {
			await internalInstance.connectToServer(
				options.directoryConnectionAddress ?? WELL_KNOWN_SERVER_ADDRESSES.main,
				parsedToken.data,
			);
		} catch (err) {
			GetLogger('PandoraApi').error('Error connecting to the server:', err);
			internalInstance.close();
			return Result.Err('connectionFailed');
		}

		return Result.Ok(new PandoraApi(internalInstance));
	}
}

export interface PandoraApiCreateOptions {
	/**
	 * Token used to authenticate to Pandora.
	 * You can get a token in Settings → Advanced settings → Access Tokens
	 */
	token: string;
	/**
	 * Address to Directory server to connect to.
	 *
	 * This is useful if you want to connect to local Pandora instance or to PTB for testing.
	 * Connects to main server by default.
	 *
	 * For other well-known values see `WELL_KNOWN_SERVER_ADDRESSES`.
	 *
	 * @default 'https://project-pandora.com/server/directory/api_socket.io'
	 */
	directoryConnectionAddress?: string;
}

/** Possible errors during Pandora API creation */
export type PandoraApiCreateError = 'connectionFailed' | 'invalidTokenFormat';

/**
 * Connect to Pandora's server and return authenticated API instance, ready to be used.
 */
export async function ConnectToPandoraApi(options: PandoraApiCreateOptions): Promise<Result<PandoraApi, PandoraApiCreateError>> {
	return await PandoraApi.initAndConnect(options);
}
