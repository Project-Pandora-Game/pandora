import type { CharacterId } from '../../../character/characterTypes';

/** A map of a character modifier configuration "type" to type of its data */
export type ModifierConfigurationDataTypesMap = {
	characterList: readonly CharacterId[];
	number: number;
	string: string;
	stringList: readonly string[];
	toggle: boolean;
};
/** Possible "type" of character modifier configuration option */
export type ModifierConfigurationDataTypes = keyof ModifierConfigurationDataTypesMap;

/** Additional options for specific character modifier configuration, per configuration type */
export type ModifierConfigurationDataTypesOptins = {
	number?: {
		allowDecimal?: boolean;
		min?: number;
		max?: number;
		withSlider?: boolean;
	};
	string: {
		maxLength: number;
		match?: RegExp;
	};
	stringList: {
		maxEntryLength: number;
		maxCount: number;
		matchEntry?: RegExp;
	};
};

/** Helper for creating a configuration definition for a specific configuration type. */
type ModifierConfigurationEntryDefinitionInternal<T extends ModifierConfigurationDataTypes = ModifierConfigurationDataTypes> = {
	name: string;
	type: T;
	default: NoInfer<ModifierConfigurationDataTypesMap[T]>;
};

/** A possible value of configuration definition of a character modifier definition. */
export type ModifierConfigurationEntryDefinition<T extends ModifierConfigurationDataTypes = ModifierConfigurationDataTypes> = {
	[k in T]: ModifierConfigurationEntryDefinitionInternal<k> & NoInfer<(
		k extends keyof ModifierConfigurationDataTypesOptins ? {
			options: ModifierConfigurationDataTypesOptins[k];
		} : {
			options?: undefined;
		}
	)>;
}[T];

/** Base type any character modifier types use for their definition. */
export type ModifierConfigurationBase = Readonly<Record<string, ModifierConfigurationEntryDefinition>>;
