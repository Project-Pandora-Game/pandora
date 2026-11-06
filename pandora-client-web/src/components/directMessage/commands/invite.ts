import { CommandSelectorEnum, FormatTimeInterval, LIMIT_JOIN_ME_INVITE_MAX_VALIDITY } from 'pandora-common';
import { IsSpaceAdmin } from '../../../services/gameLogic/gameStateHooks.ts';
import type { IClientCommand } from '../../../ui/components/chat/commandsProcessor.ts';
import type { DirectMessageCommandExecutionContext } from '../directMessageCommandContext.tsx';
import { CreateDMCommand } from '../directMessageCommandHelpers.ts';

export const COMMAND_DM_INVITE: IClientCommand<DirectMessageCommandExecutionContext> = {
	key: ['invite'],
	usage: '',
	description: 'Creates an invite link to your current space',
	longDescription: `Creates an invite link to your current space. This invite is limited to the account, is only valid for ${FormatTimeInterval(LIMIT_JOIN_ME_INVITE_MAX_VALIDITY)}, and has a single use.`,
	handler: CreateDMCommand()
		.argumentOptional('room', CommandSelectorEnum([
			['space', 'Character joins the space as usual. [default]'],
			['currentRoom', 'Character is invited directly into the room you are currently in. Only space admins can use this.'],
		]))
		.handler(async ({ directoryConnector, accountManager, gameState, chat, displayError, sendMessage }, { room }) => {
			if (gameState?.currentSpace.value.id == null) {
				displayError?.('You are not in a space');
				return false;
			}
			if (room === 'currentRoom' && !IsSpaceAdmin(gameState.currentSpace.value.config, accountManager.currentAccount.value)) {
				displayError?.('You must be an Admin or an Owner to do this.');
				return false;
			}

			const spaceId = gameState.currentSpace.value.id;
			const playerAppearance = gameState.player.getAppearance(gameState.globalState.currentState);

			const resp = await directoryConnector.awaitResponse('spaceInvite', {
				action: 'create',
				data: {
					type: 'joinMe',
					accountId: chat.id,
					roomId: room === 'currentRoom' ? playerAppearance.characterState.currentRoom : undefined,
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
