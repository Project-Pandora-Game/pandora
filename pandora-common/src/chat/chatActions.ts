import type { Immutable } from 'immer';
import * as z from 'zod';
import type { ActionHandlerMessage, AssetFrameworkGlobalState } from '../assets/index.ts';
import { AssertNever } from '../utility/misc.ts';
import { RecordUnpackSubobjectProperties } from '../validation.ts';

const CHAT_ACTIONS_DEF = {
	//#region Directory (server) messages
	characterEntered: {
		type: 'system',
		message: 'SOURCE_CHARACTER entered.',
	},
	characterLeft: {
		type: 'system',
		message: 'SOURCE_CHARACTER left.',
	},
	characterDisconnected: {
		type: 'system',
		message: 'SOURCE_CHARACTER disconnected.',
	},
	characterReconnected: {
		type: 'system',
		message: 'SOURCE_CHARACTER reconnected.',
	},
	characterKicked: {
		type: 'system',
		message: 'TARGET_CHARACTER has been kicked by SOURCE_CHARACTER.',
	},
	characterAutoKicked: {
		type: 'system',
		message: `TARGET_CHARACTER left with the help of Pandora's Space Service.`,
	},
	characterBanned: {
		type: 'system',
		message: 'TARGET_CHARACTER has been banned by SOURCE_CHARACTER.',
	},

	spaceEntryText: {
		type: 'system',
		message: 'SPACE_ENTRY_TEXT',
	},

	spaceUpdatedSingle: {
		type: 'system',
		message: `SOURCE_CHARACTER changed the spaces's CHANGE.`,
	},
	spaceUpdatedMultiple: {
		type: 'system',
		message: `SOURCE_CHARACTER changed COUNT space settings:`,
	},
	//#endregion

	//#region Action messages

	// Action attempts
	actionInterrupted: {
		type: 'important',
		message: `SOURCE_CHARACTER interrupted TARGET_CHARACTER_POSSESSIVE attempted action.`,
	},

	// Restriction override changes
	safemodeEnter: {
		type: 'important',
		message: `SOURCE_CHARACTER entered safemode!`,
	},
	safemodeLeave: {
		type: 'important',
		message: `SOURCE_CHARACTER left safemode.`,
	},
	timeoutEnter: {
		type: 'important',
		message: `SOURCE_CHARACTER entered timeout mode!`,
	},
	timeoutLeave: {
		type: 'important',
		message: `SOURCE_CHARACTER left timeout mode.`,
	},

	// Item changes directly on character
	itemAdd: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER used ITEM_ASSET_NAME on TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,
	},
	itemAddCreate: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER created and used ITEM_ASSET_NAME on TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,
	},
	itemRemove: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER removed ITEM_ASSET_NAME_PREVIOUS from TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,
	},
	itemRemoveDelete: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER removed and deleted ITEM_ASSET_NAME_PREVIOUS from TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,
	},
	itemReplace: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER changed ITEM_ASSET_NAME_PREVIOUS to ITEM_ASSET_NAME on TARGET_CHARACTER_DYNAMIC_REFLEXIVE.`,
	},

	// Item changes on attachment slots
	itemAttach: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER attached ITEM_ASSET_NAME to ITEM_CONTAINER_SIMPLE_DYNAMIC.`,
	},
	itemDetach: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER removed ITEM_ASSET_NAME_PREVIOUS from ITEM_CONTAINER_SIMPLE_DYNAMIC.`,
	},

	// Item changes in container slots
	itemStore: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER stored ITEM_ASSET_NAME in ITEM_CONTAINER_SIMPLE_DYNAMIC.`,
	},
	itemUnload: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER removed ITEM_ASSET_NAME_PREVIOUS from ITEM_CONTAINER_SIMPLE_DYNAMIC.`,
	},

	// Room device interaction
	/** User deploys a previously stored device into the room */
	roomDeviceDeploy: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER put ITEM_ASSET_NAME into the room.`,
	},
	/** User turns deployed device into stored item */
	roomDeviceStore: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER removed ITEM_ASSET_NAME from the room.`,
	},
	/** Character enters into a room device slot */
	roomDeviceSlotEnter: {
		type: 'characterMovement',
		message: `SOURCE_CHARACTER put TARGET_CHARACTER_DYNAMIC_REFLEXIVE into ITEM_ASSET_NAME.`,
	},
	/** Character leaves from room device slot */
	roomDeviceSlotLeave: {
		type: 'characterMovement',
		message: `SOURCE_CHARACTER let TARGET_CHARACTER_DYNAMIC_REFLEXIVE out of ITEM_ASSET_NAME.`,
	},
	/** Room admin clears saved character id from slot, while target character is not in the room */
	roomDeviceSlotClear: {
		type: 'itemInteraction',
		message: `SOURCE_CHARACTER freed up ITEM_ASSET_NAME for new usage.`,
	},

	// Character position related
	characterPositionFollowStartLead: {
		type: 'characterMovement',
		message: `SOURCE_CHARACTER started leading of TARGET_CHARACTER.`,
	},
	characterPositionFollowStopLead: {
		type: 'characterMovement',
		message: `SOURCE_CHARACTER stopped leading of TARGET_CHARACTER.`,
	},
	characterPositionFollowStartFollow: {
		type: 'characterMovement',
		message: `SOURCE_CHARACTER started following TARGET_CHARACTER.`,
	},
	characterPositionFollowStopFollow: {
		type: 'characterMovement',
		message: `SOURCE_CHARACTER stopped following TARGET_CHARACTER.`,
	},

	// Character modifiers
	characterModifierAdd: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER added a new "MODIFIER_NAME" modifier on you.`,
	},
	characterModifierRemove: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER removed the "MODIFIER_NAME" modifier from you.`,
	},
	characterModifierChange: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER changed the configuration of the "MODIFIER_NAME" modifier on you.`,
	},
	characterModifierEnable: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER enabled the "MODIFIER_NAME" modifier on you.`,
	},
	characterModifierDisable: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER disabled the "MODIFIER_NAME" modifier on you.`,
	},
	characterModifierRename: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER renamed your "MODIFIER_NAME_OLD" modifier to "MODIFIER_NAME".`,
	},
	characterModifierReorder: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER reordered your character modifiers.`,
	},
	characterModifierLockAdd: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER added LOCK_TYPE to the "MODIFIER_NAME" modifier on you.`,
	},
	characterModifierLockRemove: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER removed the lock from the "MODIFIER_NAME" modifier on you.`,
	},
	characterModifierLockLock: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER locked your "MODIFIER_NAME" modifier.`,
	},
	characterModifierLockUnlock: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER unlocked your "MODIFIER_NAME" modifier.`,
	},
	characterModifierLockUpdateFingerprint: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER changed the registered fingerprints of the lock on your "MODIFIER_NAME" modifier.`,
	},
	characterModifierLockExceptionsChange: {
		type: 'characterModifierChange',
		message: `SOURCE_CHARACTER changed the list of characters who can bypass locks on your "MODIFIER_NAME" modifier.`,
	},

	// Gambling related
	gamblingCoin: {
		type: 'minigame',
		message: `SOURCE_CHARACTER flipped a coin and the result is TOSS_RESULT.`,
	},
	gamblingDice: {
		type: 'minigame',
		message: `SOURCE_CHARACTER rolled DICE_COUNT and the result is DICE_RESULT.`,
	},
	gamblingDiceHidden: {
		type: 'minigame',
		message: `SOURCE_CHARACTER rolled DICE_COUNT secretly.`,
	},
	gamblingDiceHiddenResult: {
		type: 'minigame',
		message: `You rolled DICE_COUNT and the result is DICE_RESULT.`,
	},
	gamblingRockPaperScissorsSet: {
		type: 'minigame',
		message: `SOURCE_CHARACTER is ready to show rock, paper, or scissors when the 'show' command is given.`,
	},
	gamblingRockPaperScissorsResult: {
		type: 'minigame',
		message: `Rock was shown by ROCK_CHARACTERS. Paper was shown by PAPER_CHARACTERS. Scissors were shown by SCISSORS_CHARACTERS.`,
	},
	gamblingCardGameCreation: {
		type: 'minigame',
		message: `SOURCE_CHARACTER created a game of cards. Use 'join' to join the game.`,
	},
	gamblingCardGameAlreadyCreated: {
		type: 'minigame',
		message: 'There is already a game ongoing, hosted by DEALER.',
	},
	gamblingCardGameNoGame: {
		type: 'minigame',
		message: `You have to 'create' a game first, before you can play.`,
	},
	gamblingCardGameJoined: {
		type: 'minigame',
		message: 'SOURCE_CHARACTER joins the game hosted by DEALER.',
	},
	gamblingCardGameYouJoined: {
		type: 'minigame',
		message: 'You joined the game hosted by DEALER.\nOther players: PLAYERS',
	},
	gamblingCardGameJoinedAlready: {
		type: 'minigame',
		message: 'You are already part of this game.',
	},
	gamblingCardGameDealOpen: {
		type: 'minigame',
		message: 'SOURCE_CHARACTER deals CARD openly to the table.',
	},
	gamblingCardGameDealPlayerOpen: {
		type: 'minigame',
		message: 'SOURCE_CHARACTER deals CARD to TARGET_CHARACTER.',
	},
	gamblingCardGameDealPlayerSecret: {
		type: 'minigame',
		message: 'SOURCE_CHARACTER deals COUNT face down to TARGET_CHARACTER.',
	},
	gamblingCardGameDealToYou: {
		type: 'minigame',
		message: 'SOURCE_CHARACTER deals CARD to you.',
	},
	gamblingCardGameHandCheck: {
		type: 'minigame',
		message: 'You are currently holding HAND.\nOn the table ISARE TABLE.',
	},
	gamblingCardGamePlayerCheck: {
		type: 'minigame',
		message: 'PLAYER has revealed HAND.',
	},
	gamblingCardGameEnds: {
		type: 'minigame',
		message: 'SOURCE_CHARACTER ends the game and all hands are revealed.',
	},
	gamblingCardGameHandShow: {
		type: 'minigame',
		message: 'PLAYER shows their hand and reveals HAND.',
	},
	gamblingCardGameRoomCards: {
		type: 'minigame',
		message: 'On the table ISARE HAND.',
	},
	gamblingCardGameEmpty: {
		type: 'minigame',
		message: 'There are not enough cards left in the deck.',
	},
	gamblingCardGameStopped: {
		type: 'minigame',
		message: 'The current game has been cancelled by SOURCE_CHARACTER.',
	},
	gamblingCardGameNotAllowed: {
		type: 'minigame',
		message: 'Only the dealer is allowed to do this.',
	},
	gamblingCardNotAPlayer: {
		type: 'minigame',
		message: `The given player is not part of the game. Ask them to 'join' first.`,
	},

	// Lock actions
	lockLock: {
		type: 'lockChange',
		message: `SOURCE_CHARACTER clicked ITEM_ASSET_NAME on ITEM_CONTAINER_SIMPLE_DYNAMIC shut.`,
	},
	lockUnlock: {
		type: 'lockChange',
		message: `SOURCE_CHARACTER unlocked ITEM_ASSET_NAME on ITEM_CONTAINER_SIMPLE_DYNAMIC.`,
	},
	lockUpdateFingerprint: {
		type: 'lockChange',
		message: `SOURCE_CHARACTER changed the registered fingerprints of ITEM_ASSET_NAME on ITEM_CONTAINER_SIMPLE_DYNAMIC.`,
	},

	//#endregion
} as const satisfies Readonly<Record<string, Immutable<ChatActionIntermediateDef>>>;

const CHAT_ACTIONS_DEF_FOLDED_EXTRA: Partial<Record<keyof typeof CHAT_ACTIONS_DEF, string>> = {
	spaceUpdatedMultiple: `CHANGES`,
};

type ChatActionIntermediateDef = {
	type: ChatActionType;
	message: string;
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

export const ChatActionTypeSchema = z.enum([
	'system', // System messages, e.g. character entering/leaving a space, or configuration changes
	'important', // Important messages, e.g. safemode changes, action interruptions, messages from space admins (e.g. join message)
	'itemInteraction', // Interaction with items
	'lockChange', // Interaction with existing locks
	'characterMovement', // Character follow changes
	'characterModifierChange', // Changes to character modifier, only visible to the affected character
	'minigame', // Messages from minigames
]);
export type ChatActionType = z.infer<typeof ChatActionTypeSchema>;

export const CHAT_ACTIONS = new Map<ChatActionId, string>(
	Array.from(Object.entries<string>(RecordUnpackSubobjectProperties('message', CHAT_ACTIONS_DEF))) as [ChatActionId, string][],
);

export const CHAT_ACTION_TYPE: Record<ChatActionId, ChatActionType> = RecordUnpackSubobjectProperties('type', CHAT_ACTIONS_DEF);

export const CHAT_ACTIONS_FOLDED_EXTRA = new Map<ChatActionId, string>(
	Array.from(Object.entries<string>(CHAT_ACTIONS_DEF_FOLDED_EXTRA)) as [ChatActionId, string][],
);

/**
 * Check whether a given action message is hidden in the context of a given global state
 * @param action - The action message to check
 * @param globalState - A space state containing settings to use
 */
export function ChatActionHidden(action: Immutable<ActionHandlerMessage>, globalState: AssetFrameworkGlobalState): boolean {
	const actionType = CHAT_ACTION_TYPE[action.id];

	switch (actionType) {
		case 'system':
		case 'important':
		case 'characterModifierChange':
		case 'minigame':
			return false;

		case 'characterMovement':
			return !globalState.space.getEffectiveSpaceSettings().characterMovementActionMessages;

		case 'itemInteraction':
			return !globalState.space.getEffectiveRoomSettings(action.rooms != null && action.rooms.length === 1 ? action.rooms[0] : null).itemActionMessages;

		case 'lockChange':
			return !globalState.space.getEffectiveRoomSettings(action.rooms != null && action.rooms.length === 1 ? action.rooms[0] : null).lockActionMessages;
	}

	AssertNever(actionType);
}
