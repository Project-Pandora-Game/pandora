import classNames from 'classnames';
import React, { ReactNode, useReducer } from 'react';
import { useEvent } from '../../../common/useEvent.ts';
import './fieldsetToggle.scss';

type FieldsetToggleProps = {
	legend: ReactNode;
	children?: ReactNode;
	className?: string;
	open?: boolean;
	forceOpen?: boolean;
	onChange?: (value: boolean) => void;
	persistent?: string;
};
export function FieldsetToggle({ legend, children, className, open: initialState = true, forceOpen, onChange, persistent }: FieldsetToggleProps) {
	const [open, toggleOpen] = usePersistentOpen(initialState, persistent);

	const effectiveOpen = forceOpen != null ? forceOpen : open;

	const onClick = useEvent((event: React.MouseEvent<HTMLElement>) => {
		event.preventDefault();
		onChange?.(!effectiveOpen);
		if (forceOpen == null) {
			toggleOpen();
		}
	});

	return (
		<fieldset className={ classNames('fieldset-toggle', className) }>
			<legend className={ classNames('fieldset-toggle-legend', effectiveOpen && 'open') } onClick={ onClick }>
				{ legend }
			</legend>
			{ effectiveOpen && children }
		</fieldset>
	);
}

const STATES = new Map<string, boolean>();
function usePersistentOpen(initialState: boolean, key?: string): [boolean, () => void] {
	return useReducer((state: boolean) => {
		if (key !== undefined) {
			STATES.set(key, !state);
		}
		return !state;
	}, (key !== undefined ? STATES.get(key) : undefined) ?? initialState);
}
