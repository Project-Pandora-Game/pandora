/* TODO list of things to potentially limit *
- AccountCryptoKeySchema limits (or more thorough validation)
- Space admin list
- Space banned list
- Space owner list
- Chat limits are per-segment
*/

/** The maximum length of an account name */
export const LIMIT_ACCOUNT_NAME_LENGTH = 32;

/** Character limit for an account */
export const LIMIT_CHARACTER_COUNT = 5;

/** The minimum length of a character name */
export const LIMIT_CHARACTER_NAME_MIN_LENGTH = 3;
/** The maximum length of a character name */
export const LIMIT_CHARACTER_NAME_LENGTH = 32;

/** The maximum length of an e-mail address */
export const LIMIT_MAIL_LENGTH = 256;

/** Space ownership limit for an account */
export const LIMIT_SPACE_OWNED_COUNT = 5;

/** The maximum amount of characters inside a space */
export const LIMIT_SPACE_MAX_CHARACTER_NUMBER = 100;
/** The extra slots reserved for space owners */
export const LIMIT_SPACE_MAX_CHARACTER_EXTRA_OWNERS = 5;

/** The maximum length of a space's name */
export const LIMIT_SPACE_NAME_LENGTH = 48;
/** The pattern used for validating space's name */
export const LIMIT_SPACE_NAME_PATTERN = /^[a-zA-Z0-9_+\-:'"& ]+$/;

/** The maximum length of a spaces's description */
export const LIMIT_SPACE_DESCRIPTION_LENGTH = 10_000;

/** The maximum length of a spaces's entry text */
export const LIMIT_SPACE_ENTRYTEXT_LENGTH = 10_000;

/** The maximum length of a chat message */
export const LIMIT_CHAT_MESSAGE_LENGTH = 25_000;

/** The maximum length of a direct message
 *
 * Since DMs are encrypted using AES-GCM 256, and then Base64 encoded, whatever character limit we set
 * should be increased by roughly 35-40% at least when checked by directory.
 */
export const LIMIT_DIRECT_MESSAGE_LENGTH = 2500;
export const LIMIT_DIRECT_MESSAGE_LENGTH_BASE64 = LIMIT_DIRECT_MESSAGE_LENGTH * 1.4;

export const LIMIT_DIRECT_MESSAGE_STORE_COUNT = 50;

/** The maximum length of a custom item name */
export const LIMIT_ITEM_NAME_LENGTH = 48;
/** The pattern used for validating item custom names */
export const LIMIT_ITEM_NAME_PATTERN = /^[a-zA-Z0-9_\- ']*$/;

/** The maximum length of a custom item description */
export const LIMIT_ITEM_DESCRIPTION_LENGTH = 1_000;

/** The maximum length of an account profile description */
export const LIMIT_ACCOUNT_PROFILE_LENGTH = 5_000;

/** The maximum length of a character profile description */
export const LIMIT_CHARACTER_PROFILE_LENGTH = 10_000;

/** The maximum size of character preview */
export const LIMIT_CHARACTER_PREVIEW_SIZE = 10 * 1024; // 10kb

/** The maximum length of an outfit name */
export const LIMIT_OUTFIT_NAME_LENGTH = 48;

/** The maximum length of a pose preset name */
export const LIMIT_POSE_PRESET_NAME_LENGTH = LIMIT_OUTFIT_NAME_LENGTH;
/** The maximum number of pose presets an account can have */
export const LIMIT_ACCOUNT_POSE_PRESET_STORAGE = 20;

/** The maximum amount of invites a space can have */
export const LIMIT_SPACE_BOUND_INVITES = 20;
export const LIMIT_JOIN_ME_INVITES = 10;

/** The maximum number of character modifier instances on a single character */
export const LIMIT_CHARACTER_MODIFIER_INSTANCE_COUNT = 100;
/** The maximum length of a custom character modifier name */
export const LIMIT_CHARACTER_MODIFIER_NAME_LENGTH = 48;
/** The maximum amount of characters that can be specified in a character list configuration type of a character modifier. */
export const LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT = 50;
/** The maximum amount of conditions inside a single character modifier instance. */
export const LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT = 50;
