import type { Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import {
	AppearanceAction,
	AppearanceActionContext,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkGlobalState,
	GetLogger,
	IClientShardResult,
	RedactSensitiveActionData,
	type AppearanceActionData,
	type AppearanceActionProblem,
	type AppearanceActionProcessingResult,
	type CharacterActionAttempt,
	type CharacterId,
	type IClientShardNormalResult,
	type Nullable,
	type PermissionGroup,
} from 'pandora-common';
import { createContext, useCallback, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { RenderAppearanceActionProblem } from '../../assets/appearanceValidation.tsx';
import { useAssetManager } from '../../assets/assetManager.tsx';
import type { ICharacter } from '../../character/character.ts';
import type { PlayerCharacter } from '../../character/player.ts';
import { useAsyncEvent } from '../../common/useEvent.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../persistentToast.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { Column } from '../common/container/container.tsx';
import { useConfirmDialog } from '../dialog/dialog.tsx';
import { useActionSpaceContext, useGameState, useGlobalState, useSpaceCharacters } from '../gameContext/gameStateContextProvider.tsx';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider.tsx';
import { ActionWarningContent } from './wardrobeComponents.tsx';
import { WardrobeCheckResultForConfirmationWarnings } from './wardrobeUtils.ts';

export interface WardrobeActionContext {
	player: ICharacter;
	globalState: AssetFrameworkGlobalState;
	actions: AppearanceActionContext;
	doImmediateAction: (action: Immutable<AppearanceAction>) => IClientShardResult['gameLogicAction'];
	startActionAttempt: (action: Immutable<AppearanceAction>) => IClientShardResult['gameLogicAction'];
	completeCurrentActionAttempt: () => IClientShardResult['gameLogicAction'];
	abortCurrentActionAttempt: () => IClientShardResult['gameLogicAction'];
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
		executionContext: 'clientOnlyVerify',
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
		doImmediateAction: (action) => gameState.doImmediateAction(action),
		startActionAttempt: (action) => gameState.startActionAttempt(action),
		completeCurrentActionAttempt: () => gameState.completeCurrentActionAttempt(),
		abortCurrentActionAttempt: () => gameState.abortCurrentActionAttempt(),
		sendPermissionRequest: (permissionRequestTarget, permissions) => shardConnector?.awaitResponse('requestPermission', { target: permissionRequestTarget, permissions }),
	}), [player, globalState, actions, shardConnector, gameState]);

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

type WardrobeExecuteCallback = (action: Immutable<AppearanceAction>, operation?: 'start' | 'complete' | 'abort') => void;

type ExecuteCallbackOptions = {
	onSuccess?: (data: readonly AppearanceActionData[], operation?: Parameters<WardrobeExecuteCallback>[1]) => void;
	onFailure?: (problems: readonly AppearanceActionProblem[]) => void;
	allowMultipleSimultaneousExecutions?: boolean;
};

export function useWardrobeExecuteCallback({ onSuccess, onFailure, allowMultipleSimultaneousExecutions }: ExecuteCallbackOptions = {}): [WardrobeExecuteCallback, processing: boolean] {
	const assetManager = useAssetManager();
	const {
		doImmediateAction,
		startActionAttempt,
		completeCurrentActionAttempt,
		abortCurrentActionAttempt,
	} = useWardrobeActionContext();
	const {
		wardrobeItemDisplayNameType,
	} = useAccountSettings();
	return useAsyncEvent(
		async (action: Immutable<AppearanceAction>, operation?: 'start' | 'complete' | 'abort'): Promise<[IClientShardNormalResult['gameLogicAction'], Parameters<WardrobeExecuteCallback>[1]]> => {
			if (operation === 'start') {
				return [await startActionAttempt(action), 'start'];
			} else if (operation === 'complete') {
				return [await completeCurrentActionAttempt(), 'complete'];
			} else if (operation === 'abort') {
				return [await abortCurrentActionAttempt(), 'abort'];
			} else if (operation === undefined) {
				return [await doImmediateAction(action), undefined];
			}
			AssertNever(operation);
		},
		([result, operation]) => {
			switch (result?.result) {
				case 'success':
					onSuccess?.(result.data, operation);
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

export interface WardrobeExecuteCheckedResult {
	execute: () => void;
	processing: boolean;
	currentAttempt: Immutable<CharacterActionAttempt> | null;
}

export function useWardrobeExecuteChecked(action: Nullable<Immutable<AppearanceAction>>, result?: AppearanceActionProcessingResult | null, props: ExecuteCallbackOptions = {}): WardrobeExecuteCheckedResult {
	const {
		player,
		actions: { spaceContext },
		globalState,
	} = useWardrobeActionContext();

	const confirm = useConfirmDialog();

	const currentlyAttemptedAction = globalState.getCharacterState(player.id)?.attemptingAction;
	const isCurrentlyAttempting = action != null && currentlyAttemptedAction != null && isEqual(
		// HACK: Using JSON stringify+parse, because some fields might be `undefined` on one while missing on the other
		JSON.parse(JSON.stringify(RedactSensitiveActionData(action))),
		JSON.parse(JSON.stringify(RedactSensitiveActionData(currentlyAttemptedAction.action))),
	);

	const onSuccess = props.onSuccess;
	const [execute, processing] = useWardrobeExecuteCallback({
		...props,
		onSuccess: useCallback<ExecuteCallbackOptions['onSuccess'] & {}>((data, operation) => {
			if (operation === 'start')
				return;

			onSuccess?.(data, operation);
		}, [onSuccess]),
	});

	return {
		execute: useCallback(() => {
			if (action == null || result == null)
				return;

			if (!result.valid && result.prompt == null) {
				toast(<ActionWarningContent problems={ result.problems } prompt={ false } />, TOAST_OPTIONS_WARNING);
				return;
			}

			// Detect need for confirmation
			const warnings = WardrobeCheckResultForConfirmationWarnings(player, spaceContext, action, result);
			const needsAttempt = result.getActionSlowdownTime() > 0;

			Promise.resolve()
				.then(() => {
					if (warnings.length > 0) {
						return confirm(
							`You might not be able to undo this action easily. Continue?`,
							(
								<ul>
									{
										warnings.map((warning, i) => <li key={ i }>{ warning }</li>)
									}
								</ul>
							),
						);
					}

					return true;
				})
				.then((confirmResult) => {
					if (!confirmResult)
						return;

					if (isCurrentlyAttempting) {
						execute(action, 'complete');
					} else if (needsAttempt) {
						execute(action, 'start');
					} else {
						execute(action);
					}

				})
				.catch(() => { /* NOOP */ });
		}, [execute, confirm, player, spaceContext, action, result, isCurrentlyAttempting]),
		processing,
		currentAttempt: isCurrentlyAttempting ? currentlyAttemptedAction : null,
	};
}
