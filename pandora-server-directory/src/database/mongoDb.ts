import AsyncLock from 'async-lock';
import _ from 'lodash';
import { CollationOptions, Db, MongoClient } from 'mongodb';
import type { MongoMemoryServer } from 'mongodb-memory-server-core';
import { nanoid } from 'nanoid';
import {
	AccountId,
	ArrayToRecordKeys,
	Assert,
	AssertNotNullable,
	CharacterDataSchema,
	CharacterId,
	GetLogger,
	ICharacterData,
	ICharacterDataDirectoryUpdate,
	ICharacterDataShardUpdate,
	SPACE_DIRECTORY_PROPERTIES,
	SpaceData,
	SpaceDataDirectoryUpdate,
	SpaceDataSchema,
	SpaceDataShardUpdate,
	SpaceDirectoryData,
	SpaceId,
	SpaceIdSchema,
	ZodCast,
} from 'pandora-common';
import { z } from 'zod';
import { ENV } from '../config';
import type { PandoraDatabase } from './databaseProvider';
import {
	DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES,
	DatabaseAccount,
	DatabaseAccountContact,
	DatabaseAccountContactType,
	DatabaseAccountSchema,
	DatabaseAccountSecure,
	DatabaseAccountUpdate,
	DatabaseAccountWithSecure,
	DatabaseAccountWithSecureSchema,
	DatabaseCharacterSelfInfoSchema,
	DatabaseConfigData,
	DatabaseConfigSchema,
	DatabaseConfigType,
	DatabaseDirectMessageAccountsSchema,
	DatabaseDirectMessageInfo,
	DirectMessageAccounts,
	type DatabaseCharacterSelfInfo,
	type DatabaseDirectMessage,
	type DatabaseDirectMessageAccounts,
} from './databaseStructure';
import { CreateCharacter, CreateSpace, SpaceCreationData } from './dbHelper';
import { DbAutomaticMigration, ValidatedCollection, ValidatedCollectionType } from './validatedCollection';

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

const DatabaseCharacterDataSchema = CharacterDataSchema.omit({ id: true }).and(z.object({ id: z.number().int() }));
type DatabaseCharacterData = z.infer<typeof DatabaseCharacterDataSchema>;

const characterCollection = new ValidatedCollection(
	logger,
	CHARACTERS_COLLECTION_NAME,
	DatabaseCharacterDataSchema,
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
	DatabaseConfigSchema,
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
	protected readonly _lock: AsyncLock;
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

			const requireFullMigration = await this.doManualMigrations();

			if (DATABASE_MIGRATION !== 'disable' || requireFullMigration) {
				migration = {
					dryRun: DATABASE_MIGRATION === 'dry-run',
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

	@DbSynchronized()
	public async createAccount(data: DatabaseAccountWithSecure): Promise<DatabaseAccountWithSecure | 'usernameTaken' | 'emailTaken'> {
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

	public async getCharactersForAccount(accountId: number): Promise<DatabaseCharacterSelfInfo[]> {
		const result: DatabaseCharacterSelfInfo[] = await this._characters
			.find({ accountId })
			.project<Pick<DatabaseCharacterData, 'id' | 'name' | 'preview' | 'currentSpace' | 'inCreation'>>({ id: 1, name: 1, preview: 1, currentSpace: 1, inCreation: 1 })
			.toArray()
			.then((p) => p.map((c): DatabaseCharacterSelfInfo => ({
				id: CharacterId(c.id),
				name: c.name,
				preview: c.preview,
				currentSpace: c.currentSpace,
				inCreation: c.inCreation,
			})));

		return result;
	}

	@DbSynchronized()
	public async createCharacter(accountId: AccountId): Promise<DatabaseCharacterSelfInfo> {
		if (!await this.getAccountById(accountId))
			throw new Error('Account not found');

		const [info, char] = CreateCharacter(accountId, this._nextCharacterId++);

		await this._characters.insertOne(char);

		return info;
	}

	public async finalizeCharacter(accountId: AccountId, characterId: CharacterId): Promise<ICharacterData | null> {
		const result = await this._characters.findOneAndUpdate(
			{ accountId, id: PlainId(characterId), inCreation: true },
			{ $set: { created: Date.now() }, $unset: { inCreation: '' } },
			{ returnDocument: 'after' },
		);
		if (!result || result.inCreation !== undefined)
			return null;

		return CharacterIdObject(result);
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
	}

	public async setCharacterAccess(id: CharacterId): Promise<string | null> {
		const result = await this._characters.findOneAndUpdate({ id: PlainId(id) }, { $set: { accessId: nanoid(8) } }, { returnDocument: 'after' });
		return result?.accessId ?? null;
	}

	public async getCharactersInSpace(spaceId: SpaceId): Promise<{
		accountId: AccountId;
		characterId: CharacterId;
	}[]> {
		const characters = await this._characters
			.find({
				currentSpace: spaceId,
			})
			.project<Pick<DatabaseCharacterData, 'id' | 'accountId'>>({ id: 1, accountId: 1 })
			.toArray();

		return characters.map((c): {
			accountId: AccountId;
			characterId: CharacterId;
		} => ({
			characterId: CharacterId(c.id),
			accountId: c.accountId,
		}));
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

	@DbSynchronized()
	public async createSpace(data: SpaceCreationData, id?: SpaceId): Promise<SpaceData> {
		const space = CreateSpace(data, id);

		const result = await this._spaces.insertOne(space);
		Assert(result.acknowledged);
		return space;
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

	@DbSynchronized((name, args) => `${name}-${args[0]}`)
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

		await this._directMessages.updateOne(
			{ accounts },
			{
				$set: {
					keyHash: data.keyHash,
					messages: data.messages,
				},
			},
		);

		return true;
	}

	public async setDirectMessageInfo(accountId: number, directMessageInfo: DatabaseDirectMessageInfo[]): Promise<void> {
		await this._accounts.updateOne({ id: accountId }, { $set: { directMessages: directMessageInfo } });
	}

	public async getCharacter(id: CharacterId, accessId: string | false): Promise<ICharacterData | null> {
		if (accessId === false) {
			accessId = nanoid(8);
			const result = await this._characters.findOneAndUpdate({ id: PlainId(id) }, { $set: { accessId } }, { returnDocument: 'after' });
			return result ? CharacterIdObject(result) : null;
		}

		const character = await this._characters.findOne({ id: PlainId(id), accessId });
		if (!character)
			return null;

		return CharacterIdObject(character);
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

		Assert(result.type === type);
		// @ts-expect-error data is unique to each config type
		return result.data;
	}

	public async setConfig<T extends DatabaseConfigType>(type: T, data: DatabaseConfigData<T>): Promise<void> {
		// @ts-expect-error data is unique to each config type
		await this._config.updateOne({ type }, { $set: { data } }, { upsert: true });
	}

	/**
	 * Perform manual migrations (anything else than applying schema to everything)
	 *
	 * @returns If full migration is required
	 */
	private async doManualMigrations(): Promise<boolean> {
		let requireFullMigration = false;
		// Add manual migrations here

		//#region Migrate character self info from accounts to characters
		const charactersToMigrate = new Map<CharacterId, { account: AccountId; character: DatabaseCharacterSelfInfo; }>();

		// Gather data about characters
		await accountCollection.doManualMigration(this._client, this._db, {
			oldSchema: DatabaseAccountWithSecureSchema.extend({
				characters: DatabaseCharacterSelfInfoSchema
					.omit({ currentSpace: true })
					.and(z.object({ currentRoom: SpaceIdSchema.nullable().optional() }))
					.array()
					.optional(),
			}),
			migrate: async ({ oldStream }) => {
				for await (const account of oldStream) {
					if (Array.isArray(account?.characters)) {
						requireFullMigration = true;

						for (const character of account.characters) {
							Assert(!charactersToMigrate.has(character.id));

							charactersToMigrate.set(character.id, {
								account: account.id,
								character: {
									id: character.id,
									name: character.name,
									preview: character.preview,
									currentSpace: character.currentRoom ?? null,
									inCreation: character.inCreation,
								},
							});
						}
					}
				}
			},
		});

		// Apply the data to the characters
		await characterCollection.doManualMigration(this._client, this._db, {
			oldSchema: CharacterDataSchema.pick({ accountId: true, name: true, inCreation: true }).and(z.object({ id: z.number().int() })),
			migrate: async ({ oldCollection, oldStream, migrationLogger }) => {
				for await (const character of oldStream) {
					if (character == null)
						continue;

					const migrationInfo = charactersToMigrate.get(CharacterId(character.id));
					if (migrationInfo == null)
						continue;

					Assert(character.accountId === migrationInfo.account);
					Assert(CharacterId(character.id) === migrationInfo.character.id);
					Assert(character.name === migrationInfo.character.name);
					Assert(character.inCreation === migrationInfo.character.inCreation);

					migrationLogger.verbose(`Migrating character ${migrationInfo.account}/${migrationInfo.character.id}`);

					const { matchedCount } = await oldCollection.updateOne(
						{ id: character.id },
						{
							$set: {
								currentSpace: migrationInfo.character.currentSpace,
								preview: migrationInfo.character.preview,
							},
						},
					);
					Assert(matchedCount === 1);

					charactersToMigrate.delete(migrationInfo.character.id);
				}
			},
		});

		Assert(charactersToMigrate.size === 0, 'Accounts reference unknown characters');
		// The character array from the account will be deleted during automatic migration

		//#endregion

		return requireFullMigration;
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

function CharacterId(id: number): CharacterId {
	return `c${id}`;
}

function CharacterIdObject(obj: Omit<ICharacterData, 'id'> & { id: number; }): ICharacterData {
	return {
		...obj,
		id: CharacterId(obj.id),
	};
}

function PlainId(id: CharacterId): number {
	return parseInt(id.slice(1));
}

function DbSynchronized<Args extends unknown[], Return>(getKey?: (name: string, args: Args) => string) {
	return function (method: (...args: Args) => Promise<Return>, context: ClassMethodDecoratorContext<MongoDatabase>) {
		Assert(typeof context.name === 'string');
		const name = context.name;
		return function (this: MongoDatabase, ...args: Args) {
			const key = getKey == null ? name : getKey(name, args);
			return this._lock.acquire<Return>(key, () => method.apply(this, args));
		};
	};
}
