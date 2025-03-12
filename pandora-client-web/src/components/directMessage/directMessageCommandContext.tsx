import { CommandBuilder, CreateCommand, ICommandExecutionContext, IEmpty } from 'pandora-common';
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
		longDescription: 'Creates an invite link to your current space, this invite is limited to the account and has a single use.',
		handler: CreateDMCommand()
			.handler(({ directoryConnector, gameState, chat, displayError, sendMessage }) => {
				(async () => {
					if (gameState?.currentSpace.value.id == null) {
						displayError?.('You are not in a space');
						return;
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
					} else {
						displayError?.('Failed to create invite: ' + resp.result);
					}
				})().catch((e) => {
					if (e instanceof Error)
						displayError?.(`Failed to create invite: ${e.message}`);
				});
			}),
	},
];
