import { pick } from 'lodash-es';
import { Assert } from 'pandora-common';
import React, { type TextareaHTMLAttributes } from 'react';
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
	'required',
	// Presentation
	'aria-haspopup',
	'autoCapitalize',
	'autoComplete',
	'autoCorrect',
	'inputMode',
	'placeholder',
	'rows',
	'spellCheck',
	// Events
	'onKeyDown',
	'onKeyPress',
	'onKeyUp',
	'onPaste',
] as const satisfies readonly (keyof TextareaHTMLAttributes<HTMLTextAreaElement>)[];

export interface TextInputProps extends InputBaseProps<string>, Pick<TextareaHTMLAttributes<HTMLTextAreaElement>, (typeof FORWARDED_PROPS)[number]> {
	// Nothing extra
}

export class TextAreaInput extends InputBase<string, TextInputProps, HTMLTextAreaElement> {

	public override render(): React.ReactNode {
		const forwardedProps = pick(this.props, FORWARDED_PROPS);

		return (
			<textarea
				{ ...forwardedProps }
				ref={ this.elementRef }
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
