import { createHtmlPortalNode, HtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import React, { createContext, useContext, ReactElement, PureComponent, ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import { noop } from 'lodash';
import { ChildrenProps } from '../../common/reactTypes';
import { Button, ButtonProps } from '../common/Button/Button';
import { Observable, useObservable } from '../../observable';
import './dialog.scss';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HtmlPortalNodeAny = HtmlPortalNode<any>;

const PORTALS = new Observable<readonly HtmlPortalNodeAny[]>([]);

export function Dialogs(): ReactElement {
	const portals = useObservable(PORTALS);

	return (
		<>
			{portals.map((node, index) => (
				<OutPortal key={ index } node={ node } />
			))}
		</>
	);
}

type DialogCloseContext = {
	close: () => void,
};

const dialogCloseContext = createContext<DialogCloseContext>({
	close: noop as () => void,
});

export class Dialog extends PureComponent<ChildrenProps> {
	private readonly _node: HtmlPortalNodeAny;
	private readonly _context: DialogCloseContext;

	constructor(props: ChildrenProps) {
		super(props);
		this._node = createHtmlPortalNode();
		this._context = {
			close: () => this._close(),
		};
	}

	override componentDidMount() {
		PORTALS.value = [this._node, ...PORTALS.value.filter((n) => n !== this._node)];
	}

	override componentWillUnmount() {
		this._close();
	}

	override render() {
		const { children } = this.props;
		return (
			<InPortal node={ this._node }>
				<div className='dialog'>
					<div className='dialog-content'>
						<dialogCloseContext.Provider value={ this._context }>
							{ children }
						</dialogCloseContext.Provider>
					</div>
				</div>
			</InPortal>
		);
	}

	private _close() {
		PORTALS.value = PORTALS.value.filter((n) => n !== this._node);
	}
}

export class DraggableDialog extends PureComponent<{
	children?: ReactNode;
	title: string;
	rawContent?: boolean;
}> {
	private readonly _node: HtmlPortalNodeAny;
	private readonly _context: DialogCloseContext;

	constructor(props: {
		children?: ReactNode;
		title: string;
		rawContent?: boolean;
	}) {
		super(props);
		this._node = createHtmlPortalNode();
		this._context = {
			close: () => this._close(),
		};
	}

	override componentDidMount() {
		PORTALS.value = [this._node, ...PORTALS.value.filter((n) => n !== this._node)];
	}

	override componentWillUnmount() {
		this._close();
	}

	override render() {
		const { children, title, rawContent } = this.props;
		return (
			<InPortal node={ this._node }>
				<div className='overlay-bounding-box'>
					<Rnd
						className='dialog-draggable'
						dragHandleClassName='drag-handle'
						default={{
							x: Math.max((window.visualViewport?.width ?? 0) / 4 - 20, 0),
							y: Math.max((window.visualViewport?.height ?? 0) / 4 - 20, 0),
							width: 'auto',
							height: 'auto',
						}}
						bounds='parent'
					>
						<dialogCloseContext.Provider value={ this._context }>
							<header className='drag-handle'>{ title }</header>
							{
								rawContent ? children : (
									<div className='dialog-content'>
										{ children }
									</div>
								)
							}
						</dialogCloseContext.Provider>
					</Rnd>
				</div>
			</InPortal>
		);
	}

	private _close() {
		PORTALS.value = PORTALS.value.filter((n) => n !== this._node);
	}
}

export function useDialogClose() {
	return useContext(dialogCloseContext);
}

export function DialogCloseButton({ children, ...props }: ButtonProps): ReactElement {
	const { close } = useDialogClose();
	return (
		<Button { ...props } onClick={ () => close() }>
			{children}
		</Button>
	);
}
