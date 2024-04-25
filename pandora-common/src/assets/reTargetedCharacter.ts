import type { ActionTargetCharacter, AssetFrameworkCharacterState, AssetFrameworkRoomState, AssetManager, CharacterAppearance, Item, ItemPath } from '.';
import type { ActionSpaceContext, CharacterId, GameLogicCharacter } from '..';
import { CharacterRestrictionsManager } from '../character/restrictionsManager';
import { EvalItemPath } from './appearanceHelpers';

export class ReTargetedCharacter implements ActionTargetCharacter {
	public readonly roomState: AssetFrameworkRoomState;
	public readonly characterAppearance: CharacterAppearance;
	public readonly characterState: AssetFrameworkCharacterState;

	public readonly type = 'character';
	public readonly allowReTargeting = false;
	public readonly id: CharacterId;
	public readonly character: GameLogicCharacter;

	protected get assetManager(): AssetManager {
		return this.characterState.assetManager;
	}

	constructor(roomState: AssetFrameworkRoomState, characterAppearance: CharacterAppearance) {
		this.roomState = roomState;
		this.characterAppearance = characterAppearance;
		this.characterState = characterAppearance.characterState;
		this.id = characterAppearance.characterState.id;
		this.character = characterAppearance.character;
	}

	public getRestrictionManager(spaceContext: ActionSpaceContext): CharacterRestrictionsManager {
		return new CharacterRestrictionsManager(this.characterAppearance, spaceContext);
	}

	public getItem(path: ItemPath): Item | undefined {
		return this.characterAppearance.getItem(path) || EvalItemPath(this.roomState.items, path);
	}

	public getAssetManager(): AssetManager {
		return this.assetManager;
	}

	public withNoReTargeting(): this {
		return this;
	}

	public getAllItems(): readonly Item[] {
		// TODO - thankfully not called for now
		throw new Error('ReTargetedCharacter.getAllItems not implemented');
	}
}
