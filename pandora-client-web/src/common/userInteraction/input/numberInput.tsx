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

		let newValue = this.element.valueAsNumber;

		// Return old value if read failed
		if (Number.isNaN(newValue)) {
			return this.lastValidValue;
		}

		// Limit the value
		if (min !== undefined && newValue < min) {
			newValue = min;
		}
		if (max !== undefined && newValue > max) {
			newValue = max;
		}

		return newValue;
	}

	protected override isReadonly(): boolean {
		const { disabled, readOnly } = this.props;

		return !!(disabled || readOnly);
	}
}
