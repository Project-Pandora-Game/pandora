import AsyncLock from 'async-lock';
import _ from 'lodash';
import { CollationOptions, Db, MatchKeysAndValues, MongoClient, MongoServerError } from 'mongodb';
import type { MongoMemoryServer } from 'mongodb-memory-server-core';
import { nanoid } from 'nanoid';
import { AccountId, ArrayToRecordKeys, Assert, AssertNotNullable, CharacterDataSchema, CharacterId, GetLogger, ICharacterData, ICharacterDataDirectoryUpdate, ICharacterDataShardUpdate, ICharacterSelfInfoUpdate, IDirectoryDirectMessage, LIMIT_DIRECT_MESSAGE_STORE_COUNT, SPACE_DIRECTORY_PROPERTIES, SpaceData, SpaceDataDirectoryUpdate, SpaceDataSchema, SpaceDataShardUpdate, SpaceDirectoryData, SpaceId, ZodCast } from 'pandora-common';
import { z } from 'zod';
import { ENV } from '../config';
import type { ICharacterSelfInfoDb, PandoraDatabase } from './databaseProvider';
import { DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES, DatabaseAccount, DatabaseAccountContact, DatabaseAccountContactType, DatabaseAccountSchema, DatabaseAccountSecure, DatabaseAccountUpdate, DatabaseAccountWithSecure, DatabaseAccountWithSecureSchema, DatabaseConfigData, DatabaseConfigType, DatabaseDirectMessageAccountsSchema, DatabaseDirectMessageInfo, DirectMessageAccounts, type DatabaseDirectMessageAccounts, type DatabaseDirectMessage } from './databaseStructure';
import { CreateCharacter, CreateSpace, SpaceCreationData } from './dbHelper';
import { ValidatedCollection, DbAutomaticMigration, ValidatedCollectionType } from './validatedCollection';

const { DATABASE_URL, DATABASE_NAME, DATABASE_MIGRATION } = ENV;
const logger = GetLogger('db');

const ACCOUNTS_COLLECTION_NAME = 'accounts';
const CHARACTERS_COLLECTION_NAME = 'characters';
// TODO(spaces): Consider migrating this
const SPACES_COLLECTION_NAME = 'chatrooms';
const DIRECT_MESSAGES_COLLECTION_NAME = 'directMessages';
const ACCOUNT_CONTACTS_COLLECTION_NAME = 'accountContacts';

const COLLATION_CASE_INSENSITIVE: CollationOptions = Object.freeze({
	locale: 'en',
	strength: 2,
});

type MongoDbInit = Readonly<{
	url?: string;
	inMemory?: true;
	/** Requires `inMemory`, saves data into persistent directory */
	dbPath?: string;
}>;

export const MONGODB_SERVER_VERSION: string = '6.0.5';

const accountCollection = new ValidatedCollection(
	logger,
	ACCOUNTS_COLLECTION_NAME,
	DatabaseAccountWithSecureSchema,
	[
		{
			name: 'id',
			unique: true,
			key: { id: 1 },
		},
		{
			name: 'username',
			unique: true,
			key: { username: 1 },
			// Usernames are case-insensitive
			collation: COLLATION_CASE_INSENSITIVE,
		},
		{
			name: 'emailHash',
			unique: true,
			key: { 'secure.emailHash': 1 },
		},
		{
			name: 'githubId',
			unique: true,
			key: { 'secure.github.id': 1 },
			// Ignore accounts without github data
			sparse: true,
		},
	],
);

const characterCollection = new ValidatedCollection(
	logger,
	CHARACTERS_COLLECTION_NAME,
	CharacterDataSchema.omit({ id: true }).and(z.object({ id: z.number().int() })),
	[
		{
			name: 'id',
			unique: true,
			key: { id: 1 },
		},
	],
);

const accountContactCollection = new ValidatedCollection(
	logger,
	ACCOUNT_CONTACTS_COLLECTION_NAME,
	ZodCast<DatabaseAccountContact>(), // TODO: This needs a proper schema!
	[
		{
			name: 'accounts',
			key: { accounts: 1 },
		},
	],
);

const spaceCollection = new ValidatedCollection(
	logger,
	SPACES_COLLECTION_NAME,
	SpaceDataSchema,
	[
		{
			name: 'id',
			unique: true,
			key: { id: 1 },
		},
	],
);

const configCollection = new ValidatedCollection(
	logger,
	'config',
	ZodCast<{ type: DatabaseConfigType; data: DatabaseConfigData<DatabaseConfigType>; }>(), // TODO: This needs a proper schema!
	[
		{
			name: 'id',
			unique: true,
			key: { type: 1 },
		},
	],
);

const directMessageCollection = new ValidatedCollection(
	logger,
	DIRECT_MESSAGES_COLLECTION_NAME,
	DatabaseDirectMessageAccountsSchema,
	[
		{
			name: 'accounts',
			unique: true,
			key: { accounts: 1 },
		},
	],
);

export default class MongoDatabase implements PandoraDatabase {
	private readonly _lock: AsyncLock;
	private readonly _init: MongoDbInit;
	private _client!: MongoClient;
	private _inMemoryServer!: MongoMemoryServer;
	private _db!: Db;
	private _accounts!: ValidatedCollectionType<typeof accountCollection>;
	private _characters!: ValidatedCollectionType<typeof characterCollection>;
	private _accountContacts!: ValidatedCollectionType<typeof accountContactCollection>;
	private _spaces!: ValidatedCollectionType<typeof spaceCollection>;
	private _config!: ValidatedCollectionType<typeof configCollection>;
	private _directMessages!: ValidatedCollectionType<typeof directMessageCollection>;
	private _nextAccountId = 1;
	private _nextCharacterId = 1;

	constructor(init: MongoDbInit = {}) {
		this._lock = new AsyncLock();
		this._init = init;
	}

	public async init(): Promise<void> {
		const { url, inMemory, dbPath } = this._init;
		if (this._db) {
			throw new Error('Database already initialized');
		}

		let uri: string;
		if (inMemory) {
			this._inMemoryServer = await CreateInMemoryMongo({ dbPath });
			uri = this._inMemoryServer.getUri();
			logger.verbose('Started local MongoDB instance on', uri);
		} else {
			uri = url ?? DATABASE_URL;
		}
		this._client = new MongoClient(uri, {
			ignoreUndefined: true,
		});

		// if connection fails, error is thrown, application will exit
		await this._client.connect();

		this._db = this._client.db(DATABASE_NAME);

		let migration: DbAutomaticMigration | undefined;
		if (!inMemory || dbPath) {

			await this.doManualMigrations();

			if (DATABASE_MIGRATION !== 'disable') {
				migration = {
					dryRun: DATABASE_MIGRATION !== 'migrate',
					log: logger.prefixMessages('Migration:'),
					startTime: Date.now(),
					success: true,
					totalCount: 0,
					changeCount: 0,
				};
				migration.log.alert(`Running database migration!${migration.dryRun ? ' (dry run)' : ''}`);
			}
		}

		//#region Init Collections

		this._accounts = await accountCollection.create(this._db, migration);
		this._nextAccountId = await accountCollection.max('id', 0) + 1;

		this._characters = await characterCollection.create(this._db, migration);
		this._nextCharacterId = await characterCollection.max('id', 0) + 1;

		this._accountContacts = await accountContactCollection.create(this._db, migration);
		this._spaces = await spaceCollection.create(this._db, migration);
		this._config = await configCollection.create(this._db, migration);
		this._directMessages = await directMessageCollection.create(this._db, migration);

		//#endregion

		if (migration) {
			if (!migration.success) {
				migration.log.fatal('Database migration failed.');
				throw new Error('Database migration failed');
			}
			const endTime = Date.now();
			migration.log.alert(`Database migration completed in ${endTime - migration.startTime}ms, processed ${migration.totalCount} documents, updated ${migration.changeCount} documents${migration.dryRun ? ' (dry run)' : ''}`);
		}

		logger.info(`Initialized ${this._inMemoryServer ? 'In-Memory-' : ''}MongoDB database`);
	}

	public async onDestroy(): Promise<void> {
		[
			accountCollection,
			characterCollection,
			accountContactCollection,
			spaceCollection,
			configCollection,
			directMessageCollection,
		].forEach((c) => c.onDestroy());

		await this._client.close();
		if (this._inMemoryServer) {
			await this._inMemoryServer.stop();
		}
	}

	public get nextAccountId(): number {
		return this._nextAccountId;
	}

	public get nextCharacterId(): number {
		return this._nextCharacterId;
	}

	public async getAccountById(id: number): Promise<DatabaseAccountWithSecure | null> {
		return await this._accounts.findOne({ id });
	}

	public async getAccountByUsername(username: string): Promise<DatabaseAccountWithSecure | null> {
		return await this._accounts.findOne({ username }, {
			collation: COLLATION_CASE_INSENSITIVE,
		});
	}

	public async getAccountByEmailHash(emailHash: string): Promise<DatabaseAccountWithSecure | null> {
		return await this._accounts.findOne({ 'secure.emailHash': emailHash });
	}

	public async createAccount(data: DatabaseAccountWithSecure): Promise<DatabaseAccountWithSecure | 'usernameTaken' | 'emailTaken'> {
		return await this._lock.acquire('createAccount', async () => {

			const existingUsername = await this._accounts.findOne({ username: data.username }, {
				collation: COLLATION_CASE_INSENSITIVE,
			});
			if (existingUsername)
				return 'usernameTaken';

			const existingEmail = await this._accounts.findOne({ 'secure.emailHash': data.secure.emailHash });
			if (existingEmail)
				return 'emailTaken';

			data.id = this._nextAccountId++;
			await this._accounts.insertOne(data);

			return await this.getAccountById(data.id) as DatabaseAccountWithSecure;
		});
	}

	public async updateAccountData(id: AccountId, data: DatabaseAccountUpdate): Promise<void> {
		data = DatabaseAccountSchema
			.pick(ArrayToRecordKeys(DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES, true))
			.partial()
			.strict()
			.parse(_.cloneDeep(data));

		await this._accounts.updateOne({ id }, { $set: data });
	}

	public async setAccountSecure(id: AccountId, data: DatabaseAccountSecure): Promise<void> {
		await this._accounts.updateOne({ id }, { $set: { secure: data } });
	}

	public async setAccountSecureGitHub(id: AccountId, data: DatabaseAccountSecure['github']): Promise<boolean> {
		const result = await this._accounts.findOneAndUpdate({ id }, { $set: { 'secure.github': data } }, { returnDocument: 'after' });
		if (!result)
			return false;

		if (data === undefined)
			return result.secure.github === undefined;

		return data.date === result.secure.github?.date;
	}

	public async queryAccountDisplayNames(query: AccountId[]): Promise<Record<AccountId, string>> {
		const result: Record<AccountId, string> = {};
		const accounts = await this._accounts
			.find({ id: { $in: query } })
			.project<Pick<DatabaseAccount, 'id' | 'username' | 'settings'>>({ id: 1, username: 1, settings: 1 })
			.toArray();

		for (const acc of accounts) {
			result[acc.id] = acc.settings.displayName ?? acc.username;
		}
		return result;
	}

	public async createCharacter(accountId: AccountId): Promise<ICharacterSelfInfoDb> {
		return await this._lock.acquire('createCharacter', async () => {
			if (!await this.getAccountById(accountId))
				throw new Error('Account not found');

			const [info, char] = CreateCharacter(accountId, this._nextCharacterId++);

			await this._accounts.updateOne({ id: accountId }, { $push: { characters: info } });
			await this._characters.insertOne(char);

			return info;
		});
	}

	public async finalizeCharacter(accountId: AccountId, characterId: CharacterId): Promise<ICharacterData | null> {
		const result = await this._characters.findOneAndUpdate({ id: PlainId(characterId), inCreation: true }, { $set: { created: Date.now() }, $unset: { inCreation: '' } }, { returnDocument: 'after' });
		if (!result || result.inCreation !== undefined)
			return null;

		await this._accounts.updateOne({ 'id': accountId, 'characters.id': characterId }, { $set: { 'characters.$.name': result.name }, $unset: { 'characters.$.inCreation': '' } });

		return Id(result);
	}

	public async updateCharacterSelfInfo(accountId: number, { id, ...data }: ICharacterSelfInfoUpdate): Promise<ICharacterSelfInfoDb | null> {
		// Transform the request
		const update: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(data)) {
			update[`characters.$.${k}`] = v;
		}
		const result = await this._accounts.findOneAndUpdate({ 'id': accountId, 'characters.id': id }, { $set: update as MatchKeysAndValues<DatabaseAccountWithSecure> }, { returnDocument: 'after' });
		return result?.characters.find((c) => c.id === id) ?? null;
	}

	public async updateCharacter(id: CharacterId, data: ICharacterDataDirectoryUpdate & ICharacterDataShardUpdate, accessId: string | null): Promise<boolean> {
		if (accessId !== null) {
			const { matchedCount } = await this._characters
				.updateOne({
					id: PlainId(id),
					accessId,
				}, { $set: data });
			Assert(matchedCount <= 1);
			return matchedCount === 1;
		} else {
			const { matchedCount } = await this._characters
				.updateOne({
					id: PlainId(id),
				}, { $set: data });
			Assert(matchedCount <= 1);
			return matchedCount === 1;
		}
	}

	public async deleteCharacter(accountId: AccountId, characterId: CharacterId): Promise<void> {
		await this._characters.deleteOne({ id: PlainId(characterId), accountId });
		await this._accounts.updateOne({ id: accountId }, { $pull: { characters: { id: characterId } } });
	}

	public async setCharacterAccess(id: CharacterId): Promise<string | null> {
		const result = await this._characters.findOneAndUpdate({ id: PlainId(id) }, { $set: { accessId: nanoid(8) } }, { returnDocument: 'after' });
		return result?.accessId ?? null;
	}

	public async getCharactersInSpace(spaceId: SpaceId): Promise<{
		accountId: AccountId;
		characterId: CharacterId;
	}[]> {
		const chars: {
			accountId: AccountId;
			characterId: CharacterId;
		}[] = [];

		const accounts = await this._accounts
			.find({
				characters: {
					$elemMatch: {
						currentRoom: spaceId,
					},
				},
			})
			.project<Pick<DatabaseAccountWithSecure, 'id' | 'characters'>>({ id: 1, characters: 1 })
			.toArray();

		for (const account of accounts) {
			for (const character of account.characters) {
				if (character.currentRoom === spaceId) {
					chars.push({
						accountId: account.id,
						characterId: character.id,
					});
				}
			}
		}

		return chars;
	}

	//#region Spaces

	public async getSpaceById(id: SpaceId, accessId: string | null): Promise<SpaceData | null> {
		if (accessId !== null) {
			return await this._spaces.findOne({ id, accessId });
		}
		return await this._spaces.findOne({ id });
	}

	public async getSpacesWithOwner(account: AccountId): Promise<SpaceDirectoryData[]> {
		return await this._spaces.find({
			owners: { $elemMatch: { $in: [account] } },
		})
			.project<Pick<SpaceDirectoryData, (typeof SPACE_DIRECTORY_PROPERTIES)[number]>>(ArrayToRecordKeys(SPACE_DIRECTORY_PROPERTIES, 1))
			.toArray();
	}

	public async getSpacesWithOwnerOrAdminOrAllowed(account: AccountId): Promise<SpaceDirectoryData[]> {
		return await this._spaces.find({
			$or: [
				{
					owners: { $elemMatch: { $in: [account] } },
				},
				{
					'config.admin': { $elemMatch: { $in: [account] } },
				},
				{
					'config.allow': { $elemMatch: { $in: [account] } },
				},
			],
		})
			.project<Pick<SpaceDirectoryData, (typeof SPACE_DIRECTORY_PROPERTIES)[number]>>(ArrayToRecordKeys(SPACE_DIRECTORY_PROPERTIES, 1))
			.toArray();
	}

	public async createSpace(data: SpaceCreationData, id?: SpaceId): Promise<SpaceData> {
		return await this._lock.acquire('createSpace', async () => {
			const space = CreateSpace(data, id);

			const result = await this._spaces.insertOne(space);
			Assert(result.acknowledged);
			return space;
		});
	}

	public async updateSpace(id: SpaceId, data: SpaceDataDirectoryUpdate & SpaceDataShardUpdate, accessId: string | null): Promise<boolean> {
		if (accessId !== null) {
			const result = await this._spaces.findOneAndUpdate({ id, accessId }, { $set: data });
			return result != null;
		} else {
			const result = await this._spaces.findOneAndUpdate({ id }, { $set: data });
			return result != null;
		}
	}

	public async deleteSpace(id: SpaceId): Promise<void> {
		await this._spaces.deleteOne({ id });
	}

	public async setSpaceAccessId(id: SpaceId): Promise<string | null> {
		const result = await this._spaces.findOneAndUpdate({ id }, { $set: { accessId: nanoid(8) } }, { returnDocument: 'after' });
		return result?.accessId ?? null;
	}

	//#endregion

	public async getDirectMessages(accounts: DirectMessageAccounts): Promise<DatabaseDirectMessageAccounts | null> {
		const result = await this._directMessages.findOne({ accounts });
		return result ?? null;
	}

	public async setDirectMessage(accounts: DirectMessageAccounts, keyHash: string, message: DatabaseDirectMessage, maxCount: number): Promise<boolean> {
		const data = await this._directMessages.findOne({ accounts });
		if (!data) {
			if (message.edited != null)
				return false;

			await this._directMessages.insertOne({
				accounts,
				keyHash,
				messages: [message],
			});
			return true;
		}

		if (data.keyHash !== keyHash)
			data.messages = [];

		if (message.edited != null) {
			const index = data.messages.findIndex((m) => m.time === message.time);
			if (index === -1)
				return false;

			if (message.content.length === 0) {
				data.messages.splice(index, 1);
			} else {
				data.messages[index] = message;
			}
		} else {
			data.messages.push(message);
			data.messages = data.messages.slice(-maxCount);
		}

		await this._directMessages.updateOne({ accounts }, { $set: data });
		return true;
	}

	public async setDirectMessageInfo(accountId: number, directMessageInfo: DatabaseDirectMessageInfo[]): Promise<void> {
		await this._accounts.updateOne({ id: accountId }, { $set: { directMessages: directMessageInfo } });
	}

	public async getCharacter(id: CharacterId, accessId: string | false): Promise<ICharacterData | null> {
		if (accessId === false) {
			accessId = nanoid(8);
			const result = await this._characters.findOneAndUpdate({ id: PlainId(id) }, { $set: { accessId } }, { returnDocument: 'after' });
			return result ? Id(result) : null;
		}

		const character = await this._characters.findOne({ id: PlainId(id), accessId });
		if (!character)
			return null;

		return Id(character);
	}

	public async getAccountContacts(accountId: AccountId): Promise<DatabaseAccountContact[]> {
		return this._accountContacts.find({ accounts: accountId }).toArray();
	}

	public async setAccountContact(accountIdA: AccountId, accountIdB: AccountId, data: DatabaseAccountContactType): Promise<DatabaseAccountContact> {
		const result = await this._accountContacts.findOneAndUpdate({
			// TODO simplify this when MongoDB fixes this: https://jira.mongodb.org/browse/SERVER-13843
			accounts: {
				$all: [
					{ $elemMatch: { $eq: accountIdA } },
					{ $elemMatch: { $eq: accountIdB } },
				],
			},
		}, {
			$set: {
				updated: Date.now(),
				contact: data,
			},
			$setOnInsert: {
				accounts: [accountIdA, accountIdB],
			},
		}, {
			upsert: true,
			returnDocument: 'after',
		});
		AssertNotNullable(result);
		return result;
	}

	public async removeAccountContact(accountIdA: number, accountIdB: number): Promise<void> {
		await this._accountContacts.deleteOne({
			accounts: { $all: [accountIdA, accountIdB] },
		});
	}

	public async getConfig<T extends DatabaseConfigType>(type: T): Promise<null | DatabaseConfigData<T>> {
		const result = await this._config.findOne({ type });
		if (!result?.data)
			return null;

		// @ts-expect-error data is unique to each config type
		return result.data;
	}

	public async setConfig<T extends DatabaseConfigType>(type: T, data: DatabaseConfigData<T>): Promise<void> {
		await this._config.updateOne({ type }, { $set: { data } }, { upsert: true });
	}

	private async doManualMigrations(): Promise<void> {
		// Add manual migrations here
		await directMessageCollection.doManualMigration(this._client, this._db, {
			oldSchema: ZodCast<IDirectoryDirectMessage & { accounts: DirectMessageAccounts; }>(),
			migrate: async ({ self, logger: log, db, client, oldStream, oldCollection }) => {
				const result = new Map<string, z.infer<typeof self.schema>>();

				let success = true;
				let totalCount = 0;

				for await (const data of oldStream) {
					if (data == null) {
						success = false;
						continue;
					}

					let dms = result.get(data.accounts);
					if (!dms) {
						dms = {
							accounts: data.accounts,
							keyHash: data.keyHash,
							messages: [],
						};
						result.set(data.accounts, dms);
					}
					if (dms.keyHash !== data.keyHash) {
						log.warning(`Key hash mismatch for account ${data.accounts}`);
						dms.keyHash = data.keyHash;
						dms.messages = [];
					}
					dms.messages.push({
						content: data.content,
						source: data.source,
						time: data.time,
						edited: data.edited,
					});
					++totalCount;
				}
				if (!success)
					throw new Error('Migration failed');

				for (const dms of result.values()) {
					dms.messages = dms.messages
						.sort((a, b) => a.time - b.time)
						.slice(-LIMIT_DIRECT_MESSAGE_STORE_COUNT);
				}

				log.info(`Loaded ${result.size} accounts, ${totalCount} direct message conversations`);

				const session = client.startSession();
				try {
					await session.withTransaction(async () => {
						try {
							await oldCollection.drop();
						} catch (e) {
							if (e instanceof MongoServerError && e.message === 'ns not found') {
								// Ignore, collection doesn't exist
							} else {
								throw e;
							}
						}
						const newCollection = await self.create(db);
						for (const dms of result.values()) {
							await newCollection.insertOne(dms);
						}
						const docCount = await newCollection.countDocuments();
						if (result.size !== docCount) {
							log.error(`Migration failed: Document count mismatch ${result.size} !== ${docCount}`);
							await session.abortTransaction();
						}
					});
					log.info('Migration successful');
				} finally {
					await session.endSession();
				}
			},
		});
	}
}

async function CreateInMemoryMongo({
	dbPath,
}: {
	dbPath?: string;
} = {}): Promise<MongoMemoryServer> {
	const { MongoMemoryServer } = await import('mongodb-memory-server-core');
	if (dbPath) {
		const { mkdir } = await import('fs/promises');
		await mkdir(dbPath, { recursive: true });
	}
	return await MongoMemoryServer.create({
		binary: {
			version: MONGODB_SERVER_VERSION,
			checkMD5: false,
		},
		instance: {
			dbPath,
			storageEngine: dbPath ? 'wiredTiger' : 'ephemeralForTest',
			args: ['--setParameter', 'diagnosticDataCollectionEnabled=false'],
		},
	});
}

function Id(obj: Omit<ICharacterData, 'id'> & { id: number; }): ICharacterData {
	return {
		...obj,
		id: `c${obj.id}` as const,
	};
}

function PlainId(id: CharacterId): number {
	return parseInt(id.slice(1));
}
