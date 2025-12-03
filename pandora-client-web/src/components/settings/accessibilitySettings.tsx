import { ReactElement } from 'react';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { Column, Row } from '../common/container/container.tsx';
import { ContextHelpButton } from '../help/contextHelpButton.tsx';
import { ToggleAccountSetting } from './helpers/accountSettings.tsx';

export function AccessibilitySettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		// eslint-disable-next-line react/jsx-no-useless-fragment
		<>
			<InterfaceAccessibilitySettings />
		</>
	);
}

function InterfaceAccessibilitySettings(): ReactElement {
	return (
		<fieldset>
			<legend>Interface Accessibility</legend>
			<Column gap='large'>
				<ToggleAccountSetting
					setting='forceSystemColors'
					label={ (
						<Row alignY='center'>
							Use system color scheme
							<ContextHelpButton>
								This setting overrides any colors from Pandora, instead letting your browser choose most colors.<br />
								Note, that the used colors depend on your computer's/phone's selected color theme, accent color and accessibility settings (such as high contrast requirement).
							</ContextHelpButton>
						</Row>
					) }
				/>
			</Column>
		</fieldset>
	);
}
