import { omit } from 'lodash';
import { type IBaseTokenInfo, type Logger } from 'pandora-common';
import { type Account } from '../account/account';
import { nanoid } from 'nanoid';

const TOKEN_ID_LENGTH = 16;

const CLEANUP_INTERVAL = 1000 * 60 * 60 * 24; // 1 day

export abstract class TokenStoreBase<Token extends IBaseTokenInfo> {
	static readonly cleanups = new Set<() => void>();
	#tokens!: Map<string, Full<Token>>;
	protected readonly logger: Logger;

	protected constructor(logger: Logger) {
		this.logger = logger;
	}

	public async init(): Promise<void> {
		this.#tokens = new Map(await this.load());
		this._cleanup();
		await this.onInit();
		TokenStoreBase.cleanups.add(() => this._cleanup());
		this.logger.info(`Loaded ${this.#tokens.size} tokens`);
	}

	protected abstract onInit(): void | Promise<void>;
	protected abstract load(): Promise<[string, Full<Token>][]>;
	protected abstract save(data: [string, Full<Token>][]): Promise<void>;
	protected abstract isValid(info: Full<Token>): boolean;

	protected async _create(acc: Account, data: Omit<Token, 'created' | 'id'>): Promise<{ info: Stripped<Token>, token: string; }> {
		let id = nanoid(TOKEN_ID_LENGTH);
		while (this.#tokens.has(id))
			id = nanoid(TOKEN_ID_LENGTH);

		const token = `${id}${nanoid(16)}`;
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		const info: Full<Token> = {
			...data,
			id,
			token,
			created: {
				id: acc.id,
				username: acc.username,
				time: Date.now(),
			},
		} as Full<Token>;

		this.#tokens.set(id, info);

		this.logger.info(`Created shard token '${id}' for ${acc.username} (${acc.id})`, info);

		await this._save();

		return {
			info: omit(info, 'token'),
			token,
		};
	}

	protected devInsert(data: Full<Token>): void {
		this.#tokens.set(data.id, data);
	}

	public async revoke(acc: Account, id: string): Promise<boolean> {
		const info = this.get(id);
		if (!info || (info.created.id !== acc.id && !acc.roles.isAuthorized('admin')))
			return false;

		this.#tokens.delete(id);
		await this._save();

		this.logger.info(`Token '${id}' revoked by ${acc.username} (${acc.id})`);

		return true;
	}

	public list(acc: Account): Stripped<Token>[] {
		const values = [...this.#tokens.values()]
			.map((info) => omit(info, 'token'));

		if (!acc.roles.isAuthorized('admin'))
			return values.filter((info) => info.created.id === acc.id);

		return values;
	}

	public get(token: string): Stripped<Token> | undefined {
		const info = this.#tokens.get(token.substring(0, TOKEN_ID_LENGTH));
		if (!info)
			return undefined;

		const { expires, token: storedToken } = info;
		if (storedToken !== token)
			return;
		if (expires !== undefined && expires < Date.now())
			return;
		if (!this.isValid(info))
			return;

		return omit(info, 'token');
	}

	public has(token: string): boolean {
		return this.get(token) !== undefined;
	}

	private async _save(): Promise<void> {
		await this.save([...this.#tokens.entries()]);
	}

	private _cleanup(): void {
		const now = Date.now();
		let save = false;
		for (const [key, value] of this.#tokens) {
			if (value.expires !== undefined && value.expires < now) {
				this.#tokens.delete(key);
				save = true;
				this.logger.info(`Token '${key}' expired`);
			} else if (!this.isValid(value)) {
				this.#tokens.delete(key);
				save = true;
				this.logger.info(`Token '${key}' removed`);
			}
		}
		if (save) {
			this._save().catch((err) => this.logger.error(err));
		}
	}
}

type Full<Token extends IBaseTokenInfo> = Token & { token: string; };
type Stripped<Token extends IBaseTokenInfo> = Omit<Token, 'token'>;

setInterval(() => {
	for (const cleanup of TokenStoreBase.cleanups)
		cleanup();
}, CLEANUP_INTERVAL).unref();
