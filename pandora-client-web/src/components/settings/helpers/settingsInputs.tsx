import { EMPTY_ARRAY, KnownObject } from 'pandora-common';
import React, { useCallback, useId, useMemo, type DependencyList, type ReactElement, type ReactNode } from 'react';
import type { OptionalKeysOf } from 'type-fest';
import type { ZodType } from 'zod';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Select, type SelectProps } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../common/button/button.tsx';
import { Row } from '../../common/container/container.tsx';

export interface SettingDriver<T> {
	currentValue: NoInfer<T | undefined>;
	defaultValue: T;
	onChange: NoInfer<(newValue: T) => void>;
	onReset?: () => void;
}

/**
 * Takes a driver for a settings object and returns a driver for a specific property.
 * Subsetting driver does not support direct reset, as parent might contain other properties.
 * @param parentDriver - Driver for the parent settings object
 * @param property - Property to get driver for
 */
export function useSubsettingDriver<const T extends object, const TSetting extends keyof T>(parentDriver: SettingDriver<T>, property: TSetting): SettingDriver<T[TSetting]> {
	return useMemo((): SettingDriver<T[TSetting]> => ({
		currentValue: parentDriver.currentValue?.[property],
		defaultValue: parentDriver.defaultValue[property],
		onChange(newValue) {
			const result: T = {
				...(parentDriver.currentValue ?? parentDriver.defaultValue),
				[property]: newValue,
			};
			return parentDriver.onChange(result);
		},
	}), [parentDriver, property]);
}

/**
 * Takes a driver for a settings object and returns a driver for a specific optional property.
 * Supports doing reset by deleting the optional property
 * @param parentDriver - Driver for the parent settings object
 * @param property - Property to get driver for, must be optional
 * @param defaultValue - Required value of the optional property (required to be passed explicitly, as parent default might not include the value)
 */
export function useOptionalSubsettingDriver<const T extends object, const TSetting extends OptionalKeysOf<T>>(
	parentDriver: SettingDriver<T>,
	property: TSetting,
	defaultValue: NoInfer<Required<T>[TSetting]>,
): SettingDriver<Required<T>[TSetting]> {
	return useMemo((): SettingDriver<Required<T>[TSetting]> => ({
		currentValue: parentDriver.currentValue?.[property],
		defaultValue,
		onChange(newValue) {
			const result: T = {
				...(parentDriver.currentValue ?? parentDriver.defaultValue),
				[property]: newValue,
			};
			return parentDriver.onChange(result);
		},
		onReset() {
			const result: T = { ...(parentDriver.currentValue ?? parentDriver.defaultValue) };
			delete result[property];
			return parentDriver.onChange(result);
		},
	}), [defaultValue, parentDriver, property]);
}

/**
 * Takes a driver for a settings and creates a new driver with bidirectional mapping.
 * This is useful for changing meaning of special values for passing them to generic inputs (e.g. a number to string and back).
 */
export function useValueMapDriver<const TIn, const TOut>(
	parentDriver: SettingDriver<TIn>,
	forwardMapping: (value: NoInfer<TIn>) => TOut,
	backwardMapping: NoInfer<(value: TOut) => TIn>,
): SettingDriver<TOut> {
	return useMemo((): SettingDriver<TOut> => ({
		currentValue: parentDriver.currentValue !== undefined ? forwardMapping(parentDriver.currentValue) : undefined,
		defaultValue: forwardMapping(parentDriver.defaultValue),
		onChange(newValue) {
			return parentDriver.onChange(backwardMapping(newValue));
		},
		onReset: parentDriver.onReset,
	}), [parentDriver, forwardMapping, backwardMapping]);
}

export function ToggleSettingInput({ driver, label, disabled, noReset = false, deps = EMPTY_ARRAY }: {
	driver: Readonly<SettingDriver<boolean>>;
	label: ReactNode;
	noReset?: boolean;
	disabled?: boolean;
	deps?: DependencyList;
}): ReactElement {
	const [value, setValue] = useRemotelyUpdatedUserInput(driver.currentValue, deps, {
		updateCallback(newValue) {
			if (newValue === undefined) {
				if (driver.onReset) {
					driver.onReset();
				} else {
					driver.onChange(driver.defaultValue);
				}
			} else {
				driver.onChange(newValue);
			}
		},
	});

	const id = `setting-${useId()}`;

	return (
		<Row alignX='space-between' alignY='center' gap='medium'>
			<Checkbox
				id={ id }
				checked={ value ?? driver.defaultValue }
				onChange={ setValue }
				disabled={ disabled }
			/>
			<label
				htmlFor={ id }
				className='flex-1'
			>
				{ label }
			</label>
			{
				noReset ? null : (
					<Button
						className='slim'
						onClick={ () => setValue(undefined) }
						disabled={ value === undefined }
					>
						↺
					</Button>
				)
			}
		</Row>
	);
}

export function NumberSettingInput({ driver, label, deps = EMPTY_ARRAY, withSlider = false, min, max, step, disabled = false }: {
	driver: Readonly<SettingDriver<number>>;
	label: string;
	deps?: DependencyList;
	withSlider?: boolean;
	min?: number;
	max?: number;
	step?: number;
	disabled?: boolean;
}): ReactElement {
	const [value, setValue] = useRemotelyUpdatedUserInput(driver.currentValue, deps, {
		updateCallback(newValue) {
			if (newValue === undefined) {
				if (driver.onReset) {
					driver.onReset();
				} else {
					driver.onChange(driver.defaultValue);
				}
			} else {
				driver.onChange(newValue);
			}
		},
	});

	return (
		<Row alignY='center' gap='medium'>
			{
				withSlider && min != null && max != null ? (
					<NumberInput
						aria-label={ label }
						className='flex-6 zero-width'
						rangeSlider
						min={ min }
						max={ max }
						step={ step }
						value={ value ?? driver.defaultValue }
						onChange={ setValue }
						disabled={ disabled }
					/>
				) : null
			}
			<NumberInput
				aria-label={ label }
				className='flex-grow-1 value'
				min={ min }
				max={ max }
				step={ step }
				value={ value ?? driver.defaultValue }
				onChange={ setValue }
				disabled={ disabled }
			/>
			<Button
				className='slim'
				onClick={ () => setValue(undefined) }
				disabled={ value === undefined }
			>
				↺
			</Button>
		</Row>
	);
}

export function SelectSettingInput<TValue extends string>({ driver, label, stringify, optionOrder, schema, disabled, noWrapper = false, noReset = false, deps, children }: {
	driver: Readonly<SettingDriver<TValue>>;
	label: ReactNode;
	stringify: NoInfer<Readonly<Record<TValue, string | (() => string)>>>;
	optionOrder?: NoInfer<readonly TValue[]>;
	schema: NoInfer<ZodType<TValue>>;
	disabled?: boolean;
	noWrapper?: boolean;
	noReset?: boolean;
	deps?: DependencyList;
	children?: ReactNode;
}): ReactElement {
	const [value, setValue] = useRemotelyUpdatedUserInput<TValue | undefined>(driver.currentValue, deps, {
		updateCallback(newValue) {
			if (newValue === undefined) {
				if (driver.onReset) {
					driver.onReset();
				} else {
					driver.onChange(driver.defaultValue);
				}
			} else {
				driver.onChange(newValue);
			}
		},
	});

	const id = `setting-${useId()}`;

	const onInputChange = useCallback<NonNullable<SelectProps['onChange']>>((e) => {
		const newValue = schema.parse(e.target.value);
		setValue(newValue);
	}, [schema, setValue]);

	const options = useMemo(() => {
		const entries = KnownObject.entries(stringify);

		if (optionOrder != null) {
			entries.sort((a, b) => optionOrder.indexOf(a[0]) - optionOrder.indexOf(b[0]));
		}

		return entries.map(([k, v]) => (
			<option key={ k } value={ k }>
				{ typeof v === 'function' ? v() : v }
			</option>
		));
	}, [stringify, optionOrder]);

	const Wrapper = useMemo(() => (noWrapper ? React.Fragment : ({ children: wrapperChildren }: ChildrenProps) => <div className='input-section'>{ wrapperChildren }</div>), [noWrapper]);

	return (
		<Wrapper>
			<label htmlFor={ id }>{ label }</label>
			<Row alignY='center'>
				<Select
					id={ id }
					className='flex-1'
					value={ value ?? driver.defaultValue }
					onChange={ onInputChange }
					disabled={ disabled }
				>
					{ options }
				</Select>
				{
					noReset ? null : (
						<Button
							className='slim'
							onClick={ () => setValue(undefined) }
							disabled={ value === undefined }
						>
							↺
						</Button>
					)
				}
				{ children }
			</Row>
		</Wrapper>
	);
}
