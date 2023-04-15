import classNames from 'classnames';
import React, { FormEvent, HTMLProps, ReactElement, RefAttributes, useCallback } from 'react';
import { FieldError } from 'react-hook-form';
import { Link, LinkProps } from 'react-router-dom';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Promisable } from 'type-fest';
import { CommonProps } from '../../../common/reactTypes';
import './form.scss';
import { useObservable } from '../../../observable';
import { useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';

export interface AuthFormProps extends CommonProps {
	dirty?: boolean;
	onSubmit?: (event: FormEvent<HTMLFormElement>) => Promisable<void>;
}

export function Form({ children, className, dirty = false, id, onSubmit }: AuthFormProps): ReactElement {
	return (
		<form className={ classNames('Form', className, { dirty }) } id={ id } onSubmit={ onSubmit }>
			{ children }
		</form>
	);
}

export function FormField(props: HTMLProps<HTMLDivElement>): ReactElement {
	const { className } = props;
	return <div { ...props } className={ classNames('FormField', className) } />;
}

export function FormErrorMessage(props: HTMLProps<HTMLParagraphElement>): ReactElement {
	const { className } = props;
	return <p { ...props } className={ classNames('FormErrorMessage', className) } />;
}

export interface FormFieldErrorProps extends HTMLProps<HTMLSpanElement> {
	children?: never;
	error: FieldError | undefined;
}

export function FormFieldError(props: FormFieldErrorProps): ReactElement {
	const { error, className, ...spanProps } = props;
	return (
		<span { ...spanProps } className={ classNames('FormFieldError', className, { empty: !error }) }>
			{ error && error.message }
		</span>
	);
}

export function FormLink(props: LinkProps & RefAttributes<HTMLAnchorElement>): ReactElement {
	const { className } = props;
	return <Link { ...props } className={ classNames('FormLink', className) } />;
}

export function FormFieldCaptcha({
	setCaptchaToken,
	invalidCaptcha,
}: {
	setCaptchaToken: (token: string) => void;
	invalidCaptcha: boolean;
}): ReactElement | null {
	const directoryConnector = useDirectoryConnector();
	const captchaSiteKey = useObservable(directoryConnector.directoryStatus).captchaSiteKey;

	const clear = useCallback(() => {
		setCaptchaToken('');
	}, [setCaptchaToken]);

	if (!captchaSiteKey) {
		return null;
	}

	return (
		<FormField>
			<HCaptcha
				sitekey={ captchaSiteKey }
				onVerify={ setCaptchaToken }
				onExpire={ clear }
				onError={ clear }
				reCaptchaCompat={ false }
				theme='dark'
			/>
			<FormFieldError error={ invalidCaptcha ? { type: 'invalidCaptcha' } : undefined } />
		</FormField>
	);
}
