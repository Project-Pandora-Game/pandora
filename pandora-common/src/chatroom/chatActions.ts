const CHAT_ACTIONS_DEF = {
	//#region Directory (server) messages
	characterEntered: 'SOURCE_CHARACTER entered.',
	characterLeft: 'SOURCE_CHARACTER left.',
	characterDisconnected: 'SOURCE_CHARACTER disconnected.',
	characterKicked: 'TARGET_CHARACTER has been kicked.',
	characterBanned: 'TARGET_CHARACTER has been banned.',

	roomUpdatedSingle: `SOURCE_CHARACTER changed the room's CHANGE.`,
	roomUpdatedMultiple: `SOURCE_CHARACTER changed COUNT room settings:`,
	//#endregion

	//#region Action messages
	itemAdd: `SOURCE_CHARACTER used ITEM_ASSET_NAME on TARGET_CHARACTER_DYNAMIC_SELF.`,
	itemRemove: `SOURCE_CHARACTER removed ITEM_ASSET_NAME_PREVIOUS from TARGET_CHARACTER_DYNAMIC_SELF.`,
	itemReplace: `SOURCE_CHARACTER changed ITEM_ASSET_NAME_PREVIOUS to ITEM_ASSET_NAME on TARGET_CHARACTER_DYNAMIC_SELF.`,
	//#endregion
};

const CHAT_ACTIONS_DEF_FOLDED_EXTRA: Partial<Record<keyof typeof CHAT_ACTIONS_DEF, string>> = {
	roomUpdatedMultiple: `CHANGES`,
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
 *
 *
 * For items:
 *
 * `ITEM_ASSET_NAME`: Name of the asset in question
 * `ITEM_ASSET_NAME_PREVIOUS`: Name of the previous asset
 */
export type ChatActionDictionaryMetaEntry =
	| 'SOURCE_CHARACTER_NAME'
	| 'SOURCE_CHARACTER_ID'
	| 'SOURCE_CHARACTER_PRONOUN'
	| 'SOURCE_CHARACTER_PRONOUN_SELF'
	| 'SOURCE_CHARACTER'
	| 'TARGET_CHARACTER_NAME'
	| 'TARGET_CHARACTER_ID'
	| 'TARGET_CHARACTER_PRONOUN'
	| 'TARGET_CHARACTER_PRONOUN_SELF'
	| 'TARGET_CHARACTER'
	| 'TARGET_CHARACTER_DYNAMIC'
	| 'TARGET_CHARACTER_DYNAMIC_SELF'
	| 'ITEM_ASSET_NAME'
	| 'ITEM_ASSET_NAME_PREVIOUS';

export type ChatActionId = keyof typeof CHAT_ACTIONS_DEF;

export const CHAT_ACTIONS = new Map<ChatActionId, string>(
	Array.from(Object.entries<string>(CHAT_ACTIONS_DEF)) as [ChatActionId, string][],
);

export const CHAT_ACTIONS_FOLDED_EXTRA = new Map<ChatActionId, string>(
	Array.from(Object.entries<string>(CHAT_ACTIONS_DEF_FOLDED_EXTRA)) as [ChatActionId, string][],
);
