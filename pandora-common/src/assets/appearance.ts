import type { CharacterId } from '../character/characterTypes';
import { CharacterRestrictionsManager } from '../character/restrictionsManager';
import type { GameLogicCharacter } from '../gameLogic/character/character';
import type { ActionSpaceContext } from '../space/space';
import { Assert } from '../utility';
import { EvalItemPath } from './appearanceHelpers';
import type { ActionTargetCharacter, ItemPath } from './appearanceTypes';
import type { AppearanceItems } from './appearanceValidation';
import type { AssetManager } from './assetManager';
import type { AssetId } from './base';
import type { WearableAssetType } from './definitions';
import type { BoneState, CharacterView } from './graphics';
import type { Item } from './item';
import type { AssetFrameworkCharacterState } from './state/characterState';
import type { CharacterArmsPose } from './state/characterStatePose';
import type { RestrictionOverride } from './state/characterStateTypes';

/**
 * A helper wrapper around a global state that allows easy access and manipulation of specific character.
 */
export class CharacterAppearance implements ActionTargetCharacter {
	public readonly characterState: AssetFrameworkCharacterState;

	public readonly type = 'character';
	public readonly id: CharacterId;
	public readonly character: GameLogicCharacter;

	protected get assetManager(): AssetManager {
		return this.characterState.assetManager;
	}

	private get _items(): AppearanceItems<WearableAssetType> {
		return this.characterState.items;
	}

	constructor(characterState: AssetFrameworkCharacterState, character: GameLogicCharacter) {
		this.characterState = characterState;
		this.id = characterState.id;
		Assert(character.id === this.id);
		this.character = character;
	}

	public getRestrictionManager(spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
		return new CharacterRestrictionsManager(this, spaceContext);
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
			armsOrder: this.characterState.actualPose.armsOrder,
		};
	}

	public getView(): CharacterView {
		return this.characterState.actualPose.view;
	}

	public getRestrictionOverride(): RestrictionOverride | undefined {
		return this.characterState.restrictionOverride;
	}
}
