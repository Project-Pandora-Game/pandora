import classNames from 'classnames';
import React, { ReactElement, RefObject, useEffect, useState } from 'react';
import { CommonProps } from '../../common/reactTypes';
import { useContextMenuPosition } from '../contextMenu/contextMenu';
import './hoverElement.scss';

type HoverElementProps = CommonProps & {
	parent: RefObject<HTMLElement>;
};

const IS_MOUSE_DETECTED = window.matchMedia('(hover: hover)').matches;

export function HoverElement({ children, className, parent }: HoverElementProps): ReactElement | null {
	const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (!parent.current)
			return;

		const current = parent.current;

		if (!IS_MOUSE_DETECTED) {
			const hover = (event: TouchEvent) => {
				setAnchorPoint({ x: event.touches[0].pageX, y: event.touches[0].pageY - 32 });
				setShow(true);
			};
			const end = (_event: TouchEvent) => {
				setShow(false);
			};
			current.addEventListener('touchstart', hover);
			current.addEventListener('touchmove', hover);
			current.addEventListener('touchend', end);
			return () => {
				current.removeEventListener('touchstart', hover);
				current.addEventListener('touchmove', hover);
				current.removeEventListener('touchend', end);
			};
		} else {
			const hover = (event: MouseEvent) => {
				event.stopPropagation();
				event.preventDefault();
				setAnchorPoint({ x: event.pageX, y: event.pageY - 16 });
				setShow(true);
			};
			const end = (event: MouseEvent) => {
				event.preventDefault();
				setShow(false);
			};
			current.addEventListener('mouseenter', hover);
			current.addEventListener('mousemove', hover);
			current.addEventListener('mouseleave', end);
			return () => {
				current.removeEventListener('mouseenter', hover);
				current.removeEventListener('mousemove', hover);
				current.removeEventListener('mouseleave', end);
			};
		}
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
