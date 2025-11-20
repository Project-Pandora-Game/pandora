import { AssertNever, DisplayNameSchema, EmailAddressSchema, PasswordSchema, UserNameSchema } from 'pandora-common';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useForm, Validate } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { toast } from 'react-toastify';
import { FormInput } from '../../../common/userInteraction/input/formInput.tsx';
import { DEVELOPMENT } from '../../../config/Environment.ts';
import { useDirectoryRegister } from '../../../networking/account_manager.ts';
import { useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { Button } from '../../common/button/button.tsx';
import { Column } from '../../common/container/container.tsx';
import { Form, FormCreateStringValidator, FormField, FormFieldError, FormLink } from '../../common/form/form.tsx';
import { FormFieldCaptcha } from '../../common/form/formFieldCaptcha.tsx';
import { ExternalLink } from '../../common/link/externalLink.tsx';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';
import { useAuthFormData } from '../authFormDataProvider.tsx';

export interface RegistrationFormData {
	username: string;
	displayName: string;
	email: string;
	password: string;
	passwordConfirm: string;
	betaKey: string;
	captchaToken: string;
}

export function RegistrationForm(): ReactElement {
	const { disableRegistration } = useObservable(useDirectoryConnector().directoryStatus);

	if (disableRegistration) {
		return (
			<Column alignX='center'>
				<div className='warning-box'>
					<strong>Registration is currently disabled</strong>
				</div>
				<Link to='/login'>Already have an account? <strong>Sign in</strong></Link>
			</Column>
		);
	}

	return <RegistrationFormInner />;
}

function RegistrationFormInner(): ReactElement {
	const { search } = useLocation();
	const prefillBetaKey = new URLSearchParams(search).get('betaKey') ?? '';

	const directoryConnector = useDirectoryConnector();
	const directoryStatus = useObservable(directoryConnector.directoryStatus);
	const directoryRegister = useDirectoryRegister();
	const [usernameTaken, setUsernameTaken] = useState('');
	const [emailTaken, setEmailTaken] = useState('');
	const [invalidBetaKey, setInvalidBetaKey] = useState('');
	const [captchaToken, setCaptchaToken] = useState('');
	const [captchaFailed, setCaptchaFailed] = useState(false);
	const navigate = useNavigatePandora();
	const { setState: setAuthData } = useAuthFormData();
	const {
		formState: { errors, submitCount, isSubmitting },
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

	const validateDisplayName = useCallback<Validate<string, RegistrationFormData>>((displayName) => {
		const formatValidator = FormCreateStringValidator(DisplayNameSchema, 'display name');
		const validationResult = formatValidator(displayName);
		if (validationResult != null)
			return validationResult;

		return true;
	}, []);

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

	const onSubmit = handleSubmit(async ({ username, displayName, email, password, betaKey }) => {
		setUsernameTaken('');
		setEmailTaken('');
		setCaptchaFailed(false);

		const result = await directoryRegister(username, displayName, password, email, betaKey || undefined, captchaToken);

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
		} else if (result === 'failed') {
			toast('Registration failed', TOAST_OPTIONS_ERROR);
		} else {
			AssertNever(result);
		}
	});

	return (
		<Form className='RegistrationForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Sign up</h1>
			<FormField>
				<label htmlFor='registration-username'>Username</label>
				<FormInput
					type='text'
					id='registration-username'
					autoComplete='username'
					placeholder='e.g. mona'
					register={ register }
					name='username'
					options={ {
						required: 'Username is required',
						validate: validateUsername,
					} }
				/>
				<FormFieldError error={ errors.username } />
			</FormField>
			<FormField>
				<label htmlFor='registration-display-name'>User display name (shown to others)</label>
				<FormInput
					type='text'
					id='registration-display-name'
					autoComplete='off'
					placeholder='e.g. Mona the Maid'
					register={ register }
					name='displayName'
					options={ {
						required: 'User display name is required',
						validate: validateDisplayName,
					} }
				/>
				<p />
			</FormField>
			<FormField>
				<label htmlFor='registration-email'>Email</label>
				<FormInput
					type='email'
					id='registration-email'
					autoComplete='email'
					register={ register }
					name='email'
					options={ {
						required: 'Email is required',
						validate: validateEmail,
					} }
				/>
				<FormFieldError error={ errors.email } />
			</FormField>
			<FormField>
				<label htmlFor='registration-password'>Password</label>
				<FormInput
					type='password'
					id='registration-password'
					autoComplete='new-password'
					register={ register }
					name='password'
					options={ {
						required: 'Password is required',
						validate: DEVELOPMENT ? undefined : FormCreateStringValidator(PasswordSchema, 'password'),
					} }
				/>
				{
					DEVELOPMENT ? (
						<em>Running in development mode.<br />Password restrictions are disabled.</em>
					) : null
				}
				<FormFieldError error={ errors.password } />
			</FormField>
			<FormField>
				<label htmlFor='registration-passwordConfirm'>Confirm password</label>
				<FormInput
					type='password'
					id='registration-passwordConfirm'
					autoComplete='new-password'
					register={ register }
					name='passwordConfirm'
					options={ {
						required: 'Please confirm your password',
						validate: (passwordConfirm) => {
							const password = getValues('password');
							return (passwordConfirm === password) || 'Passwords do not match';
						},
					} }
				/>
				<FormFieldError error={ errors.passwordConfirm } />
			</FormField>
			{ betaKeyRequired ? (
				<FormField>
					<label htmlFor='registration-beta-key'>Beta key</label>
					<FormInput
						type='text'
						id='registration-beta-key'
						autoComplete='off'
						register={ register }
						defaultValue={ prefillBetaKey }
						name='betaKey'
						options={ {
							required: 'Beta key is required',
							validate: (betaKey) => (betaKey !== invalidBetaKey) || 'Invalid beta key provided',
						} }
					/>
					<FormFieldError error={ errors.betaKey } />
				</FormField>
			) : null }
			<span className='FormText'>
				{ betaKeyRequired ? 'You can get a beta key on our ' : 'We also recommend to join our ' }
				<ExternalLink className='inline' href='https://discord.gg/EnaPvuQf8d' sendReferrer>Discord</ExternalLink>.
			</span>
			<FormFieldCaptcha setCaptchaToken={ setCaptchaToken } invalidCaptcha={ captchaFailed } />
			<Button type='submit' disabled={ isSubmitting }>Register</Button>
			<FormLink to='/login'>Already have an account? <strong>Sign in</strong></FormLink>
		</Form>
	);
}
