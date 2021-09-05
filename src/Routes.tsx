import React, { ReactElement } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { Pandora } from './components/Pandora/Pandora';

export function Routes(): ReactElement {
	return (
		<Switch>
			<Route exact path="/" component={ Pandora } />
			<Redirect to="/" />
		</Switch>
	);
}
