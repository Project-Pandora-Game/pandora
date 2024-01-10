import { CharacterId, ICharacterData, ICharacterSelfInfoUpdate, GetLogger, IDirectoryDirectMessage, IChatRoomDirectoryData, IChatRoomData, IChatRoomDataDirectoryUpdate, IChatRoomDataShardUpdate, RoomId, Assert, AccountId, IsObject, AssertNotNullable, ArrayToRecordKeys, CHATROOM_DIRECTORY_PROPERTIES, ICharacterDataDirectoryUpdate, ICharacterDataShardUpdate, ACCOUNT_SETTINGS_LIMITED_STORED_DEFAULT } from 'pandora-common';
import type { ICharacterSelfInfoDb, PandoraDatabase } from './databaseProvider';
import { ENV } from '../config';
const { DATABASE_URL, DATABASE_NAME } = ENV;
import { CreateCharacter, CreateChatRoom, IChatRoomCreationData } from './dbHelper';
import { DATABASE_ACCOUNT_UPDATEABLE_PROPERTIES, DatabaseAccount, DatabaseAccountSchema, DatabaseAccountSecure, DatabaseAccountUpdateableProperties, DatabaseAccountWithSecure, DatabaseConfigData, DatabaseConfigType, DatabaseDirectMessageInfo, DatabaseAccountContact, DirectMessageAccounts, DatabaseAccountContactType } from './databaseStructure';

import AsyncLock from 'async-lock';
import { type MatchKeysAndValues, MongoClient, CollationOptions, IndexDescription } from 'mongodb';
import type { Db, Collection } from 'mongodb';
import type { MongoMemoryServer } from 'mongodb-memory-server-core';
import { nanoid } from 'nanoid';
import _ from 'lodash';

const logger = GetLogger('db');

const ACCOUNTS_COLLECTION_NAME = 'accounts';
const CHARACTERS_COLLECTION_NAME = 'characters';
const CHATROOMS_COLLECTION_NAME = 'chatrooms';
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

export default class MongoDatabase implements PandoraDatabase {
	private readonly _lock: AsyncLock;
	private readonly _init: MongoDbInit;
	private _client!: MongoClient;
	private _inMemoryServer!: MongoMemoryServer;
	private _db!: Db;
	private _accounts!: Collection<DatabaseAccountWithSecure>;
	private _characters!: Collection<Omit<ICharacterData, 'id'> & { id: number; }>;
	private _chatrooms!: Collection<IChatRoomData>;
	private _config!: Collection<{ type: DatabaseConfigType; data: DatabaseConfigData<DatabaseConfigType>; }>;
	private _directMessages!: Collection<IDirectoryDirectMessage & { accounts: DirectMessageAccounts; }>;
	private _accountContacts!: Collection<DatabaseAccountContact>;
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

		//#region Accounts
		this._accounts = this._db.collection(ACCOUNTS_COLLECTION_NAME);

		await MongoUpdateIndexes(this._accounts, [
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
		]);

		const [maxAccountId] = await this._accounts.find().sort({ id: -1 }).limit(1).toArray();
		this._nextAccountId = maxAccountId ? maxAccountId.id + 1 : 1;
		//#endregion

		//#region Characters
		this._characters = this._db.collection(CHARACTERS_COLLECTION_NAME);

		await MongoUpdateIndexes(this._characters, [
			{
				name: 'id',
				unique: true,
				key: { id: 1 },
			},
		]);

		const [maxCharId] = await this._characters.find().sort({ id: -1 }).limit(1).toArray();
		this._nextCharacterId = maxCharId ? maxCharId.id + 1 : 1;
		//#endregion

		this._accountContacts = this._db.collection(ACCOUNT_CONTACTS_COLLECTION_NAME);
		await MongoUpdateIndexes(this._accountContacts, [
			{
				name: 'accounts',
				key: { accounts: 1 },
			},
		]);

		//#region Chatrooms
		this._chatrooms = this._db.collection(CHATROOMS_COLLECTION_NAME);

		await this._chatrooms.createIndexes([
			{
				name: 'id',
				unique: true,
				key: { id: 1 },
			},
		]);
		//#endregion

		//#region Config
		this._config = this._db.collection('config');

		await MongoUpdateIndexes(this._config, [
			{
				name: 'id',
				unique: true,
				key: { type: 1 },
			},
		]);
		//#endregion

		//#region DirectMessages
		this._directMessages = this._db.collection(DIRECT_MESSAGES_COLLECTION_NAME);

		await MongoUpdateIndexes(this._directMessages, [
			{
				name: 'accounts',
				key: { accounts: 1 },
			},
			{
				name: 'time',
				key: { time: 1 },
			},
		]);
		//#endregion

		logger.info(`Initialized ${this._inMemoryServer ? 'In-Memory-' : ''}MongoDB database`);

		if (!inMemory || dbPath) {
			await this._doMigrations();
		}
	}

	public async onDestroy(): Promise<void> {
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

	public async updateAccountData(id: AccountId, data: Partial<Pick<DatabaseAccount, DatabaseAccountUpdateableProperties>>): Promise<void> {
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
			.project<Pick<DatabaseAccount, 'id' | 'username' | 'settingsLimited'>>({ id: 1, username: 1, settingsLimited: 1 })
			.toArray();

		for (const acc of accounts) {
			result[acc.id] = acc.settingsLimited.displayName.value ?? acc.username;
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

	public async getCharactersInRoom(roomId: RoomId): Promise<{
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
						currentRoom: roomId,
					},
				},
			})
			.project<Pick<DatabaseAccountWithSecure, 'id' | 'characters'>>({ id: 1, characters: 1 })
			.toArray();

		for (const account of accounts) {
			for (const character of account.characters) {
				if (character.currentRoom === roomId) {
					chars.push({
						accountId: account.id,
						characterId: character.id,
					});
				}
			}
		}

		return chars;
	}

	//#region ChatRoom

	public async getChatRoomById(id: RoomId, accessId: string | null): Promise<IChatRoomData | null> {
		if (accessId !== null) {
			return await this._chatrooms.findOne({ id, accessId });
		}
		return await this._chatrooms.findOne({ id });
	}

	public async getChatRoomsWithOwner(account: AccountId): Promise<IChatRoomDirectoryData[]> {
		return await this._chatrooms.find({
			owners: { $elemMatch: { $in: [account] } },
		})
			.project<Pick<IChatRoomDirectoryData, (typeof CHATROOM_DIRECTORY_PROPERTIES)[number]>>(ArrayToRecordKeys(CHATROOM_DIRECTORY_PROPERTIES, 1))
			.toArray();
	}

	public async getChatRoomsWithOwnerOrAdmin(account: AccountId): Promise<IChatRoomDirectoryData[]> {
		return await this._chatrooms.find({
			$or: [
				{
					owners: { $elemMatch: { $in: [account] } },
				},
				{
					'config.admin': { $elemMatch: { $in: [account] } },
				},
			],
		})
			.project<Pick<IChatRoomDirectoryData, (typeof CHATROOM_DIRECTORY_PROPERTIES)[number]>>(ArrayToRecordKeys(CHATROOM_DIRECTORY_PROPERTIES, 1))
			.toArray();
	}

	public async createChatRoom(data: IChatRoomCreationData, id?: RoomId): Promise<IChatRoomData> {
		return await this._lock.acquire('createChatRoom', async () => {
			const room = CreateChatRoom(data, id);

			const result = await this._chatrooms.insertOne(room);
			Assert(result.acknowledged);
			return room;
		});
	}

	public async updateChatRoom(id: RoomId, data: IChatRoomDataDirectoryUpdate & IChatRoomDataShardUpdate, accessId: string | null): Promise<boolean> {
		if (accessId !== null) {
			const result = await this._chatrooms.findOneAndUpdate({ id, accessId }, { $set: data });
			return result != null;
		} else {
			const result = await this._chatrooms.findOneAndUpdate({ id }, { $set: data });
			return result != null;
		}
	}

	public async deleteChatRoom(id: RoomId): Promise<void> {
		await this._chatrooms.deleteOne({ id });
	}

	public async setChatRoomAccess(id: RoomId): Promise<string | null> {
		const result = await this._chatrooms.findOneAndUpdate({ id }, { $set: { accessId: nanoid(8) } }, { returnDocument: 'after' });
		return result?.accessId ?? null;
	}

	//#endregion

	public async getDirectMessages(accounts: DirectMessageAccounts, limit: number, until?: number): Promise<IDirectoryDirectMessage[]> {
		return await this._directMessages
			.find(until ? { accounts, time: { $lt: until } } : { accounts })
			.sort({ time: -1 })
			.limit(limit)
			.toArray();
	}

	public async setDirectMessage(accounts: DirectMessageAccounts, message: IDirectoryDirectMessage): Promise<boolean> {
		if (message.edited === undefined) {
			await this._directMessages.insertOne({ ...message, accounts });
			return true;
		}
		if (message.content) {
			const { matchedCount } = await this._directMessages.updateOne({ accounts, time: message.time }, { $set: { content: message.content, edited: message.edited } });
			Assert(matchedCount <= 1);
			return matchedCount === 1;
		}
		const { deletedCount } = await this._directMessages.deleteOne({ accounts, time: message.time });
		Assert(deletedCount <= 1);
		return deletedCount === 1;
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

	private async _doMigrations(): Promise<void> {
		// insert migration code here
		for await (const account of this._accounts.find()) {
			const settingsLimited = _.cloneDeep(ACCOUNT_SETTINGS_LIMITED_STORED_DEFAULT);
			await this._accounts.updateOne({ id: account.id }, { $set: { settingsLimited } });
		}
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

/**
 * Updates indexes on a collection such that they exactly match the wanted indexes, dropping all other indexes and updating existing ones
 *
 * Ignores the inbuilt `_id_` index
 * @param collection - The collection to update indexes on
 * @param indexes - The wanted indexes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function MongoUpdateIndexes(collection: Collection<any>, indexes: (IndexDescription & { name: string; })[]): Promise<void> {
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
		const wantedIndex = indexes.find((i) => i.name === index.name);
		if (!wantedIndex) {
			rebuildNeeded = true;
			logger.alert(`[Collection ${collection.collectionName}] Rebuilding indexes because of extra index:`, index.name);
			break;
		}

		// Compare existing index to wanted one
		for (const property of indexKeysToCompare) {
			let matches = _.isEqual(index[property], wantedIndex[property]);
			// Collation is compared only for partiality
			if (!matches && property === 'collation' && wantedIndex.collation && IsObject(index.collation)) {
				matches = true;
				for (const k of Object.keys(wantedIndex.collation) as (keyof CollationOptions)[]) {
					if (!_.isEqual(index.collation[k], wantedIndex.collation[k])) {
						matches = false;
						break;
					}
				}
			}
			if (!matches) {
				rebuildNeeded = true;
				logger.alert(`[Collection ${collection.collectionName}] Rebuilding indexes because of mismatched index '${index.name}' property '${property}'`);
				break;
			}
		}
		if (rebuildNeeded)
			break;
	}

	if (rebuildNeeded) {
		await collection.dropIndexes().catch(() => { /* NOOP */ });
		if (indexes.length > 0) {
			await collection.createIndexes(indexes);
		}
	} else {
		// Check for new indexes if we didn't need complete rebuild
		const newIndexes = indexes.filter((i) => !currentIndexes.some((ci) => IsObject(ci) && ci.name === i.name));
		if (newIndexes.length > 0) {
			logger.alert(`[Collection ${collection.collectionName}] Adding missing indexes:`, newIndexes.map((i) => i.name).join(', '));
			await collection.createIndexes(newIndexes);
		}
	}
}
