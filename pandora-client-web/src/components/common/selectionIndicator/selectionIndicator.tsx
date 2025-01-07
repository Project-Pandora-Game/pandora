import React, { ReactElement } from 'react';
import './selectionIndicator.scss';
import { DivContainer, DivContainerProps } from '../container/container';
import classNames from 'classnames';

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
