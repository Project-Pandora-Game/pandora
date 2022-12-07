import { GetLogger, IClientDirectoryArgument, IShardTokenInfo } from 'pandora-common';
import type { Account } from '../account/account';
import { SHARD_SHARED_SECRET } from '../config';

import { GetDatabase } from '../database/databaseProvider';
import { TokenStoreBase } from './tokenStoreBase';

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
		return GetDatabase().setConfig({ type: 'shardTokens', data });
	}

	protected isValid(_info: IStoredShardTokenInfo): boolean {
		return true;
	}

	public async create(acc: Account, { type, expires }: IClientDirectoryArgument['manageCreateShardToken']): Promise<'adminRequired' | { info: IShardTokenInfo, token: string; }> {
		if (['stable', 'beta'].includes(type) && !acc.roles.isAuthorized('admin'))
			return 'adminRequired';

		return await this._create(acc, { type, expires });
	}
};
