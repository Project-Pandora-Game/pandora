import classNames from 'classnames';
import { ReactElement } from 'react';
import { DivContainer, DivContainerProps } from '../container/container';
import './selectionIndicator.scss';

export interface SelectionIndicatorProps extends DivContainerProps {
	/** @default false */
	selected?: boolean;
	/** @default false */
	active?: boolean;
}

export function SelectionIndicator({
	selected = false,
	active = false,
	children,
	className,
	...divContainerProps
}: SelectionIndicatorProps): ReactElement {
	return (
		<DivContainer
			{ ...divContainerProps }
			className={ classNames(
				'selectionIndicator',
				selected ? 'selected' : null,
				active ? 'active' : null,
				className,
			) }
		>
			{ children }
		</DivContainer>
	);
}
