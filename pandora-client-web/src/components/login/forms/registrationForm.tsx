import { AssertNever, EmailAddressSchema, PasswordSha512Schema, UserNameSchema } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { useForm, Validate } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useDirectoryRegister } from '../../../networking/account_manager';
import { useObservable } from '../../../observable';
import { Button } from '../../common/button/button';
import { Form, FormCreateStringValidator, FormField, FormFieldCaptcha, FormFieldError, FormLink } from '../../common/form/form';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import { useAuthFormData } from '../authFormDataProvider';

export interface RegistrationFormData {
	username: string;
	email: string;
	password: string;
	passwordConfirm: string;
	betaKey: string;
	captchaToken: string;
}

export function RegistrationForm(): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const directoryStatus = useObservable(directoryConnector.directoryStatus);
	const directoryRegister = useDirectoryRegister();
	const [usernameTaken, setUsernameTaken] = useState('');
	const [emailTaken, setEmailTaken] = useState('');
	const [invalidBetaKey, setInvalidBetaKey] = useState('');
	const [captchaToken, setCaptchaToken] = useState('');
	const [captchaFailed, setCaptchaFailed] = useState(false);
	const navigate = useNavigate();
	const { setState: setAuthData } = useAuthFormData();
	const {
		formState: { errors, submitCount },
		getValues,
		handleSubmit,
		register,
		trigger,
	} = useForm<RegistrationFormData>({ shouldUseNativeValidation: true, progressive: true });

	const betaKeyRequired = !!directoryStatus.betaKeyRequired;

	const validateUsername = useCallback<Validate<string, RegistrationFormData>>((username) => {
		if (username === usernameTaken) {
			return 'Username already taken';
		}

		const formatValidator = FormCreateStringValidator(UserNameSchema, 'username');
		const validationResult = formatValidator(username);
		if (validationResult != null)
			return validationResult;

		return true;
	}, [usernameTaken]);

	const validateEmail = useCallback<Validate<string, RegistrationFormData>>((email) => {
		if (email === emailTaken) {
			return 'Email already in use';
		}

		const formatValidator = FormCreateStringValidator(EmailAddressSchema, 'email');
		const validationResult = formatValidator(email);
		if (validationResult != null)
			return validationResult;

		return true;
	}, [emailTaken]);

	useEffect(() => {
		if (usernameTaken || emailTaken || invalidBetaKey) {
			void trigger();
		}
	}, [usernameTaken, emailTaken, invalidBetaKey, trigger]);

	const onSubmit = handleSubmit(({ username, email, password, betaKey }) => {
		void (async () => {
			setUsernameTaken('');
			setEmailTaken('');
			setCaptchaFailed(false);

			const result = await directoryRegister(username, password, email, betaKey || undefined, captchaToken);

			if (result === 'ok') {
				setAuthData({ username, password, justRegistered: true });
				navigate('/login_verify');
				return;
			} else if (result === 'usernameTaken') {
				setUsernameTaken(username);
			} else if (result === 'emailTaken') {
				setEmailTaken(email);
			} else if (result === 'invalidBetaKey') {
				setInvalidBetaKey(betaKey);
			} else if (result === 'invalidCaptcha') {
				setCaptchaFailed(true);
			} else {
				AssertNever(result);
			}
		})();
	});

	return (
		<Form className='RegistrationForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Sign up</h1>
			<FormField>
				<label htmlFor='registration-username'>Username (will be visible to other users)</label>
				<input
					type='text'
					id='registration-username'
					autoComplete='username'
					{ ...register('username', {
						required: 'Username is required',
						validate: validateUsername,
					}) }
				/>
				<FormFieldError error={ errors.username } />
			</FormField>
			<FormField>
				<label htmlFor='registration-email'>Email</label>
				<input
					type='email'
					id='registration-email'
					autoComplete='email'
					{ ...register('email', {
						required: 'Email is required',
						validate: validateEmail,
					}) }
				/>
				<FormFieldError error={ errors.email } />
			</FormField>
			<FormField>
				<label htmlFor='registration-password'>Password</label>
				<input
					type='password'
					id='registration-password'
					autoComplete='new-password'
					{ ...register('password', {
						required: 'Password is required',
						validate: FormCreateStringValidator(PasswordSha512Schema, 'password'),
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
			{ betaKeyRequired &&
				<FormField>
					<label htmlFor='registration-beta-key'>Beta key</label>
					<input
						type='text'
						id='registration-beta-key'
						autoComplete='off'
						{ ...register('betaKey', {
							required: 'Beta key is required',
							validate: (betaKey) => (betaKey !== invalidBetaKey) || 'Invalid beta key provided',
						}) }
					/>
					<FormFieldError error={ errors.betaKey } />
				</FormField> }
			<FormFieldCaptcha setCaptchaToken={ setCaptchaToken } invalidCaptcha={ captchaFailed } />
			<Button type='submit'>Register</Button>
			<FormLink to='/login'>Already have an account? <strong>Sign in</strong></FormLink>
		</Form>
	);
}
