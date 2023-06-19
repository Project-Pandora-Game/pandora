import {
	AssetFrameworkCharacterState,
	HexColorString,
} from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { AppearanceContainer } from '../../character/character';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { Button } from '../common/button/button';
import { useEvent } from '../../common/useEvent';
import { GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { ColorInput } from '../common/colorInput/colorInput';
import { useCurrentAccountSettings, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';

export function WardrobeCharacterPreview({ character, characterState }: {
	character: AppearanceContainer;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const shardConnector = useShardConnector();
	const accountSettings = useCurrentAccountSettings();

	const wardrobeBackground: number = Number.parseInt(accountSettings.wardrobeBackground.substring(1, 7), 16);

	const sceneOptions = useMemo<GraphicsSceneProps>(() => ({
		backgroundColor: wardrobeBackground,
	}), [wardrobeBackground]);

	const overlay = (
		<div className='overlay'>
			<Button className='slim iconButton'
				title='Toggle character view'
				onClick={ () => {
					shardConnector?.sendMessage('appearanceAction', {
						type: 'setView',
						target: character.id,
						view: characterState.view === 'front' ? 'back' : 'front',
					});
				} }
			>
				↷
			</Button>
			<WardrobeBackgroundColorPicker />
		</div>
	);

	return (
		<GraphicsScene className='characterPreview' divChildren={ overlay } sceneOptions={ sceneOptions }>
			<GraphicsCharacter characterState={ characterState } />
		</GraphicsScene>
	);
}

function WardrobeBackgroundColorPicker(): ReactElement {
	const accountSettings = useCurrentAccountSettings();
	const directory = useDirectoryConnector();

	const onChange = useEvent((newColor: HexColorString) => {
		directory.sendMessage('changeSettings', { wardrobeBackground: newColor });
	});

	return (
		<ColorInput
			initialValue={ accountSettings.wardrobeBackground }
			onChange={ onChange }
			throttle={ 100 }
			hideTextInput={ true }
			inputColorTitle='Change background color'
		/>
	);
}
