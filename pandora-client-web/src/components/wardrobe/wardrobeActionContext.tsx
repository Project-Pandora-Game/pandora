import {
	AppearanceAction,
	AppearanceActionContext,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkGlobalState,
	GetLogger,
	IClientShardResult,
	type AppearanceActionData,
	type AppearanceActionProblem,
	type AppearanceActionProcessingResult,
	type CharacterId,
	type Nullable,
	type PermissionGroup,
} from 'pandora-common';
import React, { createContext, useCallback, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { RenderAppearanceActionProblem } from '../../assets/appearanceValidation';
import { useAssetManager } from '../../assets/assetManager';
import type { ICharacter } from '../../character/character';
import type { PlayerCharacter } from '../../character/player';
import { useAsyncEvent } from '../../common/useEvent';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../persistentToast';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks';
import { Column } from '../common/container/container';
import { useConfirmDialog } from '../dialog/dialog';
import { useActionSpaceContext, useGameState, useGlobalState, useSpaceCharacters } from '../gameContext/gameStateContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ActionWarningContent } from './wardrobeComponents';
import { WardrobeCheckResultForConfirmationWarnings } from './wardrobeUtils';

export interface WardrobeActionContext {
	player: ICharacter;
	globalState: AssetFrameworkGlobalState;
	actions: AppearanceActionContext;
	execute: (action: AppearanceAction) => IClientShardResult['appearanceAction'] | undefined;
	sendPermissionRequest: (target: CharacterId, permissions: [PermissionGroup, string][]) => IClientShardResult['requestPermission'] | undefined;
}

export const wardrobeActionContext = createContext<WardrobeActionContext | null>(null);

export function WardrobeActionContextProvider({ player, children }: { player: PlayerCharacter; children: ReactNode; }): ReactElement {
	const gameState = useGameState();
	const globalStateContainer = gameState.globalState;
	const spaceContext = useActionSpaceContext();
	const shardConnector = useShardConnector();
	const characters = useSpaceCharacters();

	const actions = useMemo((): AppearanceActionContext => ({
		player: player.gameLogicCharacter,
		spaceContext,
		getCharacter: (id) => {
			const state = globalStateContainer.currentState.getCharacterState(id);
			const character = characters.find((c) => c.id === id);
			if (!state || !character)
				return null;

			return character.gameLogicCharacter;
		},
	}), [player, globalStateContainer, spaceContext, characters]);

	const globalState = useGlobalState(gameState);

	const context = useMemo((): WardrobeActionContext => ({
		player,
		globalState,
		actions,
		execute: (action) => shardConnector?.awaitResponse('appearanceAction', action),
		sendPermissionRequest: (permissionRequestTarget, permissions) => shardConnector?.awaitResponse('requestPermission', { target: permissionRequestTarget, permissions }),
	}), [player, globalState, actions, shardConnector]);

	return (
		<wardrobeActionContext.Provider value={ context }>
			{ children }
		</wardrobeActionContext.Provider>
	);
}

export function useWardrobeActionContext(): Readonly<WardrobeActionContext> {
	const ctx = useContext(wardrobeActionContext);
	AssertNotNullable(ctx);
	return ctx;
}

type ExecuteCallbackOptions = {
	onSuccess?: (data: readonly AppearanceActionData[]) => void;
	onFailure?: (problems: readonly AppearanceActionProblem[]) => void;
	allowMultipleSimultaneousExecutions?: boolean;
};

export function useWardrobeExecuteCallback({ onSuccess, onFailure, allowMultipleSimultaneousExecutions }: ExecuteCallbackOptions = {}) {
	const assetManager = useAssetManager();
	const { execute } = useWardrobeActionContext();
	const {
		wardrobeItemDisplayNameType,
	} = useAccountSettings();
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
										<li key={ i } className='display-linebreak'>{ RenderAppearanceActionProblem(assetManager, problem, wardrobeItemDisplayNameType) }</li>
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
			allowMultipleSimultaneousExecutions,
		},
	);
}

export function useWardrobePermissionRequestCallback() {
	const { sendPermissionRequest } = useWardrobeActionContext();
	return useAsyncEvent(
		async (target: CharacterId, permissions: [PermissionGroup, string][]) => await sendPermissionRequest(target, permissions),
		(result) => {
			switch (result?.result) {
				case 'promptSent':
					toast('Prompt sent', TOAST_OPTIONS_WARNING);
					break;
				case 'promptFailedCharacterOffline':
					toast('Character is offline, try again later', TOAST_OPTIONS_ERROR);
					break;
				case 'failure':
					toast('Failed to request the permissions', TOAST_OPTIONS_ERROR);
					break;
				case undefined:
					break;
				default:
					AssertNever(result);
			}
		},
		{
			errorHandler: (err) => {
				GetLogger('wardrobeSendPermissionRequest').error('Error requesting permissions:', err);
				toast(`Error requesting permissions`, TOAST_OPTIONS_ERROR);
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
	} = useWardrobeActionContext();

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
