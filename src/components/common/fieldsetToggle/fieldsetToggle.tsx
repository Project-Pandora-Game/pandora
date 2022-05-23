import classNames from 'classnames';
import React, { useReducer, ReactNode } from 'react';
import './fieldsetToggle.scss';

type FieldsetToggleProps = {
	legend: ReactNode;
	children: ReactNode;
	className?: string;
	open?: boolean;
	persistent?: string;
};
export function FieldsetToggle({ legend, children, className, open: initialState = true, persistent }: FieldsetToggleProps) {
	const [open, toggleOpen] = usePersistentOpen(initialState, persistent);

	const onClick = (event: React.MouseEvent<HTMLElement>) => {
		event.preventDefault();
		toggleOpen();
	};

	return (
		<fieldset className={ classNames('fieldset-toggle', className) }>
			<legend className={ classNames('fieldset-toggle-legend', open && 'open') } onClick={ onClick }>
				{legend}
			</legend>
			{open && children}
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
	}, (key !== undefined && STATES.get(key)) ?? initialState);
}
