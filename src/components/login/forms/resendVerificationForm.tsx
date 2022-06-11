import { AssertNever, IsEmail } from 'pandora-common';
import React, { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useDirectoryResendVerification } from '../../../networking/account_manager';
import { Button } from '../../common/Button/Button';
import { Form, FormField, FormFieldError, FormLink } from '../../common/Form/form';

export interface ResendVerificationFormData {
	email: string;
}

export function ResendVerificationForm(): ReactElement {
	const navigate = useNavigate();
	const resendVerification = useDirectoryResendVerification();

	const {
		formState: { errors, submitCount },
		handleSubmit,
		register,
	} = useForm<ResendVerificationFormData>({ shouldUseNativeValidation: true });

	const onSubmit = handleSubmit(({ email }) => {
		void (async () => {
			const result = await resendVerification(email);

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
	});

	return (
		<Form className='ForgotPasswordForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Resend email</h1>
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
			<Button type='submit'>Resend verification email</Button>
			<FormLink to='/login'>◄ Return to login</FormLink>
		</Form>
	);
}
