import { CommandBuilder, CreateCommand, FormatTimeInterval, ICommandExecutionContext, IEmpty, LIMIT_JOIN_ME_INVITE_MAX_VALIDITY } from 'pandora-common';
import type { useNavigate } from 'react-router';
import type { DirectoryConnector } from '../../networking/directoryConnector.ts';
import type { ShardConnector } from '../../networking/shardConnector.ts';
import type { DirectMessageChat } from '../../services/accountLogic/directMessages/directMessageChat.ts';
import type { IClientCommand } from '../../ui/components/chat/commandsProcessor.ts';
import type { GameState } from '../gameContext/gameStateContextProvider.tsx';

export interface DirectMessageCommandExecutionContext extends ICommandExecutionContext {
	directoryConnector: DirectoryConnector;
	shardConnector: ShardConnector | null;
	gameState: GameState | null;
	chat: DirectMessageChat;
	navigate: ReturnType<typeof useNavigate>;
	sendMessage: (message: string, editing?: number) => Promise<void>;
}

function CreateDMCommand(): CommandBuilder<DirectMessageCommandExecutionContext, IEmpty, IEmpty> {
	return CreateCommand<DirectMessageCommandExecutionContext>();
}

export const DIRECT_MESSAGE_COMMANDS: readonly IClientCommand<DirectMessageCommandExecutionContext>[] = [
	{
		key: ['invite'],
		usage: '',
		description: 'Creates an invite link to your current space',
		longDescription: `Creates an invite link to your current space. This invite is limited to the account, is only valid for ${ FormatTimeInterval(LIMIT_JOIN_ME_INVITE_MAX_VALIDITY) }, and has a single use.`,
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
	},
];
