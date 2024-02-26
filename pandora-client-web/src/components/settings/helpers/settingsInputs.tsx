import React, { useId, type DependencyList, type ReactElement, useCallback, useMemo } from 'react';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput';
import { EMPTY_ARRAY, KnownObject } from 'pandora-common';
import { Button } from '../../common/button/button';
import type { ZodSchema, ZodTypeDef } from 'zod';
import { Select } from '../../common/select/select';
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

	const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked;
		setValue(newValue);
	};

	const id = `setting-${useId()}`;

	return (
		<div className='input-row'>
			<input
				id={ id }
				type='checkbox'
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
				className='slim fadeDisabled'
				onClick={ () => setValue(undefined) }
				disabled={ value === undefined }
			>
				↺
			</Button>
		</div>
	);
}

export function SelectSettingInput<TValue extends string>({ currentValue, defaultValue, label, stringify, schema, onChange, onReset, deps }: {
	currentValue: TValue | undefined;
	defaultValue: TValue;
	label: string;
	stringify: Readonly<Record<TValue, string>>;
	schema: ZodSchema<TValue, ZodTypeDef, unknown>;
	onChange: (newValue: TValue) => void;
	onReset?: () => void;
	deps?: DependencyList;
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

	const onInputChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
		const newValue = schema.parse(e.target.value);
		setValue(newValue);
	}, [schema, setValue]);

	const options = useMemo(() => (
		KnownObject
			.entries(stringify)
			.map(([k, v]) => (
				<option key={ k } value={ k }>
					{ v }
				</option>
			))
	), [stringify]);

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
					className='slim fadeDisabled'
					onClick={ () => setValue(undefined) }
					disabled={ value === undefined }
				>
					↺
				</Button>
			</Row>
		</div>
	);
}
