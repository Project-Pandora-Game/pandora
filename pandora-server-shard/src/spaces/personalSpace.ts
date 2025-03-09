import { cloneDeep } from 'lodash-es';
import { AccountId, DEFAULT_BACKGROUND, GetLogger, RoomInventoryBundle, SpaceDirectoryConfig } from 'pandora-common';
import { assetManager } from '../assets/assetManager.ts';
import { Character } from '../character/character.ts';
import { Space } from './space.ts';

export class PersonalSpace extends Space {
	private readonly _character: Character;

	public readonly id: null = null;

	public override get owners(): readonly AccountId[] {
		return [this._character.accountId];
	}

	public override get config(): SpaceDirectoryConfig {
		return {
			name: `${this._character.name}'s personal space`,
			entryText: '',
			description: '',
			public: 'private',
			maxUsers: 1,
			features: [
				'allowBodyChanges',
				'allowPronounChanges',
			],
			banned: [],
			admin: [],
			allow: [],
			// Try to use the first background (if there is some)
			// otherwise default to the default, solid-color background (important for tests that don't have any assets).
			background: assetManager.getBackgrounds()[0].id ?? cloneDeep(DEFAULT_BACKGROUND),
			ghostManagement: null,
		};
	}

	constructor(character: Character, inventory: RoomInventoryBundle) {
		super(inventory, GetLogger('Space', `[PersonalSpace ${character.id}]`));
		this._character = character;
	}

	protected override _onDataModified(_data: 'inventory'): void {
		this._character.onPersonalSpaceChanged();
	}
}
