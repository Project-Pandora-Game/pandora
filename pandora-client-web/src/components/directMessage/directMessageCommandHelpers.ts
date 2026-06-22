import { CreateCommand, type CommandBuilder, type IEmpty } from 'pandora-common';
import type { DirectMessageCommandExecutionContext } from './directMessageCommandContext.tsx';

export function CreateDMCommand(): CommandBuilder<DirectMessageCommandExecutionContext, IEmpty, IEmpty> {
	return CreateCommand<DirectMessageCommandExecutionContext>();
}
