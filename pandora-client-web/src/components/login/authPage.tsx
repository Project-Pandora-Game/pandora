import React, { ComponentType, ReactElement } from 'react';
import { AuthFormRouter } from './authFormRouter';
import './authPage.scss';
import { LoginTeaser } from './loginTeaser';
import { Row } from '../common/container/container';

export interface AuthPageProps {
	component: ComponentType<Record<string, never>>;
}

export function AuthPage({ component }: AuthPageProps): ReactElement {
	return (
		<div className='AuthPage'>
			<Row alignX='center' alignY='center' wrap gap='xxx-large'>
				<LoginTeaser />
				<AuthFormRouter component={ component } />
			</Row>
		</div>
	);
}
