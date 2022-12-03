import { omit } from 'lodash';
import { type IBaseTokenInfo, type Logger } from 'pandora-common';
import { type Account } from '../account/account';
import { nanoid } from 'nanoid';

const CLEANUP_INTERVAL = 1000 * 60 * 60 * 24; // 1 day

export abstract class TokenStoreBase<Token extends IBaseTokenInfo> {
	/** @internal */
	public static readonly cleanups = new Set<() => void>();
	#tokens!: Map<string, Full<Token>>;
	protected readonly logger: Logger;
	protected readonly idLength: number;
	protected readonly secretLength: number;

	protected constructor(logger: Logger, idLength: number, secretLength: number) {
		this.logger = logger;
		this.idLength = idLength;
		this.secretLength = secretLength;
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
		let id = nanoid(this.idLength);
		while (this.#tokens.has(id))
			id = nanoid(this.idLength);

		const token = `${id}${nanoid(this.secretLength)}`;
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
		const info = this.#tokens.get(token.substring(0, this.idLength));
		if (!info || info.token !== token || !this._validate(info))
			return undefined;

		return omit(info, 'token');
	}

	public has(token: string): boolean {
		return this.get(token) !== undefined;
	}

	protected async _action(token: string, action: (info: Stripped<Token>) => Stripped<Token> | undefined): Promise<boolean> {
		const info = this.#tokens.get(token.substring(0, this.idLength));
		if (!info || info.token !== token || !this._validate(info))
			return false;

		const newInfo = action(omit(info, 'token'));
		if (!newInfo)
			return true;

		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		this.#tokens.set(info.id, { ...newInfo, id: info.id, token: info.token, created: info.created } as Full<Token>);
		await this._save();
		return true;
	}

	protected _validate(info: Full<Token>): boolean {
		if (info.expires !== undefined && info.expires < Date.now())
			return false;
		if (!this.isValid(info))
			return false;

		return true;
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
