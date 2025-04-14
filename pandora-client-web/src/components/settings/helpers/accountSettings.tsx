import type { Immutable } from 'immer';
import { ACCOUNT_SETTINGS_DEFAULT, AccountSettingsSchema, GetLogger, type AccountSettings } from 'pandora-common';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import type { ConditionalKeys } from 'type-fest';
import type { ZodType } from 'zod';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useModifiedAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { SelectSettingInput, ToggleSettingInput, type SettingDriver } from './settingsInputs.tsx';

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

type BooleanSettings = ConditionalKeys<AccountSettings, boolean>;
export function ToggleAccountSetting<const Setting extends BooleanSettings>({ setting, label }: {
	setting: Setting;
	label: string;
}): ReactElement {
	return (
		<ToggleSettingInput
			label={ label }
			driver={ useAccountSettingDriver(setting) }
		/>
	);
}

type StringSettings = ConditionalKeys<AccountSettings, string>;
export function SelectAccountSettings<const Setting extends StringSettings>({ setting, label, stringify, optionOrder, children }: {
	setting: Setting;
	label: string;
	stringify: Readonly<Record<AccountSettings[Setting], string>>;
	optionOrder?: readonly AccountSettings[Setting][];
	children?: ReactNode;
}): ReactElement {
	// @ts-expect-error: Type specialized manually
	const schema: ZodType<AccountSettings[Setting]> = AccountSettingsSchema.shape[setting];

	return (
		<SelectSettingInput<AccountSettings[Setting]>
			driver={ useAccountSettingDriver(setting) as unknown as SettingDriver<AccountSettings[Setting]> }
			label={ label }
			stringify={ stringify }
			optionOrder={ optionOrder }
			schema={ schema }
		>
			{ children }
		</SelectSettingInput>
	);
}
