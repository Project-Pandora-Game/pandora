import { EMPTY_ARRAY, KnownObject } from 'pandora-common';
import { useCallback, useId, useMemo, type DependencyList, type ReactElement, type ReactNode } from 'react';
import type { ZodSchema, ZodTypeDef } from 'zod';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Select, type SelectProps } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../common/button/button.tsx';
import { Row } from '../../common/container/container.tsx';

export interface SettingDriver<T> {
	currentValue: NoInfer<T | undefined>;
	defaultValue: T;
	onChange: NoInfer<(newValue: T) => void>;
	onReset?: () => void;
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

	const onInputChange = (newValue: boolean) => {
		setValue(newValue);
	};

	const id = `setting-${useId()}`;

	return (
		<div className='input-row'>
			<Checkbox
				id={ id }
				checked={ value ?? driver.defaultValue }
				onChange={ onInputChange }
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
		</div>
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
