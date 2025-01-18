import { cloneDeep } from 'lodash';
import type { CharacterModifierInstanceClientData, CharacterModifierInstanceData } from './characterModifierData';
import { CHARACTER_MODIFIER_TYPE_DEFINITION, type CharacterModifierTypeDefinition } from './modifierTypes/_index';

export class GameLogicModifierInstanceServer {
	public readonly definition: CharacterModifierTypeDefinition;
	private data: CharacterModifierInstanceData;

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
		};
	}
}
