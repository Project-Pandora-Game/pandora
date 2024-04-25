import { Immutable } from 'immer';
import { z } from 'zod';
import { ItemInteractionType } from '../../character/restrictionTypes';
import type { InteractionId } from '../../gameLogic/interactions';
import { IsNotNullable, Satisfies } from '../../utility';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import { AppearanceItems, AppearanceValidationCombineResults, AppearanceValidationResult } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import { AssetSize, AssetSizeMapping } from '../definitions';
import { ConditionOperator } from '../graphics';
import { __internal_ItemBundleSchemaRecursive, __internal_ItemTemplateSchemaRecursive } from '../item/_internalRecursion';
import { IItemCreationContext, IItemLoadContext, IItemValidationContext, Item, ItemId } from '../item/base';
import { IAssetModuleDefinition, IExportOptions, IItemModule, IModuleActionCommon, IModuleConfigCommon, IModuleItemDataCommon } from './common';

export interface IModuleConfigStorage<TProperties> extends IModuleConfigCommon<'storage', TProperties> {
	maxCount: number;
	maxAcceptedSize: AssetSize;
}

export const ModuleItemDataStorageSchema = z.object({
	type: z.literal('storage'),
	contents: z.array(__internal_ItemBundleSchemaRecursive),
});
export type IModuleItemDataStorage = Satisfies<z.infer<typeof ModuleItemDataStorageSchema>, IModuleItemDataCommon<'storage'>>;

export const ModuleItemTemplateStorageSchema = z.object({
	type: z.literal('storage'),
	contents: z.array(__internal_ItemTemplateSchemaRecursive),
});
export type IModuleItemTemplateStorage = z.infer<typeof ModuleItemTemplateStorageSchema>;

// Never used
export const ItemModuleStorageActionSchema = z.object({
	moduleType: z.literal('storage'),
});
export type ItemModuleStorageAction = Satisfies<z.infer<typeof ItemModuleStorageActionSchema>, IModuleActionCommon<'storage'>>;

export class StorageModuleDefinition implements IAssetModuleDefinition<'storage'> {
	public makeDefaultData<TProperties>(_config: Immutable<IModuleConfigStorage<TProperties>>): IModuleItemDataStorage {
		return {
			type: 'storage',
			contents: [],
		};
	}

	public makeDataFromTemplate<TProperties>(_config: Immutable<IModuleConfigStorage<TProperties>>, template: IModuleItemTemplateStorage, context: IItemCreationContext): IModuleItemDataStorage {
		return {
			type: 'storage',
			contents: template.contents.map((contentTemplate) => context.createItemBundleFromTemplate(contentTemplate, context)).filter(IsNotNullable),
		};
	}

	public loadModule<TProperties>(config: Immutable<IModuleConfigStorage<TProperties>>, data: IModuleItemDataStorage, context: IItemLoadContext): ItemModuleStorage<TProperties> {
		return ItemModuleStorage.loadFromData<TProperties>(config, data, context);
	}

	public getStaticAttributes<TProperties>(_config: Immutable<IModuleConfigStorage<TProperties>>): ReadonlySet<string> {
		return new Set<string>();
	}
}

interface ItemModuleStorageProps<TProperties> {
	readonly assetManager: AssetManager;
	readonly config: Immutable<IModuleConfigStorage<TProperties>>;
	readonly contents: AppearanceItems;
}

export class ItemModuleStorage<TProperties = unknown> implements IItemModule<TProperties, 'storage'>, ItemModuleStorageProps<TProperties> {
	public readonly type = 'storage';

	public readonly assetManager: AssetManager;
	public readonly config: Immutable<IModuleConfigStorage<TProperties>>;
	public readonly contents: AppearanceItems;

	public get interactionType(): ItemInteractionType {
		return ItemInteractionType.MODIFY;
	}

	public readonly interactionId: InteractionId = 'useStorageModule';

	protected constructor(props: ItemModuleStorageProps<TProperties>, overrideProps?: Partial<ItemModuleStorageProps<TProperties>>) {
		this.assetManager = overrideProps?.assetManager ?? props.assetManager;
		this.config = overrideProps?.config ?? props.config;
		this.contents = overrideProps?.contents ?? props.contents;
	}

	protected withProps(overrideProps: Partial<ItemModuleStorageProps<TProperties>>): ItemModuleStorage<TProperties> {
		return new ItemModuleStorage(this, overrideProps);
	}

	public static loadFromData<TProperties>(config: Immutable<IModuleConfigStorage<TProperties>>, data: IModuleItemDataStorage, context: IItemLoadContext): ItemModuleStorage<TProperties> {
		const contents: Item[] = [];
		const limitSize = AssetSizeMapping[config.maxAcceptedSize] ?? 0;
		for (const itemBundle of data.contents) {
			// Load asset and skip if unknown
			const asset = context.assetManager.getAssetById(itemBundle.asset);
			if (asset === undefined) {
				context.logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}
			const item = context.loadItemFromBundle(
				asset,
				itemBundle,
				context,
			);

			if (context.doLoadTimeCleanup) {
				if (contents.length >= config.maxCount) {
					context.logger?.warning(`Skipping stored item over count limit ${itemBundle.asset}`);
					continue;
				}
				// Skip if too large
				const assetSize = AssetSizeMapping[asset.definition.size] ?? 99;
				if (assetSize > limitSize) {
					context.logger?.warning(`Skipping stored item over size limit ${itemBundle.asset}`);
					continue;
				}
				// Skip if invalid
				if (!item.validate({
					location: 'stored',
					roomState: null,
				}).success) {
					context.logger?.warning(`Skipping stored item reporting invalid ${itemBundle.asset}`);
					continue;
				}
			}

			contents.push(item);
		}

		return new ItemModuleStorage({
			assetManager: context.assetManager,
			config,
			contents,
		});
	}

	public exportToTemplate(): IModuleItemTemplateStorage {
		return {
			type: 'storage',
			contents: this.contents.map((item) => item.exportToTemplate()),
		};
	}

	public exportData(options: IExportOptions): IModuleItemDataStorage {
		return {
			type: 'storage',
			contents: this.contents.map((item) => item.exportToBundle(options)),
		};
	}

	public validate(_context: IItemValidationContext): AppearanceValidationResult {
		// Id must be unique
		const ids = new Set<ItemId>();
		for (const item of this.contents) {
			if (ids.has(item.id))
				return {
					success: false,
					error: {
						problem: 'invalid',
					},
				};
			ids.add(item.id);
		}

		// Count must be within limit
		if (this.contents.length > this.config.maxCount)
			return {
				success: false,
				error: {
					problem: 'tooManyItems',
					asset: null,
					limit: this.config.maxCount,
				},
			};

		// Size must be within limit
		const limitSize = AssetSizeMapping[this.config.maxAcceptedSize] ?? 0;
		const problematic = this.contents.find((i) => (AssetSizeMapping[i.asset.definition.size] ?? 99) > limitSize);
		if (problematic != null)
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: problematic.asset.id,
				},
			};

		return this.contents
			.map((i) => i.validate({
				location: 'stored',
				roomState: null,
			}))
			.reduce(AppearanceValidationCombineResults, { success: true });
	}

	public getProperties(): readonly Immutable<TProperties>[] {
		return [];
	}

	public evalCondition(_operator: ConditionOperator, _value: string): boolean {
		return false;
	}

	public doAction(_context: AppearanceModuleActionContext, _action: ItemModuleStorageAction): ItemModuleStorage<TProperties> | null {
		return null;
	}

	public readonly contentsPhysicallyEquipped: boolean = false;

	public getContents(): AppearanceItems {
		return this.contents;
	}

	public setContents(items: AppearanceItems): ItemModuleStorage<TProperties> | null {
		return this.withProps({
			contents: items,
		});
	}
}
