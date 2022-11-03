import { Assert } from 'pandora-common';
import React, { DetailedHTMLProps, ReactElement, SelectHTMLAttributes, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

export interface SelectProps extends Omit<DetailedHTMLProps<SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>, 'onChange'> {
	onChange?(ev: {
		currentTarget: HTMLSelectElement,
		target: HTMLSelectElement,
	}): void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ children, onChange, ...props }, ref): ReactElement {
	const innerRef = useRef<HTMLSelectElement>(null);

	useImperativeHandle(ref, () => innerRef.current as HTMLSelectElement);

	const readonly = !!(props.disabled || props['aria-disabled'] || props['aria-readonly']);

	const onWheelHandler = useCallback((ev: WheelEvent) => {
		// Handle wheel changing element
		const el = ev.currentTarget;
		Assert(el instanceof HTMLSelectElement);
		if (el === document.activeElement || readonly)
			return;
		if (ev.deltaY < 0) {
			ev.stopPropagation();
			ev.preventDefault();
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
			ev.preventDefault();
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

	useEffect(() => {
		const el = innerRef.current;
		if (el) {
			el.addEventListener('wheel', onWheelHandler, { passive: false });
			return () => {
				el.removeEventListener('wheel', onWheelHandler);
			};
		}
		return undefined;
	}, [innerRef, onWheelHandler]);

	return (
		<select { ...props } onChange={ onChange } ref={ innerRef }>
			{ children }
		</select>
	);
});
