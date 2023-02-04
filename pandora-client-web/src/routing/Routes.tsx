import { IsAuthorized } from 'pandora-common';
import React, { ComponentType, ReactElement, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { Navigate, NavigateOptions, Route, Routes, useLocation } from 'react-router-dom';
import { usePlayerData } from '../components/gameContext/playerContextProvider';
import { Settings } from '../components/settings/settings';
import { CharacterCreate } from '../components/characterCreate/characterCreate';
import { CharacterSelect } from '../components/characterSelect/characterSelect';
import { Chatroom } from '../components/chatroom/chatroom';
import { ChatroomAdmin, ChatroomCreate } from '../components/chatroomAdmin/chatroomAdmin';
import { ChatroomSelect } from '../components/chatroomSelect/chatroomSelect';
import { useCurrentAccount } from '../components/gameContext/directoryConnectorContextProvider';
import { useShardConnector } from '../components/gameContext/shardConnectorContextProvider';
import { AuthPage } from '../components/login/authPage';
import { PandoraLobby } from '../components/pandoraLobby/pandoraLobby';
import { WardrobeScreen } from '../components/wardrobe/wardrobe';
import { authPagePathsAndComponents } from './authRoutingData';
import { DirectMessages } from '../components/directMessages/directMessages';

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
			<Route path='/direct_messages' element={ <RequiresLogin element={ DirectMessages } /> } />
			<Route path='/pandora_lobby' element={ <RequiresCharacter element={ PandoraLobby } /> } />
			<Route path='/chatroom_select' element={ <RequiresCharacter element={ ChatroomSelect } /> } />
			<Route path='/chatroom_create' element={ <RequiresCharacter element={ ChatroomCreate } /> } />
			<Route path='/chatroom' element={ <RequiresCharacter element={ Chatroom } /> } />
			<Route path='/chatroom_admin' element={ <RequiresCharacter element={ ChatroomAdmin } /> } />
			<Route path='/wardrobe' element={ <RequiresCharacter element={ WardrobeScreen } /> } />
			<Route path='/management/*' element={ <RequiresLogin element={ DeveloperRoutes } /> } />
		</Routes>
	);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function RequiresLogin({ element: Element }: { element: ComponentType<Record<string, never>> }): ReactElement {
	useLoggedInCheck();
	return <Element />;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function RequiresCharacter({ element: Element, allowUnfinished }: { element: ComponentType<Record<string, never>>; allowUnfinished?: boolean }): ReactElement {
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
	return <Navigate to='/character_select' />;
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

function AuthPageFallback({ component }: { component: ComponentType<Record<string, never>> }): ReactElement {
	const isLoggedIn = useCurrentAccount() != null;
	const navigate = useNavigate();

	useEffect(() => {
		if (isLoggedIn) {
			navigate('/');
		}
	}, [isLoggedIn, navigate]);

	return <AuthPage component={ component } />;
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
