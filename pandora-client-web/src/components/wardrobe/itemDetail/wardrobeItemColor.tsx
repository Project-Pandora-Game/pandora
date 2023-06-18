import {
	AppearanceAction,
	AppearanceItems,
	AssetColorization,
	ColorGroupResult,
	DoAppearanceAction,
	Item,
	ItemPath,
	Writeable,
} from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import _ from 'lodash';
import { ColorInputRGBA } from '../../common/colorInput/colorInput';
import { Immutable } from 'immer';
import { useItemColorString } from '../../../graphics/graphicsLayer';
import { useWardrobeContext } from '../wardrobeContext';
import { useWardrobeTargetItems } from '../wardrobeUtils';

export function WardrobeItemColorization({ wornItem, item }: {
	wornItem: Item<'personal' | 'roomDevice'>;
	item: ItemPath;
}): ReactElement | null {
	const { target, targetSelector } = useWardrobeContext();
	const allItems = useWardrobeTargetItems(target);
	const action: Omit<AppearanceAction & { type: 'color'; }, 'color'> = useMemo(() => ({
		type: 'color',
		target: targetSelector,
		item,
	}), [targetSelector, item]);
	const overrides = useMemo(() => wornItem.getColorOverrides(allItems) ?? {}, [wornItem, allItems]);

	if (!wornItem.asset.definition.colorization)
		return null;

	return (
		<FieldsetToggle legend='Coloring'>
			{
				Object.entries(wornItem.asset.definition.colorization).map(([colorPartKey, colorPart]) => (
					<WardrobeColorInput
						key={ colorPartKey }
						colorKey={ colorPartKey }
						colorDefinition={ colorPart }
						allItems={ allItems }
						overrideGroup={ overrides[colorPartKey] }
						item={ wornItem }
						action={ action } />
				))
			}
		</FieldsetToggle>
	);
}

function WardrobeColorInput({ colorKey, colorDefinition, allItems, overrideGroup, action, item }: {
	colorKey: string;
	colorDefinition: Immutable<AssetColorization>;
	action: Omit<AppearanceAction & { type: 'color'; }, 'color'>;
	allItems: AppearanceItems;
	overrideGroup?: ColorGroupResult;
	item: Item;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const { actions, execute } = useWardrobeContext();
	const current = useItemColorString(allItems, item, colorKey) ?? colorDefinition.default;
	const bundle = useMemo(() => item.exportColorToBundle(), [item]);
	const disabled = useMemo(() => bundle == null || DoAppearanceAction({ ...action, color: bundle }, actions, assetManager, { dryRun: true }).result !== 'success', [bundle, action, actions, assetManager]);

	if (!colorDefinition.name || !bundle)
		return null;

	return (
		<div className='wardrobeColorRow' key={ colorKey }>
			<span className='flex-1'>{ colorDefinition.name }</span>
			{
				overrideGroup && (
					<span title={ `This color controlled by a color group and inherited from ${overrideGroup.item.asset.definition.name} (${overrideGroup.colorization.name ?? ''}) and cannot be changed.` }>
						🔗
					</span>
				)
			}
			<ColorInputRGBA
				initialValue={ current }
				resetValue={ colorDefinition.default }
				throttle={ 100 }
				disabled={ disabled || !!overrideGroup }
				onChange={ (color) => {
					const newColor = _.cloneDeep<Writeable<typeof bundle>>(bundle);
					newColor[colorKey] = color;
					execute({
						...action,
						color: newColor,
					});
				} }
				minAlpha={ colorDefinition.minAlpha }
				title={ colorDefinition.name }
			/>
		</div>
	);
}
