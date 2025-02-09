import { ACCOUNT_SETTINGS_DEFAULT, AccountSettingsSchema, GetLogger, type AccountSettings } from 'pandora-common';
import { type ReactElement, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import type { ConditionalKeys } from 'type-fest';
import type { ZodType } from 'zod';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { useModifiedAccountSettings } from '../../../services/accountLogic/accountManagerHooks';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import { SelectSettingInput, ToggleSettingInput } from './settingsInputs';

type BooleanSettings = ConditionalKeys<AccountSettings, boolean>;
export function ToggleAccountSetting<const Setting extends BooleanSettings>({ setting, label }: {
	setting: Setting;
	label: string;
}): ReactElement {
	const modifiedSettings = useModifiedAccountSettings();
	const directory = useDirectoryConnector();

	const onChange = (value: boolean) => {
		directory.awaitResponse('changeSettings', {
			type: 'set',
			settings: { [setting]: value },
		})
			.catch((err: unknown) => {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				GetLogger('changeSettings').error('Failed to update settings:', err);
			});
	};

	const onReset = () => {
		directory.awaitResponse('changeSettings', {
			type: 'reset',
			settings: [setting],
		})
			.catch((err: unknown) => {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				GetLogger('changeSettings').error('Failed to update settings:', err);
			});
	};

	return (
		<ToggleSettingInput
			label={ label }
			currentValue={ modifiedSettings?.[setting] }
			defaultValue={ ACCOUNT_SETTINGS_DEFAULT[setting] }
			onChange={ onChange }
			onReset={ onReset }
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
	const modifiedSettings = useModifiedAccountSettings();
	const directory = useDirectoryConnector();

	const onChange = (value: AccountSettings[Setting]) => {
		directory.awaitResponse('changeSettings', {
			type: 'set',
			settings: { [setting]: value },
		})
			.catch((err: unknown) => {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				GetLogger('changeSettings').error('Failed to update settings:', err);
			});
	};

	const onReset = () => {
		directory.awaitResponse('changeSettings', {
			type: 'reset',
			settings: [setting],
		})
			.catch((err: unknown) => {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				GetLogger('changeSettings').error('Failed to update settings:', err);
			});
	};

	const currentValue: string | undefined = modifiedSettings?.[setting];
	// @ts-expect-error: Type specialized manually
	const schema: ZodType<AccountSettings[Setting]> = AccountSettingsSchema.shape[setting];

	return (
		<SelectSettingInput<AccountSettings[Setting]>
			currentValue={ schema.optional().parse(currentValue) }
			defaultValue={ ACCOUNT_SETTINGS_DEFAULT[setting] }
			label={ label }
			stringify={ stringify }
			optionOrder={ optionOrder }
			schema={ schema }
			onChange={ onChange }
			onReset={ onReset }
		>
			{ children }
		</SelectSettingInput>
	);
}
