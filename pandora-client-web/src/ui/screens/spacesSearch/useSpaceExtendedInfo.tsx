import { noop } from 'lodash-es';
import type { CharacterId, SpaceExtendedInfoResponse, SpaceId, SpaceInviteId } from 'pandora-common';
import { useCallback, useState } from 'react';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';

export function useSpaceExtendedInfo(id: SpaceId, opts: { invite?: SpaceInviteId; invitedBy?: CharacterId; } = {}): SpaceExtendedInfoResponse | undefined {
	const [response, setResponse] = useState<SpaceExtendedInfoResponse>();
	const directoryConnector = useDirectoryConnector();

	const fetchData = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('spaceGetInfo', { id, invite: opts.invite, invitedBy: opts.invitedBy });
		setResponse(result);
	}, [directoryConnector, id, opts.invite, opts.invitedBy]);

	useDirectoryChangeListener('spaceList', () => {
		fetchData().catch(noop);
	});

	return response;
}
