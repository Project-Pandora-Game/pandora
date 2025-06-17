import { SpaceId, SpaceInviteIdSchema, type SpaceExtendedInfoResponse } from 'pandora-common';
import React, { ReactElement } from 'react';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { SpaceDetails } from '../spacesSearch/spaceDetails.tsx';
import { useSpaceExtendedInfo } from '../spacesSearch/useSpaceExtendedInfo.tsx';
import './inviteEmbed.scss';

export const INVALID_INVITE_MESSAGES: Record<Exclude<SpaceExtendedInfoResponse['result'], 'success'>, string> = {
	notFound: 'Unknown space',
	noAccess: `Invite expired or you don't have access to this space`,
	noCharacter: 'You need to have a character selected to view invite details',
};

export function SpaceInviteEmbed({ spaceId, invite }: { spaceId: SpaceId; invite?: string; }): ReactElement {
	const inviteResult = SpaceInviteIdSchema.safeParse(invite);
	const [open, setOpen] = React.useState(false);
	const info = useSpaceExtendedInfo(spaceId, inviteResult.success ? inviteResult.data : undefined);

	if (info == null) {
		return (
			<div className='spaceInvite'>Loading Invitation info...</div>
		);
	}

	if (info.result !== 'success') {
		return (
			<div className='spaceInvite'>Invalid Invitation: { INVALID_INVITE_MESSAGES[info.result] }.</div>
		);
	}

	return (
		<button className='spaceInvite active' onClick={ () => setOpen((s) => !s) }>
			<span>Space Invitation to: { info.data.name }</span>
			{
				!open ? null : (
					<ModalDialog>
						<SpaceDetails info={ info.data } hasFullInfo invite={ info.invite } hide={ () => setOpen(false) } redirectBeforeLeave />
					</ModalDialog>
				)
			}
		</button>
	);
}
