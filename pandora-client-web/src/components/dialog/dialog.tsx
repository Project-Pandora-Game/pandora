import classNames from 'classnames';
import { sortBy } from 'lodash';
import React, { ReactElement, ReactNode, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
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

export type DialogPortalRef = {
	/** Brings the portal to forgeground (within the bounds of its priority). */
	bringToForeground: () => void;
};
export function DialogInPortal({ children, priority, location = 'global', ref }: {
	children?: ReactNode;
	priority?: number;
	location?: DialogLocation;
	ref?: Ref<DialogPortalRef>;
}): ReactElement {
	const id = useId();
	const portal = useMemo(() => createHtmlPortalNode({
		attributes: {
			class: 'dialog-portal',
		},
	}), []);

	const selfPortalEntry = useMemo((): PortalEntry => ({
		priority: priority ?? 0,
		location,
		node: portal,
		key: id,
	}), [portal, priority, location, id]);

	useLayoutEffect(() => {
		PORTALS.produce((existingPortals) => {
			return sortBy([
				...existingPortals,
				selfPortalEntry,
			], (v) => v.priority);
		});

		return () => {
			PORTALS.value = PORTALS.value.filter((p) => p !== selfPortalEntry);
		};
	}, [selfPortalEntry]);

	const bringToForeground = useCallback(() => {
		const index = PORTALS.value.indexOf(selfPortalEntry);
		if (index >= 0) {
			PORTALS.produce((existingPortals) => {
				return sortBy([
					...existingPortals.filter((p) => p !== selfPortalEntry),
					selfPortalEntry,
				], (v) => v.priority);
			});
		}
	}, [selfPortalEntry]);

	useImperativeHandle(ref, () => ({
		bringToForeground,
	}), [bringToForeground]);

	return (
		<InPortal node={ portal }>
			{ children }
		</InPortal>
	);
}

export function ModalDialog({ children, priority, position = 'center', contentOverflow = 'auto', id, className, allowClickBubbling = false }: CommonProps & {
	/**
	 * Priority of this dialog for ordering the dialogs on screen.
	 * Higher priority dialogs cover lower priority dialogs.
	 * @default 0
	 */
	priority?: number;
	position?: 'center' | 'top';
	/**
	 * What overflow style should be used for the dialog content
	 * @default 'auto'
	 */
	contentOverflow?: 'auto' | 'hidden';
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
				<div className={ classNames('dialog-content', `overflow-${contentOverflow}`) } >
					{ children }
				</div>
			</div>
		</DialogInPortal>
	);
}

export interface DraggableDialogProps {
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
	/**
	 * Whether the dialog should be highlighted.
	 * @default false
	 */
	highlight?: boolean;
	/**
	 * Whether the dialog should be highlighted while shaded.
	 * @default false
	 */
	highlightShaded?: boolean;
	initialPosition?: Readonly<PointLike>;
	initialWidth?: number | string;
	initialHeight?: number | string;
}

let InitialPositionNextIndex = 0;
const INITIAL_POSITION_INDEX_LIMIT = 8;
const INITIAL_POSITION_OFFSET: PointLike = { x: 15, y: 30 };
let OpenDraggableDialogCount = 0;
/** Mark that gets consumed by reset. Used to handle edge-case where multiple dialogs get opened in a single render. */
let ShouldResetIndex = false;

export function DraggableDialog({
	children,
	className,
	title,
	modal = false,
	rawContent,
	close,
	hiddenClose,
	allowShade = false,
	highlight = false,
	highlightShaded = false,
	initialPosition,
	initialWidth = 'auto',
	initialHeight = 'auto',
}: DraggableDialogProps): ReactElement {
	const portalRef = useRef<DialogPortalRef>(null);

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

	const initialPositionIndexRef = useRef(-1);
	if (initialPositionIndexRef.current < 0) {
		// If there is no open dialog, then reset the index
		if (OpenDraggableDialogCount === 0 && ShouldResetIndex) {
			InitialPositionNextIndex = 0;
			ShouldResetIndex = false;
		}
		initialPositionIndexRef.current = InitialPositionNextIndex++;
		InitialPositionNextIndex %= INITIAL_POSITION_INDEX_LIMIT;
	}
	useLayoutEffect(() => {
		OpenDraggableDialogCount++;
		return () => {
			OpenDraggableDialogCount--;
			if (OpenDraggableDialogCount === 0) {
				ShouldResetIndex = true;
			}
		};
	}, []);

	return (
		<DialogInPortal priority={ -1 } ref={ portalRef }>
			<div
				className={ modal ? 'overlay-bounding-box modal' : 'overlay-bounding-box' }
				// Prevent clicks from bubbling through the portal
				onClick={ (ev) => {
					ev.stopPropagation();
				} }
				// Bring dialog to foreground if it is interacted with
				onMouseDownCapture={ () => {
					portalRef.current?.bringToForeground();
				} }
				onTouchStartCapture={ () => {
					portalRef.current?.bringToForeground();
				} }
			>
				<Rnd
					className={ classNames(
						'dialog-draggable',
						shaded ? 'shaded' : null,
						(shaded ? highlightShaded : highlight) ? 'dialogHighlight' : null,
						className,
					) }
					dragHandleClassName='drag-handle'
					resizeHandleWrapperClass='resize-handle-wrapper'
					default={ {
						// We divide the position by 2, because there seems to be a bug in "Draggable" that multiplies it
						// If initialPosition is set, we respect it
						// If it isn't set we roughly center the dialog while shifting every subsequent one by a little bit to the bottom right
						x: (initialPosition?.x ?? (
							Math.max(Math.floor(0.5 * (window.innerWidth ?? 0)) - 20 + (
								(initialPositionIndexRef.current * window.devicePixelRatio * INITIAL_POSITION_OFFSET.x)
							), 0)) / 2
						),
						y: (initialPosition?.y ?? (
							Math.max(Math.floor(0.3 * (window.innerHeight ?? 0)) / 2 - 10 + (
								(initialPositionIndexRef.current * window.devicePixelRatio * INITIAL_POSITION_OFFSET.y)
							), 0)) / 2
						),
						width: initialWidth,
						height: initialHeight,
					} }
					resizeHandleStyles={ {
						bottomLeft: { zIndex: 2 },
						bottomRight: { zIndex: 2 },
						topLeft: { zIndex: 2 },
						topRight: { zIndex: 2 },
					} }
					bounds='parent'
					maxHeight={ initialPosition ? (window.innerHeight - initialPosition.y - 10) : 'calc(95vh - 2em)' }
					maxWidth={ initialPosition ? (window.innerWidth - initialPosition.x - 20) : 'calc(95vw - 2em)' }
				>
					<header className='dialog-header'>
						<span className='drag-handle dialog-title'>
							{ title }
						</span>
						{
							allowShade ? (
								<div className='dialog-shade' title='Shade this dialog' onClick={ toggleShade }>
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
	const resolveRef = useRef<(result: boolean) => void>(undefined);
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
