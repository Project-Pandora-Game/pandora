const CHAT_ACTIONS_DEF = {
	// Custom action should always provide customText replacement
	custom: '[ ERROR: Custom action without text ]',

	//#region Directory (server) messages
	characterEntered: 'SOURCE_CHARACTER entered.',
	characterLeft: 'SOURCE_CHARACTER left.',
	characterDisconnected: 'SOURCE_CHARACTER disconnected.',
	characterReconnected: 'SOURCE_CHARACTER reconnected.',
	characterKicked: 'TARGET_CHARACTER has been kicked by SOURCE_CHARACTER.',
	characterAutoKicked: `TARGET_CHARACTER left with the help of Pandora's Space Service.`,
	characterBanned: 'TARGET_CHARACTER has been banned by SOURCE_CHARACTER.',

	spaceUpdatedSingle: `SOURCE_CHARACTER changed the spaces's CHANGE.`,
	spaceUpdatedMultiple: `SOURCE_CHARACTER changed COUNT space settings:`,
	//#endregion

	//#region Action messages

	// Action attempts
	actionInterrupted: `SOURCE_CHARACTER interrupted TARGET_CHARACTER_POSSESSIVE attempted action.`,

	// Restriction override changes
	safemodeEnter: `SOURCE_CHARACTER entered safemode!`,
	safemodeLeave: `SOURCE_CHARACTER left safemode.`,
	timeoutEnter: `SOURCE_CHARACTER entered timeout mode!`,
	timeoutLeave: `SOURCE_CHARACTER left timeout mode.`,

	// Item changes directly on character
	itemAdd: `SOURCE_CHARACTER used ITEM_ASSET_NAME on TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,
	itemAddCreate: `SOURCE_CHARACTER created and used ITEM_ASSET_NAME on TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,
	itemRemove: `SOURCE_CHARACTER removed ITEM_ASSET_NAME_PREVIOUS from TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,
	itemRemoveDelete: `SOURCE_CHARACTER removed and deleted ITEM_ASSET_NAME_PREVIOUS from TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,
	itemReplace: `SOURCE_CHARACTER changed ITEM_ASSET_NAME_PREVIOUS to ITEM_ASSET_NAME on TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,

	// Item changes on attachment slots
	itemAttach: `SOURCE_CHARACTER attached ITEM_ASSET_NAME to ITEM_CONTAINER_SIMPLE_DYNAMIC.`,
	itemDetach: `SOURCE_CHARACTER removed ITEM_ASSET_NAME_PREVIOUS from ITEM_CONTAINER_SIMPLE_DYNAMIC.`,

	// Item changes in container slots
	itemStore: `SOURCE_CHARACTER stored ITEM_ASSET_NAME in ITEM_CONTAINER_SIMPLE_DYNAMIC.`,
	itemUnload: `SOURCE_CHARACTER removed ITEM_ASSET_NAME_PREVIOUS from ITEM_CONTAINER_SIMPLE_DYNAMIC.`,

	// Room changes
	roomConfigureBackground: `SOURCE_CHARACTER changed the room's background.`,

	// Room device interaction
	/** User deploys a previously stored device into the room */
	roomDeviceDeploy: `SOURCE_CHARACTER put ITEM_ASSET_NAME into the room.`,
	/** User turns deployed device into stored item */
	roomDeviceStore: `SOURCE_CHARACTER removed ITEM_ASSET_NAME from the room.`,
	/** Character enters into a room device slot */
	roomDeviceSlotEnter: `SOURCE_CHARACTER put TARGET_CHARACTER_DYNAMIC_REFLEXIVE into ITEM_ASSET_NAME.`,
	/** Character leaves from room device slot */
	roomDeviceSlotLeave: `SOURCE_CHARACTER let TARGET_CHARACTER_DYNAMIC_REFLEXIVE out of ITEM_ASSET_NAME.`,
	/** Room admin clears saved character id from slot, while target character is not in the room */
	roomDeviceSlotClear: `SOURCE_CHARACTER freed up ITEM_ASSET_NAME for new usage.`,

	// Character position related
	characterPositionFollowStartLead: `SOURCE_CHARACTER started leading of TARGET_CHARACTER.`,
	characterPositionFollowStopLead: `SOURCE_CHARACTER stopped leading of TARGET_CHARACTER.`,
	characterPositionFollowStartFollow: `SOURCE_CHARACTER started following TARGET_CHARACTER.`,
	characterPositionFollowStopFollow: `SOURCE_CHARACTER stopped following TARGET_CHARACTER.`,

	// Character modifiers
	characterModifierAdd: `SOURCE_CHARACTER added a new "MODIFIER_NAME" modifier on you.`,
	characterModifierRemove: `SOURCE_CHARACTER removed the "MODIFIER_NAME" modifier from you.`,
	characterModifierChange: `SOURCE_CHARACTER changed the configuration of the "MODIFIER_NAME" modifier on you.`,
	characterModifierEnable: `SOURCE_CHARACTER enabled the "MODIFIER_NAME" modifier on you.`,
	characterModifierDisable: `SOURCE_CHARACTER disabled the "MODIFIER_NAME" modifier on you.`,
	characterModifierRename: `SOURCE_CHARACTER renamed your "MODIFIER_NAME_OLD" modifier to "MODIFIER_NAME".`,
	characterModifierReorder: `SOURCE_CHARACTER reordered your character modifiers.`,
	characterModifierLockAdd: `SOURCE_CHARACTER added LOCK_TYPE to the "MODIFIER_NAME" modifier on you.`,
	characterModifierLockRemove: `SOURCE_CHARACTER removed the lock from the "MODIFIER_NAME" modifier on you.`,
	characterModifierLockLock: `SOURCE_CHARACTER locked your "MODIFIER_NAME" modifier.`,
	characterModifierLockUnlock: `SOURCE_CHARACTER unlocked your "MODIFIER_NAME" modifier.`,
	characterModifierLockUpdateFingerprint: `SOURCE_CHARACTER changed the registered fingerprints of the lock on your "MODIFIER_NAME" modifier.`,
	characterModifierLockExceptionsChange: `SOURCE_CHARACTER changed the list of characters who can bypass locks on your "MODIFIER_NAME" modifier.`,

	// Gambling related
	gamblingCoin: `SOURCE_CHARACTER flipped a coin and the result is TOSS_RESULT.`,
	gamblingDice: `SOURCE_CHARACTER rolled DICE_COUNT and the result is DICE_RESULT.`,
	gamblingDiceHidden: `SOURCE_CHARACTER rolled DICE_COUNT secretly.`,
	gamblingDiceHiddenResult: `You rolled DICE_COUNT and the result is DICE_RESULT.`,
	gamblingRockPaperScissorsSet: `SOURCE_CHARACTER is ready to show rock, paper, or scissors when the 'show' command is given.`,
	gamblingRockPaperScissorsResult: `Rock was shown by ROCK_CHARACTERS. Paper was shown by PAPER_CHARACTERS. Scissors were shown by SCISSORS_CHARACTERS.`,
	gamblingCardGameCreation: `SOURCE_CHARACTER created a game of crads. Use 'join' to join the game.`,
	gamblingCardGameAlreadyCreated: 'There is already a game ongoing, hosted by DEALER.',
	gamblingCardGameNoGame: `You have to 'create' a game first, before you can play.`,
	gamblingCardGameJoined: 'SOURCE_CHARACTER joins the game.',
	gamblingCardGameJoinedAlready: 'You are already part of this game.',
	gamblingCardGameDealOpen: 'SOURCE_CHARACTER deals CARD.',
	gamblingCardGameDealPlayerOpen: 'SOURCE_CHARACTER deals CARD to TARGET_CHARACTER.',
	gamblingCardGameDealPlayerSecret: 'SOURCE_CHARACTER deals a card face down to TARGET_CHARACTER.',
	gamblingCardGameDealToYou: 'SOURCE_CHARACTER deals CARD to you.',
	gamblingCardGameHandCheck: 'You are currently holding HAND.',
	gamblingCardGameEnds: 'SOURCE_CHARACTER ends the game and all hands are revealed.',
	gamblingCardGameHandReveal: 'PLAYER shows his hand and reveals HAND.',
	gamblingCardGameRoomCards: 'On the table ISARE HAND.',
	gamblingCardGameEmpty: 'There are no cards left in the deck.',
	gamblingCardGameStopped: 'The current game has been cancelled by SOURCE_CHARACTER.',
	gamblingCardGameNotAllowed: 'Only the dealer is allowed to do this.',
	gamblingCardNotAPlayer: `The given player is not part of the game. Ask them to 'join' first.`,

	// Lock actions
	lockLock: `SOURCE_CHARACTER clicked ITEM_ASSET_NAME on ITEM_CONTAINER_SIMPLE_DYNAMIC shut.`,
	lockUnlock: `SOURCE_CHARACTER unlocked ITEM_ASSET_NAME on ITEM_CONTAINER_SIMPLE_DYNAMIC.`,
	lockUpdateFingerprint: `SOURCE_CHARACTER changed the registered fingerprints of ITEM_ASSET_NAME on ITEM_CONTAINER_SIMPLE_DYNAMIC.`,

	//#endregion
};

const CHAT_ACTIONS_DEF_FOLDED_EXTRA: Partial<Record<keyof typeof CHAT_ACTIONS_DEF, string>> = {
	spaceUpdatedMultiple: `CHANGES`,
};

/**
 * `SOURCE_CHARACTER_NAME`: Name
 *
 * `SOURCE_CHARACTER_ID`: c1
 *
 * `SOURCE_CHARACTER_PRONOUN_SUBJECTIVE`: she/he
 *
 * `SOURCE_CHARACTER_PRONOUN_OBJECTIVE`: her/him
 *
 * `SOURCE_CHARACTER_PRONOUN_POSSESSIVE`: her/his
 *
 * `SOURCE_CHARACTER_PRONOUN_REFLEXIVE`: herself/himself
 *
 * `SOURCE_CHARACTER`: Name (c1)
 *
 * `SOURCE_CHARACTER_POSSESSIVE`: Name's (c1)
 *
 * `TARGET_CHARACTER_NAME`: Name
 *
 * `TARGET_CHARACTER_ID`: c1
 *
 * `TARGET_CHARACTER_PRONOUN_SUBJECTIVE`: she/he
 *
 * `TARGET_CHARACTER_PRONOUN_OBJECTIVE`: her/him
 *
 * `TARGET_CHARACTER_PRONOUN_POSSESSIVE`: her/his
 *
 * `TARGET_CHARACTER_PRONOUN_REFLEXIVE`: herself/himself
 *
 * `TARGET_CHARACTER`: Name (c1)
 *
 * `TARGET_CHARACTER_POSSESSIVE`: Name's (c1)
 *
 *
 * Special cases if target == source: (either name or pronoun)
 *
 * `TARGET_CHARACTER_DYNAMIC_SUBJECTIVE`: Name | she/he
 *
 * `TARGET_CHARACTER_DYNAMIC_OBJECTIVE`: Name | her/him
 *
 * `TARGET_CHARACTER_DYNAMIC_POSSESSIVE`: Name's (c1) | her/his
 *
 * `TARGET_CHARACTER_DYNAMIC_REFLEXIVE`: Name | herself/himself
 *
 * For items:
 *
 * `ITEM_ASSET_NAME`: Name of the asset in question
 * `ITEM_ASSET_NAME_PREVIOUS`: Name of the previous asset
 * `ITEM_CONTAINER_SIMPLE`: Simple description of where the item is located
 * `ITEM_CONTAINER_SIMPLE_DYNAMIC`: Simple description of where the item is located (with name replaced by her(self) if target == source)
 */
export type ChatActionDictionaryMetaEntry =
	| 'SOURCE_CHARACTER_NAME'
	| 'SOURCE_CHARACTER_ID'
	| 'SOURCE_CHARACTER_PRONOUN_SUBJECTIVE'
	| 'SOURCE_CHARACTER_PRONOUN_OBJECTIVE'
	| 'SOURCE_CHARACTER_PRONOUN_POSSESSIVE'
	| 'SOURCE_CHARACTER_PRONOUN_REFLEXIVE'
	| 'SOURCE_CHARACTER'
	| 'SOURCE_CHARACTER_POSSESSIVE'
	| 'TARGET_CHARACTER_NAME'
	| 'TARGET_CHARACTER_ID'
	| 'TARGET_CHARACTER_PRONOUN_SUBJECTIVE'
	| 'TARGET_CHARACTER_PRONOUN_OBJECTIVE'
	| 'TARGET_CHARACTER_PRONOUN_POSSESSIVE'
	| 'TARGET_CHARACTER_PRONOUN_REFLEXIVE'
	| 'TARGET_CHARACTER'
	| 'TARGET_CHARACTER_POSSESSIVE'
	| 'TARGET_CHARACTER_DYNAMIC_SUBJECTIVE'
	| 'TARGET_CHARACTER_DYNAMIC_OBJECTIVE'
	| 'TARGET_CHARACTER_DYNAMIC_POSSESSIVE'
	| 'TARGET_CHARACTER_DYNAMIC_REFLEXIVE'
	| 'ITEM_ASSET_NAME'
	| 'ITEM_ASSET_NAME_PREVIOUS'
	| 'ITEM_CONTAINER_SIMPLE'
	| 'ITEM_CONTAINER_SIMPLE_DYNAMIC';

export type ChatActionId = keyof typeof CHAT_ACTIONS_DEF;

export const CHAT_ACTIONS = new Map<ChatActionId, string>(
	Array.from(Object.entries<string>(CHAT_ACTIONS_DEF)) as [ChatActionId, string][],
);

export const CHAT_ACTIONS_FOLDED_EXTRA = new Map<ChatActionId, string>(
	Array.from(Object.entries<string>(CHAT_ACTIONS_DEF_FOLDED_EXTRA)) as [ChatActionId, string][],
);
