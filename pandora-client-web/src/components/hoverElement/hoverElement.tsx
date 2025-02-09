import classNames from 'classnames';
import { ReactElement, useEffect, useState } from 'react';
import { CommonProps } from '../../common/reactTypes';
import { useContextMenuPosition } from '../contextMenu/contextMenu';
import { DialogInPortal } from '../dialog/dialog';
import './hoverElement.scss';

type HoverElementProps = CommonProps & {
	parent: HTMLElement | null;
};

export function HoverElement({ children, className, parent }: HoverElementProps): ReactElement | null {
	const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (!parent)
			return;

		const hover = (event: PointerEvent) => {
			setAnchorPoint({ x: event.pageX, y: event.pageY - (event.pointerType === 'mouse' ? 32 : 48) });
			setShow(true);
		};
		const end = (_event: PointerEvent) => {
			setShow(false);
		};
		parent.addEventListener('pointerover', hover);
		parent.addEventListener('pointermove', hover);
		parent.addEventListener('pointerleave', end);
		return () => {
			parent.removeEventListener('pointerover', hover);
			parent.removeEventListener('pointermove', hover);
			parent.removeEventListener('pointerleave', end);
			setShow(false);
		};
	}, [parent]);

	const positionRef = useContextMenuPosition(anchorPoint, {
		xLocation: 'center',
		yLocation: 'up',
	});

	if (!show)
		return null;

	return (
		<DialogInPortal location='global' priority={ 100 }>
			<div className={ classNames('hover-element', className) } ref={ positionRef }>
				{ children }
			</div>
		</DialogInPortal>
	);
}
