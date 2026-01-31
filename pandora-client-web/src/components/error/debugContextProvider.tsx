import { produce, type Immutable } from 'immer';
import { IDirectoryStatus, IsObject } from 'pandora-common';
import { createContext, ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { DirectoryConnectionState } from '../../networking/directoryConnector.ts';
import { ShardConnectionState } from '../../networking/shardConnector.ts';
import type { ClientGameLogicServicesConnectionInfo } from '../../services/clientGameLogicServices.ts';

export interface DebugData {
	editor?: true;
	directoryState?: DirectoryConnectionState;
	directoryStatus?: IDirectoryStatus;
	shardState?: ShardConnectionState;
	shardConnectionInfo?: Partial<Immutable<ClientGameLogicServicesConnectionInfo>>;
}

export interface DebugContext {
	debugData: DebugData;
	setDebugData: (additionalData: DebugData) => void;
}

export const debugContext = createContext<DebugContext>({
	debugData: {},
	setDebugData: () => {
		throw new Error('setDebugData called outside of the DebugContextProvider');
	},
});

export const DebugContextProvider = ({ children }: ChildrenProps): ReactElement => {
	// TODO: Turn this into a service to avoid re-renders when debug data changes
	const [debugData, setDebugDataInternal] = useState<DebugData>({});

	const setDebugData = useCallback((additionalData: DebugData) => {
		const sanitized = SanitizeDebugData(additionalData);
		setDebugDataInternal((oldData) => {
			return produce(oldData, (draft) => {
				Object.assign(draft, sanitized);
			});
		});
	}, [setDebugDataInternal]);

	const contextData = useMemo(() => ({
		debugData,
		setDebugData,
	}), [debugData, setDebugData]);

	return (
		<debugContext.Provider value={ contextData }>
			{ children }
		</debugContext.Provider>
	);
};

export function useDebugContext(): DebugContext {
	return useContext(debugContext);
}

function SanitizeDebugData(debugData: DebugData): DebugData {
	return produce(debugData, (draft) => {
		if (IsObject(draft.shardConnectionInfo) && draft.shardConnectionInfo.shardConnection != null) {
			draft.shardConnectionInfo.shardConnection.secret = '****';
		}
	});
}
