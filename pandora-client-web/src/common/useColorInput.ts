import _ from 'lodash';
import { HexColorStringSchema, type HexColorString } from 'pandora-common';
import { useCallback, useMemo, useState } from 'react';

/**
 *
 * @param initialValue - initial value of the input
 * @param init - props to pass to the input
 * @param init.onChange - onChange event handler
 * @param init.throttle - throttle time in ms
 * @returns [color, setColor]
 */
export function useColorInput(initialValue: HexColorString, {
	onChange,
	throttle = 0,
}: {
	onChange?: (value: HexColorString) => void;
	throttle?: number,
} = {}) {
	const [input, setInput] = useState<HexColorString>(initialValue.toUpperCase() as HexColorString);

	const onChangeCaller = useCallback((value: HexColorString) => onChange?.(value), [onChange]);
	const onChangeCallerThrottled = useMemo(() => throttle <= 0 ? onChangeCaller : _.throttle(onChangeCaller, throttle), [onChangeCaller, throttle]);

	const changeCallback = useCallback((value: string) => {
		value = '#' + value.replace(/[^0-9a-f]/gi, '').toUpperCase();
		setInput(value as HexColorString);
		const valid = HexColorStringSchema.safeParse(value).success;
		if (valid) {
			onChangeCallerThrottled(value as HexColorString);
		}
	}, [setInput, onChangeCallerThrottled]);

	return [input, changeCallback] as const;
}
