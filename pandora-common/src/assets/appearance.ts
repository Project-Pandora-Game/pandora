import type { CharacterId, ICharacterMinimalData } from '../character';
import { CharacterRestrictionsManager } from '../character/restrictionsManager';
import type { ActionRoomContext } from '../chatroom';
import { Assert } from '../utility';
import { EvalItemPath } from './appearanceHelpers';
import type { ItemPath, RoomActionTargetCharacter } from './appearanceTypes';
import { AppearanceItems } from './appearanceValidation';
import { AssetManager } from './assetManager';
import { AssetId, WearableAssetType } from './definitions';
import type { BoneState, CharacterView } from './graphics';
import { Item } from './item';
import { AppearanceArmPose, AppearanceBundle, AppearancePose, AssetFrameworkCharacterState, SafemodeData } from './state/characterState';

export const BONE_MIN = -180;
export const BONE_MAX = 180;

/** Time after entering safemode for which you cannot leave it (entering while in dev mode ignores this) */
export const SAFEMODE_EXIT_COOLDOWN = 60 * 60_000;

function GetDefaultAppearanceArmPose(): AppearanceArmPose {
	return {
		position: 'front',
		rotation: 'forward',
		fingers: 'spread',
	};
}

export function GetDefaultAppearancePose(): AppearancePose {
	return {
		bones: {},
		leftArm: GetDefaultAppearanceArmPose(),
		rightArm: GetDefaultAppearanceArmPose(),
		legs: 'standing',
		view: 'front',
	};
}

export function GetDefaultAppearanceBundle(): AppearanceBundle {
	return {
		items: [],
		requestedPose: GetDefaultAppearancePose(),
	};
}

export type AppearanceChangeType = 'items' | 'pose' | 'safemode';

export type CharacterArmsPose = Readonly<Pick<AppearancePose, 'leftArm' | 'rightArm'>>;

/**
 * A helper wrapper around a global state that allows easy access and manipulation of specific character.
 */
export class CharacterAppearance implements RoomActionTargetCharacter {
	public readonly characterState: AssetFrameworkCharacterState;

	public readonly type = 'character';
	public readonly id: CharacterId;
	private readonly getCharacter: () => Readonly<ICharacterMinimalData>;

	protected get assetManager(): AssetManager {
		return this.characterState.assetManager;
	}

	private get _items(): AppearanceItems<WearableAssetType> {
		return this.characterState.items;
	}

	public get character(): Readonly<ICharacterMinimalData> {
		const character = this.getCharacter();
		Assert(character.id === this.id);
		return character;
	}

	constructor(characterState: AssetFrameworkCharacterState, getCharacter: () => Readonly<ICharacterMinimalData>) {
		this.characterState = characterState;
		this.id = characterState.id;
		this.getCharacter = getCharacter;
	}

	public getRestrictionManager(room: ActionRoomContext | null): CharacterRestrictionsManager {
		return new CharacterRestrictionsManager(this, room);
	}

	public getAssetManager(): AssetManager {
		return this.assetManager;
	}

	public getItem(path: ItemPath): Item | undefined {
		return EvalItemPath(this._items, path);
	}

	public listItemsByAsset(asset: AssetId) {
		return this._items.filter((i) => i.asset.id === asset);
	}

	public getAllItems(): AppearanceItems<WearableAssetType> {
		return this._items;
	}

	public getPose(bone: string): BoneState {
		const definition = this.assetManager.getBoneByName(bone);
		if (definition == null)
			throw new Error(`Attempt to get pose for unknown bone: ${bone}`);
		return {
			definition,
			rotation: this.characterState.actualPose.bones[definition.name] || 0,
		};
	}

	public getArmsPose(): CharacterArmsPose {
		return {
			leftArm: this.characterState.actualPose.leftArm,
			rightArm: this.characterState.actualPose.rightArm,
		};
	}

	public getView(): CharacterView {
		return this.characterState.actualPose.view;
	}

	public getSafemode(): Readonly<SafemodeData> | null {
		return this.characterState.safemode ?? null;
	}
}
