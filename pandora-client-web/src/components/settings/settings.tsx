import { ParseNotNullable } from 'pandora-common';
import { ReactElement } from 'react';
import { matchPath, Navigate, resolvePath, Route, Routes, useLocation } from 'react-router';
import iconAccessibility from '../../assets/icons/accessibility.svg';
import iconAccount from '../../assets/icons/account.svg';
import iconColor from '../../assets/icons/color.svg';
import iconClose from '../../assets/icons/cross.svg';
import iconInterface from '../../assets/icons/interface.svg';
import iconLock from '../../assets/icons/lock.svg';
import iconModificationEdit from '../../assets/icons/modification-edit.svg';
import iconModificationLock from '../../assets/icons/modification-lock.svg';
import iconNotification from '../../assets/icons/notification.svg';
import { BUILD_TIME, GIT_DESCRIBE } from '../../config/Environment.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useRoutingParentPath } from '../../routing/routingUtils.ts';
import { useIsNarrowScreen } from '../../styles/mediaQueries.ts';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { usePlayer } from '../gameContext/playerContextProvider.tsx';
import { AccessibilitySettings } from './accessibilitySettings.tsx';
import { AccountSettings } from './accountSettings.tsx';
import { CharacterSettings } from './characterSettings.tsx';
import { GraphicsSettings } from './graphicsSettings.tsx';
import { InterfaceSettings } from './interfaceSettings.tsx';
import { NotificationSettings } from './notificationSettings.tsx';
import { PermissionsSettings } from './permissionsSettings.tsx';
import { SecuritySettings } from './securitySettings.tsx';
import './settings.scss';

const SETTINGS_PAGES_SETUP = {
	permissions: {
		name: 'Permissions',
		image: iconModificationLock,
		element: PermissionsSettings,
		requiresCharacter: true,
	},
	character: {
		name: 'Character',
		image: iconModificationEdit,
		element: CharacterSettings,
		requiresCharacter: true,
	},
	account: {
		name: 'Account',
		image: iconAccount,
		element: AccountSettings,
	},
	notifications: {
		name: 'Notifications',
		image: iconNotification,
		element: NotificationSettings,
	},
	security: {
		name: 'Security',
		image: iconLock,
		element: SecuritySettings,
	},
	interface: {
		name: 'Interface',
		image: iconInterface,
		element: InterfaceSettings,
	},
	graphics: {
		name: 'Graphics',
		image: iconColor,
		element: GraphicsSettings,
	},
	accessibility: {
		name: 'Accessibility',
		image: iconAccessibility,
		element: AccessibilitySettings,
	},
} as const satisfies Readonly<Record<string, { name: string; image: string; element: () => ReactElement | null; requiresCharacter?: boolean; }>>;

const SETTINGS_PAGES: Readonly<Record<keyof typeof SETTINGS_PAGES_SETUP, { name: string; image: string; element: () => ReactElement | null; requiresCharacter?: boolean; }>> = SETTINGS_PAGES_SETUP;

export function Settings(): ReactElement | null {
	const { pathnameBase } = useRoutingParentPath();
	const { pathname } = useLocation();
	const navigate = useNavigatePandora();
	const isNarrowScreen = useIsNarrowScreen();
	const hasCharacter = usePlayer() != null;

	const selectionButtons = Object.entries(SETTINGS_PAGES).map(([page, pageConfig]) => {
		const path = resolvePath(page, pathnameBase).pathname;
		const active = matchPath({ path: path + '/*' }, pathname) != null;

		return (
			<Button key={ page }
				className='align-start IconButton'
				theme={ active ? 'defaultActive' : 'default' }
				disabled={ pageConfig.requiresCharacter && !hasCharacter }
				onClick={ () => {
					navigate(path);
				} }
			>
				{ pageConfig.image ? (
					<>
						<img src={ pageConfig.image } />
						{ ' ' }
					</>
				) : null }
				{ pageConfig.name }
			</Button>
		);
	});

	return (
		<>
			<div className='settings'>
				<Row className='fill-x' gap='none'>
					{ !isNarrowScreen ? (
						<Column className='page-list left-list' padding='medium'>
							{ selectionButtons }
						</Column>
					) : null }
					<Column className='flex-1 fit' gap='none'>
						<Row padding='small' alignX='end' alignY='center'>
							<Routes>
								{ Object.keys(SETTINGS_PAGES).map((page) => (
									<Route
										key={ page }
										path={ page + '/*' }
										element={ isNarrowScreen ? (
											<Button className='half-slim' onClick={ () => {
												navigate(pathnameBase);
											} }>
												◄ Back
											</Button>
										) : null }
									/>
								)) }
								<Route
									path='*'
									element={ null }
								/>
							</Routes>
							<Button className='half-slim' onClick={ () => {
								navigate('/');
							} }>
								<img src={ iconClose } />{ ' ' }Close
							</Button>
						</Row>
						<Routes>
							{ Object.entries(SETTINGS_PAGES).map(([page, pageConfig]) => (
								<Route
									key={ page }
									path={ page + '/*' }
									element={ (
										<SettingsTab element={ pageConfig.element } />
									) }
								/>
							)) }
							<Route
								path='*'
								element={ isNarrowScreen ? (
									<Column className='fill page-list' alignX='center' alignY='start' padding='medium'>
										{ selectionButtons }
									</Column>
								) : (
									// In wide mode open first available page by default
									<Navigate to={ `/settings/${ParseNotNullable(Object.entries(SETTINGS_PAGES).find(([,config]) => !config.requiresCharacter || hasCharacter))[0]}` } replace />
								) }
							/>
						</Routes>
					</Column>
				</Row>
			</div>
			<footer>Version: { GIT_DESCRIBE } from { new Date(BUILD_TIME).toLocaleDateString() }</footer>
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
