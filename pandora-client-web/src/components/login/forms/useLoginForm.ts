import { AssertNever, GetLogger, IsString, IsUsername } from 'pandora-common';
import { FormEvent, useState } from 'react';
import { FieldErrors, UseFormRegister, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { Promisable } from 'type-fest';
import { useLogin } from '../../../networking/account_manager';
import { useNotificationPermissionCheck } from '../../gameContext/notificationContextProvider';
import { useAuthFormData } from '../authFormDataProvider';

const logger = GetLogger('useLoginForm');

export interface UseLoginFormData {
	username: string;
	password: string;
	token: string;
}

export interface UseLoginFormReturn {
	dirty: boolean;
	errorMessage: string;
	errors: FieldErrors<UseLoginFormData>;
	onSubmit: (event: FormEvent<HTMLFormElement>) => Promisable<void>;
	isSubmitting: boolean;
	register: UseFormRegister<UseLoginFormData>;
}

export function useLoginForm(useAuthData = false): UseLoginFormReturn {
	const [errorMessage, setErrorMessage] = useState('');
	const login = useLogin();
	const { state: authData, setState: setAuthData } = useAuthFormData();
	const {
		formState: { errors, submitCount, isSubmitting },
		handleSubmit,
		register,
	} = useForm<UseLoginFormData>({ shouldUseNativeValidation: true, progressive: true });
	const navigate = useNavigate();
	const checkNotifications = useNotificationPermissionCheck();
	const dirty = submitCount > 0;

	const onSubmit = handleSubmit(async ({ username: submittedUsername, password: submittedPassword, token }) => {
		checkNotifications();

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

		// Compare user info
		const result = await login(username, password, token);

		const needsVerification = result === 'verificationRequired' || result === 'invalidToken';
		if (needsVerification) {
			navigate('/login_verify');
		}

		if (result === 'ok') {
			setErrorMessage('');
			return;
		} else if (result === 'unknownCredentials') {
			// Invalid user data
			setErrorMessage('Invalid username or password');
		} else if (result === 'invalidToken') {
			setErrorMessage('Invalid verification code. Please make sure you entered your code correctly.');
		} else if (result === 'invalidSecondFactor') {
			setErrorMessage('Invalid second factor');
		} else if (result !== 'verificationRequired') {
			AssertNever(result);
		}
	});

	return { dirty, errorMessage, errors, register, onSubmit, isSubmitting };
}
