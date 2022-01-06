import React from 'react';
import { render } from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import './index.scss';
import { PandoraRoutes } from './Routes';

render(
	<React.StrictMode>
		<BrowserRouter>
			<PandoraRoutes />
		</BrowserRouter>
	</React.StrictMode>,
	document.querySelector('#pandora-root'),
);
