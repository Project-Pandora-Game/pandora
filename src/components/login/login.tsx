import { AssertNever, IsObject, IsSimpleToken, IsUsername } from 'pandora-common';
import React, { FormEvent, ReactElement, ReactNode, useState, useEffect, useReducer } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authToken, currentAccount, DirectoryLogin } from '../../networking/account_manager';
import { useObservable } from '../../observable';
import { GAME_NAME, GAME_VERSION } from '../../config/Environment';
import './login.scss';
import { Button } from '../common/Button/Button';
import pandoraEntranceImage from '../../assets/pandora_entrance.png';

export function Login(): ReactElement {
	// React States
	const auth = useObservable(authToken);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [token, setToken] = useState('');
	const [needsVerification, setNeedsVerification] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const isLoggedIn = useObservable(currentAccount) !== undefined;

	const locationState = useLocation().state;
	const message = IsObject(locationState) && typeof locationState.message === 'string' ? locationState.message : '';
	const navigate = useNavigate();

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		//Prevent page reload
		event.preventDefault();

		// Pre-validate data
		if (!IsUsername(username)) {
			setErrorMessage('Invalid username format');
			return;
		}

		// Pre-validate data
		if (needsVerification && !IsSimpleToken(token)) {
			setErrorMessage('Invalid code format');
			return;
		}

		// Compare user info
		const result = await DirectoryLogin(username, password, needsVerification ? token : undefined);

		setNeedsVerification(result === 'verificationRequired' || result === 'invalidToken');

		if (result === 'ok') {
			setErrorMessage('');
			navigate('/');
			return;
		} else if (result === 'unknownCredentials') {
			// Invalid user data
			setErrorMessage('Invalid username or password');
		} else if (result === 'verificationRequired') {
			setErrorMessage('Account verification needed');
		} else if (result === 'invalidToken') {
			setErrorMessage('Invalid verification code');
		} else {
			AssertNever(result);
		}
	};

	let contents: ReactElement;
	let links: ReactNode = null;

	if (!globalThis.crypto.subtle) {
		contents = (
			<div className='error'>
				Cryptography service is not available.<br />
				Please check your browser is up to date and<br />
				that you are using HTTPS to connect to this site.
			</div>
		);
	} else if (isLoggedIn) {
		contents = <div>Club membership was confirmed</div>;
	} else if (needsVerification) {
		contents = (
			<form onSubmit={ handleSubmit }>
				<div className='input-container'>
					<label htmlFor='verify-token'>Verification code</label>
					<input autoComplete='one-time-code' type='text' id='verify-token' maxLength={ 6 } value={ token }
						onChange={ (event) => setToken(event.target.value) } required />
				</div>
				{ errorMessage && <div className='error'>{ errorMessage }</div> }
				<Button type='submit'>Sign in</Button>
			</form>
		);
		links = (
			<Link className='login-links' to='/resend_verification_email'>
				Didn&apos;t receive a code by email?
			</Link>
		);
	} else if (auth && auth.expires >= Date.now()) {
		contents = (
			<form>
				<div className='input-container'>
					<label htmlFor='login-uname'>Username</label>
					<input autoComplete='username' type='text' id='login-uname' value={ auth.username } disabled={ true } />
				</div>
				<div className='message'>
					Awaiting automatic login...
				</div>
			</form>
		);
	} else {
		contents = (
			<form onSubmit={ handleSubmit }>
				<div className='input-container'>
					<label htmlFor='login-uname'>Username</label>
					<input autoComplete='username' type='text' id='login-uname' value={ username }
						onChange={ (event) => setUsername(event.target.value) } required />
				</div>
				<div className='input-container'>
					<label htmlFor='login-password'>Password</label>
					<input autoComplete='current-password' type='password' id='login-password' value={ password }
						onChange={ (event) => setPassword(event.target.value) } required />
				</div>
				{ errorMessage && <div className='error'>{ errorMessage }</div> }
				<Button type='submit'>Sign in</Button>
			</form>
		);
		links = (
			<>
				<Link className='login-links' to='/forgot_password'>
					Forgot your password?
				</Link>
				<Link className='login-links' to='/register'>
					Not a member? <strong>Sign up</strong>
				</Link>
			</>
		);
	}

	return (
		<div className='login'>
			<div className='stretcher'>
				<TeaserBox />
				<div id='login-form' className='auth-form'>
					<h1 className='title'>Club Check-in</h1>
					{ message && <div className='message'>{ message }</div> }
					{ contents }
					{ links }
				</div>
			</div>
		</div>
	);
}

export function TeaserBox(): ReactElement {
	const teaserContents: [string, string][] = [
		[`Welcome to ${ GAME_NAME } (version ${ GAME_VERSION })`, pandoraEntranceImage],
		['The content is age 18+', pandoraEntranceImage],
		['This part will show screenshots of the club', pandoraEntranceImage],
	];

	const navElements: ReactElement[] = [];

	const [autoTransitions, setAutoTransitions] = useState(true);

	const [index, setIndex] = useReducer((oldState: number, action: 'next' | number) => {
		if (action === 'next') {
			return (oldState + 1) % teaserContents.length;
		}
		setAutoTransitions(false);
		return action;
	}, 0);

	useEffect(() => {
		if (!autoTransitions)
			return;

		const interval = setInterval(() => {
			setIndex('next');
		}, 5000);

		return () => {
			clearInterval(interval);
		};
	}, [autoTransitions]);

	for (let i = 0; i < teaserContents.length; i++) {
		if (i === index) {
			navElements.push(
				<div key={ i } className='dot' style={ { backgroundColor: 'rgb(3, 42, 100)' } } />,
			);
		} else {
			navElements.push(
				<div key={ i } className='dot' onClick={ () => setIndex(i) } />,
			);
		}
	}

	return (
		<div className='login-teaser'>
			<div className='teaser-text'>{ teaserContents[index][0] }</div>
			<img className='teaser-image' src={ teaserContents[index][1] } />
			<div className='teaser-navigation'>
				{ ...navElements }
			</div>
		</div>
	);
}
