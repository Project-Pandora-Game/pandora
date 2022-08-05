import { nanoid } from 'nanoid';
import { logConfig, LogLevel, SetConsoleOutput } from 'pandora-common';
import { Account, CreateAccountData } from '../src/account/account';
import { accountManager } from '../src/account/accountManager';
import { Character } from '../src/account/character';
import { InitDatabase } from '../src/database/databaseProvider';
import { MockDatabase, PrehashPassword } from '../src/database/mockDb';

export function TestSetupLogging() {
	SetConsoleOutput(LogLevel.FATAL);
	logConfig.onFatal.push(() => {
		fail('Fatal error happened');
	});
}

let mockDb: MockDatabase | undefined;

export async function TestMockDb(): Promise<MockDatabase> {
	if (!mockDb) {
		mockDb = await new MockDatabase().init(false);
		await InitDatabase(mockDb);
	}
	return mockDb;
}

export async function TestMockAccount({
	username = nanoid(),
	email = `${nanoid()}@project-pandora.com`,
	password = nanoid(),
	activated = true,
}: {
	username?: string;
	email?: string;
	password?: string;
	activated?: boolean;
} = {}): Promise<Account> {
	const db = await TestMockDb();

	const dbRes = await db.createAccount(await CreateAccountData(
		username,
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
}): Promise<Character> {
	const db = await TestMockDb();

	if (!account.isActivated()) {
		throw new Error('Cannot create character on non-active account');
	}

	const character = await account.createCharacter();

	if (character == null) {
		throw new Error(`Failed to create character`);
	}

	const accessId = await character.generateAccessId();

	if (accessId == null) {
		throw new Error(`Failed to generate access id for character`);
	}

	if (finalize) {
		if (!await db.setCharacter({
			id: character.id,
			accessId,
			name: finalize.name,
		})) {
			throw new Error(`Failed to set name for character`);
		}

		if (await account.finishCharacterCreation(character.id) == null) {
			throw new Error(`Failed to finish character creation`);
		}
	}

	return character;
}
