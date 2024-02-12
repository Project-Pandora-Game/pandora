import { CommandBuilder, CreateCommand, ICommandExecutionContext, IEmpty } from 'pandora-common';
import type { DirectoryConnector } from '../../networking/directoryConnector';
import type { useNavigate } from 'react-router';
import type { IClientCommand } from '../../ui/components/chat/commandsProcessor';
import type { DirectMessageChannel } from '../../networking/directMessageManager';
import type { GameState } from '../gameContext/gameStateContextProvider';
import type { ShardConnector } from '../../networking/shardConnector';

export interface DirectMessageCommandExecutionContext extends ICommandExecutionContext {
	directoryConnector: DirectoryConnector;
	shardConnector: ShardConnector | null;
	gameState: GameState | null;
	channel: DirectMessageChannel;
	navigate: ReturnType<typeof useNavigate>;
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
			.handler(({ directoryConnector, gameState, channel, displayError }) => {
				(async () => {
					if (gameState?.currentSpace.value.id == null) {
						displayError?.('You are not in a space');
						return;
					}
					if (channel.account == null) {
						displayError?.('Direct message channel is not valid');
						return;
					}

					const spaceId = gameState.currentSpace.value.id.split('/')[1];
					const resp = await directoryConnector.awaitResponse('spaceInvite', {
						action: 'create',
						data: {
							type: 'joinMe',
							accountId: channel.account.id,
						},
					});
					if (resp.result === 'created') {
						await channel.sendMessage(`https://project-pandora.com/space/join/${spaceId}?invite=${resp.invite.id}`);
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
