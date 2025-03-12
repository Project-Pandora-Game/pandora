import { AssertNever, FormatTimeInterval, IsEmail, UserNameSchema } from 'pandora-common';
import { ReactElement, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { FormInput } from '../../../common/userInteraction/input/formInput.tsx';
import { useDirectoryResendVerificationAdvanced } from '../../../networking/account_manager.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { Button } from '../../common/button/button.tsx';
import { Form, FormCreateStringValidator, FormErrorMessage, FormField, FormFieldError, FormLink } from '../../common/form/form.tsx';
import { FormFieldCaptcha } from '../../common/form/formFieldCaptcha.tsx';

export interface ResendVerificationAdvancedFormData {
	username: string;
	password: string;
	email: string;
}

export function ResendVerificationAdvancedForm(): ReactElement {
	const navigate = useNavigatePandora();
	const resendVerificationAdvanced = useDirectoryResendVerificationAdvanced();
	const [errorMessage, setErrorMessage] = useState('');
	const [captchaToken, setCaptchaToken] = useState('');
	const [captchaFailed, setCaptchaFailed] = useState(false);
	// Always override the email. If the user got this far, it is most likely they don't know the email they used.
	const overrideEmail = true;

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
				showError('Rate limited, please try again in: ' + FormatTimeInterval(result.time, 'two-most-significant'));
				break;
			default:
				AssertNever(result);
		}
	});

	return (
		<Form className='ForgotPasswordForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Reset registration email</h1>
			<FormField>
				<label htmlFor='forgot-activation-username'>Username</label>
				<FormInput
					type='text'
					id='forgot-activation-username'
					autoComplete='username'
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
				<label htmlFor='forgot-activation-password'>Password</label>
				<FormInput
					type='password'
					id='forgot-activation-password'
					autoComplete='current-password'
					register={ register }
					name='password'
					options={ { required: 'Password is required' } }
				/>
				<FormFieldError error={ errors.password } />
			</FormField>
			<FormField>
				<label htmlFor='forgot-activation-email'>Enter new email</label>
				<FormInput
					type='email'
					id='forgot-activation-email'
					autoComplete='email'
					register={ register }
					name='email'
					options={ {
						required: 'Email is required',
						validate: (email) => IsEmail(email) || 'Invalid email format',
					} }
				/>
				<FormFieldError error={ errors.email } />
			</FormField>
			<FormFieldCaptcha setCaptchaToken={ setCaptchaToken } invalidCaptcha={ captchaFailed } />
			{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
			<Button type='submit' disabled={ isSubmitting }>
				{ overrideEmail ? 'Change account email' : 'Resend verification email' }
			</Button>
			<FormLink to='/login'>◄ Return to login</FormLink>
		</Form>
	);
}
