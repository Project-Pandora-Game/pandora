import classNames from 'classnames';
import type { Immutable } from 'immer';
import {
	AppearanceAction,
	Assert,
	AssertNever,
	FormatTimeInterval,
	ItemLock,
	LockAssetDefinition,
	MessageSubstitute,
	type AppearanceActionData,
	type Asset,
} from 'pandora-common';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import React, { ReactElement, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import deleteIcon from '../../../assets/icons/delete.svg';
import closedLock from '../../../assets/icons/lock_closed.svg';
import emptyLock from '../../../assets/icons/lock_empty.svg';
import openLock from '../../../assets/icons/lock_open.svg';
import { useCurrentTime } from '../../../common/useCurrentTime';
import { Checkbox } from '../../../common/userInteraction/checkbox';
import { TextInput } from '../../../common/userInteraction/input/textInput';
import { Column, Row } from '../../common/container/container';
import { WardrobeItemName } from '../itemDetail/wardrobeItemName';
import type { WardrobeExecuteCheckedResult } from '../wardrobeActionContext';
import { WardrobeActionButton } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes';

export function WardrobeModuleConfigLockSlot({ item, moduleName, m }: WardrobeModuleProps<ItemModuleLockSlot>): ReactElement {
	const { targetSelector, target, focuser } = useWardrobeContext();
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
						Lock:&#x20;<WardrobeItemName item={ m.lock } /> (unlocked)
					</Row>
				</Row>
				<Row wrap>
					<WardrobeActionButton
						action={ {
							type: 'delete',
							target: targetSelector,
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
						<img src={ deleteIcon } alt='Delete action' /> Remove and delete
					</WardrobeActionButton>
					<WardrobeActionButton
						action={ {
							type: 'transfer',
							source: targetSelector,
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
							target: { type: 'roomInventory' },
							container: [],
						} }
					>
						<span>
							<u>▽</u> Store in room
						</span>
					</WardrobeActionButton>
				</Row>
				<WardrobeLockSlotUnlocked item={ item } moduleName={ moduleName } m={ m } lock={ m.lock } />
			</Column>
		);
	}

	return (
		<Column padding='medium'>
			<Row padding='medium' wrap>
				<img width='21' height='33' src={ closedLock } />
				<Row padding='medium' alignY='center'>
					Locked with:&#x20;<WardrobeItemName item={ m.lock } />
				</Row>
			</Row>
			<WardrobeLockSlotLocked item={ item } moduleName={ moduleName } m={ m } lock={ m.lock } />
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

function WardrobeLockSlotLocked({ item, moduleName, lock }: Omit<WardrobeModuleProps<ItemModuleLockSlot>, 'setFocus'> & { lock: ItemLock; }): ReactElement | null {
	const { targetSelector } = useWardrobeContext();
	const now = useCurrentTime();
	const lockedText = useMemo(() => {
		Assert(lock.lockData?.locked != null);
		const formatText = lock.asset.definition.lockedText ?? 'Locked by CHARACTER at TIME';
		if (formatText.length === 0)
			return null;

		const { name, id, time } = lock.lockData.locked;

		const substitutes = {
			CHARACTER_NAME: name,
			CHARACTER_ID: id,
			CHARACTER: `${name} (${id})`,
			TIME_PASSED: FormatTimeInterval(now - time),
			TIME: new Date(time).toLocaleString(),
		};
		return (
			<Row padding='medium' alignY='start'>
				{ MessageSubstitute(formatText, substitutes) }
			</Row>
		);
	}, [lock, now]);

	const [password, setPassword] = useState<string | undefined>(undefined);
	const [allowExecute, setAllowExecute] = useState(lock.asset.definition.password == null);
	const [showInvalidWarning, setShowInvalidWarning] = useState(false);
	const [clearLastPassword, setClearLastPassword] = useState(false);

	// Attempted action for locking or unlocking the lock
	const [currentAttempt, setCurrentAttempt] = useState<WardrobeExecuteCheckedResult['currentAttempt']>(null);

	return (
		<>
			{ lockedText }
			{
				lock.asset.definition.password ? (
					<Column className='WardrobeLockPassword'>
						<Row className='WardrobeInputRow'>
							<label>Remove password</label>
							<Checkbox checked={ clearLastPassword } onChange={ setClearLastPassword } />
						</Row>
						<PasswordInput
							item={ item }
							asset={ lock.asset }
							moduleName={ moduleName }
							password={ lock.asset.definition.password }
							showInvalidWarning={ showInvalidWarning }
							setAllowExecute={ (allow, value) => {
								setAllowExecute(allow);
								if (allow)
									setPassword(value);
							} }
							pendingAttempt={ currentAttempt != null }
						/>
					</Column>
				) : null
			}
			<WardrobeActionButton
				disabled={ !allowExecute }
				onFailure={ () => setShowInvalidWarning(true) }
				action={ {
					type: 'moduleAction',
					target: targetSelector,
					item,
					module: moduleName,
					action: {
						moduleType: 'lockSlot',
						lockAction: {
							action: 'unlock',
							password: currentAttempt != null ? undefined : password,
							clearLastPassword,
						},
					},
				} }
				onCurrentAttempt={ setCurrentAttempt }
			>
				Unlock
			</WardrobeActionButton>
		</>
	);
}

function WardrobeLockSlotUnlocked({ item, moduleName, lock }: Omit<WardrobeModuleProps<ItemModuleLockSlot>, 'setFocus'> & { lock: ItemLock; }): ReactElement | null {
	const { targetSelector } = useWardrobeContext();
	const [password, setPassword] = useState<string | undefined>(undefined);
	const [useOldPassword, setUseOldPassword] = useState(false);
	const [allowExecute, setAllowExecute] = useState(lock.asset.definition.password == null);

	// Attempted action for locking or unlocking the lock
	const [currentAttempt, setCurrentAttempt] = useState<WardrobeExecuteCheckedResult['currentAttempt']>(null);

	useEffect(() => {
		if (!lock.hasPassword)
			setUseOldPassword(false);
	}, [lock.hasPassword]);

	return (
		<>
			{
				lock.asset.definition.password ? (
					<Column className='WardrobeLockPassword'>
						{
							lock.hasPassword ? (
								<Row className='WardrobeInputRow'>
									<label>Use old password</label>
									<Checkbox checked={ useOldPassword } onChange={ setUseOldPassword } />
								</Row>
							) : null
						}
						<PasswordInput
							item={ item }
							moduleName={ moduleName }
							asset={ lock.asset }
							password={ lock.asset.definition.password }
							disabled={ useOldPassword && lock.hasPassword }
							setAllowExecute={ (allow, value) => {
								setAllowExecute(allow);
								if (allow)
									setPassword(value);
							} }
							pendingAttempt={ currentAttempt != null }
						/>
					</Column>
				) : null
			}
			<WardrobeActionButton
				disabled={ !allowExecute && !useOldPassword && currentAttempt == null }
				action={ {
					type: 'moduleAction',
					target: targetSelector,
					item,
					module: moduleName,
					action: {
						moduleType: 'lockSlot',
						lockAction: {
							action: 'lock',
							password: currentAttempt != null ? undefined :
								useOldPassword ? undefined :
								password,
						},
					},
				} }
				onCurrentAttempt={ setCurrentAttempt }
			>
				Lock
			</WardrobeActionButton>
		</>
	);
}

function PasswordInput({
	item,
	moduleName,
	asset,
	password,
	pendingAttempt = false,
	showInvalidWarning,
	setAllowExecute,
	disabled,
}: Pick<WardrobeModuleProps<ItemModuleLockSlot>, 'item' | 'moduleName'> & {
	asset: Asset<'lock'>;
	password: Immutable<NonNullable<LockAssetDefinition['password']>>;
	pendingAttempt?: boolean;
	showInvalidWarning?: boolean;
	setAllowExecute?: (...args: [false, null] | [true, string]) => void;
	disabled?: boolean;
}) {
	const { targetSelector } = useWardrobeContext();
	const [min, max] = typeof password.length === 'number' ? [password.length, password.length] : password.length;
	const [value, setValue] = useState('');

	const id = useId();

	const [inputCharacterType, replaceFunc] = useMemo(() => {
		let ict: string;
		let rf: ((_: string) => string);

		switch (password.format) {
			case 'numeric':
				ict = 'digits';
				rf = (v) => v.replace(/[^0-9]/g, '');
				break;
			case 'letters':
				ict = 'letters';
				rf = (v) => v.replace(/[^a-zA-Z]/g, '');
				break;
			case 'alphanumeric':
				ict = 'digits or letters';
				rf = (v) => v.replace(/[^a-zA-Z0-9]/g, '');
				break;
			case 'text':
				ict = 'characters';
				rf = (v) => v;
				break;
			default:
				AssertNever(password.format);
		}
		return [ict, rf];
	}, [password.format]);

	const onInput = useCallback((newValue: string) => {
		setValue(replaceFunc(newValue));
	}, [replaceFunc]);

	const error = useMemo(() => {
		if (disabled)
			return null;

		if (value.length < min && min === max)
			return `Must be ${min} ${inputCharacterType}`;
		if (value.length < min)
			return `Must be at least ${min} ${inputCharacterType}`;
		if (value.length > max)
			return `Must be at most ${max} ${inputCharacterType}`;
		if (showInvalidWarning)
			return 'Invalid password';

		return null;
	}, [disabled, value, min, max, showInvalidWarning, inputCharacterType]);

	const showPasswordAction = useMemo<AppearanceAction>(() => ({
		type: 'moduleAction',
		target: targetSelector,
		item,
		module: moduleName,
		action: {
			moduleType: 'lockSlot',
			lockAction: {
				action: 'showPassword',
			},
		},
	}), [targetSelector, item, moduleName]);

	const onPasswordShown = useCallback((data: readonly AppearanceActionData[]) => {
		for (const d of data) {
			if (d.type === 'moduleActionData' && d.data.moduleAction === 'showPassword') {
				setValue(d.data.password);
				break;
			}
		}
	}, []);

	useEffect(() => {
		if (setAllowExecute == null)
			return;

		const allow = ItemLock._validatePassword(asset, value);
		if (!allow) {
			setAllowExecute(false, null);
		} else {
			setAllowExecute(true, value);
		}
	}, [value, asset, setAllowExecute]);

	return (
		<>
			<Row className='WardrobeInputRow'>
				<label htmlFor={ id }>
					Password
				</label>
				<WardrobeActionButton action={ showPasswordAction } onExecute={ onPasswordShown } disabled={ pendingAttempt }>
					Show
				</WardrobeActionButton>
				<TextInput
					id={ id }
					value={ pendingAttempt ? '\u2022'.repeat(Math.min(max, 16)) : value }
					maxLength={ max }
					onChange={ onInput }
					disabled={ disabled || pendingAttempt }
				/>
			</Row>
			{
				(error && !pendingAttempt) ? (
					<Row className='WardrobeInputRow'>
						<span className='error'>{ error }</span>
					</Row>
				) : null
			}
		</>
	);
}
