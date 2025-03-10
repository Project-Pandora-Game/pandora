import classNames from 'classnames';
import { AssetIdSchema, type Asset } from 'pandora-common';
import { useMemo, useRef, useState, type ReactElement } from 'react';
import { useAssetManager } from '../../../../../assets/assetManager';
import { TextInput } from '../../../../../common/userInteraction/input/textInput';
import { useInputAutofocus } from '../../../../../common/userInteraction/inputAutofocus';
import { Button } from '../../../../common/button/button.tsx';
import { Column, Row } from '../../../../common/container/container.tsx';
import { ModalDialog } from '../../../../dialog/dialog.tsx';
import { InventoryAssetPreview } from '../../../wardrobeComponents.tsx';
import { useOrderedAssets } from '../../wardrobeAssetView.tsx';
import type { CharacterModifierConditionListEntryProps } from './characterModifierCondition.tsx';

export function ConditionItemOfAsset({ condition, setCondition, invert, setInvert, processing }: CharacterModifierConditionListEntryProps<'hasItemOfAsset'>): ReactElement {
	const [showDialog, setShowDialog] = useState(false);
	const assetManager = useAssetManager();

	const assetId = AssetIdSchema.safeParse(condition.assetId);

	return (
		<span>
			<Button
				onClick={ () => setInvert?.(!invert) }
				disabled={ processing || setInvert == null }
				slim
			>
				{ invert ? 'Is not' : 'Is' }
			</Button>
			{ ' wearing an item of type ' }
			<Button
				onClick={ () => setShowDialog(true) }
				slim
				disabled={ setCondition == null }
			>
				{ (!condition.assetId || !assetId.success) ? '[not set]' : (assetManager.getAssetById(assetId.data)?.definition.name ?? '[ERROR]') }
			</Button>
			{ showDialog ? (
				<ConditionItemOfAssetDialog condition={ condition } setCondition={ setCondition } close={ () => setShowDialog(false) } />
			) : null }
		</span>
	);
}

function ConditionItemOfAssetDialog({ condition, setCondition, close }: Pick<CharacterModifierConditionListEntryProps<'hasItemOfAsset'>, 'condition' | 'setCondition'> & { close: () => void; }): ReactElement {
	const [assetId, setAssetId] = useState<string | undefined>(undefined);
	const assetManager = useAssetManager();

	const effectiveAssetId = assetId !== undefined ? assetId : condition.assetId;
	const parsedAssetId = AssetIdSchema.safeParse(effectiveAssetId);
	const valid = effectiveAssetId === '' || (parsedAssetId.success && assetManager.getAssetById(parsedAssetId.data) != null);

	const [filter, setFilter] = useState('');

	const flt = filter.toLowerCase().trim().split(/\s+/);
	const filteredAssets = useMemo(() => (
		assetManager.assetList
			// Some assets cannot be manually spawned, so ignore those
			.filter((asset) => asset.canBeSpawned())
			.filter((asset) => flt.every((f) => {
				return asset.definition.name.toLowerCase().includes(f);
			}))
	), [assetManager, flt]);

	const sortedAssets = useOrderedAssets(filteredAssets, true);

	const filterInput = useRef<TextInput>(null);
	useInputAutofocus(filterInput);

	return (
		<ModalDialog className='characterModifierConditionDialog'>
			<Column>
				<h2>Select item type</h2>
				<TextInput ref={ filterInput }
					placeholder='Filter by name'
					value={ filter }
					onChange={ setFilter }
				/>
				<Column className='assetList'>
					<button
						className={ classNames(
							'inventoryViewItem',
							'emptySelectionButton',
							'listMode',
							'small',
							(!effectiveAssetId) ? 'selected' : null,
							'allowed',
						) }
						onClick={ () => {
							setAssetId('');
						} }>
						<span className='itemName'>- None -</span>
					</button>
					{
						sortedAssets.map((asset) => (
							<AssetPickerItem
								key={ asset.id }
								asset={ asset }
								selected={ effectiveAssetId === asset.id }
								onSelect={ () => {
									setAssetId(asset.id);
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
							if (assetId !== undefined && valid) {
								setCondition?.({
									type: 'hasItemOfAsset',
									assetId,
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

function AssetPickerItem({ asset, selected, onSelect }: {
	asset: Asset;
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
			<InventoryAssetPreview asset={ asset } small />
			<span className='itemName'>{ asset.definition.name }</span>
		</button>
	);
}
