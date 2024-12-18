import { Immutable } from 'immer';
import {
	AssetModuleDefinition,
	ItemTemplate,
} from 'pandora-common';
import React, { ReactElement } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import crossIcon from '../../../assets/icons/cross.svg';
import { IconButton } from '../../common/button/button';
import { Column, Row } from '../../common/container/container';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { WardrobeModuleTemplateConfig } from '../modules/_wardrobeModules';
import { WardrobeTemplateColorization } from './wardrobeTemplateColor';

export function WardrobeTemplateEditMenu({
	title,
	template,
	cancelText,
	cancel,
	updateTemplate,
}: {
	title: string;
	template: Immutable<ItemTemplate>;
	cancelText: string;
	cancel: () => void;
	updateTemplate: (newTemplate: Immutable<ItemTemplate>) => void;
}): ReactElement {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(template.asset);

	if (!asset) {
		return (
			<div className='inventoryView'>
				<div className='toolbar'>
					<span>{ title }: [ ERROR: ASSET NOT FOUND ]</span>
					<IconButton
						onClick={ cancel }
						theme='default'
						src={ crossIcon }
						alt='Cancel'
					/>
				</div>
			</div>
		);
	}

	return (
		<div className='inventoryView'>
			<div className='toolbar'>
				<span>{ title }: { asset.definition.name }</span>
			</div>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				<Row padding='medium' alignX='end' wrap>
					<button
						className='wardrobeActionButton allowed'
						onClick={ cancel }
					>
						{ cancelText }
					</button>
				</Row>
				{
					(asset.isType('bodypart') || asset.isType('personal') || asset.isType('roomDevice')) ? (
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
				{
					(asset.isType('bodypart') || asset.isType('personal') || asset.isType('roomDevice')) ? (
						Array.from(Object.entries<Immutable<AssetModuleDefinition<unknown, unknown>>>(asset.definition.modules as Record<string, AssetModuleDefinition<unknown, unknown>> ?? {}))
							.map(([moduleName, m]) => (
								<FieldsetToggle legend={ `Module: ${m.name}` } key={ moduleName }>
									<WardrobeModuleTemplateConfig
										moduleName={ moduleName }
										definition={ m }
										template={ template.modules?.[moduleName] }
										onTemplateChange={ (newModuleTemplate) => {
											const newTemplate: Immutable<ItemTemplate> = {
												...template,
												modules: {
													...template.modules,
													[moduleName]: newModuleTemplate,
												},
											};
											updateTemplate(newTemplate);
										} }
									/>
								</FieldsetToggle>
							))
					) : null
				}
			</Column>
		</div>
	);
}
