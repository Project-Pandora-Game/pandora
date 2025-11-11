import { uniq } from 'lodash-es';
import { GetLogger, type ModifierConfigurationEntryDefinition, type Promisable } from 'pandora-common';
import { CharacterModifierBuildConfigurationSchemaSingle } from 'pandora-common/gameLogic/characterModifiers/helpers/configurationBuilder';
import type { ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import * as z from 'zod';
import crossIcon from '../../../../../assets/icons/cross.svg';
import { useAsyncEvent } from '../../../../../common/useEvent';
import { TextInput } from '../../../../../common/userInteraction/input/textInput';
import { TOAST_OPTIONS_ERROR } from '../../../../../persistentToast';
import { Button, IconButton } from '../../../../common/button/button.tsx';
import { Column, Row } from '../../../../common/container/container.tsx';
import { FieldsetToggle } from '../../../../common/fieldsetToggle/index.tsx';
import { FormCreateStringValidator, FormError } from '../../../../common/form/form.tsx';

export function WardrobeCharacterModifierConfigStringList({ definition, value, onChange }: {
	definition: ModifierConfigurationEntryDefinition<'stringList'>;
	value: unknown;
	onChange?: (newValue: readonly string[]) => Promisable<void>;
}): ReactElement {
	const schema = useMemo(() => CharacterModifierBuildConfigurationSchemaSingle(definition), [definition]);
	const entrySchema = useMemo(() => {
		let entrySch = z.string().max(definition.options.maxEntryLength);
		if (definition.options.matchEntry != null) {
			entrySch = entrySch.regex(definition.options.matchEntry);
		}
		return entrySch;
	}, [definition]);
	const entryValidator = FormCreateStringValidator(entrySchema, 'input');

	const parsedValue = useMemo((): readonly string[] => uniq(schema.parse(value)).sort((a, b) => a.localeCompare(b)), [schema, value]);

	const [addInputValue, setAddInputValue] = useState('');
	const parsedInputValue = !addInputValue ? undefined : entrySchema.safeParse(addInputValue);
	const inputValueError = entryValidator(addInputValue);

	const [execute, processing] = useAsyncEvent(async (newValue: string[]) => {
		if (onChange == null)
			throw new Error('Changing value not supported');

		await onChange(newValue);
		return newValue;
	}, (newValue: string[]) => {
		// Clear the "new entry" input if it is in the array after the change
		setAddInputValue((v) => {
			const parsedInputValue2 = !v ? undefined : entrySchema.safeParse(v);
			if (parsedInputValue2?.success && newValue.includes(parsedInputValue2.data))
				return '';
			return v;
		});
	}, {
		errorHandler: (err) => {
			GetLogger('WardrobeCharacterModifierConfigStringList').error('Failed to configure character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const addInputRef = useRef<TextInput>(null);

	const addEntry = useCallback(() => {
		if (!parsedInputValue?.success)
			return;

		addInputRef.current?.resetValue();

		if (parsedValue.includes(parsedInputValue.data)) {
			setAddInputValue('');
			return;
		}

		execute([...parsedValue, parsedInputValue.data].sort((a, b) => a.localeCompare(b)));
	}, [execute, parsedInputValue, parsedValue]);

	return (
		<FieldsetToggle legend={ definition.name }>
			<Column gap='medium'>
				<Column padding='small' gap='small' overflowY='auto' className='characterModifierStringListInput limitHeight'>
					{
						parsedValue.length > 0 ? (
							parsedValue.map((c, i) => (
								<StringListItem
									key={ i }
									content={ c }
									remove={ onChange != null ? (() => {
										execute(parsedValue.filter((j) => j !== c));
									}) : undefined }
									disabledRemove={ processing }
								/>
							))
						) : (
							<span>[ Empty ]</span>
						)
					}
				</Column>
				{
					onChange != null ? (
						<Row alignX='space-between' alignY='center'>
							<Column>
								<Row>
									<TextInput
										ref={ addInputRef }
										value={ addInputValue }
										onChange={ setAddInputValue }
										disabled={ processing }
									/>
									<Button
										onClick={ addEntry }
										disabled={ !addInputValue || !parsedInputValue?.success || processing || parsedValue.length >= definition.options.maxCount }
										slim
									>
										Add
									</Button>
								</Row>
								{
									(inputValueError && !!addInputValue) ? (
										<FormError error={ inputValueError } />
									) : null
								}
							</Column>
							<span>( { parsedValue.length } / { definition.options.maxCount } )</span>
						</Row>
					) : null
				}
			</Column>
		</FieldsetToggle>
	);
}

function StringListItem({ content, remove, disabledRemove }: {
	content: string;
	remove?: () => void;
	disabledRemove?: boolean;
}): ReactElement {

	return (
		<Row alignY='center' padding='small' className='listItem'>
			<span className='flex-1 textoverflow-ellipsis' title={ content }>
				{ content }
			</span>
			{
				remove != null ? (
					<IconButton
						src={ crossIcon }
						alt='Remove entry'
						onClick={ remove }
						slim
						disabled={ disabledRemove }
					/>
				) : null
			}
		</Row>
	);
}
