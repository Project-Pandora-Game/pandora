import React from 'react';
import { clamp } from 'lodash';

export type InputNumberProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value' | 'defaultValue' | 'min' | 'max'> & {
	onChange?: (value: number) => void;
	parse?: (value: string, radix?: number) => number;
	resetTimer?: number;
	value?: number;
	defaultValue?: number;
	min?: number;
	max?: number;
	step?: number;
};

export const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(function InputNumber({
	onChange,
	parse = parseInt,
	resetTimer = 1000,
	value,
	defaultValue,
	...props
}, ref) {
	const [inputValue, setInputValue] = React.useState((value ?? defaultValue ?? props.min ?? props.max ?? 0).toString());
	const resetTimeout = React.useRef<null | number>(null);

	const onChangeEvent = React.useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = ev.target.value;
		setInputValue(newValue);

		if (resetTimeout.current != null) {
			clearTimeout(resetTimeout.current);
			resetTimeout.current = null;
		}

		const parsed = parse(newValue, 10);
		if (!isNaN(parsed)) {
			const clamped = ClampAndStepValue(parsed, props.min, props.max, props.step);
			onChange?.(clamped);
			resetTimeout.current = setTimeout(() => {
				setInputValue(clamped.toString());
			}, resetTimer);
		}
	}, [onChange, parse, props.min, props.max, props.step, resetTimer]);

	React.useEffect(() => {
		if (value == null || value === parse(inputValue))
			return;

		if (resetTimeout.current != null) {
			clearTimeout(resetTimeout.current);
			resetTimeout.current = null;
		}

		resetTimeout.current = setTimeout(() => {
			setInputValue(value.toString());
		}, resetTimer);
	}, [value, inputValue, parse, resetTimer]);

	return <input { ...props } type='number' onChange={ onChangeEvent } value={ inputValue } ref={ ref } />;
});

function ClampAndStepValue(value: number, min: number = -Infinity, max: number = Infinity, step?: number) {
	let clamped = clamp(value, min, max);
	if (step != null) {
		const stepCount = Math.round((clamped - min) / step);
		clamped = stepCount * step + min;
	}
	return clamped;
}
