import { noop } from 'lodash-es';
import type { SpaceExtendedInfoResponse, SpaceId, SpaceInviteId } from 'pandora-common';
import { useCallback, useState } from 'react';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';

export function useSpaceExtendedInfo(id: SpaceId, invite?: SpaceInviteId): SpaceExtendedInfoResponse | undefined {
	const [response, setResponse] = useState<SpaceExtendedInfoResponse>();
	const directoryConnector = useDirectoryConnector();

	const fetchData = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('spaceGetInfo', { id, invite });
		setResponse(result);
	}, [directoryConnector, id, invite]);

	useDirectoryChangeListener('spaceList', () => {
		fetchData().catch(noop);
	});

	return response;
}
