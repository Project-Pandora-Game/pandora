import React, { ReactElement } from 'react';
import { useCurrentAccount, useAccountSettings } from '../gameContext/directoryConnectorContextProvider';
import { SelectAccountSettings } from './helpers/accountSettings';
import { Button } from '../common/button/button';
import { NOTIFICATION_AUDIO_SOUNDS, NOTIFICATION_AUDIO_NAMES } from '../gameContext/notificationContextProvider';

export function NotificationSettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<NotificationsSettings />
	);
}

function NotificationsSettings(): ReactElement {
	return (
		<fieldset>
			<legend>Notifications Setting</legend>
			<RoomEntrySettings />
		</fieldset>
	);
}

function RoomEntrySettings(): ReactElement {
	const { notificationRoomEntryNew } = useAccountSettings();
	return (
		<p>
			<Button
				className='slim fadeDisabled'
				disabled={ notificationRoomEntryNew === '' }
				onClick={ () => {
					const sound = NOTIFICATION_AUDIO_SOUNDS[notificationRoomEntryNew];
					if (sound != null)
						new Audio(sound).play().catch(() => { /*ignore*/ });
				} }
			>
				Test the sound
			</Button>
			<SelectAccountSettings setting='notificationRoomEntryNew' label='Which audio to play, if someone enters your room' stringify={ NOTIFICATION_AUDIO_NAMES } />
		</p>
	);
}
