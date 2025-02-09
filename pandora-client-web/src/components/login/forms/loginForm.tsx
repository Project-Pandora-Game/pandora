import { UserNameSchema } from 'pandora-common';
import { ReactElement } from 'react';
import pandoraLogo from '../../../assets/icons/pandora.svg';
import { FormInput } from '../../../common/userInteraction/input/formInput';
import { TextInput } from '../../../common/userInteraction/input/textInput';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks';
import { Button } from '../../common/button/button';
import { DivContainer } from '../../common/container/container';
import { Form, FormCreateStringValidator, FormErrorMessage, FormField, FormFieldError, FormLink } from '../../common/form/form';
import { LocationStateMessage } from '../../common/locationStateMessage/locationStateMessage';
import { useAuthToken } from '../../gameContext/directoryConnectorContextProvider';
import { useLoginForm } from './useLoginForm';

export function LoginForm(): ReactElement {
	const auth = useAuthToken();
	const loggedIn = useCurrentAccount() != null;
	const { dirty, errorMessage, errors, onSubmit, isSubmitting, register } = useLoginForm();

	if (loggedIn) {
		return <div>Club membership was confirmed</div>;
	} else if (auth && auth.expires >= Date.now()) {
		return (
			<form>
				<div className='input-container'>
					<label htmlFor='login-uname'>Username</label>
					<TextInput
						autoComplete='username'
						id='login-uname'
						value={ auth.username }
						disabled
					/>
				</div>
				<div className='message'>
					Awaiting automatic login...
				</div>
			</form>
		);
	}

	return (
		<Form className='LoginForm' dirty={ dirty } onSubmit={ onSubmit }>
			<DivContainer justify='center' className='logo-container'>
				<img src={ pandoraLogo } alt='Pandora Logo' />
			</DivContainer>
			<LocationStateMessage />
			<FormField>
				<label htmlFor='login-username'>Username</label>
				<FormInput
					type='text'
					id='login-username'
					autoComplete='username'
					readOnly={ isSubmitting }
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
				<label htmlFor='login-password'>Password</label>
				<FormInput
					type='password'
					id='login-password'
					autoComplete='current-password'
					readOnly={ isSubmitting }
					register={ register }
					name='password'
					options={ { required: 'Password is required' } }
				/>
				<FormFieldError error={ errors.password } />
			</FormField>
			{ errorMessage && <FormErrorMessage>{ errorMessage }</FormErrorMessage> }
			<Button type='submit' disabled={ isSubmitting }>Sign in</Button>
			<FormLink to='/forgot_password'>Forgot your password?</FormLink>
			<FormLink to='/register'>Not a member? <strong>Sign up</strong></FormLink>
		</Form>
	);
}
