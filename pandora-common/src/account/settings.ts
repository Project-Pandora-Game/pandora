import * as z from 'zod';
import { ClientNotificationGlobalSettingsSchema } from '../client/notificationDefinition.ts';
import { NotificationTypesSettingsSchema } from '../client/notifications.ts';
import { SpaceRoleOrNoneSchema } from '../space/spaceRoles.ts';
import { TimeSpanMs } from '../utility/formatting.ts';
import { EMPTY_ARRAY, KnownObject, ParseArrayNotEmpty } from '../utility/misc.ts';
import { DisplayNameSchema, HexColorStringSchema } from '../validation.ts';
import { AccountRoleSchema } from './accountRoles.ts';
import { AccountOnlineStatusSchema } from './contacts.ts';
import { TutorialIdSchema } from './tutorials.ts';

//#region Settings declarations

const ItemDisplayNameTypeSchema = z.enum(['original', 'custom', 'custom_with_original_in_brackets']);
export type ItemDisplayNameType = z.infer<typeof ItemDisplayNameTypeSchema>;

/**
 * Determines how hidden a character should be
 * Options are:
 * - `normal` - show character normally
 * - `ghost` - show as a ghost (darken + semi-transparent)
 * - `silhouette` - show only silhouette (fully black tint and mostly transparent)
 * - `name-only` - show only name
 * - `hidden` - do not show at all in the room
 */
export const CharacterHideSettingSchema = z.enum(['normal', 'ghost', 'silhouette', 'name-only', 'hidden']);
export type CharacterHideSetting = z.infer<typeof CharacterHideSettingSchema>;

export const AccountSettingsSchema = z.object({
	visibleRoles: z.array(AccountRoleSchema).max(AccountRoleSchema.options.length),
	labelColor: HexColorStringSchema,
	displayName: DisplayNameSchema.nullable(),
	onlineStatus: AccountOnlineStatusSchema,
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
	 * Show previews for poses
	 */
	wardrobePosePreview: z.boolean(),
	/**
	 * Sets the default category selection in the posing tab.
	 */
	wardrobePosingCategoryDefault: z.enum(['custom', 'basic', 'manual']),
	/**
	 * Controls how item names appear in wardrobe
	 */
	wardrobeItemDisplayNameType: ItemDisplayNameTypeSchema,
	/**
	 * Controls the bound usage default of newly created items
	 */
	wardrobeItemRequireFreeHandsToUseDefault: z.enum(['useAssetValue', 'true', 'false']),
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
	 * Split the controls between "Room"/"Pose"/"Expressions" when Pandora is in landscape orientation, if the screen is big enough
	 */
	interfaceChatroomChatSplitHorizontal: z.enum(['disabled', 'horizontal', 'vertical']),
	/**
	 * Split the controls between "Room"/"Pose"/"Expressions" when Pandora is in portrait orientation, if the screen is big enough
	 */
	interfaceChatroomChatSplitVertical: z.enum(['disabled', 'horizontal', 'vertical']),
	/**
	 * Controls how offline characters are displayed in a room.
	 *
	 * Offers all options from `CharacterHideSetting` and in addition:
	 * - Icon: Show disconnected icon under the name (not shown on other options)
	 * - Darken: The characters are darkened (similar to blindness)
	 */
	interfaceChatroomOfflineCharacterFilter: z.preprocess((v) => {
		if (v === 'none')
			return 'normal';

		return v;
	}, CharacterHideSettingSchema.or(z.enum(['icon', 'darken']))),
	/**
	 * Controls how characters from blocked accounts are displayed in a room, by default.
	 */
	interfaceChatroomBlockedCharacterFilter: CharacterHideSettingSchema,
	/**
	 * Controls how big the font size used in the main chat area is
	 */
	interfaceChatroomChatFontSize: z.enum(['xs', 's', 'm', 'l', 'xl']),
	/**
	 * Controls how big the font size used for the name of the character is
	 */
	interfaceChatroomCharacterNameFontSize: z.enum(['xs', 's', 'm', 'l', 'xl']),
	/**
	 * Controls if the away status icon shall be shown under the name of characters on the canvas
	 */
	interfaceChatroomCharacterAwayStatusIconDisplay: z.boolean(),
	/** Controls how item names appear in chat action messages */
	interfaceChatroomItemDisplayNameType: ItemDisplayNameTypeSchema,
	/** Hides room descriptions by default for spaces where the player is at least this role. */
	interfaceChatroomHideRoomDescriptionsRole: SpaceRoleOrNoneSchema,
	/**
	 * What style of posing elements should be displayed.
	 * - `inverse` - Only inverse kinematics helpers should be shown
	 * - `forward` - Only direct bone manipulation helpers should be shown
	 * - `both` - Both variants should be shown
	 */
	interfacePosingStyle: z.enum(['inverse', 'forward', 'both']),
	/**
	 * How should command autocomplete behave.
	 * - `always-show` - The help is always shown while typing a command
	 * - `on-tab` The help is shown only when explicitly requested by pressing Tab
	 */
	chatCommandHintBehavior: z.enum(['always-show', 'on-tab']),
	/**
	 * How many most recent messages to show in chat at the same time, for performance reason.
	 * Setting this to `null` disables the limit.
	 */
	chatMaxShownMessages: z.int().positive().nullable(),
	/**
	 * If set, the "space switch flow" (`SpaceSwitchStatus`) will always be used when moving from one space to another,
	 * even if not inviting anyone along.
	 */
	alwaysUseSpaceSwitchFlow: z.boolean(),
	notificationGlobalSettings: ClientNotificationGlobalSettingsSchema,
	notificationTypeSettings: NotificationTypesSettingsSchema,
	/**
	 * Forces the interface to use system colors (emulating `@media (forced-colors: active)`)
	 */
	accessibilityForceSystemColors: z.boolean(),
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
	onlineStatus: 'online',
	allowDirectMessagesFrom: 'all',
	wardrobeExtraActionButtons: true,
	wardrobeHoverPreview: true,
	wardrobeOutfitsPreview: 'small',
	wardrobeSmallPreview: 'image',
	wardrobeBigPreview: 'image',
	wardrobePosePreview: true,
	wardrobePosingCategoryDefault: 'custom',
	wardrobeItemDisplayNameType: 'custom',
	wardrobeItemRequireFreeHandsToUseDefault: 'useAssetValue',
	interfaceAccentColor: '#3daee9',
	interfaceChatroomGraphicsRatioHorizontal: 7,
	interfaceChatroomGraphicsRatioVertical: 4,
	interfaceChatroomChatSplitHorizontal: 'disabled',
	interfaceChatroomChatSplitVertical: 'disabled',
	interfaceChatroomOfflineCharacterFilter: 'ghost',
	interfaceChatroomBlockedCharacterFilter: 'silhouette',
	interfaceChatroomChatFontSize: 'm',
	interfaceChatroomCharacterNameFontSize: 'm',
	interfaceChatroomCharacterAwayStatusIconDisplay: true,
	interfaceChatroomItemDisplayNameType: 'custom',
	interfaceChatroomHideRoomDescriptionsRole: 'admin',
	interfacePosingStyle: 'inverse',
	chatCommandHintBehavior: 'always-show',
	chatMaxShownMessages: 100,
	alwaysUseSpaceSwitchFlow: false,
	notificationGlobalSettings: {
		sound: {
			sound: '',
			volume: 100,
		},
		usePlatformPopup: false,
	},
	notificationTypeSettings: {},
	accessibilityForceSystemColors: false,
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

export const AccountSettingsCooldownsSchema = z.partialRecord(AccountSettingsLimitedKeysSchema, z.number().optional());
export type AccountSettingsCooldowns = z.infer<typeof AccountSettingsCooldownsSchema>;
