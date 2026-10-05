import { ACCOUNT_SETTINGS_DEFAULT, AccountSettings, AccountSettingsSchema, GetLogger, type HexColorString } from 'pandora-common';
import { ReactElement, useCallback, useId, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../common/useEvent.ts';
import { Checkbox } from '../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../common/userInteraction/input/numberInput.tsx';
import { LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useAccountSettings, useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { Button } from '../common/button/button.tsx';
import { ColorInput } from '../common/colorInput/colorInput.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { SelectionIndicator } from '../common/selectionIndicator/selectionIndicator.tsx';
import { useConfirmDialog } from '../dialog/dialog.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { ContextHelpButton } from '../help/contextHelpButton.tsx';
import { SelectAccountSettings, ToggleAccountSetting, useAccountSettingDriver } from './helpers/accountSettings.tsx';
import { NumberSettingInput } from './helpers/settingsInputs.tsx';

export function InterfaceSettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<ThemeSettings />
			<ChatroomSettings />
			<RoomGraphicsSettings />
			<WardrobeSettings />
			<SpaceSearchSettings />
			<TutorialSettings />
		</>
	);
}

const THEME_SUGGESTED_ACCENT_COLORS: readonly HexColorString[] = [
	'#e93a9a',
	'#e93d58',
	'#e9643a',
	'#e8cb2d',
	'#3dd425',
	'#00d3b8',
	'#3daee9',
	'#b875dc',
	'#926ee4',
	'#686b6f',
];

function ThemeSettings(): ReactElement {
	const { interfaceAccentColor } = useAccountSettings();
	const directory = useDirectoryConnector();

	const [useCustomAccentColor, setUseCustomAccentColor] = useState(!THEME_SUGGESTED_ACCENT_COLORS.includes(interfaceAccentColor));
	const setAccentColor = useCallback((color: HexColorString) => {
		directory.awaitResponse('changeSettings', {
			type: 'set',
			settings: { interfaceAccentColor: color },
		})
			.catch((err: unknown) => {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				GetLogger('changeSettings').error('Failed to update settings:', err);
			});
	}, [directory]);

	return (
		<fieldset>
			<legend>Theme</legend>
			<Column>
				<span>Accent color</span>
				<Row className='accentColorPresets' wrap>
					{
						THEME_SUGGESTED_ACCENT_COLORS.map((color) => (
							<SelectionIndicator key={ color }
								selected={ interfaceAccentColor === color }
								className='colorPreset'
							>
								<Button
									slim
									onClick={ () => {
										setUseCustomAccentColor(false);
										setAccentColor(color);
									} }
									style={ {
										backgroundColor: color,
									} }
									className='flex-1'
								/>
							</SelectionIndicator>
						))
					}
					<SelectionIndicator
						selected={ useCustomAccentColor || !THEME_SUGGESTED_ACCENT_COLORS.includes(interfaceAccentColor) }
						className='colorPreset'
					>
						<Button
							slim
							onClick={ () => {
								setUseCustomAccentColor(true);
							} }
							className='flex-1'
						>
							{ '\u2026' }
						</Button>
					</SelectionIndicator>
				</Row>
				{
					(useCustomAccentColor || !THEME_SUGGESTED_ACCENT_COLORS.includes(interfaceAccentColor)) ? (
						<div className='input-row'>
							<label>Custom accent color</label>
							<ColorInput
								initialValue={ interfaceAccentColor }
								resetValue={ ACCOUNT_SETTINGS_DEFAULT.interfaceAccentColor }
								throttle={ LIVE_UPDATE_THROTTLE }
								onChange={ (color) => {
									setAccentColor(color);
								} }
								title='Interface accent color'
							/>
						</div>
					) : null
				}
			</Column>
		</fieldset>
	);
}

function ChatroomSettings(): ReactElement {
	return (
		<fieldset>
			<legend>Chatroom UI</legend>
			<Column gap='large'>
				<ChatroomGraphicsRatio />
				<InterfaceChatroomHideRoomDescriptionsRole />
				<ChatroomChatFontSize />
				<ChatroomChatCommandHintBehavior />
				<ChatroomChatMaxShownMessages />
				<SelectAccountSettings setting='interfaceChatroomItemDisplayNameType' label='Item name display' stringify={ ITEM_DISPLAY_NAME_TYPE_DESCRIPTION } />
			</Column>
		</fieldset>
	);
}

function ChatroomGraphicsRatio(): ReactElement {
	const interfaceChatroomGraphicsRatioHorizontalDriver = useAccountSettingDriver('interfaceChatroomGraphicsRatioHorizontal');
	const interfaceChatroomGraphicsRatioVerticalDriver = useAccountSettingDriver('interfaceChatroomGraphicsRatioVertical');

	return (
		<>
			<NumberSettingInput
				driver={ interfaceChatroomGraphicsRatioHorizontalDriver }
				label='Chatroom graphics to chat ratio (in landscape mode)'
				min={ AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal.minValue ?? 1 }
				max={ AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioHorizontal.maxValue ?? 9 }
				step={ 1 }
				withSlider
			>
				<span>:</span>
				<NumberInput
					className='flex-grow-1 value'
					value={ 10 - (interfaceChatroomGraphicsRatioHorizontalDriver.currentValue ?? interfaceChatroomGraphicsRatioHorizontalDriver.defaultValue) }
					min={ AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.minValue ?? 1 }
					max={ AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.maxValue ?? 9 }
					disabled
				/>
			</NumberSettingInput>
			<SelectAccountSettings setting='interfaceChatroomChatSplitHorizontal' label='Always show chat in landscape mode (on large enough displays)' stringify={ INTERFACE_CHATROOM_CHAT_SPLIT_HORIZONTAL } />
			<NumberSettingInput
				driver={ interfaceChatroomGraphicsRatioVerticalDriver }
				label='Chatroom graphics to chat ratio (in portrait mode)'
				min={ AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.minValue ?? 1 }
				max={ AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.maxValue ?? 9 }
				step={ 1 }
				withSlider
			>
				<span>:</span>
				<NumberInput
					className='flex-grow-1 value'
					value={ 10 - (interfaceChatroomGraphicsRatioVerticalDriver.currentValue ?? interfaceChatroomGraphicsRatioVerticalDriver.defaultValue) }
					min={ AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.minValue ?? 1 }
					max={ AccountSettingsSchema.shape.interfaceChatroomGraphicsRatioVertical.maxValue ?? 9 }
					disabled
				/>
			</NumberSettingInput>
			<SelectAccountSettings setting='interfaceChatroomChatSplitVertical' label='Always show chat in portrait mode (on large enough displays)' stringify={ INTERFACE_CHATROOM_CHAT_SPLIT_VERTICAL } />
		</>
	);
}

function InterfaceChatroomHideRoomDescriptionsRole(): ReactElement {
	const STRINGS = useMemo((): Record<AccountSettings['interfaceChatroomHideRoomDescriptionsRole'], string> => ({
		none: '[ Never hide ]',
		owner: 'Owner',
		admin: 'Owner or Admin',
		allowlisted: 'Owner, Admin, or Allowed user',
		everyone: '[ Always hide ]',
	}), []);

	return (
		<SelectAccountSettings
			setting='interfaceChatroomHideRoomDescriptionsRole'
			label='Hide room descriptions by default in spaces where you are'
			stringify={ STRINGS }
		/>
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

function ChatroomChatCommandHintBehavior(): ReactElement {
	const SELECTION_DESCRIPTIONS = useMemo((): Record<AccountSettings['chatCommandHintBehavior'], string> => ({
		'always-show': 'Always shown while typing a command',
		'on-tab': 'Shown only when requested by pressing [Tab]',
	}), []);

	return <SelectAccountSettings setting='chatCommandHintBehavior' label='Command hint behavior' stringify={ SELECTION_DESCRIPTIONS } />;
}

function ChatroomChatMaxShownMessages(): ReactElement {
	const id = useId();
	const driver = useAccountSettingDriver('chatMaxShownMessages');
	const currentValue = driver.currentValue !== undefined ? driver.currentValue : driver.defaultValue;
	const DEFAULT_NUMBER_VALUE = ACCOUNT_SETTINGS_DEFAULT.chatMaxShownMessages ?? 1000;

	return (
		<Column gap='small'>
			<label htmlFor={ id }>Limit number of displayed chat messages</label>
			<Row alignY='center'>
				<Checkbox
					checked={ currentValue != null }
					onChange={ (newValue) => {
						driver.onChange(newValue ? DEFAULT_NUMBER_VALUE : null);
					} }
				/>
				<NumberInput
					id={ id }
					className='flex-1'
					disabled={ currentValue == null }
					min={ 1 }
					step={ 1 }
					value={ currentValue ?? DEFAULT_NUMBER_VALUE }
					onChange={ (newValue) => {
						driver.onChange(newValue);
					} }
				/>
				<Button
					className='slim'
					onClick={ () => {
						if (driver.onReset != null) {
							driver.onReset();
						} else {
							driver.onChange(driver.defaultValue);
						}
					} }
					disabled={ driver.currentValue === undefined }
				>
					↺
				</Button>
			</Row>
		</Column>
	);
}

function RoomGraphicsSettings(): ReactElement {
	return (
		<fieldset>
			<legend>Room graphics UI</legend>
			<Column gap='large'>
				<ChatroomCharacterAwayStatusIconDisplay />
				<ChatroomCharacterNameFontSize />
				<ChatroomOfflineCharacters />
				<ChatroomBlockedCharacters />
				<ChatroomCharacterPosintStyle />
			</Column>
		</fieldset>
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

function ChatroomCharacterPosintStyle(): ReactElement {
	const SELECTION_DESCRIPTIONS = useMemo((): Record<AccountSettings['interfacePosingStyle'], string> => ({
		inverse: 'Inverse posing (dragging limbs to their position) [default]',
		forward: 'Forward posing (directly manipulating bone/joint rotation)',
		both: 'Both (shows both inverse and forward posing elements)',
	}), []);

	return <SelectAccountSettings setting='interfacePosingStyle' label='Character posing interface style' stringify={ SELECTION_DESCRIPTIONS } />;
}

function ChatroomOfflineCharacters(): ReactElement {
	const SELECTION_DESCRIPTIONS = useMemo((): Record<AccountSettings['interfaceChatroomOfflineCharacterFilter'], string> => ({
		'normal': 'No effect (displayed the same as online characters)',
		'icon': 'Show icon next to the character name',
		'darken': 'Darken',
		'ghost': 'Ghost (darken + semi-transparent)',
		'silhouette': 'Silhouette (mostly transparent silhouette)',
		'name-only': 'Show only character name',
		'hidden': 'Hide both the character and the name (show only in room list)',
	}), []);

	return <SelectAccountSettings setting='interfaceChatroomOfflineCharacterFilter' label='Offline characters display effect' stringify={ SELECTION_DESCRIPTIONS } />;
}

function ChatroomBlockedCharacters(): ReactElement {
	const SELECTION_DESCRIPTIONS = useMemo((): Record<AccountSettings['interfaceChatroomBlockedCharacterFilter'], string> => ({
		'normal': 'No effect (displayed as normal characters)',
		'ghost': 'Ghost (darken + semi-transparent)',
		'silhouette': 'Silhouette (mostly transparent silhouette)',
		'name-only': 'Show only character name',
		'hidden': 'Hide both the character and the name (show only in room list)',
	}), []);

	return <SelectAccountSettings setting='interfaceChatroomBlockedCharacterFilter' label='Characters of blocked accounts display effect' stringify={ SELECTION_DESCRIPTIONS } />;
}

function WardrobeSettings(): ReactElement {
	return (
		<fieldset>
			<legend>Wardrobe UI</legend>
			<Column gap='large'>
				<WardrobeShowExtraButtons />
				<WardrobeHoverPreview />
				<ToggleAccountSetting setting='wardrobePosePreview' label='Show previews in the "Pose" menu' />
				<SelectAccountSettings setting='wardrobePosingCategoryDefault' label='Select the default category in the "Pose" menu' stringify={ WARDROBE_POSING_CATEGORY_DEFAULT } />
				<SelectAccountSettings setting='wardrobeOutfitsPreview' label='Saved item collection previews' stringify={ WARDROBE_PREVIEWS_DESCRIPTION } />
				<SelectAccountSettings setting='wardrobeSmallPreview' label='Item previews: List mode with small previews' stringify={ WARDROBE_PREVIEW_TYPE_DESCRIPTION } />
				<SelectAccountSettings setting='wardrobeBigPreview' label='Item previews: Grid mode with big previews' stringify={ WARDROBE_PREVIEW_TYPE_DESCRIPTION } />
				<SelectAccountSettings setting='wardrobeItemDisplayNameType' label='Item name display' stringify={ ITEM_DISPLAY_NAME_TYPE_DESCRIPTION } />
				<SelectAccountSettings setting='wardrobeItemRequireFreeHandsToUseDefault' label='Bound usage pre-selection when creating new items' stringify={ WARDROBE_ITEM_REQUIRE_FREE_HANDS_TO_USE_DEFAULT } />
			</Column>
		</fieldset>
	);
}

function ChatroomCharacterAwayStatusIconDisplay(): ReactElement {
	return <ToggleAccountSetting setting='interfaceChatroomCharacterAwayStatusIconDisplay' label='Show away status icon under characters on the canvas' />;
}

function WardrobeShowExtraButtons(): ReactElement {
	return <ToggleAccountSetting setting='wardrobeExtraActionButtons' label='Show quick action buttons' />;
}

function WardrobeHoverPreview(): ReactElement {
	return <ToggleAccountSetting setting='wardrobeHoverPreview' label='Show preview when hovering over action button' />;
}

const INTERFACE_CHATROOM_CHAT_SPLIT_HORIZONTAL: Record<AccountSettings['interfaceChatroomChatSplitHorizontal'], string> = {
	disabled: 'Do not show chat in other tabs',
	horizontal: 'Show chat at the bottom of the tab',
	vertical: 'Show chat on the left of the tab',
};

const INTERFACE_CHATROOM_CHAT_SPLIT_VERTICAL: Record<AccountSettings['interfaceChatroomChatSplitVertical'], string> = {
	disabled: 'Do not show chat in other tabs',
	horizontal: 'Show chat at the bottom of the tab',
	vertical: 'Show chat on the left of the tab',
};

const WARDROBE_POSING_CATEGORY_DEFAULT: Record<AccountSettings['wardrobePosingCategoryDefault'], string> = {
	custom: 'Custom poses',
	basic: 'Quick posing',
	manual: 'Manual posing',
};

const WARDROBE_PREVIEWS_DESCRIPTION: Record<AccountSettings['wardrobeOutfitsPreview'], string> = {
	disabled: 'Disabled (better performance)',
	small: 'Enabled (small live previews)',
	big: 'Enabled (big live previews)',
};

const WARDROBE_PREVIEW_TYPE_DESCRIPTION: Record<AccountSettings['wardrobeSmallPreview'], string> = {
	icon: 'Show attribute icon',
	image: 'Show preview image',
};

const WARDROBE_ITEM_REQUIRE_FREE_HANDS_TO_USE_DEFAULT: Record<AccountSettings['wardrobeItemRequireFreeHandsToUseDefault'], string> = {
	useAssetValue: 'Select depending on the item (default)',
	true: 'Always select "Require free hands to use"',
	false: 'Always select "Allow using with blocked hands"',
};

const ITEM_DISPLAY_NAME_TYPE_DESCRIPTION: Record<AccountSettings['wardrobeItemDisplayNameType'], string> = {
	custom: 'Custom name',
	original: 'Original name',
	custom_with_original_in_brackets: 'Custom name (Original name)',
};

function SpaceSearchSettings(): ReactElement {
	return (
		<fieldset>
			<legend>Space search UI</legend>
			<Column gap='large'>
				<ToggleAccountSetting
					setting='alwaysUseSpaceSwitchFlow'
					label={ (
						<Row alignY='center'>
							Always use space switch ready check when moving between spaces
							<ContextHelpButton>
								<p>
									Enabling this setting will always create a space switch confirmation dialog
									when moving from any space (except your personal one) to a different space,<br />
									even if there are no characters following you, which would usually cause the confirmation dialog.
								</p>
								<p>
									This is useful if you want to make sure that you missed nothing happening in your current space,
									while you were looking at the space search.
								</p>
							</ContextHelpButton>
						</Row>
					) }
				/>
			</Column>
		</fieldset>
	);
}

function TutorialSettings(): ReactElement {
	const { tutorialCompleted } = useAccountSettings();
	const confirm = useConfirmDialog();
	const directory = useDirectoryConnector();

	const [clearTutorialsHistory, processing] = useAsyncEvent(async () => {
		if (tutorialCompleted.length === 0)
			return;

		if (!await confirm(
			'Clear the history of completed tutorials',
			<>
				Are you sure you want to reset your tutorial completion progress?<br />
				This will start the introduction tutorial again.
			</>,
		)) {
			return;
		}

		directory.awaitResponse('changeSettings', {
			type: 'reset',
			settings: ['tutorialCompleted'],
		})
			.catch((err: unknown) => {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				GetLogger('changeSettings').error('Failed to update settings:', err);
			});
	}, null);

	return (
		<fieldset>
			<legend>Tutorials</legend>
			<span>You completed { tutorialCompleted.length } of the available tutorials.</span>
			<Button
				onClick={ clearTutorialsHistory }
				disabled={ tutorialCompleted.length === 0 || processing }
				slim
			>
				Reset completed tutorials
			</Button>
		</fieldset>
	);
}
