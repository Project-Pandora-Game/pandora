import { z } from 'zod';
import { AccountRoleSchema } from './accountRoles';
import { KnownObject, ParseArrayNotEmpty, TimeSpanMs } from '../utility';
import { DisplayNameSchema, HexColorStringSchema } from '../validation';

export const DirectoryAccountSettingsSchema = z.object({
	visibleRoles: z.array(AccountRoleSchema).max(AccountRoleSchema.options.length),
	labelColor: HexColorStringSchema.catch('#ffffff'),
	displayName: DisplayNameSchema.nullable().catch(null),
	/** Hides online status from friends */
	hideOnlineStatus: z.boolean().default(false),
	/**
	 * - 'all' - Allow direct messages from anyone
	 * - 'room' - Allow direct messages from friends and people in the same space | TODO(spaces): Update?
	 * - 'friends' - Only allow direct messages from friends
	 */
	allowDirectMessagesFrom: z.enum(['all', 'room', 'friends']).default('all'),
	/**
	 * Controls whether to show extra quick actions in wardrobe
	 * (actions that are doable with multiple clicks even without this button, but the button allows doing them as single click)
	 */
	wardrobeExtraActionButtons: z.boolean().catch(true),
	/**
	 * Controls whether to show character preview when hovering over an action button.
	 * (when action is possible the character preview shows the result state while hovering)
	 */
	wardrobeHoverPreview: z.boolean().catch(true),
	/**
	 * If outfits tab should generate previews for outfits and if the previews should be small or big.
	 */
	wardrobeOutfitsPreview: z.enum(['disabled', 'small', 'big']).default('small'),
	// TODO(spaces): Consider dropping this option, it might no longer be needed
	/**
	 * Color to use as wardrobe character preview background, unless room background is used (see `wardrobeUseRoomBackground` setting).
	 */
	wardrobeBackground: HexColorStringSchema.catch('#aaaaaa'),
	// TODO(spaces): Consider dropping this option, it might no longer be needed
	/**
	 * Controls whether wardrobe should use the room's background, if character is in a room.
	 * If character is not in the room, or if this is `false`, then `wardrobeBackground` setting is used.
	 */
	wardrobeUseRoomBackground: z.boolean().catch(true),
	/**
	 * Controls whether to show the attribute icons or preview images in small preview.
	 */
	wardrobeSmallPreview: z.enum(['icon', 'image']).default('image'),
	/**
	 * Controls whether to show the attribute icons or preview images in big preview.
	 */
	wardrobeBigPreview: z.enum(['icon', 'image']).default('image'),
	/**
	 * Controls how many parts (of 10 total) the room graphics takes, while in horizontal mode
	 */
	interfaceChatroomGraphicsRatioHorizontal: z.number().int().min(1).max(9).catch(7),
	/**
	 * Controls how many parts (of 10 total) the room graphics takes, while in vertical mode
	 */
	interfaceChatroomGraphicsRatioVertical: z.number().int().min(1).max(9).catch(4),
	/**
	 * Controls how offline characters are displayed in a room:
	 * - None: No difference between online and offline characters
	 * - Icon: Show disconnected icon under the name (not shown on other options)
	 * - Darken: The characters are darkened (similar to blindness)
	 * - Ghost: Darken + semi-transparent
	 */
	interfaceChatroomOfflineCharacterFilter: z.enum(['none', 'icon', 'darken', 'ghost']).default('ghost'),
	/**
	 * Controls how big the font size used in the main chat area is
	 */
	interfaceChatroomChatFontSize: z.enum(['xs', 's', 'm', 'l', 'xl']).default('m'),
});

export type IDirectoryAccountSettings = z.infer<typeof DirectoryAccountSettingsSchema>;

export const ACCOUNT_SETTINGS_DEFAULT = Object.freeze<IDirectoryAccountSettings>({
	visibleRoles: [],
	labelColor: '#ffffff',
	displayName: null,
	hideOnlineStatus: false,
	allowDirectMessagesFrom: 'all',
	wardrobeExtraActionButtons: true,
	wardrobeBackground: '#aaaaaa',
	wardrobeUseRoomBackground: true,
	wardrobeHoverPreview: true,
	wardrobeOutfitsPreview: 'small',
	wardrobeSmallPreview: 'image',
	wardrobeBigPreview: 'image',
	interfaceChatroomGraphicsRatioHorizontal: 7,
	interfaceChatroomGraphicsRatioVertical: 4,
	interfaceChatroomOfflineCharacterFilter: 'ghost',
	interfaceChatroomChatFontSize: 'm',
});

export const ACCOUNT_SETTINGS_LIMITED_LIMITS = Object.freeze({
	displayName: TimeSpanMs(1, 'weeks'),
} as const satisfies Partial<Record<keyof IDirectoryAccountSettings, number>>);

export const DirectoryAccountSettingsLimitedKeysSchema = z.enum(ParseArrayNotEmpty(KnownObject.keys(ACCOUNT_SETTINGS_LIMITED_LIMITS)));
export type DirectoryAccountSettingsLimitedKeys = z.infer<typeof DirectoryAccountSettingsLimitedKeysSchema>;

export const DirectoryAccountSettingsCooldownsSchema = z.record(DirectoryAccountSettingsLimitedKeysSchema, z.number().optional());
export type DirectoryAccountSettingsCooldowns = z.infer<typeof DirectoryAccountSettingsCooldownsSchema>;

