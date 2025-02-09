import { useCallback, useEffect } from 'react';
import { useDebugExpose } from '../../common/useDebugExpose';
import { useObservable } from '../../observable';
import type { NotificationFullData, NotificationHeaderKeys } from '../../services/notificationHandler';
import { useService } from '../../services/serviceProvider';
import { VersionCheck } from '../versionCheck/versionCheck';

export function NotificationProvider() {
	const notificationHandler = useService('notificationHandler');

	useDebugExpose('notificationHandler', notificationHandler);

	useEffect(() => {
		const listener = () => {
			notificationHandler.onWindowFocus();
		};
		window.addEventListener('focus', listener);
		return () => window.removeEventListener('focus', listener);
	}, [notificationHandler]);

	return (
		<>
			<VersionCheck />
			<NotificationTitleUpdater />
		</>
	);
}

function NotificationTitleUpdater(): null {
	const notificationHandler = useService('notificationHandler');
	const currentTitle = useObservable(notificationHandler.title);

	useEffect(() => {
		window.document.title = currentTitle;
	}, [currentTitle]);

	return null;
}

export function useNotificationHeader(type: NotificationHeaderKeys): [readonly NotificationFullData[], () => void] {
	const notificationHandler = useService('notificationHandler');
	return [
		useObservable(notificationHandler.header[type]),
		useCallback(() => notificationHandler.clearHeader(), [notificationHandler]),
	];
}

export function useNotificationPermissionCheck(): () => void {
	const notificationHandler = useService('notificationHandler');
	return useCallback(() => {
		notificationHandler.popupCheckEnabled(true).catch(() => { /** noop */ });
	}, [notificationHandler]);
}
