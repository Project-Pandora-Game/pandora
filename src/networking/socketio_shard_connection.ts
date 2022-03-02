import type { Socket } from 'socket.io';
import { CharacterId, GetLogger, IShardDirectoryArgument, ShardInfo } from 'pandora-common';
import { ConnectionType, IConnectionShard } from './common';
import { SocketIOConnection } from './socketio_common_connection';
import ConnectionManagerShard from './manager_shard';
import { accountManager } from '../account/accountManager';
import { Account } from '../account/account';
import { GetDatabase } from '../database/databaseProvider';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IDirectoryShard { } // TODO Implement this in panda-common

/** Class housing connection from a shard */
export class SocketIOConnectionShard extends SocketIOConnection<IDirectoryShard> implements IConnectionShard {
	readonly type: ConnectionType.SHARD = ConnectionType.SHARD;
	readonly characters: Map<CharacterId, number> = new Map();
	private publicURL = '';
	private features: ShardInfo['features'] = [];
	private version = '';

	get id() {
		return this.socket.id;
	}

	constructor(socket: Socket) {
		super(socket, GetLogger('Connection-Shard', `[Connection-Shard ${socket.id}]`));
	}

	protected override onDisconnect(_reason: string): void {
		// TODO

		ConnectionManagerShard.onDisconnect(this);

		// TODO maybe some grace period before removing the characters?
		[...this.characters.entries()].forEach(([characterId, accountId]) => {
			accountManager.getAccountById(accountId)?.disconnectCharacter(characterId);
		});
	}

	protected override onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean> {
		return ConnectionManagerShard.messageHandler.onMessage(messageType, message, callback, this);
	}

	public async updateInfo(info: IShardDirectoryArgument['sendInfo'], connecting: boolean): Promise<{ invalidate: CharacterId[]; }> {
		this.publicURL = info.publicURL;
		this.features = info.features;
		this.version = info.version;

		const invalidate: CharacterId[] = [];
		if (connecting) {
			for (const { accountId, characterId, accessId } of info.characters) {
				if (!await GetDatabase().getCharacter(characterId, accessId)) {
					invalidate.push(characterId);
					continue;
				}

				const acc = await accountManager.loadAccountById(accountId);
				if (acc?.hasCharacter(characterId) === true) {
					this.addAccountCharacter(acc, characterId);
				} else {
					invalidate.push(characterId);
				}
			}
		}

		return { invalidate };
	}

	public removeCharacter(id: CharacterId): void {
		const accountId = this.characters.get(id);
		if (accountId)
			accountManager.getAccountById(accountId)?.disconnectCharacter(id);

		this.characters.delete(id);
	}

	public addAccountCharacter(acc: Account, id: CharacterId): void {
		acc.connectCharacter(id, this);
		this.characters.set(id, acc.data.id);
	}

	public getInfo(): Omit<ShardInfo, 'secret'> {
		return ({
			id: this.id,
			publicURL: this.publicURL,
			features: this.features,
			version: this.version,
		});
	}
}
