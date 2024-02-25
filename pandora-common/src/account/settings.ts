import { z } from 'zod';
import { AccountRoleSchema } from './accountRoles';
import { KnownObject, ParseArrayNotEmpty, TimeSpanMs } from '../utility';
import { DisplayNameSchema, HexColorStringSchema } from '../validation';

//#region Settings declarations

export const AccountSettingsSchema = z.object({
	visibleRoles: z.array(AccountRoleSchema).max(AccountRoleSchema.options.length),
	labelColor: HexColorStringSchema,
	displayName: DisplayNameSchema.nullable(),
	/** Hides online status from friends */
	hideOnlineStatus: z.boolean(),
	/**
	 * - 'all' - Allow direct messages from anyone
	 * - 'room' - Allow direct messages from friends and people in the same space | TODO(spaces): Update?
	 * - 'friends' - Only allow direct messages from friends
	 */
	allowDirectMessagesFrom: z.enum(['all', 'room', 'friends']),
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
	// TODO(spaces): Consider dropping this option, it might no longer be needed
	/**
	 * Color to use as wardrobe character preview background, unless room background is used (see `wardrobeUseRoomBackground` setting).
	 */
	wardrobeBackground: HexColorStringSchema,
	// TODO(spaces): Consider dropping this option, it might no longer be needed
	/**
	 * Controls whether wardrobe should use the room's background, if character is in a room.
	 * If character is not in the room, or if this is `false`, then `wardrobeBackground` setting is used.
	 */
	wardrobeUseRoomBackground: z.boolean(),
	/**
	 * Controls whether to show the attribute icons or preview images in small preview.
	 */
	wardrobeSmallPreview: z.enum(['icon', 'image']),
	/**
	 * Controls whether to show the attribute icons or preview images in big preview.
	 */
	wardrobeBigPreview: z.enum(['icon', 'image']),
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
	wardrobeBackground: '#aaaaaa',
	wardrobeUseRoomBackground: true,
	wardrobeSmallPreview: 'image',
	wardrobeBigPreview: 'image',
	interfaceChatroomGraphicsRatioHorizontal: 7,
	interfaceChatroomGraphicsRatioVertical: 4,
	interfaceChatroomOfflineCharacterFilter: 'ghost',
	interfaceChatroomChatFontSize: 'm',
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
