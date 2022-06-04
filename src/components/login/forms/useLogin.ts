import { AssertNever, GetLogger, IsString, IsUsername } from 'pandora-common';
import { FormEvent, useState } from 'react';
import { FieldErrors, useForm, UseFormRegister } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Promisable } from 'type-fest';
import { DirectoryLogin } from '../../../networking/account_manager';
import { useAuthFormData } from '../authFormDataProvider';

const logger = GetLogger('useLogin');

export interface UseLoginFormData {
	username: string;
	password: string;
	token: string;
}

export interface UseLoginReturn {
	dirty: boolean;
	errorMessage: string;
	errors: FieldErrors<UseLoginFormData>;
	onSubmit: (event: FormEvent<HTMLFormElement>) => Promisable<void>;
	register: UseFormRegister<UseLoginFormData>;
}

export function useLogin(useAuthData = false): UseLoginReturn {
	const [errorMessage, setErrorMessage] = useState('');
	const { state: authData, setState: setAuthData } = useAuthFormData();
	const {
		formState: { errors, submitCount },
		handleSubmit,
		register,
	} = useForm<UseLoginFormData>({ shouldUseNativeValidation: true });
	const navigate = useNavigate();
	const dirty = submitCount > 0;

	const onSubmit = handleSubmit(({ username: submittedUsername, password: submittedPassword, token }) => {
		const username = useAuthData ? authData.username : submittedUsername;
		const password = useAuthData ? authData.password : submittedPassword;

		if (!IsString(username) || !IsUsername(username) || !IsString(password) || password.length === 0) {
			logger.warning('No username or password provided. Redirecting to login page.');
			navigate('/login');
			return;
		}

		if (!useAuthData) {
			setAuthData({ username, password });
		}

		void (async () => {
			// Compare user info
			const result = await DirectoryLogin(username, password, token);

			const needsVerification = result === 'verificationRequired' || result === 'invalidToken';
			if (needsVerification) {
				navigate('/login_verify');
			}

			if (result === 'ok') {
				setErrorMessage('');
				navigate(authData.redirectPath ?? '/', { state: authData.redirectState });
				return;
			} else if (result === 'unknownCredentials') {
				// Invalid user data
				setErrorMessage('Invalid username or password');
			} else if (result === 'invalidToken') {
				setErrorMessage('Invalid verification code. Please make sure you entered your code correctly.');
			} else if (result !== 'verificationRequired') {
				AssertNever(result);
			}
		})();
	});

	return { dirty, errorMessage, errors, register, onSubmit };
}
