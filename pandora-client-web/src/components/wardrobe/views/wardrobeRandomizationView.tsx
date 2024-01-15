import React, { ReactElement } from 'react';
import { ICharacter } from '../../../character/character';
import { usePlayerId } from '../../gameContext/playerContextProvider';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { Column, Row } from '../../common/container/container';
import { MIN_RANDOMIZE_UPDATE_INTERVAL, WardrobeActionRandomizeButton, WardrobeActionRandomizeUpdateInterval } from '../wardrobeComponents';
import { useObservable } from '../../../observable';
import { useWardrobeContext } from '../wardrobeContext';

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
								<Column>
									<Row>

										<WardrobeActionRandomizeButton kind='items' />
										<WardrobeActionRandomizeButton kind='full' />
									</Row>
									<br />
									<WardrobeActionRandomizeSettings />
								</Column>
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

function WardrobeActionRandomizeSettings() {
	const { showHoverPreview } = useWardrobeContext();
	const updateInterval = useObservable(WardrobeActionRandomizeUpdateInterval);

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const result = WardrobeActionRandomizeUpdateInterval.validate.safeParse(e.target.valueAsNumber);
		if (result.success)
			WardrobeActionRandomizeUpdateInterval.value = result.data;
	};

	if (!showHoverPreview) {
		return (
			<span>
				Note: hover preview is disabled, enable it in character settings.
			</span>
		);
	}

	return (
		<>
			<Row className='input-row'>
				<label htmlFor='update-interval'>Hover randomization interval</label>
				<input
					id='update-interval'
					type='number'
					value={ updateInterval }
					onChange={ onChange }
				/>
			</Row>
			{
				updateInterval < MIN_RANDOMIZE_UPDATE_INTERVAL ? (
					<span>
						Hover randomization is disabled, set the interval to at least { MIN_RANDOMIZE_UPDATE_INTERVAL } to enable it.
					</span>
				) : null
			}
		</>
	);
}
