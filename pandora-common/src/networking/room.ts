import type { MembersFirstArg } from '../utility';
import type { IConnectionSender } from './connection';
import type { SocketInterfaceDefinition, SocketInterfaceOneshotHandler } from './helpers';

export interface IServerSocket<T extends SocketInterfaceDefinition<T>> {
	sendToAll<K extends keyof SocketInterfaceOneshotHandler<T> & string>(client: ReadonlySet<IConnectionSender<T>>, messageType: K, message: MembersFirstArg<T>[K]): void;
}

export class ServerRoom<T extends SocketInterfaceDefinition<T>> {
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

	sendMessage<K extends keyof SocketInterfaceOneshotHandler<T> & string>(messageType: K, message: MembersFirstArg<T>[K]): void {
		for (const [server, clients] of this.servers) {
			server.sendToAll(clients, messageType, message);
		}
	}
}
