import { AccountSettingsSchema, type AccountSettings, type ConditionalKeys } from 'pandora-common';
import { type ReactElement, type ReactNode } from 'react';
import type { ZodType } from 'zod';
import { useAccountSettingDriver } from '../../../../services/accountLogic/accountSettingsDriver.ts';
import { SelectSettingInput, ToggleSettingInput, type SettingDriver } from '../../../components/settings/settingsInputs.tsx';

type BooleanSettings = ConditionalKeys<AccountSettings, boolean>;
export function ToggleAccountSetting<const Setting extends BooleanSettings>({ setting, label }: {
	setting: Setting;
	label: ReactNode;
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
