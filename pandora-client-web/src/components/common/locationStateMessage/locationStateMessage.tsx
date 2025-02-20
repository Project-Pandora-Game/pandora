import classNames from 'classnames';
import { IsObject } from 'pandora-common';
import { HTMLProps, ReactElement } from 'react';
import { useLocation } from 'react-router-dom';

export interface LocationStateMessageProps extends HTMLProps<HTMLParagraphElement> {
	children?: never;
}

export function LocationStateMessage(props: LocationStateMessageProps): ReactElement | null {
	const { className, ...rest } = props;
	const locationState = useLocation().state as unknown;
	const message = IsObject(locationState) && typeof locationState.message === 'string' ? locationState.message : '';
	if (message) {
		return (
			<p
				data-testid='LocationStateMessage'
				{ ...rest }
				className={ classNames('LocationStateMessage', className) }>
				{ message }
			</p>
		);
	} else {
		return null;
	}
}
