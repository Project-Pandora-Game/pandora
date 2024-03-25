import React, { ReactElement } from 'react';
import './settings.scss';
import { GIT_DESCRIBE } from '../../config/Environment';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { AccountSettings } from './accountSettings';
import { useNavigate } from 'react-router-dom';
import { CharacterSettings } from './characterSettings';
import { GraphicsSettings } from '../../graphics/graphicsSettings';
import { InterfaceSettings } from './interfaceSettings';
import { PermissionsSettings } from './permissionsSettings';
import { SecuritySettings } from './securitySettings';

export function Settings(): ReactElement | null {
	const navigate = useNavigate();

	return (
		<>
			<div className='settings'>
				<TabContainer className='flex-1'>
					<Tab name='Permissions'>
						<SettingsTab element={ PermissionsSettings } />
					</Tab>
					<Tab name='Character'>
						<SettingsTab element={ CharacterSettings } />
					</Tab>
					<Tab name='Account'>
						<SettingsTab element={ AccountSettings } />
					</Tab>
					<Tab name='Security'>
						<SettingsTab element={ SecuritySettings } />
					</Tab>
					<Tab name='Interface'>
						<SettingsTab element={ InterfaceSettings } />
					</Tab>
					<Tab name='Graphics'>
						<SettingsTab element={ GraphicsSettings } />
					</Tab>
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
				</TabContainer>
			</div>
			<footer>Version: { GIT_DESCRIBE }</footer>
		</>
	);
}

function SettingsTab({ element: Element }: { element: () => ReactElement | null; }): ReactElement {
	return (
		<div className='settings-tab'>
			<div className='settings-tab-contents'>
				<Element />
			</div>
		</div>
	);
}
