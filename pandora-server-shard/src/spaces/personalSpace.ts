import {
	AccountId,
	GetLogger,
	SpaceDirectoryConfig,
	SpaceInventoryBundle,
	SpaceStateBundle,
} from 'pandora-common';
import { Character } from '../character/character';
import { Space } from './space';

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
		};
	}

	constructor(character: Character, spaceState: SpaceStateBundle, inventory: SpaceInventoryBundle) {
		super(spaceState, inventory, GetLogger('Space', `[PersonalSpace ${character.id}]`));
		this._character = character;
	}

	protected override _onDataModified(_data: 'inventory' | 'space'): void {
		this._character.onPersonalSpaceChanged();
	}
}
