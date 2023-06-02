import { ICharacterPrivateData } from 'pandora-common';
import React, { ReactElement } from 'react';
import { Button } from '../common/button/button';
import { usePlayerData } from '../gameContext/playerContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ColorInput } from '../common/colorInput/colorInput';
import { PronounKey, PRONOUNS } from 'pandora-common/dist/character/pronouns';
import { useChatRoomFeatures } from '../gameContext/chatRoomContextProvider';
import { Select } from '../common/select/select';
import { useColorInput } from '../../common/useColorInput';

export function CharacterSettings(): ReactElement | null {
	const playerData = usePlayerData();

	if (!playerData)
		return <>No character selected</>;

	return (
		<>
			<LabelColor playerData={ playerData } />
			<Pronouns playerData={ playerData } />
		</>
	);
}

function LabelColor({ playerData }: { playerData: Readonly<ICharacterPrivateData>; }): ReactElement {
	const shardConnector = useShardConnector();
	const [color, setColor] = useColorInput(playerData.settings.labelColor);

	return (
		<fieldset>
			<legend>Name color</legend>
			<div className='input-row'>
				<label>Color</label>
				<ColorInput initialValue={ color } onChange={ setColor } />
				<Button
					className='slim fadeDisabled'
					onClick={ () => shardConnector?.sendMessage('updateSettings', { labelColor: color }) }
					disabled={ color === playerData.settings.labelColor?.toUpperCase() }>
					Save
				</Button>
			</div>
		</fieldset>
	);
}

function Pronouns({ playerData }: { playerData: Readonly<ICharacterPrivateData>; }): ReactElement {
	const shardConnector = useShardConnector();
	const [pronoun, setPronoun] = React.useState(playerData.settings.pronoun);
	const features = useChatRoomFeatures();
	const allowChange = features == null || features.includes('allowPronounChanges');

	return (
		<fieldset>
			<legend>Pronouns</legend>
			<div className='input-row'>
				<label>Pronoun</label>
				<Select value={ pronoun } onChange={ (ev) => setPronoun(ev.target.value as PronounKey) } disabled={ !allowChange }>
					{ Object.entries(PRONOUNS).map(([key, value]) => (
						<option key={ key } value={ key }>
							{ Object.values(value).join('/') }
						</option>
					)) }
				</Select>
				<Button
					className='slim fadeDisabled'
					onClick={ () => shardConnector?.sendMessage('updateSettings', { pronoun }) }
					disabled={ !allowChange || pronoun === playerData.settings.pronoun }>
					Save
				</Button>
			</div>
		</fieldset>
	);
}
