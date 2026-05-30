import { KnownObject, type SettingsAdvancedCategory } from 'pandora-common';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import type { ChildrenProps } from '../../common/reactTypes.ts';
import { useCurrentTime } from '../../common/useCurrentTime.ts';
import { Switch } from '../../common/userInteraction/switch.tsx';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { GridContainer } from '../common/container/gridContainer.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';
import { useAccountSettingDriver } from './helpers/accountSettings.tsx';
import { useEnumSetMembershipDriver } from './helpers/settingsInputs.tsx';

const ADVANCED_SETTINGS_CATEGORIES: Record<SettingsAdvancedCategory, {
	name: string;
	warning: ReactNode;
	wait: number;
}> = {
	access_tokens: {
		name: 'Access Tokens',
		warning: (
			<>
				<p>
					Personal Access Tokens are used for giving a tool outside of Pandora limited access to your account.<br />
					This allows external tools to work with your account securely, without a need to share your credentials such as your password (you should <strong>never</strong> give anyone your password).
				</p>
				<p>
					Be aware, that any such tool is unofficial and might do anything with the access you give it.
					What it does might even change over time without your knowledge. Be sure you trust the author of such tool.
					Note, that you are still responsible for your account, which includes actions done by any tool on your behalf, knowingly or not.
				</p>
				<div className='warning-box'>
					Treat access tokens same as passwords — only share them with people or tools you trust and where you want those to use your account!
				</div>
			</>
		),
		wait: 20_000,
	},
};

interface AdvancedSettingsGateProps extends ChildrenProps {
	category: SettingsAdvancedCategory;
}

export function AdvancedSettingsGate({ category, children }: AdvancedSettingsGateProps): ReactElement {
	const { enabledAdvancedSettings } = useAccountSettings();
	const navigate = useNavigatePandora();

	if (!enabledAdvancedSettings.includes(category)) {
		return (
			<Column className='fill' alignX='center' alignY='center'>
				<AdvancedSettingConfirmationDialogContents
					category={ category }
					cancel={ () => {
						navigate('/settings');
					} }
				/>
			</Column>
		);
	}

	return (
		<>{ children }</>
	);
}

export function AdvancedSettingsScreen(): ReactElement {
	const enabledAdvancedSettingsDriver = useAccountSettingDriver('enabledAdvancedSettings');
	const enabledAdvancedSettings = enabledAdvancedSettingsDriver.currentValue ?? enabledAdvancedSettingsDriver.defaultValue;

	const [displayedConfirmation, setDisplayedConfirmation] = useState<SettingsAdvancedCategory | null>(null);

	useEffect(() => {
		if (displayedConfirmation != null && enabledAdvancedSettings.includes(displayedConfirmation)) {
			setDisplayedConfirmation(null);
		}
	}, [displayedConfirmation, enabledAdvancedSettings]);

	return (
		<>
			<fieldset>
				<legend>Advanced settings</legend>
				<Column gap='medium'>
					<h2>These settings are intended for advanced users only</h2>
					<h3>These settings can have various negative consequences when used improperly</h3>
					<GridContainer padding='large' gap='large' alignItemsY='center' templateColumns='auto 1fr' templateRows='auto-flow'>
						{ KnownObject.entries(ADVANCED_SETTINGS_CATEGORIES).map(([category, categoryInfo]) => (
							<>
								<Switch
									checked={ enabledAdvancedSettings.includes(category) }
									label={ categoryInfo.name }
									onChange={ (newValue) => {
										if (newValue) {
											setDisplayedConfirmation(category);
										} else {
											enabledAdvancedSettingsDriver.onChange(enabledAdvancedSettings.filter((s) => s !== category));
										}
									} }
								/>
								<span>{ categoryInfo.name }</span>
							</>
						)) }
					</GridContainer>
				</Column>
			</fieldset>
			{ displayedConfirmation != null ? (
				<ModalDialog>
					<AdvancedSettingConfirmationDialogContents
						category={ displayedConfirmation }
						cancel={ () => {
							setDisplayedConfirmation(null);
						} }
					/>
				</ModalDialog>
			) : null }
		</>
	);
}

interface AdvancedSettingConfirmationDialogContentsProps {
	category: SettingsAdvancedCategory;
	cancel: () => void;
}

function AdvancedSettingConfirmationDialogContents({ category, cancel }: AdvancedSettingConfirmationDialogContentsProps): ReactElement {
	const categoryEnabledDriver = useEnumSetMembershipDriver(useAccountSettingDriver('enabledAdvancedSettings'), category);
	const categoryInfo = ADVANCED_SETTINGS_CATEGORIES[category];

	const [waitDeadline, setWaitDeadline] = useState<number | null>(null);
	const now = useCurrentTime();

	useEffect(() => {
		setWaitDeadline(Date.now() + categoryInfo.wait);
	}, [categoryInfo]);

	return (
		<Column gap='large'>
			<Column className='AdvancedSettings-confirmation-content'>
				<h1>{ categoryInfo.name }</h1>
				{ categoryInfo.warning }
			</Column>
			<div>Are you sure you want to continue?</div>
			<Row alignX='space-between'>
				<Button onClick={ cancel }>
					Leave
				</Button>
				<Button
					onClick={ () => {
						categoryEnabledDriver.onChange(true);
					} }
					theme='danger'
					disabled={ waitDeadline == null || now < waitDeadline }
				>
					I am sure! { waitDeadline == null ? '(…)' : now < waitDeadline ? `(${Math.ceil((waitDeadline - now) / 1000)})` : '' }
				</Button>
			</Row>
		</Column>
	);
}
