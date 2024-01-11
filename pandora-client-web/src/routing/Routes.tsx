import { IsAuthorized, IsObject } from 'pandora-common';
import React, { ComponentType, ReactElement, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { Navigate, NavigateOptions, Route, Routes, useLocation } from 'react-router-dom';
import { usePlayerData } from '../components/gameContext/playerContextProvider';
import { Settings } from '../components/settings/settings';
import { CharacterCreate } from '../components/characterCreate/characterCreate';
import { CharacterSelect } from '../components/characterSelect/characterSelect';
import { Chatroom } from '../ui/screens/room/room';
import { ChatroomAdmin, ChatroomCreate } from '../ui/screens/spaceConfiguration/spaceConfiguration';
import { ChatroomSelect } from '../ui/screens/spacesSearch/spacesSearch';
import { useCurrentAccount } from '../components/gameContext/directoryConnectorContextProvider';
import { useShardConnector } from '../components/gameContext/shardConnectorContextProvider';
import { AuthPage } from '../components/login/authPage';
import { WardrobeScreen } from '../components/wardrobe/wardrobe';
import { authPagePathsAndComponents } from './authRoutingData';
import { AccountContacts } from '../components/accountContacts/accountContacts';
import { Wiki } from '../components/wiki/wiki';
import { AccountProfileScreenRouter, CharacterProfileScreenRouter } from '../components/profileScreens/profileScreens';

export function PandoraRoutes(): ReactElement {
	return (
		<Routes>
			<Route path='*' element={ <DefaultFallback /> } />

			{ authPagePathsAndComponents.map(([path, component]) => (
				<Route key={ path } path={ path } element={ <AuthPageFallback component={ component } /> } />
			)) }

			<Route path='/character_select' element={ <RequiresLogin element={ CharacterSelect } /> } />
			<Route path='/character_create' element={ <RequiresCharacter element={ CharacterCreate } allowUnfinished={ true } /> } />

			<Route path='/settings' element={ <RequiresLogin element={ Settings } /> } />

			<Route path='/contacts/*' element={ <RequiresLogin element={ AccountContacts } /> } />
			<Route path='/profiles/account/:accountId' element={ <RequiresLogin element={ AccountProfileScreenRouter } /> } />
			<Route path='/profiles/character/:characterId' element={ <RequiresCharacter element={ CharacterProfileScreenRouter } /> } />

			<Route path='/chatroom' element={ <RequiresCharacter element={ Chatroom } /> } />
			<Route path='/chatroom_select' element={ <RequiresCharacter element={ ChatroomSelect } /> } />
			<Route path='/chatroom_create' element={ <RequiresCharacter element={ ChatroomCreate } /> } />
			<Route path='/chatroom_admin' element={ <RequiresCharacter element={ ChatroomAdmin } /> } />

			<Route path='/wardrobe' element={ <RequiresCharacter element={ WardrobeScreen } /> } />

			<Route path='/management/*' element={ <RequiresLogin element={ DeveloperRoutes } /> } />

			<Route path='/wiki/*' element={ <Wiki /> } />
		</Routes>
	);
}

function RequiresLogin({ element: Element }: { element: ComponentType<Record<string, never>>; }): ReactElement {
	useLoggedInCheck();
	return <Element />;
}

function RequiresCharacter({ element: Element, allowUnfinished }: { element: ComponentType<Record<string, never>>; allowUnfinished?: boolean; }): ReactElement {
	useLoggedInCheck();
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

function DefaultFallback(): ReactElement {
	useLoggedInCheck(false);
	const playerData = usePlayerData();

	if (playerData == null) {
		return <Navigate to='/character_select' />;
	}

	return <Navigate to='/chatroom' />;
}

function useLoggedInCheck(preserveLocation = true): void {
	const isLoggedIn = useCurrentAccount() != null;
	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		if (!isLoggedIn) {
			let options: NavigateOptions = {};
			if (preserveLocation) {
				options = { state: { redirectPath: location.pathname, redirectState: location.state as unknown } };
			}
			navigate('/login', options);
		}
	}, [isLoggedIn, navigate, location.pathname, location.state, preserveLocation]);
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

const Management = lazy(() => import('../components/management'));
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
