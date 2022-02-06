import { AssertNever, IsEmail } from 'pandora-common';
import React, { ReactElement, useState  } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DirectoryPasswordReset } from '../../networking/account_manager';
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
				<label htmlFor='forgot-password-email'>Enter your used email</label>
				<input autoComplete='email' type="email" id='forgot-password-email' value={ mail } onChange={ (event) => setMail(event.target.value) } required />
			</div>
			{errorMessage && <div className="error">{errorMessage}</div>}
			<div className="center">
				<input type="submit" value='Send reset email' />
			</div>
			<Link to="/reset_password">
				<div className="login-links">
					Already have a reset code?
				</div>
			</Link>
			<Link to="/login">
				<div className="login-links">
					◄ Back
				</div>
			</Link>
		</form>
	);

	return (
		<div className="forgotPassword">
			<div className="forgotPassword-form">
				<div className="title">Forgot Password</div>
				{contents}
			</div>
		</div>
	);
}
