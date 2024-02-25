import type { Immutable } from 'immer';
import { range } from 'lodash';
import { AccountSettings, AccountSettingsSchema } from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { useUpdatedUserInput } from '../../common/useSyncUserInput';
import { Select } from '../common/select/select';
import { useCurrentAccount, useDirectoryConnector, useEffectiveAccountSettings } from '../gameContext/directoryConnectorContextProvider';
import { SelectAccountSettings, ToggleAccountSetting } from './helpers/accountSettings';

export function InterfaceSettings(): ReactElement | null {
	const account = useCurrentAccount();
	const currentSettings = useEffectiveAccountSettings();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<ChatroomSettings currentSettings={ currentSettings } />
			<WardrobeSettings />
		</>
	);
}

function ChatroomSettings({ currentSettings }: { currentSettings: Immutable<AccountSettings>; }): ReactElement {
	return (
		<fieldset>
			<legend>Chatroom UI</legend>
			<ChatroomGraphicsRatio currentSettings={ currentSettings } />
			<ChatroomChatFontSize />
			<ChatroomOfflineCharacters />
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

function ChatroomChatFontSize(): ReactElement {
	const SELECTION_DESCRIPTIONS = useMemo((): Record<AccountSettings['interfaceChatroomChatFontSize'], string> => ({
		xs: 'Extra small',
		s: 'Small',
		m: 'Medium (default)',
		l: 'Large',
		xl: 'Extra large',
	}), []);

	return <SelectAccountSettings setting='interfaceChatroomChatFontSize' label='Font size of main chat and direct messages' stringify={ SELECTION_DESCRIPTIONS } />;
}

function ChatroomOfflineCharacters(): ReactElement {
	const SELECTION_DESCRIPTIONS = useMemo((): Record<AccountSettings['interfaceChatroomOfflineCharacterFilter'], string> => ({
		none: 'No effect (displayed the same as online characters)',
		icon: 'Show icon under the character name',
		darken: 'Darken',
		ghost: 'Ghost (darken + semi-transparent)',
	}), []);

	return <SelectAccountSettings setting='interfaceChatroomOfflineCharacterFilter' label='Offline characters display effect' stringify={ SELECTION_DESCRIPTIONS } />;
}

function WardrobeSettings(): ReactElement {
	return (
		<fieldset>
			<legend>Wardrobe UI</legend>
			<WardrobeShowExtraButtons />
			<WardrobeHoverPreview />
			<SelectAccountSettings setting='wardrobeOutfitsPreview' label='Saved item collection previews' stringify={ WARDROBE_PREVIEWS_DESCRIPTION } />
			<SelectAccountSettings setting='wardrobeSmallPreview' label='Item previews: List mode with small previews' stringify={ WARDROBE_PREVIEW_TYPE_DESCRIPTION } />
			<SelectAccountSettings setting='wardrobeBigPreview' label='Item previews: Grid mode with big previews' stringify={ WARDROBE_PREVIEW_TYPE_DESCRIPTION } />
		</fieldset>
	);
}

function WardrobeShowExtraButtons(): ReactElement {
	return <ToggleAccountSetting setting='wardrobeExtraActionButtons' label='Show quick action buttons' />;
}

function WardrobeHoverPreview(): ReactElement {
	return <ToggleAccountSetting setting='wardrobeHoverPreview' label='Show preview when hovering over action button' />;
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
