import { IEmpty } from '../networking';
import { BoolSelect } from '../utility';
import { CommandRunner, CommandRunnerArgParser, CommandRunnerExecutor, CommandStepProcessor, CommandExecutorOptions, ICommandExecutionContext } from './executor';

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

export class CommandBuilder<
	Context extends ICommandExecutionContext,
	EntryArguments extends Record<string, never>,
	StartArguments extends Record<string, never>,
	PreChecked extends boolean = false,
> {

	private readonly parent: CommandBuilderSource<Context, EntryArguments, StartArguments>;
	private _preCheck!: BoolSelect<PreChecked, (context: Context) => boolean, undefined>;

	constructor(parent: CommandBuilderSource<Context, EntryArguments, StartArguments>) {
		this.parent = parent;
	}

	public argument<ArgumentResultType, ArgumentName extends string>(
		name: ArgumentName,
		processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>,
	): ArgumentName extends keyof EntryArguments ? never : CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }, StartArguments>;
	public argument<ArgumentName extends string, ArgumentResultType>(
		name: ArgumentName,
		processor: CommandStepProcessor<ArgumentResultType, Context, EntryArguments>,
	): CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }, StartArguments> {
		return new CommandBuilder<Context, EntryArguments & { [i in ArgumentName]: ArgumentResultType }, StartArguments>(
			new CommandBuilderStep<Context, EntryArguments, StartArguments, ArgumentName, ArgumentResultType>(
				this.parent,
				name,
				processor,
			),
		);
	}

	public preCheck(
		_preCheck: BoolSelect<PreChecked, never, (context: Context) => boolean>,
	): BoolSelect<PreChecked, never, CommandBuilder<Context, EntryArguments, StartArguments, true>> {
		const preChecked = this as CommandBuilder<Context, EntryArguments, StartArguments, true>;
		preChecked._preCheck = _preCheck;
		return preChecked as BoolSelect<PreChecked, never, CommandBuilder<Context, EntryArguments, StartArguments, true>>;
	}

	public handler(handler: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void): CommandRunner<Context, StartArguments>;
	public handler(options: CommandExecutorOptions, handler: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void): CommandRunner<Context, StartArguments>;
	public handler(options: CommandExecutorOptions | ((context: Context, args: EntryArguments, rest: string) => boolean | undefined | void), handler?: (context: Context, args: EntryArguments, rest: string) => boolean | undefined | void): CommandRunner<Context, StartArguments> {
		if (typeof options === 'function') {
			handler = options;
			options = {};
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const executor = new CommandRunnerExecutor<Context, EntryArguments>(options, handler!, this._preCheck);
		return this.parent.build(executor);
	}
}

export function CreateCommand<Context extends ICommandExecutionContext>(): CommandBuilder<Context, IEmpty, IEmpty> {
	return new CommandBuilder(new CommandBuilderRoot());
}
