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
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { GetAssetsSourceUrl, useAssetManager } from '../../../assets/assetManager';
import { useAsyncEvent } from '../../../common/useEvent';
import { Button } from '../../../components/common/button/button';
import { Row } from '../../../components/common/container/container';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { ModalDialog } from '../../../components/dialog/dialog';
import { useCurrentAccount, useDirectoryChangeListener, useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider';
import { useCharacterRestrictionsManager, useGameStateOptional, useSpaceInfo, useSpaceInfoOptional } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayer, usePlayerState } from '../../../components/gameContext/playerContextProvider';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';
import { PersistentToast, TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { DESCRIPTION_TEXTBOX_SIZE, SPACE_FEATURES, SpaceOwnershipRemoval } from '../spaceConfiguration/spaceConfiguration';
import './spacesSearch.scss';
// import closedDoor from '../../../icons/closed-door.svg';
import shieldSlashedIcon from '../../../assets/icons/shield-slashed.svg';
import privateDoor from '../../../icons/private-door.svg';
import publicDoor from '../../../icons/public-door.svg';
import { useObservable } from '../../../observable';

const TIPS: readonly string[] = [
	`You can move your character inside a room by dragging the character name below her.`,
	`Careful! Your spaces are set to private as default when you first create them.`,
	`Press "arrow up" or right-click on a chat message to edit or delete it in the chat.`,
	`Your character can turn around for everyone in a room in the "Pose" tab or with "/turn".`,
	`Chat commands start with a "/" and typing just this one character shows a help menu.`,
	`You can use your browser's "back" and "forward" buttons to navigate between screens.`,
	`In the Pandora settings, character (chat) and account (direct messages) name colors are set separately.`,
	`Every single change in the wardrobe happens instantly and is immediately visible to everyone in the room.`,
	`Public spaces without an admin online inside are not publicly listed in the spaces search.`,
	`The character context menu can still be opened from a room item's menu while a character is inside.`,
	`You can start typing a chat message at any time, even without clicking into the text input field first.`,
];

export function SpacesSearch(): ReactElement {
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
		<div>
			<Row padding='medium' wrap alignX='space-between'>
				<Link to='/'>◄ Back</Link><br />
				<span className='infoBox' onClick={ () => setShowTips(true) } >
					🛈 Tip: { TIPS[index] }
				</span>
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
		</div>
	);
}

function TipsListDialog({ hide }: {
	hide: () => void;
}): ReactElement | null {

	return (
		<ModalDialog>
			<Scrollbar color='dark' className='policyDetails'>
				<h2>🛈 Full list of Pandora tips:</h2>
				<ul>
					{ TIPS.map((tip, index) => <li key={ index }>{ tip }</li>) }
				</ul>
			</Scrollbar>
			<Row padding='medium' alignX='center'>
				<Button onClick={ hide }>Close</Button>
			</Row>
		</ModalDialog>
	);
}

function SpaceSearchList({ list }: {
	list: SpaceListInfo[];
}): ReactElement {
	const navigate = useNavigate();
	const account = useCurrentAccount();
	AssertNotNullable(account);

	const ownSpaces = list.filter((r) => r.isOwner);
	const otherSpaces = list.filter((r) => !r.isOwner);

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
				{ ownSpaces.map((space) => <SpaceSearchEntry key={ space.id } baseInfo={ space } />) }
				{
					ownSpaces.length >= account.spaceOwnershipLimit ? null : (
						<a className='spacesSearchGrid' onClick={ () => navigate('/spaces/create') } >
							<div className='icon'>➕</div>
							<div className='entry'>Create a new space</div>
						</a>
					)
				}
			</div>
			<hr />
			<div>
				<h3>Found spaces ({ otherSpaces.length })</h3>
				{ otherSpaces.length === 0 ? <p>No space matches your filter criteria</p> : null }
				{ otherSpaces.map((space) => <SpaceSearchEntry key={ space.id } baseInfo={ space } />) }
			</div>
		</>
	);
}

function SpaceSearchEntry({ baseInfo }: {
	baseInfo: SpaceListInfo;
}): ReactElement {

	const [show, setShow] = useState(false);

	const { name, onlineCharacters, totalCharacters, maxUsers, description } = baseInfo;

	return (
		<>
			<a className='spacesSearchGrid' onClick={ () => setShow(true) } >
				<div className='icon'>
					<img
						src={ baseInfo.public !== 'private' ? publicDoor : privateDoor }
						title={ baseInfo.public !== 'private' ? 'Public space' : 'Private space' }
						alt={ baseInfo.public !== 'private' ? 'Public space' : 'Private space' } />
				</div>
				<div className='entry'>
					{ `${name} ( ${onlineCharacters} ` }
					<span className='offlineCount'>(+{ totalCharacters - onlineCharacters })</span>
					{ ` / ${maxUsers} )` }
				</div>
				<div className='description-preview'>{ `${description}` }</div>
			</a>
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
			<SpaceDetails info={ info } hide={ hide } />
		</ModalDialog>
	);
}

export function SpaceDetails({ info, hide, invite, redirectBeforeLeave, closeText = 'Close' }: { info: SpaceListExtendedInfo; hide?: () => void; invite?: SpaceInvite; redirectBeforeLeave?: boolean; closeText?: string; }): ReactElement {
	const assetManager = useAssetManager();
	const directoryConnector = useDirectoryConnector();

	const [join, processing] = useAsyncEvent(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();
			SpaceJoinProgress.show('progress', 'Joining space...');
			return directoryConnector.awaitResponse('spaceEnter', { id: info.id, invite: invite?.id });
		},
		(resp) => {
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

	return (
		<div className='spacesSearchSpaceDetails'>
			<div>
				Details for { (info.public !== 'private') ? 'public' : 'private' } space <b>{ info.name }</b><br />
			</div>
			<Row className='ownership' alignY='center'>
				Owned by: { info.owners.join(', ') }
			</Row>
			{ (background !== '' && !background.startsWith('#')) &&
				<img className='preview' src={ background } width='200px' height='100px' /> }
			<Row className='features'>
				{
					SPACE_FEATURES
						.filter((f) => info.features.includes(f.id))
						.map((f) => (
							<img key={ f.id } className='features-img' src={ f.icon } title={ f.name } alt={ f.name } />
						))
				}
				{
					hasOnlineAdmin ? null : (
						<img className='features-img' src={ shieldSlashedIcon } title='No admin is currently hosting this space' alt='No admin is currently hosting this space' />
					)
				}
			</Row>
			<div className='description-title'>Description:</div>
			<textarea className='widebox' value={ info.description } rows={ DESCRIPTION_TEXTBOX_SIZE } readOnly />
			{
				info.characters.length > 0 && (
					<div className='title'>Characters currently in this space:
						<div className='users-list'>
							{
								info.characters.map((char) => (
									<div key={ char.id } className={ char.isOnline ? '' : 'offline' }>
										{ char.isOnline ? '' : '( ' }
										{ char.name } ({ char.id })
										{ char.isOnline ? '' : ' )' }
									</div>
								))
							}
						</div>
					</div>
				)
			}
			<Row padding='medium' className='buttons' alignX='space-between' alignY='center'>
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
					<Button className='fadeDisabled'
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
			<Button className='fadeDisabled' disabled={ true }>
				No character selected
			</Button>
		);
	}

	if (space?.id === null) {
		return <>{ children }</>;
	}

	if (space?.id === spaceId) {
		return (
			<Button className='fadeDisabled' disabled={ true }>
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
	const { player, playerState } = usePlayerState();
	const roomDeviceLink = useCharacterRestrictionsManager(playerState, player, (manager) => manager.getRoomDeviceLink());
	const canLeave = useCharacterRestrictionsManager(playerState, player, (manager) => (manager.forceAllowRoomLeave() || !manager.getEffects().blockRoomLeave));

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
			<Button className='fadeDisabled' disabled={ true }>
				You must exit the room device before leaving the space
			</Button>
		);
	}

	if (!canLeave) {
		return (
			<Button className='fadeDisabled' disabled={ true }>
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
		<Button onClick={ leave } className='fadeDisabled' disabled={ processing || !canLeave || roomDeviceLink != null }>
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
