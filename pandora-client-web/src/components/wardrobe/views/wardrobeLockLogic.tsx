import type { Immutable } from 'immer';
import {
	Assert,
	AssertNever,
	FormatTimeInterval,
	GetLogger,
	LockLogic,
	MessageSubstitute,
	type AppearanceActionData,
	type CharacterId,
	type LockAction,
	type LockSetup,
	type LockTimerOptions,
} from 'pandora-common';
import React, { useCallback, useEffect, useId, useMemo, useState, type ReactElement } from 'react';
import crossIcon from '../../../assets/icons/cross.svg';
import { useCharacterRestrictionManager } from '../../../character/character.ts';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { useCurrentTime } from '../../../common/useCurrentTime.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { CharacterListInputActionButtons, CharacterListInputActions, type CharacterListInputAddButtonProps, type CharacterListInputRemoveButtonProps } from '../../../ui/components/characterListInput/characterListInput.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { useConfirmDialog } from '../../dialog/dialog.tsx';
import { usePlayerState } from '../../gameContext/playerContextProvider.tsx';
import { useWardrobeActionContext } from '../wardrobeActionContext.tsx';

export interface WardrobeLockLogicExecuteButtonProps<TActionContext> extends ChildrenProps {
	disabled: boolean;
	onFailure?: () => void;
	onExecute?: (data: readonly AppearanceActionData[]) => void;
	lockAction: LockAction;
	onCurrentlyAttempting?: (attempting: boolean) => void;
	actionContext: TActionContext;
	iconButton?: boolean;
	slim?: boolean;
}

export interface WardrobeLockLogicProps<TActionContext> {
	lockLogic: LockLogic;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ActionButton: React.FC<WardrobeLockLogicExecuteButtonProps<TActionContext>>;
	actionContext: TActionContext;
}

export interface WardrobeLockLogicLockedProps<TActionContext> extends WardrobeLockLogicProps<TActionContext> {
	lockedText?: string;
}

export function WardrobeLockLogicLocked<TActionContext>({ lockLogic, ActionButton, lockedText, actionContext }: WardrobeLockLogicLockedProps<TActionContext>): ReactElement | null {
	const { actions } = useWardrobeActionContext();
	const { player, globalState } = usePlayerState();
	const playerRestrictionManager = useCharacterRestrictionManager(player, globalState, actions.spaceContext);

	const now = useCurrentTime();
	const lockedTextFinal = useMemo(() => {
		const lockedData = lockLogic.lockData.locked;
		Assert(lockedData != null);
		const formatText = lockedText ?? 'Locked by CHARACTER at TIME';
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
	}, [lockLogic, lockedText, now]);
	const timeLeft = useMemo(() => {
		const lockedData = lockLogic.lockData.locked;
		Assert(lockedData != null);

		const { lockedUntil } = lockedData;
		if (lockedUntil == null)
			return null;
		if (now >= lockedUntil)
			return 0;

		return lockedUntil - now;
	}, [lockLogic, now]);
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

	const registeredFingerprints = useMemo(() => {
		if (lockLogic.lockSetup.fingerprint == null)
			return [];

		return lockLogic.lockData.fingerprint?.registered ?? [];
	}, [lockLogic]);

	// Attempted action for locking or unlocking the lock
	const [currentlyAttempting, setCurrentlyAttempting] = useState<boolean>(false);

	const allowExecute =
		lockLogic.lockSetup.password == null ||
		playerRestrictionManager.forceAllowItemActions() ||
		LockLogic.validatePassword(lockLogic.lockSetup, password);

	const action = useMemo((): LockAction => ({
		action: 'unlock',
		password: currentlyAttempting ? undefined : (password || undefined),
		clearLastPassword,
		// Add timerExpired to dependencies to force recalculation once timer runs out
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}), [clearLastPassword, currentlyAttempting, password, timerExpired]);

	return (
		<>
			{ lockedTextFinal }
			{
				lockLogic.lockSetup.password ? (
					<Column className='WardrobeLockPassword'>
						<Row className='WardrobeInputRow'>
							<label>Remove password</label>
							<Checkbox checked={ clearLastPassword } onChange={ setClearLastPassword } />
						</Row>
						<PasswordInput
							value={ password }
							onChange={ setPassword }
							password={ lockLogic.lockSetup.password }
							showInvalidWarning={ password === invalidPassword }
							pendingAttempt={ currentlyAttempting }
							ActionButton={ ActionButton }
							actionContext={ actionContext }
						/>
					</Column>
				) : null
			}
			{
				lockLogic.lockSetup.timer ? (
					<Column className='WardrobeLockTimer'>
						{
							lockLogic.lockData.locked?.disallowEarlyUnlock === true ? (
								<Row className='WardrobeInputRow'>
									Cannot be unlocked early
								</Row>
							) : null
						}
						<Row className='WardrobeInputRow'>
							{ timerText }
						</Row>
					</Column>
				) : null
			}
			{
				lockLogic.lockSetup.fingerprint ? (
					<Column className='WardrobeLockFingerprint'>
						<Row className='WardrobeInputRow'>
							<label>Registered fingerprints:</label>
						</Row>
						<CharacterListInputActions
							value={ registeredFingerprints }
							max={ lockLogic.lockSetup.fingerprint.maxFingerprints }
						/>
					</Column>
				) : null
			}
			<ActionButton
				disabled={ !allowExecute && !currentlyAttempting }
				onFailure={ () => setInvalidPassword(password) }
				lockAction={ action }
				onCurrentlyAttempting={ setCurrentlyAttempting }
				actionContext={ actionContext }
			>
				Unlock
			</ActionButton>
		</>
	);
}

export function WardrobeLockLogicUnlocked<TActionContext>({ lockLogic, ActionButton, actionContext }: WardrobeLockLogicProps<TActionContext>): ReactElement | null {
	const [password, setPassword] = useState<string>('');
	const [useOldPassword, setUseOldPassword] = useState(false);
	const [timer, setTimer] = useState<number>(0);
	const [timerAllowEarly, setTimerAllowEarly] = useState(true);
	const confirm = useConfirmDialog();
	const id = useId();

	// Attempted action for locking or unlocking the lock
	const [currentlyAttempting, setCurrentlyAttempting] = useState<boolean>(false);

	const allowExecute =
		lockLogic.lockSetup.password == null ||
		useOldPassword ||
		LockLogic.validatePassword(lockLogic.lockSetup, password);

	useEffect(() => {
		if (!lockLogic.hasPassword)
			setUseOldPassword(false);
	}, [lockLogic.hasPassword]);

	const timerOptions = useMemo((): LockTimerOptions => {
		return {
			timer,
			allowEarlyUnlock: timerAllowEarly,
		};
	}, [timer, timerAllowEarly]);

	const setTimerAllowEarlyWithConfirm = useCallback((newValue: boolean) => {
		if (newValue) {
			setTimerAllowEarly(newValue);
			return;
		}

		confirm('Confirm disallowing early unlock', <>Are you sure you want to prevent yourself from being able to unlock the lock before the timer runs out?</>)
			.then((confirmed) => {
				if (confirmed) {
					setTimerAllowEarly(newValue);
				}
			})
			.catch((err) => GetLogger('WardrobeLockLogic').error('Error locking lock slot:', err));
	}, [setTimerAllowEarly, confirm]);

	const action = useMemo((): LockAction => ({
		action: 'lock',
		password: currentlyAttempting ? undefined :
					useOldPassword ? undefined :
					(password || undefined),
		timerOptions: currentlyAttempting ? undefined : (timerOptions || undefined),
	}), [currentlyAttempting, password, timerOptions, useOldPassword]);

	return (
		<>
			{
				lockLogic.lockSetup.password ? (
					<Column className='WardrobeLockPassword'>
						{
							lockLogic.hasPassword ? (
								<Row className='WardrobeInputRow'>
									<label>Use old password</label>
									<Checkbox checked={ useOldPassword } onChange={ setUseOldPassword } />
								</Row>
							) : null
						}
						<PasswordInput
							value={ password }
							onChange={ setPassword }
							password={ lockLogic.lockSetup.password }
							disabled={ useOldPassword && lockLogic.hasPassword }
							pendingAttempt={ currentlyAttempting }
							ActionButton={ ActionButton }
							actionContext={ actionContext }
						/>
					</Column>
				) : null
			}
			{
				lockLogic.lockSetup.timer ? (
					<Column className='WardrobeLockTimer'>
						<Row className='WardrobeInputRow'>
							<Checkbox id={ `${id}-timerAllowEarly` } checked={ timerAllowEarly } onChange={ setTimerAllowEarlyWithConfirm } />
							<label htmlFor={ `${id}-timerAllowEarly` }>The lock can be unlocked by you even the before timer runs out</label>
						</Row>
						<TimerInput
							value={ timer }
							onChange={ setTimer }
							timer={ lockLogic.lockSetup.timer }
							pendingAttempt={ currentlyAttempting }
						/>
					</Column>
				) : null
			}
			{
				lockLogic.lockSetup.fingerprint ? (
					<Column className='WardrobeLockFingerprint'>
						<CharacterList<TActionContext>
							ActionButton={ ActionButton }
							actionContext={ actionContext }
							content={ lockLogic.lockData.fingerprint?.registered ?? [] }
							fingerprint={ lockLogic.lockSetup.fingerprint }
						/>
					</Column>
				) : null
			}
			<ActionButton
				disabled={ !allowExecute && !currentlyAttempting }
				lockAction={ action }
				onCurrentlyAttempting={ setCurrentlyAttempting }
				actionContext={ actionContext }
			>
				Lock
			</ActionButton>
		</>
	);
}

function CharacterList<TActionContext>({
	fingerprint,
	content,
	ActionButton,
	actionContext,
}: {
	fingerprint: Immutable<NonNullable<LockSetup['fingerprint']>>;
	content: readonly CharacterId[];
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ActionButton: React.FC<WardrobeLockLogicExecuteButtonProps<TActionContext>>;
	actionContext: TActionContext;
}) {

	const ctx = useMemo((): CharacterListButtonContext<TActionContext> => ({
		ActionButton,
		outerActionContext: actionContext,
	}), [ActionButton, actionContext]);

	return (
		<CharacterListInputActionButtons<CharacterListButtonContext<TActionContext>>
			value={ content }
			max={ fingerprint.maxFingerprints }
			actionContext={ ctx }
			allowSelf='any'
			AddButton={ CharacterListAddButton }
			RemoveButton={ CharacterListRemoveButton }
		/>
	);
}

interface CharacterListButtonContext<TActionContext> {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ActionButton: React.FC<WardrobeLockLogicExecuteButtonProps<TActionContext>>;
	outerActionContext: TActionContext;
}

function CharacterListAddButton<TActionContext>({
	addId,
	actionContext: { outerActionContext, ActionButton },
	disabled,
	slim,
	children,
	onExecute,
}: CharacterListInputAddButtonProps<CharacterListButtonContext<TActionContext>>) {
	const lockAction: LockAction = {
		action: 'updateFingerprint',
		character: addId ?? 'c0',
		registered: true,
	};

	return (
		<ActionButton
			actionContext={ outerActionContext }
			disabled={ addId == null || disabled }
			lockAction={ lockAction }
			onExecute={ onExecute }
			slim={ slim }
		>
			{ children }
		</ActionButton>
	);
}

function CharacterListRemoveButton<TActionContext>({
	removeId,
	actionContext: { outerActionContext, ActionButton },
}: CharacterListInputRemoveButtonProps<CharacterListButtonContext<TActionContext>>) {
	const lockAction: LockAction = {
		action: 'updateFingerprint',
		character: removeId,
		registered: false,
	};

	return (
		<ActionButton
			actionContext={ outerActionContext }
			lockAction={ lockAction }
			disabled={ false }
			iconButton
			slim
		>
			<img src={ crossIcon } alt='Quick-action mode' />
		</ActionButton>
	);
}

function PasswordInput<TActionContext>({
	ActionButton,
	actionContext,
	value,
	onChange,
	password,
	pendingAttempt = false,
	showInvalidWarning,
	disabled,
}: Pick<WardrobeLockLogicProps<TActionContext>, 'ActionButton' | 'actionContext'> & {
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

	const showPasswordAction = useMemo((): LockAction => ({
		action: 'showPassword',
	}), []);

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
				<ActionButton
					lockAction={ showPasswordAction }
					onExecute={ onPasswordShown }
					disabled={ pendingAttempt }
					actionContext={ actionContext }
				>
					Show
				</ActionButton>
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

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

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
	const id = useId();

	const inputValues = useMemo(() => {
		return {
			days: Math.floor(value / DAY_MS),
			hours: Math.floor(value / HOUR_MS) % 24,
			minutes: Math.floor(value / MINUTE_MS) % 60,
		};
	}, [value]);

	const maximums = useMemo(() => {
		if (value >= timer.maxDuration) {
			return inputValues;
		}

		return {
			days: Math.floor(timer.maxDuration / DAY_MS),
			hours: (timer.maxDuration > (23 * HOUR_MS)) ? 23 : Math.floor(timer.maxDuration / HOUR_MS),
			minutes: (timer.maxDuration > (59 * MINUTE_MS)) ? 59 : Math.floor(timer.maxDuration / MINUTE_MS),
		};
	}, [value, inputValues, timer]);

	const updateTimer = useCallback((newValue: number) => {
		onChange(Math.min(timer.maxDuration, newValue));
	}, [onChange, timer]);

	const setDays = useCallback((newValue: number) => {
		updateTimer(value + (newValue - inputValues.days) * DAY_MS);
	}, [value, updateTimer, inputValues]);

	const setHours = useCallback((newValue: number) => {
		updateTimer(value + (newValue - inputValues.hours) * HOUR_MS);
	}, [value, updateTimer, inputValues]);

	const setMinutes = useCallback((newValue: number) => {
		updateTimer(value + (newValue - inputValues.minutes) * MINUTE_MS);
	}, [value, updateTimer, inputValues]);

	return (
		<Row className='WardrobeInputRow'>
			<label htmlFor={ id }>
				Timer
			</label>
			<Row alignY='center'>
				<NumberInput
					id={ `${id}-days` }
					min={ 0 }
					max={ maximums.days }
					step={ 1 }
					value={ pendingAttempt ? NaN : inputValues.days }
					onChange={ setDays }
					disabled={ pendingAttempt }
				/>
				<label htmlFor={ `${id}-days` }>Days</label>
				{ ' : ' }
				<NumberInput
					id={ `${id}-hours` }
					min={ 0 }
					max={ maximums.hours }
					step={ 1 }
					value={ pendingAttempt ? NaN : inputValues.hours }
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
					value={ pendingAttempt ? NaN : inputValues.minutes }
					onChange={ setMinutes }
					disabled={ pendingAttempt }
				/>
				<label htmlFor={ `${id}-minutes` }>Minutes</label>
			</Row>
		</Row>
	);
}
