import { GetLogger, IClientDirectoryArgument, IShardTokenInfo } from 'pandora-common';
import type { Account } from '../account/account';
import { SHARD_SHARED_SECRET } from '../config';

import { nanoid } from 'nanoid';
import { GetDatabase } from '../database/databaseProvider';
import _ from 'lodash';

const CLEANUP_INTERVAL = 1000 * 60 * 60 * 24; // 1 day

const logger = GetLogger('ShardTokenStore');

type IStoredShardTokenInfo = Omit<IShardTokenInfo, 'id'> & { token: string; };

export const ShardTokenStore = new class ShardTokenStore {
	#tokens!: Map<string, IStoredShardTokenInfo>;

	async init(): Promise<void> {
		this.#tokens = new Map(await GetDatabase().getConfig('shardTokens') || []);

		this._cleanup();

		if (SHARD_SHARED_SECRET) {
			this.#tokens.set(SHARD_SHARED_SECRET.substring(0, 16), {
				token: SHARD_SHARED_SECRET,
				type: 'stable',
				created: { id: 0, username: '[[Pandora]]', time: 0 },
				expires: undefined,
			});
			logger.info(`Shard token '${SHARD_SHARED_SECRET}' created`);
		}

		setInterval(() => this._cleanup(), CLEANUP_INTERVAL).unref();

		logger.info(`Loaded ${this.#tokens.size} shard tokens`);
	}

	public async create(acc: Account, { type, expires }: IClientDirectoryArgument['manageCreateShardToken']): Promise<'adminRequired' | { info: IShardTokenInfo, token: string; }> {
		if (['stable', 'beta'].includes(type) && !acc.roles.isAuthorized('admin'))
			return 'adminRequired';

		let id = nanoid(16);
		while (this.#tokens.has(id))
			id = nanoid(16);

		const info: IStoredShardTokenInfo = {
			token: `${id}${nanoid(16)}`,
			type,
			expires,
			created: {
				id: acc.id,
				username: acc.username,
				time: Date.now(),
			},
		};

		this.#tokens.set(id, info);

		logger.info(`Created shard token '${id}' for ${acc.username} (${acc.id})`, info);

		await this._save();

		return {
			info: {
				..._.omit(info, 'token'),
				id,
			},
			token: info.token,
		};
	}

	public async revoke(acc: Account, id: string): Promise<boolean> {
		const info = this.get(id);
		if (!info || (info.created.id !== acc.id && !acc.roles.isAuthorized('admin')))
			return false;

		this.#tokens.delete(id);
		await this._save();

		logger.info(`Shard token '${id}' revoked by ${acc.username} (${acc.id})`);

		return true;
	}

	public list(acc: Account): IShardTokenInfo[] {
		const values = [...this.#tokens.values()]
			.map((info) => ({ ..._.omit(info, 'token'), id: info.token.substring(0, 16) }));

		if (!acc.roles.isAuthorized('admin'))
			return values.filter((info) => info.created.id === acc.id);

		return values;
	}

	public get(token: string): Omit<IShardTokenInfo, 'id'> | undefined {
		const info = this.#tokens.get(token.substring(0, 16));
		const { expires, token: storedToken } = info ?? {};
		if (storedToken !== token)
			return;
		if (expires !== undefined && expires < Date.now())
			return;

		return _.omit(info, 'token');

	}

	public has(token: string): boolean {
		return this.get(token) !== undefined;
	}

	private async _save(): Promise<void> {
		const entries = [...this.#tokens.entries()]
			.filter(([id]) => !SHARD_SHARED_SECRET.startsWith(id));

		await GetDatabase().setConfig('shardTokens', entries);
	}

	private _cleanup(): void {
		const now = Date.now();
		let save = false;
		for (const [key, value] of this.#tokens) {
			if (value.expires !== undefined && value.expires < now) {
				this.#tokens.delete(key);
				save = true;
				logger.info(`Shard token '${key}' expired`);
			}
		}
		if (save)
			this._save().catch((err) => logger.error(err));
	}
};
