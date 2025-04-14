import { EMPTY_ARRAY, KnownObject } from 'pandora-common';
import { useCallback, useId, useMemo, type DependencyList, type ReactElement, type ReactNode } from 'react';
import type { ZodSchema, ZodTypeDef } from 'zod';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Select, type SelectProps } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../common/button/button.tsx';
import { Row } from '../../common/container/container.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';

export interface SettingDriver<T> {
	currentValue: NoInfer<T | undefined>;
	defaultValue: T;
	onChange: NoInfer<(newValue: T) => void>;
	onReset?: () => void;
}

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

export function ToggleSettingInput({ driver, label, deps = EMPTY_ARRAY }: {
	driver: Readonly<SettingDriver<boolean>>;
	label: string;
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
			/>
			<label
				htmlFor={ id }
				className='flex-1'
			>
				{ label }
			</label>
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

export function SelectSettingInput<TValue extends string>({ driver, label, stringify, optionOrder, schema, deps, children }: {
	driver: Readonly<SettingDriver<TValue>>;
	label: ReactNode;
	stringify: NoInfer<Readonly<Record<TValue, string | (() => string)>>>;
	optionOrder?: NoInfer<readonly TValue[]>;
	schema: NoInfer<ZodSchema<TValue, ZodTypeDef, unknown>>;
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

	return (
		<div className='input-section'>
			<label htmlFor={ id }>{ label }</label>
			<Row alignY='center'>
				<Select
					id={ id }
					className='flex-1'
					value={ value ?? driver.defaultValue }
					onChange={ onInputChange }
				>
					{ options }
				</Select>
				<Button
					className='slim'
					onClick={ () => setValue(undefined) }
					disabled={ value === undefined }
				>
					↺
				</Button>
				{ children }
			</Row>
		</div>
	);
}
