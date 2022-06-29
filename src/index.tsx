import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { GameContextProvider } from './components/gameContext/gameContextProvider';
import { Header } from './components/header/Header';
import { NODE_ENV, USER_DEBUG } from './config/Environment';
import './index.scss';
import { PandoraRoutes } from './routing/Routes';
import { GIT_COMMIT_HASH } from './config/Environment';

const VERSION_CHECK_INTERVAL = 5 * 60_000; // 5 minutes

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
	if (NODE_ENV === 'production') {
		setInterval(CheckVersion, VERSION_CHECK_INTERVAL);
	}
	createRoot(document.querySelector('#pandora-root') as HTMLElement).render(
		<React.StrictMode>
			<BrowserRouter>
				<GameContextProvider>
					<Header />
					<ToastContainer theme='dark' />
					<div className='main'>
						<PandoraRoutes />
					</div>
				</GameContextProvider>
			</BrowserRouter>
		</React.StrictMode>,
	);
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
	SetConsoleOutput(LogLevel.DEBUG);
}

let versionCheckRunning = false;
function CheckVersion() {
	if (versionCheckRunning) {
		return;
	}
	versionCheckRunning = true;
	fetch(`/version.json?${Date.now()}`)
		.then((response) => response.json())
		.then((data: { gitCommitHash: string }) => {
			if (data.gitCommitHash === GIT_COMMIT_HASH) {
				return;
			}
			if (confirm(`You are running an outdated version of the application.\n\nCurrent version: ${GIT_COMMIT_HASH}\nNew version: ${data.gitCommitHash}\n\nDo you want to reload the page?`)) {
				location.reload();
			}
		})
		.catch((error) => {
			logger.error('Failed to check version.json: ', error);
		})
		.finally(() => {
			versionCheckRunning = false;
		});
}
