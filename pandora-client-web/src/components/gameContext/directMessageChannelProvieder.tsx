import { AssertNever, AssertNotNullable, GetLogger } from 'pandora-common';
import { ReactElement, Suspense, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { useNullableObservable } from '../../observable.ts';
import type { ChatEncryption, DirectMessageChat } from '../../services/accountLogic/directMessages/directMessageChat.ts';
import { useService } from '../../services/serviceProvider.tsx';

export type DirectMessageChatContext = {
	chat: DirectMessageChat;
	encryption: ChatEncryption;
};

const directMessageContext = createContext<DirectMessageChatContext | null>(null);

export function DirectMessageChannelProvider({ accountId, children }: ChildrenProps & { accountId: number; }): ReactElement {
	const directMessageManager = useService('directMessageManager');
	const [closed, setClosed] = useState(false);

	const chat = useMemo(() => {
		if (closed)
			return null;

		return directMessageManager.getChat(accountId);
	}, [directMessageManager, accountId, closed]);

	const state = useNullableObservable(chat?.state);
	const encryption = useNullableObservable(chat?.encryption);
	const info = useNullableObservable(chat?.displayInfo);

	useEffect(() => {
		if (chat != null && info != null && info.hasUnread && state === 'ready') {
			chat.manager.connector.sendMessage('directMessage', { id: chat.id, action: 'read' });
		}
	}, [chat, info, state]);

	useEffect(() => directMessageManager.on('close', (id) => {
		if (id === accountId) {
			setClosed(true);
		}
	}), [directMessageManager, accountId]);

	useEffect(() => {
		if (chat != null && chat.state.value !== 'ready') {
			chat.load()
				.catch((err) => {
					GetLogger('DirectMessageChannelProvider')
						.error('Failed to load chat:', err);
				});
		}
	}, [chat]);

	const ctx = useMemo((): DirectMessageChatContext | null => {
		if (chat == null || state !== 'ready' || encryption == null)
			return null;

		return {
			chat,
			encryption,
		};
	}, [chat, encryption, state]);

	if (chat == null || state == null) {
		return <DirectMessageChannelError channel={ chat } message='Chat closed' />;
	} else if (state === 'notLoaded') {
		return (
			<span className='loading'>
				Account: { chat?.id ?? 'unknown' }
				<br />
				Loading...
			</span>
		);
	} else if (state === 'error') {
		return <DirectMessageChannelError channel={ chat } message='Error loading the chat' />;
	} else if (state === 'errorNotFound') {
		return <DirectMessageChannelError channel={ chat } message='Not found' />;
	} else if (state === 'errorNoKeyAvailable') {
		return <DirectMessageChannelError channel={ chat } message={ 'The other account has no usable encryption key.\nThis is most likely caused by them not yet logging in after registration or password reset.' } />;
	} else if (state === 'errorDenied') {
		return <DirectMessageChannelError channel={ chat } message='Denied' />;
	} else if (state === 'ready') {
		if (ctx == null) {
			return <DirectMessageChannelError channel={ chat } message='Error decrypting chat' />;
		}

		return (
			<directMessageContext.Provider value={ ctx }>
				<Suspense fallback={
					<span className='loading'>
						Account: { chat?.id ?? 'unknown' }
						<br />
						Decrypting...
					</span>
				}>
					{ children }
				</Suspense>
			</directMessageContext.Provider>
		);
	}

	AssertNever(state);
}

function DirectMessageChannelError({ channel, message = 'Unknown error' }: { channel: DirectMessageChat | null; message?: string; }): ReactElement {
	return (
		<span className='error display-linebreak'>
			Account: { channel?.id ?? 'unknown' }
			<br />
			{ message }
		</span>
	);
}

export function useDirectMessageChat(): DirectMessageChatContext {
	const channel = useContext(directMessageContext);
	AssertNotNullable(channel);
	return channel;
}
