import {
	ItemTemplate,
} from 'pandora-common';
import React, { ReactElement } from 'react';
import { Column, Row } from '../../common/container/container';
import { useAssetManager } from '../../../assets/assetManager';
import { WardrobeTemplateColorization } from './wardrobeTemplateColor';
import { Immutable } from 'immer';

export function WardrobeTemplateEditMenu({
	template,
	cancel,
	updateTemplate,
}: {
	template: Immutable<ItemTemplate>;
	cancel: () => void;
	updateTemplate: (newTemplate: Immutable<ItemTemplate>) => void;
}): ReactElement {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(template.asset);

	if (!asset) {
		return (
			<div className='inventoryView'>
				<div className='toolbar'>
					<span>Editing item: [ ERROR: ASSET NOT FOUND ]</span>
					<button className='modeButton' onClick={ cancel }>✖️</button>
				</div>
			</div>
		);
	}

	return (
		<div className='inventoryView'>
			<div className='toolbar'>
				<span>Creating item: { asset.definition.name }</span>
			</div>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				<Row padding='medium' wrap>
					<button
						className='wardrobeActionButton allowed'
						onClick={ cancel }
					>
						✖️ Cancel
					</button>
				</Row>
				{
					(asset.isType('personal') || asset.isType('roomDevice')) ? (
						<WardrobeTemplateColorization
							asset={ asset }
							color={ template.color ?? {} }
							onChange={ (newColor) => {
								const newTemplate: Immutable<ItemTemplate> = {
									...template,
									color: newColor,
								};
								updateTemplate(newTemplate);
							} }
						/>
					) : null
				}
			</Column>
		</div>
	);
}
