import { AssertNever, IsSimpleToken, IsUsername } from 'pandora-common';
import React, { useState } from 'react';
import { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { DirectoryPasswordResetConfirm } from '../../../networking/account_manager';
import { Button } from '../../common/Button/Button';
import { LocationStateMessage } from '../../common/LocationStateMessage/locationStateMessage';
import { FormErrorMessage, Form, FormField, FormFieldError, FormLink } from '../../common/Form/form';

const RESET_CODE_LENGTH = 6;

export interface ResetPasswordFormData {
	username: string;
	token: string;
	password: string;
	passwordConfirm: string;
}

export function ResetPasswordForm(): ReactElement {
	const navigate = useNavigate();
	const [errorMessage, setErrorMessage] = useState('');
	const {
		formState: { errors, submitCount },
		getValues,
		handleSubmit,
		register,
	} = useForm<ResetPasswordFormData>({ shouldUseNativeValidation: true });

	const onSubmit = handleSubmit(({ username, token, password }) => {
		void (async () => {
			const result = await DirectoryPasswordResetConfirm(username, token, password);

			if (result === 'ok') {
				setErrorMessage('');
				navigate('/login', {
					state: {
						message: 'Your password has been changed and can now be used to log in.',
					},
				});
				return;
			} else if (result === 'unknownCredentials') {
				// Invalid user data
				setErrorMessage('Invalid username or token');
			} else {
				AssertNever(result);
			}
		})();
	});

	return (
		<Form className='ResetPasswordForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Reset password</h1>
			<LocationStateMessage />
			<FormField>
				<label htmlFor='reset-password-username'>Username</label>
				<input
					type='text'
					id='reset-password-username'
					autoComplete='username'
					{ ...register('username', {
						required: 'Username is required',
						validate: (username) => IsUsername(username) || 'Invalid username format',
					}) }
				/>
				<FormFieldError error={ errors.username } />
			</FormField>
			<FormField>
				<label htmlFor='reset-password-token'>Reset code</label>
				<input
					type='text'
					id='reset-password-token'
					autoComplete='one-time-code'
					{ ...register('token', {
						required: 'Reset code is required',
						minLength: {
							message: `Reset code must be exactly ${ RESET_CODE_LENGTH } characters`,
							value: RESET_CODE_LENGTH,
						},
						maxLength: {
							message: `Reset code must be exactly ${ RESET_CODE_LENGTH } characters`,
							value: RESET_CODE_LENGTH,
						},
						validate: (token) => IsSimpleToken(token) || 'Invalid reset code format',
					}) }
				/>
				<FormFieldError error={ errors.token } />
			</FormField>
			<FormField>
				<label htmlFor='registration-password'>Password</label>
				<input
					type='password'
					id='registration-password'
					autoComplete='new-password'
					{ ...register('password', {
						required: 'Password is required',
					}) }
				/>
				<FormFieldError error={ errors.password } />
			</FormField>
			<FormField>
				<label htmlFor='registration-passwordConfirm'>Confirm password</label>
				<input
					type='password'
					id='registration-passwordConfirm'
					autoComplete='new-password'
					{ ...register('passwordConfirm', {
						required: 'Please confirm your password',
						validate: (passwordConfirm) => {
							const password = getValues('password');
							return (passwordConfirm === password) || 'Passwords do not match';
						},
					}) }
				/>
				<FormFieldError error={ errors.passwordConfirm } />
			</FormField>
			{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
			<Button type='submit'>Reset password</Button>
			<FormLink to='/login'>◄ Return to login</FormLink>
		</Form>
	);
}
