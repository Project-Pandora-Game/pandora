import { z } from 'zod';
import { TimeSpanMs } from '../utility/formatting';
import { EMPTY_ARRAY, KnownObject, ParseArrayNotEmpty } from '../utility/misc';
import { DisplayNameSchema, HexColorStringSchema } from '../validation';
import { AccountRoleSchema } from './accountRoles';
import { TutorialIdSchema } from './tutorials';

//#region Settings declarations

const ItemDisplayNameTypeSchema = z.enum(['original', 'custom', 'custom_with_original_in_brackets']);
export type ItemDisplayNameType = z.infer<typeof ItemDisplayNameTypeSchema>;

export const AccountSettingsSchema = z.object({
	visibleRoles: z.array(AccountRoleSchema).max(AccountRoleSchema.options.length),
	labelColor: HexColorStringSchema,
	displayName: DisplayNameSchema.nullable(),
	/** Hides online status from friends */
	hideOnlineStatus: z.boolean(),
	/**
	 * - 'all' - Allow direct messages from anyone
	 * - 'space' - Allow direct messages from friends and people in the same space
	 * - 'friends' - Only allow direct messages from friends
	 */
	allowDirectMessagesFrom: z.enum(['all', 'space', 'friends']).catch('all'),
	/**
	 * Controls whether to show extra quick actions in wardrobe
	 * (actions that are doable with multiple clicks even without this button, but the button allows doing them as single click)
	 */
	wardrobeExtraActionButtons: z.boolean(),
	/**
	 * Controls whether to show character preview when hovering over an action button.
	 * (when action is possible the character preview shows the result state while hovering)
	 */
	wardrobeHoverPreview: z.boolean(),
	/**
	 * If outfits tab should generate previews for outfits and if the previews should be small or big.
	 */
	wardrobeOutfitsPreview: z.enum(['disabled', 'small', 'big']),
	/**
	 * Controls whether to show the attribute icons or preview images in small preview.
	 */
	wardrobeSmallPreview: z.enum(['icon', 'image']),
	/**
	 * Controls whether to show the attribute icons or preview images in big preview.
	 */
	wardrobeBigPreview: z.enum(['icon', 'image']),
	/**
	 * Controls how item names appear in wardrobe
	 */
	wardrobeItemDisplayNameType: ItemDisplayNameTypeSchema,
	/**
	 * Accent color for the interface
	 */
	interfaceAccentColor: HexColorStringSchema,
	/**
	 * Controls how many parts (of 10 total) the room graphics takes, while in horizontal mode
	 */
	interfaceChatroomGraphicsRatioHorizontal: z.number().int().min(1).max(9),
	/**
	 * Controls how many parts (of 10 total) the room graphics takes, while in vertical mode
	 */
	interfaceChatroomGraphicsRatioVertical: z.number().int().min(1).max(9),
	/**
	 * Controls how offline characters are displayed in a room:
	 * - None: No difference between online and offline characters
	 * - Icon: Show disconnected icon under the name (not shown on other options)
	 * - Darken: The characters are darkened (similar to blindness)
	 * - Ghost: Darken + semi-transparent
	 */
	interfaceChatroomOfflineCharacterFilter: z.enum(['none', 'icon', 'darken', 'ghost']),
	/**
	 * Controls how big the font size used in the main chat area is
	 */
	interfaceChatroomChatFontSize: z.enum(['xs', 's', 'm', 'l', 'xl']),
	/**
	 * Controls how big the font size used for the name of the character is
	 */
	interfaceChatroomCharacterNameFontSize: z.enum(['xs', 's', 'm', 'l', 'xl']),
	/** Controls how item names appear in chat action messages */
	interfaceChatroomItemDisplayNameType: ItemDisplayNameTypeSchema,
	/**
	 * Sets what sound should be played, when someone enters the room
	 * @default ''
	 */
	notificationRoomEntrySound: z.enum(['', 'alert', 'bell', 'bing', 'dingding']),
	/**
	 * Volume of the notification. Stored as int, but will be divided by 100 later
	 * @default 100
	 */
	notificationVolume: z.enum(['0', '25', '50', '75', '100']),
	/**
	 * Set of tutorials the user completed in the past. Should only contain unique values (optimally sorted by the order in the schema).
	 */
	tutorialCompleted: TutorialIdSchema.array().max(TutorialIdSchema.options.length).readonly(),
});

export type AccountSettings = z.infer<typeof AccountSettingsSchema>;

export const ACCOUNT_SETTINGS_DEFAULT = Object.freeze<AccountSettings>({
	visibleRoles: [],
	labelColor: '#ffffff',
	displayName: null,
	hideOnlineStatus: false,
	allowDirectMessagesFrom: 'all',
	wardrobeExtraActionButtons: true,
	wardrobeHoverPreview: true,
	wardrobeOutfitsPreview: 'small',
	wardrobeSmallPreview: 'image',
	wardrobeBigPreview: 'image',
	wardrobeItemDisplayNameType: 'custom_with_original_in_brackets',
	interfaceAccentColor: '#3daee9',
	interfaceChatroomGraphicsRatioHorizontal: 7,
	interfaceChatroomGraphicsRatioVertical: 4,
	interfaceChatroomOfflineCharacterFilter: 'ghost',
	interfaceChatroomChatFontSize: 'm',
	interfaceChatroomCharacterNameFontSize: 'm',
	interfaceChatroomItemDisplayNameType: 'custom_with_original_in_brackets',
	notificationRoomEntrySound: '',
	notificationVolume: '100',
	tutorialCompleted: EMPTY_ARRAY,
});

export const ACCOUNT_SETTINGS_LIMITED_LIMITS = Object.freeze({
	displayName: TimeSpanMs(1, 'weeks'),
} as const satisfies Partial<Record<keyof AccountSettings, number>>);

//#endregion

export const AccountSettingsKeysSchema = z.enum(ParseArrayNotEmpty(KnownObject.keys(AccountSettingsSchema.shape)));
export type AccountSettingsKeys = z.infer<typeof AccountSettingsKeysSchema>;

export const AccountSettingsLimitedKeysSchema = z.enum(ParseArrayNotEmpty(KnownObject.keys(ACCOUNT_SETTINGS_LIMITED_LIMITS)));
export type AccountSettingsLimitedKeys = z.infer<typeof AccountSettingsLimitedKeysSchema>;

export const AccountSettingsCooldownsSchema = z.record(AccountSettingsLimitedKeysSchema, z.number().optional());
export type AccountSettingsCooldowns = z.infer<typeof AccountSettingsCooldownsSchema>;
