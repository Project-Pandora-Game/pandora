import { useCallback, useEffect } from 'react';
import { useDebugExpose } from '../../common/useDebugExpose.ts';
import { useObservable } from '../../observable.ts';
import type { NotificationFullData, NotificationHeaderKeys } from '../../services/notificationHandler.ts';
import { useService } from '../../services/serviceProvider.tsx';
import { VersionCheck } from '../versionCheck/versionCheck.tsx';

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
