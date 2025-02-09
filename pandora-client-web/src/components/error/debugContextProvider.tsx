import { produce } from 'immer';
import { pick } from 'lodash';
import { IDirectoryShardInfo, IDirectoryStatus, IsObject } from 'pandora-common';
import { createContext, ReactElement, useCallback, useContext, useMemo, useState } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DirectoryConnectionState } from '../../networking/directoryConnector';
import { ShardConnectionState } from '../../networking/shardConnector';

export interface DebugData {
	editor?: true;
	directoryState?: DirectoryConnectionState;
	directoryStatus?: IDirectoryStatus;
	shardState?: ShardConnectionState;
	shardConnectionInfo?: IDirectoryShardInfo;
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
		if (IsObject(draft.shardConnectionInfo)) {
			draft.shardConnectionInfo = pick(draft.shardConnectionInfo, 'id', 'publicURL', 'features', 'version');
		}
	});
}
