import { Space } from './space';
import { Character } from '../character/character';
import { AccountId, DEFAULT_BACKGROUND, GetLogger, SpaceDirectoryConfig, RoomInventoryBundle } from 'pandora-common';
import { cloneDeep } from 'lodash';
import { assetManager } from '../assets/assetManager';

export class PersonalSpace extends Space {
	private readonly _character: Character;

	public readonly id: null = null;

	public override get owners(): readonly AccountId[] {
		return [this._character.accountId];
	}

	public override get config(): SpaceDirectoryConfig {
		return {
			name: `${this._character.name}'s personal space`,
			description: '',
			public: false,
			maxUsers: 1,
			features: [
				'allowBodyChanges',
				'allowPronounChanges',
			],
			banned: [],
			admin: [],
			allow: [],
			password: null,
			// Try to use the first background (if there is some)
			// otherwise default to the default, solid-color background (important for tests that don't have any assets).
			background: assetManager.getBackgrounds()[0].id ?? cloneDeep(DEFAULT_BACKGROUND),
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
