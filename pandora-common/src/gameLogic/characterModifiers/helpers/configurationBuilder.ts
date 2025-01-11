import { isEqual } from 'lodash';
import { z } from 'zod';
import { CharacterIdSchema } from '../../../character/characterTypes';
import { Assert, AssertNever, KnownObject } from '../../../utility';
import type { ModifierConfigurationEntryDefinition } from '../configuration';

/** Mapping of a configuration type to its schema type */
type ModifierConfigurationDataTypeSchemaMap = {
	characterList: z.ZodArray<typeof CharacterIdSchema>;
	number: z.ZodNumber;
	string: z.ZodString;
	toggle: z.ZodBoolean;
};

/** Create a schema for character modifier type's configuration data; specifically for a singular config property. */
function CharacterModifierBuildConfigurationSchemaSingle<const TConfig extends ModifierConfigurationEntryDefinition>(config: TConfig): ModifierConfigurationDataTypeSchemaMap[TConfig['type']] {
	switch (config.type) {
		case 'string': {
			let schema = z.string().max(config.options.maxLength);
			if (config.options.match) {
				schema = schema.regex(config.options.match);
			}
			// @ts-expect-error: Manually narrowed type
			return schema.catch(config.default);
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
			// @ts-expect-error: Manually narrowed type
			return schema.catch(config.default);
		}
		case 'characterList':
			// @ts-expect-error: Manually narrowed type
			return CharacterIdSchema.array().catch(() => []);
		case 'toggle':
			// @ts-expect-error: Manually narrowed type
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
		Assert(isEqual(schema.parse(v.default), v.default), "Option's default does not parse");
		result[k] = schema;
	}

	return z.object(result as CharacterModifierBuildConfigurationSchemaShape<TConfig>);
}
