import {
	AssetFrameworkCharacterState,
	type ItemId,
} from 'pandora-common';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { ICharacter } from '../../../character/character.ts';
import { Button } from '../../common/button/button.tsx';
import { Column } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import { WardrobeItemName } from '../itemDetail/wardrobeItemName.tsx';
import { WardrobeModuleConfig } from '../modules/_wardrobeModules.tsx';
import { InventoryAssetPreview } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';

export function WardrobeExpressionGui({ characterState }: {
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const { focuser, targetSelector } = useWardrobeContext();
	useEffect(() => focuser.disable('Expressions cannot focus container!'), [focuser]);

	const [focusedItemId, setFocusedItemId] = useState<ItemId | null>(null);

	const itemsWithExpressions = useMemo(() => (characterState.items
		.filter((item) => (
			Array.from(item.getModules().entries())
				.some((m) => m[1].config.expression)
		))
	), [characterState.items]);

	const focusedItem = itemsWithExpressions.find((i) => i.id === focusedItemId);

	return (
		<div className='inventoryView expressions-ui'>
			<Column className='fill-x' padding='medium' gap='large' overflowX='hidden' overflowY='auto'>
				<div className='item-select-row'>
					{
						itemsWithExpressions.map((item) => (
							<Button
								key={ item.id }
								theme={ focusedItemId === item.id ? 'defaultActive' : 'default' }
								onClick={ () => setFocusedItemId(item.id) }
								className='IconButton'
								slim
							>
								<Column className='fill' alignX='center'>
									<InventoryAssetPreview asset={ item.asset } small />
									<WardrobeItemName item={ item } />
								</Column>
							</Button>
						))
					}
				</div>
				<Column>
					{
						focusedItem ? (
							Array.from(focusedItem.getModules().entries())
								.filter((m) => m[1].config.expression)
								.map(([moduleName, m]) => (
									<FieldsetToggle legend={ m.config.expression } key={ `${focusedItem.id}:${moduleName}` }>
										<WardrobeModuleConfig
											target={ targetSelector }
											item={ { container: [], itemId: focusedItem.id } }
											moduleName={ moduleName }
											m={ m }
										/>
									</FieldsetToggle>
								))
						) : null
					}
				</Column>
			</Column>
		</div>
	);
}
