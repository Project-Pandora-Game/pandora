import { AssertNever, CreateStringValidator, IsObject } from 'pandora-common';
import React, { ReactElement, useState  } from 'react';
import { useNavigate } from 'react-router';
import { Link, useLocation } from 'react-router-dom';
import { DirectoryPasswordResetConfirm } from '../../networking/account_manager';
import './login.scss';

const IsToken = CreateStringValidator({
	regex: /^\d+$/,
	minLength: 6,
	maxLength: 6,
});

export function ResetPassword(): ReactElement {
	// React States
	const [username, setUsername] = useState('');
	const [token, setToken] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [newPasswordRetyped, setNewPasswordRetyped] = useState('');
	const [errorMessage, setErrorMessage] = useState('');

	const navigate = useNavigate();
	const locationState = useLocation().state;
	const message = IsObject(locationState) && typeof locationState.message === 'string' ? locationState.message : '';

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		//Prevent page reload
		event.preventDefault();

		// Pre-validate data
		if (!IsToken(token)) {
			setErrorMessage('Invalid code format');
			return;
		}

		const result = await DirectoryPasswordResetConfirm(username, token, newPassword);

		if (result === 'ok') {
			setErrorMessage('');
			navigate('/login', {
				state: {
					message: 'Your password has been changed and can now be used to log in.',
				},
			});
			return;
		} else if (newPassword !== newPasswordRetyped) {
			setErrorMessage('Passwords do not match');
		} else if (result === 'unknownCredentials') {
			// Invalid user data
			setErrorMessage('Invalid username or token');
		} else {
			AssertNever(result);
		}
	};

	let contents: ReactElement;

	if (!globalThis.crypto.subtle) {
		contents = (
			<div className="error">
				Cryptography service is not available.<br />
				Please check your browser is up to date and<br />
				that you are using HTTPS to connect to this site.
			</div>
		);
	} else {
		contents = (
			<form onSubmit={ handleSubmit }>
				<div className="input-container">
					<label htmlFor='reset-uname'>Username</label>
					<input autoComplete='username' type='text' id='reset-uname' value={ username } onChange={ (event) => setUsername(event.target.value) } required />
				</div>
				<div className="input-container">
					<label htmlFor='reset-token'>Reset code</label>
					<input autoComplete='one-time-code' type='text' id='reset-token' maxLength={ 6 } value={ token } onChange={ (event) => setToken(event.target.value) } required />
				</div>
				<div className="input-container">
					<label htmlFor='reset-password'>New password</label>
					<input autoComplete='new-password' type='password' id='reset-password' value={ newPassword } onChange={ (event) => setNewPassword(event.target.value) } required />
				</div>
				<div className='input-container'>
					<label htmlFor='reset-password-confirm'>Confirm new password</label>
					<input autoComplete='new-password' type='password' id='reset-password-confirm' value={ newPasswordRetyped } onChange={ (event) => setNewPasswordRetyped(event.target.value) } required />
				</div>
				{errorMessage && <div className="error">{errorMessage}</div>}
				<div className="center">
					<input type="submit" value='Reset password' />
				</div>
				<Link to="/forgot_password">
					<div className="login-links">
						Don&apos;t have a reset code?
					</div>
				</Link>
				<Link to="/login">
					<div className="login-links">
						◄ Back
					</div>
				</Link>
			</form>
		);
	}

	return (
		<div className="forgotPassword">
			<div className="forgotPassword-form">
				<div className="title">Reset Password</div>
				{message && <div className="message">{message}</div>}
				{contents}
			</div>
		</div>
	);
}
