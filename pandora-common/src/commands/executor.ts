import type { IEmpty } from '../networking/index.ts';
import { Assert } from '../utility/misc.ts';
import type { CommandForkDescriptor } from './builder.ts';
import { CommandArgumentNeedsQuotes, CommandArgumentQuote, CommandParseQuotedString, CommandParseQuotedStringTrim } from './parsers.ts';

export interface ICommandExecutionContext {
	executionType: 'help' | 'run' | 'autocomplete';
	displayError?: (error: string) => void;
	commandName: string;
}

export type CommandStepPreparseProcessor = ((input: string) => { value: string; spacing: string; rest: string; });

export type CommandAutocompleteOption = {
	replaceValue: string;
	displayValue: string;
	longDescription?: string;
};
export type CommandAutocompleteResult = {
	header: string;
	options: CommandAutocompleteOption[];
} | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CommandStepProcessor<ResultType, Context extends ICommandExecutionContext = ICommandExecutionContext, EntryArguments extends Record<string, any> = IEmpty> {
	preparse: CommandStepPreparseProcessor | 'all' | 'allTrimmed' | 'quotedArg' | 'quotedArgTrimmed';
	parse(input: string, context: Context, args: EntryArguments): { success: true; value: ResultType; } | { success: false; error: string; };
	autocomplete?(input: string, context: Context, args: EntryArguments): CommandAutocompleteOption[];
	/** If set to true, the autocomplete header will show value if already chosen */
	autocompleteShowValue?: boolean;
	/** Custom value to show instead of argument name */
	autocompleteCustomName?: string;
	/** If set to true, this argument is treated as optional
	 * @note This doesn't affect actual handling, only presetnation. Use `argumentOptional` on the command builder to achieve correct behavior.
	 */
	isOptional?: boolean;
}

export interface CommandRunner<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
> {
	run(context: Context, args: EntryArguments, rest: string): boolean;

	autocomplete(context: Context, args: EntryArguments, rest: string): CommandAutocompleteResult;
	predictHeader(): string;
}

export interface CommandExecutorOptions {
	restArgName?: string;
}

export class CommandRunnerExecutor<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
> implements CommandRunner<Context, EntryArguments> {

	private readonly options: CommandExecutorOptions;
	private readonly handler: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void;

	constructor(options: CommandExecutorOptions, handler: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void) {
		this.options = options;
		this.handler = handler;
	}

	public run(context: Context, args: EntryArguments, rest: string): boolean {
		return this.handler(context, args, rest) ?? true;
	}

	public autocomplete(): CommandAutocompleteResult {
		return this.options.restArgName ? {
			header: `\u25b6<${this.options.restArgName}>\u25c0`,
			options: [],
		} : null;
	}

	public predictHeader(): string {
		return this.options.restArgName ? `<${this.options.restArgName}>` : '';
	}
}

export class CommandRunnerArgParser<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
	ArgumentName extends string,
	ArgumentResultType,
> implements CommandRunner<Context, EntryArguments> {

	private readonly name: ArgumentName;
	private readonly processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>;
	private readonly next: CommandRunner<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }>;

	constructor(name: ArgumentName, processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>, next: CommandRunner<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }>) {
		this.name = name;
		this.processor = processor;
		this.next = next;
	}

	private get preprocessor(): CommandStepPreparseProcessor {
		switch (this.processor.preparse) {
			case 'all':
				return (input) => ({ value: input, spacing: '', rest: '' });
			case 'allTrimmed':
				return (input) => ({ value: input.trim(), spacing: '', rest: '' });
			case 'quotedArg':
				return CommandParseQuotedString;
			case 'quotedArgTrimmed':
				return CommandParseQuotedStringTrim;
			default:
				return this.processor.preparse;
		}
	}

	public run(context: Context, args: EntryArguments, input: string): boolean {
		const { value, rest } = this.preprocessor(input);

		const parsed = this.processor.parse(value, context, args);
		if (!parsed.success) {
			context.displayError?.(parsed.error);
			return false;
		}
		return this.next.run(context, {
			...args,
			[this.name]: parsed.value,
		}, rest);
	}

	public autocomplete(context: Context, args: EntryArguments, input: string): CommandAutocompleteResult {
		const { value, spacing, rest } = this.preprocessor(input);

		const isQuotedPreprocessor = this.processor.preparse === 'quotedArg' || this.processor.preparse === 'quotedArgTrimmed';

		// If nothing follows, this is the thing to autocomplete
		if (!rest && !spacing) {
			const options = !this.processor.autocomplete ? [] :
				this.processor.autocomplete(value, context, args);
			const shouldQuote = isQuotedPreprocessor && options.some(({ replaceValue }) => CommandArgumentNeedsQuotes(replaceValue));

			const currentHeader = this.processor.isOptional === true ? `[${this.processor.autocompleteCustomName ?? this.name}]` :
				`<${this.processor.autocompleteCustomName ?? this.name}>`;
			return {
				header: `\u25b6${currentHeader}\u25c0 ${this.next.predictHeader()}`,
				options: options.map(({ replaceValue, ...optionProps }): CommandAutocompleteOption => ({
					...optionProps,
					replaceValue: shouldQuote ? CommandArgumentQuote(replaceValue, true) : replaceValue,
				})),
			};
		}

		// Otherwise we continue
		const parsed = this.processor.parse(value, context, args);
		// The following completers might need current args, fail if we are invalid
		if (!parsed.success) {
			return null;
		}

		const processedHeader = this.processor.autocompleteShowValue === true ? (isQuotedPreprocessor ? CommandArgumentQuote(value) : value) :
			this.processor.isOptional === true ? `[${this.processor.autocompleteCustomName ?? this.name}]` :
				`<${this.processor.autocompleteCustomName ?? this.name}>`;
		const nextResult = this.next.autocomplete(context, {
			...args,
			[this.name]: parsed.value,
		}, rest);
		return nextResult != null ? {
			header: processedHeader + ' ' + nextResult.header,
			options: nextResult.options.map(({ replaceValue, ...optionProps }): CommandAutocompleteOption => ({
				...optionProps,
				replaceValue: (isQuotedPreprocessor ? CommandArgumentQuote(value) : value) + ' ' + replaceValue,
			})),
		} : null;

	}

	public predictHeader(): string {
		const header = this.processor.isOptional === true ? `[${this.processor.autocompleteCustomName ?? this.name}]` :
			`<${this.processor.autocompleteCustomName ?? this.name}>`;
		return `${header} ${this.next.predictHeader()}`;
	}

}

export class CommandRunnerFork<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
	ArgumentName extends string,
	ForkOptions extends string,
> implements CommandRunner<Context, EntryArguments & { [i in ArgumentName]: ForkOptions; }> {

	private readonly argument: ArgumentName;
	private readonly descriptor: Record<ForkOptions, CommandForkDescriptor<Context, EntryArguments>>;

	constructor(argument: ArgumentName, descriptor: Record<ForkOptions, CommandForkDescriptor<Context, EntryArguments>>) {
		this.argument = argument;
		this.descriptor = descriptor;
	}

	public run(context: Context, args: EntryArguments & { [i in ArgumentName]: ForkOptions; }, input: string): boolean {
		const optionName: ForkOptions = args[this.argument];
		Assert(Object.hasOwn(this.descriptor, optionName));
		const option = this.descriptor[optionName];

		return option.handler.run(context, args, input);
	}

	public autocomplete(context: Context, args: EntryArguments & { [i in ArgumentName]: ForkOptions; }, input: string): CommandAutocompleteResult {
		const optionName: ForkOptions = args[this.argument];
		Assert(Object.hasOwn(this.descriptor, optionName));
		const option = this.descriptor[optionName];

		return option.handler.autocomplete(context, args, input);
	}

	public predictHeader(): string {
		return '\u2026';
	}
}
