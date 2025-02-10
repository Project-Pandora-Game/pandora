import classNames from 'classnames';
import type { Immutable } from 'immer';
import { cloneDeep } from 'lodash';
import { AssertNever, CloneDeepMutable, EvaluateCharacterModifierCondition, GetLogger, LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT, type CharacterModifierCondition, type CharacterModifierConditionChain, type CharacterModifierConditionRecord } from 'pandora-common';
import { useMemo, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import { useAsyncEvent } from '../../../../../common/useEvent';
import { Select } from '../../../../../common/userInteraction/select/select';
import { TOAST_OPTIONS_ERROR } from '../../../../../persistentToast';
import { Button } from '../../../../common/button/button';
import { Column, DivContainer, Row } from '../../../../common/container/container';
import { FieldsetToggle } from '../../../../common/fieldsetToggle';
import { useGameState, useGlobalState, useSpaceInfo } from '../../../../gameContext/gameStateContextProvider';
import './style.scss';
import { CharacterModifierConditionListEntry } from './characterModifierCondition';

export function CharacterModifierConditionList({ conditions, onChange }: {
	conditions: Immutable<CharacterModifierConditionChain>;
	onChange: (newValue: CharacterModifierConditionChain) => Promisable<void>;
}): ReactElement {
	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const spaceInfo = useSpaceInfo();

	const [setConditions, processing] = useAsyncEvent(async (newConditions: CharacterModifierConditionChain) => {
		await onChange(newConditions);
	}, null, {
		errorHandler: (err) => {
			GetLogger('CharacterModifierConditionList').error('Failed to configure character modifier conditions:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const conditionsActive = useMemo(() => conditions.map((c) => {
		const res = EvaluateCharacterModifierCondition(c.condition, globalState, spaceInfo);
		return c.invert ? !res : res;
	}), [conditions, globalState, spaceInfo]);

	return (
		<FieldsetToggle legend='Conditions' className='characterModifierConditions'>
			<Column gap='large'>
				{
					conditions.length === 0 ? (
						<i>This modifier is always active (no conditions set)</i>
					) : (
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
											onChange={ (newRecord) => {
												const newValue = CloneDeepMutable(conditions);
												newValue[i] = newRecord;
												setConditions(newValue);
											} }
											processing={ processing }
											active={ conditionsActive[i] }
											group={ group }
										/>
									);
								})
							}
						</div>
					)
				}
				{
					conditions.length < LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT ? (
						<CharacterModifierConditionAdd
							processing={ processing }
							addCondition={ (newCondition) => {
								setConditions([
									...conditions,
									newCondition,
								]);
							} }
						/>
					) : null
				}
			</Column>
		</FieldsetToggle>
	);
}

function ConditionRecordListEntry({ record, firstEntry, onChange, processing, active, group }: {
	record: Immutable<CharacterModifierConditionRecord>;
	firstEntry: boolean;
	onChange: (newRecord: CharacterModifierConditionRecord) => void;
	processing: boolean;
	active: boolean;
	/** For first element of "AND" group - details about this group. */
	group: { size: number; active: boolean; } | null;
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
							onChange({
								...record,
								logic: record.logic === 'and' ? 'or' : 'and',
							});
						} }
						disabled={ processing }
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
				/>
				<div className='quickActions'>
					<Button slim>
						X
					</Button>
				</div>
			</DivContainer>
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
};

function CharacterModifierConditionAdd({ processing, addCondition }: {
	processing: boolean;
	addCondition: (newCondition: CharacterModifierConditionRecord) => void;
}): ReactElement {
	const [type, setType] = useState<CharacterModifierCondition['type'] | ''>('');

	return (
		<Row gap='medium'>
			<Select
				value={ type }
				onChange={ (ev) => setType(ev.target.value as (CharacterModifierCondition['type'] | '')) }
				className='flex-1'
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
					if (type) {
						addCondition({
							condition: cloneDeep(CONDITION_PRESETS[type].default),
							invert: false,
							logic: 'and',
						});
					}
				} }
				disabled={ processing || !type }
			>
				Add
			</Button>
		</Row>
	);
}
