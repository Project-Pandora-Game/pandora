import { pick } from 'lodash-es';
import { AssertNever, type HexColorString } from 'pandora-common';
import type { InputHTMLAttributes, ReactElement } from 'react';
import { useMemo } from 'react';
import ReactSwitch, { type ReactSwitchProps } from 'react-switch';
import { Color } from '../../components/common/colorInput/colorInput.tsx';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';

const FORWARDED_PROPS = [
	'id',
	'className',
	'disabled',
] as const satisfies readonly (keyof ReactSwitchProps)[];

export interface SwitchProps extends Pick<InputHTMLAttributes<HTMLInputElement>, (typeof FORWARDED_PROPS)[number]> {
	checked: boolean;
	onChange: (newValue: boolean) => void;
	label?: string;
	/** @default 'normal' */
	size?: 'small' | 'normal';
}

export function Switch(props: SwitchProps): ReactElement {
	const { checked, onChange, label, size } = props;
	const forwardedProps = pick(props, FORWARDED_PROPS);
	const { interfaceAccentColor } = useAccountSettings();

	// Mix 60% accent color to #222
	const onColor = useMemo((): HexColorString => {
		let color = new Color(interfaceAccentColor);
		color = color.setValue(33 + Math.floor(0.6 * color.value));
		return color.toHex();
	}, [interfaceAccentColor]);

	let height: number;
	switch (size) {
		case 'small':
			height = 22;
			break;
		case 'normal':
		case undefined:
			height = 28;
			break;
		default:
			AssertNever(size);
	}

	return (
		<ReactSwitch
			{ ...forwardedProps }
			aria-label={ label }
			title={ label }
			checked={ checked }
			onChange={ (newValue, event) => {
				event.stopPropagation();
				onChange(newValue);
			} }
			offColor='#334'
			onColor={ onColor }
			offHandleColor='#889'
			onHandleColor='#ccc'
			height={ height }
			width={ 2 * height }
		/>
	);
}
