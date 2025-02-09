import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { GIT_DESCRIBE } from '../../config/Environment';
import { Tab, UrlTab, UrlTabContainer } from '../common/tabs/tabs';
import { AccountSettings } from './accountSettings';
import { CharacterSettings } from './characterSettings';
import { GraphicsSettings } from './graphicsSettings';
import { InterfaceSettings } from './interfaceSettings';
import { NotificationSettings } from './notificationSettings';
import { PermissionsSettings } from './permissionsSettings';
import { SecuritySettings } from './securitySettings';
import './settings.scss';

export function Settings(): ReactElement | null {
	const navigate = useNavigate();

	return (
		<>
			<div className='settings'>
				<UrlTabContainer className='flex-1' allowWrap>
					<UrlTab name='Permissions' urlChunk='permissions'>
						<SettingsTab element={ PermissionsSettings } />
					</UrlTab>
					<UrlTab name='Character' urlChunk='character'>
						<SettingsTab element={ CharacterSettings } />
					</UrlTab>
					<UrlTab name='Account' urlChunk='account'>
						<SettingsTab element={ AccountSettings } />
					</UrlTab>
					<UrlTab name='Notifications' urlChunk='notifications'>
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
		<div className='settings-tab-wrapper'>
			<div className='settings-tab'>
				<div className='settings-tab-contents'>
					<Element />
				</div>
			</div>
		</div>
	);
}
