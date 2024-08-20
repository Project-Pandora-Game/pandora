import React, { ReactElement } from 'react';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks';
import { ToggleAccountSetting } from './helpers/accountSettings';

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
	/* TODO: Add a sound selector */
	return (
		<p>
			<ToggleAccountSetting setting='notificationRoomEntry' label='Play audio if someone enters your room' />
		</p>
	);
}
