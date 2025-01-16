import { z } from 'zod';
import type { EffectsDefinition } from '../../../assets/effects';
import { AssertNever } from '../../../utility';
import type { PermissionConfigDefault, PermissionType } from '../../permissions';
import type { CharacterModifierStrictnessCategory } from '../characterModifierBaseData';
import type { ModifierConfigurationBase } from '../configuration';
import { CharacterModifierBuildConfigurationSchema, type CharacterModifierBuildConfigurationSchemaType } from './configurationBuilder';

/** Base type for a character modifier type definition. */
export interface CharacterModifierTypeDefinitionBase {
	readonly typeId: string;
	readonly visibleName: string;
	readonly permissionDefault: PermissionConfigDefault;
	readonly permissionForbidDefaultAllowOthers?: [PermissionType, ...PermissionType[]];
	readonly strictnessCategory: CharacterModifierStrictnessCategory;
}

/** Character modifier type configuration data */
export interface CharacterModifierTypeConstructedDefinition<TType extends string, TConfig extends ModifierConfigurationBase> extends CharacterModifierTypeDefinitionBase {
	readonly typeId: TType;
	readonly configDefinition: TConfig;
	readonly configSchema: CharacterModifierBuildConfigurationSchemaType<TConfig>;

	readonly applyCharacterEffects?: (config: CharacterModifierConfiguration<TConfig>, currentEffects: EffectsDefinition) => Readonly<Partial<EffectsDefinition>>;
}
/** Character modifier type configuration data */
type CharacterModifierConfiguration<TConfig extends ModifierConfigurationBase> = z.infer<CharacterModifierBuildConfigurationSchemaType<TConfig>>;

export function DefineCharacterModifier<
	const TType extends string,
	const TConfig extends ModifierConfigurationBase,
>(
	intermediateConfig: {
		typeId: TType;
		visibleName: string;
		strictnessCategory: CharacterModifierStrictnessCategory;
		config: TConfig;
	} & Pick<CharacterModifierTypeConstructedDefinition<TType, TConfig>, 'applyCharacterEffects'>,
): CharacterModifierTypeConstructedDefinition<TType, TConfig> {

	const configSchema = CharacterModifierBuildConfigurationSchema(intermediateConfig.config);

	return {
		typeId: intermediateConfig.typeId,
		visibleName: intermediateConfig.visibleName,
		strictnessCategory: intermediateConfig.strictnessCategory,
		permissionDefault:
			intermediateConfig.strictnessCategory === 'normal' ? { allowOthers: 'prompt' } :
				intermediateConfig.strictnessCategory === 'strict' ? { allowOthers: 'no' } :
					intermediateConfig.strictnessCategory === 'extreme' ? { allowOthers: 'no' } :
						AssertNever(intermediateConfig.strictnessCategory),
		permissionForbidDefaultAllowOthers:
			intermediateConfig.strictnessCategory === 'normal' ? undefined :
				intermediateConfig.strictnessCategory === 'strict' ? undefined :
					intermediateConfig.strictnessCategory === 'extreme' ? ['yes'] :
						AssertNever(intermediateConfig.strictnessCategory),
		configDefinition: intermediateConfig.config,
		configSchema,
		applyCharacterEffects: intermediateConfig.applyCharacterEffects,
	};
}
