import { produce, type Immutable } from 'immer';
import { cloneDeep } from 'lodash-es';
import { CharacterModifierTemplateSchema, EvaluateCharacterModifierCondition, GetLogger, LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT, type CharacterModifierCondition, type CharacterModifierConditionChain, type CharacterModifierConditionRecord } from 'pandora-common';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import importIcon from '../../../../../assets/icons/import.svg';
import type { Character } from '../../../../../character/character';
import { useAsyncEvent } from '../../../../../common/useEvent';
import { Select } from '../../../../../common/userInteraction/select/select';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../../../../persistentToast';
import { LogicConditionEditor, type LogicConditionEditorCondition, type LogicConditionEditorConditionComponentProps } from '../../../../../ui/components/logicConditionEditor/logicConditionEditor.tsx';
import { Button } from '../../../../common/button/button.tsx';
import { Column, Row } from '../../../../common/container/container.tsx';
import { FieldsetToggle } from '../../../../common/fieldsetToggle/index.tsx';
import { ImportDialog } from '../../../../exportImport/importDialog.tsx';
import { useGameState, useGlobalState, useSpaceInfo } from '../../../../gameContext/gameStateContextProvider.tsx';
import { CharacterModifierConditionListEntry, type CharacterModifierConditionListEntryData } from './characterModifierCondition.tsx';
import './style.scss';

export function CharacterModifierConditionList({ character, conditions, onChange }: {
	character: Character;
	conditions: Immutable<CharacterModifierConditionChain>;
	onChange?: (newValue: CharacterModifierConditionChain) => Promisable<void>;
}): ReactElement {
	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const spaceInfo = useSpaceInfo();

	const [setConditions, processing] = useAsyncEvent(async (newConditions: CharacterModifierConditionChain) => {
		if (onChange == null)
			throw new Error('Changing value not supported');

		await onChange(newConditions);
	}, null, {
		errorHandler: (err) => {
			GetLogger('CharacterModifierConditionList').error('Failed to configure character modifier conditions:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const conditionsChain = useMemo(() => conditions.map((c): LogicConditionEditorCondition<Immutable<CharacterModifierConditionListEntryData>> => {
		const activeTmp = EvaluateCharacterModifierCondition(c.condition, globalState, spaceInfo, character.gameLogicCharacter);
		const active = c.invert ? !activeTmp : activeTmp;
		return {
			logic: c.logic,
			condition: {
				condition: c.condition,
				invert: c.invert,
			},
			active,
		};
	}), [conditions, globalState, spaceInfo, character]);

	const ConditionComponent = useCallback(({ condition, processing: innerProcessing, setCondition }: LogicConditionEditorConditionComponentProps<Immutable<CharacterModifierConditionListEntryData>>) => {
		return (
			<CharacterModifierConditionListEntry
				condition={ condition.condition }
				invert={ condition.invert }
				setCondition={ setCondition != null ? ((newCondition) => {
					setCondition({
						...condition,
						condition: newCondition,
					});
				}) : undefined }
				setInvert={ setCondition != null ? ((newInvert) => {
					setCondition({
						...condition,
						invert: newInvert,
					});
				}) : undefined }
				processing={ innerProcessing }
				character={ character }
			/>
		);
	}, [character]);

	return (
		<FieldsetToggle legend='Activation conditions' className='characterModifierConditions'>
			<Column gap='large'>
				{
					conditions.length === 0 ? (
						<i>This modifier is always active (no conditions set)</i>
					) : (
						<>
							<i>This modifier is active when this character is&#8230;</i>
							<LogicConditionEditor<Immutable<CharacterModifierConditionListEntryData>>
								conditions={ conditionsChain }
								onChange={ onChange != null ? (newValue) => {
									setConditions(newValue.map((c): CharacterModifierConditionChain[number] => ({
										condition: c.condition.condition,
										logic: c.logic,
										invert: c.condition.invert,
									})));
								} : undefined }
								ConditionComponent={ ConditionComponent }
								processing={ processing }
							/>
						</>
					)
				}
				{
					conditions.length < LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT ? (
						<Row wrap='reverse' gap='large'>
							<CharacterModifierConditionAdd
								processing={ processing }
								addCondition={ onChange != null ? ((newCondition) => {
									setConditions([
										...conditions,
										newCondition,
									]);
								}) : undefined }
							/>
							<CharacterModifierConditionImport
								processing={ processing }
								addConditions={ onChange != null ? ((addedConditions) => {
									const newConditions = [
										...conditions,
										...addedConditions,
									];
									if (newConditions.length > LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT) {
										toast('Not enough free space to add all conditions, conditions truncated', TOAST_OPTIONS_WARNING);
									}
									setConditions(newConditions.slice(0, LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT));
								}) : undefined }
							/>
						</Row>
					) : null
				}
			</Column>
		</FieldsetToggle>
	);
}

const CONDITION_PRESETS: { [t in CharacterModifierCondition['type']]: { name: string; default: Extract<CharacterModifierCondition, { type: t; }>; } } = {
	characterPresent: {
		name: 'In same space as character',
		default: {
			type: 'characterPresent',
			characterId: 'c0',
		},
	},
	inSpaceId: {
		name: 'In specific space',
		default: {
			type: 'inSpaceId',
			spaceId: null,
		},
	},
	inRoomWithName: {
		name: 'In room with specific name',
		default: {
			type: 'inRoomWithName',
			room: '',
		},
	},
	inSpaceWithVisibility: {
		name: 'In space with visibility',
		default: {
			type: 'inSpaceWithVisibility',
			spaceVisibility: 'private',
		},
	},
	hasItemOfAsset: {
		name: 'Has item of specified type',
		default: {
			type: 'hasItemOfAsset',
			assetId: '',
		},
	},
	hasItemWithAttribute: {
		name: 'Has item with attribute',
		default: {
			type: 'hasItemWithAttribute',
			attribute: '',
		},
	},
	hasItemWithName: {
		name: 'Has item with specific name',
		default: {
			type: 'hasItemWithName',
			name: '',
		},
	},
	hasItemWithEffect: {
		name: 'Has item with effect',
		default: {
			type: 'hasItemWithEffect',
			effect: null,
		},
	},
};

function CharacterModifierConditionAdd({ processing, addCondition }: {
	processing: boolean;
	addCondition?: (newCondition: CharacterModifierConditionRecord) => void;
}): ReactElement {
	const [type, setType] = useState<CharacterModifierCondition['type'] | ''>('');

	return (
		<Row gap='medium' className='flex-grow-1'>
			<Select
				value={ addCondition != null ? type : '' }
				onChange={ (ev) => setType(ev.target.value as (CharacterModifierCondition['type'] | '')) }
				className='flex-1'
				disabled={ addCondition == null }
				scrollChange
			>
				<option value=''>- Select condition type -</option>
				{ Object.entries(CONDITION_PRESETS).map(([key, value]) => (
					<option key={ key } value={ key }>
						{ value.name }
					</option>
				)) }
			</Select>
			<Button
				className='slim'
				onClick={ () => {
					if (type && addCondition != null) {
						addCondition({
							condition: cloneDeep(CONDITION_PRESETS[type].default),
							invert: false,
							logic: 'and',
						});
					}
				} }
				disabled={ processing || !type || addCondition == null }
			>
				Add
			</Button>
		</Row>
	);
}

function CharacterModifierConditionImport({ processing, addConditions }: {
	processing: boolean;
	addConditions?: (newConditions: CharacterModifierConditionRecord[]) => void;
}): ReactElement {
	const [showImportDialog, setShowImportDialog] = useState(false);

	return (
		<>
			<Button
				className='slim'
				onClick={ () => {
					setShowImportDialog(true);
				} }
				disabled={ processing || addConditions == null }
			>
				<img src={ importIcon } alt='Import' crossOrigin='anonymous' /> Import
			</Button>
			{
				(showImportDialog && addConditions != null) ? (
					<ImportDialog
						expectedType='CharacterModifier'
						expectedVersion={ 1 }
						dataSchema={ CharacterModifierTemplateSchema }
						closeDialog={ () => {
							setShowImportDialog(false);
						} }
						onImport={ (importData) => {
							setShowImportDialog(false);
							// Make sure the first condition really is 'or' before appending them
							const conditions = produce(importData.conditions, (d) => {
								if (d.length > 0) {
									d[0].logic = 'or';
								}
							});
							addConditions(conditions);
						} }
					>
						<h2>Import additional conditions</h2>
						<p>
							Import any exported modifier to append its conditions to the current modifier
						</p>
					</ImportDialog>
				) : null
			}
		</>
	);
}
