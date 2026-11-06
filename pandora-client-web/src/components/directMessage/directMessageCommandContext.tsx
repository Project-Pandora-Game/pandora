import type { Immutable } from 'immer';
import { ICommandExecutionContext, LIMIT_DIRECT_MESSAGE_LENGTH_BASE64, type AccountSettings } from 'pandora-common';
import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import type { DirectoryConnector } from '../../networking/directoryConnector.ts';
import type { ShardConnector } from '../../networking/shardConnector.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useNavigatePandora, type NavigateFunctionPandora } from '../../routing/navigate.ts';
import type { IAccountManager } from '../../services/accountLogic/accountManager.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import type { DirectMessageChat } from '../../services/accountLogic/directMessages/directMessageChat.ts';
import { useGameStateOptional } from '../../services/gameLogic/gameStateHooks.ts';
import { useService } from '../../services/serviceProvider.tsx';
import type { ICommandInvokeContext } from '../../ui/components/chat/commandsProcessor.ts';
import { useDirectMessageChat } from '../gameContext/directMessageChannelProvieder.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import type { GameState } from '../gameContext/gameStateContextProvider.tsx';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider.tsx';

export interface DirectMessageCommandExecutionContext extends ICommandExecutionContext {
	directoryConnector: DirectoryConnector;
	accountManager: IAccountManager;
	shardConnector: ShardConnector | null;
	gameState: GameState | null;
	accountSettings: Immutable<AccountSettings>;
	chat: DirectMessageChat;
	navigate: NavigateFunctionPandora;
	sendMessage: (message: string, editing?: number) => Promise<void>;
}

export function useDirectMessageCommandContext(displayError: boolean): ICommandInvokeContext<DirectMessageCommandExecutionContext> {
	const navigate = useNavigatePandora();

	const directoryConnector = useDirectoryConnector();
	const shardConnector = useShardConnector();
	const gameState = useGameStateOptional();
	const accountManager = useService('accountManager');

	const accountSettings = useAccountSettings();

	const { chat, encryption } = useDirectMessageChat();

	const sendMessage = useCallback<DirectMessageCommandExecutionContext['sendMessage']>(async (message, editing) => {
		const encrypted = message.length === 0 ? '' : await encryption.service.encrypt(message);
		if (encrypted.length > LIMIT_DIRECT_MESSAGE_LENGTH_BASE64) {
			toast(`Encrypted message too long: ${encrypted.length} > ${LIMIT_DIRECT_MESSAGE_LENGTH_BASE64}`, TOAST_OPTIONS_ERROR);
			return;
		}
		const response = await directoryConnector.awaitResponse('sendDirectMessage', { id: chat.id, keyHash: encryption.keyHash, content: encrypted, editing });
		if (response.result !== 'ok') {
			toast(`Failed to send message: ${response.result}`, TOAST_OPTIONS_ERROR);
		}
	}, [directoryConnector, chat, encryption]);

	return useMemo((): ICommandInvokeContext<DirectMessageCommandExecutionContext> => ({
		directoryConnector,
		accountManager,
		shardConnector,
		gameState,
		accountSettings,
		chat,
		navigate,
		sendMessage,
		displayError: displayError ? (message) => toast(message, TOAST_OPTIONS_ERROR) : undefined,
	}), [directoryConnector, accountManager, shardConnector, gameState, accountSettings, chat, navigate, sendMessage, displayError]);
}
