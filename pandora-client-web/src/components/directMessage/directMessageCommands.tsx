import type { IClientCommand } from '../../ui/components/chat/commandsProcessor.ts';
import { COMMAND_DM_CLOSE } from './commands/close.ts';
import { COMMAND_DM_INVITE } from './commands/invite.ts';
import type { DirectMessageCommandExecutionContext } from './directMessageCommandContext.tsx';

export const DIRECT_MESSAGE_COMMANDS: readonly IClientCommand<DirectMessageCommandExecutionContext>[] = [
	COMMAND_DM_CLOSE,
	COMMAND_DM_INVITE,
];
