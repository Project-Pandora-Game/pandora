import {
	Asset,
	AssetColorization,
	HexRGBAColorString,
	ItemColorBundle,
} from 'pandora-common';
import React, { ReactElement } from 'react';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { ColorInputRGBA } from '../../common/colorInput/colorInput';
import { Immutable } from 'immer';

export function WardrobeTemplateColorization({ asset, color, onChange }: {
	asset: Asset<'personal' | 'roomDevice'>;
	color: ItemColorBundle;
	onChange: (newColor: ItemColorBundle) => void;
}): ReactElement | null {
	if (!asset.definition.colorization)
		return null;

	return (
		<FieldsetToggle legend='Coloring'>
			{
				Object.entries(asset.definition.colorization).map(([colorPartKey, colorPart]) => (
					<WardrobeColorInput
						key={ colorPartKey }
						colorDefinition={ colorPart }
						color={ color[colorPartKey] ?? colorPart.default }
						onChange={ (newPartColor) => {
							onChange({
								...color,
								[colorPartKey]: newPartColor,
							});
						} }
					/>
				))
			}
		</FieldsetToggle>
	);
}

function WardrobeColorInput({ color, onChange, colorDefinition }: {
	colorDefinition: Immutable<AssetColorization>;
	color: HexRGBAColorString;
	onChange: (newColor: HexRGBAColorString) => void;
}): ReactElement | null {
	if (!colorDefinition.name)
		return null;

	return (
		<div className='wardrobeColorRow'>
			<span className='flex-1'>{ colorDefinition.name }</span>
			<ColorInputRGBA
				initialValue={ color }
				resetValue={ colorDefinition.default }
				throttle={ 100 }
				onChange={ onChange }
				minAlpha={ colorDefinition.minAlpha }
				title={ colorDefinition.name }
			/>
		</div>
	);
}
