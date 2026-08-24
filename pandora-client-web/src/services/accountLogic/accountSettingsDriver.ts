import type { Immutable } from 'immer';
import { ACCOUNT_SETTINGS_DEFAULT, GetLogger, type AccountSettings } from 'pandora-common';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { useDirectoryConnector } from '../../components/gameContext/directoryConnectorContextProvider.tsx';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import type { SettingDriver } from '../../ui/components/settings/settingsInputs.tsx';
import { useModifiedAccountSettings } from './accountManagerHooks.ts';

export function useAccountSettingDriver<const Setting extends keyof AccountSettings>(setting: Setting): SettingDriver<Immutable<AccountSettings>[Setting]> {
	const modifiedSettings = useModifiedAccountSettings();
	const directory = useDirectoryConnector();

	const currentValue: Immutable<AccountSettings>[Setting] | undefined = modifiedSettings?.[setting];

	return useMemo((): SettingDriver<Immutable<AccountSettings>[Setting]> => ({
		currentValue,
		defaultValue: ACCOUNT_SETTINGS_DEFAULT[setting],
		onChange(newValue) {
			directory.awaitResponse('changeSettings', {
				type: 'set',
				settings: { [setting]: newValue },
			})
				.catch((err: unknown) => {
					toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
					GetLogger('AccountSettingDriver').error('Failed to update settings:', err);
				});
		},
		onReset() {
			directory.awaitResponse('changeSettings', {
				type: 'reset',
				settings: [setting],
			})
				.catch((err: unknown) => {
					toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
					GetLogger('AccountSettingDriver').error('Failed to update settings:', err);
				});
		},
	}), [directory, currentValue, setting]);
}
