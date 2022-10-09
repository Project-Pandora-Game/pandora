import React, { DetailedHTMLProps, ReactElement, SelectHTMLAttributes, useCallback } from 'react';

export interface SelectProps extends Omit<DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>, 'onWheel' | 'onChange'> {
	onChange?(ev: {
		currentTarget: HTMLSelectElement,
		target: HTMLSelectElement,
	}): void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ children, onChange, ...props }, ref): ReactElement {

	const readonly = !!(props.disabled || props['aria-disabled'] || props['aria-readonly']);

	// TODO: Can't prevent default from here, as React uses passive listeners - remake into custom component and use Refs to prevent default
	const onWheelHandler = useCallback((ev: React.WheelEvent<HTMLSelectElement>) => {
		// Handle wheel changing element
		const el = ev.currentTarget;
		if (el === document.activeElement || readonly)
			return;
		if (ev.deltaY < 0) {
			ev.stopPropagation();
			const newIndex = Math.max(el.selectedIndex - 1, 0);
			if (el.selectedIndex !== newIndex) {
				el.selectedIndex = newIndex;
				onChange?.({
					currentTarget: el,
					target: el,
				});
			}
		} else if (ev.deltaY > 0) {
			ev.stopPropagation();
			const newIndex = Math.min(el.selectedIndex + 1, el.length - 1);
			if (el.selectedIndex !== newIndex) {
				el.selectedIndex = newIndex;
				onChange?.({
					currentTarget: el,
					target: el,
				});
			}
		}
	}, [onChange, readonly]);

	return (
		<select { ...props } onWheel={ onWheelHandler } onChange={ onChange } ref={ ref }>
			{ children }
		</select>
	);
});
