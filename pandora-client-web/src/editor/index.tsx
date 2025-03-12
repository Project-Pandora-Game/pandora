import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css' with { type: 'css' };
import { GraphicsManager } from '../assets/graphicsManager.ts';
import { useEvent } from '../common/useEvent.ts';
import { EulaGate } from '../components/Eula/index.tsx';
import { Button } from '../components/common/button/button.tsx';
import { NODE_ENV, USER_DEBUG } from '../config/Environment.ts';
import { LoadSearchArgs } from '../config/searchArgs.ts';
import { ConfigurePixiSettings } from '../graphics/pixiSettings.ts';
import '../index.scss';
import { TOAST_OPTIONS_ERROR } from '../persistentToast.ts';
import { ScreenResolutionSerice } from '../services/screenResolution/screenResolution.ts';
import '../styles/fonts.scss';
import '../styles/globalUtils.scss';
import { LoadAssetsFromAssetDevServer, LoadAssetsFromOfficialLink } from './assetLoader.ts';
import { AssetManagerEditor } from './assets/assetManager.ts';
import { EditorWardrobeContextProvider } from './components/wardrobe/wardrobe.tsx';
import { Editor, EditorView } from './editor.tsx';
import { EditorContextProvider, useMaybeEditor, useSetEditor } from './editorContextProvider.tsx';
import { GenerateClientEditorServices } from './services/editorServices.ts';

const logger = GetLogger('init');

try {
	Start()
		.catch((error) => {
			logger.fatal('Init failed:', error);
		});
} catch (error) {
	logger.fatal('Init failed:', error);
}

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	LoadSearchArgs();
	SetupLogging();
	ConfigurePixiSettings();
	// Force full resolution for all textures
	ScreenResolutionSerice.forceFullResolution = true;
	logger.info('Starting editor...');
	logger.verbose('Build mode:', (NODE_ENV === 'production' && USER_DEBUG) ? 'userdebug' : NODE_ENV);

	// Load services
	const serviceManager = GenerateClientEditorServices();
	await serviceManager.load();

	createRoot(document.querySelector('#editor-root') as HTMLElement).render(
		<React.StrictMode>
			<EulaGate>
				<BrowserRouter basename='/editor'>
					<EditorContextProvider serviceManager={ serviceManager }>
						<ToastContainer
							theme='dark'
							style={ {
								position: 'absolute',
							} }
							toastStyle={ { backgroundColor: '#333' } }
							position='top-left'
						/>
						<AssetLoaderElement />
					</EditorContextProvider>
				</BrowserRouter>
			</EulaGate>
		</React.StrictMode>,
	);
	return Promise.resolve();
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
	SetConsoleOutput(LogLevel.DEBUG);
}

function AssetLoaderElement() {
	const editor = useMaybeEditor();
	const setEditor = useSetEditor();
	const [pending, setPending] = useState(false);

	const load = useEvent(async (setLoading: (loading: boolean) => void, loadManager: () => Promise<[AssetManagerEditor, GraphicsManager]>) => {
		if (pending)
			return;

		setPending(true);
		setLoading(true);

		try {
			const [assetManager, graphicsManager] = await loadManager();
			setEditor(new Editor(assetManager, graphicsManager));
		} catch (e) {
			if (e instanceof Error) {
				toast.error(`Failed to load:\n${e.message}`, TOAST_OPTIONS_ERROR);
			} else {
				toast.error(`Failed to load:\n${e as string}`, TOAST_OPTIONS_ERROR);
			}
			logger.error('Failed to load:', e);
			setPending(false);
			setLoading(false);
		}
	});

	if (editor) {
		return (
			<EditorWardrobeContextProvider>
				<EditorView />
			</EditorWardrobeContextProvider>
		);
	}

	return (
		<div style={ { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexFlow: 'column', gap: '1rem' } }>
			<ButtonLoadDirectLink pending={ pending } load={ load } />
			<ButtonLoadOfficialLink pending={ pending } load={ load } />
		</div>
	);
}

function ButtonLoadDirectLink({ pending, load }: { pending: boolean; load: (setLoading: (loading: boolean) => void, loadManager: () => Promise<[AssetManagerEditor, GraphicsManager]>) => Promise<void>; }): ReactElement | null {
	const [loading, setLoading] = useState(false);

	return (
		<Button onClick={ () => void load(setLoading, LoadAssetsFromAssetDevServer) } disabled={ pending }>{ loading ? 'Loading...' : 'Load Assets From Local Development Server' }</Button>
	);
}

function ButtonLoadOfficialLink({ pending, load }: { pending: boolean; load: (setLoading: (loading: boolean) => void, loadManager: () => Promise<[AssetManagerEditor, GraphicsManager]>) => Promise<void>; }): ReactElement {
	const [loading, setLoading] = useState(false);

	return (
		<Button onClick={ () => void load(setLoading, LoadAssetsFromOfficialLink) } disabled={ pending }>{ loading ? 'Loading...' : 'Load Assets From Official Link' }</Button>
	);
}
