import {
	AssetFrameworkCharacterState,
} from 'pandora-common';
import { ReactElement, useEffect } from 'react';
import { ICharacter, useCharacterAppearanceItems } from '../../../character/character';
import { Column } from '../../common/container/container';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { WardrobeModuleConfig } from '../modules/_wardrobeModules';
import { useWardrobeContext } from '../wardrobeContext';

export function WardrobeExpressionGui({ characterState }: {
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const appearance = useCharacterAppearanceItems(characterState);
	const { focuser, targetSelector } = useWardrobeContext();
	useEffect(() => focuser.disable('Expressions cannot focus container!'), [focuser]);

	return (
		<div className='inventoryView'>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				{
					appearance
						.flatMap((item) => (
							Array.from(item.getModules().entries())
								.filter((m) => m[1].config.expression)
								.map(([moduleName, m]) => (
									<FieldsetToggle legend={ m.config.expression } key={ `${item.id}:${moduleName}` }>
										<WardrobeModuleConfig
											target={ targetSelector }
											item={ { container: [], itemId: item.id } }
											moduleName={ moduleName }
											m={ m }
										/>
									</FieldsetToggle>
								))
						))
				}
			</Column>
		</div>
	);
}
