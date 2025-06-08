import { TypedEventEmitter, type ITypedEventEmitter } from '../event.ts';
import type { IIncomingConnection } from './connection.ts';
import type { SocketInterfaceDefinition, SocketInterfaceOneshotMessages, SocketInterfaceRequest } from './helpers.ts';

export interface IServerSocket<OutboundT extends SocketInterfaceDefinition> {
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

	public get clients(): ClientT[] {
		return [...this._servers.values()].flatMap((clients) => [...clients.values()]);
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
		for (const [server, clients] of this._servers) {
			server.sendToAll(clients, messageType, message);
		}
	}
}
