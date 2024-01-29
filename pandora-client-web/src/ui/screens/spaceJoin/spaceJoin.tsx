import { SpaceId, SpaceIdSchema, SpaceInviteId, SpaceInviteIdSchema } from 'pandora-common';
import React, { ReactElement } from 'react';
import { useLocation } from 'react-router';
import { SpaceDetails, useSpaceExtendedInfo } from '../spacesSearch/spacesSearch';
import { ModalDialog } from '../../../components/dialog/dialog';

export function SpaceJoin(): ReactElement {
	const { pathname, search } = useLocation();
	const { spaceId, invite } = React.useMemo(() => {
		const spaceResult = SpaceIdSchema.safeParse(`r/${pathname.split('/').pop()}`);
		const inviteResult = SpaceInviteIdSchema.safeParse(new URLSearchParams(search).get('invite'));

		return {
			spaceId: spaceResult.success ? spaceResult.data : undefined,
			invite: inviteResult.success ? inviteResult.data : undefined,
		};
	}, [pathname, search]);

	if (!spaceId) {
		return (
			<div>
				<p>Invalid space ID</p>
			</div>
		);
	}

	return (
		<div>
			<QuerySpaceInfo spaceId={ spaceId } invite={ invite } />
		</div>
	);
}

function QuerySpaceInfo({ spaceId, invite }: { spaceId: SpaceId; invite?: SpaceInviteId; }): ReactElement {
	const info = useSpaceExtendedInfo(spaceId, invite);

	if (info?.result !== 'success') {
		return (
			<p>Space ({ spaceId }) not found</p>
		);
	}

	return (
		<SpaceDetails info={ info.data } invite={ info.invite } />
	);
}

export function SpaceInviteEmbed({ spaceId, invite }: { spaceId: string; invite?: string; }): ReactElement {
	const inviteResult = SpaceInviteIdSchema.safeParse(invite);
	const [open, setOpen] = React.useState(false);
	const info = useSpaceExtendedInfo(`r/${spaceId}`, inviteResult.success ? inviteResult.data : undefined);

	if (info?.result !== 'success') {
		return (
			<div className='spaceInvite'>Space ({ spaceId }) not found</div>
		);
	}

	return (
		<div className='spaceInvite active' onClick={ () => setOpen((s) => !s) }>
			<span>Space Invite to: { info.data.name }</span>
			{
				!open ? null : (
					<ModalDialog>
						<SpaceDetails info={ info.data } invite={ info.invite } hide={ () => setOpen(false) } />
					</ModalDialog>
				)
			}
		</div>
	);
}
