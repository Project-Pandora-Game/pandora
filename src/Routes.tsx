import React, { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Pandora } from './components/Pandora/Pandora';
import { Login } from './components/login/login';
import { Registration } from './components/login/registration';
import { ForgotPassword } from './components/login/forgotPassword';
import { ResetPassword } from './components/login/resetPassword';
import { ResendVerificationEmail } from './components/login/resendVerificationEmail';

export function PandoraRoutes(): ReactElement {
	return (
		<Routes>
			<Route path='*' element={ <Pandora /> } />
			<Route path='/login' element={ <Login /> } />
			<Route path='/register' element={ <Registration /> } />
			<Route path='/forgot_password' element={ <ForgotPassword /> } />
			<Route path='/reset_password' element={ <ResetPassword /> } />
			<Route path='/resend_verification_email' element={ <ResendVerificationEmail /> } />
		</Routes>
	);
}
