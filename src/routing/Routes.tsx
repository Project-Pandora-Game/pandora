import React, { ComponentType, ReactElement, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Navigate, NavigateOptions, Route, Routes, useLocation } from 'react-router-dom';
import { useBrowserStorage } from '../browserStorage';
import { usePlayerData } from '../character/player';
import { CharacterCreate } from '../components/characterCreate/characterCreate';
import { CharacterSelect } from '../components/characterSelect/characterSelect';
import { Chatroom } from '../components/chatroom/chatroom';
import { ChatroomAdmin, ChatroomCreate } from '../components/chatroomAdmin/chatroomAdmin';
import { ChatroomSelect } from '../components/chatroomSelect/chatroomSelect';
import { Eula } from '../components/Eula';
import { AuthPage } from '../components/login/authPage';
import { PandoraLobby } from '../components/pandoraLobby/pandoraLobby';
import { WardrobeScreen } from '../components/wardrobe/wardrobe';
import { currentAccount } from '../networking/account_manager';
import { ShardConnector } from '../networking/socketio_shard_connector';
import { useObservable } from '../observable';
import { authPagePathsAndComponents } from './authRoutingData';

export function PandoraRoutes(): ReactElement {
	const [eula, setEula] = useBrowserStorage('eula', false);

	if (!eula)
		return <Eula accept={ () => setEula(true) } />;

	return (
		<Routes>
			<Route path='*' element={ <DefaultFallback /> } />

			{ authPagePathsAndComponents.map(([path, component]) => (
				<Route key={ path } path={ path } element={ <AuthPageFallback component={ component } /> } />
			)) }

			<Route path='/character_select' element={ <RequiresLogin element={ CharacterSelect } /> } />
			<Route path='/character_create' element={ <RequiresCharacter element={ CharacterCreate } allowUnfinished={ true } /> } />
			<Route path='/pandora_lobby' element={ <RequiresCharacter element={ PandoraLobby } /> } />
			<Route path='/chatroom_select' element={ <RequiresCharacter element={ ChatroomSelect } /> } />
			<Route path='/chatroom_create' element={ <RequiresCharacter element={ ChatroomCreate } /> } />
			<Route path='/chatroom' element={ <RequiresCharacter element={ Chatroom } /> } />
			<Route path='/chatroom_admin' element={ <RequiresCharacter element={ ChatroomAdmin } /> } />
			<Route path='/wardrobe' element={ <RequiresCharacter element={ WardrobeScreen } /> } />
		</Routes>
	);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function RequiresLogin({ element: Element }: { element: ComponentType<Record<string, never>> }): ReactElement {
	useLoggedInCheck();
	return <Element />;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function RequiresCharacter({ element: Element, allowUnfinished }: { element: ComponentType<Record<string, never>>; allowUnfinished?: boolean; }): ReactElement {
	useLoggedInCheck();
	const shardConnector = useObservable(ShardConnector);
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
	const isLoggedIn = useObservable(currentAccount) != null;
	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		if (!isLoggedIn) {
			let options: NavigateOptions = {};
			if (preserveLocation) {
				options = { state: { redirectPath: location.pathname, redirectState: location.state } };
			}
			navigate('/login', options);
		}
	}, [isLoggedIn, navigate, location.pathname, location.state, preserveLocation]);
}

function AuthPageFallback({ component }: { component: ComponentType<Record<string, never>> }): ReactElement {
	const isLoggedIn = useObservable(currentAccount) != null;
	const navigate = useNavigate();

	useEffect(() => {
		if (isLoggedIn) {
			navigate('/');
		}
	}, [isLoggedIn, navigate]);

	return <AuthPage component={ component } />;
}
