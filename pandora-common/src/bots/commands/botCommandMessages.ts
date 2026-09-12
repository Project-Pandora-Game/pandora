import * as z from 'zod';
import { BotCommandArgumentDescriptorSchema } from './botCommandArguments.ts';

/** Descriptor containing metadata of a single command a user can run, that will be forwarded to the bot. */
export interface BotCommandDescriptor {
	/** One or more "keys" of the command - the text which is used to trigger it. E.g. command with key "c" can be run using "!c" */
	key: string | [string, ...string[]];
	/** Short description of the command. Shown in the command list. */
	description: string;
	/** Long description of the command. Shown when user enters just the command name. Optional - defaults to `description`. */
	longDescription?: string;
	/** Text shown after the command name, before description. */
	usage?: string;
}
/** Descriptor containing metadata of a single command a user can run, that will be forwarded to the bot. */
export const BotCommandDescriptorSchema: z.ZodType<BotCommandDescriptor> = z.object({
	key: z.union([z.string(), z.string().array().min(1).refine((k): k is [string, ...string[]] => k.length >= 1)]),
	description: z.string(),
	longDescription: z.string().optional(),
	usage: z.string().optional(),
});

/** Result of user running a bot command. */
export const BotCommandRunResultSchema = z.discriminatedUnion('result', [
	z.object({
		result: z.literal('ok'),
	}),
	z.object({
		/** The command is not valid for this character */
		result: z.literal('invalidCommand'),
	}),
	z.object({
		/** The command is known, but one of already entered arguments failed to process */
		result: z.literal('invalidArguments'),
		/** How many supplied arguments were valid (used for UI) */
		validCount: z.int().nonnegative(),
		/** Arbitrary error message */
		message: z.string(),
	}),
	z.object({
		/** The command is known, the arguments passed, but the command returned failure */
		result: z.literal('runError'),
		/** Arbitrary error message */
		message: z.string().optional(),
	}),
]);
/** Result of user running a bot command. */
export type BotCommandRunResult = z.infer<typeof BotCommandRunResultSchema>;

/**
 * Information about the segment user is expected to enter next.
 *
 * Possible values:
 * - `null` - End of command, no more input after the current argument
 * - `rest` - Any amount of text can follow. It will be passed as a single argument without any processing.
 * - An argument descriptor object - Describes parsed argument that the client will pre-process and offer autocomplete for.
 */
export const BotCommandStructureSegmentResultSchema = z.union([
	z.null(),
	z.literal('rest'),
	BotCommandArgumentDescriptorSchema,
]);
export type BotCommandStructureSegmentResult = z.infer<typeof BotCommandStructureSegmentResultSchema>;

/**
 * Information about command structure from bot for a given command prefix input.
 */
export const BotCommandStructureResultSchema = z.object({
	/** Autocomplete header to show to the user. */
	header: z.string(),
	/**
	 * Information about the segment user is expected to enter next.
	 *
	 * Possible values:
	 * - `null` - End of command, no more input after the current argument
	 * - `rest` - Any amount of text can follow. It will be passed as a single argument without any processing.
	 * - An argument descriptor object - Describes parsed argument that the client will pre-process and offer autocomplete for.
	 */
	nextSegment: BotCommandStructureSegmentResultSchema,
});
export type BotCommandStructureResult = z.infer<typeof BotCommandStructureResultSchema>;

/** Error info when command prefix into segment processing fails. */
export const BotCommandStructureSegmentErrorSchema = z.object({
	/** How many supplied arguments were valid (used for UI) */
	validCount: z.int().nonnegative(),
	/** Arbitrary error message */
	message: z.string(),
});
export type BotCommandStructureSegmentError = z.infer<typeof BotCommandStructureSegmentErrorSchema>;

/** Result of query for command structure part. */
export const BotCommandGetStructureResultSchema = z.discriminatedUnion('result', [
	BotCommandStructureResultSchema.extend({
		result: z.literal('ok'),
	}),
	z.object({
		/** The command is not valid for this character */
		result: z.literal('invalidCommand'),
	}),
	BotCommandStructureSegmentErrorSchema.extend({
		/** The command is known, but one of already entered arguments failed to process */
		result: z.literal('invalidArguments'),
	}),
]);
/** Result of query for command structure part. */
export type BotCommandGetStructureResult = z.infer<typeof BotCommandGetStructureResultSchema>;
