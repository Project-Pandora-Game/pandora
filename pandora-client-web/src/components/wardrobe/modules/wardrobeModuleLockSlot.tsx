import classNames from 'classnames';
import type { Immutable } from 'immer';
import {
	AppearanceAction,
	Assert,
	AssertNever,
	FormatTimeInterval,
	ItemLock,
	LockLogic,
	MessageSubstitute,
	type AppearanceActionData,
	type LockSetup,
} from 'pandora-common';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import React, { ReactElement, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import deleteIcon from '../../../assets/icons/delete.svg';
import closedLock from '../../../assets/icons/lock_closed.svg';
import emptyLock from '../../../assets/icons/lock_empty.svg';
import openLock from '../../../assets/icons/lock_open.svg';
import { useCharacterRestrictionManager } from '../../../character/character';
import { useCurrentTime } from '../../../common/useCurrentTime';
import { Checkbox } from '../../../common/userInteraction/checkbox';
import { NumberInput } from '../../../common/userInteraction/input/numberInput';
import { TextInput } from '../../../common/userInteraction/input/textInput';
import { Column, Row } from '../../common/container/container';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { usePlayerState } from '../../gameContext/playerContextProvider';
import { WardrobeItemName } from '../itemDetail/wardrobeItemName';
import { useWardrobeActionContext, type WardrobeExecuteCheckedResult } from '../wardrobeActionContext';
import { WardrobeActionButton } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes';

export function WardrobeModuleConfigLockSlot({ target, item, moduleName, m }: WardrobeModuleProps<ItemModuleLockSlot>): ReactElement {
	const { focuser } = useWardrobeContext();
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
						<img src={ deleteIcon } alt='Delete action' /> Remove and delete
					</WardrobeActionButton>
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
							target: { type: 'roomInventory' },
							container: [],
						} }
					>
						<span>
							<u>▽</u> Store in room
						</span>
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
	const { actions } = useWardrobeActionContext();
	const { player, playerState } = usePlayerState();
	const playerRestrictionManager = useCharacterRestrictionManager(player, playerState, actions.spaceContext);

	const now = useCurrentTime();
	const lockedText = useMemo(() => {
		const lockedData = lock.lockLogic.lockData.locked;
		Assert(lockedData != null);
		const formatText = lock.asset.definition.lockedText ?? 'Locked by CHARACTER at TIME';
		if (formatText.length === 0)
			return null;

		const { name, id, time } = lockedData;

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
	const timeLeft = useMemo(() => {
		const lockedData = lock.lockLogic.lockData.locked;
		Assert(lockedData != null);

		const { lockedUntil } = lockedData;
		if (lockedUntil == null)
			return null;

		if (now >= lockedUntil)
			return 0;

		return lockedUntil - now;
	}, [lock, now]);
	const timerExpired = useMemo(() => (timeLeft == null || timeLeft <= 0), [timeLeft]);
	const timerText = useMemo(() => {
		if (timerExpired)
			return <>Remaining time: <i>Timer expired</i></>;

		return (
			<>
				Remaining time: { FormatTimeInterval(timeLeft ?? 0) }
			</>
		);
	}, [timeLeft, timerExpired]);

	const [password, setPassword] = useState<string>('');
	const [invalidPassword, setInvalidPassword] = useState<string | undefined>(undefined);
	const [clearLastPassword, setClearLastPassword] = useState(false);

	// Attempted action for locking or unlocking the lock
	const [currentAttempt, setCurrentAttempt] = useState<WardrobeExecuteCheckedResult['currentAttempt']>(null);

	const allowExecute =
		lock.lockLogic.lockSetup.password == null ||
		playerRestrictionManager.forceAllowItemActions() ||
		LockLogic.validatePassword(lock.lockLogic.lockSetup, password);

	const action = useMemo((): AppearanceAction => ({
		type: 'moduleAction',
		target,
		item,
		module: moduleName,
		action: {
			moduleType: 'lockSlot',
			lockAction: {
				action: 'unlock',
				password: currentAttempt != null ? undefined : (password || undefined),
				clearLastPassword,
			},
		},
		// Add timerExpired to dependencies to force recalculation once timer runs out
		// eslint-disable-next-line
	}), [clearLastPassword, currentAttempt, item, moduleName, password, target, timerExpired]);

	return (
		<>
			{ lockedText }
			{
				lock.lockLogic.lockSetup.password ? (
					<Column className='WardrobeLockPassword'>
						<Row className='WardrobeInputRow'>
							<label>Remove password</label>
							<Checkbox checked={ clearLastPassword } onChange={ setClearLastPassword } />
						</Row>
						<PasswordInput
							target={ target }
							item={ item }
							value={ password }
							onChange={ setPassword }
							moduleName={ moduleName }
							password={ lock.lockLogic.lockSetup.password }
							showInvalidWarning={ password === invalidPassword }
							pendingAttempt={ currentAttempt != null }
						/>
					</Column>
				) : null
			}
			{
				lock.lockLogic.lockSetup.timer ? (
					<Column className='WardrobeLockTimer'>
						<Row className='WardrobeInputRow'>
							{ timerText }
						</Row>
					</Column>
				) : null
			}
			<WardrobeActionButton
				disabled={ !allowExecute && currentAttempt == null }
				onFailure={ () => setInvalidPassword(password) }
				action={ action }
				onCurrentAttempt={ setCurrentAttempt }
			>
				Unlock
			</WardrobeActionButton>
		</>
	);
}

function WardrobeLockSlotUnlocked({ target, item, moduleName, lock }: Omit<WardrobeModuleProps<ItemModuleLockSlot>, 'setFocus'> & { lock: ItemLock; }): ReactElement | null {
	const [password, setPassword] = useState<string>('');
	const [useOldPassword, setUseOldPassword] = useState(false);

	const [timer, setTimer] = useState<number>(0);

	// Attempted action for locking or unlocking the lock
	const [currentAttempt, setCurrentAttempt] = useState<WardrobeExecuteCheckedResult['currentAttempt']>(null);

	const allowExecute =
		lock.lockLogic.lockSetup.password == null ||
		useOldPassword ||
		LockLogic.validatePassword(lock.lockLogic.lockSetup, password);

	useEffect(() => {
		if (!lock.hasPassword)
			setUseOldPassword(false);
	}, [lock.hasPassword]);

	const action = useMemo((): AppearanceAction => ({
		type: 'moduleAction',
		target,
		item,
		module: moduleName,
		action: {
			moduleType: 'lockSlot',
			lockAction: {
				action: 'lock',
				password: currentAttempt != null ? undefined :
					useOldPassword ? undefined :
					(password || undefined),
				timer: currentAttempt != null ? undefined : (timer || undefined),
			},
		},
	}), [currentAttempt, item, moduleName, password, timer, target, useOldPassword]);

	return (
		<>
			{
				lock.lockLogic.lockSetup.password ? (
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
							target={ target }
							item={ item }
							moduleName={ moduleName }
							value={ password }
							onChange={ setPassword }
							password={ lock.lockLogic.lockSetup.password }
							disabled={ useOldPassword && lock.hasPassword }
							pendingAttempt={ currentAttempt != null }
						/>
					</Column>
				) : null
			}
			{
				lock.lockLogic.lockSetup.timer ? (
					<Column className='WardrobeLockTimer'>
						<TimerInput
							value={ timer }
							onChange={ setTimer }
							timer={ lock.lockLogic.lockSetup.timer }
							pendingAttempt={ currentAttempt != null }
						/>
					</Column>
				) : null
			}
			<WardrobeActionButton
				disabled={ !allowExecute && currentAttempt == null }
				action={ action }
				onCurrentAttempt={ setCurrentAttempt }
			>
				Lock
			</WardrobeActionButton>
		</>
	);
}

function PasswordInput({
	target,
	item,
	moduleName,
	value,
	onChange,
	password,
	pendingAttempt = false,
	showInvalidWarning,
	disabled,
}: Pick<WardrobeModuleProps<ItemModuleLockSlot>, 'target' | 'item' | 'moduleName'> & {
	value: string;
	onChange: (newValue: string) => void;
	password: Immutable<NonNullable<LockSetup['password']>>;
	pendingAttempt?: boolean;
	showInvalidWarning?: boolean;
	disabled?: boolean;
}) {
	const [min, max] = typeof password.length === 'number' ? [password.length, password.length] : password.length;

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
		onChange(replaceFunc(newValue));
	}, [onChange, replaceFunc]);

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
		target,
		item,
		module: moduleName,
		action: {
			moduleType: 'lockSlot',
			lockAction: {
				action: 'showPassword',
			},
		},
	}), [target, item, moduleName]);

	const onPasswordShown = useCallback((data: readonly AppearanceActionData[]) => {
		for (const d of data) {
			if (d.type === 'moduleActionData' && d.data.moduleAction === 'showPassword') {
				onChange(d.data.password);
				break;
			}
		}
	}, [onChange]);

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

function TimerInput({
	value,
	onChange,
	timer,
	pendingAttempt = false,
}: {
	value: number;
	onChange: (newValue: number) => void;
	timer: Immutable<NonNullable<LockSetup['timer']>>;
	pendingAttempt?: boolean;
	showInvalidWarning?: boolean;
}) {
	const hourMs = 3_600_000;
	const minuteMs = 60_000;

	const id = useId();

	const inputValues = useMemo(() => {
		return {
			hours: Math.floor(value / hourMs),
			minutes: Math.floor(value / minuteMs) % 60,
			seconds: Math.floor(value / 1_000) % 60,
		};
	}, [value]);

	const maximums = useMemo(() => {
		if (value >= timer.maxDuration) {
			return inputValues;
		}

		return {
			hours: Math.floor(timer.maxDuration / hourMs),
			minutes: (timer.maxDuration > (59 * minuteMs)) ? 59 : Math.floor(timer.maxDuration / minuteMs),
			seconds: (timer.maxDuration > 59_000) ? 59 : Math.floor(timer.maxDuration / 1_000),
		};
	}, [value, inputValues, timer]);

	const updateTimer = useCallback((newValue: number) => {
		onChange(Math.min(timer.maxDuration, newValue));
	}, [onChange, timer]);

	const setHours = useCallback((newValue: number) => {
		updateTimer(value + (newValue - inputValues.hours) * hourMs);
	}, [value, updateTimer, inputValues]);

	const setMinutes = useCallback((newValue: number) => {
		updateTimer(value + (newValue - inputValues.minutes) * minuteMs);
	}, [value, updateTimer, inputValues]);

	const setSeconds = useCallback((newValue: number) => {
		updateTimer(value + (newValue - inputValues.seconds) * 1_000);
	}, [value, updateTimer, inputValues]);

	return (
		<Row className='WardrobeInputRow'>
			<label htmlFor={ id }>
				Timer
			</label>
			<Row alignY='center'>
				<NumberInput
					id={ `${id}-hours` }
					min={ 0 }
					max={ maximums.hours }
					step={ 1 }
					value={ inputValues.hours }
					onChange={ setHours }
					disabled={ pendingAttempt }
				/>
				<label htmlFor={ `${id}-hours` }>Hours</label>
				{ ' : ' }
				<NumberInput
					id={ `${id}-minutes` }
					min={ 0 }
					max={ maximums.minutes }
					step={ 1 }
					value={ inputValues.minutes }
					onChange={ setMinutes }
					disabled={ pendingAttempt }
				/>
				<label htmlFor={ `${id}-minutes` }>Minutes</label>
				{ ' : ' }
				<NumberInput
					id={ `${id}-seconds` }
					min={ 0 }
					max={ maximums.seconds }
					step={ 1 }
					value={ inputValues.seconds }
					onChange={ setSeconds }
					disabled={ pendingAttempt }
				/>
				<label htmlFor={ `${id}-seconds` }>Seconds</label>
			</Row>
		</Row>
	);
}
