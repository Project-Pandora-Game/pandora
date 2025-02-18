import classNames from 'classnames';
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
	type AssetManager,
	type IChatMessageActionItem,
	type IChatMessageChat,
	type IChatMessageDeleted,
	type ItemDisplayNameType,
} from 'pandora-common';
import {
	Fragment,
	ReactElement,
} from 'react';
import { useGameState, useGlobalState, useStateFindItemById } from '../../../components/gameContext/gameStateContextProvider';
import { ResolveItemDisplayNameType } from '../../../components/wardrobe/itemDetail/wardrobeItemName';
import { OpenRoomItemDialog } from '../../screens/room/roomItemDialogList';
import { RenderedLink } from '../../screens/spaceJoin/spaceJoin';

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
	/** Identical action messages following one after another get combined into a single message to reduce spam. */
	repetitions?: number;
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
	itemDisplayNameType: ItemDisplayNameType,
): IChatActionMessageProcessed {
	const metaDictionary: Partial<Record<ChatActionDictionaryMetaEntry, string | ReactElement>> = {};

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
		metaDictionary.ITEM_ASSET_NAME = <ActionTextItemLink item={ item } itemDisplayNameType={ itemDisplayNameType } />;
	}

	if (itemPrevious) {
		metaDictionary.ITEM_ASSET_NAME_PREVIOUS = <ActionTextItemLink item={ itemPrevious } itemDisplayNameType={ itemDisplayNameType } />;
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
			const asset = <ActionTextItemLink item={ itemContainerPath[0] } itemDisplayNameType={ itemDisplayNameType } />;

			if (target?.type === 'roomInventory') {
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = metaDictionary.ITEM_CONTAINER_SIMPLE =
					<>{ asset } in the room inventory</>;
			} else {
				metaDictionary.ITEM_CONTAINER_SIMPLE = <>{ metaDictionary.TARGET_CHARACTER_POSSESSIVE ?? `???'s` } { asset }</>;
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = <>{ metaDictionary.TARGET_CHARACTER_DYNAMIC_POSSESSIVE ?? `???'s` } { asset }</>;
			}
		} else {
			const assetFirst = <ActionTextItemLink item={ itemContainerPath[0] } itemDisplayNameType={ itemDisplayNameType } />;
			const assetLast = <ActionTextItemLink item={ itemContainerPath[itemContainerPath.length - 1] } itemDisplayNameType={ itemDisplayNameType } />;

			if (target?.type === 'roomInventory') {
				metaDictionary.ITEM_CONTAINER_SIMPLE_DYNAMIC = metaDictionary.ITEM_CONTAINER_SIMPLE =
					<>the { assetLast } in { assetFirst } in the room inventory</>;
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

export function DescribeAsset(assetManager: AssetManager, assetId: AssetId): string {
	const asset = assetManager.getAssetById(assetId);
	if (!asset)
		return `[UNKNOWN ASSET '${assetId}']`;

	if (asset.definition.chat?.chatDescriptor)
		return asset.definition.chat.chatDescriptor;

	return asset.definition.name.toLocaleLowerCase();
}

export function DescribeAttribute(assetManager: AssetManager, attributeName: string): string {
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

function GetActionText(action: IChatActionMessageProcessed, assetManager: AssetManager): string | undefined {
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

export function ActionTextItemLink({ item, itemDisplayNameType }: {
	item: IChatMessageActionItem;
	itemDisplayNameType: ItemDisplayNameType;
}): ReactElement {
	const globalState = useGlobalState(useGameState());
	const assetManager = globalState.assetManager;

	const matchingItems = useStateFindItemById(globalState, item.id);

	if (matchingItems.length === 1) {
		// If we found exactly one matching item, make it a link
		const currentItem = matchingItems[0].item;

		const hasCustomName = (!!currentItem.name && currentItem.name !== currentItem.asset.definition.name) && itemDisplayNameType !== 'original';
		const hasDescription = !!currentItem.description;

		return (
			<a
				className={ classNames(
					'itemLink',
					hasCustomName ? 'hasCustomName' : null,
					hasDescription ? 'hasDescription' : null,
				) }
				onClick={ () => {
					OpenRoomItemDialog(item.id);
				} }
			>
				{ ResolveItemDisplayNameType(DescribeAsset(assetManager, item.assetId), item.itemName, itemDisplayNameType) }
			</a>
		);
	}

	// If the item was not found, return basic text
	return (
		<>
			{ ResolveItemDisplayNameType(DescribeAsset(assetManager, item.assetId), item.itemName, itemDisplayNameType) }
		</>
	);
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

	return <Fragment key='actionContent'>{ message.map((e, i) => (<Fragment key={ i }>{ e }</Fragment>)) }</Fragment>;
}

export function RenderActionContent(
	action: IChatActionMessageProcessed,
	assetManager: AssetManager,
	itemDisplayNameType: ItemDisplayNameType,
): [content: ReactElement | null, extraContent: ReactElement | null] {
	// Append implicit dictionary entries
	action = ActionMessagePrepareDictionary(action, itemDisplayNameType);
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
		actionText = <Fragment key='action'>({ actionText })</Fragment>;
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
