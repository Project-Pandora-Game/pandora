import classNames from 'classnames';
import type { Immutable } from 'immer';
import type { AssetAttributeDefinition } from 'pandora-common';
import { useMemo, useRef, useState, type ReactElement } from 'react';
import { useAssetManager } from '../../../../../assets/assetManager';
import { TextInput } from '../../../../../common/userInteraction/input/textInput';
import { useInputAutofocus } from '../../../../../common/userInteraction/inputAutofocus';
import { Button } from '../../../../common/button/button';
import { Column, Row } from '../../../../common/container/container';
import { ModalDialog } from '../../../../dialog/dialog';
import { InventoryAttributePreview } from '../../../wardrobeComponents';
import type { CharacterModifierConditionListEntryProps } from './characterModifierCondition';

export function ConditionItemWithAttribute({ condition, setCondition, invert, setInvert, processing }: CharacterModifierConditionListEntryProps<'hasItemWithAttribute'>): ReactElement {
	const [showDialog, setShowDialog] = useState(false);
	const assetManager = useAssetManager();

	return (
		<span>
			<Button
				onClick={ () => setInvert?.(!invert) }
				disabled={ processing || setInvert == null }
				slim
			>
				{ invert ? 'Is not' : 'Is' }
			</Button>
			{ ' wearing an item with the ' }
			<Button
				onClick={ () => setShowDialog(true) }
				slim
				disabled={ setCondition == null }
			>
				{ !condition.attribute ? '[not set]' : (assetManager.getAttributeDefinition(condition.attribute)?.name ?? '[ERROR]') }
			</Button>
			{ ' attribute' }
			{ showDialog ? (
				<ConditionItemWithAttributeDialog condition={ condition } setCondition={ setCondition } close={ () => setShowDialog(false) } />
			) : null }
		</span>
	);
}

function ConditionItemWithAttributeDialog({ condition, setCondition, close }: Pick<CharacterModifierConditionListEntryProps<'hasItemWithAttribute'>, 'condition' | 'setCondition'> & { close: () => void; }): ReactElement {
	const [attribute, setAttribute] = useState<string | undefined>(undefined);
	const assetManager = useAssetManager();

	const effectiveAttribute = attribute !== undefined ? attribute : condition.attribute;
	const validAttribute = effectiveAttribute === '' || assetManager.getAttributeDefinition(effectiveAttribute) != null;

	const [filter, setFilter] = useState('');

	const flt = filter.toLowerCase().trim().split(/\s+/);
	const finalAttributes = useMemo(() => (
		[...assetManager.attributes.entries()]
			.filter(([a, definition]) => (definition.useAsAssetPreference ?? true) || a === effectiveAttribute)
			.filter(([_attribute, definition]) => flt.every((f) => {
				return definition.name.toLowerCase().includes(f);
			}))
	), [assetManager, flt, effectiveAttribute]);

	const filterInput = useRef<TextInput>(null);
	useInputAutofocus(filterInput);

	return (
		<ModalDialog className='characterModifierConditionDialog'>
			<Column>
				<h2>Select item attribute</h2>
				<TextInput ref={ filterInput }
					placeholder='Filter by name'
					value={ filter }
					onChange={ setFilter }
				/>
				<Column className='attributeList'>
					<button
						className={ classNames(
							'inventoryViewItem',
							'emptySelectionButton',
							'listMode',
							'small',
							(!effectiveAttribute) ? 'selected' : null,
							'allowed',
						) }
						onClick={ () => {
							setAttribute('');
						} }>
						<span className='itemName'>- None -</span>
					</button>
					{
						finalAttributes.map(([a, definition]) => (
							<AttributePickerItem
								key={ a }
								attribute={ a }
								definition={ definition }
								selected={ effectiveAttribute === a }
								onSelect={ () => {
									setAttribute(a);
								} }
							/>
						))
					}
				</Column>
				<div />
				<Row alignX='space-between'>
					<Button
						onClick={ () => {
							close();
						} }
					>
						Cancel
					</Button>
					<Button
						onClick={ () => {
							if (attribute !== undefined && validAttribute) {
								setCondition?.({
									type: 'hasItemWithAttribute',
									attribute,
								});
							}
							close();
						} }
						disabled={ setCondition == null }
					>
						Confirm
					</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}

function AttributePickerItem({ attribute, definition, selected, onSelect }: {
	attribute: string;
	definition: Immutable<AssetAttributeDefinition>;
	selected: boolean;
	onSelect: () => void;
}): ReactElement {

	return (
		<button
			className={ classNames(
				'inventoryViewItem',
				'listMode',
				'small',
				selected ? 'selected' : null,
				'allowed',
			) }
			onClick={ () => {
				onSelect();
			} }>
			<InventoryAttributePreview attribute={ attribute } />
			<span className='itemName'>{ definition.name }</span>
		</button>
	);
}
