import type { ReactElement } from 'react';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { Column } from '../../common/container/container.tsx';
import { ToggleAccountSetting } from '../helpers/accountSettings.tsx';

export function DevelopmentSettings(): ReactElement {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return <DevelopmentSettingsInner />;
}

function DevelopmentSettingsInner(): ReactElement {

	return (
		<fieldset>
			<legend>Development settings</legend>
			<Column>
				<ToggleAccountSetting setting='devShowMenus' label="Show [DEV] menus throughout Pandora's interface" />
			</Column>
		</fieldset>
	);
}
