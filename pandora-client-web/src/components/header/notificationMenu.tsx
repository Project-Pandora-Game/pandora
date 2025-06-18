import classNames from 'classnames';
import type { Immutable } from 'immer';
import { CLIENT_NOTIFICATION_TYPES } from 'pandora-common';
import type { ReactElement } from 'react';
import crossIcon from '../../assets/icons/cross.svg';
import deleteIcon from '../../assets/icons/delete.svg';
import type { NotificationEntry } from '../../services/notificationHandler.tsx';
import { useService } from '../../services/serviceProvider.tsx';
import { Button, IconButton } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { DialogInPortal } from '../dialog/dialog.tsx';
import './notificationMenu.scss';

export function NotificationMenu({ visible, close, notifications, clearNotifications }: {
	visible: boolean;
	close: () => void;
	notifications: Immutable<NotificationEntry[]>;
	clearNotifications: () => void;
}): ReactElement {
	const notificationHandler = useService('notificationHandler');

	return (
		<DialogInPortal priority={ 6 } location='mainOverlay'>
			<Column className={ classNames('OverlayNotificationMenu', visible ? null : 'hide') } padding='medium'>
				<Row alignX='space-between'>
					<IconButton
						onClick={ clearNotifications }
						theme='default'
						className='topButton'
						src={ deleteIcon }
						alt='Clear notifications'
						disabled={ notifications.length === 0 }
					/>
					<Button
						onClick={ close }
						theme='default'
						slim
					>
						Close ►
					</Button>
				</Row>
				<Column className='content' overflowX='auto' overflowY='auto' padding='medium'>
					{
						notifications.length > 0 ? (
							Array.from(notifications).reverse().map((n, i) => (
								<Column key={ i } className='notificationEntry' alignY='start' padding='medium'>
									<Row>
										{
											n.onClick != null ? (
												<Button
													onClick={ () => {
														notificationHandler.dismissNotification(n);
														close();
														n.onClick?.();
													} }
													className='zero-width flex-1 title'
													theme='transparent'
													slim
												>
													{ n.title ?? CLIENT_NOTIFICATION_TYPES[n.type].name }
												</Button>
											) : (
												<span className='zero-width flex-1 title'>{ n.title ?? CLIENT_NOTIFICATION_TYPES[n.type].name }</span>
											)
										}
										<IconButton
											onClick={ () => {
												notificationHandler.dismissNotification(n);
											} }
											theme='transparent'
											className='dismissButton'
											src={ crossIcon }
											alt='Dismiss notification'
											slim
										/>
									</Row>
									{
										n.content ? (
											<p>{ n.content }</p>
										) : null
									}
								</Column>
							))
						) : (
							<span className='noNotificationsInfo'>You have no notifications at the moment</span>
						)
					}
				</Column>
			</Column>
		</DialogInPortal>
	);
}
