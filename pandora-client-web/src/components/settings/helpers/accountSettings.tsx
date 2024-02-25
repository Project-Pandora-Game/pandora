import { ACCOUNT_SETTINGS_DEFAULT, type AccountSettings } from 'pandora-common';
import React, { type ReactElement } from 'react';
import type { ConditionalKeys } from 'type-fest';
import { useDirectoryConnector, useModifiedAccountSettings } from '../../gameContext/directoryConnectorContextProvider';
import { ToggleSettingInput } from './settingsInputs';

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
