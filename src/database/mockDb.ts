import type { ICharacterSelfInfoDb, PandoraDatabase } from './databaseProvider';
import { CreateAccountData } from '../account/account';
import { CharacterId, GetLogger, ICharacterData, ICharacterSelfInfoUpdate, PASSWORD_PREHASH_SALT } from 'pandora-common';

import _ from 'lodash';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';

function HashSHA512Base64(text: string): string {
	return createHash('sha512').update(text, 'utf-8').digest('base64');
}

export function PrehashPassword(password: string): string {
	return HashSHA512Base64(PASSWORD_PREHASH_SALT + password);
}

const logger = GetLogger('db');

export class MockDatabase implements PandoraDatabase {
	private accountDb: Set<DatabaseAccountWithSecure> = new Set();
	private characterDb: Map<CharacterId, ICharacterData> = new Map();
	private _nextAccountId = 1;
	private _nextCharacterId = 1;
	private get accountDbView(): DatabaseAccountWithSecure[] {
		return Array.from(this.accountDb.values());
	}

	constructor() {
		logger.info('Initialized mock database');
	}

	public async init(addTestAccounts?: false): Promise<this> {
		if (addTestAccounts === false)
			return this;

		await this.createAccount(await CreateAccountData(
			'test',
			PrehashPassword('test'),
			'test@project-pandora.com',
			true,
		));
		await this.createAccount(await CreateAccountData(
			'testinactive',
			PrehashPassword('test'),
			'testinactive@project-pandora.com',
			false,
		));
		return this;
	}

	/**
	 * Find and get account with matching `id`
	 * @returns The account data or `null` if not found
	 */
	public getAccountById(id: number): Promise<DatabaseAccountWithSecure | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}

	/**
	 * Find and get account with matching `username`
	 * @returns The account data or `null` if not found
	 */
	public getAccountByUsername(username: string): Promise<DatabaseAccountWithSecure | null> {
		username = username.toLowerCase();
		const acc = this.accountDbView.find((dbAccount) => dbAccount.username.toLowerCase() === username);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}

	/**
	 * Get account by email hash
	 * @param emailHash - Email hash to search for
	 */
	public getAccountByEmailHash(emailHash: string): Promise<DatabaseAccountWithSecure | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.secure.emailHash === emailHash);
		return Promise.resolve(_.cloneDeep(acc ?? null));
	}

	public createAccount(data: DatabaseAccountWithSecure): Promise<DatabaseAccountWithSecure | 'usernameTaken' | 'emailTaken'> {
		const acc = _.cloneDeep(data);
		const conflict = this.accountDbView.find(
			(dbAccount) =>
				dbAccount.username.toLowerCase() === acc.username.toLowerCase() ||
				dbAccount.secure.emailHash === acc.secure.emailHash,
		);
		if (conflict) {
			return Promise.resolve(conflict.username.toLowerCase() === acc.username.toLowerCase() ? 'usernameTaken' : 'emailTaken');
		}
		acc.id = this._nextAccountId++;
		this.accountDb.add(acc);
		return Promise.resolve(_.cloneDeep(acc));
	}

	public setAccountSecure(id: number, data: DatabaseAccountSecure): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === id);
		if (!acc)
			return Promise.resolve();

		acc.secure = _.cloneDeep(data);
		return Promise.resolve();
	}

	public createCharacter(accountId: number): Promise<ICharacterSelfInfoDb> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.reject(new Error('Account not found'));

		const charId: CharacterId = `c${this._nextCharacterId++}`;
		const info = {
			inCreation: true as const,
			id: charId,
			name: '',
			preview: '',
		};
		const char: ICharacterData = {
			inCreation: true as const,
			id: charId,
			accountId: acc.id,
			name: info.name,
			created: -1,
			accessId: nanoid(8),
			bones: [],
			assets: [],
		};

		acc.characters.push(info);
		this.characterDb.set(char.id, char);
		return Promise.resolve(_.cloneDeep(info));
	}

	public finalizeCharacter(accountId: number): Promise<ICharacterData | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.resolve(null);

		if (acc.characters.length === 0)
			return Promise.resolve(null);

		const info = acc.characters[acc.characters.length - 1];
		const char = this.characterDb.get(info.id);
		if (!char?.inCreation)
			return Promise.resolve(null);

		char.inCreation = undefined;
		char.created = Date.now();

		info.inCreation = undefined;
		info.name = char.name;

		return Promise.resolve(_.cloneDeep(char));
	}

	public updateCharacter(accountId: number, { id, ...data }: ICharacterSelfInfoUpdate): Promise<ICharacterSelfInfoDb | null> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.resolve(null);

		const info = acc.characters.find((dbChar) => dbChar.id === id);
		if (!info)
			return Promise.resolve(null);

		if (data.preview)
			info.preview = data.preview;

		return Promise.resolve(_.cloneDeep(info));
	}

	public deleteCharacter(accountId: number, characterId: CharacterId): Promise<void> {
		const acc = this.accountDbView.find((dbAccount) => dbAccount.id === accountId);
		if (!acc)
			return Promise.resolve();

		const info = acc.characters.find((char) => char.id === characterId);
		if (!info)
			return Promise.resolve();

		acc.characters = acc.characters.filter((char) => char.id !== characterId);
		this.characterDb.delete(characterId);
		return Promise.resolve();
	}

	public setCharacterAccess(id: CharacterId): Promise<string | null> {
		const char = this.characterDb.get(id);
		if (!char)
			return Promise.resolve(null);

		char.accessId = nanoid(8);
		return Promise.resolve(char.accessId);
	}

	public getCharacter(id: CharacterId, accessId: string | false): Promise<ICharacterData | null> {
		const char = this.characterDb.get(id);
		if (!char)
			return Promise.resolve(null);

		if (accessId === false)
			char.accessId = accessId = nanoid(8);
		else if (accessId !== char.accessId)
			return Promise.resolve(null);

		return Promise.resolve(_.cloneDeep(char));
	}

	public setCharacter({ id, accessId, ...data }: Partial<ICharacterData> & Pick<ICharacterData, 'id'>): Promise<boolean> {
		const char = this.characterDb.get(id);
		if (char?.accessId !== accessId)
			return Promise.resolve(false);

		_.assign(char, _.cloneDeep(data));
		return Promise.resolve(true);
	}
}
