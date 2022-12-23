import { AssertNever, IsEmail } from 'pandora-common';
import React, { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useDirectoryPasswordReset } from '../../../networking/account_manager';
import { Button } from '../../common/button/button';
import { Form, FormField, FormFieldError, FormLink } from '../../common/form/form';

export interface ForgotPasswordFormData {
	email: string;
}

export function ForgotPasswordForm(): ReactElement {
	const navigate = useNavigate();
	const passwordReset = useDirectoryPasswordReset();

	const {
		formState: { errors, submitCount },
		handleSubmit,
		register,
	} = useForm<ForgotPasswordFormData>({ shouldUseNativeValidation: true });

	const onSubmit = handleSubmit(({ email }) => {
		void (async () => {
			const result = await passwordReset(email);

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
		})();
	});

	return (
		<Form className='ForgotPasswordForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Forgot password</h1>
			<FormField>
				<label htmlFor='forgot-password-email'>Enter your email</label>
				<input
					type='email'
					id='forgot-password-email'
					autoComplete='email'
					{ ...register('email', {
						required: 'Email is required',
						validate: (email) => IsEmail(email) || 'Invalid email format',
					}) }
				/>
				<FormFieldError error={ errors.email } />
			</FormField>
			<Button type='submit'>Send reset email</Button>
			<FormLink to='/reset_password'>Already have a reset code?</FormLink>
			<FormLink to='/login'>◄ Return to login</FormLink>
		</Form>
	);
}
