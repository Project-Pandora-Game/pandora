import { isEqual } from 'lodash-es';
import * as z from 'zod';
import { CharacterIdSchema } from '../../../character/characterTypes.ts';
import { LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT } from '../../../inputLimits.ts';
import { Assert, AssertNever, KnownObject } from '../../../utility/index.ts';
import { ZodArrayWithInvalidDrop } from '../../../validation.ts';
import type { ModifierConfigurationEntryDefinition } from '../configuration/index.ts';

/** Mapping of a configuration type to its schema type */
type ModifierConfigurationDataTypeSchemaMap = {
	characterList: z.ZodCatch<z.ZodArray<typeof CharacterIdSchema>>;
	number: z.ZodCatch<z.ZodNumber>;
	string: z.ZodCatch<z.ZodString>;
	stringList: z.ZodCatch<z.ZodPipe<z.ZodArray<z.ZodString>, z.ZodTransform<string[], string[]>>>;
	toggle: z.ZodCatch<z.ZodBoolean>;
};

/** Create a schema for character modifier type's configuration data; specifically for a singular config property. */
export function CharacterModifierBuildConfigurationSchemaSingle<const TConfig extends ModifierConfigurationEntryDefinition>(config: TConfig): ModifierConfigurationDataTypeSchemaMap[TConfig['type']];
export function CharacterModifierBuildConfigurationSchemaSingle<const TConfig extends ModifierConfigurationEntryDefinition>(config: TConfig): ModifierConfigurationDataTypeSchemaMap[keyof ModifierConfigurationDataTypeSchemaMap] {
	switch (config.type) {
		case 'string': {
			let schema = z.string().max(config.options.maxLength);
			if (config.options.match) {
				schema = schema.regex(config.options.match);
			}
			return schema.catch(config.default);
		}
		case 'stringList': {
			let schema = z.string().max(config.options.maxEntryLength);
			if (config.options.matchEntry) {
				schema = schema.regex(config.options.matchEntry);
			}
			return ZodArrayWithInvalidDrop(schema, z.string(), config.options.maxCount)
				.catch(() => []);
		}
		case 'number': {
			let schema = z.number();
			if (config.options?.allowDecimal !== true) {
				schema = schema.int();
			}
			if (config.options?.min != null) {
				schema = schema.min(config.options.min);
			}
			if (config.options?.max != null) {
				schema = schema.max(config.options.max);
			}
			return schema.catch(config.default);
		}
		case 'characterList':
			// TODO: Would be nice to ensure values are unique
			return CharacterIdSchema.array().max(LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT)
				.catch(() => []);
		case 'toggle':
			return z.boolean().catch(config.default);
	}
	AssertNever(config);
}

/** Object Schema shape for character modifier type's configuration data */
export type CharacterModifierBuildConfigurationSchemaShape<TConfig extends Readonly<Record<string, ModifierConfigurationEntryDefinition>>> =
	{
		[k in keyof TConfig]: ModifierConfigurationDataTypeSchemaMap[TConfig[k]['type']];
	};

/** Schema type for character modifier type's configuration data */
export type CharacterModifierBuildConfigurationSchemaType<TConfig extends Readonly<Record<string, ModifierConfigurationEntryDefinition>>> =
	z.ZodObject<CharacterModifierBuildConfigurationSchemaShape<TConfig>>;

/** Create a schema for character modifier type's configuration data. */
export function CharacterModifierBuildConfigurationSchema<const TConfig extends Readonly<Record<string, ModifierConfigurationEntryDefinition>>>(config: TConfig): CharacterModifierBuildConfigurationSchemaType<TConfig> {
	const result: Partial<CharacterModifierBuildConfigurationSchemaShape<TConfig>> = {};
	for (const [k, v] of KnownObject.entries(config)) {
		const schema = CharacterModifierBuildConfigurationSchemaSingle(v);
		Assert(isEqual(schema.unwrap().parse(v.default), v.default), "Option's default does not parse");
		result[k] = schema;
	}

	return z.object(result as CharacterModifierBuildConfigurationSchemaShape<TConfig>);
}
