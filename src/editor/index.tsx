import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GetLogger, SetConsoleOutput, LogLevel } from 'pandora-common';
import { LoadAssetsFromDirectLink, LoadAssetsFromFileSystem } from './assetLoader';
import { Button } from '../components/common/Button/Button';
import '../index.scss';
import { Editor, EditorView } from './editor';
import { EditorContextProvider, useMaybeEditor, useSetEditor } from './editorContextProvider';
import { TOAST_OPTIONS_ERROR } from '../persistentToast';
import { useEvent } from '../common/useEvent';
import { GraphicsManager } from '../assets/graphicsManager';

const logger = GetLogger('init');

Start().catch((error) => {
	logger.fatal('Init failed:', error);
});

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	SetupLogging();
	logger.info('Starting...');
	createRoot(document.querySelector('#editor-root') as HTMLElement).render(
		<React.StrictMode>
			<EditorContextProvider>
				<ToastContainer theme='dark' />
				<AssetLoaderElement />
			</EditorContextProvider>
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

	const load = useEvent(async (setLoading: (loading: boolean) => void, loadManager: () => Promise<GraphicsManager>) => {
		if (pending)
			return;

		setPending(true);
		setLoading(true);

		try {
			const manager = await loadManager();
			setEditor(new Editor(manager));
		} catch (e) {
			toast.error(`Failed to load: ${e as string}`, TOAST_OPTIONS_ERROR);
			logger.error('Failed to load:', e);
			setPending(false);
			setLoading(false);
		}
	});

	if (editor) {
		return (
			<EditorView />
		);
	}

	const supported = 'showDirectoryPicker' in window;

	return (
		<div style={ { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexFlow: 'column', gap: '1rem' } }>
			{ supported ? <ButtonLoadFromFileSystem pending={ pending } load={ load } /> : null }
			<ButtonLoadDirectLink pending={ pending } load={ load } />
		</div>
	);
}

function ButtonLoadFromFileSystem({ pending, load }: { pending: boolean; load: (setLoading: (loading: boolean) => void, loadManager: () => Promise<GraphicsManager>) => Promise<void>; }) {
	const [loading, setLoading] = useState(false);

	return (
		<Button onClick={ () => void load(setLoading, LoadAssetsFromFileSystem) } disabled={ pending }>{ loading ? 'Loading...' : 'Load Assets From File System' }</Button>
	);
}

function ButtonLoadDirectLink({ pending, load }: { pending: boolean; load: (setLoading: (loading: boolean) => void, loadManager: () => Promise<GraphicsManager>) => Promise<void>; }) {
	const [loading, setLoading] = useState(false);
	const editor = useMaybeEditor();
	const autoloaded = useRef(false);

	useEffect(() => {
		if (!autoloaded.current && !editor && !pending && !('showDirectoryPicker' in window)) {
			autoloaded.current = true;
			void load(setLoading, LoadAssetsFromDirectLink);
		}
	}, [editor, load, pending]);

	return (
		<Button onClick={ () => void load(setLoading, LoadAssetsFromDirectLink) } disabled={ pending }>{ loading ? 'Loading...' : 'Load Assets From Direct Link' }</Button>
	);
}
