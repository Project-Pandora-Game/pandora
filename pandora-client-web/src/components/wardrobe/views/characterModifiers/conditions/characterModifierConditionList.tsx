import classNames from 'classnames';
import { produce, type Immutable } from 'immer';
import { cloneDeep } from 'lodash-es';
import { AssertNever, CharacterModifierTemplateSchema, CloneDeepMutable, EvaluateCharacterModifierCondition, GetLogger, LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT, type CharacterModifierCondition, type CharacterModifierConditionChain, type CharacterModifierConditionRecord } from 'pandora-common';
import { useMemo, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import crossImage from '../../../../../assets/icons/cross.svg';
import importIcon from '../../../../../assets/icons/import.svg';
import type { ICharacter } from '../../../../../character/character';
import { useAsyncEvent } from '../../../../../common/useEvent';
import { Select } from '../../../../../common/userInteraction/select/select';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../../../../persistentToast';
import { Button, IconButton } from '../../../../common/button/button.tsx';
import { Column, DivContainer, Row } from '../../../../common/container/container.tsx';
import { FieldsetToggle } from '../../../../common/fieldsetToggle/index.tsx';
import { ImportDialog } from '../../../../exportImport/importDialog.tsx';
import { useGameState, useGlobalState, useSpaceInfo } from '../../../../gameContext/gameStateContextProvider.tsx';
import { CharacterModifierConditionListEntry } from './characterModifierCondition.tsx';
import './style.scss';

export function CharacterModifierConditionList({ character, conditions, onChange }: {
	character: ICharacter;
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

	const conditionsActive = useMemo(() => conditions.map((c) => {
		const res = EvaluateCharacterModifierCondition(c.condition, globalState, spaceInfo, character.gameLogicCharacter);
		return c.invert ? !res : res;
	}), [conditions, globalState, spaceInfo, character]);

	return (
		<FieldsetToggle legend='Activation conditions' className='characterModifierConditions'>
			<Column gap='large'>
				{
					conditions.length === 0 ? (
						<i>This modifier is always active (no conditions set)</i>
					) : (
						<>
							<i>This modifier is active when this character is&#8230;</i>
							<div className='conditionList'>
								{
									conditions.map((record, i) => {
										let group: { size: number; active: boolean; } | null = null;
										if (i === 0 || record.logic === 'or') {
											group = {
												size: 1,
												active: conditionsActive[i],
											};
											for (let j = i + 1; j < conditions.length; j++) {
												if (conditions[j].logic === 'or')
													break;

												group.size++;
												group.active &&= conditionsActive[j];
											}
										}

										return (
											<ConditionRecordListEntry
												key={ i }
												record={ record }
												firstEntry={ i === 0 }
												lastEntry={ i === (conditions.length - 1) }
												onChange={ onChange != null ? ((newRecord) => {
													const newValue = CloneDeepMutable(conditions);
													newValue[i] = newRecord;
													setConditions(newValue);
												}) : undefined }
												onDelete={ onChange != null ? (() => {
													const newValue = CloneDeepMutable(conditions);
													newValue.splice(i, 1);
													setConditions(newValue);
												}) : undefined }
												onMoveUp={ onChange != null ? (() => {
													if (i < 1)
														return;

													const newValue = CloneDeepMutable(conditions);
													if (newValue[i].logic === 'or') {
														// If this is a first condition in a group, then only shift it group higher
														newValue[i].logic = 'and';
														// If next condition belongs to the same group, then it is the new start of the group
														if ((i + 1) < newValue.length && newValue[i + 1].logic === 'and') {
															newValue[i + 1].logic = 'or';
														}
													} else {
														// Otherwise we move it
														// Update logic if it would become the first thing in the group
														if (newValue[i - 1].logic === 'or') {
															newValue[i - 1].logic = 'and';
															newValue[i].logic = 'or';
														}
														// And move it
														const moved = newValue.splice(i, 1);
														newValue.splice(i - 1, 0, ...moved);
													}

													setConditions(newValue);
												}) : undefined }
												onMoveDown={ onChange != null ? (() => {
													if (i >= (conditions.length - 1))
														return;

													const newValue = CloneDeepMutable(conditions);
													if ((i + 1) < newValue.length && newValue[i + 1].logic === 'or') {
														// If this is the last condition in the group, move it to the next one
														newValue[i].logic = 'or';
														newValue[i + 1].logic = 'and';
													} else {
														// Otherwise we move it
														// Update logic if it was the first thing in the group
														if (newValue[i].logic === 'or') {
															newValue[i].logic = 'and';
															newValue[i + 1].logic = 'or';
														}
														// And move it
														const moved = newValue.splice(i, 1);
														newValue.splice(i + 1, 0, ...moved);
													}

													setConditions(newValue);
												}) : undefined }
												processing={ processing }
												active={ conditionsActive[i] }
												group={ group }
												character={ character }
											/>
										);
									})
								}
							</div>
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

function ConditionRecordListEntry({ record, firstEntry, lastEntry, onChange, onDelete, onMoveUp, onMoveDown, processing, active, group, character }: {
	record: Immutable<CharacterModifierConditionRecord>;
	firstEntry: boolean;
	lastEntry: boolean;
	onChange?: (newRecord: CharacterModifierConditionRecord) => void;
	onDelete?: () => void;
	onMoveUp?: () => void;
	onMoveDown?: () => void;
	processing: boolean;
	active: boolean;
	/** For first element of "AND" group - details about this group. */
	group: { size: number; active: boolean; } | null;
	character: ICharacter;
}): ReactElement {
	return (
		<>
			{
				firstEntry ? (
					<div></div> // First entry has no AND/OR toggle
				) : (
					<Button
						slim
						className={ classNames('logicToggle', record.logic === 'and' ? 'and' : null) }
						onClick={ () => {
							onChange?.({
								...record,
								logic: record.logic === 'and' ? 'or' : 'and',
							});
						} }
						disabled={ processing || onChange == null }
					>
						{ record.logic === 'and' ? 'And' : record.logic === 'or' ? 'Or' : AssertNever(record.logic) }
					</Button>
				)
			}
			{
				group != null ? (
					<div
						className={ classNames('groupIndicator', group.active ? 'active' : null) }
						style={ {
							gridRow: `span ${group.size}`,
						} }
					/>
				) : null
			}
			<DivContainer
				align='center'
				className={ classNames('conditionDetails', active ? 'active' : null) }
			>
				<CharacterModifierConditionListEntry
					condition={ record.condition }
					invert={ record.invert }
					setCondition={ onChange != null ? ((newCondition) => {
						onChange({
							...record,
							condition: newCondition,
						});
					}) : undefined }
					setInvert={ onChange != null ? ((newInvert) => {
						onChange({
							...record,
							invert: newInvert,
						});
					}) : undefined }
					processing={ processing }
					character={ character }
				/>
			</DivContainer>
			<Row className='quickActions' gap='small'>
				<Button
					slim
					onClick={ onMoveUp }
					disabled={ processing || firstEntry || onMoveUp == null }
					title='Move condition up'
				>
					▲
				</Button>
				<Button
					slim
					onClick={ onMoveDown }
					disabled={ processing || lastEntry || onMoveDown == null }
					title='Move condition down'
				>
					▼
				</Button>
				<IconButton
					slim
					onClick={ onDelete }
					disabled={ processing || onDelete == null }
					src={ crossImage }
					alt='Remove condition'
					title='Remove condition'
				/>
			</Row>
		</>
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
	inRoom: {
		name: 'In specific room',
		default: {
			type: 'inRoom',
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
