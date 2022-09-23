import React, { createContext, ReactElement, useContext, useMemo, ReactNode, Suspense } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DirectMessageChannel } from '../../networking/directMessageManager';
import { useDirectoryConnector } from './directoryConnectorContextProvider';

const directMessageContext = createContext<DirectMessageChannel>(null as unknown as DirectMessageChannel);

function DirectMessageChannelProviderImpl({ accountId, children }: ChildrenProps & { accountId: number }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const channel = useMemo(() => directoryConnector.directMessageHandler.loadChat(accountId), [directoryConnector, accountId]);

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
