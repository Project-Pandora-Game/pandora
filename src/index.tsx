import React from 'react';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Header } from './components/header/Header';
import './index.scss';
import { PandoraRoutes } from './Routes';
import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common/dist/logging';
import { ConnectToDirectory } from './networking/socketio_directory_connector';

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
	render(
		<React.StrictMode>
			<Header />
			<ToastContainer theme='dark' />
			<div className='main'>
				<BrowserRouter>
					<PandoraRoutes />
				</BrowserRouter>
			</div>
		</React.StrictMode>,
		document.querySelector('#pandora-root'),
	);
	await ConnectToDirectory();
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
	SetConsoleOutput(LogLevel.DEBUG);
}
