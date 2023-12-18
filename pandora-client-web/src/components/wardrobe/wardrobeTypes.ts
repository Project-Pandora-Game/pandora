import {
	AppearanceAction,
	AppearanceActionContext,
	Asset,
	AssetFrameworkGlobalState,
	IAssetModuleTypes,
	IClientShardResult,
	ItemContainerPath,
	ItemId,
	ItemPath,
	ItemTemplate,
	ModuleType,
	RoomTargetSelector,
} from 'pandora-common';
import { ReactElement } from 'react';
import { ICharacter, IChatroomCharacter } from '../../character/character';
import { Observable } from '../../observable';
import { IChatRoomContext } from '../gameContext/chatRoomContextProvider';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';
import { Immutable } from 'immer';

export type WardrobeContextExtraItemActionComponent = (props: { item: ItemPath; }) => ReactElement | null;
export type WardrobeTarget = IChatroomCharacter | IChatRoomContext;

export type WardrobeHeldItem = {
	type: 'nothing';
} | {
	type: 'item';
	target: RoomTargetSelector;
	path: ItemPath;
} | {
	type: 'template';
	template: Immutable<ItemTemplate>;
};

export interface WardrobeContext {
	target: WardrobeTarget;
	targetSelector: RoomTargetSelector;
	player: ICharacter;
	globalState: AssetFrameworkGlobalState;
	assetList: readonly Asset[];
	heldItem: WardrobeHeldItem;
	setHeldItem: (newHeldItem: WardrobeHeldItem) => void;
	focus: Observable<Immutable<WardrobeFocus>>;
	extraItemActions: Observable<readonly WardrobeContextExtraItemActionComponent[]>;
	actions: AppearanceActionContext;
	execute: (action: AppearanceAction) => IClientShardResult['appearanceAction'] | undefined;

	/** Override for previewing the actions */
	actionPreviewState: Observable<AssetFrameworkGlobalState | null>;

	// Settings
	showExtraActionButtons: boolean;
	showHoverPreview: boolean;

	// Editor
	isEditor: boolean;
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

export interface WardrobeModuleTemplateProps<TType extends ModuleType = ModuleType> {
	definition: Immutable<IAssetModuleTypes<unknown>[TType]['config']>;
	template: Immutable<IAssetModuleTypes<unknown>[TType]['template']> | undefined;
	onTemplateChange: (newTemplate: Immutable<IAssetModuleTypes<unknown>[TType]['template']>) => void;
	moduleName: string;
}
