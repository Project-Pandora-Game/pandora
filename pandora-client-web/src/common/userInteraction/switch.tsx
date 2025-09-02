import { pick } from 'lodash-es';
import type { HexColorString } from 'pandora-common';
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
}

export function Switch(props: SwitchProps): ReactElement {
	const { checked, onChange, label } = props;
	const forwardedProps = pick(props, FORWARDED_PROPS);
	const { interfaceAccentColor } = useAccountSettings();

	// Mix 60% accent color to #222
	const onColor = useMemo((): HexColorString => {
		let color = new Color(interfaceAccentColor);
		color = color.setValue(33 + Math.floor(0.6 * color.value));
		return color.toHex();
	}, [interfaceAccentColor]);

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
			width={ 56 }
			height={ 28 }
		/>
	);
}
