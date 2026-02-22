import { GetLogger, SpaceId, SpaceIdSchema, SpaceInviteId, SpaceInviteIdSchema } from 'pandora-common';
import React, { ReactElement } from 'react';
import { useLocation, useParams } from 'react-router';
import { DivContainer } from '../../../components/common/container/container.tsx';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { SpaceDetails } from '../spacesSearch/spaceDetails.tsx';
import { useSpaceExtendedInfo } from '../spacesSearch/useSpaceExtendedInfo.tsx';
import { INVALID_INVITE_MESSAGES } from './inviteEmbed.tsx';
import './spaceJoin.scss';

export function SpaceJoin(): ReactElement {
	const { spaceId: spaceIdParam } = useParams();
	const { search } = useLocation();

	const { spaceId, invite } = React.useMemo(() => {
		let tmpSpaceId = spaceIdParam;
		if (tmpSpaceId && !tmpSpaceId?.startsWith('s/')) {
			tmpSpaceId = 's/' + tmpSpaceId;
		}
		try {
			if (tmpSpaceId) {
				tmpSpaceId = decodeURIComponent(tmpSpaceId);
			}
		} catch (error) {
			GetLogger('SpaceJoin').alert('Error decoding space invite component:', error);
			tmpSpaceId = undefined;
		}
		const spaceResult = SpaceIdSchema.safeParse(tmpSpaceId);
		const inviteResult = SpaceInviteIdSchema.safeParse(new URLSearchParams(search).get('invite'));

		return {
			spaceId: spaceResult.success ? spaceResult.data : undefined,
			invite: inviteResult.success ? inviteResult.data : undefined,
		};
	}, [spaceIdParam, search]);

	if (!spaceId) {
		return (
			<DivContainer align='center' justify='center'>
				<div className='error-box'>Invalid space ID</div>
			</DivContainer>
		);
	}

	return (
		<DivContainer align='center' justify='center'>
			<QuerySpaceInfo spaceId={ spaceId } invite={ invite } />
		</DivContainer>
	);
}

function QuerySpaceInfo({ spaceId, invite }: { spaceId: SpaceId; invite?: SpaceInviteId; }): ReactElement {
	const info = useSpaceExtendedInfo(spaceId, { invite });
	const navigate = useNavigatePandora();

	if (info === undefined) {
		return (
			<p>Loading...</p>
		);
	}

	if (info.result !== 'success') {
		return <div className='error-box'>{ INVALID_INVITE_MESSAGES[info.result] }</div>;
	}
	return (
		<div className='spaceJoin'>
			<SpaceDetails info={ info.data } hasFullInfo invite={ info.invite } hide={ () => navigate('/room') } closeText='Back to room' />
		</div>
	);
}
