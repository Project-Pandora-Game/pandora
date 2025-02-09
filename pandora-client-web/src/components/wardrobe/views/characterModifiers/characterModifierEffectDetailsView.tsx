import {
	CHARACTER_MODIFIER_TYPE_DEFINITION,
	type CharacterId,
	type CharacterModifierEffectData,
	type ModifierConfigurationEntryDefinition,
} from 'pandora-common';
import { ReactElement } from 'react';
import crossIcon from '../../../../assets/icons/cross.svg';
import { IconButton } from '../../../common/button/button';
import { Column, Row } from '../../../common/container/container';
import { WardrobeCharacterModifierConfig } from './configuration/_index';

interface WardrobeCharacterModifierEffectDetailsViewProps {
	target: CharacterId;
	effect: CharacterModifierEffectData | null;
	unfocus: () => void;
}

export function WardrobeCharacterModifierEffectDetailsView({ effect, unfocus, ...props }: WardrobeCharacterModifierEffectDetailsViewProps): ReactElement {
	if (effect == null) {
		return (
			<div className='inventoryView wardrobeModifierEffectDetails'>
				<div className='toolbar'>
					<span>Modifier: [ ERROR: EFFECT NOT FOUND ]</span>
					<IconButton
						onClick={ unfocus }
						theme='default'
						src={ crossIcon }
						alt='Close item details'
					/>
				</div>
			</div>
		);
	}

	return (
		<CheckedEffectDetails
			{ ...props }
			effect={ effect }
			unfocus={ unfocus }
		/>
	);
}

function CheckedEffectDetails({ effect }: WardrobeCharacterModifierEffectDetailsViewProps & {
	effect: CharacterModifierEffectData;
}): ReactElement {
	const typeDefinition = CHARACTER_MODIFIER_TYPE_DEFINITION[effect.type];

	return (
		<div className='inventoryView wardrobeModifierEffectDetails'>
			<Row className='toolbar'>
				<span>Modifier "{ typeDefinition.visibleName }"</span>
			</Row>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				{
					Array.from(Object.entries(typeDefinition.configDefinition))
						.map(([option, optionDefinition]: [string, ModifierConfigurationEntryDefinition]) => (
							<WardrobeCharacterModifierConfig
								key={ option }
								definition={ optionDefinition }
								value={ effect.config[option] }
							/>
						))
				}
			</Column>
		</div>
	);
}
