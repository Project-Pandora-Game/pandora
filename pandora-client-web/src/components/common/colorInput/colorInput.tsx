import _ from 'lodash';
import { type HexColorString, HexColorStringSchema } from 'pandora-common';
import React, { useState, type ChangeEvent, useCallback, useMemo, type ReactElement } from 'react';
import { Button } from '../button/button';

export function ColorInput({
	initialValue, resetValue, onChange, throttle = 0, disabled = false, hideTextInput = false,
}: {
	initialValue: HexColorString;
	resetValue?: HexColorString;
	onChange?: (value: HexColorString) => void;
	throttle?: number;
	disabled?: boolean;
	hideTextInput?: boolean;
}): ReactElement {
	const [value, setInput] = useState<HexColorString>(initialValue.toUpperCase() as HexColorString);

	const onChangeCaller = useCallback((color: HexColorString) => onChange?.(color), [onChange]);
	const onChangeCallerThrottled = useMemo(() => throttle <= 0 ? onChangeCaller : _.throttle(onChangeCaller, throttle), [onChangeCaller, throttle]);

	const changeCallback = useCallback((input: string) => {
		input = '#' + input.replace(/[^0-9a-f]/gi, '').toUpperCase();
		setInput(input as HexColorString);
		const valid = HexColorStringSchema.safeParse(input).success;
		if (valid) {
			onChangeCallerThrottled(input as HexColorString);
		}
	}, [setInput, onChangeCallerThrottled]);

	const onInputChange = (ev: ChangeEvent<HTMLInputElement>) => changeCallback(ev.target.value);

	return (
		<>
			{ !hideTextInput && <input type='text' value={ value } onChange={ onInputChange } disabled={ disabled } maxLength={ 7 } /> }
			<input type='color' value={ value } onChange={ onInputChange } disabled={ disabled } />
			{
				resetValue != null &&
				<Button className='slim' onClick={ () => changeCallback(resetValue) }>↺</Button>
			}
		</>
	);
}

export function useColorInput(initialValue?: HexColorString) {
	return useState((initialValue ?? '#ffffff').toUpperCase() as HexColorString);
}
