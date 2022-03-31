import { AssertNever, IsEmail, IsObject, IsUsername } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DirectoryRegister } from '../../networking/account_manager';
import { Button } from '../common/Button/Button';
import './login.scss';

export function Registration(): ReactElement {
	// React States
	const [username, setUsername] = useState('');
	const [mail, setMail] = useState('');
	const [password, setPassword] = useState('');
	const [passwordRetyped, setPasswordRetyped] = useState('');
	const [errorMessage, setErrorMessage] = useState({ element: '', message: '' });

	const navigate = useNavigate();
	const locationState = useLocation().state;
	const message = IsObject(locationState) && typeof locationState.message === 'string' ? locationState.message : '';

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		//Prevent page reload
		event.preventDefault();

		// Username
		if (!IsUsername(username)) {
			setErrorMessage({ element: 'uname', message: 'Invalid username format' });
			return;
		}

		// Email
		if (!IsEmail(mail)) {
			setErrorMessage({ element: 'mail', message: 'Invalid email format' });
			return;
		}

		// Password 1
		if (!password) {
			setErrorMessage({ element: 'pass', message: 'Cannot be empty' });
			return;
		}

		// Password 2
		if (password !== passwordRetyped) {
			setErrorMessage({ element: 'pass2', message: 'Passwords do not match' });
			return;
		}
		void (async () => {
			const result = await DirectoryRegister(username, password, mail);

			if (result === 'ok') {
				setErrorMessage({ element: '', message: '' });
				navigate('/login', {
					state: {
						message: 'Account successfully created, please check your email for verification.',
					},
				});
				return;
			} else if (result === 'usernameTaken') {
				setErrorMessage({ element: 'uname', message: 'Username already taken' });
			} else if (result === 'emailTaken') {
				setErrorMessage({ element: 'mail', message: 'Email already in use' });
			} else {
				AssertNever(result);
			}
		})();

	};

	// Generate JSX code for error message
	const renderErrorMessage = (name: string) => (
		errorMessage.element === name ? <div className='error'>{ errorMessage.message }</div> : null
	);

	let contents: ReactElement;

	if (!globalThis.crypto.subtle) {
		contents = (
			<div className='error'>
				Cryptography service is not available.<br />
				Please check your browser is up to date and<br />
				that you are using HTTPS to connect to this site.
			</div>
		);
	} else {
		contents = (
			<div className='form'>
				<form onSubmit={ handleSubmit }>
					<div className='input-container'>
						<label>Username </label>
						<input autoComplete='username' type='text' name='uname' value={ username }
							onChange={ (event) => setUsername(event.target.value) } required />
						{ renderErrorMessage('uname') }
					</div>
					<div className='input-container'>
						<label>Mail </label>
						<input autoComplete='email' type='email' name='mail' value={ mail }
							onChange={ (event) => setMail(event.target.value) } required />
						{ renderErrorMessage('mail') }
					</div>
					<div className='input-container'>
						<label>Password </label>
						<input autoComplete='new-password' type='password' name='pass1' value={ password }
							onChange={ (event) => setPassword(event.target.value) } required />
						{ renderErrorMessage('pass') }
					</div>
					<div className='input-container'>
						<label>Confirm password </label>
						<input autoComplete='new-password' type='password' name='pass2' value={ passwordRetyped }
							onChange={ (event) => setPasswordRetyped(event.target.value) } required />
						{ renderErrorMessage('pass2') }
					</div>
					<Button type='submit'>Register</Button>
				</form>
			</div>
		);
	}

	return (
		<div className='registration'>
			<div id='registration-form' className='auth-form'>
				<h1 className='title'>Sign Up</h1>
				{ message && <div className='message'>{ message }</div> }
				{ contents }
				<Link className='login-links' to='/login'>
					◄ Back
				</Link>
			</div>
		</div>
	);
}
