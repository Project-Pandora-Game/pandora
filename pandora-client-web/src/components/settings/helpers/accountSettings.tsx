import { ACCOUNT_SETTINGS_DEFAULT, AccountSettingsSchema, type AccountSettings } from 'pandora-common';
import React, { type ReactElement } from 'react';
import type { ConditionalKeys } from 'type-fest';
import { useDirectoryConnector, useModifiedAccountSettings } from '../../gameContext/directoryConnectorContextProvider';
import { SelectSettingInput, ToggleSettingInput } from './settingsInputs';
import type { ZodType } from 'zod';

type BooleanSettings = ConditionalKeys<AccountSettings, boolean>;
export function ToggleAccountSetting<const Setting extends BooleanSettings>({ setting, label }: {
	setting: Setting;
	label: string;
}): ReactElement {
	const modifiedSettings = useModifiedAccountSettings();
	const directory = useDirectoryConnector();

	const onChange = (value: boolean) => {
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { [setting]: value },
		});
	};

	const onReset = () => {
		directory.sendMessage('changeSettings', {
			type: 'reset',
			settings: [setting],
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
export function SelectAccountSettings<const Setting extends StringSettings>({ setting, label, stringify }: {
	setting: Setting;
	label: string;
	stringify: Readonly<Record<AccountSettings[Setting], string>>;
}): ReactElement {
	const modifiedSettings = useModifiedAccountSettings();
	const directory = useDirectoryConnector();

	const onChange = (value: AccountSettings[Setting]) => {
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { [setting]: value },
		});
	};

	const onReset = () => {
		directory.sendMessage('changeSettings', {
			type: 'reset',
			settings: [setting],
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
			schema={ schema }
			onChange={ onChange }
			onReset={ onReset }
		/>
	);
}
