import { createHtmlPortalNode, HtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import React, { createContext, useContext, ReactElement, PureComponent, ReactNode, useCallback, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { noop, sortBy } from 'lodash';
import { ChildrenProps } from '../../common/reactTypes';
import { Button, ButtonProps } from '../common/button/button';
import { Observable, useObservable } from '../../observable';
import './dialog.scss';
import { useEvent } from '../../common/useEvent';
import { DivContainer } from '../common/container/container';
import classNames from 'classnames';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HtmlPortalNodeAny = HtmlPortalNode<any>;

const DEFAULT_CONFIRM_DIALOG_SYMBOL = Symbol('DEFAULT_CONFIRM_DIALOG_SYMBOL');

const PORTALS = new Observable<readonly ({
	priority: number;
	node: HtmlPortalNodeAny;
})[]>([]);

export function Dialogs(): ReactElement {
	const portals = useObservable(PORTALS);

	return (
		<>
			{ portals.map(({ node }, index) => (
				<OutPortal key={ index } node={ node } />
			)) }
			<ConfirmDialog symbol={ DEFAULT_CONFIRM_DIALOG_SYMBOL } />
		</>
	);
}

type DialogCloseContext = {
	close: () => void;
};

const dialogCloseContext = createContext<DialogCloseContext>({
	close: noop as () => void,
});

export class ModalDialog extends PureComponent<ChildrenProps & {
	/**
	 * Priority of this dialog for ordering the dialogs on screen.
	 * Higher priority dialogs cover lower priority dialogs.
	 * @default 0
	 */
	priority?: number;
	position?: 'center' | 'top';
}> {
	private readonly _node: HtmlPortalNodeAny;
	private readonly _context: DialogCloseContext;

	constructor(props: ChildrenProps) {
		super(props);
		this._node = createHtmlPortalNode();
		this._context = {
			close: () => this._close(),
		};
	}

	private _updateOwnEntry() {
		const { priority } = this.props;

		PORTALS.value = sortBy([
			{
				priority: priority ?? 0,
				node: this._node,
			},
			...PORTALS.value.filter(({ node }) => node !== this._node),
		], (v) => v.priority);
	}

	public override componentDidMount() {
		this._updateOwnEntry();
	}

	public override componentDidUpdate(prevProps: Readonly<ChildrenProps & { priority?: number | undefined; }>): void {
		const { priority } = this.props;

		if (prevProps.priority !== priority) {
			this._updateOwnEntry();
		}
	}

	public override componentWillUnmount() {
		this._close();
	}

	public override render() {
		const { children, position = 'center' } = this.props;
		return (
			<InPortal node={ this._node }>
				<div className={ classNames('dialog', position) }>
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
		PORTALS.value = PORTALS.value.filter(({ node }) => node !== this._node);
	}
}

export class DraggableDialog extends PureComponent<{
	children?: ReactNode;
	title: string;
	rawContent?: boolean;
	close?: () => void;
}> {
	private readonly _node: HtmlPortalNodeAny;
	private readonly _context: DialogCloseContext;

	constructor(props: {
		children?: ReactNode;
		title: string;
		rawContent?: boolean;
		close?: () => void;
	}) {
		super(props);
		this._node = createHtmlPortalNode();
		this._context = {
			close: () => this._close(),
		};
	}

	private _updateOwnEntry() {
		PORTALS.value = sortBy([
			{
				priority: -1,
				node: this._node,
			},
			...PORTALS.value.filter(({ node }) => node !== this._node),
		], (v) => v.priority);
	}

	public override componentDidMount() {
		this._updateOwnEntry();
	}

	public override componentWillUnmount() {
		this._close();
	}

	public override render() {
		const { children, title, rawContent, close } = this.props;
		return (
			<InPortal node={ this._node }>
				<div className='overlay-bounding-box'>
					<Rnd
						className='dialog-draggable'
						dragHandleClassName='drag-handle'
						default={ {
							x: Math.max((window.innerWidth ?? 0) / 4 - 20, 0),
							y: Math.max((window.innerHeight ?? 0) / 8 - 10, 0),
							width: 'auto',
							height: 'auto',
						} }
						bounds='parent'
					>
						<dialogCloseContext.Provider value={ this._context }>
							<header className='drag-handle'>
								{ title }
								{ close ? (
									<span className='dialog-close' onClick={ close }>
										×
									</span>
								) : null }
							</header>
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
		PORTALS.value = PORTALS.value.filter(({ node }) => node !== this._node);
	}
}

export function useDialogClose() {
	return useContext(dialogCloseContext);
}

export function DialogCloseButton({ children, ...props }: ButtonProps): ReactElement {
	const { close } = useDialogClose();
	return (
		<Button { ...props } onClick={ () => close() }>
			{ children }
		</Button>
	);
}

type ConfirmDialogEntry = Readonly<{
	title: string;
	handler: (result: boolean) => void;
}>;

const CONFIRM_DIALOGS = new Map<symbol, Observable<ConfirmDialogEntry | null>>();

function GetConfirmDialogEntry(symbol: symbol) {
	let entry = CONFIRM_DIALOGS.get(symbol);
	if (!entry) {
		CONFIRM_DIALOGS.set(symbol, entry = new Observable<ConfirmDialogEntry | null>(null));
	}
	return entry;
}

function useConfirmDialogController(symbol: symbol): {
	open: boolean;
	title: string;
	onConfirm: () => void;
	onCancel: () => void;
} {
	const observed = useObservable(GetConfirmDialogEntry(symbol));
	const onConfirm = useEvent(() => {
		if (observed == null)
			return;

		observed.handler(true);
	});
	const onCancel = useEvent(() => {
		if (observed == null)
			return;

		observed.handler(false);
	});
	const open = observed != null;
	const title = observed != null ? observed.title : '';
	return {
		open,
		title,
		onConfirm,
		onCancel,
	};
}

type ConfirmDialogProps = {
	symbol: symbol;
	yes?: ReactNode;
	no?: ReactNode;
};

export function ConfirmDialog({ symbol, yes = 'Ok', no = 'Cancel' }: ConfirmDialogProps) {
	const { open, title, onConfirm, onCancel } = useConfirmDialogController(symbol);

	if (!open)
		return null;

	return (
		<ModalDialog>
			<h1>{ title }</h1>
			<DivContainer gap='small' justify='end'>
				<Button onClick={ onCancel }>
					{ no }
				</Button>
				<Button onClick={ onConfirm }>
					{ yes }
				</Button>
			</DivContainer>
		</ModalDialog>
	);
}

export function useConfirmDialog(symbol: symbol = DEFAULT_CONFIRM_DIALOG_SYMBOL): (title: string) => Promise<boolean> {
	const unset = useRef(false);
	const entry = GetConfirmDialogEntry(symbol);
	useEffect(() => () => {
		if (unset.current) {
			entry.value = null;
		}
	}, [entry]);
	return useCallback((title: string) => new Promise<boolean>((resolve) => {
		unset.current = true;
		entry.value = {
			title,
			handler: (result) => {
				unset.current = false;
				entry.value = null;
				resolve(result);
			},
		};
	}), [entry]);
}
