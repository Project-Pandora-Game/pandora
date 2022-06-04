import React, { ComponentType, ReactElement } from 'react';
import { AuthFormRouter } from './authFormRouter';
import './authPage.scss';
import { LoginTeaser } from './loginTeaser';

export interface AuthPageProps {
	component: ComponentType<Record<string, never>>;
}

export function AuthPage({ component }: AuthPageProps): ReactElement {
	return (
		<div className='AuthPage'>
			<div className='auth-page-content'>
				<LoginTeaser />
				<AuthFormRouter component={ component } />
			</div>
		</div>
	);
}
