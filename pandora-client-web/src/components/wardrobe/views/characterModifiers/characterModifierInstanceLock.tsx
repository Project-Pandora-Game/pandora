import classNames from 'classnames';
import {
	AppearanceActionProcessingContext,
	AssertNever,
	CHARACTER_MODIFIER_LOCK_DEFINITIONS,
	CharacterModifierActionCheckLockModify,
	CharacterModifierLockType,
	GetLogger,
	KnownObject,
	type AppearanceActionData,
	type CharacterModifierLockAction,
	type GameLogicModifierInstanceClient,
	type IClientShardNormalResult,
	type LockLogic,
	type PermissionGroup,
} from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import deleteIcon from '../../../../assets/icons/delete.svg';
import closedLock from '../../../../assets/icons/lock_closed.svg';
import emptyLock from '../../../../assets/icons/lock_empty.svg';
import openLock from '../../../../assets/icons/lock_open.svg';
import type { ICharacter } from '../../../../character/character.ts';
import { useAsyncEvent } from '../../../../common/useEvent.ts';
import { TOAST_OPTIONS_ERROR } from '../../../../persistentToast.ts';
import { Button } from '../../../common/button/button.tsx';
import { Column, Row } from '../../../common/container/container.tsx';
import { ModalDialog } from '../../../dialog/dialog.tsx';
import { useCheckAddPermissions } from '../../../gameContext/permissionCheckProvider.tsx';
import { useShardConnector } from '../../../gameContext/shardConnectorContextProvider.tsx';
import { WardrobeLockLogicLocked, WardrobeLockLogicUnlocked, type WardrobeLockLogicExecuteButtonProps } from '../../views/wardrobeLockLogic.tsx';
import { useWardrobeActionContext, useWardrobePermissionRequestCallback } from '../../wardrobeActionContext.tsx';
import { ActionWarningContent, WardrobeActionButtonElement } from '../../wardrobeComponents.tsx';

export interface WardrobeCharacterModifierLockProps {
	character: ICharacter;
	instance: GameLogicModifierInstanceClient;
}

export function WardrobeCharacterModifierLock({ character, instance }: WardrobeCharacterModifierLockProps): ReactElement {
	const [showLockSelectionDialog, setShowLockSelectionDialog] = useState(false);

	const lock = instance.lock;

	if (lock == null) {
		return (
			<Column padding='medium'>
				<Row padding='medium' wrap>
					<button className={ classNames('wardrobeActionButton', 'IconButton', 'allowed') } onClick={ () => setShowLockSelectionDialog(true) } >
						<img src={ emptyLock } />
					</button>
					<Row padding='medium' alignY='center'>
						No lock
					</Row>
				</Row>
				{
					showLockSelectionDialog ? (
						<WardrobeCharacterModifierLockSelectionDialog
							character={ character }
							instance={ instance }
							close={ () => setShowLockSelectionDialog(false) }
						/>
					) : null
				}
			</Column>
		);
	}

	if (!lock.logic.isLocked()) {
		return (
			<Column padding='medium'>
				<Row padding='medium' wrap>
					<img width='21' height='33' src={ openLock } />
					<Row padding='medium' alignY='center'>
						<span>
							Lock: { CHARACTER_MODIFIER_LOCK_DEFINITIONS[lock.type].name } (unlocked)
						</span>
					</Row>
				</Row>
				<Row wrap>
					<WardrobeCharacterModifierLockRemoveButton
						character={ character }
						instance={ instance }
					/>
				</Row>
				<WardrobeCharacterModifierLockUnlocked character={ character } instance={ instance } lockLogic={ lock.logic } />
			</Column>
		);
	}

	return (
		<Column padding='medium'>
			<Row padding='medium' wrap>
				<img width='21' height='33' src={ closedLock } />
				<Row padding='medium' alignY='center'>
					<span>
						Locked with: { CHARACTER_MODIFIER_LOCK_DEFINITIONS[lock.type].name }
					</span>
				</Row>
			</Row>
			<WardrobeCharacterModifierLockLockLocked character={ character } instance={ instance } lockLogic={ lock.logic } />
		</Column>
	);
}

function WardrobeCharacterModifierLockLockLocked({ character, instance, lockLogic }: WardrobeCharacterModifierLockProps & { lockLogic: LockLogic; }): ReactElement | null {
	const actionContext = useMemo((): WardrobeCharacterModifierLockActionButtonContext => ({
		character,
		instance,
	}), [character, instance]);

	return (
		<WardrobeLockLogicLocked
			lockLogic={ lockLogic }
			ActionButton={ WardrobeCharacterModifierLockActionButton }
			actionContext={ actionContext }
		/>
	);
}

function WardrobeCharacterModifierLockUnlocked({ character, instance, lockLogic }: WardrobeCharacterModifierLockProps & { lockLogic: LockLogic; }): ReactElement | null {
	const actionContext = useMemo((): WardrobeCharacterModifierLockActionButtonContext => ({
		character,
		instance,
	}), [character, instance]);

	return (
		<WardrobeLockLogicUnlocked
			lockLogic={ lockLogic }
			ActionButton={ WardrobeCharacterModifierLockActionButton }
			actionContext={ actionContext }
		/>
	);
}

function WardrobeCharacterModifierLockSelectionDialog({ character, instance, close }: WardrobeCharacterModifierLockProps & { close: () => void; }): ReactElement {
	return (
		<ModalDialog>
			<Column>
				<h2>Select lock</h2>
				{
					KnownObject.keys(CHARACTER_MODIFIER_LOCK_DEFINITIONS).map((type) => (
						<WardrobeCharacterModifierLockAddButton
							key={ type }
							lockType={ type }
							character={ character }
							instance={ instance }
							close={ close }
						/>
					))
				}
				<hr className='fill-x' />
				<Button
					onClick={ () => {
						close();
					} }
				>
					Cancel
				</Button>
			</Column>
		</ModalDialog>
	);
}

function WardrobeCharacterModifierLockAddButton({ character, instance, lockType, close }: WardrobeCharacterModifierLockProps & { close: () => void; lockType: CharacterModifierLockType; }): ReactElement {
	const action = useMemo((): CharacterModifierLockAction => ({
		action: 'addLock',
		lockType,
	}), [lockType]);

	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckLockModify(processingContext, character.id, instance, action);
	}, [actions, globalState, character, instance, action]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const [execute, processing] = useAsyncEvent(async () => {
		if (shard == null) {
			return null;
		}

		return await shard.awaitResponse('characterModifierLock', {
			target: character.id,
			modifier: instance.id,
			action,
		});
	}, (result: IClientShardNormalResult['characterModifierLock'] | null) => {
		if (result == null) {
			toast('Request failed, try again later', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'ok') {
			close();
			return;
		} else if (result.result === 'characterNotFound') {
			toast('The target character is no longer in the same space', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'failure') {
			toast(
				<Column>
					<span>Problems performing action:</span>
					<ActionWarningContent problems={ result.problems } prompt={ false } customText='' />
				</Column>,
				TOAST_OPTIONS_ERROR,
			);
		} else {
			AssertNever(result);
		}
	}, {
		errorHandler: (err) => {
			GetLogger('ModifierInstanceLockActionButton').error('Failed to delete character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const onClick = useCallback(() => {
		const permissions = check.valid ? [] : check.problems
			.filter((p) => p.result === 'restrictionError')
			.map((p) => p.restriction)
			.filter((r) => r.type === 'missingPermission')
			.map((r): [PermissionGroup, string] => ([r.permissionGroup, r.permissionId]));

		if (permissions.length > 0) {
			requestPermissions(character.id, permissions);
		} else {
			execute();
		}
	}, [check, execute, requestPermissions, character]);

	return (
		<WardrobeActionButtonElement
			check={ check }
			onClick={ onClick }
			disabled={ processing || processingPermissionRequest }
		>
			{ CHARACTER_MODIFIER_LOCK_DEFINITIONS[lockType].name }
		</WardrobeActionButtonElement>
	);
}

function WardrobeCharacterModifierLockRemoveButton({ character, instance }: WardrobeCharacterModifierLockProps): ReactElement {
	const action = useMemo((): CharacterModifierLockAction => ({
		action: 'removeLock',
	}), []);

	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckLockModify(processingContext, character.id, instance, action);
	}, [actions, globalState, character, instance, action]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const [execute, processing] = useAsyncEvent(async () => {
		if (shard == null) {
			return null;
		}

		return await shard.awaitResponse('characterModifierLock', {
			target: character.id,
			modifier: instance.id,
			action,
		});
	}, (result: IClientShardNormalResult['characterModifierLock'] | null) => {
		if (result == null) {
			toast('Request failed, try again later', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'ok') {
			return;
		} else if (result.result === 'characterNotFound') {
			toast('The target character is no longer in the same space', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'failure') {
			toast(
				<Column>
					<span>Problems performing action:</span>
					<ActionWarningContent problems={ result.problems } prompt={ false } customText='' />
				</Column>,
				TOAST_OPTIONS_ERROR,
			);
		} else {
			AssertNever(result);
		}
	}, {
		errorHandler: (err) => {
			GetLogger('ModifierInstanceLockActionButton').error('Failed to delete character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const onClick = useCallback(() => {
		const permissions = check.valid ? [] : check.problems
			.filter((p) => p.result === 'restrictionError')
			.map((p) => p.restriction)
			.filter((r) => r.type === 'missingPermission')
			.map((r): [PermissionGroup, string] => ([r.permissionGroup, r.permissionId]));

		if (permissions.length > 0) {
			requestPermissions(character.id, permissions);
		} else {
			execute();
		}
	}, [check, execute, requestPermissions, character]);

	return (
		<WardrobeActionButtonElement
			check={ check }
			onClick={ onClick }
			disabled={ processing || processingPermissionRequest }
		>
			<img src={ deleteIcon } alt='Delete action' /> Remove the lock
		</WardrobeActionButtonElement>
	);
}

interface WardrobeCharacterModifierLockActionButtonContext {
	character: ICharacter;
	instance: GameLogicModifierInstanceClient;
}

function WardrobeCharacterModifierLockActionButton({
	disabled,
	onFailure,
	lockAction,
	onCurrentlyAttempting,
	children,
	actionContext,
	onExecute,
}: WardrobeLockLogicExecuteButtonProps<WardrobeCharacterModifierLockActionButtonContext>): ReactElement {
	const { character, instance } = actionContext;

	// Modifiers do not have action attempts
	useEffect(() => {
		onCurrentlyAttempting?.(false);
	}, [onCurrentlyAttempting]);

	const action = useMemo((): CharacterModifierLockAction => ({
		action: 'lockAction',
		lockAction,
	}), [lockAction]);

	const { actions, globalState } = useWardrobeActionContext();
	const shard = useShardConnector();

	const checkInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return CharacterModifierActionCheckLockModify(processingContext, character.id, instance, action);
	}, [actions, globalState, character, instance, action]);
	const check = useCheckAddPermissions(checkInitial);

	const [requestPermissions, processingPermissionRequest] = useWardrobePermissionRequestCallback();

	const [execute, processing] = useAsyncEvent(async () => {
		if (shard == null) {
			return null;
		}

		return await shard.awaitResponse('characterModifierLock', {
			target: character.id,
			modifier: instance.id,
			action,
		});
	}, (result: IClientShardNormalResult['characterModifierLock'] | null) => {
		if (result == null) {
			toast('Request failed, try again later', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'ok') {
			const resultData: AppearanceActionData[] = [];
			// Attach password data if result contains it
			if (result.password != null) {
				resultData.push({
					type: 'moduleActionData',
					data: {
						moduleAction: 'showPassword',
						password: result.password,
					},
				});
			}
			onExecute?.(resultData);
			return;
		} else if (result.result === 'characterNotFound') {
			toast('The target character is no longer in the same space', TOAST_OPTIONS_ERROR);
		} else if (result.result === 'failure') {
			onFailure?.();
			toast(
				<Column>
					<span>Problems performing action:</span>
					<ActionWarningContent problems={ result.problems } prompt={ false } customText='' />
				</Column>,
				TOAST_OPTIONS_ERROR,
			);
		} else {
			AssertNever(result);
		}
	}, {
		errorHandler: (err) => {
			GetLogger('ModifierInstanceLockActionButton').error('Failed to delete character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const onClick = useCallback(() => {
		const permissions = check.valid ? [] : check.problems
			.filter((p) => p.result === 'restrictionError')
			.map((p) => p.restriction)
			.filter((r) => r.type === 'missingPermission')
			.map((r): [PermissionGroup, string] => ([r.permissionGroup, r.permissionId]));

		if (permissions.length > 0) {
			requestPermissions(character.id, permissions);
		} else {
			execute();
		}
	}, [check, execute, requestPermissions, character]);

	return (
		<WardrobeActionButtonElement
			check={ check }
			onClick={ onClick }
			disabled={ disabled || processing || processingPermissionRequest }
		>
			{ children }
		</WardrobeActionButtonElement>
	);
}
