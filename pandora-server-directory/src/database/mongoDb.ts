import AsyncLock from 'async-lock';
import { cloneDeep } from 'lodash-es';
import { Binary, CollationOptions, Db, MongoClient, MongoServerError } from 'mongodb';
import type { MongoMemoryServer } from 'mongodb-memory-server-core';
import { nanoid } from 'nanoid';
import {
	AccountId,
	ArrayToRecordKeys,
	Assert,
	AssertNotNullable,
	AsyncSynchronized,
	CHARACTER_SHARD_VISIBLE_PROPERTIES,
	CharacterDataSchema,
	CharacterId,
	CharacterIdSchema,
	CloneDeepMutable,
	GetLogger,
	HexColorStringSchema,
	ICharacterData,
	ICharacterDataDirectoryUpdate,
	ICharacterDataShardUpdate,
	RoomBackgroundDataSchema,
	RoomInventoryBundleSchema,
	SPACE_DIRECTORY_PROPERTIES,
	SpaceData,
	SpaceDataDirectoryUpdate,
	SpaceDataSchema,
	SpaceDataShardUpdate,
	SpaceDirectoryConfigSchema,
	SpaceDirectoryData,
	SpaceId,
	SpaceIdSchema,
	ZodCast,
	ZodTemplateString,
	type ICharacterDataShard,
	type RoomGeometryConfig,
} from 'pandora-common';
import { z } from 'zod';
import { ENV } from '../config.ts';
import type { PandoraDatabase } from './databaseProvider.ts';
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
	type DatabaseConfigCreationCounters,
	type DatabaseDirectMessage,
	type DatabaseDirectMessageAccounts,
} from './databaseStructure.ts';
import { CreateCharacter, CreateSpace, SpaceCreationData } from './dbHelper.ts';
import { DbAutomaticMigration, ValidatedCollection, ValidatedCollectionType } from './validatedCollection.ts';

const { DATABASE_URL, DATABASE_NAME, DATABASE_MIGRATION } = ENV;
const logger = GetLogger('db');

const ACCOUNTS_COLLECTION_NAME = 'accounts';
const CHARACTERS_COLLECTION_NAME = 'characters';
const SPACES_COLLECTION_NAME = 'spaces';
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

const CharacterDatabaseDataSchema = CharacterDataSchema.extend({
	preview: z.instanceof(Binary).optional().catch(undefined),
});

const characterCollection = new ValidatedCollection(
	logger,
	CHARACTERS_COLLECTION_NAME,
	CharacterDatabaseDataSchema,
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

	private _creationCounters?: DatabaseConfigCreationCounters;

	private _accounts!: ValidatedCollectionType<typeof accountCollection>;
	private _characters!: ValidatedCollectionType<typeof characterCollection>;
	private _accountContacts!: ValidatedCollectionType<typeof accountContactCollection>;
	private _spaces!: ValidatedCollectionType<typeof spaceCollection>;
	private _config!: ValidatedCollectionType<typeof configCollection>;
	private _directMessages!: ValidatedCollectionType<typeof directMessageCollection>;

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
		this._characters = await characterCollection.create(this._db, migration);
		this._accountContacts = await accountContactCollection.create(this._db, migration);
		this._spaces = await spaceCollection.create(this._db, migration);
		this._config = await configCollection.create(this._db, migration);
		this._directMessages = await directMessageCollection.create(this._db, migration);

		//#endregion

		// Load counters
		if (this._creationCounters == null) {
			this._creationCounters = (await this.getConfig('creationCounters')) ?? {
				nextAccountId: 1,
				nextCharacterId: 1,
			};
		}

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

		logger.info(`Database closed`);
	}

	public get nextAccountId(): number {
		AssertNotNullable(this._creationCounters);
		return this._creationCounters.nextAccountId;
	}

	public get nextCharacterId(): number {
		AssertNotNullable(this._creationCounters);
		return this._creationCounters.nextCharacterId;
	}

	@AsyncSynchronized()
	private async _generateNextId(type: keyof DatabaseConfigCreationCounters): Promise<number> {
		AssertNotNullable(this._creationCounters);
		const value = this._creationCounters[type]++;

		await this.setConfig('creationCounters', this._creationCounters);

		return value;
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

		data.id = await this._generateNextId('nextAccountId');
		await this._accounts.insertOne(data);

		return await this.getAccountById(data.id) as DatabaseAccountWithSecure;
	}

	@DbSynchronized(() => 'createAccount')
	public async updateAccountEmailHash(id: AccountId, emailHash: string): Promise<'ok' | 'notFound' | 'emailTaken'> {
		const existingEmail = await this._accounts.findOne({ 'secure.emailHash': emailHash });
		if (existingEmail)
			return 'emailTaken';

		const result = await this._accounts.findOneAndUpdate({ id }, { $set: { 'secure.emailHash': emailHash } }, { returnDocument: 'after' });
		if (!result)
			return 'notFound';
		if (result.secure.emailHash !== emailHash)
			return 'emailTaken';

		return 'ok';
	}

	public async updateAccountData(id: AccountId, data: DatabaseAccountUpdate): Promise<void> {
		data = DatabaseAccountSchema
			.pick(ArrayToRecordKeys(DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES, true))
			.partial()
			.strict()
			.parse(cloneDeep(data));

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
			.project<Pick<ICharacterData, 'id' | 'name' | 'currentSpace' | 'inCreation'>>({ _id: 0, id: 1, name: 1, currentSpace: 1, inCreation: 1 })
			.toArray();

		return result;
	}

	@DbSynchronized()
	public async createCharacter(accountId: AccountId): Promise<DatabaseCharacterSelfInfo> {
		if (!await this.getAccountById(accountId))
			throw new Error('Account not found');

		const characterId: CharacterId = `c${await this._generateNextId('nextCharacterId')}`;

		const [info, char] = CreateCharacter(accountId, characterId);

		await this._characters.insertOne(char);

		return info;
	}

	public async finalizeCharacter(accountId: AccountId, characterId: CharacterId): Promise<Pick<ICharacterData, 'id' | 'name' | 'created'> | null> {
		const result: Pick<ICharacterData, 'id' | 'name' | 'created' | 'inCreation'> | null = await this._characters.findOneAndUpdate(
			{ accountId, id: characterId, inCreation: true },
			{ $set: { created: Date.now() }, $unset: { inCreation: '' } },
			{
				returnDocument: 'after',
				projection: { _id: 0, id: 1, name: 1, created: 1, inCreation: 1 },
			},
		);
		if (!result || result.inCreation !== undefined)
			return null;

		return result;
	}

	public async updateCharacter(id: CharacterId, data: ICharacterDataDirectoryUpdate & ICharacterDataShardUpdate, accessId: string | null): Promise<boolean> {
		if (accessId !== null) {
			const { matchedCount } = await this._characters
				.updateOne({
					id,
					accessId,
				}, { $set: data });
			Assert(matchedCount <= 1);
			return matchedCount === 1;
		} else {
			const { matchedCount } = await this._characters
				.updateOne({
					id,
				}, { $set: data });
			Assert(matchedCount <= 1);
			return matchedCount === 1;
		}
	}

	public async deleteCharacter(accountId: AccountId, characterId: CharacterId): Promise<void> {
		await this._characters.deleteOne({ id: characterId, accountId });
	}

	public async setCharacterAccess(id: CharacterId): Promise<string | null> {
		const result = await this._characters.findOneAndUpdate(
			{ id },
			{ $set: { accessId: nanoid(8) } },
			{
				returnDocument: 'after',
				projection: { accessId: 1 },
			},
		);
		return result?.accessId ?? null;
	}

	public async getCharacterPreview(id: CharacterId): Promise<Uint8Array | null> {
		const character = await this._characters.findOne<Pick<z.infer<typeof CharacterDatabaseDataSchema>, 'preview'>>({ id }, { projection: { preview: 1 } });
		if (!character || character.preview == null)
			return null;

		return character.preview.buffer;
	}

	public async setCharacterPreview(id: CharacterId, preview: Uint8Array): Promise<boolean> {
		const { matchedCount } = await this._characters
			.updateOne({
				id,
			}, {
				$set: {
					preview: new Binary(preview, Binary.SUBTYPE_DEFAULT),
				},
			});
		Assert(matchedCount <= 1);
		return matchedCount === 1;
	}

	public async getCharactersInSpace(spaceId: SpaceId): Promise<{
		accountId: AccountId;
		characterId: CharacterId;
	}[]> {
		const characters = await this._characters
			.find({
				currentSpace: spaceId,
			})
			.project<Pick<ICharacterData, 'id' | 'accountId'>>({ id: 1, accountId: 1 })
			.toArray();

		return characters.map((c): {
			accountId: AccountId;
			characterId: CharacterId;
		} => ({
			characterId: c.id,
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

	@DbSynchronized((_name, [id]) => id)
	public async updateSpace(id: SpaceId, data: SpaceDataDirectoryUpdate & SpaceDataShardUpdate, accessId: string | null): Promise<boolean> {
		if (accessId !== null) {
			const result = await this._spaces.findOneAndUpdate({ id, accessId }, { $set: data });
			return result != null;
		} else {
			const result = await this._spaces.findOneAndUpdate({ id }, { $set: data });
			return result != null;
		}
	}

	@DbSynchronized((_name, [id]) => id)
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
					keyHash,
					messages: data.messages,
				},
			},
		);

		return true;
	}

	public async setDirectMessageInfo(accountId: number, directMessageInfo: DatabaseDirectMessageInfo[]): Promise<void> {
		await this._accounts.updateOne({ id: accountId }, { $set: { directMessages: directMessageInfo } });
	}

	public async getCharacter(id: CharacterId, accessId: string | false): Promise<ICharacterDataShard | null> {
		if (accessId === false) {
			accessId = nanoid(8);
			const result: Pick<ICharacterData, (typeof CHARACTER_SHARD_VISIBLE_PROPERTIES)[number]> | null = await this._characters.findOneAndUpdate(
				{ id },
				{ $set: { accessId } },
				{
					returnDocument: 'after',
					projection: ArrayToRecordKeys(CHARACTER_SHARD_VISIBLE_PROPERTIES, 1),
				},
			);
			return result ? result : null;
		}

		const character = await this._characters.findOne<Pick<ICharacterData, (typeof CHARACTER_SHARD_VISIBLE_PROPERTIES)[number]>>({ id, accessId }, { projection: ArrayToRecordKeys(CHARACTER_SHARD_VISIBLE_PROPERTIES, 1) });
		if (!character)
			return null;

		return character;
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
		await this._config.updateOne(
			{
				type,
			},
			{
				$set: {
					// @ts-expect-error data is unique to each config type
					data,
				},
				$setOnInsert: {
					type,
				},
			},
			{ upsert: true },
		);
	}

	/**
	 * Perform manual migrations (anything else than applying schema to everything)
	 *
	 * @returns If full migration is required
	 */
	private async doManualMigrations(): Promise<boolean> {
		let requireFullMigration = false;
		// Add manual migrations here

		//#region Migrate character self info from accounts to characters (03/2024)
		const charactersToMigrate = new Map<CharacterId, { account: AccountId; character: DatabaseCharacterSelfInfo; }>();

		// Gather data about characters
		await accountCollection.doManualMigration(this._client, this._db, {
			oldSchema: DatabaseAccountWithSecureSchema.extend({
				characters: DatabaseCharacterSelfInfoSchema
					.omit({ currentSpace: true })
					.and(z.object({ currentRoom: z.union([SpaceIdSchema, OldSpaceIdSchema]).nullable().optional() }))
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
									currentSpace: typeof character.currentRoom === 'string' ? UpdateSpaceId(character.currentRoom) : null,
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
			oldSchema: CharacterDataSchema
				.pick({ accountId: true, name: true, inCreation: true })
				.and(z.object({
					id: z.union([CharacterIdSchema, z.number().int()]),
				})),
			migrate: async ({ oldCollection, oldStream, migrationLogger }) => {
				for await (const character of oldStream) {
					if (character == null)
						continue;

					const migrationInfo = charactersToMigrate.get(CharacterIdToStringId(character.id));
					if (migrationInfo == null)
						continue;

					Assert(character.accountId === migrationInfo.account);
					Assert(CharacterIdToStringId(character.id) === migrationInfo.character.id);
					Assert(character.name === migrationInfo.character.name);
					Assert(character.inCreation === migrationInfo.character.inCreation);

					migrationLogger.verbose(`Migrating character ${migrationInfo.account}/${migrationInfo.character.id}`);

					const { matchedCount } = await oldCollection.updateOne(
						{ id: character.id },
						{
							$set: {
								currentSpace: migrationInfo.character.currentSpace,
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

		//#region Generate explicit registration/character creation counters (04/2024)

		await configCollection.doManualMigration(this._client, this._db, {
			oldSchema: DatabaseConfigSchema,
			migrate: async ({ oldCollection, migrationLogger }) => {
				const existingCounters = await oldCollection.findOne({ type: 'creationCounters' });
				if (existingCounters == null) {

					let nextAccountId: number;
					let nextCharacterId: number;

					const maxAccount = await (await accountCollection.create(this._db)).find().sort({ id: -1 }).limit(1).toArray();

					if (maxAccount.length > 0) {
						Assert(typeof maxAccount[0].id === 'number');
						nextAccountId = maxAccount[0].id + 1;
					} else {
						nextAccountId = 1;
					}

					const maxCharacter = await (await characterCollection.create(this._db)).find().sort({ id: -1 }).limit(1).toArray();

					if (maxCharacter.length > 0) {
						// Downcast to unknown as we are dealing with old, non-migrated data
						const id: unknown = maxCharacter[0].id;
						Assert(typeof id === 'number');
						nextCharacterId = id + 1;
					} else {
						nextCharacterId = 1;
					}

					this._creationCounters = {
						nextAccountId,
						nextCharacterId,
					};

					await oldCollection.insertOne({
						type: 'creationCounters',
						data: this._creationCounters,
					});

					migrationLogger.alert(`Generated creation counters: nextAccountId=${nextAccountId}, nextCharacterId=${nextCharacterId}`);
				}
			},
		});

		//#endregion

		//#region Character Id migration (04/2024)

		// Go through all characters and replace numeric ids where needed by string ids
		await characterCollection.doManualMigration(this._client, this._db, {
			oldSchema: z.object({
				id: z.union([CharacterIdSchema, z.number().int()]),
			}),
			migrate: async ({ oldCollection, oldStream, migrationLogger }) => {
				for await (const character of oldStream) {
					if (character == null)
						continue;

					if (typeof character.id === 'string')
						continue;

					requireFullMigration = true;
					migrationLogger.verbose(`Migrating character id for ${character.id} -> ${CharacterIdToStringId(character.id)}`);

					const { matchedCount } = await oldCollection.updateOne(
						{ id: character.id },
						{
							$set: {
								id: CharacterIdToStringId(character.id),
							},
						},
					);
					Assert(matchedCount === 1);
				}
			},
		});

		//#endregion

		//#region Rename spaces collection from old rooms collection (04/2024)

		try {
			await this._db.renameCollection('chatrooms', SPACES_COLLECTION_NAME, { dropTarget: false });

			logger.info('Migrated old chatrooms collection to a new name');
		} catch (error) {
			if (!(error instanceof MongoServerError) || error.codeName !== 'NamespaceNotFound') {
				throw error;
			}
		}

		//#endregion

		//#region Change space id format from `r/abc` to `s/abc` (04/2024)

		await spaceCollection.doManualMigration(this._client, this._db, {
			oldSchema: z.object({
				id: z.union([SpaceIdSchema, OldSpaceIdSchema]),
			}),
			migrate: async ({ oldCollection, oldStream, migrationLogger }) => {
				for await (const space of oldStream) {
					if (space == null)
						continue;

					if (space.id.startsWith('s/'))
						continue;

					const newId: SpaceId = UpdateSpaceId(space.id);

					requireFullMigration = true;
					migrationLogger.verbose(`Migrating space id for ${space.id} -> ${newId}`);

					const { matchedCount } = await oldCollection.updateOne(
						{ id: space.id },
						{
							$set: {
								id: newId,
							},
						},
					);
					Assert(matchedCount === 1);
				}
			},
		});

		await characterCollection.doManualMigration(this._client, this._db, {
			oldSchema: CharacterDataSchema
				.pick({ id: true })
				.and(z.object({
					currentSpace: z.union([SpaceIdSchema, OldSpaceIdSchema]).nullable().default(null),
				})),
			migrate: async ({ oldCollection, oldStream, migrationLogger }) => {
				for await (const character of oldStream) {
					if (character == null)
						continue;

					if (character.currentSpace == null || character.currentSpace.startsWith('s/'))
						continue;

					requireFullMigration = true;
					migrationLogger.verbose(`Migrating character ${character.id} current space id`);

					const { matchedCount } = await oldCollection.updateOne(
						{ id: character.id },
						{
							$set: {
								currentSpace: UpdateSpaceId(character.currentSpace),
							},
						},
					);
					Assert(matchedCount === 1);
				}
			},
		});

		//#endregion

		//#region Move space background configuration and character position data (04/2025)

		await spaceCollection.doManualMigration(this._client, this._db, {
			oldSchema: SpaceDataSchema.pick({ id: true }).extend({
				config: SpaceDirectoryConfigSchema.extend({
					/** The ID of the background or custom data */
					background: z.union([z.string(), RoomBackgroundDataSchema.extend({ image: HexColorStringSchema.catch('#1099bb') })]).optional(),
				}),
				inventory: RoomInventoryBundleSchema.partial({ roomGeometry: true }),
			}),
			migrate: async ({ oldCollection, oldStream, migrationLogger }) => {
				for await (const space of oldStream) {
					if (space == null || space.config.background == null)
						continue;

					requireFullMigration = true;
					migrationLogger.verbose(`Migrating space background for ${space.id}`);

					const newBackground: RoomGeometryConfig = space.inventory.roomGeometry ?? (
						typeof space.config.background === 'string' ? {
							type: 'premade',
							id: space.config.background,
						} : {
							type: 'plain',
							image: space.config.background.image,
							imageSize: space.config.background.imageSize,
							floorArea: space.config.background.floorArea,
							areaCoverage: space.config.background.areaCoverage,
							ceiling: space.config.background.ceiling,
							cameraCenterOffset: space.config.background.cameraCenterOffset,
							cameraFov: space.config.background.cameraFov,
						}
					);

					const { matchedCount } = await oldCollection.updateOne(
						{ id: space.id },
						{
							$unset: {
								'config.background': true,
							},
							$set: {
								'inventory.roomGeometry': newBackground,
							},
						},
					);
					Assert(matchedCount === 1);
				}
			},
		});

		await characterCollection.doManualMigration(this._client, this._db, {
			oldSchema: CharacterDatabaseDataSchema.pick({ id: true, appearance: true, personalRoom: true }).extend({
				roomId: SpaceIdSchema.nullable().optional(),
				position: z.tuple([z.number().int(), z.number().int(), z.number().int()]).optional(),
			}),
			migrate: async ({ oldCollection, oldStream, migrationLogger }) => {
				for await (const character of oldStream) {
					if (character == null || character.position == null)
						continue;

					requireFullMigration = true;
					migrationLogger.verbose(`Migrating character position for ${character.id}`);

					const newAppearance = CloneDeepMutable(character.appearance);
					if (newAppearance != null) {
						newAppearance.position = {
							type: 'normal',
							position: character.position,
						};
						newAppearance.space = character.roomId ?? null;
					}

					const newPersonalRoom = CloneDeepMutable(character.personalRoom);
					if (newPersonalRoom != null) {
						newPersonalRoom.inventory.roomGeometry = { type: 'defaultPersonalSpace' };
					}

					const { matchedCount } = await oldCollection.updateOne(
						{ id: character.id },
						{
							$unset: {
								roomId: true,
								position: true,
							},
							$set: {
								appearance: newAppearance,
								personalRoom: newPersonalRoom,
							},
						},
					);
					Assert(matchedCount === 1);
				}
			},
		});

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
		spawn: {
			detached: true,
		},
	});
}

function CharacterIdToStringId(id: number | CharacterId): CharacterId {
	return typeof id === 'number' ? `c${id}` : id;
}

// Temporary for migration
const OldSpaceIdSchema = ZodTemplateString<`r/${string}`>(z.string(), /^r\//);

function UpdateSpaceId(oldId: SpaceId | z.infer<typeof OldSpaceIdSchema>): SpaceId {
	return oldId.startsWith('s/') ? SpaceIdSchema.parse(oldId) : `s/${oldId.slice(2)}`;
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
