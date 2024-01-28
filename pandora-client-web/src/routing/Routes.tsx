import { IsAuthorized, IsObject } from 'pandora-common';
import React, { ComponentType, ReactElement, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { Navigate, NavigateOptions, Route, Routes, useLocation } from 'react-router-dom';
import { usePlayerData } from '../components/gameContext/playerContextProvider';
import { Settings } from '../components/settings/settings';
import { CharacterCreate } from '../components/characterCreate/characterCreate';
import { CharacterSelect } from '../components/characterSelect/characterSelect';
import { RoomScreen } from '../ui/screens/room/room';
import { SpaceConfiguration, SpaceCreate } from '../ui/screens/spaceConfiguration/spaceConfiguration';
import { SpacesSearch } from '../ui/screens/spacesSearch/spacesSearch';
import { useAuthTokenIsValid, useCurrentAccount } from '../components/gameContext/directoryConnectorContextProvider';
import { useShardConnector } from '../components/gameContext/shardConnectorContextProvider';
import { AuthPage } from '../components/login/authPage';
import { WardrobeScreen } from '../components/wardrobe/wardrobe';
import { authPagePathsAndComponents } from './authRoutingData';
import { AccountContacts } from '../components/accountContacts/accountContacts';
import { AccountProfileScreenRouter, CharacterProfileScreenRouter } from '../components/profileScreens/profileScreens';
import { Freeze } from 'react-freeze';
import { ModalDialog } from '../components/dialog/dialog';

// Lazily loaded screens
const Management = lazy(() => import('../components/management'));
const Wiki = lazy(() => import('../components/wiki/wiki'));

export function PandoraRoutes(): ReactElement {
	return (
		<Routes>
			<Route path='*' element={ <DefaultFallback /> } />

			{ authPagePathsAndComponents.map(([path, component]) => (
				<Route key={ path } path={ path } element={ <AuthPageFallback component={ component } /> } />
			)) }

			<Route path='/character/select' element={ <RequiresLogin element={ CharacterSelect } /> } />
			<Route path='/character/create' element={ <RequiresCharacter element={ CharacterCreate } allowUnfinished={ true } /> } />

			<Route path='/settings' element={ <RequiresLogin element={ Settings } /> } />

			<Route path='/contacts/*' element={ <RequiresLogin element={ AccountContacts } /> } />
			<Route path='/profiles/account/:accountId' element={ <RequiresLogin element={ AccountProfileScreenRouter } /> } />
			<Route path='/profiles/character/:characterId' element={ <RequiresCharacter element={ CharacterProfileScreenRouter } /> } />

			<Route path='/room' element={ <RequiresCharacter element={ RoomScreen } /> } />
			<Route path='/space/configuration' element={ <RequiresCharacter element={ SpaceConfiguration } /> } />

			<Route path='/spaces/search' element={ <RequiresCharacter element={ SpacesSearch } /> } />
			<Route path='/spaces/create' element={ <RequiresCharacter element={ SpaceCreate } /> } />

			<Route path='/wardrobe' element={ <RequiresCharacter element={ WardrobeScreen } /> } />

			<Route path='/management/*' element={ <RequiresLogin element={ DeveloperRoutes } /> } />

			<Route path='/wiki/*' element={
				<Suspense fallback={ <div>Loading...</div> }>
					<Wiki />
				</Suspense>
			} />
		</Routes>
	);
}

function RequiresLogin<TProps extends object>({ element: Element, preserveLocation = true, ...props }: TProps & {
	element: ComponentType<TProps>;
	preserveLocation?: boolean;
}): ReactElement {
	const isLoggedIn = useCurrentAccount() != null;
	const hasAuthToken = useAuthTokenIsValid();
	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		if (!isLoggedIn && !hasAuthToken) {
			let options: NavigateOptions = {};
			if (preserveLocation) {
				options = { state: { redirectPath: location.pathname, redirectState: location.state as unknown } };
			}
			navigate('/login', options);
		}
	}, [isLoggedIn, hasAuthToken, navigate, location.pathname, location.state, preserveLocation]);

	return (
		<>
			<Freeze freeze={ !isLoggedIn }>
				<Element { ...props as TProps } />
			</Freeze>
			{
				(!isLoggedIn && hasAuthToken) && (
					<ModalDialog>
						<div className='message'>
							Awaiting automatic login...
						</div>
					</ModalDialog>
				)
			}
		</>
	);
}

function RequiresCharacterImpl({ characterElement: Element, allowUnfinished }: { characterElement: ComponentType<Record<string, never>>; allowUnfinished?: boolean; }): ReactElement {
	const shardConnector = useShardConnector();
	const playerData = usePlayerData();
	const hasCharacter = shardConnector != null && playerData != null;

	if (!hasCharacter) {
		return <CharacterSelect />;
	}

	if (playerData.inCreation && !allowUnfinished) {
		return <CharacterCreate />;
	}

	return <Element />;
}

function RequiresCharacter({ element, allowUnfinished }: { element: ComponentType<Record<string, never>>; allowUnfinished?: boolean; }): ReactElement {
	return (
		<RequiresLogin element={ RequiresCharacterImpl } characterElement={ element } preserveLocation={ false } allowUnfinished={ allowUnfinished } />
	);
}

function DefaultFallbackImpl(): ReactElement {
	const playerData = usePlayerData();

	if (playerData == null) {
		return <Navigate to='/character/select' />;
	}

	return <Navigate to='/room' />;
}

function DefaultFallback(): ReactElement {
	return (
		<RequiresLogin element={ DefaultFallbackImpl } preserveLocation={ false } />
	);
}

function AuthPageFallback({ component }: { component: ComponentType<Record<string, never>>; }): ReactElement {
	const isLoggedIn = useCurrentAccount() != null;
	const state: unknown = useLocation().state;

	if (isLoggedIn) {
		const { path: redirectPath, state: redirectState } = GetDefaultNavigation(state);
		return <Navigate to={ redirectPath } state={ redirectState } />;
	}

	return <AuthPage component={ component } />;
}

function GetDefaultNavigation(state?: unknown): {
	path: string;
	state: unknown;
} {
	if (IsObject(state) && typeof state.redirectPath === 'string') {
		return {
			path: state.redirectPath,
			state: state.redirectState,
		};
	}

	return {
		path: '/',
		state: undefined,
	};
}

function DeveloperRoutes(): ReactElement {
	const account = useCurrentAccount();
	const isDeveloper = account?.roles !== undefined && IsAuthorized(account.roles, 'developer');

	if (!isDeveloper) {
		return <Navigate to='/' />;
	}

	return (
		<Suspense fallback={ <div>Loading...</div> }>
			<Management />
		</Suspense>
	);
}
