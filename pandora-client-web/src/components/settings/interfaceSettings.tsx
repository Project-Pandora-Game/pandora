import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { DirectoryAccountSettingsSchema, IDirectoryAccountInfo, IDirectoryAccountSettings, KnownObject } from 'pandora-common';
import { Button } from '../common/button/button';
import { ColorInput } from '../common/colorInput/colorInput';
import { useColorInput } from '../../common/useColorInput';
import { Select, SelectProps } from '../common/select/select';
import { useUpdatedUserInput } from '../../common/useSyncUserInput';
import { range } from 'lodash';
import { useRemotelyUpdatedUserInput } from '../../common/useRemotelyUpdatedUserInput';

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
			<ChatroomChatFontSize account={ account } />
			<ChatroomOfflineCharacters account={ account } />
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

function ChatroomChatFontSize({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directory = useDirectoryConnector();
	const [size, setSize] = useState(account.settings.interfaceChatroomChatFontSize);

	const onChange = useCallback<NonNullable<SelectProps['onChange']>>(({ target }) => {
		const newValue = DirectoryAccountSettingsSchema.shape.interfaceChatroomChatFontSize.parse(target.value);

		setSize(newValue);
		directory.sendMessage('changeSettings', { interfaceChatroomChatFontSize: newValue });
	}, [directory]);

	const SELECTION_DESCRIPTIONS: Record<IDirectoryAccountSettings['interfaceChatroomChatFontSize'], string> = {
		xs: 'Extra small',
		s: 'Small',
		m: 'Medium (default)',
		l: 'Large',
		xl: 'Extra large',
	};

	return (
		<div className='input-section'>
			<label>Font size of main chat and direct messages</label>
			<Select value={ size } onChange={ onChange }>
				{
					KnownObject.keys(SELECTION_DESCRIPTIONS)
						.map((v) => <option key={ v } value={ v }>{ SELECTION_DESCRIPTIONS[v] }</option>)
				}
			</Select>
		</div>
	);
}

function ChatroomOfflineCharacters({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directory = useDirectoryConnector();
	const [selection, setSelection] = useState(account.settings.interfaceChatroomOfflineCharacterFilter);

	const onChange = useCallback<NonNullable<SelectProps['onChange']>>(({ target }) => {
		const newValue = DirectoryAccountSettingsSchema.shape.interfaceChatroomOfflineCharacterFilter.parse(target.value);

		setSelection(newValue);
		directory.sendMessage('changeSettings', { interfaceChatroomOfflineCharacterFilter: newValue });
	}, [directory]);

	const SELECTION_DESCRIPTIONS: Record<IDirectoryAccountSettings['interfaceChatroomOfflineCharacterFilter'], string> = {
		none: 'No effect (displayed the same as online characters)',
		icon: 'Show icon under the character name',
		darken: 'Darken',
		ghost: 'Ghost (darken + semi-transparent)',
	};

	return (
		<div className='input-section'>
			<label>Offline characters display effect</label>
			<Select value={ selection } onChange={ onChange }>
				{
					(Object.keys(SELECTION_DESCRIPTIONS) as IDirectoryAccountSettings['interfaceChatroomOfflineCharacterFilter'][])
						.map((v) => <option key={ v } value={ v }>{ SELECTION_DESCRIPTIONS[v] }</option>)
				}
			</Select>
		</div>
	);
}

function WardrobeSettings({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	return (
		<fieldset>
			<legend>Wardrobe UI</legend>
			<WardrobeBackgroundColor account={ account } />
			<WardrobeUseRoomBackground account={ account } />
			<WardrobeShowExtraButtons account={ account } />
			<WardrobeHoverPreview account={ account } />
			<WardrobeSelectSettings account={ account } setting='wardrobeOutfitsPreview' label='Outfit previews' stringify={ WARDROBE_PREVIEWS_DESCRIPTION } />
			<WardrobeSelectSettings account={ account } setting='wardrobeSmallPreview' label='Item previews: List mode with small previews' stringify={ WARDROBE_PREVIEW_TYPE_DESCRIPTION } />
			<WardrobeSelectSettings account={ account } setting='wardrobeBigPreview' label='Item previews: Grid mode with big previews' stringify={ WARDROBE_PREVIEW_TYPE_DESCRIPTION } />
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

function WardrobeUseRoomBackground({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directory = useDirectoryConnector();
	const [show, setShow] = useState(account.settings.wardrobeUseRoomBackground);

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked;
		setShow(newValue);
		directory.sendMessage('changeSettings', { wardrobeUseRoomBackground: newValue });
	};

	return (
		<div className='input-row'>
			<input type='checkbox' checked={ show } onChange={ onChange } />
			<label>Use room's background, if character is inside a room</label>
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

function WardrobeHoverPreview({ account }: { account: IDirectoryAccountInfo; }): ReactElement {
	const directory = useDirectoryConnector();
	const [show, setShow] = useState(account.settings.wardrobeHoverPreview);

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked;
		setShow(newValue);
		directory.sendMessage('changeSettings', { wardrobeHoverPreview: newValue });
	};

	return (
		<div className='input-row'>
			<input type='checkbox' checked={ show } onChange={ onChange } />
			<label>Show preview when hovering over action button</label>
		</div>
	);
}

const WARDROBE_PREVIEWS_DESCRIPTION: Record<IDirectoryAccountSettings['wardrobeOutfitsPreview'], string> = {
	disabled: 'Disabled (better performance)',
	small: 'Enabled (small live previews)',
	big: 'Enabled (big live previews)',
};

const WARDROBE_PREVIEW_TYPE_DESCRIPTION: Record<IDirectoryAccountSettings['wardrobeSmallPreview'], string> = {
	icon: 'Show attribute icon',
	image: 'Show preview image',
};

type StringKeyOf<T> = {
	[K in keyof T]: T[K] extends string ? K : never
}[keyof T];

function WardrobeSelectSettings<K extends StringKeyOf<IDirectoryAccountSettings>>({ account, setting, label, stringify }: {
	account: IDirectoryAccountInfo;
	setting: K;
	label: string;
	stringify: Readonly<Record<IDirectoryAccountSettings[K], string>>;
}): ReactElement {
	const directory = useDirectoryConnector();
	const [value, setValue] = useRemotelyUpdatedUserInput(account.settings[setting], [account], {
		updateCallback: (newValue) => {
			directory.sendMessage('changeSettings', { [setting]: newValue });
		},
	});
	const onChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
		const newValue = DirectoryAccountSettingsSchema.shape[setting].parse(e.target.value);
		setValue(newValue as IDirectoryAccountSettings[K]);
	}, [setting, setValue]);
	const options = useMemo(() => (Object.entries(stringify) as [IDirectoryAccountSettings[K], string][]).map(([k, v]) => (
		<option key={ k } value={ k }>
			{ v }
		</option>
	)), [stringify]);
	return (
		<div className='input-section'>
			<label>{ label }</label>
			<Select value={ value } onChange={ onChange }>
				{ options }
			</Select>
		</div>
	);
}
