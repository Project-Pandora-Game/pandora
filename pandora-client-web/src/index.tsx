import { GetLogger, SetConsoleOutput } from 'pandora-common';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css' with { type: 'css' };
import { Dialogs } from './components/dialog/dialog.tsx';
import { EulaGate } from './components/Eula/index.tsx';
import { GameContextProvider } from './components/gameContext/gameContextProvider.tsx';
import { Header } from './components/header/Header.tsx';
import { NODE_ENV, USER_DEBUG } from './config/Environment.ts';
import { ConfigLogLevel, LoadSearchArgs } from './config/searchArgs.ts';
import { ConfigurePixiSettings } from './graphics/pixiSettings.ts';
import './index.scss';
import { PandoraRoutes } from './routing/Routes.tsx';
import { GenerateClientUsermodeServices } from './services/clientServices.ts';
import './styles/fonts.scss';
import './styles/globalUtils.scss';

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
