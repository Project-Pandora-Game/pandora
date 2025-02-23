import classNames from 'classnames';
import { noop } from 'lodash';
import {
	AssertNever,
	AssertNotNullable,
	EMPTY,
	GetLogger,
	ResolveBackground,
	SpaceExtendedInfoResponse,
	SpaceId,
	SpaceInvite,
	SpaceInviteId,
	SpaceListExtendedInfo,
	SpaceListInfo,
	type SpacePublicSetting,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { GetAssetsSourceUrl, useAssetManager } from '../../../assets/assetManager';
import closedDoorLocked from '../../../assets/icons/closed-door-locked.svg';
import closedDoor from '../../../assets/icons/closed-door.svg';
import forbiddenIcon from '../../../assets/icons/forbidden.svg';
import friendsIcon from '../../../assets/icons/friends.svg';
import lockIcon from '../../../assets/icons/lock.svg';
import publicDoor from '../../../assets/icons/public-door.svg';
import shieldSlashedIcon from '../../../assets/icons/shield-slashed.svg';
import shieldIcon from '../../../assets/icons/shield.svg';
import { useAsyncEvent } from '../../../common/useEvent';
import { useAccountContacts } from '../../../components/accountContacts/accountContactContext';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { ModalDialog, useConfirmDialog } from '../../../components/dialog/dialog';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider';
import { useCharacterRestrictionsManager, useGameStateOptional, useSpaceInfo, useSpaceInfoOptional } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayer, usePlayerState } from '../../../components/gameContext/playerContextProvider';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';
import { useObservable } from '../../../observable';
import { PersistentToast, TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks';
import { useIsNarrowScreen } from '../../../styles/mediaQueries';
import { DESCRIPTION_TEXTBOX_SIZE, SPACE_FEATURES, SpaceOwnershipRemoval } from '../spaceConfiguration/spaceConfiguration';
import './spacesSearch.scss';

const TIPS: readonly string[] = [
	`You can move your character inside a room by dragging the character name below her.`,
	`Careful! Your spaces are set to private as default when you first create them.`,
	`Press "arrow up" or right-click on a chat message to edit or delete it in the chat.`,
	`Your character can turn around for everyone in a room using the "Pose" tab or with "/turn".`,
	`Chat commands start with a "/" and typing just this one character shows a help menu.`,
	`You can use your browser's "back" and "forward" buttons to navigate between screens.`,
	`In the Pandora settings, character (chat) and account (direct messages) name colors are set separately.`,
	`Every single change in the wardrobe happens instantly and is immediately visible to everyone in the room.`,
	`The character context menu can still be opened from a room item's menu while a character is inside.`,
	`You can start typing a chat message at any time, even without clicking into the text input field first.`,
	`Setting the render resolution in the graphics settings to 0% lets you use the chat without graphics.`,
	`Cannot move a character because the name is covered? Enter move mode in the room tab's character menu.`,
];

export function SpacesSearch(): ReactElement {
	const navigate = useNavigate();
	const spaceInfo = useSpaceInfo();
	const list = useSpacesList();

	const directoryStatus = useObservable(useDirectoryConnector().directoryStatus);

	const [showTips, setShowTips] = useState(false);

	const [index, setIndex] = useReducer((oldState: number) => {
		return (oldState + 1) % TIPS.length;
	}, Math.floor(Math.random() * TIPS.length));

	useEffect(() => {
		const interval = setInterval(() => {
			setIndex();
		}, 8000);

		return () => {
			clearInterval(interval);
		};
	}, []);

	// Spaces search is only accessible when inside player's personal space
	if (spaceInfo.id != null) {
		return <Navigate to='/room' />;
	}

	return (
		<Column padding='medium'>
			<Row padding='medium' wrap alignX='space-between'>
				<Button
					onClick={ () => {
						navigate('/');
					} }
				>
					◄ Back
				</Button>
				<button className='infoBox' onClick={ () => setShowTips(true) } >
					<span className='icon'>🛈</span> Tip: { TIPS[index] }
				</button>
			</Row>
			<Row wrap alignX='space-between'>
				<h2>Spaces search</h2>
				<Row padding='medium' alignY='center'>
					Accounts online: { directoryStatus.onlineAccounts } / Characters online: { directoryStatus.onlineCharacters }
				</Row>
			</Row>
			{ !list ? <div className='loading'>Loading...</div> : <SpaceSearchList list={ list } /> }
			{ showTips && <TipsListDialog
				hide={ () => setShowTips(false) }
			/> }
		</Column>
	);
}

function TipsListDialog({ hide }: {
	hide: () => void;
}): ReactElement | null {

	return (
		<ModalDialog>
			<div className='policyDetails'>
				<h2>🛈 Full list of Pandora tips:</h2>
				<ul>
					{ TIPS.map((tip, index) => <li key={ index }>{ tip }</li>) }
				</ul>
			</div>
			<Row padding='medium' alignX='center'>
				<Button onClick={ hide }>Close</Button>
			</Row>
		</ModalDialog>
	);
}

function SpaceSearchList({ list }: {
	list: SpaceListInfo[];
}): ReactElement {
	const isNarrowScreen = useIsNarrowScreen();
	const navigate = useNavigate();
	const account = useCurrentAccount();
	AssertNotNullable(account);

	const ownSpaces = list.filter((s) => s.isOwner);
	const otherSpaces = useMemo((): readonly SpaceListInfo[] => {
		return list
			.filter((s) => !s.isOwner)
			.sort((a, b) => {
				// Sort spaces with someone online before those where people are offline
				if ((a.onlineCharacters > 0) !== (b.onlineCharacters > 0)) {
					return (a.onlineCharacters > 0) ? -1 : 1;
				}

				// Sort remaining spaces by name
				return a.name.localeCompare(b.name);
			});
	}, [list]);

	return (
		<>
			<div>
				<h3>
					My spaces ({ ownSpaces.length }/{ account.spaceOwnershipLimit })
					<ContextHelpButton>
						<p>
							Spaces are a place where you can meet other characters.
						</p>
						<p>
							In Pandora, each space is persistent and has one or more owners.<br />
							It only gets deleted when it no longer has any owners.<br />
							A space is visible to everyone (except accounts banned from it),<br />
							if it is marked as public and there is at least one admin inside the space.<br />
							The default setting for newly created spaces is private visibility.<br />
							You can always see spaces you are either admin or owner of.
						</p>
						<p>
							Each <strong>account</strong> has a maximum number of spaces it can own.<br />
							You can own at most { account.spaceOwnershipLimit } spaces.<br />
							If you want to create another space beyond your space ownership limit,<br />
							you must select any of your owned spaces and either repurpose it or give up<br />
							ownership of that space (resulting in the space being deleted if it has no other owners).
						</p>
					</ContextHelpButton>
				</h3>
				<Column className={ classNames('spacesSearchList', isNarrowScreen ? 'narrowScreen' : null) }>
					{ ownSpaces.map((space) => <SpaceSearchEntry key={ space.id } baseInfo={ space } />) }
					{
						ownSpaces.length >= account.spaceOwnershipLimit ? null : (
							<button className='spacesSearchListEntry noDescription' onClick={ () => navigate('/spaces/create') } >
								<div className='icon'>➕</div>
								<div className='entry'>Create a new space</div>
							</button>
						)
					}
				</Column>
			</div>
			<hr />
			<div>
				<h3>Found spaces ({ otherSpaces.length })</h3>
				{
					otherSpaces.length === 0 ? (
						<p>No space matches your filter criteria</p>
					) : (
						<Column className={ classNames('spacesSearchList', isNarrowScreen ? 'narrowScreen' : null) }>
							{ otherSpaces.map((space) => <SpaceSearchEntry key={ space.id } baseInfo={ space } />) }
						</Column>
					)
				}
			</div>
		</>
	);
}

function SpaceSearchEntry({ baseInfo }: {
	baseInfo: SpaceListInfo;
}): ReactElement {

	const [show, setShow] = useState(false);

	const {
		name,
		onlineCharacters,
		totalCharacters,
		maxUsers,
		description,
		hasFriend,
	} = baseInfo;
	const isEmpty = onlineCharacters === 0;
	const isFull = totalCharacters >= maxUsers;

	const ICON_MAP: Record<SpacePublicSetting, string> = {
		'locked': closedDoorLocked,
		'private': closedDoor,
		'public-with-admin': publicDoor,
		'public-with-anyone': publicDoor,
	};
	const ICON_TITLE_MAP: Record<SpacePublicSetting, string> = {
		'locked': 'Locked private space',
		'private': 'Private space',
		'public-with-admin': 'Public space',
		'public-with-anyone': 'Public space',
	};

	return (
		<>
			<button
				className={ classNames(
					'spacesSearchListEntry',
					isEmpty ? 'empty' : null,
					isFull ? 'full' : null,
					show ? 'selected' : null,
				) }
				onClick={ () => setShow(true) }
			>
				<div className='icon'>
					<img
						src={ ICON_MAP[baseInfo.public] }
						title={ ICON_TITLE_MAP[baseInfo.public] }
						alt={ ICON_TITLE_MAP[baseInfo.public] } />
				</div>
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
					<span className='name'>{ name }</span>
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
			{ show && <SpaceDetailsDialog
				baseInfo={ baseInfo }
				hide={ () => setShow(false) }
			/> }
		</>
	);
}

function SpaceDetailsDialog({ baseInfo, hide }: {
	baseInfo: SpaceListInfo;
	hide: () => void;
}): ReactElement | null {
	const accountId = useCurrentAccount()?.id;
	const extendedInfo = useSpaceExtendedInfo(baseInfo.id);

	const info = useMemo<SpaceListExtendedInfo>(() => {
		if (extendedInfo?.result === 'success')
			return extendedInfo.data;

		return {
			...baseInfo,
			features: [],
			admin: [],
			background: '',
			isAdmin: false,
			isAllowed: false,
			owners: [],
			characters: [],
		};
	}, [extendedInfo, baseInfo]);

	// Close if the space disappears
	useEffect(() => {
		if (extendedInfo?.result === 'notFound') {
			hide();
		}
	}, [extendedInfo, hide]);

	// Do not show anything if the space doesn't exist anymore
	// Do not show anything if we don't have account (aka WTF?)
	if (extendedInfo?.result === 'notFound' || accountId == null)
		return null;

	return (
		<ModalDialog>
			<SpaceDetails info={ info } hasFullInfo={ extendedInfo?.result === 'success' } hide={ hide } />
		</ModalDialog>
	);
}

export function SpaceDetails({ info, hasFullInfo, hide, invite, redirectBeforeLeave, closeText = 'Close' }: {
	info: SpaceListExtendedInfo;
	hasFullInfo: boolean;
	hide?: () => void;
	invite?: SpaceInvite;
	redirectBeforeLeave?: boolean;
	closeText?: string;
}): ReactElement {
	const assetManager = useAssetManager();
	const directoryConnector = useDirectoryConnector();
	const confirm = useConfirmDialog();
	const contacts = useAccountContacts('friend');
	const blockedAccounts = useAccountContacts('blocked');

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
					hide?.();
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

	const background = info.background ? ResolveBackground(assetManager, info.background, GetAssetsSourceUrl()).image : '';

	const userIsOwner = !!info.isOwner;
	const hasOnlineAdmin = info.characters.some((c) => c.isAdmin && c.isOnline);
	const isPublic = info.public === 'public-with-admin' || info.public === 'public-with-anyone';

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
				Owned by: { info.owners.join(', ') }
			</Row>
			{
				(background !== '' && !background.startsWith('#')) ? (
					<img className='preview' src={ background } />
				) : null
			}
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
			<textarea className='widebox' value={ info.description } rows={ DESCRIPTION_TEXTBOX_SIZE } readOnly />
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
				{ userIsOwner && <SpaceOwnershipRemoval buttonClassName='slim' id={ info.id } name={ info.name } /> }
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
	const navigate = useNavigate();
	const directoryConnector = useDirectoryConnector();
	const { player, globalState } = usePlayerState();
	const roomDeviceLink = useCharacterRestrictionsManager(globalState, player, (manager) => manager.getRoomDeviceLink());
	const canLeave = useCharacterRestrictionsManager(globalState, player, (manager) => (manager.forceAllowRoomLeave() || !manager.getEffects().blockRoomLeave));

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
				navigate(`/space/join/${spaceId.split('/')[1]}${inviteId ? `?invite=${inviteId}` : ''}`);
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

const SpaceJoinProgress = new PersistentToast();

function useSpacesList(): SpaceListInfo[] | undefined {
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
