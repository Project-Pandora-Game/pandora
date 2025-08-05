import { AssertNever, IsEmail } from 'pandora-common';
import { ReactElement, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'react-toastify';
import { FormInput } from '../../../common/userInteraction/input/formInput.tsx';
import { useDirectoryResendVerification } from '../../../networking/account_manager.ts';
import { useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { Button } from '../../common/button/button.tsx';
import { Column } from '../../common/container/container.tsx';
import { Form, FormField, FormFieldError, FormLink } from '../../common/form/form.tsx';
import { FormFieldCaptcha } from '../../common/form/formFieldCaptcha.tsx';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';

export interface ResendVerificationFormData {
	email: string;
}

export function ResendVerificationForm(): ReactElement {
	const { disableEmailVerification } = useObservable(useDirectoryConnector().directoryStatus);

	if (disableEmailVerification) {
		return (
			<Column alignX='center'>
				<div className='warning-box'>
					<strong>Email verification is currently disabled</strong>
				</div>
				<Link to='/login'>◄ Return to login</Link>
			</Column>
		);
	}

	return <ResendVerificationFormInner />;
}

function ResendVerificationFormInner(): ReactElement {
	const navigate = useNavigatePandora();
	const resendVerification = useDirectoryResendVerification();
	const [captchaToken, setCaptchaToken] = useState('');
	const [captchaFailed, setCaptchaFailed] = useState(false);

	const {
		formState: { errors, submitCount, isSubmitting },
		handleSubmit,
		register,
	} = useForm<ResendVerificationFormData>({ shouldUseNativeValidation: true, progressive: true });

	const onSubmit = handleSubmit(async ({ email }) => {
		setCaptchaFailed(false);

		const result = await resendVerification(email, captchaToken);

		if (result === 'maybeSent') {
			navigate('/login', {
				state: {
					message: 'An email with a verification code has been sent to the submitted email address, if there is an account registered using it.',
				},
			});
			return;
		} else if (result === 'invalidCaptcha') {
			setCaptchaFailed(true);
		} else if (result === 'failed') {
			toast('Request failed', TOAST_OPTIONS_ERROR);
		} else {
			AssertNever(result);
		}
	});

	return (
		<Form className='ForgotPasswordForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Resend email</h1>
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
						validate: (email) => IsEmail(email) || 'Invalid email format',
					} }
				/>
				<FormFieldError error={ errors.email } />
			</FormField>
			<FormFieldCaptcha setCaptchaToken={ setCaptchaToken } invalidCaptcha={ captchaFailed } />
			<Button type='submit' disabled={ isSubmitting }>Resend verification email</Button>
			<FormLink to='/override_verification'>Entered a wrong email during registration?</FormLink>
			<FormLink to='/login'>◄ Return to login</FormLink>
		</Form>
	);
}
