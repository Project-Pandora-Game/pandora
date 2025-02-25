import { range } from 'lodash';
import { ACCOUNT_SETTINGS_DEFAULT, AccountSettings, AccountSettingsSchema, GetLogger, type HexColorString } from 'pandora-common';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { z } from 'zod';
import { useAsyncEvent } from '../../common/useEvent';
import { LIVE_UPDATE_THROTTLE } from '../../config/Environment';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { useAccountSettings, useCurrentAccount, useModifiedAccountSettings } from '../../services/accountLogic/accountManagerHooks';
import { Button } from '../common/button/button';
import { ColorInput } from '../common/colorInput/colorInput';
import { Column, Row } from '../common/container/container';
import { SelectionIndicator } from '../common/selectionIndicator/selectionIndicator';
import { useConfirmDialog } from '../dialog/dialog';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { SelectAccountSettings, ToggleAccountSetting } from './helpers/accountSettings';
import { SelectSettingInput } from './helpers/settingsInputs';

export function InterfaceSettings(): ReactElement | null {
	const account = useCurrentAccount();

	if (!account)
		return <>Not logged in</>;

	return (
		<>
			<ThemeSettings />
			<ChatroomSettings />
			<WardrobeSettings />
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
		directory.awaitResponse('changeSettings', {
			type: 'set',
			settings: { [s]: newValue },
		})
			.catch((err: unknown) => {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				GetLogger('changeSettings').error('Failed to update settings:', err);
			});
	};

	const onReset = (s: 'interfaceChatroomGraphicsRatioHorizontal' | 'interfaceChatroomGraphicsRatioVertical') => {
		directory.awaitResponse('changeSettings', {
			type: 'reset',
			settings: [s],
		})
			.catch((err: unknown) => {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				GetLogger('changeSettings').error('Failed to update settings:', err);
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
			<SelectAccountSettings setting='wardrobeItemRequireFreeHandsToUseDefault' label='Bound usage pre-selection when creating new items' stringify={ WARDROBE_ITEM_REQUIRE_FREE_HANDS_TO_USE_DEFAULT } />
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
