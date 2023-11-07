import { createHtmlPortalNode, HtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import React, { ReactElement, ReactNode, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { Rnd } from 'react-rnd';
import { sortBy } from 'lodash';
import { ChildrenProps } from '../../common/reactTypes';
import { Button } from '../common/button/button';
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

export function DialogInPortal({ children, priority }: {
	children?: ReactNode;
	priority?: number;
}): ReactElement {
	const portal = useMemo(() => createHtmlPortalNode(), []);

	useLayoutEffect(() => {
		PORTALS.produce((existingPortals) => {
			return sortBy([
				{
					priority: priority ?? 0,
					node: portal,
				},
				...existingPortals,
			], (v) => v.priority);
		});

		return () => {
			PORTALS.value = PORTALS.value.filter(({ node }) => node !== portal);
		};
	}, [portal, priority]);

	return (
		<InPortal node={ portal }>
			{ children }
		</InPortal>
	);
}

export function ModalDialog({ children, priority, position = 'center' }: ChildrenProps & {
	/**
	 * Priority of this dialog for ordering the dialogs on screen.
	 * Higher priority dialogs cover lower priority dialogs.
	 * @default 0
	 */
	priority?: number;
	position?: 'center' | 'top';
}): ReactElement {
	return (
		<DialogInPortal priority={ priority }>
			<div className={ classNames('dialog', position) }>
				<div className='dialog-content'>
					{ children }
				</div>
			</div>
		</DialogInPortal>
	);
}

export function DraggableDialog({ children, title, rawContent, close }: {
	children?: ReactNode;
	title: string;
	rawContent?: boolean;
	close?: () => void;
}): ReactElement {
	return (
		<DialogInPortal priority={ -1 } >
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
				</Rnd>
			</div>
		</DialogInPortal>
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
