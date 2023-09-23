import {
	Assert,
	AssetFrameworkCharacterState,
} from 'pandora-common';
import React, { ReactElement, useCallback } from 'react';
import { ICharacter, useCharacterAppearanceItems } from '../../../character/character';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { Column } from '../../common/container/container';
import { WardrobeModuleConfig } from '../modules/_wardrobeModules';

export function WardrobeExpressionGui({ characterState }: {
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const appearance = useCharacterAppearanceItems(characterState);

	const setFocus = useCallback(() => {
		Assert(false, 'Expressions cannot focus container!');
	}, []);

	return (
		<div className='inventoryView'>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				{
					appearance
						.flatMap((item) => (
							Array.from(item.modules.entries())
								.filter((m) => m[1].config.expression)
								.map(([moduleName, m]) => (
									<FieldsetToggle legend={ m.config.expression } key={ moduleName }>
										<WardrobeModuleConfig
											item={ { container: [], itemId: item.id } }
											moduleName={ moduleName }
											m={ m }
											setFocus={ setFocus }
										/>
									</FieldsetToggle>
								))
						))
				}
			</Column>
		</div>
	);
}

