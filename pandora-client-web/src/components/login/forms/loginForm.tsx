import { UserNameSchema } from 'pandora-common';
import { ReactElement, useEffect, useRef, useState } from 'react';
import pandoraLogo from '../../../assets/icons/pandora.svg';
import { FormInput } from '../../../common/userInteraction/input/formInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { IsPasskeyConditionalMediationSupported, IsPasskeySupported } from '../../../crypto/passkey.ts';
import { Button } from '../../common/button/button.tsx';
import { DivContainer } from '../../common/container/container.tsx';
import { Form, FormCreateStringValidator, FormErrorMessage, FormField, FormFieldError, FormLink } from '../../common/form/form.tsx';
import { LocationStateMessage } from '../../common/locationStateMessage/locationStateMessage.tsx';
import { useAuthToken } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { useLoginForm } from './useLoginForm.ts';

export function LoginForm(): ReactElement {
	const auth = useAuthToken();
	const loggedIn = useCurrentAccount() != null;
	const authValid = auth != null && auth.expires >= Date.now();
	const { dirty, errorMessage, errors, onSubmit, onPasskeyLogin, onConditionalPasskeyLogin, isSubmitting, isPasskeySubmitting, register } = useLoginForm();
	const conditionalPasskeyAbort = useRef<AbortController | null>(null);
	const [passkeySupport, setPasskeySupport] = useState({
		supported: false,
		conditional: false,
	});

	useEffect(() => {
		const supported = IsPasskeySupported();
		setPasskeySupport({ supported, conditional: false });
		if (!supported)
			return;

		let active = true;
		IsPasskeyConditionalMediationSupported()
			.then((conditional) => {
				if (active) {
					setPasskeySupport({ supported, conditional });
				}
			})
			.catch(() => {
				if (active) {
					setPasskeySupport({ supported, conditional: false });
				}
			});
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (!passkeySupport.conditional || loggedIn || authValid)
			return;

		const abortController = new AbortController();
		conditionalPasskeyAbort.current = abortController;
		void onConditionalPasskeyLogin(abortController.signal);

		return () => {
			abortController.abort();
			if (conditionalPasskeyAbort.current === abortController) {
				conditionalPasskeyAbort.current = null;
			}
		};
	}, [authValid, loggedIn, onConditionalPasskeyLogin, passkeySupport.conditional]);

	if (loggedIn) {
		return <div>Club membership was confirmed</div>;
	} else if (authValid) {
		return (
			<form>
				<div className='input-container'>
					<label htmlFor='login-uname'>Username</label>
					<TextInput
						autoComplete='username'
						id='login-uname'
						value={ auth.username }
						disabled
					/>
				</div>
				<div className='message'>
					Awaiting automatic login...
				</div>
			</form>
		);
	}

	return (
		<Form className='LoginForm' dirty={ dirty } onSubmit={ onSubmit }>
			<DivContainer justify='center' className='logo-container'>
				<img src={ pandoraLogo } alt='Pandora Logo' />
			</DivContainer>
			<LocationStateMessage />
			<FormField>
				<label htmlFor='login-username'>Username</label>
				<FormInput
					type='text'
					id='login-username'
					autoComplete='username webauthn'
					readOnly={ isSubmitting }
					register={ register }
					name='username'
					options={ {
						required: 'Username is required',
						validate: FormCreateStringValidator(UserNameSchema, 'username'),
					} }
				/>
				<FormFieldError error={ errors.username } />
			</FormField>
			<FormField>
				<label htmlFor='login-password'>Password</label>
				<FormInput
					type='password'
					id='login-password'
					autoComplete='current-password'
					readOnly={ isSubmitting }
					register={ register }
					name='password'
					options={ { required: 'Password is required' } }
				/>
				<FormFieldError error={ errors.password } />
			</FormField>
			{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
			<div className='login-actions'>
				<Button type='submit' disabled={ isSubmitting }>Sign in</Button>
				{
					passkeySupport.supported ? (
						<Button
							type='button'
							theme={ passkeySupport.conditional ? 'transparent' : 'semiTransparent' }
							disabled={ isSubmitting || isPasskeySubmitting }
							onClick={ () => {
								conditionalPasskeyAbort.current?.abort();
								void onPasskeyLogin();
							} }
						>
							Sign in with passkey
						</Button>
					) : null
				}
			</div>
			<FormLink to='/forgot_password'>Forgot your password?</FormLink>
			<FormLink to='/register'>Not a member? <strong>Sign up</strong></FormLink>
		</Form>
	);
}
