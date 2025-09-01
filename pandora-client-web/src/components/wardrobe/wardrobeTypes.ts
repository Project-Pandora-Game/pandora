import type { Immutable } from 'immer';
import { omit } from 'lodash-es';
import {
	ActionTargetSelector,
	AssetFrameworkGlobalState,
	IAssetModuleTypes,
	ItemContainerPath,
	ItemContainerPathSchema,
	ItemId,
	ItemIdSchema,
	ItemPath,
	ItemTemplate,
	ModuleType,
	type ActionRoomSelector,
	type RoomId,
} from 'pandora-common';
import { IItemModule } from 'pandora-common/dist/assets/modules/common.js';
import { ReactElement } from 'react';
import * as z from 'zod';
import { Observable, type ReadonlyObservable } from '../../observable.ts';

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
	currentRoomSelector: ActionRoomSelector;
	heldItem: WardrobeHeldItem;
	setHeldItem: (newHeldItem: WardrobeHeldItem) => void;
	scrollToItem: ItemId | null;
	setScrollToItem: (newScrollToItem: ItemId | null) => void;
	focuser: WardrobeFocuser;
	extraItemActions: Observable<readonly WardrobeContextExtraItemActionComponent[]>;

	/** Override for previewing the actions */
	actionPreviewState: Observable<AssetFrameworkGlobalState | null>;
}

export const WardrobeFocusSchema = z.object({
	container: ItemContainerPathSchema,
	itemId: ItemIdSchema.nullable(),
});
export type WardrobeFocus = z.infer<typeof WardrobeFocusSchema>;

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
	private readonly _stack: { container: ItemContainerPath; itemId: ItemId | null; inRoom: RoomId | null; }[] = [];
	private readonly _current = new Observable<WardrobeFocus>({ container: [], itemId: null });
	private readonly _inRoom = new Observable<RoomId | null>(null);
	private _disabled: string | null = null;
	private _disabledContainers: string | null = null;

	public get current(): ReadonlyObservable<Immutable<WardrobeFocus>> {
		return this._current;
	}

	public get inRoom(): ReadonlyObservable<RoomId | null> {
		return this._inRoom;
	}

	public reset(): void {
		this._inRoom.value = null;
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
		this._inRoom.value = target.type === 'room' ? target.roomId : null;
	}

	/** Set a new focus without pushing entry on the history stack */
	public focusReplace(newFocus: WardrobeFocus, target: ActionTargetSelector): void {
		if (this._disabled != null)
			throw new Error(this._disabled);
		if (this._disabledContainers && newFocus.container.length > 0)
			throw new Error(this._disabledContainers);

		this._current.value = newFocus;
		this._inRoom.value = target.type === 'room' ? target.roomId : null;
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
