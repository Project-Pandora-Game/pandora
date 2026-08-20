import { compressToUint8Array, decompressFromUint8Array } from 'lz-string';
import { AccountIdSchema, GetLogger, Option, TypedEventEmitter, type AccountId, type ZodObjectShape } from 'pandora-common';
import * as z from 'zod';
import type { IndexedDbTransactionProvider } from './indexedDbService.ts';
import { IndexedDbRequestToPromise } from './indexedDbUtils.ts';

const ACCOUNT_CACHE_STORE = 'accountCache';

interface AccountCacheObject {
	/** Id of the cached account. */
	id: AccountId;
	/** Compressed data, see `AccountCacheData`. */
	data: Uint8Array<ArrayBufferLike>;
	/** Timestamp of when the data was last updated. */
	updated: number;
}
const AccountCacheObjectSchema: z.ZodObject<ZodObjectShape<AccountCacheObject>> = z.object({
	id: AccountIdSchema,
	data: z.instanceof(Uint8Array),
	updated: z.int().nonnegative(),
});

const AccountCacheDataSchema = z.object({
	name: z.string(),
});
type AccountCacheData = z.infer<typeof AccountCacheDataSchema>;

export interface AccountCacheGetResult {
	id: AccountId;
	data: AccountCacheData;
	updated: Date;
}

export class IndexedDbAccountCache extends TypedEventEmitter<{
	cacheChanged: AccountId;
}> {
	private readonly logger = GetLogger('IndexedDbAccountCache');
	private readonly _runTransaction: IndexedDbTransactionProvider;

	constructor(runTransaction: IndexedDbTransactionProvider) {
		super();
		this._runTransaction = runTransaction;
	}

	/** Retrieve account data from cache */
	public getAccount(id: AccountId): Promise<Option<AccountCacheGetResult>> {
		return this._runTransaction((tx) => {
			const accountCache = tx.objectStore(ACCOUNT_CACHE_STORE);

			return IndexedDbRequestToPromise<unknown>(accountCache.get(id))
				.then((entry) => {
					if (entry == null) {
						return Option.None;
					}

					const parsedEntry = AccountCacheObjectSchema.parse(entry);
					const rawData: unknown = JSON.parse(decompressFromUint8Array(parsedEntry.data));
					const parsedData = AccountCacheDataSchema.parse(rawData);

					const result: AccountCacheGetResult = {
						id: parsedEntry.id,
						data: parsedData,
						updated: new Date(parsedEntry.updated),
					};
					return Option.Some(result);
				});
		}, ACCOUNT_CACHE_STORE, 'readonly');
	}

	/** Put new account data into the cache */
	public async putAccount(id: AccountId, data: AccountCacheData): Promise<void> {
		// re-parse data to strip any possible additional fields
		data = AccountCacheDataSchema.parse(data);
		const compressedData = compressToUint8Array(JSON.stringify(data));
		const updated = Date.now();

		try {
			await this._runTransaction((tx) => {
				const accountCache = tx.objectStore(ACCOUNT_CACHE_STORE);

				const entry: AccountCacheObject = {
					id,
					data: compressedData,
					updated,
				};
				accountCache.put(entry);
			}, ACCOUNT_CACHE_STORE, 'readwrite');

			this.emit('cacheChanged', id);
		} catch (err) {
			this.logger.warning('Failed to store account data into cache:', err);
		}
	}

	/** Runs migration on the database */
	public handleUpgradeNeeded(changeEvent: IDBVersionChangeEvent, db: IDBDatabase, changeTransaction: IDBTransaction): void {
		// Creation of account cache
		let accountCache: IDBObjectStore;
		if (changeEvent.oldVersion < 1) {
			accountCache = db.createObjectStore(ACCOUNT_CACHE_STORE, {
				keyPath: 'id',
				autoIncrement: false,
			});
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			accountCache = changeTransaction.objectStore(ACCOUNT_CACHE_STORE);
		}
	}
}
