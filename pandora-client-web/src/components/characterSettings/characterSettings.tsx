import { ICharacterData } from 'pandora-common';
import React, { ReactElement } from 'react';
import { Button } from '../common/Button/Button';
import { GIT_DESCRIBE } from '../../config/Environment';
import { usePlayerData } from '../gameContext/playerContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import './characterSettings.scss';
import { ColorInput, useColorInput } from '../common/colorInput/colorInput';

export function CharacterSettings(): ReactElement | null {
	const playerData = usePlayerData();

	if (!playerData)
		return null;

	return (
		<>
			<div className='character-settings'>
				<LabelColor playerData={ playerData } />
			</div>
			<footer>Version: { GIT_DESCRIBE }</footer>
		</>
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
