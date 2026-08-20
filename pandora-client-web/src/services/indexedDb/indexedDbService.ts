import {
	Assert,
	GetLogger,
	Service,
	type Promisable,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import type { ClientServices } from '../clientServices.ts';
import { IndexedDbAccountCache } from './indexedDbAccountCache.ts';
import { IndexedDbCharacterCache } from './indexedDbCharacterCache.ts';

export const PANDORA_INDEXED_DB_NAME = 'PandoraDB';
export const PANDORA_INDEXED_DB_VERSION = 1;

type IndexedDbServiceConfig = Satisfies<{
	dependencies: Pick<ClientServices, never>;
	events: false;
}, ServiceConfigBase>;

export type IndexedDbTransactionProvider = <T>(handler: (tx: IDBTransaction) => Promisable<T>, stores: string | string[], mode: IDBTransactionMode) => Promise<T>;

/**
 * Service for interacting with browser's permissions.
 */
export class IndexedDbService extends Service<IndexedDbServiceConfig> {
	private readonly logger = GetLogger('IndexedDb');

	private _db: IDBDatabase | null = null;

	private readonly doTransaction: IndexedDbTransactionProvider = <T>(handler: (tx: IDBTransaction) => Promisable<T>, stores: string | string[], mode: IDBTransactionMode): Promise<T> => {
		const db = this._db;
		if (db == null) {
			return Promise.reject(new Error('Database not ready'));
		}

		return new Promise<T>((resolve, reject) => {
			const tx = db.transaction(stores, mode);

			const innerResult = handler(tx);

			tx.oncomplete = () => resolve(innerResult);

			tx.onabort = () => {
				const err = tx.error;
				if (err?.name === 'QuotaExceededError') {
					reject(new Error('Storage quota exceeded', { cause: err }));
				} else {
					reject(new Error('Transaction aborted', { cause: err }));
				}
			};

			tx.onerror = () => {
				reject(new Error('Transaction error', { cause: tx.error }));
			};
		});
	};

	public readonly accountCache: IndexedDbAccountCache = new IndexedDbAccountCache(this.doTransaction);
	public readonly characterCache: IndexedDbCharacterCache = new IndexedDbCharacterCache(this.doTransaction);

	protected override serviceLoad(): void | Promise<void> {
		// Open the database
		if (globalThis.indexedDB == null) {
			this.logger.error('IndexedDB not available');
			return;
		}

		new Promise<IDBDatabase>((resolve, reject) => {
			const openRequest = globalThis.indexedDB.open(PANDORA_INDEXED_DB_NAME, PANDORA_INDEXED_DB_VERSION);

			openRequest.onerror = () => {
				reject(new Error('Error opening database', { cause: openRequest.error }));
			};
			openRequest.onsuccess = () => {
				Assert(openRequest.result != null);
				resolve(openRequest.result);
			};

			// Database migration
			openRequest.onblocked = () => {
				this.logger.alert('Database upgrade blocked, waiting...');
			};
			openRequest.onupgradeneeded = (changeEvent) => {
				this.logger.alert(`Upgrading database ${changeEvent.oldVersion} -> ${changeEvent.newVersion}`);

				Assert(changeEvent.newVersion === PANDORA_INDEXED_DB_VERSION);
				const db = openRequest.result;
				Assert(db != null);
				const tx = openRequest.transaction;
				Assert(tx != null, 'Missing transaction during migration');

				// Run migration of individual database services
				this.characterCache.handleUpgradeNeeded(changeEvent, db, tx);
			};
		})
			.then((db) => {
				this._db = db;
				db.onclose = () => {
					this.logger.warning('Database closed unexpectedly');
				};
				db.onversionchange = () => {
					this.logger.alert('Database requested version change, closing for upcoming migration...');
					this._close();
				};

				this.logger.verbose(`Successfully opened database, version: ${db.version}`);
			}, (error) => {
				this.logger.error('Error opening database:', error);
			});
	}

	private _close(): void {
		if (this._db != null) {
			const db = this._db;
			this._db = null;

			db.close();
		}
	}
}

export const IndexedDbServiceProvider: ServiceProviderDefinition<ClientServices, 'indexedDb', IndexedDbServiceConfig> = {
	name: 'indexedDb',
	ctor: IndexedDbService,
	dependencies: {},
};
