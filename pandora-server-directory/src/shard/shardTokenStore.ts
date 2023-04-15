import { GetLogger, HTTP_HEADER_SHARD_SECRET, IClientDirectoryArgument, IShardTokenConnectInfo, IShardTokenInfo, IShardTokenType } from 'pandora-common';
import type { Account } from '../account/account';
import { SHARD_SHARED_SECRET } from '../config';

import { GetDatabase } from '../database/databaseProvider';
import { TokenStoreBase } from './tokenStoreBase';
import type { IncomingMessage } from 'http';
import type { Socket } from 'socket.io';

const TOKEN_ID_LENGTH = 16;
const TOKEN_SECRET_LENGTH = 18;
const logger = GetLogger('ShardTokenStore');

type IStoredShardTokenInfo = IShardTokenInfo & { token: string; };

export const ShardTokenStore = new class ShardTokenStore extends TokenStoreBase<IShardTokenInfo> {
	readonly #connections = new Map<string, ConnectedTokenInfo>();

	constructor() {
		super(logger, TOKEN_ID_LENGTH, TOKEN_SECRET_LENGTH);
	}

	protected async onInit(): Promise<void> {
		if (SHARD_SHARED_SECRET) {
			if (await this.devInsert({
				id: SHARD_SHARED_SECRET.substring(0, TOKEN_ID_LENGTH),
				token: SHARD_SHARED_SECRET,
				type: 'stable',
				created: { id: 0, username: '[[Pandora]]', time: 0 },
				expires: undefined,
			}))
				this.logger.info(`Token '${SHARD_SHARED_SECRET}' created`);
		}
	}

	protected async load(): Promise<IStoredShardTokenInfo[]> {
		return await GetDatabase().getConfig('shardTokens') || [];
	}

	protected save(data: IStoredShardTokenInfo[]): Promise<void> {
		return GetDatabase().setConfig('shardTokens', data);
	}

	protected _validateExtra(_info: IShardTokenInfo): boolean {
		return true;
	}

	public async create(acc: Account, { type, expires }: IClientDirectoryArgument['manageCreateShardToken']): Promise<'adminRequired' | { info: IShardTokenInfo; token: string; }> {
		if (['stable', 'beta'].includes(type) && !acc.roles.isAuthorized('admin'))
			return 'adminRequired';

		return await this._create(acc, { type, expires });
	}

	public allowRequest(req: Readonly<IncomingMessage>): boolean {
		const secret = req.headers[HTTP_HEADER_SHARD_SECRET.toLowerCase()];
		if (typeof secret !== 'string')
			return false;

		const token = this.getValidTokenInfo(secret);
		return token != null && !this.#connections.has(token.id);
	}

	public allowConnect(handshake: Readonly<Socket['handshake']>): ConnectedTokenInfo | undefined {
		const secret = handshake.headers[HTTP_HEADER_SHARD_SECRET.toLowerCase()];
		const token = typeof secret === 'string' ? this.getValidTokenInfo(secret) : undefined;
		if (!token)
			return undefined;
		if (this.#connections.has(token.id))
			return undefined;

		const info = new ConnectedTokenInfo(token, handshake, () => this.#connections.delete(token.id));
		this.#connections.set(token.id, info);

		return info;
	}

	public listShads(): IShardTokenConnectInfo[] {
		return this.list()
			.map((token) => {
				const connection = this.#connections.get(token.id);
				return {
					...token,
					connected: connection?.handshake.issued,
				};
			});
	}
};

export interface IConnectedTokenInfo {
	readonly type: IShardTokenType;
	readonly id: string;
}

export class ConnectedTokenInfo implements IConnectedTokenInfo {
	readonly type: IShardTokenType;
	readonly id: string;
	readonly handshake: Readonly<Socket['handshake']>;
	readonly remove: () => void;

	constructor(token: IShardTokenInfo, handshake: Readonly<Socket['handshake']>, remove: () => void = () => undefined) {
		this.type = token.type;
		this.id = token.id;
		this.handshake = handshake;

		let once = false;
		this.remove = () => {
			if (once)
				return;

			once = true;
			remove();
		};
	}
}
