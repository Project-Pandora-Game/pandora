import React from 'react';
import { ToastContainer } from 'react-toastify';
import { render } from 'react-dom';
import { GetLogger, SetConsoleOutput, LogLevel } from 'pandora-common/dist/logging';
import { BrowserRouter } from 'react-router-dom';
import { EditorRoutes } from './routes';
import '../index.scss';
import { EditorAssetStore } from './graphics/editorStore';
import { boneDefinition, assetDefinition } from './graphics/tempConfig';

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
	const store = EditorAssetStore.getInstance();
	store.loadBones(boneDefinition);
	store.loadAssets(assetDefinition);
	render(
		<React.StrictMode>
			<div className='Header' />
			<ToastContainer theme='dark' />
			<div className='main' style={ { height: '100vh' } }>
				<BrowserRouter>
					<EditorRoutes />
				</BrowserRouter>
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
