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
			// Translate well-known names to addresses
			const directoryConnectionName = options.directoryConnectionAddress ?? 'main';
			const directoryConnectionAddress = Object.hasOwn(WELL_KNOWN_SERVER_ADDRESSES, directoryConnectionName) ?
				WELL_KNOWN_SERVER_ADDRESSES[directoryConnectionName as keyof typeof WELL_KNOWN_SERVER_ADDRESSES] :
				directoryConnectionName;

			await internalInstance.connectToServer(
				directoryConnectionAddress,
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
	 * Address to Directory server to connect to. You can use a well-known name (listed below),
	 * or a HTTP(S) URL path to Directory server's api_socket.io.
	 *
	 * This is useful if you want to connect to local Pandora instance or to PTB for testing.
	 * Connects to main server by default.
	 *
	 * Well-known names:
	 * - `'main'` - Main production server.
	 * - `'mainFallback'` - Fallback path to production server. Use sparingly, as it has lower capacity than default path.
	 * - `'ptb'` - Public Test Build server. See https://ptb.project-pandora.com/ for more details.
	 * - `'localDev'` - Default configuration for locally running development server. You can use this if you host your own Pandora instance for development.
	 *
	 * For URLs of well-known values see `WELL_KNOWN_SERVER_ADDRESSES`.
	 *
	 * @default 'main'
	 */
	directoryConnectionAddress?: (keyof typeof WELL_KNOWN_SERVER_ADDRESSES) | (string & {} /* A normal string, but still offer intellisense on well-known values instead of collapsing type */);
}

/** Possible errors during Pandora API creation */
export type PandoraApiCreateError = 'connectionFailed' | 'invalidTokenFormat';

/**
 * Connect to Pandora's server and return authenticated API instance, ready to be used.
 */
export async function ConnectToPandoraApi(options: PandoraApiCreateOptions): Promise<Result<PandoraApi, PandoraApiCreateError>> {
	return await PandoraApi.initAndConnect(options);
}
