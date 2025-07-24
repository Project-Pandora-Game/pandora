import { AssertNever, IsSimpleToken, PasswordSchema, SIMPLE_TOKEN_LENGTH, UserNameSchema } from 'pandora-common';
import { ReactElement, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { FormInput } from '../../../common/userInteraction/input/formInput.tsx';
import { DEVELOPMENT } from '../../../config/Environment.ts';
import { useDirectoryPasswordResetConfirm } from '../../../networking/account_manager.ts';
import { useObservable } from '../../../observable.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { Button } from '../../common/button/button.tsx';
import { Column } from '../../common/container/container.tsx';
import { Form, FormCreateStringValidator, FormErrorMessage, FormField, FormFieldError, FormLink } from '../../common/form/form.tsx';
import { LocationStateMessage } from '../../common/locationStateMessage/locationStateMessage.tsx';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider.tsx';

export interface ResetPasswordFormData {
	username: string;
	token: string;
	password: string;
	passwordConfirm: string;
}

export function ResetPasswordForm(): ReactElement {
	const { disablePasswordReset } = useObservable(useDirectoryConnector().directoryStatus);

	if (disablePasswordReset) {
		return (
			<Column alignX='center'>
				<div className='warning-box'>
					<strong>Password reset is currently disabled</strong>
				</div>
				<Link to='/login'>◄ Return to login</Link>
			</Column>
		);
	}

	return <ResetPasswordFormInner />;
}

function ResetPasswordFormInner(): ReactElement {
	const navigate = useNavigatePandora();
	const [errorMessage, setErrorMessage] = useState('');
	const passwordResetConfirm = useDirectoryPasswordResetConfirm();
	const {
		formState: { errors, submitCount, isSubmitting },
		getValues,
		handleSubmit,
		register,
	} = useForm<ResetPasswordFormData>({ shouldUseNativeValidation: true, progressive: true });

	const onSubmit = handleSubmit(async ({ username, token, password }) => {
		const result = await passwordResetConfirm(username, token, password);

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
		} else if (result === 'failed') {
			setErrorMessage('Request failed');
		} else {
			AssertNever(result);
		}
	});

	return (
		<Form className='ResetPasswordForm' dirty={ submitCount > 0 } onSubmit={ onSubmit }>
			<h1>Reset password</h1>
			<LocationStateMessage />
			<FormField>
				<label htmlFor='reset-password-username'>Username</label>
				<FormInput
					type='text'
					id='reset-password-username'
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
				<label htmlFor='reset-password-token'>Reset code</label>
				<FormInput
					type='text'
					id='reset-password-token'
					autoComplete='one-time-code'
					register={ register }
					name='token'
					options={ {
						required: 'Reset code is required',
						minLength: {
							message: `Reset code must be exactly ${ SIMPLE_TOKEN_LENGTH } characters`,
							value: SIMPLE_TOKEN_LENGTH,
						},
						maxLength: {
							message: `Reset code must be exactly ${ SIMPLE_TOKEN_LENGTH } characters`,
							value: SIMPLE_TOKEN_LENGTH,
						},
						validate: (token) => IsSimpleToken(token) || 'Invalid reset code format',
					} }
				/>
				<FormFieldError error={ errors.token } />
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
			{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
			<Button type='submit' disabled={ isSubmitting }>Reset password</Button>
			<FormLink to='/login'>◄ Return to login</FormLink>
		</Form>
	);
}
