import {
	AppearanceAction,
	AppearanceActionContext,
	Asset,
	AssetFrameworkGlobalState,
	AssetId,
	IClientShardResult,
	ItemContainerPath,
	ItemId,
	ItemPath,
	RoomTargetSelector,
} from 'pandora-common';
import { ReactElement } from 'react';
import { ICharacter, IChatroomCharacter } from '../../character/character';
import { Observable } from '../../observable';
import { IChatRoomContext } from '../gameContext/chatRoomContextProvider';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';

export type WardrobeContextExtraItemActionComponent = (props: { item: ItemPath; }) => ReactElement | null;
export type WardrobeTarget = IChatroomCharacter | IChatRoomContext;

export type WardrobeHeldItem = {
	type: 'nothing';
} | {
	type: 'item';
	target: RoomTargetSelector;
	path: ItemPath;
} | {
	type: 'asset';
	asset: AssetId;
};

export interface WardrobeContext {
	target: WardrobeTarget;
	targetSelector: RoomTargetSelector;
	player: ICharacter;
	globalState: AssetFrameworkGlobalState;
	assetList: readonly Asset[];
	heldItem: WardrobeHeldItem;
	setHeldItem: (newHeldItem: WardrobeHeldItem) => void;
	extraItemActions: Observable<readonly WardrobeContextExtraItemActionComponent[]>;
	actions: AppearanceActionContext;
	execute: (action: AppearanceAction) => IClientShardResult['appearanceAction'] | undefined;

	/** Override for previewing the actions */
	actionPreviewState: Observable<AssetFrameworkGlobalState | null>;

	// Settings
	showExtraActionButtons: boolean;
	showHoverPreview: boolean;
}

export interface WardrobeFocus {
	container: ItemContainerPath;
	itemId: ItemId | null;
}

export interface WardrobeModuleProps<Module extends IItemModule> {
	item: ItemPath;
	moduleName: string;
	m: Module;
	setFocus: (newFocus: WardrobeFocus) => void;
}
