import { CharacterId, GetLogger, IShardClient, IncomingSocket, IServerSocket, ClientShardSchema, IClientShard, IncomingConnection, ShardClientSchema, AssertNotNullable, Assert } from 'pandora-common';
import { SocketInterfaceRequest, SocketInterfaceResponse } from 'pandora-common/dist/networking/helpers';
import { Character } from '../character/character';
import { CharacterManager } from '../character/characterManager';
import { ConnectionManagerClient } from './manager_client';
import type { IncomingHttpHeaders } from 'http';
import { assetManager } from '../assets/assetManager';
import { ENV } from '../config';
const { ASSETS_SOURCE, SERVER_PUBLIC_ADDRESS } = ENV;

/** Class housing connection from a client */
export class ClientConnection extends IncomingConnection<IShardClient, IClientShard, IncomingSocket> {

	private _aborted: boolean = false;
	public get aborted(): boolean {
		return this._aborted;
	}

	/** Character of the connection, always set by `Character` class */
	public character: Character | null = null;

	public readonly headers: IncomingHttpHeaders;

	constructor(server: IServerSocket<IShardClient>, socket: IncomingSocket, headers: Record<string, undefined | string | string[]>) {
		super(server, socket, [ShardClientSchema, ClientShardSchema], GetLogger('Connection-Client', `[Connection-Client ${socket.id}]`));
		this.headers = headers;
		this.logger.debug('Connected');
		ConnectionManagerClient.onConnect(this);
	}

	/** Handler for when client disconnects */
	protected override onDisconnect(reason: string): void {
		this.character?.setConnection(null);
		this.logger.debug('Disconnected, reason:', reason);
		ConnectionManagerClient.onDisconnect(this);
	}

	public abortConnection(): void {
		if (this._aborted)
			return;
		this._aborted = true;
		this.character?.setConnection(null);
		Assert(this.character == null);
		this.socket.disconnect();
	}

	public loadCharacter(id: CharacterId): boolean {
		const character = CharacterManager.getCharacter(id);
		if (!character) {
			this.logger.error(`Character ${id} not found`);
			this.abortConnection();
			return false;
		}
		character.setConnection(this);
		return true;
	}

	public sendLoadMessage(): void {
		AssertNotNullable(this.character);
		this.sendMessage('load', {
			character: this.character.getPrivateData(),
			globalState: this.character.getGlobalState().currentState.exportToClientBundle(),
			room: this.character.getOrLoadRoom().getLoadData(),
			assetsDefinition: assetManager.rawData,
			assetsDefinitionHash: assetManager.definitionsHash,
			assetsSource: ASSETS_SOURCE || (SERVER_PUBLIC_ADDRESS + '/assets/'),
		});
	}

	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	protected onMessage<K extends keyof IClientShard>(
		messageType: K,
		message: SocketInterfaceRequest<IClientShard>[K],
	): Promise<SocketInterfaceResponse<IClientShard>[K]> {
		return ConnectionManagerClient.onMessage(messageType, message, this);
	}
}
