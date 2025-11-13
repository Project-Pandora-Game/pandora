import { Immutable } from 'immer';
import { cloneDeep } from 'lodash-es';
import {
	AppearanceAction,
	AppearanceItems,
	AssetColorization,
	CloneDeepMutable,
	ColorGroupResult,
	Item,
	ItemPath,
	Writable,
} from 'pandora-common';
import { ReactElement, useMemo } from 'react';
import { LIVE_UPDATE_THROTTLE } from '../../../config/Environment.ts';
import { useItemColorString } from '../../../graphics/layers/graphicsLayerCommon.tsx';
import { ColorInputRGBA } from '../../common/colorInput/colorInput.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import { useWardrobeExecuteCallback } from '../wardrobeActionContext.tsx';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue.ts';
import { useWardrobeContext } from '../wardrobeContext.tsx';
import { useWardrobeTargetItems } from '../wardrobeUtils.ts';

export function WardrobeItemColorization({ wornItem, item }: {
	wornItem: Item<'bodypart' | 'personal' | 'roomDevice'>;
	item: ItemPath;
}): ReactElement | null {
	const { targetSelector } = useWardrobeContext();
	const allItems = useWardrobeTargetItems(targetSelector);
	const action: Omit<AppearanceAction & { type: 'color'; }, 'color'> = useMemo(() => ({
		type: 'color',
		target: targetSelector,
		item,
	}), [targetSelector, item]);
	const overrides = useMemo(() => wornItem.getColorOverrides(allItems) ?? {}, [wornItem, allItems]);

	if (!wornItem.asset.definition.colorization || Object.entries(wornItem.asset.definition.colorization).every(([,colorization]) => colorization.name == null))
		return null;

	return (
		<FieldsetToggle legend='Coloring' className='coloring'>
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
	action: Omit<AppearanceAction<'color'>, 'color'>;
	allItems: AppearanceItems;
	overrideGroup?: ColorGroupResult;
	item: Item;
}): ReactElement | null {
	const current = useItemColorString(allItems, item, colorKey) ?? colorDefinition.default;
	const bundle = useMemo(() => item.exportColorToBundle(), [item]);

	const checkAction = useMemo((): AppearanceAction => ({ ...action, color: CloneDeepMutable(bundle) ?? {} }), [action, bundle]);
	const check = useStaggeredAppearanceActionResult(checkAction);
	const disabled = check == null || !check.valid || check.getActionSlowdownTime() > 0;

	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });

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
				throttle={ LIVE_UPDATE_THROTTLE }
				disabled={ disabled || !!overrideGroup }
				onChange={ (color) => {
					const newColor = cloneDeep<Writable<typeof bundle>>(bundle);
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
