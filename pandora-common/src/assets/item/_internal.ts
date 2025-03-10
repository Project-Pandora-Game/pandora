import type { Immutable } from 'immer';
import type { Writeable } from 'zod';

import type { CharacterId, ItemInteractionType } from '../../character/index.ts';
import type { AppearanceModuleActionContext } from '../../gameLogic/actionLogic/appearanceActions.ts';
import type { HexRGBAColorString } from '../../validation.ts';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation.ts';
import type { Asset } from '../asset.ts';
import type { AssetManager } from '../assetManager.ts';
import type { AssetColorization, AssetType, WearableAssetType } from '../definitions.ts';
import type { ItemModuleAction } from '../modules.ts';
import type { IExportOptions, IItemModule } from '../modules/common.ts';
import type { ColorGroupResult, IItemLoadContext, IItemValidationContext, Item, ItemBundle, ItemColorBundle, ItemId, ItemTemplate } from './base.ts';

import type { IChatMessageActionItem } from '../../chat/index.ts';
import { Assert, MemoizeNoArg } from '../../utility/misc.ts';
import { AssetProperties, AssetPropertiesIndividualResult, CreateAssetPropertiesIndividualResult, MergeAssetPropertiesIndividual } from '../properties.ts';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InternalItemTypeMap { }

export interface ItemBaseProps<Type extends AssetType = AssetType> {
	readonly assetManager: AssetManager;
	readonly id: ItemId;
	readonly asset: Asset<Type>;
	readonly spawnedBy?: CharacterId;
	readonly color: Immutable<ItemColorBundle>;
	readonly name?: string;
	readonly description?: string;
}

/**
 * Class representing an equipped item
 *
 * **THIS CLASS IS IMMUTABLE**
 */
export abstract class ItemBase<Type extends AssetType = AssetType> implements ItemBaseProps<Type> {
	public readonly assetManager: AssetManager;
	public readonly id: ItemId;
	public readonly asset: Asset<Type>;
	public readonly spawnedBy?: CharacterId;
	public readonly color: Immutable<ItemColorBundle>;
	public readonly name?: string;
	public readonly description?: string;

	public get type(): Type {
		return this.asset.type;
	}

	public isType<T extends AssetType>(kind: T): this is Item<T> {
		return this.asset.isType(kind);
	}

	public isWearable(): this is Item<WearableAssetType> {
		return this.asset.isWearable();
	}

	protected constructor(props: ItemBaseProps<Type>, overrideProps?: Partial<ItemBaseProps<Type>>) {
		this.assetManager = overrideProps?.assetManager ?? props.assetManager;
		this.id = overrideProps?.id ?? props.id;
		this.asset = overrideProps?.asset ?? props.asset;
		this.spawnedBy = overrideProps?.spawnedBy ?? props.spawnedBy;
		this.color = overrideProps?.color ?? props.color;
		this.name = (overrideProps && 'name' in overrideProps) ? overrideProps.name : props.name;
		this.description = (overrideProps && 'description' in overrideProps) ? overrideProps.description : props.description;
	}

	protected static _parseBundle<Type extends AssetType = AssetType>(asset: Asset<Type>, bundle: ItemBundle, context: IItemLoadContext): ItemBaseProps<Type> {
		Assert(asset.id === bundle.asset);
		return {
			assetManager: context.assetManager,
			id: bundle.id,
			asset,
			spawnedBy: bundle.spawnedBy,
			color: ItemBase._loadColorBundle(asset, bundle.color),
			name: bundle.name,
			description: bundle.description,
		};
	}

	protected abstract withProps(overrideProps: Partial<ItemBaseProps<Type>>): Item<Type>;

	public exportToTemplate(): ItemTemplate {
		let modules: ItemTemplate['modules'];
		if (this.getModules().size > 0) {
			modules = {};
			for (const [name, module] of this.getModules().entries()) {
				modules[name] = module.exportToTemplate();
			}
		}

		return {
			asset: this.asset.id,
			color: this.exportColorToBundle(),
			name: this.name,
			description: this.description,
			modules,
		};
	}

	public exportToBundle(options: IExportOptions): ItemBundle {
		let moduleData: ItemBundle['moduleData'];
		if (this.getModules().size > 0) {
			moduleData = {};
			for (const [name, module] of this.getModules().entries()) {
				moduleData[name] = module.exportData(options);
			}
		}

		return {
			id: this.id,
			asset: this.asset.id,
			spawnedBy: options.clientOnly ? undefined : this.spawnedBy,
			color: this.exportColorToBundle(),
			name: this.name,
			description: this.description,
			moduleData,
		};
	}

	public exportColorToBundle(): ItemColorBundle | undefined {
		if (!this.isType('bodypart') && !this.isType('personal') && !this.isType('roomDevice'))
			return undefined;
		const colorization = this.asset.definition.colorization;
		if (!colorization)
			return undefined;

		let hasKey = false;
		const result: Writeable<ItemColorBundle> = {};
		for (const [key, value] of Object.entries(this.color)) {
			const def = colorization[key];
			if (!def || def.name == null)
				continue;

			result[key] = value;
			hasKey = true;
		}
		return hasKey ? result : undefined;
	}

	public getChatDescriptor(): IChatMessageActionItem {
		return {
			id: this.id,
			assetId: this.asset.id,
			itemName: this.name ?? '',
		};
	}

	public containerChanged(items: AppearanceItems, isCharacter: boolean): Item<Type> {
		Assert(this.isType(this.type));
		if (!isCharacter)
			return this;

		return this._overrideColors(items);
	}

	public getColorOverrides(_items: AppearanceItems): null | Partial<Record<string, ColorGroupResult>> {
		return null;
	}

	public validate(context: IItemValidationContext): AppearanceValidationResult {
		// Check that the item's internal state is valid
		const properties = this.getProperties();
		for (const [flag, reason] of properties.stateFlagsRequirements.entries()) {
			if (!properties.stateFlags.has(flag)) {
				return {
					success: false,
					error: {
						problem: 'invalidState',
						asset: this.asset.id,
						itemName: this.name ?? '',
						reason,
					},
				};
			}
		}

		// Check the asset can actually be worn
		if (context.location === 'worn' && (!this.isWearable() || (this.isType('personal') && this.asset.definition.wearable === false)))
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
					itemName: this.name ?? '',
				},
			};

		// Check bodyparts are worn
		if (this.isType('bodypart') && context.location !== 'worn')
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
					itemName: this.name ?? '',
				},
			};

		for (const module of this.getModules().values()) {
			const r = module.validate(context);
			if (!r.success)
				return r;
		}

		return { success: true };
	}

	/** Returns if this item can be transferred between inventories */
	public canBeTransferred(): boolean {
		// No transferring bodyparts, thank you
		if (this.isType('bodypart'))
			return false;

		return true;
	}

	/** Colors this item with passed color, returning new item with modified color */
	public changeColor(color: ItemColorBundle): Item<Type> {
		return this.withProps({
			color: ItemBase._loadColorBundle(this.asset, color),
		});
	}

	/** Returns a new item with the passed name and description */
	public customizeName(newName: string): Item<Type> {
		let name: string | undefined = newName.trim();
		if (name === '' || name === this.asset.definition.name)
			name = undefined;

		return this.withProps({ name });
	}

	/** Returns a new item with the passed name and description */
	public customizeDescription(newDescription: string): Item<Type> {
		let description: string | undefined = newDescription.trim();
		if (description === '')
			description = undefined;

		return this.withProps({ description });
	}

	@MemoizeNoArg
	public getModules(): ReadonlyMap<string, IItemModule> {
		return new Map();
	}

	public getModuleItems(moduleName: string): AppearanceItems {
		return this.getModules().get(moduleName)?.getContents() ?? [];
	}

	public moduleAction(_context: AppearanceModuleActionContext, _moduleName: string, _action: ItemModuleAction): Item<Type> | null {
		return null;
	}

	public moduleActionGetInteractionType(moduleName: string, action: ItemModuleAction): ItemInteractionType | undefined {
		const module = this.getModules().get(moduleName);
		if (!module || module.type !== action.moduleType)
			return undefined;

		if (module.getActionInteractionType)
			return module.getActionInteractionType(action);

		return module.interactionType;
	}

	public setModuleItems(_moduleName: string, _items: AppearanceItems): Item<Type> | null {
		return null;
	}

	@MemoizeNoArg
	public getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		const propertyParts: Immutable<AssetProperties>[] = (this.isWearable()) ? [this.asset.definition] : [];

		return propertyParts;
	}

	@MemoizeNoArg
	public getProperties(): AssetPropertiesIndividualResult {
		return this.getPropertiesParts()
			.reduce(MergeAssetPropertiesIndividual, CreateAssetPropertiesIndividualResult());
	}

	private _overrideColors(items: AppearanceItems): Item<Type> {
		Assert(this.isType(this.type));
		if (!this.isType('bodypart') && !this.isType('personal'))
			return this;
		const colorization = this.asset.definition.colorization;
		if (!colorization)
			return this;

		const overrides = this.getColorOverrides(items);
		if (!overrides)
			return this;

		const result: Writeable<ItemColorBundle> = {};
		for (const [key, value] of Object.entries(this.color)) {
			const def = colorization[key];
			if (!def || def.name == null)
				continue;

			const override = overrides[key];
			if (override == null)
				continue;

			result[key] = LimitColorAlpha(override.color, def.minAlpha) ?? value;
		}
		return this.changeColor(result);
	}

	public _getColorByGroup(_group: string, _ignoreKey?: string): null | ['primary' | 'inherited', Immutable<AssetColorization>, HexRGBAColorString] {
		return null;
	}

	private static _loadColorBundle(asset: Asset, color: ItemColorBundle | HexRGBAColorString[] = {}): ItemColorBundle {
		const colorization = (asset.isType('bodypart') || asset.isType('personal') || asset.isType('roomDevice')) ? (asset.definition.colorization ?? {}) : {};
		if (Array.isArray(color)) {
			const keys = Object.keys(colorization);
			const fixup: Writeable<ItemColorBundle> = {};
			color.forEach((value, index) => {
				if (index < keys.length)
					fixup[keys[index]] = value;
			});
			color = fixup;
		}
		const result: Writeable<ItemColorBundle> = {};
		for (const [key, value] of Object.entries(colorization)) {
			if (value.name == null)
				continue;

			result[key] = LimitColorAlpha(color[key] ?? value.default, value.minAlpha);
		}
		return result;
	}
}

function LimitColorAlpha(color: HexRGBAColorString, minAlpha: number = 255): HexRGBAColorString {
	if (color.length === 7)
		return color;

	if (minAlpha >= 255)
		return color.substring(0, 7) as HexRGBAColorString;

	const alpha = Math.max(parseInt(color.substring(7), 16), minAlpha);
	return color.substring(0, 7) + alpha.toString(16).padStart(2, '0') as HexRGBAColorString;
}
