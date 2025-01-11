import type { z } from 'zod';
import type { EffectsDefinition } from '../../../assets/effects';
import { AssertNever } from '../../../utility';
import type { PermissionConfigDefault, PermissionType } from '../../permissions';
import type { ModifierConfigurationBase } from '../configuration';
import { CharacterModifierBuildConfigurationSchema, type CharacterModifierBuildConfigurationSchemaType } from './configurationBuilder';

export interface CharacterModifierConfigBase {
	readonly typeId: string;
	readonly visibleName: string;
	readonly permissionDefault: PermissionConfigDefault;
	readonly permissionForbidDefaultAllowOthers?: [PermissionType, ...PermissionType[]];
	readonly strictnessCategory: CharacterModifierStrictnessCategory;
}

export interface CharacterModifierConfig<out TType extends string, TConfig extends ModifierConfigurationBase> extends CharacterModifierConfigBase {
	readonly typeId: TType;
	readonly configurationDefinition: TConfig;
	readonly configurationSchema: CharacterModifierBuildConfigurationSchemaType<TConfig>;
}

type CharacterModifierConfiguration<TConfig extends ModifierConfigurationBase> = z.infer<CharacterModifierBuildConfigurationSchemaType<TConfig>>;

/**
 * Category for how strictly is a modifier type perceived.
 * - `normal` - This is a normal modifier, "prompt" permission by default
 * - `strict` - This is a strict modifier, "no" permission by default, but users can still change it to "prompt" or even "yes"
 * - `extreme` - This is a strict modifier, "no" permission by default, and users can only change it to "prompt"
 */
export type CharacterModifierStrictnessCategory =
	| 'normal'
	| 'strict'
	| 'extreme';

export function DefineCharacterModifier<
	const TType extends string,
	const TConfig extends ModifierConfigurationBase,
>(intermediateConfig: {
	typeId: TType;
	visibleName: string;
	strictnessCategory: CharacterModifierStrictnessCategory;
	config: TConfig;

	applyCharacterEffects?: NoInfer<(config: CharacterModifierConfiguration<TConfig>, currentEffects: EffectsDefinition) => Readonly<Partial<EffectsDefinition>>>;
}): CharacterModifierConfig<TType, TConfig> {

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
		configurationDefinition: intermediateConfig.config,
		configurationSchema: CharacterModifierBuildConfigurationSchema(intermediateConfig.config),
	};
}
