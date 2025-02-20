/* eslint-disable react/forbid-elements */
import { pick } from 'lodash';
import type { InputHTMLAttributes, ReactElement } from 'react';

const FORWARDED_PROPS = [
	'id',
	'className',
	'autoComplete',
	'readOnly',
	'disabled',
] as const satisfies readonly (keyof InputHTMLAttributes<HTMLInputElement>)[];

export interface CheckboxProps extends Pick<InputHTMLAttributes<HTMLInputElement>, (typeof FORWARDED_PROPS)[number]> {
	checked: boolean;
	onChange: (newValue: boolean) => void;
}

export function Checkbox(props: CheckboxProps): ReactElement {
	const { checked, onChange } = props;
	const forwardedProps = pick(props, FORWARDED_PROPS);

	return (
		<input
			{ ...forwardedProps }
			type='checkbox'
			checked={ checked }
			onChange={ (event) => {
				event.stopPropagation();
				onChange(event.target.checked);
			} }
		/>
	);
}
