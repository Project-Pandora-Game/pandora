import { AssertNever, IsEmail, IsObject } from 'pandora-common';
import React, { ReactElement, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DirectoryResendVerificationMail } from '../../networking/account_manager';
import { Button } from '../common/Button/Button';
import './login.scss';

export function ResendVerificationEmail(): ReactElement {
	// React States
	const [mail, setMail] = useState('');
	const [errorMessage, setErrorMessage] = useState('');

	const locationState = useLocation().state;
	const message = IsObject(locationState) && typeof locationState.message === 'string' ? locationState.message : '';
	const navigate = useNavigate();

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		//Prevent page reload
		event.preventDefault();

		// Pre-validate data
		if (!IsEmail(mail)) {
			setErrorMessage('Invalid username format');
			return;
		}
		void (async () => {
			const result = await DirectoryResendVerificationMail(mail);

			if (result === 'maybeSent') {
				navigate('/login', {
					state: {
						message: 'An email with a verification code has been sent to the submitted email address, if there is an account registered using it.',
					},
				});
				return;
			} else {
				AssertNever(result);
			}
		})();

	};

	const contents = (
		<form onSubmit={ handleSubmit }>
			<div className='input-container'>
				<label>Enter your email</label>
				<input autoComplete='email' type='email' value={ mail }
					onChange={ (event) => setMail(event.target.value) } required />
			</div>
			{ errorMessage && <div className='error'>{ errorMessage }</div> }
			<div className='center'>
				<Button type='submit'>Send verification email</Button>
			</div>
		</form>
	);

	return (
		<div className='forgotPassword'>
			<div id='forgotPassword-form' className='auth-form'>
				<div className='title'>Resend Email</div>
				{ message && <div className='message'>{ message }</div> }
				{ contents }
				<Link to='/login'>
					<div className='login-links'>
						◄ Back
					</div>
				</Link>
			</div>
		</div>
	);
}
