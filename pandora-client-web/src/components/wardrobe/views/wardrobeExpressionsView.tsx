import {
	AssetFrameworkCharacterState,
} from 'pandora-common';
import { ReactElement, useEffect } from 'react';
import { ICharacter } from '../../../character/character.ts';
import { Column } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import { WardrobeModuleConfig } from '../modules/_wardrobeModules.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';

export function WardrobeExpressionGui({ characterState }: {
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const { focuser, targetSelector } = useWardrobeContext();
	useEffect(() => focuser.disable('Expressions cannot focus container!'), [focuser]);

	return (
		<div className='inventoryView'>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				{
					characterState.items
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
