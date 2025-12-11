import type { ServiceProvider } from 'pandora-common';
import type { ReactElement } from 'react';
import { BrowserRouter } from 'react-router';
import { ToastContainer } from 'react-toastify';
import { Dialogs } from './components/dialog/dialog.tsx';
import { GameContextProvider } from './components/gameContext/gameContextProvider.tsx';
import { Header } from './components/header/Header.tsx';
import { PandoraRoutes } from './routing/Routes.tsx';
import type { ClientServices } from './services/clientServices.ts';

export default function PandoraMain({ serviceManager }: {
	serviceManager: ServiceProvider<ClientServices>;
}): ReactElement {
	return (
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
	);
}
