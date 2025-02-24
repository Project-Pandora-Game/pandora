import type { Immutable } from 'immer';
import {
	AssertNever,
	AssetId,
	AssignPronouns,
	CHAT_ACTIONS,
	CHAT_ACTIONS_FOLDED_EXTRA,
	ChatActionDictionaryMetaEntry,
	IChatMessageAction,
	IChatSegment,
	SpaceId,
	type IChatMessageChat,
	type IChatMessageDeleted,
	type ItemDisplayNameType,
} from 'pandora-common';
import {
	ReactElement,
} from 'react';
import { AssetManagerClient } from '../../../assets/assetManager';
import { ResolveItemDisplayNameType } from '../../../components/wardrobe/itemDetail/wardrobeItemName';
import { RenderedLink } from '../../screens/spaceJoin/spaceJoin';
import { ChatParser } from './chatParser';

export type IChatDeletedMessageProcessed = IChatMessageDeleted & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
	spaceId: SpaceId | null;
};

export type IChatNormalMessageProcessed = IChatMessageChat & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
	spaceId: SpaceId | null;
	edited?: boolean;
};

export type IChatActionMessageProcessed = Omit<IChatMessageAction, 'dictionary'> & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
	spaceId: SpaceId | null;
	/** Identical action messages following one after another get combined into a single message to reduce spam. */
	repetitions?: number;
	dictionary?: Record<string, string | ReactElement>;
};

export type IChatMessageProcessed = IChatNormalMessageProcessed | IChatDeletedMessageProcessed | IChatActionMessageProcessed;

export function IsActionMessage(message: IChatMessageProcessed): message is IChatActionMessageProcessed {
	return message.type === 'action' || message.type === 'serverMessage';
}

function ActionMessagePrepareDictionary(
	message: IChatActionMessageProcessed,
	assetManager: AssetManagerClient,
	itemDisplayNameType: ItemDisplayNameType,
): IChatActionMessageProcessed {
	const metaDictionary: Partial<Record<ChatActionDictionaryMetaEntry, string | ReactElement>> = {};

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
				metaDictionary.ITEM_CONTAINER_SIMPLE = <>{ metaDictionary.TARGET_CHARACTER_POSSESSIVE ?? `???'s` } { asset }</>;
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = <>{ metaDictionary.TARGET_CHARACTER_DYNAMIC_POSSESSIVE ?? `???'s` } { asset }</>;
			}
		} else {
			const assetFirst = describeAsset(itemContainerPath[0]);
			const assetLast = describeAsset(itemContainerPath[itemContainerPath.length - 1]);

			if (target?.type === 'roomInventory') {
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = metaDictionary.ITEM_CONTAINER_SIMPLE =
					`the ${assetLast} in ${assetFirst} in the room inventory`;
			} else {
				metaDictionary.ITEM_CONTAINER_SIMPLE = <>the { assetLast } in { metaDictionary.TARGET_CHARACTER_POSSESSIVE ?? `???'s` } { assetFirst }</>;
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = <>the { assetLast } in { metaDictionary.TARGET_CHARACTER_DYNAMIC_POSSESSIVE ?? `???'s` } { assetFirst }</>;
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

function GetActionText(action: IChatActionMessageProcessed, assetManager: AssetManagerClient): string | undefined {
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

export function RenderActionContentPart(originalMessage: string, substitutions: Readonly<Record<string, string | ReactElement>> | undefined): ReactElement {
	const message: (string | ReactElement)[] = [originalMessage];

	// Do replacements
	if (substitutions != null) {
		for (const [key, value] of Object
			.entries(substitutions)
			// Do the longest substitutions first to avoid small one replacing part of large one
			.sort(([a], [b]) => b.length - a.length)
		) {
			for (let i = message.length - 1; i >= 0; i--) {
				// Replace keys with values by splitting the original chunk with the key and "joining" with the value
				const original = message[i];
				if (typeof original === 'string') {
					const split: (string | ReactElement)[] = original.split(key);
					if (split.length > 1) {
						for (let j = split.length - 1; j >= 1; j--) {
							split.splice(j, 0, value);
						}
						message.splice(i, 1, ...split);
					}
				}
			}
		}
	}

	return <>{ message }</>;
}

export function RenderActionContent(
	action: IChatActionMessageProcessed,
	assetManager: AssetManagerClient,
	itemDisplayNameType: ItemDisplayNameType,
): [content: ReactElement | null, extraContent: ReactElement | null] {
	// Append implicit dictionary entries
	action = ActionMessagePrepareDictionary(action, assetManager, itemDisplayNameType);
	let actionText: string | ReactElement | undefined = GetActionText(action, assetManager);
	if (actionText === undefined) {
		return [
			<span key='actionError'>( ERROR UNKNOWN ACTION '{ action.id }' )</span>,
			null,
		];
	}
	// If the message is set to empty, don't show anyting
	if (!actionText) {
		return [null, null];
	}

	actionText = RenderActionContentPart(actionText, action.dictionary);

	if (action.type === 'action') {
		actionText = <>({ actionText })</>;
		return [
			actionText,
			null,
		];
	} else if (action.type === 'serverMessage') {
		// Server messages can have extra info
		let actionExtraText: string | ReactElement | undefined = CHAT_ACTIONS_FOLDED_EXTRA.get(action.id);
		if (actionExtraText !== undefined) {
			actionExtraText = RenderActionContentPart(actionExtraText, action.dictionary);
		}
		return [
			actionText,
			actionExtraText ?? null,
		];
	}

	AssertNever(action.type);
}
