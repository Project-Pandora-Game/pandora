import { expect, jest } from '@jest/globals';
import { nanoid } from 'nanoid';
import { IDirectoryShard, IMessageHandler, IShardDirectory, IShardDirectoryNormalResult, MockConnection, MockServerSocket, PANDORA_VERSION_DATABASE, ShardFeature } from 'pandora-common';
import { Account, CreateAccountData } from '../src/account/account.ts';
import { accountManager } from '../src/account/accountManager.ts';
import { CharacterInfo } from '../src/account/character.ts';
import { InitDatabaseForTests } from '../src/database/databaseProvider.ts';
import { MockDatabase, PrehashPassword } from '../src/database/mockDb.ts';
import { ShardConnection } from '../src/networking/connection_shard.ts';
import { Shard } from '../src/shard/shard.ts';
import { ShardManager } from '../src/shard/shardManager.ts';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JestFunctionSpy<T extends ((...args: any) => any)> = jest.Spied<T>;

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
			databaseVersion: PANDORA_VERSION_DATABASE,
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
