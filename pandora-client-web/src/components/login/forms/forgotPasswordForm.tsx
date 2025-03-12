import { AssertNever, EmailAddressSchema } from 'pandora-common';
import { ReactElement, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormInput } from '../../../common/userInteraction/input/formInput.tsx';
import { useDirectoryPasswordReset } from '../../../networking/account_manager.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { Button } from '../../common/button/button.tsx';
import { Form, FormCreateStringValidator, FormField, FormFieldError, FormLink } from '../../common/form/form.tsx';
import { FormFieldCaptcha } from '../../common/form/formFieldCaptcha.tsx';

export interface ForgotPasswordFormData {
	email: string;
}

export function ForgotPasswordForm(): ReactElement {
	const navigate = useNavigatePandora();
	const passwordReset = useDirectoryPasswordReset();
	const [captchaToken, setCaptchaToken] = useState('');
	const [captchaFailed, setCaptchaFailed] = useState(false);

	const {
		formState: { errors, submitCount, isSubmitting },
		handleSubmit,
		register,
	} = useForm<ForgotPasswordFormData>({ shouldUseNativeValidation: true, progressive: true });

	const onSubmit = handleSubmit(async ({ email }) => {
		setCaptchaFailed(false);

		const result = await passwordReset(email, captchaToken);

		if (result === 'maybeSent') {
			navigate('/reset_password', {
				state: {
					message: 'An email with a reset code has been sent to the submitted email address, if there is an account registered using it.',
				},
			});
			return;
		} else if (result === 'invalidCaptcha') {
			setCaptchaFailed(true);
		} else {
			AssertNever(result);
		}
	});

	return (
		<Form className='ForgotPasswordForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Forgot password</h1>
			<div className='warning-box'>
				<h3>Warning</h3>
				<p>
					Resetting your password will permanently <b>delete all past Direct Messages</b> for you and the other party.
				</p>
				<p>
					If you know your current password and want to change it, use the "Security" tab in the settings instead.
				</p>
			</div>
			<FormField>
				<label htmlFor='forgot-password-email'>Enter your email</label>
				<FormInput
					type='email'
					id='forgot-password-email'
					autoComplete='email'
					register={ register }
					name='email'
					options={ {
						required: 'Email is required',
						validate: FormCreateStringValidator(EmailAddressSchema, 'email'),
					} }
				/>
				<FormFieldError error={ errors.email } />
			</FormField>
			<FormFieldCaptcha setCaptchaToken={ setCaptchaToken } invalidCaptcha={ captchaFailed } />
			<Button type='submit' disabled={ isSubmitting }>Send reset email</Button>
			<FormLink to='/reset_password'>Already have a reset code?</FormLink>
			<FormLink to='/login'>◄ Return to login</FormLink>
		</Form>
	);
}
