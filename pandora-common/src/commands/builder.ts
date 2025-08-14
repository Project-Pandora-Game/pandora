import { IEmpty } from '../networking/index.ts';
import { Assert, KnownObject } from '../utility/misc.ts';
import { CommandSelectorDynamic } from './commandHelpers/dynamicSelector.ts';
import { CommandSelectorEnum } from './commandHelpers/enumSelector.ts';
import { CommandExecutorOptions, CommandRunner, CommandRunnerArgParser, CommandRunnerExecutor, CommandRunnerFork, CommandStepProcessor, ICommandExecutionContext } from './executor.ts';

interface CommandBuilderSource<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
	StartArguments extends Record<string, never>,
> {
	build(next: CommandRunner<Context, EntryArguments>): CommandRunner<Context, StartArguments>;
}

class CommandBuilderRoot<
	Context extends ICommandExecutionContext,
	Arguments extends Record<string, never>,
> implements CommandBuilderSource<Context, Arguments, Arguments> {
	public build(next: CommandRunner<Context, Arguments>): CommandRunner<Context, Arguments> {
		return next;
	}
}

class CommandBuilderStep<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
	StartArguments extends Record<string, never>,
	ArgumentName extends string,
	ArgumentResultType,
> implements CommandBuilderSource<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }, StartArguments> {
	private readonly parent: CommandBuilderSource<Context, EntryArguments, StartArguments>;
	private readonly name: ArgumentName;
	private readonly processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>;

	constructor(parent: CommandBuilderSource<Context, EntryArguments, StartArguments>, name: ArgumentName, processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>) {
		this.parent = parent;
		this.name = name;
		this.processor = processor;
	}

	public build(next: CommandRunner<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType; }>): CommandRunner<Context, StartArguments> {
		const processor = new CommandRunnerArgParser<Context, EntryArguments, ArgumentName, ArgumentResultType>(this.name, this.processor, next);
		return this.parent.build(processor);
	}
}

export interface CommandForkDescriptor<Context extends ICommandExecutionContext, StartArguments extends Record<string, never> = Record<never, never>> {
	description: string;
	handler: CommandRunner<Context, StartArguments>;
}

export class CommandBuilder<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
	StartArguments extends Record<string, never>,
> {
	private readonly optionalOnly: boolean;
	private readonly parent: CommandBuilderSource<Context, EntryArguments, StartArguments>;

	constructor(parent: CommandBuilderSource<Context, EntryArguments, StartArguments>, optionalOnly: boolean) {
		this.parent = parent;
		this.optionalOnly = optionalOnly;
	}

	public argument<ArgumentResultType, ArgumentName extends string>(
		name: ArgumentName,
		processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>,
	): ArgumentName extends keyof EntryArguments ? never : CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }, StartArguments>;
	public argument<ArgumentName extends string, ArgumentResultType>(
		name: ArgumentName,
		processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>,
	): CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }, StartArguments> {
		Assert(!this.optionalOnly, 'Non-optional arguments cannot be used after optional arguments');

		return new CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }, StartArguments>(
			new CommandBuilderStep<Context, EntryArguments, StartArguments, ArgumentName, ArgumentResultType>(
				this.parent,
				name,
				processor,
			),
			false,
		);
	}

	public argumentDynamic<ArgumentResultType, ArgumentName extends string>(
		name: ArgumentName,
		options: Omit<CommandStepProcessor<ArgumentResultType, Context>, 'parse' | 'autocomplete'>,
		generate: (context: Context, args: EntryArguments) => Pick<CommandStepProcessor<ArgumentResultType, Context>, 'parse' | 'autocomplete'>,
	): ArgumentName extends keyof EntryArguments ? never : CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }, StartArguments>;
	public argumentDynamic<ArgumentName extends string, ArgumentResultType>(
		name: ArgumentName,
		options: Omit<CommandStepProcessor<ArgumentResultType, Context>, 'parse' | 'autocomplete'>,
		generate: (context: Context, args: EntryArguments) => Pick<CommandStepProcessor<ArgumentResultType, Context>, 'parse' | 'autocomplete'>,
	): CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }, StartArguments> {
		return this.argument(name, CommandSelectorDynamic(options, generate));
	}

	public argumentOptional<ArgumentResultType, ArgumentName extends string>(
		name: ArgumentName,
		processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>,
	): ArgumentName extends keyof EntryArguments ? never : CommandBuilder<Context, EntryArguments & { [i in ArgumentName]?: ArgumentResultType }, StartArguments>;
	public argumentOptional<ArgumentName extends string, ArgumentResultType>(
		name: ArgumentName,
		processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>,
	): CommandBuilder<Context, EntryArguments & { [i in ArgumentName]?: ArgumentResultType }, StartArguments> {
		return new CommandBuilder<Context, EntryArguments & { [i in ArgumentName]?: ArgumentResultType }, StartArguments>(
			new CommandBuilderStep<Context, EntryArguments, StartArguments, ArgumentName, ArgumentResultType | undefined>(
				this.parent,
				name,
				CommandStepOptional(processor),
			),
			true,
		);
	}

	public argumentOptionalDynamic<ArgumentResultType, ArgumentName extends string>(
		name: ArgumentName,
		options: Omit<CommandStepProcessor<ArgumentResultType, Context>, 'parse' | 'autocomplete'>,
		generate: (context: Context, args: EntryArguments) => Pick<CommandStepProcessor<ArgumentResultType, Context>, 'parse' | 'autocomplete'>,
	): ArgumentName extends keyof EntryArguments ? never : CommandBuilder<Context, EntryArguments & { [i in ArgumentName]?: ArgumentResultType }, StartArguments>;
	public argumentOptionalDynamic<ArgumentName extends string, ArgumentResultType>(
		name: ArgumentName,
		options: Omit<CommandStepProcessor<ArgumentResultType, Context>, 'parse' | 'autocomplete'>,
		generate: (context: Context, args: EntryArguments) => Pick<CommandStepProcessor<ArgumentResultType, Context>, 'parse' | 'autocomplete'>,
	): CommandBuilder<Context, EntryArguments & { [i in ArgumentName]?: ArgumentResultType }, StartArguments> {
		return this.argumentOptional(name, CommandSelectorDynamic(options, generate));
	}

	public handler(handler: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void): CommandRunner<Context, StartArguments>;
	public handler(options: CommandExecutorOptions, handler: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void): CommandRunner<Context, StartArguments>;
	public handler(options: CommandExecutorOptions | ((context: Context, args: EntryArguments, rest: string) => boolean | undefined | void), handler?: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void): CommandRunner<Context, StartArguments> {
		if (typeof options === 'function') {
			handler = options;
			options = {};
		}
		const executor = new CommandRunnerExecutor<Context, EntryArguments>(options, handler!);
		return this.parent.build(executor);
	}

	public fork<const ArgumentName extends string, const ForkOptions extends string>(
		name: ArgumentName,
		build: (ctx: NoInfer<CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ForkOptions; }, EntryArguments & { [i in ArgumentName]: ForkOptions; }>>) => Record<ForkOptions, NoInfer<CommandForkDescriptor<Context, EntryArguments & { [i in ArgumentName]: ForkOptions; }>>>,
	): ArgumentName extends keyof EntryArguments ? never : CommandRunner<Context, StartArguments>;
	public fork<const ArgumentName extends string, const ForkOptions extends string>(
		name: ArgumentName,
		build: (ctx: NoInfer<CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ForkOptions; }, EntryArguments & { [i in ArgumentName]: ForkOptions; }>>) => Record<ForkOptions, NoInfer<CommandForkDescriptor<Context, EntryArguments & { [i in ArgumentName]: ForkOptions; }>>>,
	): CommandRunner<Context, StartArguments> {
		Assert(!this.optionalOnly, 'Fork cannot be used after optional arguments');
		const innerRoot = new CommandBuilderRoot<Context, EntryArguments & { [i in ArgumentName]: ForkOptions; }>();
		const ctx = new CommandBuilder(innerRoot, false);
		const descriptor = build(ctx);

		const options = KnownObject.entries(descriptor)
			.map(([k, v]) => [k, v.description] as const);

		return this.argument(name, CommandSelectorEnum(options, true))
			.parent.build(new CommandRunnerFork(name, descriptor));
	}
}

export function CreateCommand<Context extends ICommandExecutionContext>(): CommandBuilder<Context, IEmpty, IEmpty> {
	return new CommandBuilder(new CommandBuilderRoot(), false);
}

function CommandStepOptional<ResultType, Context extends ICommandExecutionContext = ICommandExecutionContext, EntryArguments extends Record<string, never> = IEmpty>(
	processor: CommandStepProcessor<ResultType, Context, EntryArguments>,
): CommandStepProcessor<ResultType | undefined, Context, EntryArguments> {
	const result: CommandStepProcessor<ResultType | undefined, Context, EntryArguments> = {
		...processor,
		parse(input, context, args) {
			if (!input) {
				return { success: true, value: undefined };
			}
			return processor.parse(input, context, args);
		},
		isOptional: true,
	};
	if (processor.autocomplete) {
		const originalAutocomplete = processor.autocomplete.bind(processor);
		result.autocomplete = (input, context, args) => {
			const options = originalAutocomplete(input, context, args);
			return options.length > 0 ? options : [{ replaceValue: '', displayValue: 'none' }];
		};
	}
	return result;
}
