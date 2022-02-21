import { AssertNever, IsEmail } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DirectoryPasswordReset } from '../../networking/account_manager';
import { Button } from '../common/Button/Button';
import './login.scss';

export function ForgotPassword(): ReactElement {
	// React States
	const [mail, setMail] = useState('');
	const [errorMessage, setErrorMessage] = useState('');
	const navigate = useNavigate();

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		//Prevent page reload
		event.preventDefault();

		// Pre-validate data
		if (!IsEmail(mail)) {
			setErrorMessage('Invalid email format');
			return;
		}

		const result = await DirectoryPasswordReset(mail);

		if (result === 'maybeSent') {
			navigate('/reset_password', {
				state: {
					message: 'An email with a reset code has been sent to the submitted email address, if there is an account registered using it.',
				},
			});
			return;
		} else {
			AssertNever(result);
		}
	};

	const contents = (
		<form onSubmit={ handleSubmit }>
			<div className="input-container">
				<label htmlFor="forgot-password-email">Enter your email</label>
				<input autoComplete="email" type="email" id="forgot-password-email" value={ mail }
					onChange={ (event) => setMail(event.target.value) } required />
			</div>
			{ errorMessage && <div className="error">{ errorMessage }</div> }
			<Button type="submit">Send reset email</Button>
		</form>
	);

	return (
		<div className="forgotPassword">
			<div id="forgotPassword-form" className="auth-form">
				<h1 className="title">Forgot Password</h1>
				{ contents }
				<Link className="login-links" to="/reset_password">
					Already have a reset code?
				</Link>
				<Link className="login-links" to="/login">
					◄ Back
				</Link>
			</div>
		</div>
	);
}
