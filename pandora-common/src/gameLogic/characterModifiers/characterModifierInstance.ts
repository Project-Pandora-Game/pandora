import { cloneDeep } from 'lodash';
import type { GameLogicCharacter } from '../character/character';
import type { CharacterModifierInstanceClientData, CharacterModifierInstanceData } from './characterModifierData';
import { CHARACTER_MODIFIER_TYPE_DEFINITION, type CharacterModifierType, type CharacterModifierTypeDefinition } from './modifierTypes/_index';
import type { CharacterModifierTypeConstructedDefinition } from './helpers/modifierDefinition';

export class GameLogicModifierInstanceServer<TType extends CharacterModifierType> {
	public readonly definition: CharacterModifierTypeDefinition<TType>;
	private data: CharacterModifierInstanceData<TType>;

	constructor(_character: GameLogicCharacter, data: CharacterModifierInstanceData<TType>) {
		this.definition = CHARACTER_MODIFIER_TYPE_DEFINITION[data.type];
		this.data = data;
	}

	public getData(): CharacterModifierInstanceData<TType> {
		return cloneDeep(this.data);
	}

	public getClientData(): CharacterModifierInstanceClientData<TType> {
		return (this.definition.instanceToClientData as CharacterModifierTypeConstructedDefinition<TType, typeof this.definition.configurationDefinition>['instanceToClientData'])(this.data) as CharacterModifierInstanceClientData<TType>;
	}
}

export type GameLogicModifierInstanceServerAny = {
	[TType in CharacterModifierType]: GameLogicModifierInstanceServer<TType>;
}[CharacterModifierType];
