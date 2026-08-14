import { CreateCommand, type CommandBuilder, type IEmpty } from 'pandora-common';
import type { CliCommandExecutionContext } from '../cliCommandContext.ts';

export function CreateCliCommand(): CommandBuilder<CliCommandExecutionContext, IEmpty, IEmpty> {
	return CreateCommand<CliCommandExecutionContext>();
}
