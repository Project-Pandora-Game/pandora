import React, { createContext, ReactElement, useContext, useMemo, ReactNode, Suspense, useEffect, useState } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DirectMessageChannel } from '../../networking/directMessageManager';
import { useDirectoryConnector } from './directoryConnectorContextProvider';

const directMessageContext = createContext<DirectMessageChannel>(null as unknown as DirectMessageChannel);

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
			<span>Chat closed</span>
		);
	}

	return (
		<directMessageContext.Provider value={ channel }>
			{children}
		</directMessageContext.Provider>
	);
}

export function DirectMessageChannelProvider({ accountId, children, fallback = 'Loading...' }: ChildrenProps & { accountId: number; fallback?: ReactNode }): ReactElement {
	return (
		<Suspense fallback={ fallback }>
			<DirectMessageChannelProviderImpl accountId={ accountId }>
				{children}
			</DirectMessageChannelProviderImpl>
		</Suspense>
	);
}

export function useDirectMessageChannel(): DirectMessageChannel {
	return useContext(directMessageContext);
}
