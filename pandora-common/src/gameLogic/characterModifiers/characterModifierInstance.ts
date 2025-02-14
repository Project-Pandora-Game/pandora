import { cloneDeep } from 'lodash';
import type { AssetFrameworkGlobalState } from '../../assets';
import type { CurrentSpaceInfo } from '../../space';
import type { GameLogicCharacter } from '../character/character';
import type { CharacterModifierConfiguration, CharacterModifierId } from './characterModifierBaseData';
import type { CharacterModifierEffectData, CharacterModifierInstanceClientData, CharacterModifierInstanceData } from './characterModifierData';
import { EvaluateCharacterModifierConditionChain, type CharacterModifierConditionChain } from './conditions/characterModifierConditionChain';
import { CHARACTER_MODIFIER_TYPE_DEFINITION, type CharacterModifierTypeDefinition } from './modifierTypes/_index';

export class GameLogicModifierInstanceServer {
	public readonly definition: CharacterModifierTypeDefinition;
	private data: CharacterModifierInstanceData;

	public get id(): CharacterModifierId {
		return this.data.id;
	}

	constructor(data: CharacterModifierInstanceData) {
		this.definition = CHARACTER_MODIFIER_TYPE_DEFINITION[data.type];
		this.data = data;
	}

	public getData(): CharacterModifierInstanceData {
		return cloneDeep(this.data);
	}

	public getClientData(): CharacterModifierInstanceClientData {
		return {
			id: this.data.id,
			type: this.data.type,
			enabled: this.data.enabled,
			config: cloneDeep(this.data.config),
			conditions: cloneDeep(this.data.conditions),
		};
	}

	public getEffect(): CharacterModifierEffectData {
		return {
			id: this.data.id,
			type: this.data.type,
			config: cloneDeep(this.data.config),
		};
	}

	public isInEffect(gameState: AssetFrameworkGlobalState, spaceInfo: CurrentSpaceInfo, character: GameLogicCharacter): boolean {
		if (!this.data.enabled)
			return false;

		return EvaluateCharacterModifierConditionChain(this.data.conditions, gameState, spaceInfo, character);
	}

	public setEnabled(enabled: boolean): void {
		this.data.enabled = enabled;
	}

	public setConfig(config: CharacterModifierConfiguration): void {
		this.data.config = {
			...this.data.config,
			...config,
		};
	}

	public setConditions(conditions: CharacterModifierConditionChain): void {
		this.data.conditions = cloneDeep(conditions);
	}
}
