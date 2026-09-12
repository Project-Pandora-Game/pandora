import * as z from 'zod';
import { CharacterIdSchema } from '../../character/characterTypes.ts';
import { CommandStepPreparseProcessorSchema } from '../../commands/parsers.ts';

/** Argument that allows typing any text. */
export const BotCommandArgumentStringSchema = z.object({
	type: z.literal('string'),
});

/** Argument that allows entering a number. */
export const BotCommandArgumentNumberSchema = z.object({
	type: z.literal('number'),
	/**
	 * Inclusive minimum for allowed value.
	 * @default Number.MIN_SAFE_INTEGER
	 */
	min: z.number().optional(),
	/**
	 * Inclusive maximum for allowed value.
	 * @default Number.MAX_SAFE_INTEGER
	 */
	max: z.number().optional(),
	/**
	 * Whether to allow decimal (non-integer) values.
	 * @default false
	 */
	allowDecimals: z.boolean().optional(),
});

/** Argument that allows selecting from the given options. */
export const BotCommandArgumentEnumSchema = z.object({
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
export const BotCommandArgumentNamedValueSchema = z.object({
	type: z.literal('namedValue'),
	options: z.object({
		/** The value user enters */
		name: z.string(),
		/** Description shown to the user, similar to enum */
		description: z.string().optional(),

		// Note: `value` itself is not sent to the client as argument data, but resolved in the bot's argument executor.
	}).array(),
	/**
	 * If set to true, the autocomplete header will show value if already chosen. The individual options will also be shown instead of the argument name.
	 * @default false
	 */
	autocompleteShowValues: z.boolean().optional(),
});

/** Argument that allows selecting a character in the same space. */
export const BotCommandArgumentCharacterSchema = z.object({
	type: z.literal('character'),
	/**
	 * Whether selecting oneself is allowed:
	 * - `none` - No, only characters from other accounts
	 * - `otherCharacter` - Yes, but only different characters from the same account, not the current one
	 * - `any` - Any character is allowed, including the current one
	 */
	allowSelf: z.enum(['none', 'otherCharacter', 'any']),
	/**
	 * If specified, this further limits list of offered characters only to those defined.
	 */
	allowedCharacters: CharacterIdSchema.array().optional(),
});

export const BotCommandArgumentProcessorSchema = z.discriminatedUnion('type', [
	BotCommandArgumentStringSchema,
	BotCommandArgumentNumberSchema,
	BotCommandArgumentEnumSchema,
	BotCommandArgumentNamedValueSchema,
	BotCommandArgumentCharacterSchema,
]);
export type BotCommandArgumentProcessor = z.infer<typeof BotCommandArgumentProcessorSchema>;

export const BotCommandArgumentDescriptorSchema = z.object({
	preparse: CommandStepPreparseProcessorSchema,
	process: BotCommandArgumentProcessorSchema,
});
export type BotCommandArgumentDescriptor = z.infer<typeof BotCommandArgumentDescriptorSchema>;
