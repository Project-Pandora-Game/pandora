import { CharacterId, IShardCharacterDefinition, GetLogger } from 'pandora-common';
import { Character } from './character';

/** Time (in ms) after which manager prunes character without any active connection */
export const CHARACTER_TIMEOUT = 30_000;

const logger = GetLogger('CharacterManager');

export const CharacterManager = new class CharacterManager {
	private readonly _characters: Map<CharacterId, Character> = new Map();

	public getCharacter(id: CharacterId): Character | undefined {
		return this._characters.get(id);
	}

	public getValidCharacters(): Character[] {
		return [...this._characters.values()].filter((c) => c.isValid);
	}

	public listCharacters(): IShardCharacterDefinition[] {
		return [...this._characters.values()]
			.map((char) => ({
				id: char.data.id,
				account: char.data.accountId,
				accessId: char.data.accessId,
				connectSecret: char.connectSecret,
				room: char.room ? char.room.id : null,
			}));
	}

	public listInvalidCharacters(): CharacterId[] {
		return [...this._characters.values()]
			.filter((char) => !char.isValid)
			.map((char) => char.id);
	}

	public async loadCharacter(character: IShardCharacterDefinition): Promise<Character | null> {
		const id = character.id;

		let char = this._characters.get(id);
		if (char) {
			char.update(character);
			return char;
		}

		const data = await Character.load(id, character.accessId);
		if (!data)
			return null;

		char = this._characters.get(id);
		if (char) {
			char.update(character);
			return char;
		}

		logger.debug(`Adding character ${data.id}`);
		char = new Character(data, character.connectSecret, character.room);
		this._characters.set(id, char);
		return char;
	}

	public removeCharacter(id: CharacterId): void {
		const character = this._characters.get(id);
		if (!character)
			return;
		logger.debug(`Removing character ${id}`);
		character.onRemove();
		this._characters.delete(id);
	}
};
