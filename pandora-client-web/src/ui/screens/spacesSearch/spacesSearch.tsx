import { noop } from 'lodash';
import {
	EMPTY,
	GetLogger,
	SpaceListInfo,
	SpaceExtendedInfoResponse,
	IClientDirectoryNormalResult,
	SpaceId,
	AssertNotNullable,
	SpaceInviteId,
	SpaceListExtendedInfo,
	SpaceInvite,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PersistentToast } from '../../../persistentToast';
import { Button } from '../../../components/common/button/button';
import { useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider';
import { useCurrentAccount, useDirectoryChangeListener, useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider';
import { ModalDialog } from '../../../components/dialog/dialog';
import { ResolveBackground } from 'pandora-common';
import { GetAssetsSourceUrl, useAssetManager } from '../../../assets/assetManager';
import { SpaceOwnershipRemoval, SPACE_FEATURES } from '../spaceConfiguration/spaceConfiguration';
import { Row } from '../../../components/common/container/container';
import './spacesSearch.scss';
import closedDoor from '../../../icons/closed-door.svg';
import privateDoor from '../../../icons/private-door.svg';
import publicDoor from '../../../icons/public-door.svg';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { useObservable } from '../../../observable';
import { useAsyncEvent } from '../../../common/useEvent';

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

	const { name, onlineCharacters, totalCharacters, maxUsers, description, hasPassword } = baseInfo;

	return (
		<>
			<a className='spacesSearchGrid' onClick={ () => setShow(true) } >
				<div className='icon'>
					<img
						src={ hasPassword ? closedDoor : baseInfo.public ? publicDoor : privateDoor }
						title={ hasPassword ? 'Protected space' : baseInfo.public ? 'Public space' : 'Private space' }
						alt={ hasPassword ? 'Protected space' : baseInfo.public ? 'Public space' : 'Private space' } />
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

export function SpaceDetails({ info, hide, invite }: { info: SpaceListExtendedInfo; hide?: () => void; invite?: SpaceInvite; }): ReactElement {
	const assetManager = useAssetManager();
	const [password, setPassword] = useState('');
	const directoryConnector = useDirectoryConnector();

	const [join, processing] = useAsyncEvent(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			e.stopPropagation();
			SpaceJoinProgress.show('progress', 'Joining space...');
			return directoryConnector.awaitResponse('spaceEnter', { id: info.id, password, invite: invite?.id });
		},
		(resp) => {
			if (resp.result === 'ok') {
				SpaceJoinProgress.show('success', 'Space joined!');
			} else {
				SpaceJoinProgress.show('error', `Failed to join space:\n${resp.result}`);
			}
			if (resp.result === 'notFound') {
				hide?.();
			}
		},
		{
			errorHandler: (error) => {
				GetLogger('JoinSpace').warning('Error during space join', error);
				SpaceJoinProgress.show('error',
					`Error during space join:\n${error instanceof Error ? error.message : String(error)}`);
			},
		},
	);

	const background = info.background ? ResolveBackground(assetManager, info.background, GetAssetsSourceUrl()).image : '';
	const hasPassword = info.hasPassword;

	const userIsOwner = !!info.isOwner;
	const userIsAdmin = !!info.isAdmin;

	const requirePassword = !userIsAdmin && !userIsOwner && hasPassword && !invite?.bypassPassword;

	return (
		<div className='spacesSearchSpaceDetails'>
			<div>
				Details for { info?.public ? 'public' : 'private' } space <b>{ info.name }</b><br />
			</div>
			<Row className='ownership' alignY='center'>
				Owned by: { info.owners.join(', ') }
			</Row>
			{ (background !== '' && !background.startsWith('#')) &&
				<img className='preview' src={ background } width='200px' height='100px' /> }
			<Row className='features'>
				{ hasPassword && <img className='features-img' src={ closedDoor } title='Protected Space' /> }
				{
					SPACE_FEATURES
						.filter((f) => info.features.includes(f.id))
						.map((f) => (
							<img key={ f.id } className='features-img' src={ f.icon } title={ f.name } alt={ f.name } />
						))
				}
			</Row>
			<div className='description-title'>Description:</div>
			<textarea className='widebox' value={ info.description } rows={ 16 } readOnly />
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
			{
				requirePassword && (
					<>
						<div className='title'>This spaces requires a password to enter:</div>
						<input className='widebox'
							type='password'
							value={ password }
							onChange={ (e) => setPassword(e.target.value) }
						/>
					</>
				)
			}
			<Row padding='medium' className='buttons' alignX='space-between' alignY='center'>
				{
					hide && (
						<Button onClick={ (e) => {
							e.stopPropagation();
							hide();
						} }>
							Close
						</Button>
					)
				}
				{ userIsOwner && <SpaceOwnershipRemoval buttonClassName='slim' id={ info.id } name={ info.name } /> }
				<Button className='fadeDisabled'
					disabled={ processing || (!userIsAdmin && requirePassword && !password) }
					onClick={ join }>
					Enter Space
				</Button>
			</Row>
		</div>
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
