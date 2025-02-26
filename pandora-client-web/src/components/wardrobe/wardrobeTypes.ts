import type { Immutable } from 'immer';
import { omit } from 'lodash';
import {
	ActionTargetSelector,
	Asset,
	AssetFrameworkGlobalState,
	IAssetModuleTypes,
	ItemContainerPath,
	ItemId,
	ItemPath,
	ItemTemplate,
	ModuleType,
	type ItemDisplayNameType,
} from 'pandora-common';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';
import { ReactElement } from 'react';
import { Observable, type ReadonlyObservable } from '../../observable';

export type WardrobeContextExtraItemActionComponent = (props: { target: ActionTargetSelector; item: ItemPath; }) => ReactElement | null;

export type WardrobeHeldItem = {
	type: 'nothing';
} | {
	type: 'item';
	target: ActionTargetSelector;
	path: ItemPath;
} | {
	type: 'template';
	template: Immutable<ItemTemplate>;
};

export interface WardrobeContext {
	targetSelector: ActionTargetSelector;
	assetList: readonly Asset[];
	heldItem: WardrobeHeldItem;
	setHeldItem: (newHeldItem: WardrobeHeldItem) => void;
	scrollToItem: ItemId | null;
	setScrollToItem: (newScrollToItem: ItemId | null) => void;
	focuser: WardrobeFocuser;
	extraItemActions: Observable<readonly WardrobeContextExtraItemActionComponent[]>;

	/** Override for previewing the actions */
	actionPreviewState: Observable<AssetFrameworkGlobalState | null>;

	// Settings
	showExtraActionButtons: boolean;
	showHoverPreview: boolean;
	itemDisplayNameType: ItemDisplayNameType;
}

export interface WardrobeFocus {
	container: ItemContainerPath;
	itemId: ItemId | null;
}

export interface WardrobeModuleProps<Module extends IItemModule> {
	target: ActionTargetSelector;
	item: ItemPath;
	moduleName: string;
	m: Module;
}

export interface WardrobeModuleTemplateProps<TType extends ModuleType = ModuleType> {
	definition: Immutable<IAssetModuleTypes<unknown, unknown>[TType]['config']>;
	template: Immutable<IAssetModuleTypes<unknown, unknown>[TType]['template']> | undefined;
	onTemplateChange: (newTemplate: Immutable<IAssetModuleTypes<unknown, unknown>[TType]['template']>) => void;
	moduleName: string;
}

export class WardrobeFocuser {
	private readonly _stack: { container: ItemContainerPath; itemId: ItemId | null; inRoom: boolean; }[] = [];
	private readonly _current = new Observable<WardrobeFocus>({ container: [], itemId: null });
	private readonly _inRoom = new Observable<boolean>(false);
	private _disabled: string | null = null;
	private _disabledContainers: string | null = null;

	public get current(): ReadonlyObservable<Immutable<WardrobeFocus>> {
		return this._current;
	}

	public get inRoom(): ReadonlyObservable<boolean> {
		return this._inRoom;
	}

	public reset(): void {
		this._inRoom.value = false;
		const current = this._current.value;
		if (current.container.length === 0 && current.itemId == null) {
			return;
		}
		this._current.value = { container: [], itemId: null };
	}

	public previous(): void {
		if (this._disabled != null)
			throw new Error(this._disabled);

		const popped = this._stack.pop();
		if (popped == null) {
			return;
		}
		this._current.value = omit(popped, 'inRoom');
		this._inRoom.value = popped.inRoom;
	}

	public focus(newFocus: WardrobeFocus, target: ActionTargetSelector): void {
		if (this._disabled != null)
			throw new Error(this._disabled);
		if (this._disabledContainers && newFocus.container.length > 0)
			throw new Error(this._disabledContainers);

		this._stack.push({
			container: this._current.value.container,
			itemId: this._current.value.itemId,
			inRoom: this._inRoom.value,
		});

		this._current.value = newFocus;
		this._inRoom.value = target.type === 'roomInventory';
	}

	public focusItemId(itemId: ItemId | null): void {
		if (this._disabled != null)
			throw new Error(this._disabled);

		const current = this._current.value;
		if (current.itemId === itemId) {
			return;
		}
		this._current.value = ({ ...current, itemId });
	}

	public focusItemModule(item: ItemPath, moduleName: string, target: ActionTargetSelector): void {
		this.focus({
			container: [...item.container, { item: item.itemId, module: moduleName }],
			itemId: null,
		}, target);
	}

	public focusPrevious(): void {
		if (this._disabled != null)
			throw new Error(this._disabled);

		if (this._stack.length === 0) {
			return;
		}

		const last = this._stack[this._stack.length - 1];
		this._stack.push({
			container: this._current.value.container,
			itemId: this._current.value.itemId,
			inRoom: this._inRoom.value,
		});

		this._current.value = omit(last, 'inRoom');
		this._inRoom.value = last.inRoom;
	}

	public disable(message: string): () => void {
		const old = this._disabled;
		this._disabled = message;
		return () => {
			this._disabled = old;
		};
	}

	public disableContainers(message: string): () => void {
		const old = this._disabledContainers;
		this._disabledContainers = message;
		return () => {
			this._disabledContainers = old;
		};
	}
}
