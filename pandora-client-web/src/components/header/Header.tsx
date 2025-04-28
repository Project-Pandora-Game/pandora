import classNames from 'classnames';
import { GetLogger, IsAuthorized } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import friendsIcon from '../../assets/icons/friends.svg';
import managementIcon from '../../assets/icons/management.svg';
import notificationsIcon from '../../assets/icons/notification.svg';
import settingsIcon from '../../assets/icons/setting.svg';
import wikiIcon from '../../assets/icons/wiki.svg';
import { useObservable, useObservableMultiple } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import type { DirectMessageChat } from '../../services/accountLogic/directMessages/directMessageChat.ts';
import { NotificationSource, useNotification, type NotificationHeaderKeys } from '../../services/notificationHandler.ts';
import { useService } from '../../services/serviceProvider.tsx';
import { useIsNarrowScreen } from '../../styles/mediaQueries.ts';
import { AccountContactContext, useAccountContacts } from '../accountContacts/accountContactContext.ts';
import { IconHamburger } from '../common/button/domIcons.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { DialogInPortal } from '../dialog/dialog.tsx';
import { GetDirectoryUrl, useAuthTokenHeader } from '../gameContext/directoryConnectorContextProvider.tsx';
import { useNotificationHeader } from '../gameContext/notificationProvider.tsx';
import { usePlayerData } from '../gameContext/playerContextProvider.tsx';
import { useShardConnectionInfo } from '../gameContext/shardConnectorContextProvider.tsx';
import { HeaderButton } from './HeaderButton.tsx';
import './header.scss';
import { LeaveButton } from './leaveButton.tsx';

function LeftHeader(): ReactElement {
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
		}
	}, [navigate, connectionInfo]);

	return (
		<div className='leftHeader flex'>
			{ connectionInfo && (
				<button onClick={ goToWardrobe } title='Go to wardrobe' className='HeaderButton currentCharacter'>
					{ preview ? (<img className='avatar' src={ preview } />) : null }
					<span>
						<span className='label'>Current character:</span>
						{ characterName ?? `[Character ${connectionInfo.characterId}]` }
					</span>
				</button>
			) }
			{ !connectionInfo && (
				<span>
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
	const navigate = useNavigatePandora();
	const loggedIn = currentAccount != null;

	const isDeveloper = currentAccount?.roles !== undefined && IsAuthorized(currentAccount.roles, 'developer');

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
					<span>
						<span className='label'>Current account:</span>
						{ currentAccount.settings.displayName || currentAccount.username }
					</span>
					<LeaveButton onClickExtra={ onAnyClick } />
				</>
			) }
			{ !loggedIn && <span>[not logged in]</span> }
		</div>
	);
}

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
					<LeftHeader />
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
			<span>
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
	);
}
