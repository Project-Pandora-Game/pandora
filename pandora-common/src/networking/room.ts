import type { IConnectionSender } from './connection';
import type { SocketInterfaceDefinition, SocketInterfaceOneshotMessages, SocketInterfaceRequest } from './helpers';

export interface IServerSocket<T extends SocketInterfaceDefinition> {
	sendToAll<K extends SocketInterfaceOneshotMessages<T>>(client: ReadonlySet<IConnectionSender<T>>, messageType: K, message: SocketInterfaceRequest<T>[K]): void;
}

export class ServerRoom<T extends SocketInterfaceDefinition> {
	private readonly servers = new Map<IServerSocket<T>, Set<IConnectionSender<T>>>();
	private readonly clients = new Map<string, IServerSocket<T>>();

	join(server: IServerSocket<T>, client: IConnectionSender<T>): void {
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

	leave(client: IConnectionSender<T>): void {
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

	sendMessage<K extends SocketInterfaceOneshotMessages<T>>(messageType: K, message: SocketInterfaceRequest<T>[K]): void {
		for (const [server, clients] of this.servers) {
			server.sendToAll(clients, messageType, message);
		}
	}
}
