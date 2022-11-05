import { ICharacterData } from 'pandora-common';
import React, { ReactElement } from 'react';
import { Button } from '../common/Button/Button';
import { usePlayerData } from '../gameContext/playerContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ColorInput, useColorInput } from '../common/colorInput/colorInput';

export function CharacterSettings(): ReactElement | null {
	const playerData = usePlayerData();

	if (!playerData)
		return <>No character selected</>;

	return (
		<LabelColor playerData={ playerData } />
	);
}

function LabelColor({ playerData }: { playerData: Readonly<ICharacterData> }): ReactElement {
	const shardConnector = useShardConnector();
	const [color, setColor] = useColorInput(playerData.settings.labelColor);

	return (
		<fieldset>
			<legend>Label color</legend>
			<div className='input-row'>
				<label>Color</label>
				<ColorInput initialValue={ color } onChange={ setColor } />
				<Button
					className='slim'
					onClick={ () => shardConnector?.sendMessage('updateSettings', { labelColor: color }) }
					disabled={ color === playerData.settings.labelColor?.toUpperCase() }>
					Save
				</Button>
			</div>
		</fieldset>
	);
}
