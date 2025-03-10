import { ReactElement } from 'react';
import { useAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { NOTIFICATION_AUDIO_NAMES, NOTIFICATION_AUDIO_SOUNDS, NOTIFICATION_AUDIO_VOLUME } from '../../services/notificationHandler.ts';
import { Button } from '../common/button/button.tsx';
import { SelectAccountSettings } from './helpers/accountSettings.tsx';

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
		<>
			<VolumeSettings />
			<RoomEntrySettings />
		</>
	);
}

function VolumeSettings(): ReactElement {
	return (
		<fieldset>
			<legend>Volume settings</legend>
			<SelectAccountSettings
				setting='notificationVolume'
				label='Select the volume of the notifications'
				stringify={ NOTIFICATION_AUDIO_VOLUME }
				optionOrder={ ['100', '75', '50', '25', '0'] }
			/>
		</fieldset>
	);
}

function RoomEntrySettings(): ReactElement {
	const { notificationRoomEntrySound, notificationVolume } = useAccountSettings();
	return (
		<fieldset>
			<legend>Notifications</legend>
			<SelectAccountSettings
				setting='notificationRoomEntrySound'
				label='Someone enters the current space'
				stringify={ NOTIFICATION_AUDIO_NAMES }
			>
				<Button
					className='slim'
					disabled={ notificationRoomEntrySound === '' }
					onClick={ () => {
						const sound = NOTIFICATION_AUDIO_SOUNDS[notificationRoomEntrySound];
						if (sound != null) {
							const audio = new Audio(sound);
							audio.volume = Number(notificationVolume) / 100;
							audio.play().catch(() => { /*ignore*/ });
						}
					} }
				>
					Test
				</Button>
			</SelectAccountSettings>
		</fieldset>
	);
}
