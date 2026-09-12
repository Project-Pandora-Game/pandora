import * as z from 'zod';
import { KnownObject } from '../utility/misc.ts';
import type { CommandStepProcessor } from './executor.ts';

export function CommandParseQuotedString(input: string): { value: string; spacing: string; rest: string; } {
	let value: string = '';
	let spacing: string = '';
	const rest = input
		.replace(/^".*?(?:"|$)|^'.*?(?:'|$)|^[^ ]+/, (v) => {
			value = v[0] === '"' || v[0] === `'` ? v.substring(1, v.length > 1 && v[v.length - 1] === v[0] ? v.length - 1 : v.length) : v;
			return '';
		})
		.replace(/^\s+/, (v) => {
			spacing = v;
			return '';
		})
		.trimStart();
	return { value, spacing, rest };
}

export function CommandParseQuotedStringTrim(input: string): { value: string; spacing: string; rest: string; } {
	const { value, spacing, rest } = CommandParseQuotedString(input);
	return { value: value.trim(), spacing, rest };
}

export function CommandArgumentNeedsQuotes(arg: string): boolean {
	return arg.includes(' ') || arg.startsWith('"') || arg.startsWith(`'`);
}

export function CommandArgumentQuote(arg: string, force: boolean = false): string {
	if (arg.startsWith(`"`)) {
		return `'${arg}'`;
	} else if (arg.startsWith(`'`)) {
		return `"${arg}"`;
	} else if (arg.includes(' ') || force) {
		return arg.includes('"') ? `'${arg}'` : `"${arg}"`;
	}
	return arg;
}

export const CommandSelectorAnyQuotedString = (): CommandStepProcessor<string> => ({
	preparse: 'quotedArg',
	parse(input: string): { success: true; value: string; } {
		return { success: true, value: input };
	},
});

export type CommandStepPreparseProcessor = 'all' | 'allTrimmed' | 'quotedArg' | 'quotedArgTrimmed';

export const COMMAND_STEP_PREPARSE_PROCESSORS: Record<CommandStepPreparseProcessor, ((input: string) => { value: string; spacing: string; rest: string; })> = {
	all: (input) => ({ value: input, spacing: '', rest: '' }),
	allTrimmed: (input) => ({ value: input.trim(), spacing: '', rest: '' }),
	quotedArg: CommandParseQuotedString,
	quotedArgTrimmed: CommandParseQuotedStringTrim,
};

export const CommandStepPreparseProcessorSchema: z.ZodEnum<{ [t in CommandStepPreparseProcessor]: t }> = z.enum(KnownObject.keys(COMMAND_STEP_PREPARSE_PROCESSORS));
