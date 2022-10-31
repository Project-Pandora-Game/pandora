import { ICharacterData } from 'pandora-common';
import React, { ReactElement } from 'react';
import { Button } from '../common/Button/Button';
import { GIT_DESCRIBE } from '../../config/Environment';
import { usePlayerData } from '../gameContext/playerContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import './characterSettings.scss';
import { useColorInput } from '../../common/useColorInput';

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
	const [color, setColor] = useColorInput(playerData.settings.labelColor ?? '#ffffff');
	const shardConnector = useShardConnector();

	return (
		<fieldset>
			<legend>Label color</legend>
			<div className='input-row'>
				<label>Color</label>
				<input type='color' value={ color } onChange={ (event) => setColor(event.target.value) } />
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
