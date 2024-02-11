import {
	AppearanceAction,
	AppearanceActionContext,
	AppearanceActionProblem,
	AppearanceActionProcessingResult,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkGlobalState,
	EMPTY_ARRAY,
	GetLogger,
	Nullable,
	ActionTargetSelector,
} from 'pandora-common';
import React, { createContext, ReactElement, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { Observable } from '../../observable';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { useActionSpaceContext, useSpaceCharacters, useGameState, useGlobalState } from '../gameContext/gameStateContextProvider';
import type { PlayerCharacter } from '../../character/player';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';
import { useAccountSettings } from '../gameContext/directoryConnectorContextProvider';
import { WardrobeContext, WardrobeContextExtraItemActionComponent, WardrobeFocus, WardrobeHeldItem, WardrobeTarget } from './wardrobeTypes';
import { useAsyncEvent } from '../../common/useEvent';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../persistentToast';
import { RenderAppearanceActionProblem } from '../../assets/appearanceValidation';
import { Column } from '../common/container/container';
import { useConfirmDialog } from '../dialog/dialog';
import { WardrobeCheckResultForConfirmationWarnings } from './wardrobeUtils';
import { ActionWarningContent } from './wardrobeComponents';
import { Immutable } from 'immer';

export const wardrobeContext = createContext<WardrobeContext | null>(null);

export function WardrobeContextProvider({ target, player, children }: { target: WardrobeTarget; player: PlayerCharacter; children: ReactNode; }): ReactElement {
	const settings = useAccountSettings();
	const assetList = useAssetManager().assetList;
	const gameState = useGameState();
	const globalStateContainer = gameState.globalState;
	const spaceContext = useActionSpaceContext();
	const shardConnector = useShardConnector();
	const characters = useSpaceCharacters();

	const focus = useMemo(() => new Observable<Immutable<WardrobeFocus>>({ container: [], itemId: null }), []);
	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);
	const actionPreviewState = useMemo(() => new Observable<AssetFrameworkGlobalState | null>(null), []);

	const [heldItem, setHeldItem] = useState<WardrobeHeldItem>({ type: 'nothing' });

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
		if (target.type === 'character') {
			return {
				type: 'character',
				characterId: target.id,
			};
		} else if (target.type === 'room') {
			return {
				type: 'room',
				roomId: target.roomId,
			};
		} else if (target.type === 'spaceInventory') {
			return {
				type: 'spaceInventory',
			};
		}
		AssertNever(target);
	}, [target]);

	const globalState = useGlobalState(gameState);
	const playerState = globalState.getCharacterState(player.id);
	AssertNotNullable(playerState);

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
		target,
		targetSelector,
		player,
		currentRoom: { type: 'room', roomId: playerState.getCurrentRoomId() },
		globalState,
		assetList,
		heldItem,
		setHeldItem,
		focus,
		extraItemActions,
		actions,
		execute: (action) => shardConnector?.awaitResponse('appearanceAction', action),
		actionPreviewState,
		showExtraActionButtons: settings.wardrobeExtraActionButtons,
		showHoverPreview: settings.wardrobeHoverPreview,
	}), [target, targetSelector, player, playerState, globalState, assetList, heldItem, focus, extraItemActions, actions, actionPreviewState, settings, shardConnector]);

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
	onSuccess?: () => void;
	onFailure?: (problems: readonly AppearanceActionProblem[]) => void;
};

export function useWardrobeExecuteCallback({ onSuccess, onFailure }: ExecuteCallbackOptions = {}) {
	const assetManager = useAssetManager();
	const { execute } = useWardrobeContext();
	return useAsyncEvent(
		async (action: AppearanceAction) => await execute(action),
		(result) => {
			switch (result?.result) {
				case 'success':
					onSuccess?.();
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
										<li key={ i } className='display-linebreak'>{ RenderAppearanceActionProblem(assetManager, problem) }</li>
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
				}).catch(() => {/* NOOP */});
			} else {
				execute(action);
			}

		}, [execute, confirm, player, spaceContext, action, result]),
		processing,
	] as const;
}
