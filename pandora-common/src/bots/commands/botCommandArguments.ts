import * as z from 'zod';
import { CharacterIdSchema, type CharacterId } from '../../character/characterTypes.ts';
import { CommandStepPreparseProcessorSchema } from '../../commands/parsers.ts';
import type { ZodObjectShape } from '../../validation.ts';

/** Argument that allows typing any text. */
export interface BotCommandArgumentString {
	type: 'string';
}
/** Argument that allows typing any text. */
export const BotCommandArgumentStringSchema: z.ZodObject<ZodObjectShape<BotCommandArgumentString>> = z.object({
	type: z.literal('string'),
});

/** Argument that allows entering a number. */
export interface BotCommandArgumentNumber {
	type: 'number';
	/**
	 * Inclusive minimum for allowed value.
	 * @default Number.MIN_SAFE_INTEGER
	 */
	min?: number;
	/**
	 * Inclusive maximum for allowed value.
	 * @default Number.MAX_SAFE_INTEGER
	 */
	max?: number;
	/**
	 * Whether to allow decimal (non-integer) values.
	 * @default false
	 */
	allowDecimals?: boolean;
}
/** Argument that allows entering a number. */
export const BotCommandArgumentNumberSchema: z.ZodObject<ZodObjectShape<BotCommandArgumentNumber>> = z.object({
	type: z.literal('number'),
	min: z.number().optional(),
	max: z.number().optional(),
	allowDecimals: z.boolean().optional(),
});

/** Argument that allows selecting from the given options. */
export interface BotCommandArgumentEnum {
	type: 'enum';
	options: (string | {
		value: string;
		description?: string;
	})[];
}
/** Argument that allows selecting from the given options. */
export const BotCommandArgumentEnumSchema: z.ZodObject<ZodObjectShape<BotCommandArgumentEnum>> = z.object({
	type: z.literal('enum'),
	options: z.union([
		z.string(),
		z.object({
			value: z.string(),
			description: z.string().optional(),
		}),
	]).array(),
});

/** Argument that allows selecting from the given options, but different value is used to represent the result.
 * This is similar to `enum`, except it resolves the entered text against arbitrarily typed value.
 */
export interface BotCommandArgumentNamedValue {
	type: 'namedValue';
	options: {
		/** The value user enters */
		name: string;
		/** Description shown to the user, similar to enum */
		description?: string;

		// Note: `value` itself is not sent to the client as argument data, but resolved in the bot's argument executor.
	}[];
	/**
	 * If set to true, the autocomplete header will show value if already chosen. The individual options will also be shown instead of the argument name.
	 * @default false
	 */
	autocompleteShowValues?: boolean;
}
/** Argument that allows selecting from the given options, but different value is used to represent the result.
 * This is similar to `enum`, except it resolves the entered text against arbitrarily typed value.
 */
export const BotCommandArgumentNamedValueSchema: z.ZodObject<ZodObjectShape<BotCommandArgumentNamedValue>> = z.object({
	type: z.literal('namedValue'),
	options: z.object({
		name: z.string(),
		description: z.string().optional(),
	}).array(),
	autocompleteShowValues: z.boolean().optional(),
});

/** Argument that allows selecting a character in the same space. */
export interface BotCommandArgumentCharacter {
	type: 'character';
	/**
	 * Whether selecting oneself is allowed:
	 * - `none` - No, only characters from other accounts
	 * - `otherCharacter` - Yes, but only different characters from the same account, not the current one
	 * - `any` - Any character is allowed, including the current one
	 */
	allowSelf: 'none' | 'otherCharacter' | 'any';
	/**
	 * If specified, this further limits list of offered characters only to those defined.
	 */
	allowedCharacters?: CharacterId[];
}
/** Argument that allows selecting a character in the same space. */
export const BotCommandArgumentCharacterSchema: z.ZodObject<ZodObjectShape<BotCommandArgumentCharacter>> = z.object({
	type: z.literal('character'),
	allowSelf: z.enum(['none', 'otherCharacter', 'any']),
	allowedCharacters: CharacterIdSchema.array().optional(),
});

export interface BotCommandArgumentOptionalWrapper {
	type: 'optional';
	argument: BotCommandArgumentProcessor;
}
/** Argument that is optional. */
export const BotCommandArgumentOptionalWrapperSchema: z.ZodObject<ZodObjectShape<BotCommandArgumentOptionalWrapper>> = z.object({
	type: z.literal('optional'),
	argument: z.lazy(() => BotCommandArgumentProcessorSchema),
});

export type BotCommandArgumentProcessor =
	| BotCommandArgumentString
	| BotCommandArgumentNumber
	| BotCommandArgumentEnum
	| BotCommandArgumentNamedValue
	| BotCommandArgumentCharacter
	| BotCommandArgumentOptionalWrapper;
export const BotCommandArgumentProcessorSchema: z.ZodType<BotCommandArgumentProcessor> = z.discriminatedUnion('type', [
	BotCommandArgumentStringSchema,
	BotCommandArgumentNumberSchema,
	BotCommandArgumentEnumSchema,
	BotCommandArgumentNamedValueSchema,
	BotCommandArgumentCharacterSchema,
	BotCommandArgumentOptionalWrapperSchema,
]);

export const BotCommandArgumentDescriptorSchema = z.object({
	preparse: CommandStepPreparseProcessorSchema,
	process: BotCommandArgumentProcessorSchema,
});
export type BotCommandArgumentDescriptor = z.infer<typeof BotCommandArgumentDescriptorSchema>;
