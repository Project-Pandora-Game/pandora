import {
	ActionTargetSelector,
	AssertNotNullable,
	AssetFrameworkGlobalState,
	EMPTY_ARRAY,
	EvalItemPath,
	ItemId,
} from 'pandora-common';
import { createContext, ReactElement, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Observable, useObservable } from '../../observable.ts';
import { useWardrobeActionContext } from './wardrobeActionContext.tsx';
import { WardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocuser, WardrobeHeldItem, type WardrobeFocus } from './wardrobeTypes.ts';

export const wardrobeContext = createContext<WardrobeContext | null>(null);

export function WardrobeContextProvider({ target, initialFocus, children }: {
	target: ActionTargetSelector;
	initialFocus?: WardrobeFocus;
	children: ReactNode;
}): ReactElement {
	const {
		globalState,
	} = useWardrobeActionContext();

	const focuser = useMemo(() => new WardrobeFocuser(), []);
	const initialFocusDone = useRef(false);
	if (!initialFocusDone.current) {
		initialFocusDone.current = true;
		if (initialFocus != null) {
			focuser.focus(initialFocus, target);
		}
	}

	const focuserInRoom = useObservable(focuser.inRoom);
	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);
	const actionPreviewState = useMemo(() => new Observable<AssetFrameworkGlobalState | null>(null), []);

	const [heldItem, setHeldItem] = useState<WardrobeHeldItem>({ type: 'nothing' });
	const [scrollToItem, setScrollToItem] = useState<ItemId | null>(initialFocus?.itemId ?? null);

	const actualTargetSelector = useMemo((): ActionTargetSelector => {
		if (focuserInRoom) {
			return {
				type: 'roomInventory',
			};
		}
		return target;
	}, [focuserInRoom, target]);

	useEffect(() => {
		if (heldItem.type === 'item') {
			const rootItems = globalState.getItems(heldItem.target);
			const item = EvalItemPath(rootItems ?? EMPTY_ARRAY, heldItem.path);
			if (!item) {
				setHeldItem({ type: 'nothing' });
			}
		}
	}, [heldItem, globalState]);

	const context = useMemo((): WardrobeContext => ({
		targetSelector: actualTargetSelector,
		heldItem,
		setHeldItem,
		scrollToItem,
		setScrollToItem,
		focuser,
		extraItemActions,
		actionPreviewState,
	}), [actualTargetSelector, heldItem, scrollToItem, focuser, extraItemActions, actionPreviewState]);

	return (
		<wardrobeContext.Provider value={ context }>
			{ children }
		</wardrobeContext.Provider>
	);
}

export function useWardrobeContext(): Readonly<WardrobeContext> {
	const ctx = useContext(wardrobeContext);
	AssertNotNullable(ctx);
	return ctx;
}

export function WardrobeContextSelectRoomInventoryProvider({ children }: { children: ReactNode; }): ReactElement {
	const ctx = useWardrobeContext();
	const value = useMemo<WardrobeContext>(() => ({
		...ctx,
		targetSelector: {
			type: 'roomInventory',
		},
	}), [ctx]);

	return (
		<wardrobeContext.Provider value={ value }>
			{ children }
		</wardrobeContext.Provider>
	);
}

/** Wardrobe context provider meant to be used outside of the wardrobe */
export function WardrobeExternalContextProvider({ target, children }: { target: ActionTargetSelector; children: ReactNode; }): ReactElement {
	const {
		globalState,
	} = useWardrobeActionContext();

	const focuser = useMemo(() => new WardrobeFocuser(), []);
	const focuserInRoom = useObservable(focuser.inRoom);
	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);
	const actionPreviewState = useMemo(() => new Observable<AssetFrameworkGlobalState | null>(null), []);

	const [heldItem, setHeldItem] = useState<WardrobeHeldItem>({ type: 'nothing' });
	const [scrollToItem, setScrollToItem] = useState<ItemId | null>(null);

	const actualTargetSelector = useMemo((): ActionTargetSelector => {
		if (focuserInRoom) {
			return {
				type: 'roomInventory',
			};
		}
		return target;
	}, [focuserInRoom, target]);

	useEffect(() => {
		if (heldItem.type === 'item') {
			const rootItems = globalState.getItems(heldItem.target);
			const item = EvalItemPath(rootItems ?? EMPTY_ARRAY, heldItem.path);
			if (!item) {
				setHeldItem({ type: 'nothing' });
			}
		}
	}, [heldItem, globalState]);

	const context = useMemo((): WardrobeContext => ({
		targetSelector: actualTargetSelector,
		heldItem,
		setHeldItem,
		scrollToItem,
		setScrollToItem,
		focuser,
		extraItemActions,
		actionPreviewState,
	}), [actualTargetSelector, heldItem, scrollToItem, focuser, extraItemActions, actionPreviewState]);

	return (
		<wardrobeContext.Provider value={ context }>
			{ children }
		</wardrobeContext.Provider>
	);
}
