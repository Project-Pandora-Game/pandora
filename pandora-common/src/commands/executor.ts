import type { BotCommandArgumentDescriptor, BotCommandArgumentProcessor, BotCommandStructureResult, BotCommandStructureSegmentError } from '../bots/index.ts';
import type { ChatCharacterFullStatus } from '../chat/chat.ts';
import type { IEmpty } from '../networking/index.ts';
import { Assert, type Promisable } from '../utility/misc.ts';
import { Result } from '../utility/result.ts';
import type { CommandForkDescriptor } from './builder.ts';
import { COMMAND_STEP_PREPARSE_PROCESSORS, CommandArgumentNeedsQuotes, CommandArgumentQuote, type CommandStepPreparseProcessor } from './parsers.ts';

export interface ICommandExecutionContext {
	executionType: 'help' | 'run' | 'autocomplete' | 'chatstatus';
	displayError?: (error: string) => void;
	commandName: string;
}

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
export interface CommandStepProcessor<ResultType, Context extends object = ICommandExecutionContext, EntryArguments extends Record<string, any> = IEmpty> {
	preparse: CommandStepPreparseProcessor;
	parse(input: string, context: Context, args: EntryArguments): { success: true; value: ResultType; } | { success: false; error: string; };
	autocomplete?(input: string, context: Context, args: EntryArguments): CommandAutocompleteOption[];
	/**
	 * If specified, allows bot-defined commands using this processor to have working autocomplete on the client.
	 *
	 * Note, that unlike `autocomplete`, this method does not receive `input` - it knows only previous arguments
	 * and needs to respond with metadata that will allow client to autocomplete this argument without more communication.
	 */
	getBotProcessor?(context: Context, args: EntryArguments): BotCommandArgumentProcessor | undefined;
	/** If set to true, the autocomplete header will show value if already chosen */
	autocompleteShowValue?: boolean;
	/** Custom value to show instead of argument name */
	autocompleteCustomName?: string;
	/** If set to true, this argument is treated as optional
	 * @note This doesn't affect actual handling, only presetnation. Use `argumentOptional` on the command builder to achieve correct behavior.
	 */
	isOptional?: boolean;
}

export type CommandRunnerBotSegmentInfoResult = Result<BotCommandStructureResult, BotCommandStructureSegmentError>;

export interface CommandRunner<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
> {
	run(context: Context, args: EntryArguments, rest: string): Promisable<boolean>;
	/**
	 * Same as `run`, but input has already been tokenized - doesn't need further splitting up.
	 * @param rest - Unparsed arguments. The array **may be modified**.
	 */
	runTokenized(context: Context, args: EntryArguments, rest: string[]): Promisable<boolean>;

	autocomplete(context: Context, args: EntryArguments, rest: string): CommandAutocompleteResult;
	predictHeader(): string;

	/**
	 * Runs on the bot - used to generate info about next command segment to fill in.
	 *
	 * While `rest` is not empty, the argument is processed and the next chain link should be called.
	 * When the `rest` is empty, then this is the argument that should return its segment descriptor.
	 *
	 * @param context - Context the command is being processed in.
	 * @param args - Arguments processed from earlier link chains.
	 * @param rest - Entered arguments prefix. The argument currently being entered is *not* included.
	 */
	getNextBotSegmentInfo(context: Context, args: EntryArguments, rest: string[]): Promisable<CommandRunnerBotSegmentInfoResult>;

	getChatStatus(context: Context, args: EntryArguments, rest: string): ChatCharacterFullStatus | null;
}

export interface CommandExecutorOptions<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
> {
	restArgName?: string;
	getChatStatus?: (context: Context, args: EntryArguments, rest: string) => ChatCharacterFullStatus | null;
}
export type CommandExecutorHandler<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
> = (context: Context, args: EntryArguments, rest: string) => Promisable<boolean | undefined | void>;

export class CommandRunnerExecutor<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
> implements CommandRunner<Context, EntryArguments> {

	private readonly options: CommandExecutorOptions<Context, EntryArguments>;
	private readonly handler: CommandExecutorHandler<Context, EntryArguments>;

	constructor(options: CommandExecutorOptions<Context, EntryArguments>, handler: CommandExecutorHandler<Context, EntryArguments>) {
		this.options = options;
		this.handler = handler;
	}

	public run(context: Context, args: EntryArguments, rest: string): Promisable<boolean> {
		const result = this.handler(context, args, rest);
		if (result == null || typeof result === 'boolean')
			return result ?? true;

		return result.then((r) => r ?? true);
	}

	public runTokenized(context: Context, args: EntryArguments, rest: string[]): Promisable<boolean> {
		if (rest.length > 1) {
			context.displayError?.(
				`Done parsing command arguments, but received ${rest.length - 1} unknown positional arguments.\n` +
				`If you are trying to pass argument with spaces, make sure to "quote" it.`,
			);
			return false;
		}

		const result = this.handler(context, args, rest.length > 0 ? rest[0] : '');
		if (result == null || typeof result === 'boolean')
			return result ?? true;

		return result.then((r) => r ?? true);
	}

	public autocomplete(): CommandAutocompleteResult {
		return this.options.restArgName ? {
			header: `\u25b6<${this.options.restArgName}>\u25c0`,
			options: [],
		} : null;
	}

	public getNextBotSegmentInfo(_context: Context, _args: EntryArguments, rest: string[]): CommandRunnerBotSegmentInfoResult {
		// This is the last link
		if (rest.length > 0)
			return Result.Err({
				message: `Done parsing command arguments, but received ${rest.length - 1} unknown positional arguments.\n` +
					`If you are trying to pass argument with spaces, make sure to "quote" it.`,
				validCount: 0,
			});

		if (this.options.restArgName) {
			return Result.Ok({
				header: `\u25b6<${this.options.restArgName}>\u25c0`,
				arguments: [],
				nextSegment: 'rest',
			});
		} else {
			return Result.Ok({
				header: '',
				arguments: [],
				nextSegment: null,
			});
		}
	}

	public predictHeader(): string {
		return this.options.restArgName ? `<${this.options.restArgName}>` : '';
	}

	public getChatStatus(context: Context, args: EntryArguments, rest: string): ChatCharacterFullStatus | null {
		return this.options.getChatStatus?.(context, args, rest) ?? null;
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

	private preprocess(input: string): { value: string; spacing: string; rest: string; } {
		return COMMAND_STEP_PREPARSE_PROCESSORS[this.processor.preparse](input);
	}

	public run(context: Context, args: EntryArguments, input: string): Promisable<boolean> {
		const { value, rest } = this.preprocess(input);

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

	public runTokenized(context: Context, args: EntryArguments, input: string[]): Promisable<boolean> {
		const value = input.shift() ?? '';

		const parsed = this.processor.parse(value, context, args);
		if (!parsed.success) {
			context.displayError?.(parsed.error);
			return false;
		}
		return this.next.runTokenized(context, {
			...args,
			[this.name]: parsed.value,
		}, input);
	}

	public autocomplete(context: Context, args: EntryArguments, input: string): CommandAutocompleteResult {
		const { value, spacing, rest } = this.preprocess(input);

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

	public async getNextBotSegmentInfo(context: Context, args: EntryArguments, rest: string[]): Promise<CommandRunnerBotSegmentInfoResult> {
		const isQuotedPreprocessor = this.processor.preparse === 'quotedArg' || this.processor.preparse === 'quotedArgTrimmed';
		const botProcessor = this.processor.getBotProcessor?.(context, args);

		const descriptor: BotCommandArgumentDescriptor = {
			preparse: this.processor.preparse,
			process: botProcessor ?? {
				type: 'string', // Default to string processor, which basically does nothing with the input
			},
		};

		// If nothing follows, this is the thing to get info for
		if (rest.length === 0) {
			const currentHeader = this.processor.isOptional === true ? `[${this.processor.autocompleteCustomName ?? this.name}]` :
				`<${this.processor.autocompleteCustomName ?? this.name}>`;

			return Result.Ok({
				header: `\u25b6${currentHeader}\u25c0 ${this.next.predictHeader()}`,
				arguments: [],
				nextSegment: descriptor,
			});
		}

		// Otherwise we continue
		const value = rest.shift() ?? '';
		const parsed = this.processor.parse(value, context, args);
		if (!parsed.success) {
			// The following completers might need current args, fail if we are invalid
			return Result.Err({
				message: parsed.error,
				validCount: 0,
			});
		}

		const processedHeader = this.processor.autocompleteShowValue === true ? (isQuotedPreprocessor ? CommandArgumentQuote(value) : value) :
			this.processor.isOptional === true ? `[${this.processor.autocompleteCustomName ?? this.name}]` :
				`<${this.processor.autocompleteCustomName ?? this.name}>`;

		return (await this.next.getNextBotSegmentInfo(context, {
			...args,
			[this.name]: parsed.value,
		}, rest))
			.map((nextResult): BotCommandStructureResult => {
				nextResult.header = processedHeader + ' ' + nextResult.header;
				nextResult.arguments.unshift(descriptor);

				return nextResult;
			})
			.map_err((err) => {
				err.validCount++; // This command was valid (we did `shift`)
				return err;
			});
	}

	public getChatStatus(context: Context, args: EntryArguments, input: string): ChatCharacterFullStatus | null {
		const { value, rest } = this.preprocess(input);

		const parsed = this.processor.parse(value, context, args);
		if (!parsed.success)
			return null;

		return this.next.getChatStatus(context, {
			...args,
			[this.name]: parsed.value,
		}, rest);
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

	public run(context: Context, args: EntryArguments & { [i in ArgumentName]: ForkOptions; }, input: string): Promisable<boolean> {
		const optionName: ForkOptions = args[this.argument];
		Assert(Object.hasOwn(this.descriptor, optionName));
		const option = this.descriptor[optionName];

		return option.handler.run(context, args, input);
	}

	public runTokenized(context: Context, args: EntryArguments & { [i in ArgumentName]: ForkOptions; }, input: string[]): Promisable<boolean> {
		const optionName: ForkOptions = args[this.argument];
		Assert(Object.hasOwn(this.descriptor, optionName));
		const option = this.descriptor[optionName];

		return option.handler.runTokenized(context, args, input);
	}

	public autocomplete(context: Context, args: EntryArguments & { [i in ArgumentName]: ForkOptions; }, input: string): CommandAutocompleteResult {
		const optionName: ForkOptions = args[this.argument];
		Assert(Object.hasOwn(this.descriptor, optionName));
		const option = this.descriptor[optionName];

		return option.handler.autocomplete(context, args, input);
	}

	public async getNextBotSegmentInfo(context: Context, args: EntryArguments & { [i in ArgumentName]: ForkOptions; }, rest: string[]): Promise<CommandRunnerBotSegmentInfoResult> {
		const optionName: ForkOptions = args[this.argument];
		Assert(Object.hasOwn(this.descriptor, optionName));
		const option = this.descriptor[optionName];

		return await option.handler.getNextBotSegmentInfo(context, args, rest);
	}

	public predictHeader(): string {
		return '\u2026';
	}

	public getChatStatus(context: Context, args: EntryArguments & { [i in ArgumentName]: ForkOptions; }, input: string): ChatCharacterFullStatus | null {
		const optionName: ForkOptions = args[this.argument];
		Assert(Object.hasOwn(this.descriptor, optionName));
		const option = this.descriptor[optionName];

		return option.handler.getChatStatus(context, args, input);
	}
}
