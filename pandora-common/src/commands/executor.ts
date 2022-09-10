import { IEmpty } from '../networking';
import { CommandArgumentNeedsQuotes, CommandArgumentQuote, CommandParseQuotedString, CommandParseQuotedStringTrim } from './parsers';

export interface ICommandExecutionContext {
	executionType: 'help' | 'run' | 'autocomplete';
	displayError?(error: string): void;
	commandName: string;
}

export type CommandStepPreparseProcessor = ((input: string) => { value: string; spacing: string; rest: string; });

export type CommandAutocompleteOption = { replaceValue: string; displayValue: string; };
export type CommandAutocompleteResult = {
	header: string;
	options: CommandAutocompleteOption[];
} | null;

export interface CommandStepProcessor<ResultType, Context extends ICommandExecutionContext = ICommandExecutionContext, EntryArguments extends Record<string, never> = IEmpty> {
	preparse: CommandStepPreparseProcessor | 'all' | 'allTrimmed' | 'quotedArg' | 'quotedArgTrimmed';
	parse(input: string, context: Context, args: EntryArguments): { success: true; value: ResultType; } | { success: false; error: string; };
	autocomplete?(input: string, context: Context, args: EntryArguments): CommandAutocompleteOption[];
}

export interface CommandRunner<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
> {
	run(context: Context, args: EntryArguments, rest: string): boolean;

	autocomplete(context: Context, args: EntryArguments, rest: string): CommandAutocompleteResult;
	predictHeader(): string;
}

export class CommandRunnerExecutor<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
> implements CommandRunner<Context, EntryArguments> {

	private readonly handler: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void;

	constructor(handler: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void) {
		this.handler = handler;
	}

	run(context: Context, args: EntryArguments, rest: string): boolean {
		return this.handler(context, args, rest) ?? true;
	}

	autocomplete(): CommandAutocompleteResult {
		return null;
	}

	predictHeader(): string {
		return '';
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
		return this.processor.preparse === 'all' ? (input) => ({ value: input, spacing: '', rest: '' }) :
			this.processor.preparse === 'allTrimmed' ? (input) => ({ value: input.trim(), spacing: '', rest: '' }) :
				this.processor.preparse === 'quotedArg' ? CommandParseQuotedString :
					this.processor.preparse === 'quotedArgTrimmed' ? CommandParseQuotedStringTrim :
						this.processor.preparse;
	}

	run(context: Context, args: EntryArguments, input: string): boolean {
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

	autocomplete(context: Context, args: EntryArguments, input: string): CommandAutocompleteResult {
		const { value, spacing, rest } = this.preprocessor(input);

		const isQuotedPreprocessor = this.processor.preparse === 'quotedArg' || this.processor.preparse === 'quotedArgTrimmed';

		// If nothing follows, this is the thing to autocomplete
		if (!rest && !spacing) {
			const options = !this.processor.autocomplete ? [] :
				this.processor.autocomplete(value, context, args);
			const shouldQuote = isQuotedPreprocessor && options.some(({ replaceValue }) => CommandArgumentNeedsQuotes(replaceValue));

			return options.length > 0 ? {
				header: `🡆<${this.name}>🡄 ${this.next.predictHeader()}`,
				options: options.map(({ displayValue, replaceValue }) => ({
					displayValue,
					replaceValue: shouldQuote ? CommandArgumentQuote(replaceValue, true) : replaceValue,
				})),
			} : null;
		}

		// Otherwise we continue
		const parsed = this.processor.parse(value, context, args);
		// The following completers might need current args, fail if we are invalid
		if (!parsed.success) {
			return null;
		}

		const nextResult = this.next.autocomplete(context, {
			...args,
			[this.name]: parsed.value,
		}, rest);
		return nextResult != null ? {
			header: `<${this.name}> ${nextResult.header}`,
			options: nextResult.options.map(({ replaceValue, displayValue }) => ({
				replaceValue: (isQuotedPreprocessor ? CommandArgumentQuote(value) : value) + ' ' + replaceValue,
				displayValue,
			})),
		} : null;

	}

	predictHeader(): string {
		return `<${this.name}> ${this.next.predictHeader()}`;
	}
}
