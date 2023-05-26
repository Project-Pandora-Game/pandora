/** HTTP path the shard connects to when connecting to Directory */
export const HTTP_SOCKET_IO_SHARD_PATH: string = '/pandora_shard_socket.io';
/** Name of HTTP header containing Shard's shared secret to authenticate to Directory */
export const HTTP_HEADER_SHARD_SECRET: string = 'Pandora-Shard-Secret';
/**
 * Name of HTTP header containing Shard that connecting client is connected to.
 * Used to allow client to wait before shard reconnects after Directory restart
 */
export const HTTP_HEADER_CLIENT_REQUEST_SHARD: string = 'Pandora-Requested-Shard';
/** Default acknowledgment timeout in seconds */
export const DEFAULT_ACK_TIMEOUT: number = 15_000;

/** Toggle, if all messages should be logged. Should ALWAYS be `false` in production! */
export const MESSAGE_HANDLER_DEBUG_ALL: boolean = false;
/** Set of message types that should be logged */
export const MESSAGE_HANDLER_DEBUG_MESSAGES = new Set<string>();
