import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { EulaGate } from './components/Eula';
import { GameContextProvider } from './components/gameContext/gameContextProvider';
import { Header } from './components/header/Header';
import { UnifiedContext } from './components/unifiedContext/unifiedContext';
import { NODE_ENV, USER_DEBUG } from './config/Environment';
import './index.scss';
import { PandoraRoutes } from './routing/Routes';

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
			<EulaGate>
				<BrowserRouter>
					<GameContextProvider>
						<Header />
						<ToastContainer theme='dark' />
						<UnifiedContext />
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
	SetConsoleOutput(LogLevel.DEBUG);
}
