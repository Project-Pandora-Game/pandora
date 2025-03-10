import classNames from 'classnames';
import { capitalize } from 'lodash-es';
import { GetLogger } from 'pandora-common';
import { FormEvent, HTMLProps, ReactElement, RefAttributes, useCallback } from 'react';
import { FieldError } from 'react-hook-form';
import { Link, LinkProps } from 'react-router-dom';
import type { Promisable } from 'type-fest';
import { z } from 'zod';
import { CommonProps } from '../../../common/reactTypes.ts';
import './form.scss';

export interface AuthFormProps extends CommonProps {
	dirty?: boolean;
	onSubmit?: (event: FormEvent<HTMLFormElement>) => Promisable<void>;
}

export function Form({ children, className, dirty = false, id, onSubmit }: AuthFormProps): ReactElement {
	const submitHandler = useCallback((event: FormEvent<HTMLFormElement>): void => {
		(async () => {
			await onSubmit?.(event);
		})()
			.catch((err) => {
				GetLogger('Form').error('Error handling form submit: ', err);
			});
	}, [onSubmit]);

	return (
		<form className={ classNames('Form', className, { dirty }) } id={ id } onSubmit={ submitHandler }>
			{ children }
		</form>
	);
}

export function FormField(props: HTMLProps<HTMLDivElement>): ReactElement {
	const { className } = props;
	return <div { ...props } className={ classNames('FormField', className) } />;
}

export function FormCreateStringValidator(schema: z.ZodString, displayName: string): (value: string) => string | undefined {
	return (value) => {
		const result = schema.safeParse(value);

		if (result.success)
			return undefined;

		for (const issue of result.error.issues) {
			switch (issue.code) {
				case 'too_big':
					return `${capitalize(displayName)} must be at most ${issue.maximum} characters long`;
				case 'too_small':
					return `${capitalize(displayName)} must be at least ${issue.minimum} characters long`;
			}
		}

		return `Invalid ${displayName} format`;
	};
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
	const { error, ...otherProps } = props;
	return (
		<FormError { ...otherProps } error={ error?.message } />
	);
}

export interface FormErrorProps extends HTMLProps<HTMLSpanElement> {
	children?: never;
	error: string | undefined;
}

export function FormError(props: FormErrorProps): ReactElement {
	const { error, className, ...spanProps } = props;
	return (
		<span { ...spanProps } className={ classNames('FormFieldError', className, { empty: !error }) }>
			{ error }
		</span>
	);
}

export function FormLink(props: LinkProps & RefAttributes<HTMLAnchorElement>): ReactElement {
	const { className } = props;
	return <Link { ...props } className={ classNames('FormLink', className) } />;
}
