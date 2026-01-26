import classNames from 'classnames';
import { Immutable, produce } from 'immer';
import {
	AssetModuleDefinition,
	ItemTemplate,
	LIMIT_ITEM_DESCRIPTION_LENGTH,
	LIMIT_ITEM_NAME_LENGTH,
	LIMIT_ITEM_NAME_PATTERN,
	type Asset,
} from 'pandora-common';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import * as z from 'zod';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import crossIcon from '../../../assets/icons/cross.svg';
import infoIcon from '../../../assets/icons/info.svg';
import strugglingAllow from '../../../assets/icons/struggling_allow.svg';
import strugglingDeny from '../../../assets/icons/struggling_deny.svg';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { IconButton } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import { FormCreateStringValidator } from '../../common/form/form.tsx';
import { WardrobeAssetDetailContent } from '../assetDetail/wardrobeAssetDetail.tsx';
import { WardrobeModuleTemplateConfig } from '../modules/_wardrobeModules.tsx';
import { WardrobeTemplateColorization } from './wardrobeTemplateColor.tsx';
import { WardrobeTemplatePersonalItemDeployment } from './wardrobeTemplatePersonalDeployment.tsx';

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

	const [showAssetInfo, setShowAssetInfo] = useState(false);

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

	if (showAssetInfo) {
		return (
			<div className='inventoryView'>
				<div className='toolbar'>
					<span>Asset info</span>
				</div>
				<Column padding='medium' overflowX='hidden' overflowY='auto'>
					<Row padding='medium' alignX='end' wrap>
						<button
							className='wardrobeActionButton allowed'
							onClick={ () => {
								setShowAssetInfo(false);
							} }
						>
							Close asset info
						</button>
					</Row>
					<WardrobeAssetDetailContent asset={ asset } />
				</Column>
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
				<WardrobeTemplateNameAndDescriptionEdit
					asset={ asset }
					template={ template }
					updateTemplate={ updateTemplate }
					showAssetInfo={ () => {
						setShowAssetInfo(true);
					} }
				/>
				{
					(asset.isType('personal') || asset.isType('roomDevice')) ? (
						<WardrobeTemplateRequireFreeHandsCustomize
							asset={ asset }
							template={ template }
							updateTemplate={ updateTemplate }
						/>
					) : null
				}
				{ (asset.isType('bodypart') || asset.isType('personal') || asset.isType('roomDevice')) ? (
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
				) : null }
				{ asset.isType('personal') ? (
					<WardrobeTemplatePersonalItemDeployment
						asset={ asset }
						template={ template }
						updateTemplate={ updateTemplate }
					/>
				) : null }
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

function WardrobeTemplateRequireFreeHandsCustomize({ template, updateTemplate }: {
	asset: Asset<'personal' | 'roomDevice'>;
	template: Immutable<ItemTemplate>;
	updateTemplate: (newTemplate: Immutable<ItemTemplate>) => void;
}): ReactElement {

	const setRequire = useCallback((newValue: boolean) => {
		updateTemplate(produce(template, (draft) => {
			draft.requireFreeHandsToUse = newValue;
		}));
	}, [template, updateTemplate]);

	return (
		<FieldsetToggle legend='Bound usage'>
			<Row alignY='center'>
				<button
					className={ classNames(
						'wardrobeActionButton',
						'IconButton',
						'allowed',
						(template.requireFreeHandsToUse === true) ? 'selected' : null,
					) }
					onClick={ (ev) => {
						ev.stopPropagation();
						setRequire(true);
					} }
					title='Require free hands to use this item'
				>
					<img
						src={ strugglingDeny }
						crossOrigin='anonymous'
						alt='Require free hands to use this item'
					/>
				</button>
				<button
					className={ classNames(
						'wardrobeActionButton',
						'IconButton',
						'allowed',
						(template.requireFreeHandsToUse === false) ? 'selected' : null,
					) }
					onClick={ (ev) => {
						ev.stopPropagation();
						setRequire(false);
					} }
					title='Allow using this item even with blocked hands'
				>
					<img
						src={ strugglingAllow }
						crossOrigin='anonymous'
						alt='Allow using this item even with blocked hands'
					/>
				</button>
			</Row>
		</FieldsetToggle>
	);
}

function WardrobeTemplateNameAndDescriptionEdit({ asset, template, updateTemplate, showAssetInfo }: {
	asset: Asset;
	template: Immutable<ItemTemplate>;
	updateTemplate: (newTemplate: Immutable<ItemTemplate>) => void;
	showAssetInfo?: () => void;
}): ReactElement {
	const nameError = useMemo(() => (
		FormCreateStringValidator(z.string().max(LIMIT_ITEM_NAME_LENGTH).regex(LIMIT_ITEM_NAME_PATTERN), 'name')(template.name ?? '')
	), [template.name]);

	const setName = useCallback((newName: string) => {
		updateTemplate(produce(template, (d) => {
			if (newName) {
				d.name = newName;
			} else {
				delete d.name;
			}
		}));
	}, [template, updateTemplate]);

	const setDescription = useCallback((newDescription: string) => {
		updateTemplate(produce(template, (d) => {
			if (newDescription) {
				d.description = newDescription;
			} else {
				delete d.description;
			}
		}));
	}, [template, updateTemplate]);

	return (
		<FieldsetToggle legend='Item'>
			<Column className='wardrobeItemCustomizationView' gap='tiny'>
				<Row>
					<Column className='flex-1' gap='small'>
						<Row alignY='center'>
							<span>Asset name:</span>
							<span className='name'>{ asset.definition.name }</span>
							{ showAssetInfo != null ? (
								<IconButton
									className='customizationQuickAction'
									slim
									onClick={ showAssetInfo }
									alt='Asset info'
									src={ infoIcon }
								/>
							) : null }
						</Row>
						<Row alignY='center'>
							<label htmlFor='custom-name'>Custom name:</label>
							<TextInput id='custom-name' value={ template.name ?? '' } onChange={ setName } maxLength={ LIMIT_ITEM_NAME_LENGTH } />
						</Row>
						{
							nameError && (
								<Row>
									<span className='error'>{ nameError }</span>
								</Row>
							)
						}
						<label htmlFor='custom-description'>Description ({ template.description?.length ?? 0 }/{ LIMIT_ITEM_DESCRIPTION_LENGTH } characters):</label>
					</Column>
				</Row>
				<textarea id='custom-description' className='description' value={ template.description ?? '' } rows={ 10 } onChange={ (e) => setDescription(e.target.value) } maxLength={ LIMIT_ITEM_DESCRIPTION_LENGTH } />
			</Column>
		</FieldsetToggle>
	);
}
