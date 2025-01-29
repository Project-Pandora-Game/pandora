import { uniq } from 'lodash';
import { CharacterIdSchema, CompareCharacterIds, GetLogger, LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT, type CharacterId, type ModifierConfigurationEntryDefinition } from 'pandora-common';
import { CharacterModifierBuildConfigurationSchemaSingle } from 'pandora-common/dist/gameLogic/characterModifiers/helpers/configurationBuilder';
import type { ReactElement } from 'react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import crossIcon from '../../../../../assets/icons/cross.svg';
import { useAsyncEvent } from '../../../../../common/useEvent';
import { TextInput } from '../../../../../common/userInteraction/input/textInput';
import { TOAST_OPTIONS_ERROR } from '../../../../../persistentToast';
import { Button, IconButton } from '../../../../common/button/button';
import { Column, Row } from '../../../../common/container/container';
import { FieldsetToggle } from '../../../../common/fieldsetToggle';
import { useSpaceCharacters } from '../../../../gameContext/gameStateContextProvider';
import { usePlayerId } from '../../../../gameContext/playerContextProvider';

export function WardrobeCharacterModifierConfigCharacterList({ definition, value, onChange }: {
	definition: ModifierConfigurationEntryDefinition<'characterList'>;
	value: unknown;
	onChange?: (newValue: readonly CharacterId[]) => Promisable<void>;
}): ReactElement {
	const playerId = usePlayerId();
	const schema = useMemo(() => CharacterModifierBuildConfigurationSchemaSingle(definition), [definition]);

	const parsedValue = useMemo((): readonly CharacterId[] => uniq(schema.parse(value)).sort(CompareCharacterIds), [schema, value]);

	const [addInputValue, setAddInputValue] = useState('');
	const parsedInputValue = !addInputValue ? undefined :
		CharacterIdSchema.safeParse(/^[0-9]+$/.test(addInputValue) ? `c${addInputValue}` : addInputValue);

	const [execute, processing] = useAsyncEvent(async (newValue: CharacterId[]) => {
		if (onChange == null)
			throw new Error('Changing value not supported');

		await onChange(newValue);
		return newValue;
	}, (newValue: CharacterId[]) => {
		// Clear the "new entry" input if it is in the array after the change
		setAddInputValue((v) => {
			const parsedInputValue2 = !v ? undefined :
				CharacterIdSchema.safeParse(/^[0-9]+$/.test(v) ? `c${v}` : v);
			if (parsedInputValue2?.success && newValue.includes(parsedInputValue2.data))
				return '';
			return v;
		});
	}, {
		errorHandler: (err) => {
			GetLogger('WardrobeCharacterModifierConfigCharacterList').error('Failed to configure character modifier:', err);
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

		execute([...parsedValue, parsedInputValue.data].sort(CompareCharacterIds));
	}, [execute, parsedInputValue, parsedValue]);

	return (
		<FieldsetToggle legend={ definition.name }>
			<Column gap='medium'>
				<Column padding='small' gap='small' overflowY='auto' className='characterModifierCharacterList'>
					{
						parsedValue.length > 0 ? (
							parsedValue.map((c) => (
								<CharacterListItem
									key={ c }
									id={ c }
									remove={ onChange != null ? (() => {
										execute(parsedValue.filter((i) => i !== c));
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
							<Row>
								<TextInput
									ref={ addInputRef }
									value={ addInputValue }
									onChange={ setAddInputValue }
									disabled={ processing }
									placeholder={ `Character Id (e.g. ${ playerId ?? 'c1234' })` }
								/>
								<Button
									onClick={ addEntry }
									disabled={ !addInputValue || !parsedInputValue?.success || processing || parsedValue.length >= LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT }
									slim
								>
									Add
								</Button>
							</Row>
							<span>( { parsedValue.length } / { LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT } )</span>
						</Row>
					) : null
				}
			</Column>
		</FieldsetToggle>
	);
}

function CharacterListItem({ id, remove, disabledRemove }: {
	id: CharacterId;
	remove?: () => void;
	disabledRemove?: boolean;
}): ReactElement {
	const characters = useSpaceCharacters();
	const character = characters.find((c) => c.id === id);

	return (
		<Row alignY='center' padding='small' className='listItem'>
			<span className='flex-1'>
				{ character?.name ?? '[unknown]' } ({ id }) { character?.isPlayer() ? '[You]' : '' }
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
