import { ComponentType } from 'react';
import { AccountVerificationForm } from '../components/login/forms/accountVerificationForm';
import { ForgotPasswordForm } from '../components/login/forms/forgotPasswordForm';
import { LoginForm } from '../components/login/forms/loginForm';
import { RegistrationForm } from '../components/login/forms/registrationForm';
import { ResendVerificationForm } from '../components/login/forms/resendVerificationForm';
import { ResetPasswordForm } from '../components/login/forms/resetPasswordForm';
import { ResendVerificationAdvancedForm } from '../components/login/forms/resendVerificationAdvancedForm';

export enum AuthPagePath {
	LOGIN = '/login',
	LOGIN_VERIFY = '/login_verify',
	REGISTER = '/register',
	FORGOT_PASSWORD = '/forgot_password',
	RESEND_EMAIL = '/resend_verification_email',
	OVERRIDE_VERIFICATION = '/override_verification',
	RESET_PASSWORD = '/reset_password',
}

const authPageComponentMap: Record<AuthPagePath, ComponentType<Record<string, never>>> = {
	[AuthPagePath.LOGIN]: LoginForm,
	[AuthPagePath.LOGIN_VERIFY]: AccountVerificationForm,
	[AuthPagePath.REGISTER]: RegistrationForm,
	[AuthPagePath.FORGOT_PASSWORD]: ForgotPasswordForm,
	[AuthPagePath.RESEND_EMAIL]: ResendVerificationForm,
	[AuthPagePath.OVERRIDE_VERIFICATION]: ResendVerificationAdvancedForm,
	[AuthPagePath.RESET_PASSWORD]: ResetPasswordForm,
};

export const authPagePathsAndComponents = Object.entries(authPageComponentMap);
export const authPageComponents = Object.values(authPageComponentMap);
