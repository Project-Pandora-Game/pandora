import classNames from 'classnames';
import {
	AssertNever,
	GetLogger,
	SpaceInvite,
	SpaceListExtendedInfo,
	type CharacterId,
} from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
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
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { PersistentToast } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useAccountSettings, useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useCharacterRestrictionsManager, useGameStateOptional, useSpaceCharacters, useSpaceInfoOptional } from '../../../services/gameLogic/gameStateHooks.ts';
import { SPACE_DESCRIPTION_TEXTBOX_SIZE, SPACE_FEATURES } from '../spaceConfiguration/spaceConfigurationDefinitions.tsx';
import { SpaceOwnershipRemoval } from '../spaceConfiguration/spaceOwnershipRemoval.tsx';
import { SpaceRoleDropButton } from '../spaceConfiguration/spaceRoleDrop.tsx';
import './spacesSearch.scss';

const SpaceJoinProgress = new PersistentToast();

export function SpaceDetails({ info, hasFullInfo, hide, invite, closeText = 'Close', viewOnly = false }: {
	info: SpaceListExtendedInfo;
	hasFullInfo: boolean;
	hide: () => void;
	invite?: SpaceInvite;
	closeText?: string;
	/** If set, the dialog will not offer any options regarded to switching - only display details */
	viewOnly?: boolean;
}): ReactElement {
	const contacts = useAccountContacts('friend');
	const blockedAccounts = useAccountContacts('blocked');

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
			{ viewOnly ? (
				<Row padding='medium' className='buttons' alignX='center' alignY='center' wrap>
					<Button onClick={ (e) => {
						e.stopPropagation();
						hide();
					} }>
						{ closeText }
					</Button>
				</Row>
			) : (
				<Row padding='medium' className='buttons' alignX='space-between' alignY='center' wrap>
					<Button onClick={ (e) => {
						e.stopPropagation();
						hide();
					} }>
						{ closeText }
					</Button>
					{ userIsOwner ? (
						<SpaceOwnershipRemoval buttonClassName='slim' id={ info.id } name={ info.name } />
					) : info.isAdmin ? (
						<SpaceRoleDropButton buttonClassName='slim' id={ info.id } name={ info.name } role='admin' />
					) : info.isAllowed ? (
						<SpaceRoleDropButton buttonClassName='slim' id={ info.id } name={ info.name } role='allowlisted' />
					) : null }
					<GuardedJoinButton info={ info } hide={ hide } invite={ invite } />
				</Row>
			) }
		</div>
	);
}

function GuardedJoinButton({ info, hide, invite }: {
	info: SpaceListExtendedInfo;
	hide?: () => void;
	invite?: SpaceInvite;
}): ReactElement {
	const confirm = useConfirmDialog();
	const navigate = useNavigatePandora();
	const directoryConnector = useDirectoryConnector();

	const { alwaysUseSpaceSwitchFlow } = useAccountSettings();
	const currentSpace = useSpaceInfoOptional();
	const spaceCharacters = useSpaceCharacters();

	const { player, globalState } = usePlayerState();
	const roomDeviceLink = useCharacterRestrictionsManager(globalState, player, (manager) => manager.getRoomDeviceLink());
	const canLeave = useCharacterRestrictionsManager(globalState, player, (manager) => (manager.forceAllowRoomLeave() || !manager.getEffects().blockSpaceLeave));
	const followingCharacters = useMemo((): readonly CharacterId[] => {
		return Array.from(globalState.characters.values())
			.filter((c) => c.position.type === 'normal' && c.position.following?.target === player.id)
			.map((c) => c.id);
	}, [player, globalState]);
	const gameState = useGameStateOptional();

	const [join, processingJoin] = useAsyncEvent(
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
			return directoryConnector.awaitResponse('spaceSwitch', { id: info.id, invite: invite?.id });
		},
		(resp) => {
			if (resp == null)
				return;

			switch (resp.result) {
				case 'ok':
					SpaceJoinProgress.show('success', 'Space joined!');
					break;
				case 'failed':
					SpaceJoinProgress.show('error', 'Error joining the space, try again later');
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
				case 'inRoomDevice':
					SpaceJoinProgress.show('error', 'You must exit the room device before leaving the current space');
					break;
				case 'restricted':
					SpaceJoinProgress.show('error', 'An item is preventing you from leaving the current space');
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

	const [startSwitchProcess, processingSwitch] = useAsyncEvent(
		async (inviteCharacters: CharacterId[]) => {
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

			SpaceJoinProgress.show('progress', 'Requesting space switch...');
			// Hide at this point and navigate to room view to let user see the load progress
			hide?.();
			navigate('/room');
			return directoryConnector.awaitResponse('spaceSwitchStart', { id: info.id, characters: inviteCharacters });
		},
		(resp) => {
			if (resp == null)
				return;

			switch (resp.result) {
				case 'ok':
					SpaceJoinProgress.hide();
					break;
				case 'failed':
					SpaceJoinProgress.show('error', 'Error joining the space, try again later');
					break;
				case 'pendingSwitchExists':
					SpaceJoinProgress.show('error', 'You are already attempting to switch spaces. Cancel the pending switch first.');
					break;
				case 'notFound':
					SpaceJoinProgress.show('error', 'Space or one of invited characters were not found.');
					break;
				case 'noAccess':
					if (resp.problematicCharacter === player.id) {
						SpaceJoinProgress.show('error', 'You cannot join this space.');
					} else {
						const character = spaceCharacters.find((c) => c.id === resp.problematicCharacter);
						SpaceJoinProgress.show('error', `Cannot join this space, because ${ character?.data.name ?? '[UNKNOWN]' } (${resp.problematicCharacter}) cannot join this space.`);
					}
					break;
				case 'notAllowed': {
					const character = spaceCharacters.find((c) => c.id === resp.problematicCharacter);
					SpaceJoinProgress.show('error', `You are missing permission to invite ${ character?.data.name ?? '[UNKNOWN]' } (${resp.problematicCharacter}).`);
					break;
				}
				default:
					AssertNever(resp);
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

	const processing = processingJoin || processingSwitch;

	if (!player || !gameState) {
		return (
			<Button disabled>
				No character selected
			</Button>
		);
	}

	if (currentSpace?.id === null) {
		return (
			<Button
				disabled={ processing }
				onClick={ join }
			>
				Enter Space
			</Button>
		);
	}

	if (currentSpace?.id === info.id) {
		return (
			<Button disabled>
				You are already inside this space
			</Button>
		);
	}

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

	if (currentSpace?.id != null && (followingCharacters.length > 0 || alwaysUseSpaceSwitchFlow)) {
		return (
			<Button
				disabled={ processing }
				onClick={ (ev) => {
					ev.stopPropagation();
					startSwitchProcess(followingCharacters.slice());
				} }
			>
				Start space invitation
			</Button>
		);
	}

	return (
		<Button
			disabled={ processing }
			onClick={ join }
		>
			Enter Space
		</Button>
	);
}
