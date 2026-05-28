import { FormatTimeInterval, IsAuthorized, IsObject } from 'pandora-common';
import React, { ComponentType, lazy, ReactElement, Suspense, useEffect } from 'react';
import { Navigate, NavigateOptions, Route, Routes, useLocation } from 'react-router';
import { LoadIndicator } from '../components/LoadIndicator/LoadIndicator.tsx';
import { AccountContacts } from '../components/accountContacts/accountContacts.tsx';
import { CharacterCreate } from '../components/characterCreate/characterCreate.tsx';
import { CharacterSelect } from '../components/characterSelect/characterSelect.tsx';
import { Button } from '../components/common/button/button.tsx';
import { Column, DivContainer, Row } from '../components/common/container/container.tsx';
import { ModalDialog } from '../components/dialog/dialog.tsx';
import { useAuthTokenIsValid, useDirectoryConnector } from '../components/gameContext/directoryConnectorContextProvider.tsx';
import { usePlayerData } from '../components/gameContext/playerContextProvider.tsx';
import { useShardConnector } from '../components/gameContext/shardConnectorContextProvider.tsx';
import { AuthPage } from '../components/login/authPage.tsx';
import { AccountProfileScreenRouter, CharacterProfileScreenRouter } from '../components/profileScreens/profileScreens.tsx';
import { ExtendCurrentSessionDialog } from '../components/settings/securitySettings.tsx';
import { Settings } from '../components/settings/settings.tsx';
import { WardrobeRouter } from '../components/wardrobe/wardrobe.tsx';
import { ShardConnectionState } from '../networking/shardConnector.ts';
import { useNullableObservable, useObservable } from '../observable.ts';
import { useCurrentAccount } from '../services/accountLogic/accountManagerHooks.ts';
import { useGameStateOptional } from '../services/gameLogic/gameStateHooks.ts';
import { useService } from '../services/serviceProvider.tsx';
import { Freeze } from '../ui/components/common/freeze.tsx';
import { RoomScreen } from '../ui/screens/room/room.tsx';
import { SpaceConfiguration, SpaceCreate } from '../ui/screens/spaceConfiguration/spaceConfiguration.tsx';
import { SpaceJoin } from '../ui/screens/spaceJoin/spaceJoin.tsx';
import { PublicSpaceSearch } from '../ui/screens/spacesSearch/publicSpaceSearch.tsx';
import { SpacesSearch } from '../ui/screens/spacesSearch/spacesSearch.tsx';
import { authPagePathsAndComponents } from './authRoutingData.ts';
import { useNavigatePandora } from './navigate.ts';

let autoLoginModalShown = false;

// Lazily loaded screens
const Management = lazy(() => import('../components/management/index.tsx'));
const Wiki = lazy(() => import('../components/wiki/wiki.tsx'));

export function PandoraRoutes(): ReactElement {
	return (
		<Routes>
			{ authPagePathsAndComponents.map(([path, component]) => (
				<Route key={ path } path={ path } element={ <AuthPageFallback component={ component } /> } />
			)) }

			<Route path='/character/select' element={ <RequiresLogin element={ CharacterSelect } /> } />
			<Route path='/character/create' element={ <RequiresCharacter element={ CharacterCreate } allowUnfinished /> } />

			<Route path='/settings/*' element={ <RequiresLogin element={ Settings } /> } />

			<Route path='/contacts/*' element={ <RequiresLogin element={ AccountContacts } /> } />
			<Route path='/profiles/account/:accountId' element={ <RequiresLogin element={ AccountProfileScreenRouter } /> } />
			<Route path='/profiles/character/:characterId/*' element={ <RequiresCharacter element={ CharacterProfileScreenRouter } /> } />

			<Route path='/room' element={ <RequiresCharacter element={ RoomScreen } /> } />
			<Route path='/space/configuration' element={ <RequiresCharacter element={ SpaceConfiguration } /> } />
			<Route path='/space/join/:spaceId' element={ <RequiresCharacter element={ SpaceJoin } /> } />

			<Route path='/spaces/search' element={ <RequiresCharacter element={ SpacesSearch } /> } />
			<Route path='/spaces/public/search' element={ <RequiresLogin element={ PublicSpaceSearch } /> } />
			<Route path='/spaces/create' element={ <RequiresCharacter element={ SpaceCreate } /> } />

			<Route path='/wardrobe/*' element={ <RequiresCharacter element={ WardrobeRouter } /> } />

			<Route path='/management/*' element={ <RequiresLogin element={ DeveloperRoutes } /> } />

			<Route path='/wiki/*' element={
				<Suspense fallback={ <div>Loading...</div> }>
					<Wiki />
				</Suspense>
			} />

			<Route path='*' element={ <DefaultFallback /> } />
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
	const navigate = useNavigatePandora();
	const directoryConnector = useDirectoryConnector();
	const authToken = useObservable(directoryConnector.authToken);
	const [showExpiryWarning, setShowExpiryWarning] = React.useState(false);

	useEffect(() => {
		if (!isLoggedIn && !hasAuthToken) {
			let path = '/login';
			let options: NavigateOptions = {};
			if (preserveLocation) {
				path = `/login?${new URLSearchParams({ redirect: location.pathname }).toString()}`;
				options = { state: { redirectState: location.state as unknown } };
			}
			navigate(path, options);
		} else if (isLoggedIn && !autoLoginModalShown && authToken != null) {
			const timeLeft = authToken.expires - Date.now();
			const underTwentyFourHours = timeLeft < 24 * 60 * 60 * 1000;
			autoLoginModalShown = true;
			if (underTwentyFourHours) {
				setShowExpiryWarning(true);
			}
		}
	}, [isLoggedIn, hasAuthToken, authToken, navigate, location.pathname, location.state, preserveLocation]);

	return (
		<>
			{ showExpiryWarning && <SessionExpiryWarningDialog onClose={ () => setShowExpiryWarning(false) } /> }
			<Freeze freeze={ !isLoggedIn }>
				<Element { ...props as TProps } />
			</Freeze>
			{
				(!isLoggedIn && hasAuthToken) && (
					<DivContainer align='center' justify='center'>
						<LoadIndicator>
							Awaiting automatic login...
						</LoadIndicator>
					</DivContainer>
				)
			}
		</>
	);
}

function SessionExpiryWarningDialog({ onClose }: { onClose: () => void; }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const authToken = useObservable(directoryConnector.authToken);
	const [showExtend, setShowExtend] = React.useState(false);

	if (!authToken) {
		return <Navigate to='/' />;
	}

	const timeLeft = authToken.expires - Date.now();

	const hide = () => {
		onClose();
		return true;
	};

	if (showExtend) {
		return <ExtendCurrentSessionDialog token={ authToken } hide={ hide } />;
	}

	return (
		<ModalDialog>
			<Column>
				<h3>Auto-login notice</h3>
				<p>
					Your session will expire in { FormatTimeInterval(timeLeft, 'two-most-significant') }.<br />
					You will be automatically logged out at that point.
				</p>
				<Row alignX='space-between'>
					<Button onClick={ hide }>Ignore</Button>
					<Button onClick={ () => setShowExtend(true) }>Extend with password</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}

function RequiresCharacterImpl({ characterElement: Element, allowUnfinished }: { characterElement: ComponentType<Record<string, never>>; allowUnfinished?: boolean; }): ReactElement {
	const shardConnector = useShardConnector();
	const lastSelectedCharacter = useObservable(useService('accountManager').lastSelectedCharacter);
	const playerData = usePlayerData();
	const hasCharacter = shardConnector != null && playerData != null;

	if (!hasCharacter && lastSelectedCharacter == null) {
		return <CharacterSelect />;
	}

	if (playerData?.inCreation && !allowUnfinished) {
		return <CharacterCreate />;
	}

	return (
		<>
			<Freeze freeze={ !hasCharacter }>
				<Element />
			</Freeze>
			{
				!hasCharacter && (
					<DivContainer align='center' justify='center'>
						<LoadIndicator>
							<CharacterAutoConnectState />
						</LoadIndicator>
					</DivContainer>
				)
			}
		</>
	);
}

function CharacterAutoConnectState(): ReactElement {
	const shardConnector = useShardConnector();
	const shardState = useNullableObservable(shardConnector?.state);
	const gameState = useGameStateOptional();

	if (shardState == null || shardState === ShardConnectionState.NONE) {
		return <>Requesting character load...</>;
	}

	if (shardState === ShardConnectionState.INITIAL_CONNECTION_PENDING || shardState === ShardConnectionState.CONNECTION_LOST) {
		return <>Connecting to Shard...</>;
	}

	if (shardState === ShardConnectionState.WAIT_FOR_DATA || gameState == null) {
		return <>Loading character data...</>;
	}

	return <>Connected.</>;
}

function RequiresCharacter({ element, allowUnfinished }: { element: ComponentType<Record<string, never>>; allowUnfinished?: boolean; }): ReactElement {
	return (
		<RequiresLogin element={ RequiresCharacterImpl } characterElement={ element } allowUnfinished={ allowUnfinished } />
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
	const location = useLocation();

	if (isLoggedIn) {
		const param = new URLSearchParams(location.search);
		let state: unknown;
		if (IsObject(location.state) && 'redirectState' in location.state) {
			state = location.state.redirectState;
		}
		return <Navigate to={ param.get('redirect') ?? '/' } state={ state } />;
	}

	return <AuthPage component={ component } />;
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
