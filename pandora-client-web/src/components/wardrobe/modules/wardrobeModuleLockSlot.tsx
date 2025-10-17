import classNames from 'classnames';
import {
	ItemLock,
	type ActionTargetSelector,
	type AppearanceAction,
	type ItemPath,
} from 'pandora-common';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot.js';
import React, { ReactElement, useCallback, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import deleteIcon from '../../../assets/icons/delete.svg';
import closedLock from '../../../assets/icons/lock_closed.svg';
import emptyLock from '../../../assets/icons/lock_empty.svg';
import openLock from '../../../assets/icons/lock_open.svg';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import { WardrobeItemName } from '../itemDetail/wardrobeItemName.tsx';
import { WardrobeLockLogicLocked, WardrobeLockLogicUnlocked, type WardrobeLockLogicExecuteButtonProps } from '../views/wardrobeLockLogic.tsx';
import type { WardrobeExecuteCheckedResult } from '../wardrobeActionContext.tsx';
import { WardrobeActionButton } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes.ts';

export function WardrobeModuleConfigLockSlot({ target, item, moduleName, m }: WardrobeModuleProps<ItemModuleLockSlot>): ReactElement {
	const { focuser, currentRoomSelector } = useWardrobeContext();
	const onFocus = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		focuser.focusItemModule(item, moduleName, target);
	}, [item, target, moduleName, focuser]);

	if (m.lock == null) {
		return (
			<Column padding='medium'>
				<Row padding='medium' wrap>
					<button className={ classNames('wardrobeActionButton', 'IconButton', 'allowed') } onClick={ onFocus } >
						<img src={ emptyLock } />
					</button>
					<Row padding='medium' alignY='center'>
						No lock
					</Row>
				</Row>
			</Column>
		);
	}

	if (!m.lock.isLocked()) {
		return (
			<Column padding='medium'>
				<Row padding='medium' wrap>
					<img width='21' height='33' src={ openLock } />
					<Row padding='medium' alignY='center'>
						<span>
							Lock:&#x20;<WardrobeItemName item={ m.lock } /> (unlocked)
						</span>
					</Row>
				</Row>
				<Row wrap>
					<WardrobeActionButton
						action={ {
							type: 'transfer',
							source: target,
							item: {
								container: [
									...item.container,
									{
										item: item.itemId,
										module: moduleName,
									},
								],
								itemId: m.lock.id,
							},
							target: currentRoomSelector,
							container: [],
						} }
					>
						<span>
							<u>▽</u> Remove and store in room
						</span>
					</WardrobeActionButton>
					<WardrobeActionButton
						action={ {
							type: 'delete',
							target,
							item: {
								container: [
									...item.container,
									{
										item: item.itemId,
										module: moduleName,
									},
								],
								itemId: m.lock.id,
							},
						} }
					>
						<img src={ deleteIcon } alt='Delete action' /> Delete the lock
					</WardrobeActionButton>
				</Row>
				<WardrobeLockSlotUnlocked target={ target } item={ item } moduleName={ moduleName } m={ m } lock={ m.lock } />
				<WardrobeLockSlotLockDescription lock={ m.lock } />
			</Column>
		);
	}

	return (
		<Column padding='medium'>
			<Row padding='medium' wrap>
				<img width='21' height='33' src={ closedLock } />
				<Row padding='medium' alignY='center'>
					<span>
						Locked with:&#x20;<WardrobeItemName item={ m.lock } />
					</span>
				</Row>
			</Row>
			<WardrobeLockSlotLocked target={ target } item={ item } moduleName={ moduleName } m={ m } lock={ m.lock } />
			<WardrobeLockSlotLockDescription lock={ m.lock } />
		</Column>
	);
}

export function WardrobeModuleTemplateConfigLockSlot({ template, onTemplateChange }: WardrobeModuleTemplateProps<'lockSlot'>): ReactElement {
	const assetManager = useAssetManager();
	const lock = template?.lock != null ? assetManager.getAssetById(template.lock.asset) : null;

	if (lock == null) {
		return (
			<Column padding='medium'>
				<Row padding='medium' wrap>
					<button className='wardrobeActionButton IconButton' disabled>
						<img src={ emptyLock } />
					</button>
					<Row padding='medium' alignY='center'>
						No lock
					</Row>
				</Row>
			</Column>
		);
	}

	return (
		<Column padding='medium'>
			<Row padding='medium' wrap>
				<img width='21' height='33' src={ openLock } />
				<Row padding='medium' alignY='center'>
					Lock: { lock.definition.name } (unlocked)
				</Row>
			</Row>
			<Row wrap>
				<button
					className='wardrobeActionButton allowed'
					onClick={ (ev) => {
						ev.stopPropagation();
						onTemplateChange({
							type: 'lockSlot',
							lock: null,
						});
					} }
				>
					<img src={ deleteIcon } alt='Delete action' /> Remove lock
				</button>
			</Row>
		</Column>
	);
}

function WardrobeLockSlotLockDescription({ lock }: {
	lock: ItemLock;
}): ReactElement {
	return (
		<>
			{ !lock.description ? null : (
				<FieldsetToggle legend='Show custom lock description' open={ false }>
					<span className='display-linebreak'>
						{ lock.description }
					</span>
				</FieldsetToggle>
			) }
		</>
	);
}

function WardrobeLockSlotLocked({ target, item, moduleName, lock }: Omit<WardrobeModuleProps<ItemModuleLockSlot>, 'setFocus'> & { lock: ItemLock; }): ReactElement | null {
	const actionContext = useMemo((): WardrobeLockSlotActionButtonContext => ({
		target,
		item,
		moduleName,
	}), [target, item, moduleName]);

	return (
		<WardrobeLockLogicLocked
			lockLogic={ lock.lockLogic }
			lockedText={ lock.asset.definition.lockedText }
			ActionButton={ WardrobeLockSlotActionButton }
			actionContext={ actionContext }
		/>
	);
}

function WardrobeLockSlotUnlocked({ target, item, moduleName, lock }: Omit<WardrobeModuleProps<ItemModuleLockSlot>, 'setFocus'> & { lock: ItemLock; }): ReactElement | null {
	const actionContext = useMemo((): WardrobeLockSlotActionButtonContext => ({
		target,
		item,
		moduleName,
	}), [target, item, moduleName]);

	return (
		<WardrobeLockLogicUnlocked
			lockLogic={ lock.lockLogic }
			ActionButton={ WardrobeLockSlotActionButton }
			actionContext={ actionContext }
		/>
	);
}

interface WardrobeLockSlotActionButtonContext {
	target: ActionTargetSelector;
	item: ItemPath;
	moduleName: string;
}

function WardrobeLockSlotActionButton({
	disabled,
	onFailure,
	lockAction,
	onCurrentlyAttempting,
	children,
	actionContext,
	onExecute,
	slim,
	iconButton,
}: WardrobeLockLogicExecuteButtonProps<WardrobeLockSlotActionButtonContext>): ReactElement {
	const { target, item, moduleName } = actionContext;

	const action = useMemo((): AppearanceAction => ({
		type: 'moduleAction',
		target,
		item,
		module: moduleName,
		action: {
			moduleType: 'lockSlot',
			lockAction,
		},
	}), [lockAction, item, moduleName, target]);

	const onCurrentAttempt = useCallback((currentAttempt: WardrobeExecuteCheckedResult['currentAttempt']): void => {
		onCurrentlyAttempting?.(currentAttempt != null);
	}, [onCurrentlyAttempting]);

	return (
		<WardrobeActionButton
			disabled={ disabled }
			onFailure={ onFailure }
			action={ action }
			onCurrentAttempt={ onCurrentAttempt }
			onExecute={ onExecute }
			className={ classNames(
				slim ? 'slim' : null,
				iconButton ? 'IconButton' : null,
			) }
		>
			{ children }
		</WardrobeActionButton>
	);
}
