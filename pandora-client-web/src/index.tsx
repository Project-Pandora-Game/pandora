import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { EulaGate } from './components/Eula';
import { GameContextProvider } from './components/gameContext/gameContextProvider';
import { Header } from './components/header/Header';
import { NODE_ENV, USER_DEBUG } from './config/Environment';
import './index.scss';
import './styles/globalUtils.scss';
import { PandoraRoutes } from './routing/Routes';
import { Dialogs } from './components/dialog/dialog';

const logger = GetLogger('init');

try {
	Start();
} catch (error) {
	logger.fatal('Init failed:', error);
}

/**
 * Starts the application.
 */
function Start(): void {
	SetupLogging();
	logger.info('Starting...');
	logger.verbose('Build mode:', (NODE_ENV === 'production' && USER_DEBUG) ? 'userdebug' : NODE_ENV);
	createRoot(document.querySelector('#pandora-root') as HTMLElement).render(
		<React.StrictMode>
			<Dialogs />
			<EulaGate>
				<BrowserRouter>
					<GameContextProvider>
						<Header />
						<ToastContainer theme='dark' />
						<div className='main'>
							<PandoraRoutes />
						</div>
					</GameContextProvider>
				</BrowserRouter>
			</EulaGate>
		</React.StrictMode>,
	);
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
	let level = USER_DEBUG ? LogLevel.VERBOSE : LogLevel.WARNING;
	const search = new URLSearchParams(window.location.search);
	if (search.has('loglevel')) {
		const logLevel = search.get('loglevel') || '';
		switch (logLevel.toLowerCase()) {
			case 'debug':
				level = LogLevel.DEBUG;
				break;
			case 'verbose':
				level = LogLevel.VERBOSE;
				break;
			case 'info':
				level = LogLevel.INFO;
				break;
			case 'alert':
				level = LogLevel.ALERT;
				break;
			case 'warning':
				level = LogLevel.WARNING;
				break;
			case 'error':
				level = LogLevel.ERROR;
				break;
			case 'fatal':
				level = LogLevel.FATAL;
				break;
			default: {
				const parsed = parseInt(logLevel);
				if (parsed >= LogLevel.FATAL && parsed <= LogLevel.DEBUG)
					level = parsed;
				break;
			}
		}
	}
	SetConsoleOutput(level);
}
