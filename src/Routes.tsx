import React, { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Pandora } from './components/Pandora/Pandora';

export function PandoraRoutes(): ReactElement {
	return (
		<Routes>
			<Route path="*" element={ <Pandora /> } />
		</Routes>
	);
}
