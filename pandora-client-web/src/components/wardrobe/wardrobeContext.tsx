import { freeze } from 'immer';
import {
	ActionTargetSelector,
	AppearanceAction,
	AppearanceActionContext,
	AppearanceActionProblem,
	AppearanceActionProcessingResult,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkGlobalState,
	EMPTY_ARRAY,
	GetLogger,
	ItemId,
	Nullable,
	type AppearanceActionData,
} from 'pandora-common';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';
import React, { createContext, ReactElement, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { RenderAppearanceActionProblem } from '../../assets/appearanceValidation';
import { useAssetManager } from '../../assets/assetManager';
import type { PlayerCharacter } from '../../character/player';
import { useAsyncEvent } from '../../common/useEvent';
import { Observable, useObservable } from '../../observable';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../persistentToast';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks';
import { Column } from '../common/container/container';
import { useConfirmDialog } from '../dialog/dialog';
import { useActionSpaceContext, useGameState, useGlobalState, useSpaceCharacters } from '../gameContext/gameStateContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ActionWarningContent } from './wardrobeComponents';
import { WardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocuser, WardrobeHeldItem, WardrobeTarget } from './wardrobeTypes';
import { WardrobeCheckResultForConfirmationWarnings } from './wardrobeUtils';

export const wardrobeContext = createContext<WardrobeContext | null>(null);

export const WARDROBE_TARGET_ROOM: WardrobeTarget = freeze({ type: 'room' });

export function WardrobeContextProvider({ target, player, children }: { target: WardrobeTarget; player: PlayerCharacter; children: ReactNode; }): ReactElement {
	const settings = useAccountSettings();
	const assetList = useAssetManager().assetList;
	const gameState = useGameState();
	const globalStateContainer = gameState.globalState;
	const spaceContext = useActionSpaceContext();
	const shardConnector = useShardConnector();
	const characters = useSpaceCharacters();

	const focuser = useMemo(() => new WardrobeFocuser(), []);
	const actualTarget = useObservable(focuser.inRoom) ? WARDROBE_TARGET_ROOM : target;
	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);
	const actionPreviewState = useMemo(() => new Observable<AssetFrameworkGlobalState | null>(null), []);

	const [heldItem, setHeldItem] = useState<WardrobeHeldItem>({ type: 'nothing' });
	const [scrollToItem, setScrollToItem] = useState<ItemId | null>(null);

	const actions = useMemo<AppearanceActionContext>(() => ({
		player: player.gameLogicCharacter,
		globalState: globalStateContainer,
		spaceContext,
		getCharacter: (id) => {
			const state = globalStateContainer.currentState.getCharacterState(id);
			const character = characters.find((c) => c.id === id);
			if (!state || !character)
				return null;

			return character.gameLogicCharacter;
		},
	}), [player, globalStateContainer, spaceContext, characters]);

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

	const globalState = useGlobalState(gameState);

	useEffect(() => {
		if (heldItem.type === 'item') {
			const rootItems = globalState.getItems(heldItem.target);
			const item = EvalItemPath(rootItems ?? EMPTY_ARRAY, heldItem.path);
			if (!item) {
				setHeldItem({ type: 'nothing' });
			}
		}
	}, [heldItem, globalState]);

	const context = useMemo<WardrobeContext>(() => ({
		target: actualTarget,
		targetSelector,
		player,
		globalState,
		assetList,
		heldItem,
		setHeldItem,
		scrollToItem,
		setScrollToItem,
		focuser,
		extraItemActions,
		actions,
		execute: (action) => shardConnector?.awaitResponse('appearanceAction', action),
		actionPreviewState,
		showExtraActionButtons: settings.wardrobeExtraActionButtons,
		showHoverPreview: settings.wardrobeHoverPreview,
		itemDisplayNameType: settings.wardrobeItemDisplayNameType,
	}), [actualTarget, targetSelector, player, globalState, assetList, heldItem, scrollToItem, focuser, extraItemActions, actions, actionPreviewState, settings.wardrobeExtraActionButtons, settings.wardrobeHoverPreview, settings.wardrobeItemDisplayNameType, shardConnector]);

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

type ExecuteCallbackOptions = {
	onSuccess?: (data: readonly AppearanceActionData[]) => void;
	onFailure?: (problems: readonly AppearanceActionProblem[]) => void;
};

export function useWardrobeExecuteCallback({ onSuccess, onFailure }: ExecuteCallbackOptions = {}) {
	const assetManager = useAssetManager();
	const { execute, itemDisplayNameType } = useWardrobeContext();
	return useAsyncEvent(
		async (action: AppearanceAction) => await execute(action),
		(result) => {
			switch (result?.result) {
				case 'success':
					onSuccess?.(result.data);
					break;
				case 'promptSent':
					toast('Prompt sent', TOAST_OPTIONS_WARNING);
					onFailure?.([]);
					break;
				case 'promptFailedCharacterOffline':
					toast('Character is offline, try again later', TOAST_OPTIONS_ERROR);
					onFailure?.([]);
					break;
				case 'failure':
					GetLogger('wardrobeExecute').info('Failure executing action:', result.problems);
					toast(
						<Column>
							<span>Problems performing action:</span>
							<ul>
								{
									result.problems.map((problem, i) => (
										<li key={ i } className='display-linebreak'>{ RenderAppearanceActionProblem(assetManager, problem, itemDisplayNameType) }</li>
									))
								}
							</ul>
						</Column>,
						TOAST_OPTIONS_ERROR,
					);
					onFailure?.(result.problems);
					break;
				case undefined:
					break;
				default:
					AssertNever(result);
			}
		},
		{
			errorHandler: (err) => {
				GetLogger('wardrobeExecute').error('Error executing action:', err);
				toast(`Error performing action`, TOAST_OPTIONS_ERROR);
			},
			updateAfterUnmount: true,
		},
	);
}

export function useWardrobeExecuteChecked(action: Nullable<AppearanceAction>, result?: AppearanceActionProcessingResult | null, props: ExecuteCallbackOptions = {}) {
	const [execute, processing] = useWardrobeExecuteCallback(props);
	const {
		player,
		actions: { spaceContext },
	} = useWardrobeContext();

	const confirm = useConfirmDialog();

	return [
		useCallback(() => {
			if (action == null || result == null)
				return;

			if (!result.valid && result.prompt == null) {
				toast(<ActionWarningContent problems={ result.problems } prompt={ false } />, TOAST_OPTIONS_WARNING);
				return;
			}

			// Detect need for confirmation
			const warnings = WardrobeCheckResultForConfirmationWarnings(player, spaceContext, action, result);

			if (warnings.length > 0) {
				confirm(
					`You might not be able to undo this action easily. Continue?`,
					(
						<ul>
							{
								warnings.map((warning, i) => <li key={ i }>{ warning }</li>)
							}
						</ul>
					),
				).then((confirmResult) => {
					if (confirmResult) {
						execute(action);
					}
				}).catch(() => { /* NOOP */ });
			} else {
				execute(action);
			}

		}, [execute, confirm, player, spaceContext, action, result]),
		processing,
	] as const;
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
