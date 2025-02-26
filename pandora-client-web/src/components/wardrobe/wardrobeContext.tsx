import {
	ActionTargetSelector,
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
import { WardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocuser, WardrobeHeldItem } from './wardrobeTypes';

export const wardrobeContext = createContext<WardrobeContext | null>(null);

export function WardrobeContextProvider({ target, children }: { target: ActionTargetSelector; children: ReactNode; }): ReactElement {
	const {
		globalState,
	} = useWardrobeActionContext();

	const settings = useAccountSettings();
	const assetList = useAssetManager().assetList;

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
	}), [actualTargetSelector, assetList, heldItem, scrollToItem, focuser, extraItemActions, actionPreviewState, settings.wardrobeExtraActionButtons, settings.wardrobeHoverPreview, settings.wardrobeItemDisplayNameType]);

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
