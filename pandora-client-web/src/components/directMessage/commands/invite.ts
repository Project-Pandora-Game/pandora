import { FormatTimeInterval, LIMIT_JOIN_ME_INVITE_MAX_VALIDITY } from 'pandora-common';
import type { IClientCommand } from '../../../ui/components/chat/commandsProcessor.ts';
import type { DirectMessageCommandExecutionContext } from '../directMessageCommandContext.tsx';
import { CreateDMCommand } from '../directMessageCommandHelpers.ts';

export const COMMAND_DM_INVITE: IClientCommand<DirectMessageCommandExecutionContext> = {
	key: ['invite'],
	usage: '',
	description: 'Creates an invite link to your current space',
	longDescription: `Creates an invite link to your current space. This invite is limited to the account, is only valid for ${FormatTimeInterval(LIMIT_JOIN_ME_INVITE_MAX_VALIDITY)}, and has a single use.`,
	handler: CreateDMCommand()
		.handler(async ({ directoryConnector, gameState, chat, displayError, sendMessage }) => {
			if (gameState?.currentSpace.value.id == null) {
				displayError?.('You are not in a space');
				return false;
			}

			const spaceId = gameState.currentSpace.value.id;
			const resp = await directoryConnector.awaitResponse('spaceInvite', {
				action: 'create',
				data: {
					type: 'joinMe',
					accountId: chat.id,
				},
			});
			if (resp.result === 'created') {
				await sendMessage(`https://project-pandora.com/space/join/${encodeURIComponent(spaceId)}?invite=${encodeURIComponent(resp.invite.id)}`);
				return true;
			}
			displayError?.('Failed to create invite: ' + resp.result);
			return false;
		}),
};
