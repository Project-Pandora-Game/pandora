import type { IClientCommand } from '../../../ui/components/chat/commandsProcessor.ts';
import type { DirectMessageCommandExecutionContext } from '../directMessageCommandContext.tsx';
import { CreateDMCommand } from '../directMessageCommandHelpers.ts';

export const COMMAND_DM_CLOSE: IClientCommand<DirectMessageCommandExecutionContext> = {
	key: ['close'],
	usage: '',
	description: `Close this Direct Message chat`,
	longDescription: `When you close a Direct Message chat, it will no longer appear in the list of your DMs.
Messages are not deleted and you can view them again by opening the chat manually. You also still get notified about new messages.
`,
	handler: CreateDMCommand()
		.handler(({ chat }) => {
			chat.manager.connector.sendMessage('directMessage', { id: chat.id, action: 'close' });
		}),
};
