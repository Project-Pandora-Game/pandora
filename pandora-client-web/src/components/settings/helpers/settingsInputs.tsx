import { EMPTY_ARRAY, KnownObject } from 'pandora-common';
import { useCallback, useId, useMemo, type DependencyList, type ReactElement, type ReactNode } from 'react';
import type { ZodSchema, ZodTypeDef } from 'zod';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput';
import { Checkbox } from '../../../common/userInteraction/checkbox';
import { Select, type SelectProps } from '../../../common/userInteraction/select/select';
import { Button } from '../../common/button/button';
import { Row } from '../../common/container/container';

export function ToggleSettingInput({ currentValue, defaultValue, label, onChange, onReset, deps = EMPTY_ARRAY }: {
	currentValue: boolean | undefined;
	defaultValue: boolean;
	label: string;
	onChange: (newValue: boolean) => void;
	onReset?: () => void;
	deps?: DependencyList;
}): ReactElement {
	const [value, setValue] = useRemotelyUpdatedUserInput(currentValue, deps, {
		updateCallback(newValue) {
			if (newValue === undefined) {
				if (onReset) {
					onReset();
				} else {
					onChange(defaultValue);
				}
			} else {
				onChange(newValue);
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
				checked={ value ?? defaultValue }
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

export function SelectSettingInput<TValue extends string>({ currentValue, defaultValue, label, stringify, optionOrder, schema, onChange, onReset, deps, children }: {
	currentValue: TValue | undefined;
	defaultValue: TValue;
	label: ReactNode;
	stringify: Readonly<Record<TValue, string | (() => string)>>;
	optionOrder?: readonly TValue[];
	schema: ZodSchema<TValue, ZodTypeDef, unknown>;
	onChange: (newValue: TValue) => void;
	onReset?: () => void;
	deps?: DependencyList;
	children?: ReactNode;
}): ReactElement {
	const [value, setValue] = useRemotelyUpdatedUserInput<TValue | undefined>(currentValue, deps, {
		updateCallback(newValue) {
			if (newValue === undefined) {
				if (onReset) {
					onReset();
				} else {
					onChange(defaultValue);
				}
			} else {
				onChange(newValue);
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
					value={ value ?? defaultValue }
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
