import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Header } from './components/header/Header';
import './index.scss';
import { PandoraRoutes } from './routing/Routes';
import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common';
import { ConnectToDirectory } from './networking/socketio_directory_connector';
import { NODE_ENV, USER_DEBUG } from './config/Environment';

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
	logger.verbose('Build mode:', (NODE_ENV === 'production' && USER_DEBUG) ? 'userdebug' : NODE_ENV);
	createRoot(document.querySelector('#pandora-root') as HTMLElement).render(
		<React.StrictMode>
			<Header />
			<ToastContainer theme='dark' />
			<div className='main'>
				<BrowserRouter>
					<PandoraRoutes />
				</BrowserRouter>
			</div>
		</React.StrictMode>,
	);
	await ConnectToDirectory();
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
	SetConsoleOutput(LogLevel.DEBUG);
}
