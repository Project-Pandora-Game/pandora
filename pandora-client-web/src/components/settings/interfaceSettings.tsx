import React, { ReactElement } from 'react';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { IDirectoryAccountInfo } from 'pandora-common';
import { Button } from '../common/button/button';
import { ColorInput } from '../common/colorInput/colorInput';
import { useColorInput } from '../../common/useColorInput';

export function InterfaceSettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<WardrobeSettings account={ account } />
	);
}

function WardrobeSettings({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	return (
		<fieldset>
			<legend>Wardrobe UI</legend>
			<WardrobeBackgroundColor account={ account } />
		</fieldset>
	);
}

function WardrobeBackgroundColor({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directory = useDirectoryConnector();
	const [color, setColor] = useColorInput(account.settings.wardrobeBackground);

	return (
		<div className='input-row'>
			<label>Background</label>
			<ColorInput
				initialValue={ color }
				onChange={ setColor }
				inputColorTitle='Change background color'
			/>
			<Button
				className='slim fadeDisabled'
				onClick={ () => directory.sendMessage('changeSettings', { wardrobeBackground: color }) }
				disabled={ color === account.settings.wardrobeBackground.toUpperCase() }>
				Save
			</Button>
		</div>
	);
}
