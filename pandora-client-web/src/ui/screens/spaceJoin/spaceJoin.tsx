import { SpaceId, SpaceIdSchema, SpaceInviteId, SpaceInviteIdSchema, type SpaceExtendedInfoResponse } from 'pandora-common';
import React, { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { DivContainer } from '../../../components/common/container/container.tsx';
import { ExternalLink, UntrustedLink } from '../../../components/common/link/externalLink.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { SpaceDetails, useSpaceExtendedInfo } from '../spacesSearch/spacesSearch.tsx';
import './spaceJoin.scss';

export function SpaceJoin(): ReactElement {
	const { pathname, search } = useLocation();
	const { spaceId, invite } = React.useMemo(() => {
		const spaceResult = SpaceIdSchema.safeParse(`s/${decodeURIComponent(pathname.split('/').pop() ?? '')}`);
		const inviteResult = SpaceInviteIdSchema.safeParse(new URLSearchParams(search).get('invite'));

		return {
			spaceId: spaceResult.success ? spaceResult.data : undefined,
			invite: inviteResult.success ? inviteResult.data : undefined,
		};
	}, [pathname, search]);

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
	const info = useSpaceExtendedInfo(spaceId, invite);
	const navigate = useNavigate();

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

const INVALID_INVITE_MESSAGES: Record<Exclude<SpaceExtendedInfoResponse['result'], 'success'>, string> = {
	notFound: 'Unknown space',
	noAccess: `Invite expired or you don't have access to this space`,
	noCharacter: 'You need to have a character selected to view invite details',
};

export function SpaceInviteEmbed({ spaceId, invite }: { spaceId: string; invite?: string; }): ReactElement {
	const inviteResult = SpaceInviteIdSchema.safeParse(invite);
	const [open, setOpen] = React.useState(false);
	const info = useSpaceExtendedInfo(`s/${spaceId}`, inviteResult.success ? inviteResult.data : undefined);

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

export function RenderedLink({ url, index }: { url: URL; index: number; }): ReactElement {
	switch (url.hostname) {
		case 'project-pandora.com':
		case 'www.project-pandora.com':
			if (url.pathname.startsWith('/space/join/')) {
				const invite = url.searchParams.get('invite') ?? undefined;
				const spaceId = url.pathname.split('/').pop();
				if (!spaceId)
					break;

				return (
					<>
						<ExternalLink href={ url.href }>
							{ url.href }
						</ExternalLink>
						<SpaceInviteEmbed key={ index } spaceId={ spaceId } invite={ invite } />
					</>
				);
			}
			break;
	}
	return (
		<UntrustedLink key={ index } href={ url.href }>
			{ url.href }
		</UntrustedLink>
	);
}
