import { GetLogger, SetConsoleOutput } from 'pandora-common';
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
import { HoverElementsPortal } from './components/hoverElement/hoverElement';
import { ConfigurePixiSettings } from './graphics/pixiSettings';
import { ConfigLogLevel, LoadSearchArgs } from './config/searchArgs';

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
	LoadSearchArgs();
	SetupLogging();
	ConfigurePixiSettings();
	logger.info('Starting...');
	logger.verbose('Build mode:', (NODE_ENV === 'production' && USER_DEBUG) ? 'userdebug' : NODE_ENV);
	createRoot(document.querySelector('#pandora-root') as HTMLElement).render(
		<React.StrictMode>
			<Dialogs location='global' />
			<HoverElementsPortal />
			<EulaGate>
				<BrowserRouter>
					<GameContextProvider>
						<Header />
						<div className='main-container'>
							<Dialogs location='mainOverlay' />
							<ToastContainer
								theme='dark'
								style={ {
									position: 'absolute',
								} }
							/>
							<div className='main'>
								<PandoraRoutes />
							</div>
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
	SetConsoleOutput(ConfigLogLevel.value);
}
