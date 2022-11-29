import type { IIncomingConnection } from './connection';
import type { SocketInterfaceDefinition, SocketInterfaceOneshotMessages, SocketInterfaceRequest } from './helpers';

export interface IServerSocket<OutboundT extends SocketInterfaceDefinition> {
	sendToAll<K extends SocketInterfaceOneshotMessages<OutboundT>>(client: ReadonlySet<IIncomingConnection<OutboundT>>, messageType: K, message: SocketInterfaceRequest<OutboundT>[K]): void;
}

export class ServerRoom<OutboundT extends SocketInterfaceDefinition> {
	private readonly servers = new Map<IServerSocket<OutboundT>, Set<IIncomingConnection<OutboundT>>>();
	private readonly clients = new Map<string, IServerSocket<OutboundT>>();

	public join(server: IServerSocket<OutboundT>, client: IIncomingConnection<OutboundT>): void {
		if (this.clients.has(client.id)) {
			return;
		}
		const clients = this.servers.get(server);
		if (!clients) {
			this.servers.set(server, new Set([client]));
		} else {
			clients.add(client);
		}
		this.clients.set(client.id, server);
	}

	public leave(client: IIncomingConnection<OutboundT>): void {
		const serverId = this.clients.get(client.id);
		if (!serverId) {
			return;
		}
		this.clients.delete(client.id);
		const clients = this.servers.get(serverId);
		if (!clients) {
			return;
		}
		clients.delete(client);
		if (clients.size === 0) {
			this.servers.delete(serverId);
		}
	}

	public sendMessage<K extends SocketInterfaceOneshotMessages<OutboundT>>(messageType: K, message: SocketInterfaceRequest<OutboundT>[K]): void {
		for (const [server, clients] of this.servers) {
			server.sendToAll(clients, messageType, message);
		}
	}
}
