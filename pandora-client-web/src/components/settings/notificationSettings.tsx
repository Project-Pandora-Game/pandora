import React, { ReactElement } from 'react';
import { useCurrentAccount, useAccountSettings } from '../gameContext/directoryConnectorContextProvider';
import { SelectAccountSettings } from './helpers/accountSettings';
import { Button } from '../common/button/button';
import { NOTIFICATION_AUDIO_SOUNDS, NOTIFICATION_AUDIO_NAMES, NOTIFICATION_AUDIO_VOLUME } from '../gameContext/notificationContextProvider';
import { FieldsetToggle } from '../common/fieldsetToggle';

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
			<VolumeSettings />
			<RoomEntrySettings />
		</fieldset>
	);
}

function VolumeSettings(): ReactElement {
	return (
		<FieldsetToggle legend='Volume settings'>
			<SelectAccountSettings setting='notificationVolume' label='Select the volume of the notifications' stringify={ NOTIFICATION_AUDIO_VOLUME } />
		</FieldsetToggle>
	);
}

function RoomEntrySettings(): ReactElement {
	const { notificationRoomEntryNew, notificationVolume } = useAccountSettings();
	return (
		<FieldsetToggle legend='Room entry notifications'>
			<SelectAccountSettings setting='notificationRoomEntryNew' label='Which audio to play, if someone enters your room' stringify={ NOTIFICATION_AUDIO_NAMES } />
			<div>
				<Button
					className='slim fadeDisabled'
					disabled={ notificationRoomEntryNew === '' }
					onClick={ () => {
						const sound = NOTIFICATION_AUDIO_SOUNDS[notificationRoomEntryNew];
						if (sound != null) {
							const audio = new Audio(sound);
							audio.volume = Number(notificationVolume) / 100;
							audio.play().catch(() => { /*ignore*/ });
						}
					} }
				>
					Test the sound
				</Button>
			</div>
		</FieldsetToggle>
	);
}
