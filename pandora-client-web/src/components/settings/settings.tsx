import React, { ReactElement } from 'react';
import './settings.scss';
import { GIT_DESCRIBE } from '../../config/Environment';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs';
import { AccountSettings } from './accountSettings';
import { NotificationSettings } from './notificationSettings';
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
				<UrlTabContainer className='flex-1'>
					<UrlTab name='Permissions' urlChunk='permissions'>
						<SettingsTab element={ PermissionsSettings } />
					</UrlTab>
					<UrlTab name='Character' urlChunk='character'>
						<SettingsTab element={ CharacterSettings } />
					</UrlTab>
					<UrlTab name='Account' urlChunk='account'>
						<SettingsTab element={ AccountSettings } />
					</UrlTab>
					<UrlTab name='Notificaions' urlChunk='norifications'>
						<SettingsTab element={ NotificationSettings } />
					</UrlTab>
					<UrlTab name='Security' urlChunk='security'>
						<SettingsTab element={ SecuritySettings } />
					</UrlTab>
					<UrlTab name='Interface' urlChunk='interface'>
						<SettingsTab element={ InterfaceSettings } />
					</UrlTab>
					<UrlTab name='Graphics' urlChunk='graphics'>
						<SettingsTab element={ GraphicsSettings } />
					</UrlTab>
					<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/') } />
				</UrlTabContainer>
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
