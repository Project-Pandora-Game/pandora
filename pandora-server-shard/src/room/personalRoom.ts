import { Room } from './room';
import { Character } from '../character/character';
import { AccountId, DEFAULT_BACKGROUND, GetLogger, IChatRoomDirectoryConfig, RoomInventoryBundle } from 'pandora-common';
import { cloneDeep } from 'lodash';
import { assetManager } from '../assets/assetManager';

export class PersonalRoom extends Room {
	private readonly _character: Character;

	public readonly id: null = null;

	public override get owners(): readonly AccountId[] {
		return [this._character.accountId];
	}

	public override get config(): IChatRoomDirectoryConfig {
		return {
			name: `${this._character.name}'s personal room`,
			description: '',
			public: false,
			maxUsers: 1,
			features: [
				'allowBodyChanges',
				'allowPronounChanges',
			],
			banned: [],
			admin: [],
			password: null,
			// Try to use the first background (if there is some)
			// otherwise default to the default, solid-color background (important for tests that don't have any assets).
			background: assetManager.getBackgrounds()[0].id ?? cloneDeep(DEFAULT_BACKGROUND),
		};
	}

	constructor(character: Character, inventory: RoomInventoryBundle) {
		super(inventory, GetLogger('Room', `[PersonalRoom ${character.id}]`));
		this._character = character;
	}

	protected override _onDataModified(_data: 'inventory'): void {
		this._character.onPersonalRoomChanged();
	}
}
