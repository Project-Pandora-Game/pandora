import { AssertNever, IsEmail, UserNameSchema } from 'pandora-common';
import React, { ReactElement, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useDirectoryResendVerificationAdvanced } from '../../../networking/account_manager';
import { Button } from '../../common/button/button';
import { Form, FormCreateStringValidator, FormErrorMessage, FormField, FormFieldCaptcha, FormFieldError, FormLink } from '../../common/form/form';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast';
import { Row } from '../../common/container/container';

export interface ResendVerificationAdvancedFormData {
	username: string;
	password: string;
	email: string;
}

export function ResendVerificationAdvancedForm(): ReactElement {
	const navigate = useNavigate();
	const resendVerificationAdvanced = useDirectoryResendVerificationAdvanced();
	const [errorMessage, setErrorMessage] = useState('');
	const [captchaToken, setCaptchaToken] = useState('');
	const [captchaFailed, setCaptchaFailed] = useState(false);
	const [overrideEmail, setOverrideEmail] = useState(false);

	const {
		formState: { errors, submitCount, isSubmitting },
		handleSubmit,
		register,
	} = useForm<ResendVerificationAdvancedFormData>({ shouldUseNativeValidation: true, progressive: true });

	const showError = useCallback((error: string) => {
		toast(error, TOAST_OPTIONS_ERROR);
		setErrorMessage(error);
	}, []);

	const onSubmit = handleSubmit(async ({ username, password, email }) => {
		setCaptchaFailed(false);

		const result = await resendVerificationAdvanced(username, password, email, overrideEmail, captchaToken);

		switch (result.result) {
			case 'ok': {
				let message: string;
				if (overrideEmail) {
					message = 'The account email has been changed, verification email has been sent to the new email address';
				} else {
					message = 'An email with a verification code has been successfully sent to the account email address';
				}
				toast(message, TOAST_OPTIONS_SUCCESS);
				navigate('/login', { state: { message } });
				return;
			}
			case 'unknownCredentials':
				showError('Invalid username or password');
				break;
			case 'invalidCaptcha':
				setCaptchaFailed(true);
				break;
			case 'invalidEmail':
				showError('Email address does not match the account');
				break;
			case 'emailTaken':
				showError('Email address is already in use');
				break;
			case 'alreadyActivated':
				showError('Account is already activated');
				break;
			case 'rateLimited':
				showError('Rate limited');
				break;
			default:
				AssertNever(result);
		}
	});

	return (
		<Form className='ForgotPasswordForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Resend activation email</h1>
			<FormField>
				<label htmlFor='forgot-activation-username'>Username</label>
				<input
					type='text'
					id='forgot-activation-username'
					autoComplete='username'
					{ ...register('username', {
						required: 'Username is required',
						validate: FormCreateStringValidator(UserNameSchema, 'username'),
					}) }
				/>
				<FormFieldError error={ errors.username } />
			</FormField>
			<FormField>
				<label htmlFor='forgot-activation-password'>Password</label>
				<input
					type='password'
					id='forgot-activation-password'
					autoComplete='current-password'
					{ ...register('password', { required: 'Password is required' }) }
				/>
				<FormFieldError error={ errors.password } />
			</FormField>
			<FormField>
				<label htmlFor='forgot-activation-email'>Enter your email</label>
				<input
					type='email'
					id='forgot-activation-email'
					autoComplete='email'
					{ ...register('email', {
						required: 'Email is required',
						validate: (email) => IsEmail(email) || 'Invalid email format',
					}) }
				/>
				<FormFieldError error={ errors.email } />
			</FormField>
			<FormField>
				<Row>
					<input
						type='checkbox'
						id='forgot-activation-override-email'
						checked={ overrideEmail }
						onChange={ (e) => setOverrideEmail(e.target.checked) }
					/>
					<label htmlFor='forgot-activation-override-email'>Override email</label>
				</Row>
			</FormField>
			<br />
			<FormFieldCaptcha setCaptchaToken={ setCaptchaToken } invalidCaptcha={ captchaFailed } />
			{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
			<Button type='submit' className='fadeDisabled' disabled={ isSubmitting }>
				{ overrideEmail ? 'Change account email' : 'Resend verification email' }
			</Button>
			<FormLink to='/login'>◄ Return to login</FormLink>
		</Form>
	);
}
