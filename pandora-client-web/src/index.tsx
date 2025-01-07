import { GetLogger, SetConsoleOutput } from 'pandora-common';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Dialogs } from './components/dialog/dialog';
import { EulaGate } from './components/Eula';
import { GameContextProvider } from './components/gameContext/gameContextProvider';
import { Header } from './components/header/Header';
import { NODE_ENV, USER_DEBUG } from './config/Environment';
import { ConfigLogLevel, LoadSearchArgs } from './config/searchArgs';
import { ConfigurePixiSettings } from './graphics/pixiSettings';
import './index.scss';
import { PandoraRoutes } from './routing/Routes';
import { GenerateClientUsermodeServices } from './services/clientServices';
import './styles/globalUtils.scss';
import './styles/fonts.scss';

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
	logger.info('Starting...');
	logger.verbose('Build mode:', (NODE_ENV === 'production' && USER_DEBUG) ? 'userdebug' : NODE_ENV);

	// Load services
	const serviceManager = GenerateClientUsermodeServices();
	await serviceManager.load();

	createRoot(document.querySelector('#pandora-root') as HTMLElement).render(
		<React.StrictMode>
			<Dialogs location='global' />
			<EulaGate>
				<BrowserRouter>
					<GameContextProvider serviceManager={ serviceManager }>
						<Header />
						<div className='main-container'>
							<Dialogs location='mainOverlay' />
							<ToastContainer
								theme='dark'
								style={ {
									position: 'absolute',
								} }
								toastStyle={ { backgroundColor: '#333' } }
								position='top-left'
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
