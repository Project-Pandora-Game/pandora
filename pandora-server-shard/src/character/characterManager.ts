import { Assert, CharacterId, GetLogger, IShardCharacterDefinition } from 'pandora-common';
import promClient from 'prom-client';
import { assetManager } from '../assets/assetManager.ts';
import { Character } from './character.ts';

const logger = GetLogger('CharacterManager');

const charactersMetric = new promClient.Gauge({
	name: 'pandora_shard_characters',
	help: 'Current count of characters on this shard',
});

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
			.map((char): IShardCharacterDefinition => ({
				id: char.id,
				account: char.accountData,
				accessId: char.accessId,
				connectSecret: char.connectSecret,
				space: char.getCurrentPublicSpaceId(),
			}));
	}

	public listInvalidCharacters(): CharacterId[] {
		return [...this._characters.values()]
			.filter((char) => !char.isValid)
			.map((char) => char.id);
	}

	public async loadCharacter(definition: IShardCharacterDefinition): Promise<Character | null> {
		const id = definition.id;

		let char = this._characters.get(id);
		if (char) {
			char.update(definition);
			return char;
		}

		const data = await Character.load(id, definition.accessId);
		if (!data)
			return null;
		Assert(data.id === definition.id);

		char = this._characters.get(id);
		if (char) {
			char.update(definition);
			return char;
		}

		logger.verbose(`Adding character ${data.id}`);
		char = new Character(data, definition.account, definition.connectSecret, definition.space);
		this._characters.set(id, char);
		charactersMetric.set(this._characters.size);
		return char;
	}

	public removeCharacter(id: CharacterId): Promise<void> {
		const character = this._characters.get(id);
		if (!character)
			return Promise.resolve();
		logger.verbose(`Removing character ${id}`);
		character.onRemove();
		this._characters.delete(id);
		charactersMetric.set(this._characters.size);

		// Save all data after removing character
		return character.save();
	}

	public async removeAllCharacters(): Promise<void> {
		await Promise.allSettled(
			Array.from(this._characters.keys())
				.map((id) => this.removeCharacter(id)),
		);
	}

	public onAssetDefinitionsChanged() {
		for (const character of this._characters.values()) {
			character.reloadAssetManager(assetManager);
		}
	}
};
