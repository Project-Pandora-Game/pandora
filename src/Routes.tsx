import React, { ReactElement } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { Login } from './components/login/login';
import { Registration } from './components/login/registration';
import { ForgotPassword } from './components/login/forgotPassword';
import { ResetPassword } from './components/login/resetPassword';
import { ResendVerificationEmail } from './components/login/resendVerificationEmail';
import { useBrowserStorage } from './browserStorage';
import { Eula } from './components/Eula';
import { useObservable } from './observable';
import { currentAccount } from './networking/account_manager';
import { CharacterSelect } from './components/characterSelect/characterSelect';
import { CharacterCreate } from './components/characterCreate/characterCreate';
import { PandoraLobby } from './components/pandoraLobby/pandoraLobby';
import { ShardConnector } from './networking/socketio_shard_connector';
import { ChatroomSelect } from './components/chatroomSelect/chatroomSelect';
import { Chatroom } from './components/chatroom/chatroom';
import { ChatroomAdmin, ChatroomCreate } from './components/chatroomAdmin/chatroomAdmin';
import { usePlayerData } from './character/player';
import { WardrobeScreen } from './components/wardrobe/wardrobe';

export function PandoraRoutes(): ReactElement {
	const isLoggedIn = useObservable(currentAccount) != null;

	const [eula, setEula] = useBrowserStorage('eula', false);

	if (!eula)
		return <Eula accept={ () => setEula(true) } />;

	return (
		<Routes>
			<Route path='*' element={ <DefaultFallback /> } />

			<Route path='/login' element={ <Fallback element={ Login } render={ !isLoggedIn }  /> } />
			<Route path='/register' element={ <Fallback element={ Registration } render={ !isLoggedIn }  /> } />
			<Route path='/forgot_password' element={ <Fallback element={ ForgotPassword } render={ !isLoggedIn }  /> } />
			<Route path='/reset_password' element={ <Fallback element={ ResetPassword } render={ !isLoggedIn }  /> } />
			<Route path='/resend_verification_email' element={ <Fallback element={ ResendVerificationEmail } render={ !isLoggedIn } /> } />

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
function RequiresLogin({ element: Element }: { element: () => ReactElement | null }): ReactElement {
	const isLoggedIn = useObservable(currentAccount) != null;

	if (!isLoggedIn) {
		return <Login />;
	}

	return <Element />;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function RequiresCharacter({ element: Element, allowUnfinished }: { element: () => ReactElement | null; allowUnfinished?: boolean; }): ReactElement {
	const isLoggedIn = useObservable(currentAccount) != null;
	const shardConnector = useObservable(ShardConnector);
	const playerData = usePlayerData();
	const hasCharacter = shardConnector != null && playerData != null;

	if (!isLoggedIn) {
		return <Login />;
	}

	if (!hasCharacter) {
		return <CharacterSelect />;
	}

	if (playerData.inCreation && !allowUnfinished) {
		return <CharacterCreate />;
	}

	return <Element />;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function Fallback({ element: Element, render }: { element: () => ReactElement | null, render: boolean }): ReactElement {
	if (!render) {
		return <Navigate to={ '/' } />;
	}

	return <Element />;
}

function DefaultFallback(): ReactElement {
	const isLoggedIn = currentAccount.value != null;
	if (isLoggedIn)
		return <Navigate to={ '/character_select' } />;

	return <Navigate to={ '/login' } />;
}
