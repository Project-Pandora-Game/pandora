import classNames from 'classnames';
import { produce, type Immutable } from 'immer';
import { AssertNotNullable, CLIENT_NOTIFICATION_GROUPS, CLIENT_NOTIFICATION_TYPES, ClientNotificationSoundSchema, ClientNotificationSoundVolumeSchema, ClientNotificationSuppressionSettingSchema, KnownObject, type AccountSettings, type ClientNotificationSound, type ClientNotificationSoundVolume, type ClientNotificationType } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
import { z } from 'zod';
import popupIcon from '../../assets/icons/bubble.svg';
import notificationIcon from '../../assets/icons/notification.svg';
import soundOffIcon from '../../assets/icons/sound-0.svg';
import soundOnIcon from '../../assets/icons/sound-3.svg';
import { useAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { NOTIFICATION_AUDIO_NAMES, NOTIFICATION_AUDIO_SOUNDS, NOTIFICATION_AUDIO_VOLUME } from '../../services/notificationHandler.tsx';
import { NotificationPermissionRequest } from '../../ui/components/notifications/notificationPermissionRequest.tsx';
import { Button } from '../common/button/button.tsx';
import { Column } from '../common/container/container.tsx';
import { useAccountSettingDriver } from './helpers/accountSettings.tsx';
import { SelectSettingInput, ToggleSettingInput, useOptionalSubsettingDriver, useSubsettingDriver, useValueMapDriver, type SettingDriver } from './helpers/settingsInputs.tsx';

export function NotificationSettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<NotificationGlobalSettings />
			<NotificationIndividualSettings />
		</>
	);
}

function NotificationGlobalSettings(): ReactElement {
	const globalSettingsDriver = useAccountSettingDriver('notificationGlobalSettings');
	const soundSettingsDriver = useSubsettingDriver(globalSettingsDriver, 'sound');
	const defaultVolumeDriver = useSubsettingDriver(soundSettingsDriver, 'volume');
	const defaultVolume = defaultVolumeDriver.currentValue ?? defaultVolumeDriver.defaultValue;
	const defaultSoundDriver = useSubsettingDriver(soundSettingsDriver, 'sound');
	const defaultSound = defaultSoundDriver.currentValue ?? defaultSoundDriver.defaultValue;

	return (
		<fieldset>
			<legend>Global settings</legend>
			<h2>Sound</h2>
			<SelectSettingInput
				driver={ defaultVolumeDriver }
				label='Sound notifications volume'
				stringify={ NOTIFICATION_AUDIO_VOLUME }
				optionOrder={ ['100', '75', '50', '25', '0'] }
				schema={ ClientNotificationSoundVolumeSchema }
			/>
			<SelectSettingInput
				driver={ defaultSoundDriver }
				label='Default notification sound'
				stringify={ NOTIFICATION_AUDIO_NAMES }
				schema={ ClientNotificationSoundSchema }
			>
				<Button
					className='slim'
					disabled={ defaultSound === '' }
					onClick={ () => {
						const sound = NOTIFICATION_AUDIO_SOUNDS[defaultSound];
						if (sound != null) {
							const audio = new Audio(sound);
							audio.volume = Number(defaultVolume) / 100;
							audio.play().catch(() => { /*ignore*/ });
						}
					} }
				>
					Test
				</Button>
			</SelectSettingInput>
			<h2>Popups</h2>
			<ToggleSettingInput
				driver={ useSubsettingDriver(globalSettingsDriver, 'usePlatformPopup') }
				label='Use system popups, if available (requires additional browser permission)'
			/>
			<NotificationPermissionRequest />
		</fieldset>
	);
}

function NotificationIndividualSettings(): ReactElement {
	const driver = useAccountSettingDriver('notificationTypeSettings');

	return (
		<fieldset>
			<legend>Notification settings</legend>
			<div className='notificationTypeSettingsGrid'>
				{
					Object.entries(CLIENT_NOTIFICATION_GROUPS).map(([group, groupDefinition], i) => (
						<React.Fragment key={ group }>
							{ i !== 0 ? <hr className='groupSeparator' /> : null }
							<h2 className='groupName'>{ groupDefinition.name }</h2>
							{
								KnownObject.entries(CLIENT_NOTIFICATION_TYPES).filter(([,definition]) => definition.group === group).map(([type]) => (
									<NotificationTypeSetting
										key={ type }
										globalDriver={ driver }
										type={ type }
									/>
								))
							}
						</React.Fragment>
					))
				}
			</div>
		</fieldset>
	);
}

function NotificationTypeSetting({ globalDriver, type }: {
	globalDriver: SettingDriver<Immutable<AccountSettings>['notificationTypeSettings']>;
	type: ClientNotificationType;
}): ReactElement {
	const { notificationGlobalSettings } = useAccountSettings();

	const definition = CLIENT_NOTIFICATION_TYPES[type];
	const driver = useOptionalSubsettingDriver(globalDriver, type, definition.defaultSettings);
	const currentSettings = driver.currentValue ?? driver.defaultValue;
	const [open, setOpen] = useState(false);

	const persistDriver = useSubsettingDriver(driver, 'persist');
	const popupDriver = useSubsettingDriver(driver, 'popup');
	const soundDriver = useSubsettingDriver(driver, 'sound');
	const soundEnableDriver = useValueMapDriver(soundDriver, (v) => v != null, (v) => (v ? {} : null));

	const suppressionDriver = useSubsettingDriver(driver, 'suppression');

	return (
		<>
			<Button
				theme='transparent'
				className='notificationTypeName'
				onClick={ () => {
					setOpen((v) => !v);
				} }
				slim
			>
				{ definition.name }
			</Button>
			<img
				className={ classNames('notificationToggleIcon', currentSettings.persist ? null : 'disabled') }
				src={ notificationIcon }
				alt='Create notification'
				title='Create notification'
			/>
			<img
				className={ classNames('notificationToggleIcon', currentSettings.popup ? null : 'disabled') }
				src={ popupIcon }
				alt='Popup a toast'
				title='Popup a toast'
			/>
			<img
				className={ classNames('notificationToggleIcon', (currentSettings.sound != null) ? null : 'disabled') }
				src={ (currentSettings.sound != null) ? soundOnIcon : soundOffIcon }
				alt='Play sound'
				title='Play sound'
			/>
			<Button
				className='notificationTypeReset'
				onClick={ () => driver.onReset?.() }
				disabled={ driver.currentValue === undefined || driver.onReset == null }
				slim
			>
				↺
			</Button>
			{
				open ? (
					<Column className='notificationTypeSettings' padding='medium'>
						<ToggleSettingInput
							driver={ persistDriver }
							label='Create notification in notifications menu and show a notification badge for it, until dismissed'
							noReset
						/>
						<ToggleSettingInput
							driver={ popupDriver }
							label='Pop a toast or a platform popup when this event happens'
							noReset
						/>
						<ToggleSettingInput
							driver={ soundEnableDriver }
							label='Play a sound when notification triggers'
							noReset
						/>
						<div className='selectsArea'>
							<SelectSettingInput<ClientNotificationSoundVolume | '-default-'>
								driver={ {
									currentValue: currentSettings.sound?.volume ?? '-default-',
									defaultValue: '-default-',
									onChange: (newValue) => {
										AssertNotNullable(currentSettings.sound);
										soundDriver.onChange(produce(currentSettings.sound, (d) => {
											if (newValue !== '-default-') {
												d.volume = newValue;
											} else {
												delete d.volume;
											}
										}));
									},
								} }
								disabled={ currentSettings.sound == null }
								label='Sound volume'
								stringify={ {
									...NOTIFICATION_AUDIO_VOLUME,
									'-default-': '[ Use global setting ]',
								} }
								optionOrder={ ['-default-', '100', '75', '50', '25', '0'] }
								schema={ ClientNotificationSoundVolumeSchema.or(z.literal('-default-')) }
								noWrapper
								noReset
							/>
							<SelectSettingInput<ClientNotificationSound | '-default-'>
								driver={ {
									currentValue: currentSettings.sound?.sound ?? '-default-',
									defaultValue: '-default-',
									onChange: (newValue) => {
										AssertNotNullable(currentSettings.sound);
										soundDriver.onChange(produce(currentSettings.sound, (d) => {
											if (newValue !== '-default-') {
												d.sound = newValue;
											} else {
												delete d.sound;
											}
										}));
									},
								} }
								disabled={ currentSettings.sound == null }
								label='Notification sound'
								stringify={ {
									...NOTIFICATION_AUDIO_NAMES,
									'-default-': '[ Use global setting ]',
								} }
								schema={ ClientNotificationSoundSchema.or(z.literal('-default-')) }
								noWrapper
								noReset
							>
								<Button
									className='slim'
									disabled={ !(currentSettings.sound?.sound ?? notificationGlobalSettings.sound.sound) }
									onClick={ () => {
										const soundSetting = currentSettings.sound?.sound ?? notificationGlobalSettings.sound.sound;
										const volumeSetting = currentSettings.sound?.volume ?? notificationGlobalSettings.sound.volume;

										const sound = NOTIFICATION_AUDIO_SOUNDS[soundSetting];
										if (sound != null) {
											const audio = new Audio(sound);
											audio.volume = Number(volumeSetting) / 100;
											audio.play().catch(() => { /*ignore*/ });
										}
									} }
								>
									Test
								</Button>
							</SelectSettingInput>
							<SelectSettingInput
								driver={ suppressionDriver }
								label='Suppression'
								stringify={ {
									'not-blurred': 'Do not notify if Pandora is focused',
									'not-suppressed': 'Do not notify if Pandora is focused' + (definition.suppressable ? ` and ${definition.suppressable}` : ' (this notification has no suppression trigger)'),
									'always': 'Always notify',
								} }
								schema={ ClientNotificationSuppressionSettingSchema }
								noWrapper
								noReset
							/>
						</div>
					</Column>
				) : null
			}
		</>
	);
}
