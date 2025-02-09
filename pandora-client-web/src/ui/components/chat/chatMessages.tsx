import type { Immutable } from 'immer';
import {
	AssetId,
	AssignPronouns,
	CHAT_ACTIONS,
	CHAT_ACTIONS_FOLDED_EXTRA,
	ChatActionDictionaryMetaEntry,
	IChatMessageAction,
	IChatMessageBase,
	IChatSegment,
	MessageSubstitute,
	SpaceId,
	type ItemDisplayNameType,
} from 'pandora-common';
import {
	ReactElement,
} from 'react';
import { AssetManagerClient } from '../../../assets/assetManager';
import { ResolveItemDisplayNameType } from '../../../components/wardrobe/itemDetail/wardrobeItemName';
import { RenderedLink } from '../../screens/spaceJoin/spaceJoin';
import { ChatParser } from './chatParser';

export type IChatMessageProcessed<T extends IChatMessageBase = IChatMessageBase> = T & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
	spaceId: SpaceId | null;
	edited?: boolean;
};

export function IsActionMessage(message: IChatMessageProcessed): message is IChatMessageProcessed<IChatMessageAction> {
	return message.type === 'action' || message.type === 'serverMessage';
}

function ActionMessagePrepareDictionary(
	message: IChatMessageProcessed<IChatMessageAction>,
	assetManager: AssetManagerClient,
	itemDisplayNameType: ItemDisplayNameType,
): IChatMessageProcessed<IChatMessageAction> {
	const metaDictionary: Partial<Record<ChatActionDictionaryMetaEntry, string>> = {};

	const source = message.data?.character;
	const target = message.data?.target ?? source;

	const describeAsset = ({ assetId, itemName }: { assetId: AssetId; itemName: string; }) => ChatParser.escapeStyle(ResolveItemDisplayNameType(DescribeAsset(assetManager, assetId), itemName, itemDisplayNameType));

	if (source) {
		const { id, name, pronoun } = source;
		const nameEscaped = ChatParser.escapeStyle(name);
		metaDictionary.SOURCE_CHARACTER_NAME = nameEscaped;
		metaDictionary.SOURCE_CHARACTER_ID = id;
		metaDictionary.SOURCE_CHARACTER = `${nameEscaped} (${id})`;
		metaDictionary.SOURCE_CHARACTER_POSSESSIVE = `${nameEscaped}'s (${id})`;
		AssignPronouns('SOURCE_CHARACTER_PRONOUN', pronoun, metaDictionary);
	}

	if (target?.type === 'character') {
		const { id, name, pronoun } = target;
		const nameEscaped = ChatParser.escapeStyle(name);
		metaDictionary.TARGET_CHARACTER_NAME = nameEscaped;
		metaDictionary.TARGET_CHARACTER_ID = id;
		metaDictionary.TARGET_CHARACTER = `${nameEscaped} (${id})`;
		metaDictionary.TARGET_CHARACTER_POSSESSIVE = `${nameEscaped}'s (${id})`;
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
		metaDictionary.ITEM_ASSET_NAME = describeAsset(item);
	}

	if (itemPrevious) {
		metaDictionary.ITEM_ASSET_NAME_PREVIOUS = describeAsset(itemPrevious);
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
			const asset = describeAsset(itemContainerPath[0]);

			if (target?.type === 'roomInventory') {
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = metaDictionary.ITEM_CONTAINER_SIMPLE =
					`${asset} in the room inventory`;
			} else {
				metaDictionary.ITEM_CONTAINER_SIMPLE = `${metaDictionary.TARGET_CHARACTER_POSSESSIVE ?? `???'s`} ${asset}`;
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = `${metaDictionary.TARGET_CHARACTER_DYNAMIC_POSSESSIVE ?? `???'s`} ${asset}`;
			}
		} else {
			const assetFirst = describeAsset(itemContainerPath[0]);
			const assetLast = describeAsset(itemContainerPath[itemContainerPath.length - 1]);

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

	if (asset.definition.chat?.chatDescriptor)
		return asset.definition.chat.chatDescriptor;

	return asset.definition.name.toLocaleLowerCase();
}

export function DescribeAttribute(assetManager: AssetManagerClient, attributeName: string): string {
	const attribute = assetManager.getAttributeDefinition(attributeName);
	return attribute != null ? `${attribute.description}` : `[UNKNOWN ATTRIBUTE '${attributeName}']`;
}

export function RenderChatPart([type, contents]: Immutable<IChatSegment>, index: number, allowLinkInNormal: boolean): ReactElement {
	if (type === 'normal' && allowLinkInNormal && (/^https?:\/\//.exec(contents)) && URL.canParse(contents)) {
		const url = new URL(contents);
		return (
			<RenderedLink key={ index } index={ index } url={ url } />
		);
	}
	switch (type) {
		case 'normal':
			return <span key={ index }>{ contents }</span>;
		case 'italic':
			return <em key={ index }>{ contents }</em>;
		case 'bold':
			return <strong key={ index }>{ contents }</strong>;
	}
}

function GetActionText(action: IChatMessageProcessed<IChatMessageAction>, assetManager: AssetManagerClient): string | undefined {
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
	} else if (asset?.isType('roomDevice')) {
		switch (action.id) {
			case 'roomDeviceDeploy':
				return asset?.definition.chat?.actionDeploy ?? defaultMessage;
			case 'roomDeviceStore':
				return asset?.definition.chat?.actionStore ?? defaultMessage;
			case 'roomDeviceSlotEnter':
				return asset?.definition.chat?.actionSlotEnter ?? defaultMessage;
			case 'roomDeviceSlotLeave':
				return asset?.definition.chat?.actionSlotLeave ?? defaultMessage;
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

export function RenderActionContent(action: IChatMessageProcessed<IChatMessageAction>, assetManager: AssetManagerClient, itemDisplayNameType: ItemDisplayNameType): [IChatSegment[], IChatSegment[] | null] {
	// Append implicit dictionary entries
	action = ActionMessagePrepareDictionary(action, assetManager, itemDisplayNameType);
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
