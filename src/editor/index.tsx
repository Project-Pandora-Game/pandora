import React, { useCallback, useReducer, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import { render } from 'react-dom';
import { GetLogger, SetConsoleOutput, LogLevel } from 'pandora-common';
import { BrowserRouter } from 'react-router-dom';
import { EditorRoutes } from './routes';
import { LoadAssetsFromDirectLink, LoadAssetsFromFileSystem } from './assetLoader';
import { Button } from '../components/common/Button/Button';
import '../index.scss';

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
	render(
		<React.StrictMode>
			<div className='Header' />
			<ToastContainer theme='dark' />
			<div className='main' style={ { height: '100vh' } }>
				<AssetLoaderElement />
			</div>
		</React.StrictMode>,
		document.querySelector('#editor-root'),
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
	const supported = 'showDirectoryPicker' in window;
	const [ok, loaded] = useReducer(() => true, false);
	const [pending, togglePending] = useReducer((p) => !p, !supported);

	if (ok) {
		return (
			<BrowserRouter>
				<EditorRoutes />
			</BrowserRouter>
		);
	}

	return (
		<div style={ { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexFlow: 'column', gap: '1rem' } }>
			<ButtonLoadFromFileSystem loaded={ loaded } pending={ pending } togglePending={ togglePending } />
			<ButtonLoadDirectLink loaded={ loaded } pending={ pending } togglePending={ togglePending } />
		</div>
	);
}

function ButtonLoadFromFileSystem({ loaded, pending, togglePending }: { loaded: () => void, pending: boolean, togglePending: () => void, }) {
	const supported = 'showDirectoryPicker' in window;
	pending = pending || !supported;
	const [text, setText] = useState(supported ? 'Load Assets From File System' : 'Browser does not support File System Access API');

	const loadFileSystem = useCallback(async () => {
		if (pending)
			return;

		togglePending();
		setText('Loading');
		try {
			await LoadAssetsFromFileSystem();
			loaded();
		} catch (e) {
			logger.error('Failed to load assets:', e);
			togglePending();
			setText('Load Assets From File System');
		}
	}, [pending, togglePending, loaded]);

	return (
		<Button onClick={ () => void loadFileSystem() } disabled={ pending }>{text}</Button>
	);
}

function ButtonLoadDirectLink({ loaded, pending, togglePending }: { loaded: () => void, pending: boolean, togglePending: () => void, }) {
	const [text, setText] = useState('Load Assets From Direct Link');

	const loadDirectLink = useCallback(async () => {
		if (pending)
			return;

		togglePending();
		setText('Loading');
		try {
			await LoadAssetsFromDirectLink();
			loaded();
		} catch (e) {
			logger.error('Failed to load assets:', e);
			togglePending();
			setText('Load Assets From Direct Link');
		}
	}, [pending, togglePending, loaded]);

	return (
		<Button onClick={ () => void loadDirectLink() } disabled={ pending }>{text}</Button>
	);
}
