import { isEqual } from 'lodash';
import { z } from 'zod';
import { Assert, AssertNever } from '../../../utility';
import type { PermissionConfigDefault, PermissionType } from '../../permissions';
import type { CharacterModifierStrictnessCategory } from '../characterModifierBaseData';
import type { CharacterModifierEffectData } from '../characterModifierData';
import type { CharacterModifierProperties, CharacterModifierPropertiesApplier } from '../characterModifierProperties';
import type { ModifierConfigurationBase } from '../configuration';
import { CharacterModifierBuildConfigurationSchema, type CharacterModifierBuildConfigurationSchemaType } from './configurationBuilder';

/** Base type for a character modifier type definition. */
export interface CharacterModifierTypeDefinitionBase {
	readonly typeId: string;
	readonly visibleName: string;
	readonly description: string;
	readonly permissionDefault: PermissionConfigDefault;
	readonly permissionForbidDefaultAllowOthers?: [PermissionType, ...PermissionType[]];
	readonly strictnessCategory: CharacterModifierStrictnessCategory;
}

/** Character modifier type configuration data */
export interface CharacterModifierTypeConstructedDefinition<TType extends string, TConfig extends ModifierConfigurationBase> extends CharacterModifierTypeDefinitionBase {
	readonly typeId: TType;
	readonly configDefinition: TConfig;
	readonly configSchema: CharacterModifierBuildConfigurationSchemaType<TConfig>;

	createPropertiesApplier(effect: CharacterModifierEffectData): CharacterModifierPropertiesApplier;
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
		description: string;
		strictnessCategory: CharacterModifierStrictnessCategory;
		config: TConfig;
	} & NoInfer<CharacterModifierProperties<CharacterModifierConfiguration<TConfig>>>,
): CharacterModifierTypeConstructedDefinition<TType, TConfig> {

	const configSchema = CharacterModifierBuildConfigurationSchema(intermediateConfig.config);

	return {
		typeId: intermediateConfig.typeId,
		visibleName: intermediateConfig.visibleName,
		description: intermediateConfig.description.trim(),
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
		createPropertiesApplier(effect): CharacterModifierPropertiesApplier {
			Assert(effect.type === intermediateConfig.typeId, 'Different modifier type passed');
			const parsedConfig = configSchema.parse(effect.config);
			Assert(isEqual(parsedConfig, effect.config), 'Incompatible configuration passed to character modifier properties applier');

			return {
				applyCharacterEffects: intermediateConfig.applyCharacterEffects?.bind(globalThis, parsedConfig) ?? null,
				checkCharacterAction: intermediateConfig.checkCharacterAction?.bind(globalThis, parsedConfig) ?? null,
				checkChatMessage: intermediateConfig.checkChatMessage?.bind(globalThis, parsedConfig) ?? null,
				processChatMessageBeforeMuffle: intermediateConfig.processChatMessageBeforeMuffle?.bind(globalThis, parsedConfig) ?? null,
				processChatMessageAfterMuffle: intermediateConfig.processChatMessageAfterMuffle?.bind(globalThis, parsedConfig) ?? null,
				processReceivedChatMessageBeforeFilters: intermediateConfig.processReceivedChatMessageBeforeFilters?.bind(globalThis, parsedConfig) ?? null,
				processReceivedChatMessageAfterFilters: intermediateConfig.processReceivedChatMessageAfterFilters?.bind(globalThis, parsedConfig) ?? null,
				effect,
			};
		},
	};
}
