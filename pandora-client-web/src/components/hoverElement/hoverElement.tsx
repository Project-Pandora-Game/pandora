import classNames from 'classnames';
import React, { PureComponent, ReactElement, useEffect, useState } from 'react';
import { ChildrenProps, CommonProps } from '../../common/reactTypes';
import { useContextMenuPosition } from '../contextMenu/contextMenu';
import { createHtmlPortalNode, HtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import { Observable, useObservable } from '../../observable';
import './hoverElement.scss';

const PORTALS = new Observable<readonly HtmlPortalNode[]>([]);

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
		<HoverElementInner>
			<div className={ classNames('hover-element', className) } ref={ positionRef }>
				{ children }
			</div>
		</HoverElementInner>
	);
}

class HoverElementInner extends PureComponent<ChildrenProps> {
	private readonly _node: HtmlPortalNode;

	constructor(props: ChildrenProps) {
		super(props);
		this._node = createHtmlPortalNode();
	}

	public override componentDidMount() {
		PORTALS.produce((old) => old.concat([this._node]));
	}

	public override componentWillUnmount() {
		PORTALS.produce((old) => old.filter((p) => p !== this._node));
	}

	public override render() {
		const { children } = this.props;

		return (
			<InPortal node={ this._node }>
				{ children }
			</InPortal>
		);
	}
}

export function HoverElementsPortal(): ReactElement {
	const portals = useObservable(PORTALS);

	return (
		<>
			{ portals.map((node, index) => (
				<OutPortal key={ index } node={ node } />
			)) }
		</>
	);
}
