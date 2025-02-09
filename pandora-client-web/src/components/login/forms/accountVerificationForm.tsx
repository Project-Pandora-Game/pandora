import { GetLogger, IsSimpleToken, IsString, IsUsername } from 'pandora-common';
import { ReactElement, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { FormInput } from '../../../common/userInteraction/input/formInput';
import { Button } from '../../common/button/button';
import { Form, FormErrorMessage, FormField, FormFieldError, FormLink } from '../../common/form/form';
import { useAuthFormData } from '../authFormDataProvider';
import { useLoginForm } from './useLoginForm';

const VERIFICATION_CODE_LENGTH = 6;

const logger = GetLogger('AccountVerificationForm');

export function AccountVerificationForm(): ReactElement {
	const { state: { username, password, justRegistered } } = useAuthFormData();
	const navigate = useNavigate();
	const { dirty, errorMessage, errors, onSubmit, isSubmitting, register } = useLoginForm(true);

	useEffect(() => {
		if (!IsUsername(username) || !IsString(password) || !password.length) {
			logger.warning('No username or password provided. Redirecting to login page.');
			navigate('/login');
		}
	}, [username, password, navigate]);

	return (
		<Form className='AccountVerificationForm' dirty={ dirty } onSubmit={ onSubmit }>
			<h1>Club login</h1>
			<p>
				Account { justRegistered ? 'successfully created' : 'verification needed' }. Please check your email for
				your verification code.
			</p>
			<FormField>
				<label htmlFor='verify-token'>Verification code</label>
				<FormInput
					type='text'
					id='verify-token'
					autoComplete='one-time-code'
					register={ register }
					name='token'
					options={ {
						required: 'Verification code is required',
						minLength: {
							message: `Verification code must be exactly ${ VERIFICATION_CODE_LENGTH } characters`,
							value: VERIFICATION_CODE_LENGTH,
						},
						maxLength: {
							message: `Verification code must be exactly ${ VERIFICATION_CODE_LENGTH } characters`,
							value: VERIFICATION_CODE_LENGTH,
						},
						validate: (token) => IsSimpleToken(token) || 'Invalid verification code format',
					} }
				/>
				<FormFieldError error={ errors.token } />
			</FormField>
			{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
			<Button type='submit' disabled={ isSubmitting }>Sign in</Button>
			<FormLink to='/resend_verification_email'>Didn't receive a code by email?</FormLink>
		</Form>
	);
}
