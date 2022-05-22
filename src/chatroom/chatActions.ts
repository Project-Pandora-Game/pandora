const CHAT_ACTIONS_DEF = {
	characterEntered: 'SOURCE_CHARACTER entered.',
	characterLeft: 'SOURCE_CHARACTER left.',
	characterDisconnected: 'SOURCE_CHARACTER disconnected.',
	characterKicked: 'TARGET_CHARACTER has been kicked.',
	characterBanned: 'TARGET_CHARACTER has been banned.',
};

/**
 * `SOURCE_CHARACTER_NAME`: Name
 *
 * `SOURCE_CHARACTER_ID`: c1
 *
 * `SOURCE_CHARACTER_PRONOUN`: her
 *
 * `SOURCE_CHARACTER_PRONOUN_SELF`: herself
 *
 * `SOURCE_CHARACTER`: Name (c1)
 *
 *
 * `TARGET_CHARACTER_NAME`: Name
 *
 * `TARGET_CHARACTER_ID`: c1
 *
 * `TARGET_CHARACTER_PRONOUN`: her
 *
 * `TARGET_CHARACTER_PRONOUN_SELF`: herself
 *
 * `TARGET_CHARACTER`: Name (c1)
 *
 *
 * Special cases if target == source:
 *
 * `TARGET_CHARACTER_DYNAMIC`: Name's (c1) | her
 *
 * `TARGET_CHARACTER_DYNAMIC_SELF`: Name (c1) | herself
 */
export type ChatActionDictionaryMetaEntry =
	'SOURCE_CHARACTER_NAME' |
	'SOURCE_CHARACTER_ID' |
	'SOURCE_CHARACTER_PRONOUN' |
	'SOURCE_CHARACTER_PRONOUN_SELF' |
	'SOURCE_CHARACTER' |
	'TARGET_CHARACTER_NAME' |
	'TARGET_CHARACTER_ID' |
	'TARGET_CHARACTER_PRONOUN' |
	'TARGET_CHARACTER_PRONOUN_SELF' |
	'TARGET_CHARACTER' |
	'TARGET_CHARACTER_DYNAMIC' |
	'TARGET_CHARACTER_DYNAMIC_SELF';

export type ChatActionId = keyof typeof CHAT_ACTIONS_DEF;

export const CHAT_ACTIONS = new Map<ChatActionId, string>(
	Array.from(Object.entries<string>(CHAT_ACTIONS_DEF)) as [ChatActionId, string][],
);
