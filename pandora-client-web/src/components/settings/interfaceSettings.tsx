import { range } from 'lodash';
import { ACCOUNT_SETTINGS_DEFAULT, AccountSettings, AccountSettingsSchema } from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { z } from 'zod';
import { useCurrentAccount, useModifiedAccountSettings } from '../../services/accountLogic/accountManagerHooks';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { SelectAccountSettings, ToggleAccountSetting } from './helpers/accountSettings';
import { SelectSettingInput } from './helpers/settingsInputs';

export function InterfaceSettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<ChatroomSettings />
			<WardrobeSettings />
		</>
	);
}

function ChatroomSettings(): ReactElement {
	return (
		<fieldset>
			<legend>Chatroom UI</legend>
			<ChatroomGraphicsRatio />
			<ChatroomChatFontSize />
			<ChatroomCharacterNameFontSize />
			<ChatroomOfflineCharacters />
			<SelectAccountSettings setting='interfaceChatroomItemDisplayNameType' label='Item name display' stringify={ ITEM_DISPLAY_NAME_TYPE_DESCRIPTION } />
		</fieldset>
	);
}

function ChatroomGraphicsRatio(): ReactElement {
	const modifiedSettings = useModifiedAccountSettings();
	const directory = useDirectoryConnector();

	const onChange = (s: 'interfaceChatroomGraphicsRatioHorizontal' | 'interfaceChatroomGraphicsRatioVertical', value: string) => {
		const newValue = AccountSettingsSchema.shape[s].parse(Number.parseInt(value, 10));
		directory.sendMessage('changeSettings', {
			type: 'set',
			settings: { [s]: newValue },
		});
	};

	const onReset = (s: 'interfaceChatroomGraphicsRatioHorizontal' | 'interfaceChatroomGraphicsRatioVertical') => {
		directory.sendMessage('changeSettings', {
			type: 'reset',
			settings: [s],
		});
	};

	return (
		<>
			<SelectSettingInput<string>
				currentValue={ modifiedSettings?.interfaceChatroomGraphicsRatioHorizontal?.toString() }
				defaultValue={ ACCOUNT_SETTINGS_DEFAULT.interfaceChatroomGraphicsRatioHorizontal.toString() }
				label='Chatroom graphics to chat ratio (in landscape mode)'
				stringify={
					Object.fromEntries(
						range(
							AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal.minValue ?? 1,
							(AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal.maxValue ?? 9) + 1,
						).map((v) => [v.toString(), `${v}:${10 - v}`]),
					)
				}
				schema={ z.string() }
				onChange={ (v) => onChange('interfaceChatroomGraphicsRatioHorizontal', v) }
				onReset={ () => onReset('interfaceChatroomGraphicsRatioHorizontal') }
			/>
			<SelectSettingInput<string>
				currentValue={ modifiedSettings?.interfaceChatroomGraphicsRatioVertical?.toString() }
				defaultValue={ ACCOUNT_SETTINGS_DEFAULT.interfaceChatroomGraphicsRatioVertical.toString() }
				label='Chatroom graphics to chat ratio (in portrait mode)'
				stringify={
					Object.fromEntries(
						range(
							AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.minValue ?? 1,
							(AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.maxValue ?? 9) + 1,
						).map((v) => [v.toString(), `${v}:${10 - v}`]),
					)
				}
				schema={ z.string() }
				onChange={ (v) => onChange('interfaceChatroomGraphicsRatioVertical', v) }
				onReset={ () => onReset('interfaceChatroomGraphicsRatioVertical') }
			/>
		</>
	);
}

function ChatroomCharacterNameFontSize(): ReactElement {
	const SELECTION_DESCRIPTIONS = useMemo((): Record<AccountSettings['interfaceChatroomCharacterNameFontSize'], string> => ({
		xs: 'Extra small',
		s: 'Small',
		m: 'Medium (default)',
		l: 'Large',
		xl: 'Extra large',
	}), []);

	return <SelectAccountSettings setting='interfaceChatroomCharacterNameFontSize' label='Font size of the name of the character on the canvas' stringify={ SELECTION_DESCRIPTIONS } />;
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
			<SelectAccountSettings setting='wardrobeItemDisplayNameType' label='Item name display' stringify={ ITEM_DISPLAY_NAME_TYPE_DESCRIPTION } />
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

const ITEM_DISPLAY_NAME_TYPE_DESCRIPTION: Record<AccountSettings['wardrobeItemDisplayNameType'], string> = {
	custom: 'Custom name',
	original: 'Original name',
	custom_with_original_in_brackets: 'Custom name [Original name]',
};
