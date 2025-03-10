import { ReactElement } from 'react';
import { ICharacter } from '../../../character/character.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { useObservable } from '../../../observable.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { Column, Row } from '../../common/container/container.tsx';
import { FieldsetToggle } from '../../common/fieldsetToggle/index.tsx';
import { usePlayerId } from '../../gameContext/playerContextProvider.tsx';
import { MIN_RANDOMIZE_UPDATE_INTERVAL, WardrobeActionRandomizeButton, WardrobeActionRandomizeUpdateInterval } from '../wardrobeComponents.tsx';

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
			</Column>
		</div>
	);
}

function WardrobeActionRandomizeSettings() {
	const { wardrobeHoverPreview } = useAccountSettings();
	const updateInterval = useObservable(WardrobeActionRandomizeUpdateInterval);

	const onChange = (newValue: number) => {
		const result = WardrobeActionRandomizeUpdateInterval.validate.safeParse(newValue);
		if (result.success)
			WardrobeActionRandomizeUpdateInterval.value = result.data;
	};

	if (!wardrobeHoverPreview) {
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
				<NumberInput
					id='update-interval'
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
