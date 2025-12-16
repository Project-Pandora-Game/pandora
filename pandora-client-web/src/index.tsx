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

function LoadMain() {
	return import('./main.tsx');
}

const Main = lazy(LoadMain);

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	LoadSearchArgs();
	SetupLogging();
	logger.info('Starting...');
	logger.verbose('Build mode:', (NODE_ENV === 'production' && USER_DEBUG) ? 'userdebug' : NODE_ENV);

	// Inject metadata
	{
		const description = document.createElement('meta');
		description.name = 'description';
		description.content = 'Pandora is a free erotic roleplaying platform centered around the consensual practice of BDSM. The welcoming community interacts using customizable characters in a virtual bondage club created from user-decorated rooms.';
		document.head.appendChild(description);
	}
	{
		const description = document.createElement('meta');
		description.name = 'rating';
		description.content = 'adult';
		document.head.appendChild(description);
	}
	{
		const websiteData = document.createElement('script');
		websiteData.type = 'application/ld+json';
		websiteData.text = JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			'name': 'Project Pandora',
			'alternateName': ['Pandora'],
			'url': new URL('/', globalThis.location.href).href,
		}, undefined, 4);
		document.head.appendChild(websiteData);
	}

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

	// Preload main application for when user confirms EULA
	globalThis.addEventListener('load', () => {
		LoadMain()
			.catch((e) => {
				logger.error('Failed to preload Main:', e);
			});
	}, { once: true });
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
	SetConsoleOutput(ConfigLogLevel.value);
}
