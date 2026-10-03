import classNames from 'classnames';
import { AssertNever, SpaceIdSchema, SpaceInviteIdSchema, type CharacterId, type SpaceId, type SpaceInviteId } from 'pandora-common';
import type { SpaceExtendedInfoResponse } from 'pandora-common/networking/api/directory_client';
import React, { ReactElement } from 'react';
import friendsIcon from '../../../assets/icons/friends.svg';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { SpaceDetails } from '../spacesSearch/spaceDetails.tsx';
import { SPACE_SEARCH_PUBLIC_ICONS, SPACE_SEARCH_PUBLIC_LABELS } from '../spacesSearch/spacesSearch.tsx';
import { useSpaceExtendedInfo } from '../spacesSearch/useSpaceExtendedInfo.tsx';
import './inviteEmbed.scss';

const SPACE_INVITE_URL_PATH_PREFIX = '/space/join/';
const SPACE_INVITE_URL_REGEX = /https?:\/\/(?:www\.)?project-pandora\.com\S*/gi;

export interface ParsedSpaceInvite {
	spaceId: SpaceId;
	invite?: SpaceInviteId;
}

/**
 * Attempts to parse a single URL as a space invite link.
 * Mirrors the logic used by `RenderedLink` for rendering invite embeds.
 */
export function TryParseSpaceInviteUrl(url: URL): ParsedSpaceInvite | null {
	const { hostname, pathname, searchParams } = url;

	switch (hostname) {
		case 'project-pandora.com':
		case 'www.project-pandora.com':
			if (pathname.startsWith(SPACE_INVITE_URL_PATH_PREFIX)) {
				const invite = searchParams.get('invite') ?? undefined;
				let spaceId: string | undefined;
				try {
					spaceId = decodeURIComponent(pathname.slice(SPACE_INVITE_URL_PATH_PREFIX.length));
				} catch (_error) {
					spaceId = undefined;
				}
				if (spaceId && !spaceId.startsWith('s/')) {
					spaceId = 's/' + spaceId;
				}
				const parsedSpaceId = SpaceIdSchema.safeParse(spaceId);
				const parsedInvite = SpaceInviteIdSchema.optional().safeParse(invite);

				if (parsedSpaceId.success && parsedInvite.success) {
					return { spaceId: parsedSpaceId.data, invite: parsedInvite.data };
				}
			}
			return null;
		default:
			return null;
	}
}

/**
 * Scans free text for `project-pandora.com` URLs and returns the first one
 * that resolves to a valid space invite, or `null` if there is none.
 */
export function FindFirstSpaceInvite(text: string): ParsedSpaceInvite | null {
	const fullText = text;

	for (const match of fullText.matchAll(SPACE_INVITE_URL_REGEX)) {
		let url: URL;
		try {
			url = new URL(match[0]);
		} catch (_error) {
			continue;
		}
		const parsed = TryParseSpaceInviteUrl(url);
		if (parsed != null)
			return parsed;
	}
	return null;
}

export const INVALID_INVITE_MESSAGES: Record<Exclude<SpaceExtendedInfoResponse['result'], 'success'>, string> = {
	notFound: 'Unknown space',
	noAccess: `Invite expired or you don't have access to this space`,
	noCharacter: 'You need to have a character selected to view invite details',
};

export function SpaceInviteEmbed({ spaceId, invite, invitedBy, viewOnly = false }: {
	spaceId: SpaceId;
	invite?: SpaceInviteId;
	invitedBy?: CharacterId;
	/** If set, the dialog will not offer any options regarded to switching - only display details */
	viewOnly?: boolean;
}): ReactElement {
	const [open, setOpen] = React.useState(false);
	const info = useSpaceExtendedInfo(spaceId, { invite, invitedBy });

	if (info == null) {
		return (
			<div className='SpaceInviteEmbedText'>Loading Invitation info...</div>
		);
	}

	if (info.result !== 'success') {
		return (
			<div className='SpaceInviteEmbedText error'>Invalid Invitation: { INVALID_INVITE_MESSAGES[info.result] }.</div>
		);
	} else if (info.invite?.id !== invite) {
		return (
			<div className='SpaceInviteEmbedText error'>Invalid Invitation: Invite expired.</div>
		);
	}

	const {
		name,
		onlineCharacters,
		totalCharacters,
		maxUsers,
		description,
		hasFriend,
	} = info.data;
	const isEmpty = onlineCharacters === 0;
	const isFull = totalCharacters >= maxUsers;

	return (
		<>
			<button
				className={ classNames(
					'SpaceInviteEmbed',
					isEmpty ? 'empty' : null,
					isFull ? info.data.isOwner ? 'fullCanJoin' : 'full' : null,
					open ? 'selected' : null,
				) }
				onClick={ () => setOpen(true) }
			>
				<img
					className='icon'
					src={ SPACE_SEARCH_PUBLIC_ICONS[info.data.public] }
					title={ SPACE_SEARCH_PUBLIC_LABELS[info.data.public] }
					alt={ SPACE_SEARCH_PUBLIC_LABELS[info.data.public] }
				/>
				<div className='icons-extra'>
					{
						hasFriend === true ? (
							<img
								src={ friendsIcon }
								title='A contact of yours is in this space'
								alt='A contact of yours is in this space' />
						) : null
					}
				</div>
				<div className='entry'>
					<span className='name'>
						{ info.invite == null ? (
							null
						) : info.invite.type === 'joinMe' ? (
							'Join me in: '
						) : info.invite.type === 'spaceBound' ? (
							'Space invitation to: '
						) : AssertNever(info.invite.type) }
						{ name }
					</span>
					<span className='userCountWrapper'>
						(
						<span className='userCount'>
							{ `${onlineCharacters} ` }
							<span className='offlineCount'>(+{ totalCharacters - onlineCharacters })</span>
							{ ` / ${maxUsers}` }
						</span>
						)
					</span>
				</div>
				<div className='description-preview'>{ `${description}` }</div>
			</button>
			{ open ? (
				<ModalDialog>
					<SpaceDetails
						info={ info.data }
						hasFullInfo
						invite={ info.invite }
						hide={ () => setOpen(false) }
						viewOnly={ viewOnly }
					/>
				</ModalDialog>
			) : null }
		</>
	);
}
