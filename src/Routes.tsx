import React, { ReactElement } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { Login } from './components/login/login';
import { Registration } from './components/login/registration';
import { ForgotPassword } from './components/login/forgotPassword';
import { ResetPassword } from './components/login/resetPassword';
import { ResendVerificationEmail } from './components/login/resendVerificationEmail';
import { useBrowserStorage } from './browserStorage';
import Eula from './components/Eula';
import { useObservable } from './observable';
import { currentAccount } from './networking/account_manager';

export function PandoraRoutes(): ReactElement {
	const isLoggedIn = useObservable(currentAccount) !== undefined;

	const [eula, setEula] = useBrowserStorage('eula', false);

	if (!eula)
		return <Eula accept={ () => setEula(true) } />;

	return (
		<Routes>
			<Route path='*' element={ <Fallback element={ Login } render={ true } /> } />

			<Route path='/login' element={ <Fallback element={ Login } render={ !isLoggedIn }  /> } />
			<Route path='/register' element={ <Fallback element={ Registration } render={ !isLoggedIn }  /> } />
			<Route path='/forgot_password' element={ <Fallback element={ ForgotPassword } render={ !isLoggedIn }  /> } />
			<Route path='/reset_password' element={ <Fallback element={ ResetPassword } render={ !isLoggedIn }  /> } />
			<Route path='/resend_verification_email' element={ <Fallback element={ ResendVerificationEmail } render={ !isLoggedIn } /> } />
		</Routes>
	);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function Fallback({ element: Element, render }: { element: () => ReactElement, render: boolean }): ReactElement {
	if (!render) {
		const isLoggedIn = currentAccount.value !== undefined;
		if (!isLoggedIn)
			return <Navigate to={ '/login' } />;

		return <Navigate to={ '/' } />;
	}

	return <Element />;
}
