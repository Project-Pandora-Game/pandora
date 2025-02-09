import { freeze } from 'immer';
import {
	ActionTargetSelector,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkGlobalState,
	EMPTY_ARRAY,
	EvalItemPath,
	ItemId,
} from 'pandora-common';
import { createContext, ReactElement, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { Observable, useObservable } from '../../observable';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks';
import { useWardrobeActionContext } from './wardrobeActionContext';
import { WardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocuser, WardrobeHeldItem, WardrobeTarget } from './wardrobeTypes';

export const wardrobeContext = createContext<WardrobeContext | null>(null);

export const WARDROBE_TARGET_ROOM: WardrobeTarget = freeze({ type: 'room' });

export function WardrobeContextProvider({ target, children }: { target: WardrobeTarget; children: ReactNode; }): ReactElement {
	const {
		globalState,
	} = useWardrobeActionContext();

	const settings = useAccountSettings();
	const assetList = useAssetManager().assetList;

	const focuser = useMemo(() => new WardrobeFocuser(), []);
	const actualTarget = useObservable(focuser.inRoom) ? WARDROBE_TARGET_ROOM : target;
	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);
	const actionPreviewState = useMemo(() => new Observable<AssetFrameworkGlobalState | null>(null), []);

	const [heldItem, setHeldItem] = useState<WardrobeHeldItem>({ type: 'nothing' });
	const [scrollToItem, setScrollToItem] = useState<ItemId | null>(null);

	const targetSelector = useMemo((): ActionTargetSelector => {
		if (actualTarget.type === 'character') {
			return {
				type: 'character',
				characterId: actualTarget.id,
			};
		} else if (actualTarget.type === 'room') {
			return {
				type: 'roomInventory',
			};
		}
		AssertNever(actualTarget);
	}, [actualTarget]);

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
		target: actualTarget,
		targetSelector,
		assetList,
		heldItem,
		setHeldItem,
		scrollToItem,
		setScrollToItem,
		focuser,
		extraItemActions,
		actionPreviewState,
		showExtraActionButtons: settings.wardrobeExtraActionButtons,
		showHoverPreview: settings.wardrobeHoverPreview,
		itemDisplayNameType: settings.wardrobeItemDisplayNameType,
	}), [actualTarget, targetSelector, assetList, heldItem, scrollToItem, focuser, extraItemActions, actionPreviewState, settings.wardrobeExtraActionButtons, settings.wardrobeHoverPreview, settings.wardrobeItemDisplayNameType]);

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
		target: WARDROBE_TARGET_ROOM,
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
