/* eslint-disable react/forbid-elements */
import { pick } from 'lodash';
import { Assert } from 'pandora-common';
import React, { type InputHTMLAttributes } from 'react';
import { InputBase, type InputBaseProps } from './inputBase';

const FORWARDED_PROPS = [
	// Basic
	'id',
	'className',
	'readOnly',
	'disabled',
	// Validation
	'required',
	// Presentation
	'aria-haspopup',
	'aria-label',
	'autoComplete',
	'inputMode',
	'list',
	'placeholder',
	'size',
	'spellCheck',
	// Events
	'onKeyDown',
	'onKeyPress',
	'onKeyUp',
	'onPaste',
] as const satisfies readonly (keyof InputHTMLAttributes<HTMLInputElement>)[];

export interface NumberInputProps extends InputBaseProps<number>, Pick<InputHTMLAttributes<HTMLInputElement>, (typeof FORWARDED_PROPS)[number]> {
	/**
	 * Whether to display this input as a range slider instead of standard numeric input.
	 * @default false
	 */
	rangeSlider?: boolean;
	min?: number;
	max?: number;
	step?: number;
}

export class NumberInput extends InputBase<number, NumberInputProps, HTMLInputElement> {

	public override render(): React.ReactNode {
		const {
			value,
			min,
			max,
			step,
			rangeSlider,
		} = this.props;
		const forwardedProps = pick(this.props, FORWARDED_PROPS);

		return (
			<input
				{ ...forwardedProps }
				ref={ this.elementRef }
				type={ rangeSlider ? 'range' : 'number' }
				defaultValue={ value }
				onChange={ this.elementOnChange }
				min={ min }
				max={ max }
				step={ step }
			/>
		);
	}

	protected override setValue(value: number): void {
		Assert(this.element != null);

		this.element.valueAsNumber = value;
	}

	protected override getValue(): number {
		Assert(this.element != null);

		const { min, max } = this.props;

		const newValue = this.element.valueAsNumber;

		const isValid = !Number.isNaN(newValue) &&
		(min === undefined || newValue >= min) &&
		(max === undefined || newValue <= max);

		// Return old if invalid
		if (!isValid) {
			return this.lastValidValue;
		}

		return newValue;
	}

	protected override isReadonly(): boolean {
		const { disabled, readOnly } = this.props;

		return !!(disabled || readOnly);
	}
}
