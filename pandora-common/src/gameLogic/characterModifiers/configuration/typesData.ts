import type { CharacterId } from '../../../character';

export type ModifierConfigurationDataTypesMap = {
	characterList: readonly CharacterId[];
	number: number;
	string: string;
	toggle: boolean;
};
export type ModifierConfigurationDataTypes = keyof ModifierConfigurationDataTypesMap;

export type ModifierConfigurationDataTypesOptins = {
	number?: {
		allowDecimal?: boolean;
		min?: number;
		max?: number;
	};
	string: {
		maxLength: number;
		match?: RegExp;
	};
};

type ModifierConfigurationEntryDefinitionInternal<T extends ModifierConfigurationDataTypes = ModifierConfigurationDataTypes> = {
	name: string;
	type: T;
	default: ModifierConfigurationDataTypesMap[T];
	options: T extends keyof ModifierConfigurationDataTypesOptins ? ModifierConfigurationDataTypesOptins[T] : undefined;
};

export type ModifierConfigurationEntryDefinition<T extends ModifierConfigurationDataTypes = ModifierConfigurationDataTypes> = {
	[k in T]: ModifierConfigurationEntryDefinitionInternal<k>;
}[T];

export type ModifierConfigurationBase = Readonly<Record<string, ModifierConfigurationEntryDefinition>>;
