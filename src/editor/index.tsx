import React, { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GetLogger, SetConsoleOutput, LogLevel } from 'pandora-common';
import { LoadAssetsFromDirectLink, LoadAssetsFromFileSystem } from './assetLoader';
import { Button } from '../components/common/Button/Button';
import '../index.scss';
import { Editor, EditorView } from './editor';
import { Observable, useObservable } from '../observable';

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
			<ToastContainer theme='dark' />
			<AssetLoaderElement />
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

const EditorInstance = new Observable<Editor | null>(null);

function AssetLoaderElement() {
	const editor = useObservable(EditorInstance);
	const [pending, setPending] = useState(false);

	if (editor) {
		return (
			<EditorView editor={ editor } />
		);
	}

	return (
		<div style={ { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexFlow: 'column', gap: '1rem' } }>
			<ButtonLoadFromFileSystem pending={ pending } setPending={ setPending } />
			<ButtonLoadDirectLink pending={ pending } setPending={ setPending } />
		</div>
	);
}

function ButtonLoadFromFileSystem({ pending, setPending }: { pending: boolean, setPending: (value: boolean) => void, }) {
	const supported = 'showDirectoryPicker' in window;
	const [text, setText] = useState(supported ? 'Load Assets From File System' : 'Browser does not support File System Access API');

	const loadFileSystem = useCallback(async () => {
		if (pending || !supported)
			return;

		setPending(true);
		setText('Loading');
		try {
			await LoadAssetsFromFileSystem();
			EditorInstance.value = new Editor();
		} catch (e) {
			logger.error('Failed to load assets:', e);
			setPending(false);
			setText('Load Assets From File System');
		}
	}, [pending, setPending, supported]);

	return (
		<Button onClick={ () => void loadFileSystem() } disabled={ pending || !supported }>{text}</Button>
	);
}

function ButtonLoadDirectLink({ pending, setPending }: { pending: boolean, setPending: (value: boolean) => void, }) {
	const [text, setText] = useState('Load Assets From Direct Link');

	const loadDirectLink = useCallback(async () => {
		if (pending)
			return;

		setPending(true);
		setText('Loading');
		try {
			await LoadAssetsFromDirectLink();
			EditorInstance.value = new Editor();
		} catch (e) {
			logger.error('Failed to load assets:', e);
			setPending(false);
			setText('Load Assets From Direct Link');
		}
	}, [pending, setPending]);

	return (
		<Button onClick={ () => void loadDirectLink() } disabled={ pending }>{text}</Button>
	);
}
