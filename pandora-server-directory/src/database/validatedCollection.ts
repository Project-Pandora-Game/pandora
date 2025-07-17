import { diffString } from 'json-diff';
import { isEqual, omit } from 'lodash-es';
import { CollationOptions, Collection, Db, Document, IndexDescription, MongoClient, ObjectId } from 'mongodb';
import { ArrayToRecordKeys, Assert, IsObject, KnownObject, Logger } from 'pandora-common';
import type { ZodType, ZodTypeDef } from 'zod';

export interface DbAutomaticMigration {
	readonly dryRun: boolean;
	readonly log: Logger;
	readonly startTime: number;
	success: boolean;
	totalCount: number;
	changeCount: number;
}

export interface DbManualMigrationProcess<TNew extends Document, TOld extends Document> {
	readonly self: ValidatedCollection<TNew>;
	readonly client: MongoClient;
	readonly db: Db;
	readonly migrationLogger: Logger;
	readonly oldCollection: Collection<TOld>;
	readonly oldStream: AsyncIterableIterator<TOld | null>;
}

export interface DbManualMigration<TNew extends Document, TOld extends Document> {
	readonly oldSchema: ZodType<TOld, ZodTypeDef, unknown>;
	readonly oldCollectionName?: string;
	readonly migrate: (process: DbManualMigrationProcess<TNew, TOld>) => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidatedCollectionType<T extends ValidatedCollection<any>> = T extends ValidatedCollection<infer U> ? Collection<U> : never;

export class ValidatedCollection<T extends Document> {
	public readonly logger: Logger;
	public readonly name: string;
	public readonly schema: ZodType<T, ZodTypeDef, unknown>;
	public readonly indexes: (IndexDescription & { name: string; })[];
	private uninitializedCollection?: Collection<T>;

	private get collection(): Collection<T> {
		if (this.uninitializedCollection == null) {
			throw new Error(`Collection ${this.name} not initialized`);
		}
		return this.uninitializedCollection;
	}

	constructor(
		logger: Logger,
		name: string,
		schema: ZodType<T, ZodTypeDef, unknown>,
		indexes: (IndexDescription & { name: string; })[],
	) {
		this.logger = logger;
		this.name = name;
		this.schema = schema;
		this.indexes = indexes;
	}

	public onDestroy(): void {
		delete this.uninitializedCollection;
	}

	public async doManualMigration<TOldType extends Document = T>(client: MongoClient, db: Db, migration: DbManualMigration<T, TOldType>): Promise<void> {
		const migrationLogger = this.logger.prefixMessages(`[Manual Migration ${this.name}]`);
		const oldCollection = db.collection<TOldType>(migration.oldCollectionName ?? this.name);
		let success = true;
		const oldStream = ValidatingAsyncIter(
			migrationLogger,
			oldCollection,
			migration.oldSchema,
			() => {
				success = false;
			},
		);

		const process: DbManualMigrationProcess<T, TOldType> = {
			self: this,
			client,
			db,
			migrationLogger,
			oldCollection,
			oldStream,
		};

		await migration.migrate(process);

		if (!success) {
			migrationLogger.fatal('Database migration failed.');
			throw new Error('Database migration failed');
		}
	}

	public async create(db: Db, migration?: DbAutomaticMigration): Promise<Collection<T>> {
		if (this.uninitializedCollection == null) {
			this.uninitializedCollection = db.collection(this.name);
			await this.updateIndexes(this.collection);
		}
		if (migration != null) {
			await this.automaticMigration(migration);
		}
		return this.collection;
	}

	/**
	 * Updates indexes on a collection such that they exactly match the wanted indexes, dropping all other indexes and updating existing ones
	 *
	 * Ignores the inbuilt `_id_` index
	 * @param collection - The collection to update indexes on
	 */
	public async updateIndexes(collection: Collection<T>): Promise<void> {
		// Keys that should be compared
		const indexKeysToCompare: readonly (keyof IndexDescription)[] = ['unique', 'sparse', 'key', 'collation'];

		// We catch the result and return empty index array in case the collection doesn't exist
		const currentIndexes: unknown[] = await collection.listIndexes().toArray().catch(() => []);

		let rebuildNeeded = false;
		// Check if there is any index that is different and needs rebuild
		for (const index of currentIndexes) {
			// Skip indexes in unknown format and inbuilt `_id_` index
			if (!IsObject(index) || typeof index.name !== 'string' || index.name === '_id_')
				continue;

			// Check for non-existent indexes
			const wantedIndex = this.indexes.find((i) => i.name === index.name);
			if (!wantedIndex) {
				rebuildNeeded = true;
				this.logger.alert(`[Collection ${collection.collectionName}] Rebuilding indexes because of extra index:`, index.name);
				break;
			}

			// Compare existing index to wanted one
			for (const property of indexKeysToCompare) {
				let matches = isEqual(index[property], wantedIndex[property]);
				// Collation is compared only for partiality
				if (!matches && property === 'collation' && wantedIndex.collation && IsObject(index.collation)) {
					matches = true;
					for (const k of Object.keys(wantedIndex.collation) as (keyof CollationOptions)[]) {
						if (!isEqual(index.collation[k], wantedIndex.collation[k])) {
							matches = false;
							break;
						}
					}
				}
				if (!matches) {
					rebuildNeeded = true;
					this.logger.alert(`[Collection ${collection.collectionName}] Rebuilding indexes because of mismatched index '${index.name}' property '${property}'`);
					break;
				}
			}
			if (rebuildNeeded)
				break;
		}

		if (rebuildNeeded) {
			await collection.dropIndexes().catch(() => { /* NOOP */ });
			if (this.indexes.length > 0) {
				await collection.createIndexes(this.indexes);
			}
		} else {
			// Check for new indexes if we didn't need complete rebuild
			const newIndexes = this.indexes.filter((i) => !currentIndexes.some((ci) => IsObject(ci) && ci.name === i.name));
			if (newIndexes.length > 0) {
				this.logger.alert(`[Collection ${collection.collectionName}] Adding missing indexes:`, newIndexes.map((i) => i.name).join(', '));
				await collection.createIndexes(newIndexes);
			}
		}
	}

	private async automaticMigration(migration: DbAutomaticMigration): Promise<void> {
		const { log, dryRun } = migration;
		log.info(`Processing ${this.name}...`);

		for await (const originalData of this.collection.find().stream()) {
			migration.totalCount++;
			const documentId: ObjectId = originalData._id;
			Assert(documentId instanceof ObjectId);

			const originalDataWithoutType: Record<string, unknown> = originalData;
			// Parse the data using schema (this is the main bit of migration)
			const parsedData = this.schema.safeParse(originalData);
			if (!parsedData.success) {
				migration.success = false;
				log.error(`Failed to migrate ${this.name} document ${documentId.toHexString()}:\n`, parsedData.error);
				continue;
			}

			if (isEqual(omit(originalData, '_id'), omit(parsedData.data, '_id')))
				continue;

			// If the parse result is not equal, the data needs migration
			migration.changeCount++;

			// Collect updated properties and keys to delete
			const update: Partial<T> = {};
			const keysToDelete = new Set<string>();
			for (const [key, value] of KnownObject.entries(parsedData.data)) {
				if (key === '_id')
					continue;

				if (value !== undefined && !isEqual(originalDataWithoutType[key as string], value)) {
					update[key] = value;
				}
			}
			for (const key of Object.keys(originalData)) {
				if (key === '_id')
					continue;

				if (parsedData.data[key as keyof T] === undefined) {
					keysToDelete.add(key);
				}
			}

			// Generate a diff for manual review
			const diff = diffString(omit(originalData, '_id'), omit(parsedData.data, '_id'), { color: false });
			log.verbose(
				`Migrating ${this.name} document ${documentId.toHexString()}...\n`,
				`Updates keys: ${Object.keys(update).join(', ')}\n`,
				`Removed keys: ${Array.from(keysToDelete).join(', ')}\n`,
				`Diff:\n`,
				diff,
			);

			if (dryRun)
				continue;

			// Actually perform the update
			const { matchedCount } = await this.collection.updateOne(
				// @ts-expect-error: This works; typechecking is just broken for some reason
				{ _id: documentId },
				{
					$set: update,
					$unset: ArrayToRecordKeys(Array.from(keysToDelete), true),
				},
			);
			if (matchedCount !== 1) {
				migration.success = false;
				log.error(`Failed to migrate ${this.name} document ${documentId.toHexString()}: Update matched count is ${matchedCount}`);
			}
		}
	}
}

async function* ValidatingAsyncIter<T extends Document>(
	logger: Logger,
	document: Collection<T>,
	schema: ZodType<T, ZodTypeDef, unknown>,
	onError: () => void,
): AsyncGenerator<T | null, void, unknown> {
	for await (const originalData of document.find().stream()) {
		const documentId: ObjectId = originalData._id;
		Assert(documentId instanceof ObjectId);

		const parsedData = schema.safeParse(originalData);
		if (!parsedData.success) {
			logger.error(`Failed to migrate ${document.collectionName} document ${documentId.toHexString()}:\n`, parsedData.error);
			onError();
			yield null;
		} else {
			yield parsedData.data;
		}
	}
}
