import { isEqual } from 'lodash';
import { z } from 'zod';
import { CharacterIdSchema } from '../../../character';
import { Assert, AssertNever } from '../../../utility';
import type { ModifierConfigurationEntryDefinition } from '../configuration';

type ModifierConfigurationDataTypeSchemaMap = {
	characterList: z.ZodArray<typeof CharacterIdSchema>;
	number: z.ZodNumber;
	string: z.ZodString;
	toggle: z.ZodBoolean;
};

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

export type CharacterModifierBuildConfigurationSchemaType<TConfig extends Readonly<Record<string, ModifierConfigurationEntryDefinition>>> =
	z.ZodObject<{
		[k in keyof TConfig]: ModifierConfigurationDataTypeSchemaMap[TConfig[k]['type']];
	}>;

export function CharacterModifierBuildConfigurationSchema<const TConfig extends Readonly<Record<string, ModifierConfigurationEntryDefinition>>>(config: TConfig): CharacterModifierBuildConfigurationSchemaType<TConfig> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result: Record<string, ModifierConfigurationDataTypeSchemaMap[keyof ModifierConfigurationDataTypeSchemaMap]> = {};
	for (const [k, v] of Object.entries(config)) {
		const schema = CharacterModifierBuildConfigurationSchemaSingle(v);
		Assert(isEqual(schema.parse(v.default), v.default), "Option's default does not parse");
		result[k] = schema;
	}

	// @ts-expect-error: Manually narrowed type
	return z.object(result);
}
