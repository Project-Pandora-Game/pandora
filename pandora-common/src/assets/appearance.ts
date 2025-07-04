import type { CharacterId } from '../character/characterTypes.ts';
import { CharacterRestrictionsManager } from '../character/restrictionsManager.ts';
import type { GameLogicCharacter } from '../gameLogic/character/character.ts';
import type { ActionSpaceContext } from '../space/space.ts';
import { Assert } from '../utility/misc.ts';
import { EvalItemPath } from './appearanceHelpers.ts';
import type { ActionTargetCharacter, ItemPath } from './appearanceTypes.ts';
import type { AssetManager } from './assetManager.ts';
import type { AssetId } from './base.ts';
import type { WearableAssetType } from './definitions.ts';
import type { CharacterView } from './graphics/index.ts';
import type { Item } from './item/index.ts';
import type { AppearanceItems } from './item/items.ts';
import type { AssetFrameworkCharacterState } from './state/characterState.ts';
import type { RestrictionOverride } from './state/characterStateTypes.ts';
import type { AssetFrameworkGlobalState } from './state/globalState.ts';

/**
 * A helper wrapper around a global state that allows easy access and manipulation of specific character.
 */
export class CharacterAppearance implements ActionTargetCharacter {
	public readonly gameState: AssetFrameworkGlobalState;
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

	constructor(gameState: AssetFrameworkGlobalState, character: GameLogicCharacter) {
		const characterState = gameState.getCharacterState(character.id);
		Assert(characterState != null, 'Attempting to get character appearance from a state where the character does not exist');

		this.gameState = gameState;
		this.characterState = characterState;
		this.id = characterState.id;
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

	public getView(): CharacterView {
		return this.characterState.actualPose.view;
	}

	public getRestrictionOverride(): RestrictionOverride | undefined {
		return this.characterState.restrictionOverride;
	}
}
