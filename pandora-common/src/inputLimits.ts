/* TODO list of things to potentially limit *
- AccountCryptoKeySchema limits (or more thorough validation)
- Room admin list
- Room banned list
- Room owner list
- Room password
- Chatroom chat limits are per-segment
*/

/** The maximum length of an account name */
export const LIMIT_ACCOUNT_NAME_LENGTH = 32;

/** The minimum length of a character name */
export const LIMIT_CHARACTER_NAME_MIN_LENGTH = 3;
/** The maximum length of a character name */
export const LIMIT_CHARACTER_NAME_LENGTH = 32;

/** The maximum length of an e-mail address */
export const LIMIT_MAIL_LENGTH = 256;

/** The maximum length of a room's name */
export const LIMIT_ROOM_NAME_LENGTH = 40;

/** The maximum length of a room's description */
export const LIMIT_ROOM_DESCRIPTION_LENGTH = 10_000;

/** The maximum length of a chat message */
export const LIMIT_CHAT_MESSAGE_LENGTH = 25_000;

/** The maximum length of a direct message (not yet used) */
/** Comment by Sekkmer:
 * Since DMs are encrypted using AES-GCM 256, and then Base64 encoded, whatever character limit we set
 * should be increased by roughly 35-40% at least when checked by directory.
 */
export const LIMIT_DIRECT_MESSAGE_LENGTH = LIMIT_CHAT_MESSAGE_LENGTH;

/** The maximum length of a custom item name (not yet implemented)*/
export const LIMIT_ITEM_NAME_LENGTH = 40;

/** The maximum length of a custom item description (not yet implemented) */
export const LIMIT_ITEM_DESCRIPTION_LENGTH = 1_000;

/** The maximum length of an account profile description (not yet implemented) */
export const LIMIT_ACCOUNT_PROFILE_LENGTH = 5_000;

/** The maximum length of a character profile description (not yet implemented) */
export const LIMIT_CHARACTER_PROFILE_LENGTH = 10_000;

/** The maximum total number of items across all saved outfits */
export const LIMIT_ACCOUNT_OUTFIT_STORAGE_ITEMS = 100;
