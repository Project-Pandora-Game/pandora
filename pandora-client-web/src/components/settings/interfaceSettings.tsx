import React, { ReactElement, useState } from 'react';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { DirectoryAccountSettingsSchema, IDirectoryAccountInfo } from 'pandora-common';
import { Button } from '../common/button/button';
import { ColorInput } from '../common/colorInput/colorInput';
import { useColorInput } from '../../common/useColorInput';
import { Select } from '../common/select/select';
import { useUpdatedUserInput } from '../../common/useSyncUserInput';
import { range } from 'lodash';

export function InterfaceSettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<ChatroomSettings account={ account } />
			<WardrobeSettings account={ account } />
		</>
	);
}

function ChatroomSettings({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	return (
		<fieldset>
			<legend>Chatroom UI</legend>
			<ChatroomGraphicsRatio account={ account } />
		</fieldset>
	);
}

function ChatroomGraphicsRatio({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directory = useDirectoryConnector();

	const [ratioHorizontal, setRatioHorizontal] = useUpdatedUserInput(account.settings.interfaceChatroomGraphicsRatioHorizontal);
	const onChangeRatioHorizontal = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newValue = DirectoryAccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal.parse(Number.parseInt(e.target.value, 10));
		setRatioHorizontal(newValue);
		directory.sendMessage('changeSettings', { interfaceChatroomGraphicsRatioHorizontal: newValue });
	};

	const [ratioVertical, setRatioVertical] = useUpdatedUserInput(account.settings.interfaceChatroomGraphicsRatioVertical);
	const onChangeRatioVertical = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newValue = DirectoryAccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.parse(Number.parseInt(e.target.value, 10));
		setRatioVertical(newValue);
		directory.sendMessage('changeSettings', { interfaceChatroomGraphicsRatioVertical: newValue });
	};

	return (
		<>
			<div className='input-section'>
				<label>Chatroom graphics to chat ratio (in landscape mode)</label>
				<Select value={ ratioHorizontal.toString() } onChange={ onChangeRatioHorizontal }>
					{
						range(
							DirectoryAccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal._def.innerType.minValue ?? 1,
							(DirectoryAccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal._def.innerType.maxValue ?? 9) + 1,
						).map((v) => <option key={ v } value={ v.toString() }>{ `${v}:${10 - v}` }</option>)
					}
				</Select>
			</div>
			<div className='input-section'>
				<label>Chatroom graphics to chat ratio (in portrait mode)</label>
				<Select value={ ratioVertical.toString() } onChange={ onChangeRatioVertical }>
					{
						range(
							DirectoryAccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical._def.innerType.minValue ?? 1,
							(DirectoryAccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical._def.innerType.maxValue ?? 9) + 1,
						).map((v) => <option key={ v } value={ v.toString() }>{ `${v}:${10 - v}` }</option>)
					}
				</Select>
			</div>
		</>
	);
}

function WardrobeSettings({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	return (
		<fieldset>
			<legend>Wardrobe UI</legend>
			<WardrobeBackgroundColor account={ account } />
			<WardrobeShowExtraButtons account={ account } />
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

function WardrobeShowExtraButtons({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directory = useDirectoryConnector();
	const [show, setShow] = useState(account.settings.wardrobeExtraActionButtons);

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked;
		setShow(newValue);
		directory.sendMessage('changeSettings', { wardrobeExtraActionButtons: newValue });
	};

	return (
		<div className='input-row'>
			<input type='checkbox' checked={ show } onChange={ onChange } />
			<label>Show quick action buttons</label>
		</div>
	);
}
