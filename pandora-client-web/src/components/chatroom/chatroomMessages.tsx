import { AssetId, AssignPronouns, IChatRoomMessageAction, IChatRoomMessageBase, IChatSegment, MessageSubstitute, RoomId } from 'pandora-common';
import { ChatActionDictionaryMetaEntry, CHAT_ACTIONS, CHAT_ACTIONS_FOLDED_EXTRA } from 'pandora-common/dist/chatroom/chatActions';
import React, {
	ReactElement,
} from 'react';
import { AssetManagerClient } from '../../assets/assetManager';
import { ChatParser } from './chatParser';
import './chatroom.scss';

export type IChatroomMessageProcessed<T extends IChatRoomMessageBase = IChatRoomMessageBase> = T & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
	roomId: RoomId;
	edited?: boolean;
};

export function IsActionMessage(message: IChatroomMessageProcessed): message is IChatroomMessageProcessed<IChatRoomMessageAction> {
	return message.type === 'action' || message.type === 'serverMessage';
}

function ActionMessagePrepareDictionary(
	message: IChatroomMessageProcessed<IChatRoomMessageAction>,
	assetManager: AssetManagerClient,
): IChatroomMessageProcessed<IChatRoomMessageAction> {
	const metaDictionary: Partial<Record<ChatActionDictionaryMetaEntry, string>> = {};

	const source = message.data?.character;
	const target = message.data?.target ?? source;

	if (source) {
		const { id, name, pronoun } = source;
		metaDictionary.SOURCE_CHARACTER_NAME = name;
		metaDictionary.SOURCE_CHARACTER_ID = id;
		metaDictionary.SOURCE_CHARACTER = `${name} (${id})`;
		metaDictionary.SOURCE_CHARACTER_POSSESSIVE = `${name}'s (${id})`;
		AssignPronouns('SOURCE_CHARACTER_PRONOUN', pronoun, metaDictionary);
	}

	if (target?.type === 'character') {
		const { id, name, pronoun } = target;
		metaDictionary.TARGET_CHARACTER_NAME = name;
		metaDictionary.TARGET_CHARACTER_ID = id;
		metaDictionary.TARGET_CHARACTER = `${name} (${id})`;
		metaDictionary.TARGET_CHARACTER_POSSESSIVE = `${name}'s (${id})`;
		AssignPronouns('TARGET_CHARACTER_PRONOUN', pronoun, metaDictionary);

		if (id === source?.id) {
			AssignPronouns('TARGET_CHARACTER_DYNAMIC', pronoun, metaDictionary);
		} else {
			metaDictionary.TARGET_CHARACTER_DYNAMIC_SUBJECTIVE = metaDictionary.TARGET_CHARACTER;
			metaDictionary.TARGET_CHARACTER_DYNAMIC_OBJECTIVE = metaDictionary.TARGET_CHARACTER;
			metaDictionary.TARGET_CHARACTER_DYNAMIC_POSSESSIVE = metaDictionary.TARGET_CHARACTER_POSSESSIVE;
			metaDictionary.TARGET_CHARACTER_DYNAMIC_REFLEXIVE = metaDictionary.TARGET_CHARACTER;
		}
	}

	const item = message.data?.item;
	const itemPrevious = message.data?.itemPrevious ?? item;
	const itemContainerPath = message.data?.itemContainerPath;

	if (item) {
		metaDictionary.ITEM_ASSET_NAME = DescribeAsset(assetManager, item.assetId);
	}

	if (itemPrevious) {
		metaDictionary.ITEM_ASSET_NAME_PREVIOUS = DescribeAsset(assetManager, itemPrevious.assetId);
	}

	if (itemContainerPath) {
		if (itemContainerPath.length === 0) {
			if (target?.type === 'roomInventory') {
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = metaDictionary.ITEM_CONTAINER_SIMPLE =
					`the room inventory`;
			} else {
				metaDictionary.ITEM_CONTAINER_SIMPLE = metaDictionary.TARGET_CHARACTER;
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = metaDictionary.TARGET_CHARACTER_DYNAMIC_REFLEXIVE;
			}
		} else if (itemContainerPath.length === 1) {
			const asset = DescribeAsset(assetManager, itemContainerPath[0].assetId);

			if (target?.type === 'roomInventory') {
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = metaDictionary.ITEM_CONTAINER_SIMPLE =
					`${asset} in the room inventory`;
			} else {
				metaDictionary.ITEM_CONTAINER_SIMPLE = `${metaDictionary.TARGET_CHARACTER_POSSESSIVE ?? `???'s`} ${asset}`;
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = `${metaDictionary.TARGET_CHARACTER_DYNAMIC_POSSESSIVE ?? `???'s`} ${asset}`;
			}
		} else {
			const assetFirst = DescribeAsset(assetManager, itemContainerPath[0].assetId);
			const assetLast = DescribeAsset(assetManager, itemContainerPath[itemContainerPath.length - 1].assetId);

			if (target?.type === 'roomInventory') {
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = metaDictionary.ITEM_CONTAINER_SIMPLE =
					`the ${assetLast} in ${assetFirst} in the room inventory`;
			} else {
				metaDictionary.ITEM_CONTAINER_SIMPLE = `the ${assetLast} in ${metaDictionary.TARGET_CHARACTER_POSSESSIVE ?? `???'s`} ${assetFirst}`;
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = `the ${assetLast} in ${metaDictionary.TARGET_CHARACTER_DYNAMIC_POSSESSIVE ?? `???'s`} ${assetFirst}`;
			}
		}
	}

	return {
		...message,
		dictionary: {
			...metaDictionary,
			...message.dictionary,
		},
	};
}

export function DescribeAsset(assetManager: AssetManagerClient, assetId: AssetId): string {
	const asset = assetManager.getAssetById(assetId);
	if (!asset)
		return `[UNKNOWN ASSET '${assetId}']`;

	if (asset.isWearable() && asset.definition.chat?.chatDescriptor)
		return asset.definition.chat.chatDescriptor;

	return asset.definition.name.toLocaleLowerCase();
}

export function DescribeAssetSlot(assetManager: AssetManagerClient, slot: string): string {
	const slotDefinition = assetManager.getSlotDefinition(slot);
	return slotDefinition?.description ?? `[UNKNOWN SLOT '${slot}']`;
}

export function RenderChatPart([type, contents]: IChatSegment, index: number): ReactElement {
	switch (type) {
		case 'normal':
			return <span key={ index }>{ contents }</span>;
		case 'italic':
			return <em key={ index }>{ contents }</em>;
		case 'bold':
			return <strong key={ index }>{ contents }</strong>;
	}
}

function GetActionText(action: IChatroomMessageProcessed<IChatRoomMessageAction>, assetManager: AssetManagerClient): string | undefined {
	if (action.customText != null)
		return action.customText;

	const item = action.data?.item;
	const asset = item && assetManager.getAssetById(item.assetId);
	const itemPrevious = action.data?.itemPrevious ?? item;
	const assetPrevious = itemPrevious && assetManager.getAssetById(itemPrevious.assetId);

	const defaultMessage = CHAT_ACTIONS.get(action.id);

	// Asset-specific message overrides
	if (asset?.isType('personal')) {
		switch (action.id) {
			case 'itemAdd':
				return asset?.definition.chat?.actionAdd ?? defaultMessage;
			case 'itemAddCreate':
				return asset?.definition.chat?.actionAddCreate ?? defaultMessage;
			case 'itemAttach':
				return asset?.definition.chat?.actionAttach ?? defaultMessage;
		}
	}
	if (assetPrevious?.isType('personal')) {
		switch (action.id) {
			case 'itemRemove':
				return assetPrevious?.definition.chat?.actionRemove ?? defaultMessage;
			case 'itemRemoveDelete':
				return assetPrevious?.definition.chat?.actionRemoveDelete ?? defaultMessage;
			case 'itemDetach':
				return assetPrevious?.definition.chat?.actionDetach ?? defaultMessage;
		}
	}

	return defaultMessage;
}

export function RenderActionContent(action: IChatroomMessageProcessed<IChatRoomMessageAction>, assetManager: AssetManagerClient): [IChatSegment[], IChatSegment[] | null] {
	// Append implicit dictionary entries
	action = ActionMessagePrepareDictionary(action, assetManager);
	let actionText = GetActionText(action, assetManager);
	if (actionText === undefined) {
		return [ChatParser.parseStyle(`( ERROR UNKNOWN ACTION '${action.id}' )`), null];
	}
	// Server messages can have extra info
	let actionExtraText = action.type === 'serverMessage' ? CHAT_ACTIONS_FOLDED_EXTRA.get(action.id) : undefined;
	if (action.dictionary) {
		actionText = MessageSubstitute(actionText, action.dictionary);
		if (actionExtraText !== undefined) {
			actionExtraText = MessageSubstitute(actionExtraText, action.dictionary);
		}
	}
	if (action.type === 'action' && actionText) {
		actionText = `(${actionText})`;
	}
	return [ChatParser.parseStyle(actionText), actionExtraText ? ChatParser.parseStyle(actionExtraText) : null];
}
