import classNames from 'classnames';
import { isEqual } from 'lodash-es';
import { AccountOnlineStatusSchema, DirectoryStatusAnnouncement, GetLogger, IsAuthorized, type AccountOnlineStatus } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import crossIcon from '../../assets/icons/cross.svg';
import friendsIcon from '../../assets/icons/friends.svg';
import managementIcon from '../../assets/icons/management.svg';
import notificationsIcon from '../../assets/icons/notification.svg';
import settingsIcon from '../../assets/icons/setting.svg';
import statusIconAway from '../../assets/icons/state-away.svg';
import statusIconDND from '../../assets/icons/state-dnd.svg';
import statusIconLookingDom from '../../assets/icons/state-dom.svg';
import statusIconInvisible from '../../assets/icons/state-invisible.svg';
import statusIconOnline from '../../assets/icons/state-online.svg';
import statusIconLookingSub from '../../assets/icons/state-sub.svg';
import statusIconLookingSwitch from '../../assets/icons/state-switch.svg';
import wikiIcon from '../../assets/icons/wiki.svg';
import { useObservable, useObservableMultiple } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import type { DirectMessageChat } from '../../services/accountLogic/directMessages/directMessageChat.ts';
import { NotificationSource, useNotification, type NotificationHeaderKeys } from '../../services/notificationHandler.ts';
import { useService } from '../../services/serviceProvider.tsx';
import { useIsNarrowScreen } from '../../styles/mediaQueries.ts';
import { AccountContactContext, useAccountContacts } from '../accountContacts/accountContactContext.ts';
import { Button, IconButton } from '../common/button/button.tsx';
import { IconHamburger } from '../common/button/domIcons.tsx';
import { Column, DivContainer, Row } from '../common/container/container.tsx';
import { DialogInPortal, DraggableDialog } from '../dialog/dialog.tsx';
import { GetDirectoryUrl, useAuthTokenHeader, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { useNotificationHeader } from '../gameContext/notificationProvider.tsx';
import { usePlayerData } from '../gameContext/playerContextProvider.tsx';
import { useShardConnectionInfo } from '../gameContext/shardConnectorContextProvider.tsx';
import { HeaderButton } from './HeaderButton.tsx';
import './header.scss';
import { LeaveButton } from './leaveButton.tsx';

function LeftHeader({ onAnyClick }: {
	onAnyClick?: () => void;
}): ReactElement {
	const connectionInfo = useShardConnectionInfo();

	const characterData = usePlayerData();
	const characterName = (characterData && !characterData.inCreation) ? characterData.name : null;
	const [preview, setPreview] = useState<string | null>(null);
	const auth = useAuthTokenHeader();

	useEffect(() => {
		if (!auth || !connectionInfo)
			return;

		let valid = true;

		fetch(new URL(`pandora/character/${encodeURIComponent(connectionInfo.characterId)}/preview`, GetDirectoryUrl()), {
			headers: {
				Authorization: auth,
			},
		})
			.then((result) => {
				if (!result.ok) {
					throw new Error(`Request failed: ${result.status} ${result.statusText}`);
				}
				return result;
			})
			.then((result) => result.blob())
			.then((blob) => new Promise<string>((resolve, reject) => {
				const reader = new FileReader();

				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(blob);
			}))
			.then((image) => {
				if (valid) {
					setPreview(image);
				}
			})
			.catch((err) => {
				GetLogger('LeftHeader').warning(`Error getting preview for character ${connectionInfo.characterId}:`, err);
			});

		return () => {
			valid = false;
		};
	});

	const navigate = useNavigatePandora();
	const goToWardrobe = useCallback(() => {
		if (connectionInfo != null) {
			navigate(`/wardrobe/character/${connectionInfo.characterId}`);
			onAnyClick?.();
		}
	}, [navigate, onAnyClick, connectionInfo]);

	return (
		<div className='leftHeader flex'>
			{ connectionInfo && (
				<button onClick={ goToWardrobe } title='Go to wardrobe' className='HeaderButton currentCharacter'>
					{ preview ? (<img className='avatar' src={ preview } />) : null }
					<span className='headerText'>
						<span className='label'>Current character:</span>
						{ characterName ?? `[Character ${connectionInfo.characterId}]` }
					</span>
				</button>
			) }
			{ !connectionInfo && (
				<span className='headerText'>
					<span className='label'>Current character:</span>
					[no character selected]
				</span>
			) }
		</div>
	);
}

function RightHeader({ onAnyClick }: {
	onAnyClick?: () => void;
}): ReactElement {
	const currentAccount = useCurrentAccount();
	const { onlineStatus } = useAccountSettings();
	const navigate = useNavigatePandora();
	const loggedIn = currentAccount != null;

	const isDeveloper = currentAccount?.roles !== undefined && IsAuthorized(currentAccount.roles, 'developer');

	const [showOnlineStatusMenu, setShowOnlineStatusMenu] = useState(false);

	return (
		<div className='rightHeader'>
			{ loggedIn && (
				<>
					<HeaderButton
						icon={ wikiIcon }
						iconAlt='Wiki'
						title='Wiki'
						onClick={ () => {
							navigate('/wiki');
							onAnyClick?.();
						} }
					/>
					<NotificationButton
						icon={ notificationsIcon }
						title='Notifications'
						type='notifications'
						onClick={ () => {
							toast('Not implemented yet, notifications cleared', TOAST_OPTIONS_ERROR);
						} }
					/>
					<FriendsHeaderButton onClickExtra={ onAnyClick } />
					<HeaderButton
						icon={ settingsIcon }
						iconAlt='Settings'
						title='Settings'
						onClick={ () => {
							navigate('/settings');
							onAnyClick?.();
						} }
					/>
					{ isDeveloper && (
						<HeaderButton
							icon={ managementIcon }
							iconAlt='Management'
							title='Management'
							onClick={ () => {
								navigate('/management');
								onAnyClick?.();
							} }
						/>
					) }
					<DivContainer className='position-relative currentAccount'>
						<Button
							theme='transparent'
							title='Availability status'
							slim
							onClick={ () => {
								setShowOnlineStatusMenu((v) => !v);
							} }
						>
							<span className='label'>Current account:</span>
							<img
								className='onlineStatusIndicator'
								src={ HEADER_STATUS_SELECTOR_ICONS[onlineStatus] }
								alt={ HEADER_STATUS_SELECTOR_NAMES[onlineStatus] }
								title={ HEADER_STATUS_SELECTOR_NAMES[onlineStatus] }
							/>
							{ currentAccount.settings.displayName || currentAccount.username }
						</Button>
						<StatusSelector
							open={ showOnlineStatusMenu }
							close={ () => {
								setShowOnlineStatusMenu(false);
							} }
						/>
					</DivContainer>
					<LeaveButton onClickExtra={ onAnyClick } />
				</>
			) }
			{ !loggedIn && <span className='headerText'>[not logged in]</span> }
		</div>
	);
}

function StatusSelector({ open, close }: {
	open: boolean;
	close: () => void;
}): ReactElement {
	const directory = useDirectoryConnector();

	return (
		<div className={ open ? 'statusSelectorMenuContainer open' : 'statusSelectorMenuContainer' }>
			<div className='statusSelectorMenu'>
				{
					AccountOnlineStatusSchema.options.map((o) => (
						<Button key={ o }
							theme='transparent'
							onClick={ () => {
								directory.awaitResponse('changeSettings', {
									type: 'set',
									settings: { onlineStatus: o },
								})
									.catch((err: unknown) => {
										toast('Failed to set your online status. Please try again.', TOAST_OPTIONS_ERROR);
										GetLogger('StatusSelector').error('Failed to update:', err);
									});
								close();
							} }
							slim
						>
							<Row gap='tiny' alignY='center' className='fill-x fit'>
								<img
									className='onlineStatusIndicator'
									src={ HEADER_STATUS_SELECTOR_ICONS[o] }
									alt={ HEADER_STATUS_SELECTOR_NAMES[o] }
								/>
								<span className='flex-1'>
									{ HEADER_STATUS_SELECTOR_NAMES[o] }
								</span>
							</Row>
						</Button>
					))
				}
			</div>
		</div>
	);
}

export const HEADER_STATUS_SELECTOR_ICONS: Record<AccountOnlineStatus, string> = {
	'online': statusIconOnline,
	'looking-switch': statusIconLookingSwitch,
	'looking-dom': statusIconLookingDom,
	'looking-sub': statusIconLookingSub,
	'away': statusIconAway,
	'dnd': statusIconDND,
	'offline': statusIconInvisible,
};

export const HEADER_STATUS_SELECTOR_NAMES: Record<AccountOnlineStatus, string> = {
	'online': 'Online',
	'looking-switch': 'Looking to play',
	'looking-dom': 'Looking to dom',
	'looking-sub': 'Looking to sub',
	'away': 'Away',
	'dnd': 'Do Not Disturb',
	'offline': 'Invisible',
};

function NotificationButton({ icon, title, type, onClick }: {
	icon: string;
	title: string;
	type: NotificationHeaderKeys;
	onClick: (_: React.MouseEvent<HTMLButtonElement>) => void;
}): ReactElement {
	const [notification, clearNotifications] = useNotificationHeader(type);

	const onNotificationClick = useCallback((ev: React.MouseEvent<HTMLButtonElement>) => {
		clearNotifications();
		onClick(ev);
	}, [clearNotifications, onClick]);

	return (
		<HeaderButton
			icon={ icon }
			iconAlt={ `${ notification.length } ${ title }` }
			title={ title }
			badge={ notification.length }
			onClick={ onNotificationClick } />
	);
}

function FriendsHeaderButton({ onClickExtra }: {
	onClickExtra?: () => void;
}): ReactElement {
	const navigate = useNavigatePandora();
	const directMessageManager = useService('directMessageManager');
	const notifyDirectMessage = useNotification(NotificationSource.DIRECT_MESSAGE);
	const unreadDirectMessageCount = useObservableMultiple(
		useObservable(directMessageManager.chats)
			.map((c) => c.displayInfo),
	).filter((c) => c.hasUnread).length;
	const incomingFriendRequestCount = useAccountContacts('incoming').length;
	const notificationCount = unreadDirectMessageCount + incomingFriendRequestCount;

	useEffect(() => directMessageManager.on('newMessage', (_chat: DirectMessageChat) => {
		notifyDirectMessage({
			// TODO: notification
		});
	}), [directMessageManager, notifyDirectMessage]);

	const notifyFriendRequest = useNotification(NotificationSource.INCOMING_FRIEND_REQUEST);
	useEffect(() => AccountContactContext.on('incoming', () => notifyFriendRequest({
		// TODO: ...
	})), [notifyFriendRequest]);

	return (
		<HeaderButton
			icon={ friendsIcon }
			iconAlt={ `${ notificationCount } Contacts` }
			title='Contacts'
			badge={ notificationCount }
			onClick={ () => {
				navigate('/contacts');
				onClickExtra?.();
			} }
		/>
	);
}

function OverlayHeader({ onClose: close, visible }: {
	onClose: () => void;
	visible: boolean;
}): ReactElement {
	return (
		<DialogInPortal priority={ 5 } location='mainOverlay'>
			<Column className={ classNames('OverlayHeader', visible ? null : 'hide') }>
				<Column className='content'>
					<LeftHeader onAnyClick={ close } />
					<hr />
					<RightHeader onAnyClick={ close } />
				</Column>
			</Column>
		</DialogInPortal>
	);
}

function CollapsableHeader(): ReactElement {
	const [showMenu, setShowMenu] = useState(false);

	const currentAccount = useCurrentAccount();
	const connectionInfo = useShardConnectionInfo();
	const characterData = usePlayerData();
	const characterName = (characterData && !characterData.inCreation) ? characterData.name : null;

	return (
		<Row alignX='space-between' alignY='center' className='flex-1'>
			<span className='headerText'>
				{
					currentAccount == null ? '[not logged in]' :
					connectionInfo == null ? '[no character selected]' :
					(characterName ?? `[Character ${connectionInfo.characterId}]`)
				}
			</span>
			<button className='collapsableHeaderButton' onClick={ () => {
				setShowMenu(!showMenu);
			} }>
				<IconHamburger state={ showMenu ? 'cross' : 'hamburger' } />
			</button>
			<OverlayHeader visible={ showMenu } onClose={ () => setShowMenu(false) } />
		</Row>
	);
}

export function Header(): ReactElement {
	const isNarrow = useIsNarrowScreen();

	return (
		<>
			<header className='Header'>
				{
					isNarrow ? (
						<CollapsableHeader />
					) : (
						<>
							<LeftHeader />
							<RightHeader />
						</>
					)
				}
			</header>
			<Announcement />
		</>
	);
}

function Announcement(): ReactElement | null {
	const { announcement } = useObservable(useDirectoryConnector().directoryStatus);

	const [open, setOpen] = useState(false);
	const [dismissedAnnouncement, setDismissedAnnouncement] = useState<DirectoryStatusAnnouncement | null>(null);

	useEffect(() => {
		if (open && announcement == null) {
			setOpen(false);
		}
	}, [announcement, open]);

	if (announcement == null || isEqual(announcement, dismissedAnnouncement))
		return null;

	return (
		<>
			<div className={ `ServerAnnouncementHeader type-${announcement.type}` }>
				<Button
					theme='transparent'
					className='flex-1'
					onClick={ () => {
						setOpen((v) => !v);
					} }
					slim
				>
					{ announcement.title } { announcement.content ? '(…)' : null }
				</Button>
				<IconButton
					onClick={ () => {
						setDismissedAnnouncement(announcement);
					} }
					theme='default'
					src={ crossIcon }
					alt='Dismiss announcement'
				/>
			</div>
			{
				open ? (
					<DraggableDialog
						close={ () => {
							setOpen(false);
						} }
						title='Announcement'
					>
						<h2>{ announcement.title }</h2>
						<p className='display-linebreak'>
							{ announcement.content }
						</p>
					</DraggableDialog>
				) : null
			}
		</>
	);
}
