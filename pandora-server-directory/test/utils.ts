import { nanoid } from 'nanoid';
import { Account, CreateAccountData } from '../src/account/account';
import { accountManager } from '../src/account/accountManager';
import { CharacterInfo } from '../src/account/character';
import { InitDatabaseForTests } from '../src/database/databaseProvider';
import { MockDatabase, PrehashPassword } from '../src/database/mockDb';
import { Shard } from '../src/shard/shard';
import { ShardManager } from '../src/shard/shardManager';
import { ShardConnection } from '../src/networking/connection_shard';
import { IDirectoryShard, IMessageHandler, IShardDirectory, IShardDirectoryNormalResult, MockConnection, MockServerSocket, ShardFeature } from 'pandora-common';

let mockDb: MockDatabase | undefined;

export async function TestMockDb(): Promise<MockDatabase> {
	if (!mockDb) {
		mockDb = new MockDatabase();
		await InitDatabaseForTests(mockDb);
	}
	return mockDb;
}

export async function TestMockAccount({
	username = nanoid(),
	displayName,
	email = `${nanoid()}@project-pandora.com`,
	password = nanoid(),
	activated = true,
}: {
	username?: string;
	displayName?: string;
	email?: string;
	password?: string;
	activated?: boolean;
} = {}): Promise<Account> {
	const db = await TestMockDb();

	const dbRes = await db.createAccount(await CreateAccountData(
		username,
		displayName ?? username,
		PrehashPassword(password),
		email,
		activated,
	));

	if (typeof dbRes === 'string') {
		throw new Error(`Failed to create mock account: ${dbRes}`);
	}

	const account = await accountManager.loadAccountById(dbRes.id);

	if (account == null) {
		throw new Error(`Failed to load mock account`);
	}

	return account;
}

export async function TestMockCharacter(account: Account, finalize: {
	name: string;
} | false = {
	name: nanoid(),
}): Promise<CharacterInfo> {
	const db = await TestMockDb();

	if (!account.isActivated()) {
		throw new Error('Cannot create character on non-active account');
	}

	const character = await account.createCharacter();

	if (character == null) {
		throw new Error(`Failed to create character`);
	}

	if (finalize) {
		if (!await db.updateCharacter(character.id, {
			name: finalize.name,
		}, null)) {
			throw new Error(`Failed to set name for character`);
		}

		if (await character.finishCharacterCreation() == null) {
			throw new Error(`Failed to finish character creation`);
		}
	}

	return character;
}

export type JestFunctionSpy<T extends jest.Func> = jest.SpyInstance<ReturnType<T>, jest.ArgsType<T>>;

export interface TestShardData {
	shard: Shard;
	connection: MockConnection<IShardDirectory, IDirectoryShard>;
	messageHandlerSpy: JestFunctionSpy<IMessageHandler<IDirectoryShard, MockConnection<IShardDirectory, IDirectoryShard>>['onMessage']>;
}

export async function TestMockShard({
	id = nanoid(),
	register = true,
	features = [],
	version = '0.0.42-test',
	messageHandler,
}: {
	id?: string;
	register?: boolean;
	features?: ShardFeature[];
	version?: string;
	messageHandler: IMessageHandler<IDirectoryShard, MockConnection<IShardDirectory, IDirectoryShard>>;
}): Promise<TestShardData> {
	const shard = ShardManager.getOrCreateShard({
		type: 'stable',
		id,
	});

	const server = new MockServerSocket();
	const connection = new MockConnection<IShardDirectory, IDirectoryShard>(messageHandler);
	// Side effect: It connects to manager
	new ShardConnection(server, connection.connect(), {
		id: shard.id,
		type: shard.type,
	});

	// Do register
	if (register) {
		const registerResult = await connection.awaitResponse('shardRegister', {
			publicURL: `http://${shard.id}.shard.pandora.localhost`,
			features,
			version,
			characters: [],
			disconnectCharacters: [],
			spaces: [],
		});
		const expectedRegisterResult: IShardDirectoryNormalResult['shardRegister'] = {
			shardId: shard.id,
			characters: [],
			spaces: [],
			messages: {},
		};
		expect(registerResult).toStrictEqual(expectedRegisterResult);
		expect(shard.registered).toBeTruthy();
	}

	return {
		shard,
		connection,
		messageHandlerSpy: jest.spyOn(messageHandler, 'onMessage'),
	};
}
