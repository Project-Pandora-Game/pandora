import './earlyload.ts'; // Stuff that must happen before ANYTHING else

import { GetLogger, SetConsoleOutput } from 'pandora-common';
import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import 'react-toastify/dist/ReactToastify.css' with { type: 'css' };
import { Dialogs } from './components/dialog/dialog.tsx';
import { EulaGate } from './components/Eula/index.tsx';
import { LoadIndicator } from './components/LoadIndicator/LoadIndicator.tsx';
import { NODE_ENV, USER_DEBUG } from './config/Environment.ts';
import { ConfigLogLevel, LoadSearchArgs } from './config/searchArgs.ts';
import './index.scss';
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

const Main = lazy(() => import('./main.tsx'));

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	LoadSearchArgs();
	SetupLogging();
	logger.info('Starting...');
	logger.verbose('Build mode:', (NODE_ENV === 'production' && USER_DEBUG) ? 'userdebug' : NODE_ENV);

	// Load services
	const serviceManager = GenerateClientUsermodeServices();
	await serviceManager.load();

	createRoot(document.querySelector('#pandora-root') as HTMLElement).render(
		<React.StrictMode>
			<Dialogs location='global' />
			<EulaGate>
				<Suspense fallback={ <div className='Loading'><LoadIndicator /></div> }>
					<Main serviceManager={ serviceManager } />
				</Suspense>
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
