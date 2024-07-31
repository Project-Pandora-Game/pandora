import { Assert, IsObject, KnownObject } from 'pandora-common';
import React, { ReactElement, useCallback, useId, useMemo, type DependencyList, type ReactNode } from 'react';
import { Button } from '../../../components/common/button/button';
import { DivContainer, Row } from '../../../components/common/container/container';
import { useRemotelyUpdatedUserInput } from '../../useRemotelyUpdatedUserInput';
import { SelectRaw } from './selectRaw';

export type OptionDescription = string | {
	/** User-facing name of this option. */
	name: string;
	/** Tittle displayed upon hovering the option. */
	title?: string;
};

export interface SelectProps<TValue extends string> {
	/** Label for the dropdown box. */
	label: ReactNode;
	/** List of selectable options. */
	options: Readonly<Record<TValue, OptionDescription | (() => OptionDescription)>>;
	/** Optional ordering of the options (needed in case of numeric-like keys in `options`, as those get shifted). */
	optionOrder?: readonly TValue[];
	/** Current value */
	value: NoInfer<TValue>;
	/** Handler called when value changes. */
	onChange: NoInfer<(newValue: TValue) => void>;
	/** Whether the "reset" button is usable or not. `undefined` means no reset button. */
	canReset?: boolean;
	/** Handler called when the reset button is pressed. */
	onReset?: () => void;
	/**
	 * Whether the element is disabled (cannot be interacted with by the user).
	 * @default false
	 */
	disabled?: boolean;

	/** Dependency list for immediate reset of the internal state. */
	deps?: DependencyList;

	/** Class name applied to the container containing the label and the select. */
	className?: string;
	/**
	 * Whether the label should be shown on the same line as the select box.
	 * If set to `'wrap'`, it will allow the label to wrap if it cannot fit.
	 * @default false
	 */
	inlineLabel?: boolean | 'wrap';
	/**
	 * Disable changing the select by scrolling over it.
	 * @default false
	 */
	noScrollChange?: boolean;
}

/**
 * A component for a select (dropdown) UI, including its label.
 */
export function Select<const TValue extends string>({
	label,
	options,
	optionOrder,
	value,
	onChange,
	className,
	canReset,
	onReset,
	disabled = false,
	inlineLabel = false,
	noScrollChange = false,
	deps,
}: SelectProps<TValue>): ReactElement {
	const [currentValue, setValue] = useRemotelyUpdatedUserInput<TValue>(value, deps, {
		updateCallback(newValue) {
			onChange(newValue);
		},
	});

	const id = `select-${useId()}`;

	const onInputChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
		const newValue = e.target.value;
		Assert(Object.prototype.hasOwnProperty.call(options, newValue), `Unknown option: ${newValue}`);
		setValue(newValue as TValue);
	}, [options, setValue]);

	const finalOptions = useMemo(() => {
		const entries = KnownObject.entries(options);

		if (optionOrder != null) {
			entries.sort((a, b) => optionOrder.indexOf(a[0]) - optionOrder.indexOf(b[0]));
		}

		return entries.map(([k, v]) => {
			const description: OptionDescription = typeof v === 'function' ? v() : v;

			return (
				<option key={ k } value={ k } title={ IsObject(description) ? description.title : undefined }>
					{ IsObject(description) ? description.name : description }
				</option>
			);
		});
	}, [options, optionOrder]);

	return (
		<DivContainer
			className={ className }
			direction={ inlineLabel ? 'row' : 'column' }
			align={ inlineLabel ? 'center' : 'stretch' }
			justify={ inlineLabel ? 'space-between' : 'start' }
			wrap={ inlineLabel === 'wrap' }
		>
			<label htmlFor={ id }>{ label }</label>
			<Row alignY='center' className={ inlineLabel ? 'flex-1' : '' }>
				<SelectRaw
					id={ id }
					className='flex-1'
					value={ currentValue }
					onChange={ onInputChange }
					disabled={ disabled }
					noScrollChange={ noScrollChange }
				>
					{ finalOptions }
				</SelectRaw>
				{
					(canReset !== undefined && onReset !== undefined) ? (
						<Button
							className='slim fadeDisabled'
							onClick={ onReset }
							disabled={ !canReset || disabled }
						>
							↺
						</Button>
					) : null
				}
			</Row>
		</DivContainer>
	);
}
