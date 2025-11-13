import classNames from 'classnames';
import {
	AssertNever,
	EMPTY,
	GetLogger,
	SpaceId,
	SpaceInvite,
	SpaceInviteId,
	SpaceListExtendedInfo,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useMemo } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'react-toastify';
import forbiddenIcon from '../../../assets/icons/forbidden.svg';
import friendsIcon from '../../../assets/icons/friends.svg';
import lockIcon from '../../../assets/icons/lock.svg';
import shieldSlashedIcon from '../../../assets/icons/shield-slashed.svg';
import shieldIcon from '../../../assets/icons/shield.svg';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { useAccountContacts } from '../../../components/accountContacts/accountContactContext.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { useConfirmDialog } from '../../../components/dialog/dialog.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { useCharacterRestrictionsManager, useGameStateOptional, useSpaceInfoOptional } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayer, usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { PersistentToast, TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { SPACE_DESCRIPTION_TEXTBOX_SIZE, SPACE_FEATURES } from '../spaceConfiguration/spaceConfigurationDefinitions.tsx';
import { SpaceOwnershipRemoval } from '../spaceConfiguration/spaceOwnershipRemoval.tsx';
import { SpaceRoleDropButton } from '../spaceConfiguration/spaceRoleDrop.tsx';
import './spacesSearch.scss';

const SpaceJoinProgress = new PersistentToast();

export function SpaceDetails({ info, hasFullInfo, hide, invite, redirectBeforeLeave, closeText = 'Close' }: {
	info: SpaceListExtendedInfo;
	hasFullInfo: boolean;
	hide?: () => void;
	invite?: SpaceInvite;
	redirectBeforeLeave?: boolean;
	closeText?: string;
}): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const confirm = useConfirmDialog();
	const contacts = useAccountContacts('friend');
	const blockedAccounts = useAccountContacts('blocked');
	const navigate = useNavigatePandora();

	const [join, processing] = useAsyncEvent(
		async (e: React.MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();

			if (info.public === 'locked') {
				if (!await confirm(
					'This space is locked',
					(
						<>
							This space appears to be locked from the inside. <br />
							This is usually done when people inside do not want to be disturbed.<br />
							Are you sure you want to use your key and enter anyway?
						</>
					),
				)) {
					return null;
				}
			}

			SpaceJoinProgress.show('progress', 'Joining space...');
			// Hide at this point and navigate to room view to let user see the load progress
			hide?.();
			navigate('/room');
			return directoryConnector.awaitResponse('spaceEnter', { id: info.id, invite: invite?.id });
		},
		(resp) => {
			if (resp == null)
				return;

			switch (resp.result) {
				case 'ok':
					SpaceJoinProgress.show('success', 'Space joined!');
					break;
				case 'notFound':
					SpaceJoinProgress.show('error', 'Space not found');
					break;
				case 'spaceFull':
					SpaceJoinProgress.show('error', 'Space is full');
					break;
				case 'invalidInvite':
					SpaceJoinProgress.show('error', 'Invalid invite');
					break;
				case 'noAccess':
					SpaceJoinProgress.show('error', 'No access');
					break;
				case 'failed':
					SpaceJoinProgress.show('error', 'Failed to join space');
					break;
				default:
					AssertNever(resp.result);
			}
		},
		{
			updateAfterUnmount: true,
			errorHandler: (error) => {
				GetLogger('JoinSpace').warning('Error during space join', error);
				SpaceJoinProgress.show('error',
					`Error during space join:\n${error instanceof Error ? error.message : String(error)}`);
			},
		},
	);

	const userIsOwner = !!info.isOwner;
	const hasOnlineAdmin = info.characters.some((c) => c.isAdmin && c.isOnline);
	const isPublic = info.public === 'public-with-admin' || info.public === 'public-with-anyone';
	const playerAccount = useCurrentAccount();

	const namedOwners = info.owners.map((i) => {
		const contact = contacts.find((s) => s.id === i);
		return (i === playerAccount?.id) ? `${ playerAccount.displayName } (${ i }) [You]` :
			(contact != null) ? `${ contact.displayName } (${ i })` :
			i.toString();
	});

	const featureIcons = useMemo((): [icon: string, name: string, extraClassNames?: string][] => {
		const result = SPACE_FEATURES
			.filter((f) => info.features.includes(f.id))
			.map((f): [icon: string, name: string, extraClassNames?: string] => ([f.icon, f.name]));

		if (info.isAdmin) {
			result.push([shieldIcon, 'You are an admin of this space']);
		}

		if (!hasOnlineAdmin && hasFullInfo) {
			result.push([shieldSlashedIcon, 'No admin is currently hosting this space', 'warning']);
		}

		if (info.public === 'locked') {
			result.push([lockIcon, 'This space is locked', 'warning']);
		}

		return result;
	}, [hasFullInfo, hasOnlineAdmin, info]);

	return (
		<div className='spacesSearchSpaceDetails'>
			<div>
				Details for { isPublic ? 'public' : 'private' } space <b className='spaceName'>{ info.name }</b><br />
			</div>
			<Row className='ownership' alignY='center'>
				Owned by: { namedOwners.join(', ') }
			</Row>
			<Row className='features' wrap>
				{
					featureIcons.map(([icon, name, extraClassNames], i) => (
						<div key={ i } className={ classNames('features-img', extraClassNames) } title={ name }>
							<img src={ icon } alt={ name } />
						</div>
					))
				}
			</Row>
			<div className='description-title'>Description:</div>
			<textarea className='widebox' value={ info.description } rows={ SPACE_DESCRIPTION_TEXTBOX_SIZE } readOnly />
			{
				info.characters.length > 0 && (
					<div className='title'>Characters currently in this space:
						<div className='users-list'>
							{
								info.characters
									.slice()
									.sort((a, b) => {
										// Sort offline characters last
										if (a.isOnline !== b.isOnline) {
											return a.isOnline ? -1 : 1;
										}

										// Keep original order otherwise
										return 0;
									})
									.map((char) => (
										<div key={ char.id } className={ char.isOnline ? '' : 'offline' }>
											<span>
												{ char.isOnline ? '' : '( ' }
												{ char.name } ({ char.id })
												{ char.isOnline ? '' : ' )' }
											</span>
											{
												contacts.some((a) => a.id === char.accountId) ? (
													<img
														src={ friendsIcon }
														title='This character is on your contacts list'
														alt='This character is on your contacts list'
													/>
												) : null
											}
											{
												blockedAccounts.some((a) => a.id === char.accountId) ? (
													<img
														src={ forbiddenIcon }
														title='This character is from an account you blocked'
														alt='This character is from an account you blocked'
													/>
												) : null
											}
											{
												char.isAdmin ? (
													<img
														src={ shieldIcon }
														title='This character is an admin of this space'
														alt='This character is an admin of this space'
													/>
												) : null
											}
										</div>
									))
							}
						</div>
					</div>
				)
			}
			<Row padding='medium' className='buttons' alignX='space-between' alignY='center' wrap>
				{
					hide && (
						<Button onClick={ (e) => {
							e.stopPropagation();
							hide();
						} }>
							{ closeText }
						</Button>
					)
				}
				{ userIsOwner ? (
					<SpaceOwnershipRemoval buttonClassName='slim' id={ info.id } name={ info.name } />
				) : info.isAdmin ? (
					<SpaceRoleDropButton buttonClassName='slim' id={ info.id } name={ info.name } role='admin' />
				) : info.isAllowed ? (
					<SpaceRoleDropButton buttonClassName='slim' id={ info.id } name={ info.name } role='allowlisted' />
				) : null }
				<GuardedJoinButton spaceId={ info.id } inviteId={ invite?.id } redirectBeforeLeave={ redirectBeforeLeave }>
					<Button
						disabled={ processing }
						onClick={ join }>
						Enter Space
					</Button>
				</GuardedJoinButton>
			</Row>
		</div>
	);
}

function GuardedJoinButton({ children, spaceId, inviteId, redirectBeforeLeave }: { children: ReactNode; spaceId: SpaceId; inviteId?: SpaceInviteId; redirectBeforeLeave?: boolean; }): ReactElement {
	const space = useSpaceInfoOptional();

	const player = usePlayer();
	const gameState = useGameStateOptional();

	if (!player || !gameState) {
		return (
			<Button disabled>
				No character selected
			</Button>
		);
	}

	if (space?.id === null) {
		return <>{ children }</>;
	}

	if (space?.id === spaceId) {
		return (
			<Button disabled>
				You are already inside this space
			</Button>
		);
	}

	return <GuardedJoinButtonWithLeave spaceId={ spaceId } inviteId={ inviteId } redirectBeforeLeave={ redirectBeforeLeave } />;
}

// TODO: remove some of this when we automate leave process was added
function GuardedJoinButtonWithLeave({ spaceId, inviteId, redirectBeforeLeave }: { spaceId: SpaceId; inviteId?: SpaceInviteId; redirectBeforeLeave?: boolean; }) {
	const { pathname } = useLocation();
	const navigate = useNavigatePandora();
	const directoryConnector = useDirectoryConnector();
	const { player, globalState } = usePlayerState();
	const roomDeviceLink = useCharacterRestrictionsManager(globalState, player, (manager) => manager.getRoomDeviceLink());
	const canLeave = useCharacterRestrictionsManager(globalState, player, (manager) => (manager.forceAllowRoomLeave() || !manager.getEffects().blockSpaceLeave));

	const [leave, processing] = useAsyncEvent(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();
			return directoryConnector.awaitResponse('spaceLeave', EMPTY);
		},
		(resp) => {
			if (resp.result !== 'ok') {
				toast(`Failed to leave space:\n${resp.result}`, TOAST_OPTIONS_ERROR);
			}
		},
		{
			errorHandler: (error) => {
				GetLogger('LeaveSpace').warning('Error while leaving space', error);
				toast(`Error while leaving space:\n${error instanceof Error ? error.message : String(error)}`, TOAST_OPTIONS_ERROR);
			},
		},
	);

	if (roomDeviceLink) {
		return (
			<Button disabled>
				You must exit the room device before leaving the space
			</Button>
		);
	}

	if (!canLeave) {
		return (
			<Button disabled>
				An item is preventing you from leaving the space
			</Button>
		);
	}

	if (redirectBeforeLeave && !pathname.startsWith('/space/join')) {
		return (
			<Button onClick={ () => {
				navigate(`/space/join/${encodeURIComponent(spaceId)}${inviteId ? `?invite=${encodeURIComponent(inviteId)}` : ''}`);
			} }>
				Go To Invite URL
			</Button>
		);
	}

	return (
		<Button onClick={ leave } disabled={ processing || !canLeave || roomDeviceLink != null }>
			Leave current space
		</Button>
	);

}
