import { customAlphabet } from 'nanoid';
import { GetLogger, type IBetaKeyInfo, type IClientDirectoryArgument } from 'pandora-common';
import type { ActorIdentity } from '../account/actorIdentity.ts';
import { ENV } from '../config.ts';
import { GetDatabase } from '../database/databaseProvider.ts';
import { TokenStoreBase } from './tokenStoreBase.ts';
const { BETA_KEY_GLOBAL } = ENV;

const TOKEN_ID_LENGTH = 8;
const TOKEN_SECRET_LENGTH = 8;
const TOKEN_MAX_USES = 5;
const TOKEN_MAX_EXPIRE_MS = 1000 * 60 * 60 * 24 * 7; // 1 week
const logger = GetLogger('BetaKeyStore');

type IStoredBetaKeyInfo = IBetaKeyInfo & { token: string; };

export const BetaKeyStore = new class BetaKeyStore extends TokenStoreBase<IBetaKeyInfo> {
	constructor() {
		super(logger, TOKEN_ID_LENGTH, TOKEN_SECRET_LENGTH);
		this.generator = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
	}

	protected async onInit(): Promise<void> {
		if (BETA_KEY_GLOBAL) {
			if (await this.devInsert({
				id: BETA_KEY_GLOBAL.substring(0, TOKEN_ID_LENGTH),
				token: BETA_KEY_GLOBAL,
				created: { id: 0, username: '[[Pandora]]', time: 0 },
				uses: 0,
			}))
				this.logger.info(`Token '${BETA_KEY_GLOBAL}' created`);
		}
	}

	public async use(token: string): Promise<boolean> {
		return await this._action(token, (info) => {
			if (this._validate(info)) {
				++info.uses;
				return info;
			}
			return null;
		});
	}

	public async free(token: string): Promise<void> {
		await this._action(token, (info) => {
			--info.uses;
			return info;
		});
	}

	protected async load(): Promise<IStoredBetaKeyInfo[]> {
		return await GetDatabase().getConfig('betaKeys') || [];
	}

	protected save(data: IStoredBetaKeyInfo[]): Promise<void> {
		return GetDatabase().setConfig('betaKeys', data);
	}

	protected _validateExtra({ maxUses, uses }: IBetaKeyInfo): boolean {
		return maxUses === undefined || uses < maxUses;
	}

	public async create(creator: ActorIdentity, { expires, maxUses }: IClientDirectoryArgument['manageCreateBetaKey']): Promise<'adminRequired' | {
		info: IBetaKeyInfo;
		id: string;
		token: string;
	}> {
		if (!creator.roles.isAuthorized('admin')) {
			if (maxUses === undefined || maxUses > TOKEN_MAX_USES)
				return 'adminRequired';
			if (expires === undefined || expires > Date.now() + TOKEN_MAX_EXPIRE_MS)
				return 'adminRequired';
		}
		return await this._create(creator, { expires, maxUses, uses: 0 });
	}
};
