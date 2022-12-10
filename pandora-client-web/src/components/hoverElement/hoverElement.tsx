import classNames from 'classnames';
import React, { ReactElement, RefObject, useEffect, useState } from 'react';
import { CommonProps } from '../../common/reactTypes';
import { useContextMenuPosition } from '../contextMenu/contextMenu';
import './hoverElement.scss';

type HoverElementProps = CommonProps & {
	parent: RefObject<HTMLElement>;
};

export function HoverElement({ children, className, parent }: HoverElementProps): ReactElement | null {
	const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (!parent.current)
			return;

		const current = parent.current;

		const hover = (event: PointerEvent) => {
			setAnchorPoint({ x: event.pageX, y: event.pageY - (event.pointerType === 'mouse' ? 16 : 32) });
			setShow(true);
		};
		const end = (_event: PointerEvent) => {
			setShow(false);
		};
		current.addEventListener('pointerover', hover);
		current.addEventListener('pointermove', hover);
		current.addEventListener('pointerleave', end);
		return () => {
			current.removeEventListener('pointerover', hover);
			current.removeEventListener('pointermove', hover);
			current.removeEventListener('pointerleave', end);
		};
	}, [parent]);

	const positionRef = useContextMenuPosition(anchorPoint, {
		xLocation: 'center',
		yLocation: 'up',
	});

	if (!show)
		return null;

	return (
		<div className={ classNames('hover-element', className) } ref={ positionRef }>
			{ children }
		</div>
	);
}
