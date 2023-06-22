import classNames from 'classnames';
import React, { ReactElement, useEffect, useState } from 'react';
import { CommonProps } from '../../common/reactTypes';
import { useContextMenuPosition } from '../contextMenu/contextMenu';
import './hoverElement.scss';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';

const hoverPortal = createHtmlPortalNode();

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
		<InPortal node={ hoverPortal }>
			<div className={ classNames('hover-element', className) } ref={ positionRef }>
				{ children }
			</div>
		</InPortal>
	);
}

export function HoverElementsPortal(): ReactElement {
	return <OutPortal node={ hoverPortal } />;
}
