import { Suspense, useEffect, useState, type ReactElement } from 'react';
import { MemoryRouter, Navigate, Route, Routes, UNSAFE_LocationContext, useLocation } from 'react-router';
import closeIcon from '../../assets/icons/cross.svg';
import type { ChildrenProps } from '../../common/reactTypes.ts';
import { CharacterRestrictionOverrideDialogContext } from '../../components/characterRestrictionOverride/characterRestrictionOverride.tsx';
import { Button, IconButton } from '../../components/common/button/button.tsx';
import { Column } from '../../components/common/container/container.tsx';
import { ModalDialog } from '../../components/dialog/dialog.tsx';
import { LocalErrorBoundary } from '../../components/error/localErrorBoundary.tsx';
import { useGameStateOptional } from '../../components/gameContext/gameStateContextProvider.tsx';
import { Header } from '../../components/header/Header.tsx';
import { Settings } from '../../components/settings/settings.tsx';
import { WardrobeRouter } from '../../components/wardrobe/wardrobe.tsx';
import Wiki from '../../components/wiki/wiki.tsx';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useGameLogicServiceManager } from '../../services/serviceProvider.tsx';
import { ChatInputContextProvider } from '../../ui/components/chat/chatInput.tsx';
import { RoomScreen } from '../../ui/screens/room/room.tsx';
import { RoomItemDialogsProvider } from '../../ui/screens/room/roomItemDialog.tsx';
import './pandoraEditorInstance.scss';

export function PandoraInnerInstanceDriver(): ReactElement {
	const [open, setOpen] = useState(false);

	return (
		<div className='editor-setupui'>
			<h3>Simulated Pandora instance</h3>
			<div>This tab will create a stripped-down Pandora instance, simulating normal behavior.</div>
			<div className='warning-box'>
				This feature is highly experimental. Do not expect everything to work smoothly.
			</div>
			<Button onClick={ () => {
				setOpen(true);
			} }>
				Open Pandora
			</Button>
			{ open ? (
				<PandoraEditorInstance
					close={ () => {
						setOpen(false);
					} }
				/>
			) : null }
		</div>
	);
}

/** This component creates a fake Pandora instance within the Editor, attempting to be as close to the real one as possible. */
export function PandoraEditorInstance({ close }: {
	close: () => void;
}): ReactElement {
	return (
		<ModalDialog priority={ -1 } className='PandoraEditorInstance' contentOverflow='clip'>
			<IconButton
				className='PandoraEditorInstanceCloseButton'
				src={ closeIcon }
				alt='Close'
				onClick={ close }
				slim
			/>
			<LocalErrorBoundary>
				{ /* eslint-disable-next-line @stylistic/jsx-pascal-case */ }
				<UNSAFE_LocationContext.Provider value={ null! }>
					<MemoryRouter basename='/'>
						<Column className='fill' gap='none'>
							<PandoraEditorInstanceRoot />
						</Column>
					</MemoryRouter>
				</UNSAFE_LocationContext.Provider>
			</LocalErrorBoundary>
		</ModalDialog>
	);
}

function PandoraEditorInstanceRoot(): ReactElement | null {
	const location = useLocation();
	const gameLogic = useGameLogicServiceManager();

	if (gameLogic == null)
		return null;

	return (
		<>
			<div className='PandoraEditorInstanceLocation'>{ location.pathname }{ location.search }{ location.hash }</div>
			<div className='flex-1'>
				<div className='PandoraEditorInstanceRoot'>
					<PandoraEditorInstanceContextProvider>
						<Header />
						<div className='main-container'>
							<div className='main'>
								<PandoraEditorInstanceRoutes />
							</div>
						</div>
					</PandoraEditorInstanceContextProvider>
				</div>
			</div>
		</>
	);
}

function PandoraEditorInstanceContextProvider({ children }: ChildrenProps): ReactElement {
	return (
		<ChatInputContextProvider>
			<PandoraEditorInstanceMiscProviders>
				{ children }
			</PandoraEditorInstanceMiscProviders>
		</ChatInputContextProvider>
	);
}

function PandoraEditorInstanceMiscProviders({ children }: ChildrenProps): ReactElement {
	return (
		<CharacterRestrictionOverrideDialogContext>
			<EditorGameStateContextProvider />
			<RoomItemDialogsProvider />
			{ children }
		</CharacterRestrictionOverrideDialogContext>
	);
}

function EditorGameStateContextProvider(): null {
	const navigate = useNavigatePandora();
	const gameState = useGameStateOptional();

	useEffect(() => {
		return gameState?.on('uiNavigate', (target) => {
			navigate(target);
		});
	}, [gameState, navigate]);

	return null;
}

function PandoraEditorInstanceRoutes(): ReactElement {
	return (
		<Routes>
			<Route path='/settings/*' element={ <Settings /> } />
			<Route path='/room' element={ <RoomScreen /> } />
			<Route path='/wardrobe/*' element={ <WardrobeRouter /> } />

			<Route path='/wiki/*' element={
				<Suspense fallback={ <div>Loading...</div> }>
					<Wiki />
				</Suspense>
			} />

			<Route path='/' element={ <Navigate to='/room' /> } />
			<Route path='*' element={ <PandoraEditorInstanceRoutesFallback /> } />
		</Routes>
	);
}

function PandoraEditorInstanceRoutesFallback(): ReactElement {
	const navigate = useNavigatePandora();

	return (
		<Column alignX='center'>
			<div className='warning-box'>
				Whoops! Seems like you opened a page that is not supported in this mode.<br />
				This is intentional - Editor runs extremely striped down version of Pandora without most features.<br />
				Its only purpose is to help with asset development.
			</div>
			<Button
				onClick={ () => {
					navigate('/room');
				} }
			>
				◄ Back to room
			</Button>
		</Column>
	);

}
