import { AssertNotNullable } from 'pandora-common';
import React, { createContext, ReactElement, useContext, useMemo, Suspense, useEffect, useState } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DirectMessageChannel } from '../../networking/directMessageManager';
import { useDirectoryConnector } from './directoryConnectorContextProvider';

const directMessageContext = createContext<DirectMessageChannel | null>(null);

function DirectMessageChannelProviderImpl({ accountId, children }: ChildrenProps & { accountId: number }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const [closed, setClosed] = useState(false);
	const channel = useMemo(() => {
		if (closed)
			return null;

		return directoryConnector.directMessageHandler.loadChat(accountId);
	}, [directoryConnector, accountId, closed]);

	useEffect(() => channel?.addMount(), [channel]);
	useEffect(() => directoryConnector.directMessageHandler.on('close', (id) => {
		if (id === accountId) {
			setClosed(true);
		}
	}), [directoryConnector.directMessageHandler, accountId]);

	if (!channel) {
		return (
			<DirectMessageChannelFallback message='Chat closed' />
		);
	}

	if (channel.failed) {
		return (
			<DirectMessageChannelFallback channel={ channel } />
		);
	}

	return (
		<directMessageContext.Provider value={ channel }>
			{ children }
		</directMessageContext.Provider>
	);
}

function DirectMessageChannelFallback({ channel, message = 'Unknown error' }: { channel?: DirectMessageChannel; message?: string }): ReactElement {
	if (channel?.failed) {
		switch (channel.failed) {
			case 'notFound':
				message = 'Account not found';
				break;
			case 'denied':
				message = 'Access denied';
				break;
		}
	}
	return (
		<span>{ message }</span>
	);
}

export function DirectMessageChannelProvider({ accountId, children }: ChildrenProps & { accountId: number }): ReactElement {
	return (
		<Suspense fallback={ <DirectMessageChannelFallback message='Loading...' /> }>
			<DirectMessageChannelProviderImpl accountId={ accountId }>
				{ children }
			</DirectMessageChannelProviderImpl>
		</Suspense>
	);
}

export function useDirectMessageChannel(): DirectMessageChannel {
	const channel = useContext(directMessageContext);
	AssertNotNullable(channel);
	return channel;
}
