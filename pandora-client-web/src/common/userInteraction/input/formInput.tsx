/* eslint-disable react/forbid-elements */
import { pick } from 'lodash-es';
import { type InputHTMLAttributes, type ReactElement } from 'react';
import type { FieldPath, FieldValues, RegisterOptions, UseFormRegister, UseFormRegisterReturn } from 'react-hook-form';

const FORWARDED_PROPS = [
	// Basic
	'id',
	'className',
	'readOnly',
	'autoFocus',
	'type',
	'defaultValue',
	// Presentation
	'aria-haspopup',
	'autoCapitalize',
	'autoComplete',
	'autoCorrect',
	'inputMode',
	'placeholder',
	'size',
	'spellCheck',
	// Events
	'onKeyDown',
	'onKeyPress',
	'onKeyUp',
	'onPaste',
] as const satisfies readonly Exclude<(keyof InputHTMLAttributes<HTMLInputElement>), keyof UseFormRegisterReturn>[];

export interface FormInputProps<TFieldValues extends FieldValues, TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> extends Pick<InputHTMLAttributes<HTMLInputElement>, (typeof FORWARDED_PROPS)[number]> {
	register: UseFormRegister<TFieldValues>;
	name: TFieldName;
	options?: NoInfer<RegisterOptions<TFieldValues, TFieldName>>;
}

/**
 * An input made to be used with the `register` call of a `useForm` hook.
 */
export function FormInput<TFieldValues extends FieldValues, TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({
	register,
	name,
	options,
	...props
}: FormInputProps<TFieldValues, TFieldName>): ReactElement {
	return (
		<input
			{ ...pick(props, FORWARDED_PROPS) }
			{ ...register(name, options) }
		/>
	);
}
