import React, { ReactElement } from 'react';
import { ICharacter } from '../../../character/character';
import { usePlayerId } from '../../gameContext/playerContextProvider';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { Column, Row } from '../../common/container/container';
import { WardrobeActionRandomizeButton } from '../wardrobeComponents';

export function WardrobeRandomizationGui({ character }: {
	character: ICharacter;
}): ReactElement {
	const playerId = usePlayerId();

	return (
		<div className='inventoryView'>
			<Column padding='medium' overflowX='hidden' overflowY='auto' className='flex-1'>
				<FieldsetToggle legend='Character randomization' open={ false }>
					<h3>
						WARNING: These buttons remove and DELETE ALL ITEMS currently worn!
					</h3>
					<Row padding='medium'>
						{
							character.id === playerId ? (
								<>
									<WardrobeActionButton action={ {
										type: 'randomize',
										kind: 'items',
									} }>
										Randomize clothes
									</WardrobeActionButton>
									<WardrobeActionButton action={ {
										type: 'randomize',
										kind: 'full',
									} }>
										Randomize everything
									</WardrobeActionButton>
								</>
							) : (
								<span>You cannot randomize other characters</span>
							)
						}
					</Row>
				</FieldsetToggle>
				<div className='center-flex flex-1'>
					TODO
				</div>
			</Column>
		</div>
	);
}
