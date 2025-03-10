import { GetLogger, HTTP_HEADER_SHARD_SECRET, IClientDirectoryArgument, IShardTokenInfo, IShardTokenType } from 'pandora-common';
import type { Account } from '../account/account.ts';
import { ENV } from '../config.ts';
const { SHARD_SHARED_SECRET } = ENV;

import type { IncomingMessage } from 'http';
import type { Socket } from 'socket.io';
import { GetDatabase } from '../database/databaseProvider.ts';
import { TokenStoreBase } from './tokenStoreBase.ts';

const TOKEN_ID_LENGTH = 16;
const TOKEN_SECRET_LENGTH = 18;
const logger = GetLogger('ShardTokenStore');

type IStoredShardTokenInfo = IShardTokenInfo & { token: string; };

export const ShardTokenStore = new class ShardTokenStore extends TokenStoreBase<IShardTokenInfo> {
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

		return this.hasValidToken(secret);
	}

	public getConnectInfo(handshake: Readonly<Socket['handshake']>): IConnectedTokenInfo | undefined {
		const secret = handshake.headers[HTTP_HEADER_SHARD_SECRET.toLowerCase()];
		const token = typeof secret === 'string' ? this.getValidTokenInfo(secret) : undefined;
		if (!token)
			return undefined;

		const info: IConnectedTokenInfo = {
			type: token.type,
			id: token.id,
		};

		return info;
	}
};

export interface IConnectedTokenInfo {
	readonly type: IShardTokenType;
	readonly id: string;
}
