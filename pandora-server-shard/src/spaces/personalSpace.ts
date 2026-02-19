import type { Immutable } from 'immer';
import { AccountId, EMPTY_ARRAY, GetLogger, SpaceDirectoryConfig, type SpaceStateBundle, type SpaceSwitchStatus } from 'pandora-common';
import { Character } from '../character/character.ts';
import { Space } from './space.ts';

export class PersonalSpace extends Space {
	private readonly _character: Character;

	public override get owners(): readonly AccountId[] {
		return [this._character.accountId];
	}

	public override get ownerInvites(): readonly AccountId[] {
		return EMPTY_ARRAY;
	}

	public override get spaceSwitchStatus(): Immutable<SpaceSwitchStatus[]> {
		return EMPTY_ARRAY;
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

	constructor(character: Character, spaceState: SpaceStateBundle) {
		super(null, spaceState, GetLogger('Space', `[PersonalSpace ${character.id}]`));
		this._character = character;
	}

	protected override _onDataModified(_data: 'spaceState'): void {
		this._character.onPersonalSpaceChanged();
	}

	public override checkSpaceSwitchStatusUpdates(): void {
		// Nothing to do: Personal space does not support coordinated space switching
	}
}
