import { cloneDeep } from 'lodash';
import { z, type ZodObject } from 'zod';
import type { EffectsDefinition } from '../../../assets/effects';
import { Assert, AssertNever } from '../../../utility';
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
	readonly configurationDefinition: TConfig;
	readonly instanceDataSchema: CharacterModifierInstanceDataSchema<TType, TConfig>;
	readonly effectDataSchema: CharacterModifierEffectDataSchema<TType, TConfig>;

	readonly applyCharacterEffects?: (config: CharacterModifierConfiguration<TConfig>, currentEffects: EffectsDefinition) => Readonly<Partial<EffectsDefinition>>;

	instanceToEffect(instance: z.infer<CharacterModifierInstanceDataSchema<TType, TConfig>>): z.infer<CharacterModifierEffectDataSchema<TType, TConfig>>;
}
/** Character modifier type configuration data */
type CharacterModifierConfiguration<TConfig extends ModifierConfigurationBase> = z.infer<CharacterModifierBuildConfigurationSchemaType<TConfig>>;

/** "Common" data for all character modifier instances */
export const CharacterModifierInstanceCommonDataSchema = z.object({
	/** Unique identifier */
	id: z.string(),
	enabled: z.boolean(),
});
type CharacterModifierInstanceDataSchema<TType extends string, TConfig extends ModifierConfigurationBase> = z.ZodObject<z.objectUtil.extendShape<(typeof CharacterModifierInstanceCommonDataSchema extends ZodObject<infer TShape> ? TShape : never), {
	type: z.ZodLiteral<TType>;
	config: CharacterModifierBuildConfigurationSchemaType<TConfig>;
}>>;

/** "Common" data for all character modifier effects */
export const CharacterModifierEffectCommonDataSchema = z.object({
	id: z.string(),
});

type CharacterModifierEffectDataSchema<TType extends string, TConfig extends ModifierConfigurationBase> = z.ZodObject<z.objectUtil.extendShape<(typeof CharacterModifierEffectCommonDataSchema extends ZodObject<infer TShape> ? TShape : never), {
	type: z.ZodLiteral<TType>;
	config: CharacterModifierBuildConfigurationSchemaType<TConfig>;
}>>;

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

	const instanceDataSchema: CharacterModifierInstanceDataSchema<TType, TConfig> = CharacterModifierInstanceCommonDataSchema.extend({
		type: z.literal(intermediateConfig.typeId),
		config: configSchema,
	});

	const effectDataSchema: CharacterModifierEffectDataSchema<TType, TConfig> = CharacterModifierEffectCommonDataSchema.extend({
		type: z.literal(intermediateConfig.typeId),
		config: configSchema,
	});

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
		instanceDataSchema,
		effectDataSchema,
		applyCharacterEffects: intermediateConfig.applyCharacterEffects,

		instanceToEffect(instance: z.infer<CharacterModifierInstanceDataSchema<TType, TConfig>>): z.infer<CharacterModifierEffectDataSchema<TType, TConfig>> {
			Assert(instance.type === intermediateConfig.typeId);

			return {
				id: instance.id,
				type: instance.type,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
				config: cloneDeep(instance.config) as any,
			};
		},
	};
}
