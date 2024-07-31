import { EMPTY_ARRAY } from 'pandora-common';
import React, { useId, type DependencyList, type ReactElement, type ReactNode } from 'react';
import { useRemotelyUpdatedUserInput } from '../../../common/useRemotelyUpdatedUserInput';
import { Select } from '../../../common/userInteraction/select/select';
import { Button } from '../../common/button/button';

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

export function SelectSettingInput<TValue extends string>({ currentValue, defaultValue, label, stringify, optionOrder, onChange, onReset, deps }: {
	currentValue: TValue | undefined;
	defaultValue: TValue;
	label: ReactNode;
	stringify: Readonly<Record<TValue, string | (() => string)>>;
	optionOrder?: readonly TValue[];
	onChange: (newValue: TValue) => void;
	onReset?: () => void;
	deps?: DependencyList;
}): ReactElement {
	return (
		<Select
			label={ label }
			onChange={ onChange }
			options={ stringify }
			optionOrder={ optionOrder }
			value={ currentValue ?? defaultValue }
			canReset={ currentValue !== undefined }
			deps={ deps }
			onReset={ () => {
				if (onReset) {
					onReset();
				} else {
					onChange(defaultValue);
				}
			} }
		/>
	);
}
