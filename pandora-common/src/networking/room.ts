import { isEqual } from 'lodash-es';
import { TypedEventEmitter, type ITypedEventEmitter } from '../event.ts';
import type { Logger } from '../logging/logger.ts';
import { MESSAGE_HANDLER_DEBUG_ALL, MESSAGE_HANDLER_DEBUG_MESSAGES } from './config.ts';
import type { IIncomingConnection } from './connection.ts';
import type { SocketInterfaceDefinition, SocketInterfaceOneshotMessages, SocketInterfaceRequest } from './helpers.ts';

export interface IServerSocket<OutboundT extends SocketInterfaceDefinition> {
	/**
	 * Send provided message to all given clients.
	 * Only clients from this server can be passed.
	 * The message must already be validated before send.
	 */
	sendToAll<K extends SocketInterfaceOneshotMessages<OutboundT>>(client: ReadonlySet<IIncomingConnection<OutboundT>>, messageType: K, message: SocketInterfaceRequest<OutboundT>[K]): void;
}

type ServerRoomEvents<ClientT> = {
	join: ClientT;
	leave: ClientT;
};

export interface IServerRoom<OutboundT extends SocketInterfaceDefinition, out ClientT extends IIncomingConnection<OutboundT> = IIncomingConnection<OutboundT>> extends ITypedEventEmitter<ServerRoomEvents<ClientT>> {
	readonly clients: ClientT[];

	hasClients(): boolean;
	leave(client: IIncomingConnection<OutboundT>): void;

	sendMessage<K extends SocketInterfaceOneshotMessages<OutboundT>>(messageType: K, message: SocketInterfaceRequest<OutboundT>[K]): void;
}

export class ServerRoom<OutboundT extends SocketInterfaceDefinition, ClientT extends IIncomingConnection<OutboundT> = IIncomingConnection<OutboundT>> extends TypedEventEmitter<ServerRoomEvents<ClientT>> implements IServerRoom<OutboundT, ClientT> {
	private readonly _servers = new Map<IServerSocket<OutboundT>, Set<ClientT>>();
	private readonly _clients = new Map<string, IServerSocket<OutboundT>>();

	protected readonly logger: Logger;
	protected readonly _roomOutboundSchema: OutboundT | null;

	public get clients(): ClientT[] {
		return [...this._servers.values()].flatMap((clients) => [...clients.values()]);
	}

	constructor(logger: Logger, schema: OutboundT | 'DO_NOT_VALIDATE_DATA') {
		super();
		this.logger = logger;
		this._roomOutboundSchema = schema === 'DO_NOT_VALIDATE_DATA' ? null : schema;
	}

	public hasClients(): boolean {
		return this._servers.size > 0;
	}

	public join(client: ClientT): void {
		const server = client.socketServer;
		if (this._clients.has(client.id)) {
			return;
		}
		const clients = this._servers.get(server);
		if (!clients) {
			this._servers.set(server, new Set([client]));
		} else {
			clients.add(client);
		}
		this._clients.set(client.id, server);
		client._internalRooms.add(this);
		this.emit('join', client);
	}

	public leave(client: ClientT): void {
		client._internalRooms.delete(this);
		const serverId = this._clients.get(client.id);
		if (!serverId) {
			return;
		}

		const clients = this._servers.get(serverId);
		if (clients) {
			clients.delete(client);
			if (clients.size === 0) {
				this._servers.delete(serverId);
			}
		}

		if (this._clients.delete(client.id)) {
			this.emit('leave', client);
		}
	}

	public sendMessage<K extends SocketInterfaceOneshotMessages<OutboundT>>(messageType: K, message: SocketInterfaceRequest<OutboundT>[K]): void {
		// If we have schema, validate sent message
		if (this._roomOutboundSchema) {
			if (!Object.hasOwn(this._roomOutboundSchema, messageType) || this._roomOutboundSchema[messageType].response !== null) {
				this.logger.error(`Attempt to send unknown message type '${messageType}', dropped.\n`, new Error());
				return;
			}

			const schema: OutboundT[K]['request'] = this._roomOutboundSchema[messageType].request;
			const result = schema.safeParse(message);

			if (!result.success) {
				this.logger.error(`Attempt to send invalid message '${messageType}', dropped.\n`, new Error(), '\n', result.error);
				return;
			} else if (!isEqual(message, result.data)) {
				this.logger.warning(`Message '${messageType}' updated before send:\n`, JSON.stringify(message), '\n->\n', JSON.stringify(result.data), '\nTrace:', new Error());
			}
			// Replace message with parsed result, as it might have stripped some data
			message = result.data;
		}
		if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
			this.logger.debug(`\u25B2 message '${messageType}':`, message);
		}

		// Send the message; once per server, with each server type handling optimized broadcasting themselves
		for (const [server, clients] of this._servers) {
			server.sendToAll(clients, messageType, message);
		}
	}
}
