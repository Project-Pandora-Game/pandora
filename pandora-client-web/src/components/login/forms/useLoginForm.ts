import { AssertNever, GetLogger, IsString, IsUsername, type Promisable } from 'pandora-common';
import { type SubmitEvent, useCallback, useState } from 'react';
import { FieldErrors, UseFormRegister, useForm } from 'react-hook-form';
import { useLogin, usePasskeyLogin } from '../../../networking/account_manager.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useAuthFormData } from '../authFormDataProvider.tsx';

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
	onSubmit: (event: SubmitEvent<HTMLFormElement>) => Promisable<void>;
	onPasskeyLogin: () => Promisable<void>;
	onConditionalPasskeyLogin: (signal: AbortSignal) => Promisable<void>;
	isSubmitting: boolean;
	isPasskeySubmitting: boolean;
	register: UseFormRegister<UseLoginFormData>;
}

export function useLoginForm(useAuthData = false): UseLoginFormReturn {
	const [errorMessage, setErrorMessage] = useState('');
	const [isPasskeySubmitting, setIsPasskeySubmitting] = useState(false);
	const login = useLogin();
	const passkeyLogin = usePasskeyLogin();
	const { state: authData, setState: setAuthData } = useAuthFormData();
	const {
		formState: { errors, submitCount, isSubmitting },
		handleSubmit,
		register,
	} = useForm<UseLoginFormData>({ shouldUseNativeValidation: true, progressive: true });
	const navigate = useNavigatePandora();
	const dirty = submitCount > 0;

	const onSubmit = handleSubmit(async ({ username: submittedUsername, password: submittedPassword, token }) => {
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
		} else if (result === 'verificationRequired') {
			// NOOP
		} else if (result.result === 'accountDisabled') {
			setErrorMessage('This account is disabled with the following reason: \n' + result.reason);
		} else {
			AssertNever(result.result);
		}
	});

	const handlePasskeyLoginResult = useCallback((result: Awaited<ReturnType<typeof passkeyLogin>>): void => {
		if (result === 'ok') {
			setErrorMessage('');
		} else if (result === 'unknownCredentials') {
			setErrorMessage('No matching passkey was found');
		} else if (typeof result === 'object' && result.result === 'accountDisabled') {
			setErrorMessage('This account is disabled with the following reason: \n' + result.reason);
		} else {
			setErrorMessage('Passkey sign in failed');
		}
	}, []);

	const onPasskeyLogin = useCallback(async () => {
		setIsPasskeySubmitting(true);
		try {
			const result = await passkeyLogin();
			handlePasskeyLoginResult(result);
		} catch (error) {
			logger.warning('Passkey sign in failed:', error);
			setErrorMessage('Passkey sign in failed');
		} finally {
			setIsPasskeySubmitting(false);
		}
	}, [handlePasskeyLoginResult, passkeyLogin]);

	const onConditionalPasskeyLogin = useCallback(async (signal: AbortSignal) => {
		try {
			const result = await passkeyLogin({ mediation: 'conditional', signal });
			handlePasskeyLoginResult(result);
		} catch (error) {
			if (signal.aborted || (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')))
				return;

			logger.warning('Conditional passkey sign in failed:', error);
		}
	}, [handlePasskeyLoginResult, passkeyLogin]);

	return { dirty, errorMessage, errors, register, onSubmit, onPasskeyLogin, onConditionalPasskeyLogin, isSubmitting, isPasskeySubmitting };
}
