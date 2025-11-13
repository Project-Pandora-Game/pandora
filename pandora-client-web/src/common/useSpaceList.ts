import { noop } from 'lodash-es';
import { EMPTY, type SpaceListInfo } from 'pandora-common';
import { useState, useCallback } from 'react';
import { useDirectoryConnector, useDirectoryChangeListener } from '../components/gameContext/directoryConnectorContextProvider.tsx';

export function useSpacesList(): SpaceListInfo[] | undefined {
	const [data, setData] = useState<SpaceListInfo[]>();
	const directoryConnector = useDirectoryConnector();

	const fetchData = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('listSpaces', EMPTY);
		if (result && result.spaces) {
			setData(result.spaces);
		}
	}, [directoryConnector]);

	useDirectoryChangeListener('spaceList', () => {
		fetchData().catch(noop);
	});

	return data;
}
