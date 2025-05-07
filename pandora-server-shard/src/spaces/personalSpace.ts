import { AccountId, GetLogger, RoomInventoryBundle, SpaceDirectoryConfig } from 'pandora-common';
import { Character } from '../character/character.ts';
import { Space } from './space.ts';

export class PersonalSpace extends Space {
	private readonly _character: Character;

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
			],
			banned: [],
			admin: [],
			allow: [],
			ghostManagement: null,
		};
	}

	constructor(character: Character, inventory: RoomInventoryBundle) {
		super(null, inventory, GetLogger('Space', `[PersonalSpace ${character.id}]`));
		this._character = character;
	}

	protected override _onDataModified(_data: 'inventory'): void {
		this._character.onPersonalSpaceChanged();
	}
}
