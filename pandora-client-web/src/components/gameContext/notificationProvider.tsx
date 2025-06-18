import type { Immutable } from 'immer';
import { useCallback, useEffect } from 'react';
import { useDebugExpose } from '../../common/useDebugExpose.ts';
import { useObservable } from '../../observable.ts';
import type { NotificationEntry } from '../../services/notificationHandler.ts';
import { useService } from '../../services/serviceProvider.tsx';
import { VersionCheck } from '../versionCheck/versionCheck.tsx';

export function NotificationProvider() {
	const notificationHandler = useService('notificationHandler');

	useDebugExpose('notificationHandler', notificationHandler);

	return (
		<>
			<VersionCheck />
			<NotificationTitleUpdater />
		</>
	);
}

const BASE_TITLE = 'Pandora';
function NotificationTitleUpdater(): null {
	const notificationHandler = useService('notificationHandler');

	const notifications = useObservable(notificationHandler.notifications);
	const title = notifications.length > 0 ? `(${notifications.length}) ${BASE_TITLE}` : BASE_TITLE;

	useEffect(() => {
		window.document.title = title;
	}, [title]);

	return null;
}

export function useNotificationHeader(): [Immutable<NotificationEntry[]>, () => void] {
	const notificationHandler = useService('notificationHandler');
	return [
		useObservable(notificationHandler.notifications),
		useCallback(() => notificationHandler.clearAllNotifications(), [notificationHandler]),
	];
}
