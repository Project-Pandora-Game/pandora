import { GetLogger } from 'pandora-common';
import { useCallback, type ReactElement } from 'react';
import { Button } from '../../../components/common/button/button.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { useObservable } from '../../../observable.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useService } from '../../../services/serviceProvider.tsx';

export function NotificationPermissionRequest(): ReactElement | null {
	const { notificationGlobalSettings } = useAccountSettings();
	const browserPermissionManager = useService('browserPermissionManager');
	const notificationPermissionState = useObservable(browserPermissionManager.permissionStates).notifications;

	const requestPermission = useCallback(() => {
		globalThis.Notification.requestPermission()
			.catch((err) => {
				GetLogger('NotificationPermissionRequest').warning('Error requesting permission:', err);
			});
	}, []);

	if (!notificationGlobalSettings.usePlatformPopup || notificationPermissionState === 'granted')
		return null;

	return (
		<Row className='warning-box'>
			{
				notificationPermissionState === 'prompt' ? (
					<>
						<span className='flex-1'>Using system popups requires additional permission from your browser</span>
						<Button onClick={ requestPermission }>Allow</Button>
					</>
				) : notificationPermissionState === 'denied' ? (
					<span className='flex-1'>
						'Use system popups' is selected, but Pandora has been denied access by your browser.
						System popups will not be used.
					</span>
				) : (
					<span className='flex-1'>
						'Use system popups' is selected, but your browser does not seem to support them.
						System popups cannot be used.
					</span>
				)
			}
		</Row>
	);
}
