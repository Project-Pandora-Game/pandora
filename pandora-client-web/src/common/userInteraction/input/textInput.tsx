/* eslint-disable react/forbid-elements */
import { pick } from 'lodash-es';
import { Assert } from 'pandora-common';
import React, { type InputHTMLAttributes } from 'react';
import { InputBase, type InputBaseProps } from './inputBase.tsx';

const FORWARDED_PROPS = [
	// Basic
	'id',
	'className',
	'readOnly',
	'disabled',
	'autoFocus',
	'style',
	// Validation
	'maxLength',
	'minLength',
	'pattern',
	'required',
	// Presentation
	'aria-haspopup',
	'autoCapitalize',
	'autoComplete',
	'autoCorrect',
	'inputMode',
	'placeholder',
	'size',
	'spellCheck',
	'list',
	// Events
	'onKeyDown',
	'onKeyPress',
	'onKeyUp',
	'onPaste',
] as const satisfies readonly (keyof InputHTMLAttributes<HTMLInputElement>)[];

export interface TextInputProps extends InputBaseProps<string>, Pick<InputHTMLAttributes<HTMLInputElement>, (typeof FORWARDED_PROPS)[number]> {
	/**
	 * This is a sensitive password input - hide the entered text.
	 * @default false
	 */
	password?: boolean;
}

export class TextInput extends InputBase<string, TextInputProps, HTMLInputElement> {

	public override render(): React.ReactNode {
		const {
			password = false,
		} = this.props;
		const forwardedProps = pick(this.props, FORWARDED_PROPS);

		return (
			<input
				{ ...forwardedProps }
				ref={ this.elementRef }
				type={ password ? 'password' : 'text' }
				defaultValue={ this.props.value }
				onChange={ this.elementOnChange }
			/>
		);
	}

	protected override setValue(value: string): void {
		Assert(this.element != null);

		this.element.value = value;
	}

	protected override getValue(): string {
		Assert(this.element != null);

		return this.element.value;
	}

	protected override isReadonly(): boolean {
		const { disabled, readOnly } = this.props;

		return !!(disabled || readOnly);
	}
}
