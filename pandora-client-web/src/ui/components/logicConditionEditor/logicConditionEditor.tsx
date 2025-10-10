import classNames from 'classnames';
import { produce } from 'immer';
import { AssertNever } from 'pandora-common';
import type { FC, ReactElement } from 'react';
import crossImage from '../../../assets/icons/cross.svg';
import { Button, IconButton } from '../../../components/common/button/button.tsx';
import { DivContainer, Row } from '../../../components/common/container/container.tsx';
import './logicConditionEditor.scss';

export type LogicConditionCombiningLogic = 'and' | 'or';

export type LogicConditionEditorCondition<TCondition> = {
	readonly logic: LogicConditionCombiningLogic;
	readonly condition: TCondition;
	readonly active?: boolean;
};

export type LogicConditionEditorConditionComponentProps<TCondition> = {
	condition: TCondition;
	setCondition?: (newCondition: TCondition) => void;
	processing: boolean;
};

export interface LogicConditionEditorProps<TCondition> {
	conditions: readonly LogicConditionEditorCondition<TCondition>[];
	onChange?: (newValue: readonly LogicConditionEditorCondition<TCondition>[]) => void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ConditionComponent: FC<LogicConditionEditorConditionComponentProps<TCondition>>;
	processing?: boolean;
}

export function LogicConditionEditor<TCondition>({
	conditions,
	onChange,
	ConditionComponent,
	processing = false,
}: LogicConditionEditorProps<TCondition>): ReactElement {
	return (
		<div className='LogicConditionEditor'>
			{
				conditions.map((record, i) => {
					let group: { size: number; active?: boolean; } | null = null;
					if (i === 0 || record.logic === 'or') {
						group = {
							size: 1,
							active: record.active,
						};
						for (let j = i + 1; j < conditions.length; j++) {
							if (conditions[j].logic === 'or')
								break;

							group.size++;
							// False always wins, then undefined, finally if all true, then true.
							if (conditions[j].active === false) {
								group.active = false;
							} else if (group.active !== false) {
								group.active &&= conditions[j].active;
							}
						}
					}

					return (
						<ConditionRecordListEntry
							key={ i }
							record={ record }
							firstEntry={ i === 0 }
							lastEntry={ i === (conditions.length - 1) }
							onChange={ onChange != null ? ((newRecord) => {
								const newValue = conditions.toSpliced(i, 1, newRecord);
								onChange(newValue);
							}) : undefined }
							onDelete={ onChange != null ? (() => {
								const newValue = conditions.toSpliced(i, 1);
								onChange(newValue);
							}) : undefined }
							onMoveUp={ onChange != null ? (() => {
								if (i < 1)
									return;

								const newValue = produce(conditions, (d) => {
									if (d[i].logic === 'or') {
										// If this is a first condition in a group, then only shift it group higher
										d[i].logic = 'and';
										// If next condition belongs to the same group, then it is the new start of the group
										if ((i + 1) < d.length && d[i + 1].logic === 'and') {
											d[i + 1].logic = 'or';
										}
									} else {
										// Otherwise we move it
										// Update logic if it would become the first thing in the group
										if (d[i - 1].logic === 'or') {
											d[i - 1].logic = 'and';
											d[i].logic = 'or';
										}
										// And move it
										const moved = d.splice(i, 1);
										d.splice(i - 1, 0, ...moved);
									}
								});

								onChange(newValue);
							}) : undefined }
							onMoveDown={ onChange != null ? (() => {
								if (i >= (conditions.length - 1))
									return;

								const newValue = produce(conditions, (d) => {
									if ((i + 1) < d.length && d[i + 1].logic === 'or') {
										// If this is the last condition in the group, move it to the next one
										d[i].logic = 'or';
										d[i + 1].logic = 'and';
									} else {
										// Otherwise we move it
										// Update logic if it was the first thing in the group
										if (d[i].logic === 'or') {
											d[i].logic = 'and';
											d[i + 1].logic = 'or';
										}
										// And move it
										const moved = d.splice(i, 1);
										d.splice(i + 1, 0, ...moved);
									}
								});

								onChange(newValue);
							}) : undefined }
							ConditionComponent={ ConditionComponent }
							processing={ processing }
							group={ group }
						/>
					);
				})
			}
		</div>
	);
}

function ConditionRecordListEntry<TCondition>({ record, firstEntry, lastEntry, onChange, onDelete, onMoveUp, onMoveDown, ConditionComponent, processing, group }: {
	record: LogicConditionEditorCondition<TCondition>;
	firstEntry: boolean;
	lastEntry: boolean;
	onChange?: (newRecord: LogicConditionEditorCondition<TCondition>) => void;
	onDelete?: () => void;
	onMoveUp?: () => void;
	onMoveDown?: () => void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ConditionComponent: FC<LogicConditionEditorConditionComponentProps<TCondition>>;
	processing: boolean;
	/** For first element of "AND" group - details about this group. */
	group: { size: number; active?: boolean; } | null;
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
						className={ classNames('groupIndicator', group.active == null ? null : group.active ? 'active' : 'inactive') }
						style={ {
							gridRow: `span ${group.size}`,
						} }
					/>
				) : null
			}
			<DivContainer
				align='center'
				className={ classNames('conditionDetails', record.active == null ? null : record.active ? 'active' : 'inactive') }
			>
				<ConditionComponent
					condition={ record.condition }
					setCondition={ onChange != null ? ((newCondition) => {
						onChange({
							...record,
							condition: newCondition,
						});
					}) : undefined }
					processing={ processing }
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
