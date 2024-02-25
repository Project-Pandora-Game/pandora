import type { Immutable } from 'immer';
import { range } from 'lodash';
import { AccountSettings, AccountSettingsSchema, KnownObject } from 'pandora-common';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { useColorInput } from '../../common/useColorInput';
import { useRemotelyUpdatedUserInput } from '../../common/useRemotelyUpdatedUserInput';
import { useUpdatedUserInput } from '../../common/useSyncUserInput';
import { Button } from '../common/button/button';
import { ColorInput } from '../common/colorInput/colorInput';
import { Select, SelectProps } from '../common/select/select';
import { useCurrentAccount, useDirectoryConnector, useEffectiveAccountSettings } from '../gameContext/directoryConnectorContextProvider';

export function InterfaceSettings(): ReactElement | null {
	const account = useCurrentAccount();
	const currentSettings = useEffectiveAccountSettings();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<ChatroomSettings currentSettings={ currentSettings } />
			<WardrobeSettings currentSettings={ currentSettings } />
		</>
	);
}

function ChatroomSettings({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	return (
		<fieldset>
			<legend>Chatroom UI</legend>
			<ChatroomGraphicsRatio currentSettings={ currentSettings } />
			<ChatroomChatFontSize currentSettings={ currentSettings } />
			<ChatroomOfflineCharacters currentSettings={ currentSettings } />
		</fieldset>
	);
}

function ChatroomGraphicsRatio({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	const directory = useDirectoryConnector();

	const [ratioHorizontal, setRatioHorizontal] = useUpdatedUserInput(currentSettings.interfaceChatroomGraphicsRatioHorizontal);
	const onChangeRatioHorizontal = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newValue = AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal.parse(Number.parseInt(e.target.value, 10));
		setRatioHorizontal(newValue);
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { interfaceChatroomGraphicsRatioHorizontal: newValue },
		});
	};

	const [ratioVertical, setRatioVertical] = useUpdatedUserInput(currentSettings.interfaceChatroomGraphicsRatioVertical);
	const onChangeRatioVertical = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newValue = AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.parse(Number.parseInt(e.target.value, 10));
		setRatioVertical(newValue);
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { interfaceChatroomGraphicsRatioVertical: newValue },
		});
	};

	return (
		<>
			<div className='input-section'>
				<label>Chatroom graphics to chat ratio (in landscape mode)</label>
				<Select value={ ratioHorizontal.toString() } onChange={ onChangeRatioHorizontal }>
					{
						range(
							AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal.minValue ?? 1,
							(AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal.maxValue ?? 9) + 1,
						).map((v) => <option key={ v } value={ v.toString() }>{ `${v}:${10 - v}` }</option>)
					}
				</Select>
			</div>
			<div className='input-section'>
				<label>Chatroom graphics to chat ratio (in portrait mode)</label>
				<Select value={ ratioVertical.toString() } onChange={ onChangeRatioVertical }>
					{
						range(
							AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.minValue ?? 1,
							(AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.maxValue ?? 9) + 1,
						).map((v) => <option key={ v } value={ v.toString() }>{ `${v}:${10 - v}` }</option>)
					}
				</Select>
			</div>
		</>
	);
}

function ChatroomChatFontSize({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	const directory = useDirectoryConnector();
	const [size, setSize] = useState(currentSettings.interfaceChatroomChatFontSize);

	const onChange = useCallback<NonNullable<SelectProps['onChange']>>(({ target }) => {
		const newValue = AccountSettingsSchema.shape.interfaceChatroomChatFontSize.parse(target.value);

		setSize(newValue);
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { interfaceChatroomChatFontSize: newValue },
		});
	}, [directory]);

	const SELECTION_DESCRIPTIONS: Record<AccountSettings['interfaceChatroomChatFontSize'], string> = {
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

function ChatroomOfflineCharacters({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	const directory = useDirectoryConnector();
	const [selection, setSelection] = useState(currentSettings.interfaceChatroomOfflineCharacterFilter);

	const onChange = useCallback<NonNullable<SelectProps['onChange']>>(({ target }) => {
		const newValue = AccountSettingsSchema.shape.interfaceChatroomOfflineCharacterFilter.parse(target.value);

		setSelection(newValue);
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { interfaceChatroomOfflineCharacterFilter: newValue },
		});
	}, [directory]);

	const SELECTION_DESCRIPTIONS: Record<AccountSettings['interfaceChatroomOfflineCharacterFilter'], string> = {
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
					(Object.keys(SELECTION_DESCRIPTIONS) as AccountSettings['interfaceChatroomOfflineCharacterFilter'][])
						.map((v) => <option key={ v } value={ v }>{ SELECTION_DESCRIPTIONS[v] }</option>)
				}
			</Select>
		</div>
	);
}

function WardrobeSettings({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	return (
		<fieldset>
			<legend>Wardrobe UI</legend>
			<WardrobeBackgroundColor currentSettings={ currentSettings } />
			<WardrobeUseRoomBackground currentSettings={ currentSettings } />
			<WardrobeShowExtraButtons currentSettings={ currentSettings } />
			<WardrobeHoverPreview currentSettings={ currentSettings } />
			<WardrobeSelectSettings currentSettings={ currentSettings } setting='wardrobeOutfitsPreview' label='Saved item collection previews' stringify={ WARDROBE_PREVIEWS_DESCRIPTION } />
			<WardrobeSelectSettings currentSettings={ currentSettings } setting='wardrobeSmallPreview' label='Item previews: List mode with small previews' stringify={ WARDROBE_PREVIEW_TYPE_DESCRIPTION } />
			<WardrobeSelectSettings currentSettings={ currentSettings } setting='wardrobeBigPreview' label='Item previews: Grid mode with big previews' stringify={ WARDROBE_PREVIEW_TYPE_DESCRIPTION } />
		</fieldset>
	);
}

function WardrobeBackgroundColor({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	const directory = useDirectoryConnector();
	const [color, setColor] = useColorInput(currentSettings.wardrobeBackground);

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
				onClick={ () => {
					directory.sendMessage('changeSettings', {
						type: 'set',
						settings: { wardrobeBackground: color },
					});
				} }
				disabled={ color === currentSettings.wardrobeBackground.toUpperCase() }>
				Save
			</Button>
		</div>
	);
}

function WardrobeUseRoomBackground({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	const directory = useDirectoryConnector();
	const [show, setShow] = useState(currentSettings.wardrobeUseRoomBackground);

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked;
		setShow(newValue);
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { wardrobeUseRoomBackground: newValue },
		});
	};

	return (
		<div className='input-row'>
			<input type='checkbox' checked={ show } onChange={ onChange } />
			<label>Use room's background, if character is inside a room</label>
		</div>
	);
}

function WardrobeShowExtraButtons({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	const directory = useDirectoryConnector();
	const [show, setShow] = useState(currentSettings.wardrobeExtraActionButtons);

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked;
		setShow(newValue);
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { wardrobeExtraActionButtons: newValue },
		});
	};

	return (
		<div className='input-row'>
			<input type='checkbox' checked={ show } onChange={ onChange } />
			<label>Show quick action buttons</label>
		</div>
	);
}

function WardrobeHoverPreview({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	const directory = useDirectoryConnector();
	const [show, setShow] = useState(currentSettings.wardrobeHoverPreview);

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.checked;
		setShow(newValue);
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { wardrobeHoverPreview: newValue },
		});
	};

	return (
		<div className='input-row'>
			<input type='checkbox' checked={ show } onChange={ onChange } />
			<label>Show preview when hovering over action button</label>
		</div>
	);
}

const WARDROBE_PREVIEWS_DESCRIPTION: Record<AccountSettings['wardrobeOutfitsPreview'], string> = {
	disabled: 'Disabled (better performance)',
	small: 'Enabled (small live previews)',
	big: 'Enabled (big live previews)',
};

const WARDROBE_PREVIEW_TYPE_DESCRIPTION: Record<AccountSettings['wardrobeSmallPreview'], string> = {
	icon: 'Show attribute icon',
	image: 'Show preview image',
};

type StringKeyOf<T> = {
	[K in keyof T]: T[K] extends string ? K : never
}[keyof T];

function WardrobeSelectSettings<K extends StringKeyOf<AccountSettings>>({ currentSettings, setting, label, stringify }: {
	currentSettings: Immutable<AccountSettings>;
	setting: K;
	label: string;
	stringify: Readonly<Record<AccountSettings[K], string>>;
}): ReactElement {
	const directory = useDirectoryConnector();
	const [value, setValue] = useRemotelyUpdatedUserInput(currentSettings[setting], undefined, {
		updateCallback: (newValue) => {
			directory.sendMessage('changeSettings', {
				type: 'set',
				settings: { [setting]: newValue },
			});
		},
	});
	const onChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
		const newValue = AccountSettingsSchema.shape[setting].parse(e.target.value);
		setValue(newValue as AccountSettings[K]);
	}, [setting, setValue]);
	const options = useMemo(() => (Object.entries(stringify) as [AccountSettings[K], string][]).map(([k, v]) => (
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
