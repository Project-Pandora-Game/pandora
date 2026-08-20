import { compressToUint8Array, decompressFromUint8Array } from 'lz-string';
import { AccountIdSchema, CharacterIdSchema, GetLogger, Option, TypedEventEmitter, type CharacterId, type ICharacterRoomData, type ZodObjectShape } from 'pandora-common';
import { useEffect, useState } from 'react';
import * as z from 'zod';
import { useService } from '../serviceProvider.tsx';
import type { IndexedDbTransactionProvider } from './indexedDbService.ts';
import { IndexedDbRequestToPromise } from './indexedDbUtils.ts';

const CHARACTER_CACHE_STORE = 'characterCache';

interface CharacterCacheObject {
	/** Id of the cached character. */
	id: CharacterId;
	/** Compressed data, see `CharacterCacheData`. */
	data: Uint8Array<ArrayBufferLike>;
	/** Timestamp of when the data was last updated. */
	updated: number;
}
const CharacterCacheObjectSchema: z.ZodObject<ZodObjectShape<CharacterCacheObject>> = z.object({
	id: CharacterIdSchema,
	data: z.instanceof(Uint8Array),
	updated: z.int().nonnegative(),
});

const CharacterCacheDataSchema = z.object({
	accountId: AccountIdSchema,
	name: z.string(),
	profileDescription: z.string(),
});
type CharacterCacheData = z.infer<typeof CharacterCacheDataSchema>;

export interface CharacterCacheGetResult {
	id: CharacterId;
	data: CharacterCacheData;
	updated: Date;
}

export class IndexedDbCharacterCache extends TypedEventEmitter<{
	cacheChanged: CharacterId;
}> {
	private readonly logger = GetLogger('IndexedDbCharacterCache');
	private readonly _runTransaction: IndexedDbTransactionProvider;

	constructor(runTransaction: IndexedDbTransactionProvider) {
		super();
		this._runTransaction = runTransaction;
	}

	/** Retrieve character data from cache */
	public getCharacter(id: CharacterId): Promise<Option<CharacterCacheGetResult>> {
		return this._runTransaction((tx) => {
			const characterCache = tx.objectStore(CHARACTER_CACHE_STORE);

			return IndexedDbRequestToPromise<unknown>(characterCache.get(id))
				.then((entry) => {
					if (entry == null) {
						return Option.None;
					}

					const parsedEntry = CharacterCacheObjectSchema.parse(entry);
					const rawData: unknown = JSON.parse(decompressFromUint8Array(parsedEntry.data));
					const parsedData = CharacterCacheDataSchema.parse(rawData);

					const result: CharacterCacheGetResult = {
						id: parsedEntry.id,
						data: parsedData,
						updated: new Date(parsedEntry.updated),
					};
					return Option.Some(result);
				});
		}, CHARACTER_CACHE_STORE, 'readonly');
	}

	/** Put new character data into the cache */
	public async putCharacter(id: CharacterId, data: CharacterCacheData): Promise<void> {
		// re-parse data to strip any possible additional fields
		data = CharacterCacheDataSchema.parse(data);
		const compressedData = compressToUint8Array(JSON.stringify(data));
		const updated = Date.now();

		try {
			await this._runTransaction((tx) => {
				const characterCache = tx.objectStore(CHARACTER_CACHE_STORE);

				const entry: CharacterCacheObject = {
					id,
					data: compressedData,
					updated,
				};
				characterCache.put(entry);
			}, CHARACTER_CACHE_STORE, 'readwrite');

			this.emit('cacheChanged', id);
		} catch (err) {
			this.logger.warning('Failed to store character data into cache:', err);
		}
	}

	/** Runs migration on the database */
	public handleUpgradeNeeded(changeEvent: IDBVersionChangeEvent, db: IDBDatabase, changeTransaction: IDBTransaction): void {
		// Creation of character cache
		let characterCache: IDBObjectStore;
		if (changeEvent.oldVersion < 1) {
			characterCache = db.createObjectStore(CHARACTER_CACHE_STORE, {
				keyPath: 'id',
				autoIncrement: false,
			});
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			characterCache = changeTransaction.objectStore(CHARACTER_CACHE_STORE);
		}
	}
}

export function CharacterRoomDataToCacheData(data: ICharacterRoomData): CharacterCacheData {
	return {
		accountId: data.accountId,
		name: data.name,
		profileDescription: data.profileDescription,
	};
}

export function useCharacterCacheEntry(id: CharacterId | null): Option<CharacterCacheGetResult> | null {
	const [result, setResult] = useState<Option<CharacterCacheGetResult> | null>(null);

	const indexedDb = useService('indexedDb');

	useEffect(() => {
		if (id == null) {
			setResult(null);
			return;
		}

		let cancelled = false;

		const update = () => {
			indexedDb.characterCache.getCharacter(id)
				.then((getResult) => {
					if (!cancelled) {
						setResult(getResult);
					}
				}, (err) => {
					if (!cancelled) {
						GetLogger('useCharacterCacheEntry').warning('Error getting character cache entry:', err);
						setResult(null);
					}
				});
		};

		const cleanup = indexedDb.characterCache.on('cacheChanged', (changedId) => {
			if (changedId === id) {
				update();
			}
		});
		update();

		return () => {
			cancelled = true;
			cleanup();
		};
	}, [id, indexedDb]);

	return result?.is_none_or((c) => c.id === id) ? result : null;
}
