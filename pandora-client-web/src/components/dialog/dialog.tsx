import classNames from 'classnames';
import { sortBy } from 'lodash';
import React, { ReactElement, ReactNode, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createHtmlPortalNode, HtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import { Rnd } from 'react-rnd';
import { type CommonProps } from '../../common/reactTypes';
import { useAsyncEvent, useEvent } from '../../common/useEvent';
import { useKeyDownEvent } from '../../common/useKeyDownEvent';
import type { PointLike } from '../../graphics/graphicsCharacter';
import { Observable, useObservable } from '../../observable';
import { Button, ButtonProps } from '../common/button/button';
import { Column, Row } from '../common/container/container';
import './dialog.scss';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HtmlPortalNodeAny = HtmlPortalNode<any>;

const DEFAULT_CONFIRM_DIALOG_SYMBOL = Symbol('DEFAULT_CONFIRM_DIALOG_SYMBOL');
const DEFAULT_CONFIRM_DIALOG_PRIORITY = 10;

export type DialogLocation = 'global' | 'mainOverlay';

type PortalEntry = {
	priority: number;
	location: DialogLocation;
	node: HtmlPortalNodeAny;
	key: string;
};

const PORTALS = new Observable<readonly PortalEntry[]>([]);

export function Dialogs({ location }: {
	location: DialogLocation;
}): ReactElement {
	const portals = useObservable(PORTALS);

	return (
		<>
			{
				portals
					.filter((portal) => portal.location === location)
					.map(({ node, key }) => (
						// We need to wrap the portal in its own div element,
						// otherwise it might crash if interacting with other portals that change at the same time
						<div key={ key } className='dialog-portal-out'>
							<OutPortal node={ node } />
						</div>
					))
			}
			{
				location === 'global' ? (
					<ConfirmDialog symbol={ DEFAULT_CONFIRM_DIALOG_SYMBOL } />
				) : null
			}
		</>
	);
}

export function DialogInPortal({ children, priority, location = 'global' }: {
	children?: ReactNode;
	priority?: number;
	location?: DialogLocation;
}): ReactElement {
	const id = useId();
	const portal = useMemo(() => createHtmlPortalNode({
		attributes: {
			class: 'dialog-portal',
		},
	}), []);

	useLayoutEffect(() => {
		const self: PortalEntry = {
			priority: priority ?? 0,
			location,
			node: portal,
			key: id,
		};

		PORTALS.produce((existingPortals) => {
			return sortBy([
				self,
				...existingPortals,
			], (v) => v.priority);
		});

		return () => {
			PORTALS.value = PORTALS.value.filter((p) => p !== self);
		};
	}, [portal, priority, location, id]);

	return (
		<InPortal node={ portal }>
			{ children }
		</InPortal>
	);
}

export function ModalDialog({ children, priority, position = 'center', id, className, allowClickBubbling = false }: CommonProps & {
	/**
	 * Priority of this dialog for ordering the dialogs on screen.
	 * Higher priority dialogs cover lower priority dialogs.
	 * @default 0
	 */
	priority?: number;
	position?: 'center' | 'top';
	/**
	 * Whether to allow click events to bubble through to the parent or not.
	 * @default false
	 */
	allowClickBubbling?: boolean;
}): ReactElement {

	const clickSink = useCallback((ev: React.MouseEvent) => {
		if (allowClickBubbling)
			return;

		ev.stopPropagation();
	}, [allowClickBubbling]);

	return (
		<DialogInPortal priority={ priority }>
			<div id={ id } className={ classNames('dialog', position, className) } onClick={ clickSink } onPointerDown={ clickSink } onPointerUp={ clickSink }>
				<div className='dialog-content'>
					{ children }
				</div>
			</div>
		</DialogInPortal>
	);
}

export function DraggableDialog({ children, className, title, modal = false, rawContent, close, hiddenClose, allowShade = false, initialPosition }: {
	children?: ReactNode;
	className?: string;
	title: string;
	/**
	 * Whether this dialog should have a modal containing overlay on top of which it is positioned.
	 * @default false
	 */
	modal?: boolean;
	rawContent?: boolean;
	close: () => void;
	hiddenClose?: boolean;
	/**
	 * Shows a "shade" button on the header, and allows the contents to be shaded.
	 * @default false
	 */
	allowShade?: boolean;
	initialPosition?: Readonly<PointLike>;
}): ReactElement {
	useEffect(() => {
		if (close == null) {
			return undefined;
		}
		const handler = (ev: KeyboardEvent) => {
			if (ev.key === 'Escape') {
				close();
				ev.preventDefault();
				ev.stopImmediatePropagation();
			}
		};
		document.addEventListener('keydown', handler);
		return () => {
			document.removeEventListener('keydown', handler);
		};
	}, [close]);

	const [shaded, setShaded] = useState(false);
	useEffect(() => {
		if (!allowShade && shaded) {
			setShaded(false);
		}
	}, [shaded, allowShade]);

	const toggleShade = useCallback(() => {
		setShaded((currentShaded) => !currentShaded);
	}, []);

	return (
		<DialogInPortal priority={ -1 } >
			<div className={ modal ? 'overlay-bounding-box modal' : 'overlay-bounding-box' }>
				<Rnd
					className={ classNames(
						'dialog-draggable',
						shaded ? 'shaded' : null,
						className,
					) }
					dragHandleClassName='drag-handle'
					resizeHandleWrapperClass='resize-handle-wrapper'
					default={ {
						// We divide the position by 2, because there seems to be a bug in "Draggable" that multiplies it
						x: (initialPosition?.x ?? Math.max((window.innerWidth ?? 0) / 2 - 20, 0)) / 2,
						y: (initialPosition?.y ?? Math.max((window.innerHeight ?? 0) / 4 - 10, 0)) / 2,
						width: 'auto',
						height: 'auto',
					} }
					bounds='parent'
					maxHeight={ initialPosition ? (window.innerHeight - initialPosition.y - 10) : 'calc(95vh - 2em)' }
					maxWidth={ initialPosition ? (window.innerWidth - initialPosition.x - 20) : 'calc(95vw - 2em)' }
				>
					<header className='dialog-header'>
						<div className='drag-handle'>
							{ title }
						</div>
						{
							allowShade ? (
								<div className='dialog-shade' onClick={ toggleShade }>
									{ shaded ? '▼' : '▲' }
								</div>
							) : null
						}
						{ hiddenClose !== true ? (
							<div className='dialog-close' onClick={ close }>
								×
							</div>
						) : null }
					</header>
					{
						rawContent ? (shaded ? null : children) : (
							<div className='dialog-content'>
								{ children }
							</div>
						)
					}
				</Rnd>
			</div>
		</DialogInPortal>
	);
}

type ConfirmDialogEntry = Readonly<{
	title: string;
	content: ReactNode;
	priority?: number;
	className?: string;
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
	content: ReactNode;
	priority: number;
	className?: string;
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
	const content = observed?.content;
	const priority = observed?.priority ?? DEFAULT_CONFIRM_DIALOG_PRIORITY;
	const className = observed?.className;
	return {
		open,
		title,
		content,
		priority,
		className,
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
	const { open, title, content, priority, className, onConfirm, onCancel } = useConfirmDialogController(symbol);

	if (!open)
		return null;

	return (
		<ModalDialog priority={ priority } className={ className }>
			<Column className='dialog-confirm'>
				<strong>{ title }<hr /></strong>
				<Column padding='large'>
					{ content }
				</Column>
				<Row gap='small' alignX='space-between'>
					<Button onClick={ onCancel }>
						{ no }
					</Button>
					<Button onClick={ onConfirm }>
						{ yes }
					</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}

export function useConfirmDialog(symbol: symbol = DEFAULT_CONFIRM_DIALOG_SYMBOL): (title: string, content?: ReactNode, priority?: number, dialogClassName?: string) => Promise<boolean> {
	const unset = useRef(false);
	const entry = GetConfirmDialogEntry(symbol);
	const resolveRef = useRef<(result: boolean) => void>();
	useEffect(() => () => {
		if (unset.current) {
			entry.value = null;
		}
	}, [entry]);
	useKeyDownEvent(useCallback(() => {
		if (resolveRef.current) {
			unset.current = false;
			entry.value = null;
			resolveRef.current(false);
			resolveRef.current = undefined;
			return true;
		}
		return false;
	}, [entry]), 'Escape');
	return useCallback((title: string, content?: ReactNode, priority?: number, dialogClassName?: string) => new Promise<boolean>((resolve) => {
		unset.current = true;
		resolveRef.current = resolve;
		entry.value = {
			title,
			content,
			priority,
			className: dialogClassName,
			handler: (result) => {
				unset.current = false;
				entry.value = null;
				resolve(result);
				resolveRef.current = undefined;
			},
		};
	}), [entry]);
}

function ButtonConfirmImpl({ title, content, priority, onClick, disabled, children, ...props }: ButtonProps & { title: string; content?: ReactNode; priority?: number; }, ref: React.ForwardedRef<HTMLButtonElement>) {
	const confirm = useConfirmDialog();

	const [onActualClick, processing] = useAsyncEvent(async (ev: React.MouseEvent<HTMLButtonElement>) => {
		ev.preventDefault();
		ev.stopPropagation();
		return [await confirm(title, content, priority), ev] as const;
	}, ([result, ev]: readonly [boolean, React.MouseEvent<HTMLButtonElement>]) => {
		if (result) {
			onClick?.(ev);
		}
	});

	return (
		<Button { ...props } ref={ ref } onClick={ onActualClick } disabled={ disabled || processing }>
			{ children }
		</Button>
	);
}

export const ButtonConfirm = React.forwardRef(ButtonConfirmImpl);
