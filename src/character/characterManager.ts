import type { CharacterId, ICharacterData, ICharacterDataUpdate } from 'pandora-common';
import { GetLogger } from 'pandora-common/dist/logging';
import { GetDatabase, ShardDatabase } from '../database/databaseProvider';
import Character, { CharacterModification } from './character';

const logger = GetLogger('CharacterManager');

export default new class CharacterManager {
	private readonly _characters: Map<CharacterId, Character> = new Map();
	private _db!: ShardDatabase;

	public init(): this {
		this._db = GetDatabase();
		return this;
	}

	public listUsedCharacters(): { accountId: number; characterId: CharacterId; accessId: string; inUse: boolean; }[] {
		return [...this._characters.values()]
			.map((char) => ({
				accountId: char.data.accountId,
				characterId: char.data.id,
				accessId: char.data.accessId,
				inUse: char.isInUse(),
			}));
	}

	public async loadCharacter(id: CharacterId, accessId: string): Promise<Character | null> {
		let char = this._characters.get(id);
		if (char)
			return char;

		const data = await this.getCharacterData(id, accessId);
		if (!data)
			return null;

		char = this._characters.get(id);
		if (char)
			return char;

		char = new Character(data);
		this._characters.set(id, char);
		return char;
	}

	public getCharacter(id: CharacterId): Character | undefined {
		return this._characters.get(id);
	}

	public async saveCharacter(char: Character): Promise<void> {
		if (char.state !== CharacterModification.MODIFIED)
			return;

		char.state = CharacterModification.PENDING;
		const keys: (keyof Omit<ICharacterDataUpdate, 'id'>)[] = [...char.modified];
		char.modified.clear();

		const data: ICharacterDataUpdate = {
			id: char.data.id,
			accessId: char.data.accessId,
		};

		for (const key of keys) {
			data[key] = char.data[key];
		}

		if (await this.setCharacterData(char.data)) {
			if (char.state === CharacterModification.PENDING)
				char.state = CharacterModification.NONE;

			char.lastModified = Date.now();
		} else {
			for (const key of keys) {
				char.modified.add(key);
			}
			char.state = CharacterModification.MODIFIED;
		}
	}

	public invalidateCharacters(...accountIds: CharacterId[]): void {
		for (const id of accountIds) {
			this._characters.get(id)?.invalidate();
			this._characters.delete(id);
		}
	}

	private async getCharacterData(id: CharacterId, accessId: string): Promise<ICharacterData | null> {
		const character = await this._db.getCharacter(id, accessId);
		if (character === false) {
			logger.warning(`Character ${id} could not be loaded`);
			return null;
		}
		return character;
	}

	private async setCharacterData(data: ICharacterDataUpdate): Promise<boolean> {
		return await this._db.setCharacter(data);
	}
};
