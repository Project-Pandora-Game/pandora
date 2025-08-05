import { remove } from 'lodash-es';
import type { CharacterId } from '../character/index.ts';
import { Assert, AssertNever } from '../utility/misc.ts';
import type { ActionHandlerMessageTarget, ActionHandlerMessageTemplate, ActionHandlerMessageWithTarget, ActionTargetSelector, ItemContainerPath, ItemPath, RoomId } from './appearanceTypes.ts';
import { AppearanceItemsFixBodypartOrder } from './appearanceValidation.ts';
import type { AssetManager } from './assetManager.ts';
import type { Item, ItemId } from './item/index.ts';
import { AppearanceItems } from './item/items.ts';
import type { AssetFrameworkGlobalStateManipulator } from './manipulators/globalStateManipulator.ts';
import type { IItemModule } from './modules/common.ts';
import type { AssetFrameworkGlobalState } from './state/globalState.ts';

export function SplitContainerPath(path: ItemContainerPath): {
	itemPath: ItemPath;
	module: string;
} | undefined {
	if (path.length < 1)
		return undefined;

	return {
		itemPath: {
			container: path.slice(0, -1),
			itemId: path[path.length - 1].item,
		},
		module: path[path.length - 1].module,
	};
}

export function EvalContainerPath(items: AppearanceItems, container: ItemContainerPath): AppearanceItems | undefined {
	let current = items;
	for (const step of container) {
		const item = current.find((it) => it.id === step.item);
		if (!item)
			return undefined;
		current = item.getModuleItems(step.module);
	}
	return current;
}

export function EvalItemPath(items: AppearanceItems, { container, itemId }: ItemPath): Item | undefined {
	const containerItems = EvalContainerPath(items, container);
	return containerItems?.find((it) => it.id === itemId);
}

export type IContainerPathActual = readonly {
	readonly item: Item;
	readonly moduleName: string;
	readonly module: IItemModule;
}[];

export abstract class AppearanceManipulator {
	public abstract getItems(): AppearanceItems;
	protected abstract _applyItems(items: AppearanceItems): boolean;

	public isCharacter(): this is AppearanceCharacterManipulator {
		return false;
	}

	public abstract readonly container: IItemModule | null;
	public abstract readonly containerPath: IContainerPathActual | null;

	public readonly assetManager: AssetManager;

	public abstract get currentState(): AssetFrameworkGlobalState;

	constructor(assetManager: AssetManager) {
		this.assetManager = assetManager;
	}

	public getContainer(path: ItemContainerPath): AppearanceManipulator {
		if (path.length < 1)
			return this;
		const step = path[0];
		return new AppearanceContainerManipulator(this, step.item, step.module).getContainer(path.slice(1));
	}

	public addItem(item: Item, index?: number): boolean {
		Assert(this.assetManager === item.assetManager);

		const items = this.getItems().slice();
		if (items.some((it) => it.id === item.id))
			return false;
		if (index != null) {
			if (!Number.isInteger(index) || index < 0 || index > items.length)
				return false;
			items.splice(index, 0, item);
		} else {
			items.push(item);
		}
		return this._applyItemsWithChange(items);
	}

	public removeMatchingItems(predicate: (item: Item) => boolean): AppearanceItems {
		const items = this.getItems().slice();
		const result = remove(items, (item) => predicate(item));
		return this._applyItemsWithChange(items) ? result : [];
	}

	public moveItem(id: ItemId, shift: number): boolean {
		const items = this.getItems().slice();
		const currentPos = items.findIndex((item) => item.id === id);
		const newPos = currentPos + shift;

		if (currentPos < 0 || newPos < 0 || newPos >= items.length)
			return false;

		const moved = items.splice(currentPos, 1);
		items.splice(newPos, 0, ...moved);
		return this._applyItemsWithChange(items);
	}

	public modifyItem(id: ItemId, mutator: (item: Item) => (Item | null)): boolean {
		const items = this.getItems().slice();
		const index = items.findIndex((i) => i.id === id);
		if (index < 0)
			return false;
		const result = mutator(items[index]);
		if (result === items[index])
			return true;
		if (!result || result.id !== id || result.asset !== result.asset)
			return false;
		items[index] = result;
		return this._applyItemsWithChange(items);
	}

	public abstract makeMessage(message: ActionHandlerMessageTemplate): ActionHandlerMessageWithTarget;

	protected _applyItemsWithChange(items: AppearanceItems): boolean {
		return this._applyItems(items.map((item) => item.containerChanged(items, this.isCharacter())));
	}
}

class AppearanceContainerManipulator extends AppearanceManipulator {
	private _base: AppearanceManipulator;
	private _item: ItemId;
	private _module: string;

	public get container(): IItemModule | null {
		const item = this._base.getItems().find((i) => i.id === this._item);
		return item?.getModules().get(this._module) ?? null;
	}
	public get containerPath(): IContainerPathActual | null {
		const basePath = this._base.containerPath;
		const item = this._base.getItems().find((i) => i.id === this._item);
		const module = item?.getModules().get(this._module);
		return (!basePath || !item || !module) ? null : [
			...basePath,
			{ item, moduleName: this._module, module },
		];
	}

	public override get currentState(): AssetFrameworkGlobalState {
		return this._base.currentState;
	}

	constructor(base: AppearanceManipulator, item: ItemId, module: string) {
		super(base.assetManager);
		this._base = base;
		this._item = item;
		this._module = module;
	}

	public getItems(): AppearanceItems {
		const item = this._base.getItems().find((i) => i.id === this._item);
		return item ? item.getModuleItems(this._module) : [];
	}

	protected _applyItems(items: AppearanceItems): boolean {
		return this._base.modifyItem(this._item, (it) => it.setModuleItems(this._module, items));
	}

	public makeMessage(message: ActionHandlerMessageTemplate): ActionHandlerMessageWithTarget {
		const item = this._base.getItems().find((i) => i.id === this._item);

		message.itemContainerPath ??= [];
		if (item != null) {
			message.itemContainerPath?.unshift({
				id: item.id,
				assetId: item.asset.id,
				module: this._module,
				itemName: item.name ?? '',
			});
		}

		return this._base.makeMessage(message);
	}
}

export class AppearanceRootManipulator extends AppearanceManipulator {
	protected readonly _base: AssetFrameworkGlobalStateManipulator;
	protected readonly _target: ActionTargetSelector;

	public get target(): Readonly<ActionTargetSelector> {
		return this._target;
	}

	public readonly container: null = null;
	public readonly containerPath: IContainerPathActual = [];

	public override get currentState(): AssetFrameworkGlobalState {
		return this._base.currentState;
	}

	constructor(base: AssetFrameworkGlobalStateManipulator, target: ActionTargetSelector) {
		super(base.assetManager);
		this._base = base;
		this._target = target;
	}

	/** Gets items, but is only present on the root of appearance to prevent accidental passing of container manipulators */
	public getRootItems(): AppearanceItems {
		return this.getItems();
	}

	/** Replaces all items, completely discarding current ones */
	public resetItemsTo(newItems: AppearanceItems): void {
		const r = this._applyItems(newItems);
		Assert(r);
	}

	public getItems(): AppearanceItems {
		return this._base.getItems(this._target);
	}

	protected _applyItems(items: AppearanceItems): boolean {
		return this._base.setItems(this._target, items);
	}

	public override makeMessage(message: ActionHandlerMessageTemplate): ActionHandlerMessageWithTarget {
		message.itemContainerPath ??= [];

		let target: ActionHandlerMessageTarget;
		const rooms: RoomId[] = [];
		if (this._target.type === 'character') {
			target = {
				type: 'character',
				id: this._target.characterId,
			};
			const room = this.currentState.getCharacterState(this._target.characterId)?.currentRoom;
			if (room != null) {
				rooms.push(room);
			}
		} else if (this._target.type === 'room') {
			target = {
				type: 'room',
				roomId: this._target.roomId,
			};
			rooms.push(this._target.roomId);
		} else {
			AssertNever(this._target);
		}

		return {
			...message,
			target,
			rooms,
		};
	}
}

export class AppearanceCharacterManipulator extends AppearanceRootManipulator {
	public override isCharacter(): this is AppearanceCharacterManipulator {
		return true;
	}

	public get characterId(): CharacterId {
		Assert(this._target.type === 'character');

		return this._target.characterId;
	}

	public fixBodypartOrder(): boolean {
		const items = AppearanceItemsFixBodypartOrder(this.assetManager, this.getItems());
		return this._applyItemsWithChange(items);
	}
}
