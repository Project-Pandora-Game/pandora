import classNames from 'classnames';
import { noop } from 'lodash-es';
import {
	AssertNotNullable,
	EMPTY,
	SpaceListInfo,
	type SpacePublicSetting,
} from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import closedDoorLocked from '../../../assets/icons/closed-door-locked.svg';
import closedDoor from '../../../assets/icons/closed-door.svg';
import friendsIcon from '../../../assets/icons/friends.svg';
import plusIcon from '../../../assets/icons/plus.svg';
import publicDoor from '../../../assets/icons/public-door.svg';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { GridContainer } from '../../../components/common/container/gridContainer.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useObservable } from '../../../observable.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useIsNarrowScreen } from '../../../styles/mediaQueries.ts';
import { SpaceDetailsDialog } from './spaceSearchSpaceDetails.tsx';
import './spacesSearch.scss';

const TIPS: readonly string[] = [
	`You can move your character inside a room by dragging the character name below.`,
	`Careful! Your spaces are set to private as default when you first create them.`,
	`Press "arrow up" or right-click on a chat message to edit or delete it in the chat.`,
	`Your character can turn around for everyone in a room using the "Pose" tab or with "/turn" or "/t".`,
	`Chat commands start with a "/" and typing just this one character shows a help menu.`,
	`If you write emotes with "/me", a change of "Command hint behavior" in the interface settings may help.`,
	`You can use your browser's "back" and "forward" buttons to navigate between screens.`,
	`In the Pandora settings, character (chat) and account (direct messages) name colors are set separately.`,
	`To quickly invite a character to your current space, use the "/invite" command in a DM to them.`,
	`Every single change in the wardrobe happens instantly and is immediately visible to everyone in the room.`,
	`You can start typing a chat message at any time, even without clicking into the text input field first.`,
	`Setting the render resolution in the graphics settings to 0% lets you use the chat without graphics.`,
	`Cannot move a character because the name is covered? Enter move mode in the "Room"-tab's character menu.`,
	`A double-click/double-tap inside the room will reset the camera to fit the room to the screen.`,
	`You can whisper to multiple characters at once. Check the "Chat" section of the wiki to find out how.`,
	`While leading other characters, switching spaces without leaving the current one will invite them along.`,
	`You can auto-approve space switch requests from specific characters with a character modifier.`,
];

export function SpacesSearch(): ReactElement {
	const navigate = useNavigatePandora();
	const list = useSpacesList();

	const directoryStatus = useObservable(useDirectoryConnector().directoryStatus);

	const [showTips, setShowTips] = useState(false);

	const [tipsIndex, updateSelectedTip] = useReducer((oldState: number) => {
		return (oldState + 1) % TIPS.length;
	}, Math.floor(Math.random() * TIPS.length));

	useEffect(() => {
		const interval = setInterval(() => {
			updateSelectedTip();
		}, 8000);

		return () => {
			clearInterval(interval);
		};
	}, []);

	return (
		<Column padding='medium'>
			<GridContainer padding='medium' templateColumns='minmax(max-content, 1fr) auto minmax(auto, 1fr)' alignItemsX='center' alignItemsY='center'>
				<Button
					className='justify-self-start'
					onClick={ () => {
						navigate('/');
					} }
				>
					◄ Back
				</Button>
				<h2 className='text-align-center'>Spaces search</h2>
				<GridContainer className='justify-self-end text-align-end' gap='small' templateColumns='auto auto' templateRows='auto-flow' alignItemsX='end' alignItemsY='center'>
					<span>Accounts online:</span><span>{ directoryStatus.onlineAccounts }</span>
					<span>Characters online:</span><span>{ directoryStatus.onlineCharacters }</span>
				</GridContainer>
			</GridContainer>
			<Row wrap alignX='end'>
				<button className='infoBox' onClick={ () => setShowTips(true) } >
					<span className='icon'>🛈</span> Tip: { TIPS[tipsIndex] }
				</button>
			</Row>
			{ !list ? (
				<div className='loading'>Loading...</div>
			) : (
				<>
					<SpaceSearchList list={ list } />
					<Column padding='large' gap='small' alignX='start'>
						<div>Want to find or explore public spaces not in use?</div>
						<Row padding='medium' alignY='center'>
							<Button onClick={ () => {
								navigate('/spaces/public/search');
							} }>
								Search public spaces
							</Button>
						</Row>
					</Column>
				</>
			) }
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
	const navigate = useNavigatePandora();
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
							Spaces are places where you can meet other characters.
						</p>
						<p>
							In Pandora, each space is persistent and has one or more owners.<br />
							It only gets deleted when it no longer has any owners.<br />
							A space is listed in this view for everyone, if it has<br />
							the space visibility "public" and there are one or more characters online inside.<br />
							The default setting for newly created spaces is space visibility "Private".<br />
							You can always see spaces where you are either an Admin or an Owner, or where<br />
							you are on the space's Allowed users list.
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
								<div className='icon small'><img src={ plusIcon } alt='Create space' /></div>
								<div className='entry'>Create a new space</div>
							</button>
						)
					}
				</Column>
			</div>
			<hr className='fill-x' />
			<div>
				<h3>Found spaces ({ otherSpaces.length })</h3>
				{
					otherSpaces.length === 0 ? (
						<p>No publicly listed space with online users found</p>
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

export const SPACE_SEARCH_PUBLIC_ICONS: Record<SpacePublicSetting, string> = {
	'locked': closedDoorLocked,
	'private': closedDoor,
	'public-with-admin': publicDoor,
	'public-with-anyone': publicDoor,
};
export const SPACE_SEARCH_PUBLIC_LABELS: Record<SpacePublicSetting, string> = {
	'locked': 'Locked private space',
	'private': 'Private space',
	'public-with-admin': 'Public space',
	'public-with-anyone': 'Public space',
};

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
						src={ SPACE_SEARCH_PUBLIC_ICONS[baseInfo.public] }
						title={ SPACE_SEARCH_PUBLIC_LABELS[baseInfo.public] }
						alt={ SPACE_SEARCH_PUBLIC_LABELS[baseInfo.public] } />
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
