import { HTTP_SOCKET_IO_API_PATH } from 'pandora-common';

/**
 * Addresses to well-known official (or testing) servers.
 *
 * These URLs can be directly used in `ConnectToPandoraApi`'s `directoryConnectionAddress` option to connect to specified server.
 */
export const WELL_KNOWN_SERVER_ADDRESSES = {
	/** Main production server. Default. */
	main: 'https://project-pandora.com/server/directory/' + HTTP_SOCKET_IO_API_PATH,
	/** Fallback path to production server. Use sparingly, as it has lower capacity than default path. */
	mainFallback: 'https://fallback.project-pandora.com/server/directory/' + HTTP_SOCKET_IO_API_PATH,
	/** Public Test Build server. See https://ptb.project-pandora.com/ for more details. */
	ptb: 'https://ptb.project-pandora.com/server/directory/' + HTTP_SOCKET_IO_API_PATH,
	/** Default configuration for locally running development server. You can use this if you host your own Pandora instance for development. */
	localDev: 'http://localhost:25560/' + HTTP_SOCKET_IO_API_PATH,
} as const satisfies Record<string, string>;
