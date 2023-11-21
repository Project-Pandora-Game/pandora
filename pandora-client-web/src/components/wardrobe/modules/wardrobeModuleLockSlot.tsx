import classNames from 'classnames';
import {
	Assert,
	AssertNever,
	FormatTimeInterval,
	ItemLock,
	LockAssetDefinition,
	MessageSubstitute,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Column, Row } from '../../common/container/container';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import emptyLock from '../../../assets/icons/lock_empty.svg';
import closedLock from '../../../assets/icons/lock_closed.svg';
import openLock from '../../../assets/icons/lock_open.svg';
import deleteIcon from '../../../assets/icons/delete.svg';
import { useCurrentTime } from '../../../common/useCurrentTime';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeActionButton } from '../wardrobeComponents';
import type { Immutable } from 'immer';
import { useAssetManager } from '../../../assets/assetManager';

export function WardrobeModuleConfigLockSlot({ item, moduleName, m, setFocus }: WardrobeModuleProps<ItemModuleLockSlot>): ReactElement {
	const { targetSelector } = useWardrobeContext();
	const onFocus = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		setFocus({
			container: [
				...item.container,
				{
					item: item.itemId,
					module: moduleName,
				},
			],
			itemId: null,
		});
	}, [item, moduleName, setFocus]);

	if (m.lock == null) {
		return (
			<Column padding='medium'>
				<Row padding='medium' wrap>
					<button className={ classNames('wardrobeActionButton', 'allowed') } onClick={ onFocus } >
						<img width='21' height='33' src={ emptyLock } />
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
						Lock: { m.lock.asset.definition.name } (unlocked)
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
					Locked with: { m.lock.asset.definition.name }
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
					<button className='wardrobeActionButton' disabled>
						<img width='21' height='33' src={ emptyLock } />
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

	return (
		<>
			{ lockedText }
			{
				lock.asset.definition.password ? (
					<Column className='WardrobeLockPassword'>
						<Row className='WardrobeInputRow'>
							<label>Remove password</label>
							<input type='checkbox' checked={ clearLastPassword } onChange={ (e) => setClearLastPassword(e.target.checked) } />
						</Row>
						<PasswordInput
							password={ lock.asset.definition.password }
							showInvalidWarning={ showInvalidWarning }
							setAllowExecute={ (allow, value) => {
								setAllowExecute(allow);
								if (allow)
									setPassword(value);
							} }
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
							password,
							clearLastPassword,
						},
					},
				} }>
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
									<input type='checkbox' checked={ useOldPassword } onChange={ () => setUseOldPassword(!useOldPassword) } />
								</Row>
							) : null
						}
						<PasswordInput
							password={ lock.asset.definition.password }
							disabled={ useOldPassword && lock.hasPassword }
							setAllowExecute={ (allow, value) => {
								setAllowExecute(allow);
								if (allow)
									setPassword(value);
							} }
						/>
					</Column>
				) : null
			}
			<WardrobeActionButton
				disabled={ !allowExecute && !useOldPassword }
				action={ {
					type: 'moduleAction',
					target: targetSelector,
					item,
					module: moduleName,
					action: {
						moduleType: 'lockSlot',
						lockAction: {
							action: 'lock',
							password: useOldPassword ? undefined : password,
						},
					},
				} }>
				Lock
			</WardrobeActionButton>
		</>
	);
}

function PasswordInput({
	password,
	showInvalidWarning,
	setAllowExecute,
	disabled,
}: {
	password: Immutable<NonNullable<LockAssetDefinition['password']>>;
	showInvalidWarning?: boolean;
	setAllowExecute?: (...args: [false, null] | [true, string]) => void;
	disabled?: boolean;

}) {
	const [min, max] = typeof password.length === 'number' ? [password.length, password.length] : password.length;
	const [value, setValue] = useState('');

	const id = useId();

	const onInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		switch (password.format) {
			case 'numeric':
				setValue(e.target.value.replace(/[^0-9]/g, ''));
				break;
			case 'letters':
				setValue(e.target.value.replace(/[^a-zA-Z]/g, ''));
				break;
			case 'alphanumeric':
				setValue(e.target.value.replace(/[^a-zA-Z0-9]/g, ''));
				break;
			case 'text':
				setValue(e.target.value);
				break;
			default:
				AssertNever(password.format);
		}
	}, [password.format]);

	const error = useMemo(() => {
		if (disabled)
			return null;

		if (value.length < min)
			return `Must be at least ${min} characters`;
		if (value.length > max)
			return `Must be at most ${max} characters`;
		if (showInvalidWarning)
			return 'Invalid password';

		return null;
	}, [disabled, value, min, max, showInvalidWarning]);

	useEffect(() => {
		if (setAllowExecute == null)
			return;

		if (value.length < min || value.length > max) {
			setAllowExecute(false, null);
			return;
		}
		let allow = true;
		switch (password.format) {
			case 'numeric':
				allow = /^[0-9]+$/.test(value);
				break;
			case 'letters':
				allow = /^[a-zA-Z]+$/.test(value);
				break;
			case 'alphanumeric':
				allow = /^[a-zA-Z0-9]+$/.test(value);
				break;
			case 'text':
				break;
			default:
				AssertNever(password.format);
		}
		if (!allow) {
			setAllowExecute(false, null);
		} else {
			setAllowExecute(true, value);
		}
	}, [value, min, max, password.format, setAllowExecute]);

	return (
		<>
			<Row className='WardrobeInputRow'>
				<label htmlFor={ id }>
					Password
				</label>
				<input
					id={ id }
					type='text'
					value={ value }
					maxLength={ max }
					onInput={ onInput }
					disabled={ disabled }
				/>
			</Row>
			{
				error ? (
					<Row className='WardrobeInputRow'>
						<span>{ error }</span>
					</Row>
				) : null
			}
		</>
	);
}
