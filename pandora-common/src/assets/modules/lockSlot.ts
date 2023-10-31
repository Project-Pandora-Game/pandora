import { Asset } from '../asset';
import type { IAssetModuleDefinition, IItemModule, IModuleItemDataCommon, IModuleConfigCommon, IModuleActionCommon, IExportOptions } from './common';
import { z } from 'zod';
import { ConditionOperator } from '../graphics';
import { ItemInteractionType } from '../../character/restrictionsManager';
import { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import { CreateItem, IItemLoadContext, IItemLocationDescriptor, ItemBundleSchema, ItemLock, ItemLockActionSchema } from '../item';
import { AssetManager } from '../assetManager';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import { Satisfies } from '../../utility';

export interface IModuleConfigLockSlot<TProperties> extends IModuleConfigCommon<'lockSlot'> {
	/** Properties applied when this slot isn't occupied by a lock */
	emptyProperties?: TProperties;
	/** Properties applied when this slot is occupied by a lock */
	occupiedProperties?: TProperties;
	/** Properties applied when the slot is occupied and locked, default to occupiedEffects */
	lockedProperties?: TProperties;
}

const ModuleItemDataLockSlotSchema = z.lazy(() => z.object({
	type: z.literal('lockSlot'),
	lock: ItemBundleSchema.nullable(),
}));
export type IModuleItemDataLockSlot = Satisfies<z.infer<typeof ModuleItemDataLockSlotSchema>, IModuleItemDataCommon<'lockSlot'>>;

export const ItemModuleLockSlotActionSchema = z.object({
	moduleType: z.literal('lockSlot'),
	lockAction: z.lazy(() => ItemLockActionSchema),
});
export type ItemModuleLockSlotAction = Satisfies<z.infer<typeof ItemModuleLockSlotActionSchema>, IModuleActionCommon<'lockSlot'>>;

export class LockSlotModuleDefinition implements IAssetModuleDefinition<'lockSlot'> {

	public parseData(_config: IModuleConfigLockSlot<unknown>, data: unknown): IModuleItemDataLockSlot {
		const parsed = ModuleItemDataLockSlotSchema.safeParse(data);
		return parsed.success ? parsed.data : {
			type: 'lockSlot',
			lock: null,
		};
	}

	public loadModule<TProperties>(config: IModuleConfigLockSlot<TProperties>, data: IModuleItemDataLockSlot, context: IItemLoadContext): ItemModuleLockSlot<TProperties> {
		return new ItemModuleLockSlot(config, data, context);
	}

	public getStaticAttributes<TProperties>(config: IModuleConfigLockSlot<TProperties>, staticAttributesExtractor: (properties: TProperties) => ReadonlySet<string>): ReadonlySet<string> {
		const result = new Set<string>();
		if (config.emptyProperties != null) {
			staticAttributesExtractor(config.emptyProperties).forEach((a) => result.add(a));
		}
		if (config.occupiedProperties != null) {
			staticAttributesExtractor(config.occupiedProperties).forEach((a) => result.add(a));
		}
		if (config.lockedProperties != null) {
			staticAttributesExtractor(config.lockedProperties).forEach((a) => result.add(a));
		}
		return result;
	}
}

export class ItemModuleLockSlot<TProperties = unknown> implements IItemModule<TProperties, 'lockSlot'> {
	public readonly type = 'lockSlot';

	private readonly assetManager: AssetManager;
	public readonly config: IModuleConfigLockSlot<TProperties>;
	public readonly lock: ItemLock | null;

	public get interactionType(): ItemInteractionType {
		return ItemInteractionType.MODIFY;
	}

	constructor(config: IModuleConfigLockSlot<TProperties>, data: IModuleItemDataLockSlot, context: IItemLoadContext) {
		this.assetManager = context.assetManager;
		this.config = config;
		if (data.lock) {
			// Load asset and skip if unknown
			const asset = this.assetManager.getAssetById(data.lock.asset);
			if (asset === undefined) {
				context.logger?.warning(`Skipping unknown lock asset ${data.lock.asset}`);
				this.lock = null;
			} else {
				const item = CreateItem(
					data.lock.id,
					asset,
					data.lock,
					context,
				);

				if (!item.isType('lock')) {
					context.logger?.warning(`Skipping invalid lock ${data.lock.asset}`);
					this.lock = null;
				} else {
					this.lock = item;
				}
			}
		} else {
			this.lock = null;
		}
	}

	public exportData(options: IExportOptions): IModuleItemDataLockSlot {
		return {
			type: 'lockSlot',
			lock: this.lock ? this.lock.exportToBundle(options) : null,
		};
	}

	public validate(_location: IItemLocationDescriptor): AppearanceValidationResult {
		return { success: true };
	}

	public getProperties(): readonly TProperties[] {
		if (this.lock != null) {
			if (this.config.lockedProperties != null && this.lock.isLocked()) {
				return [this.config.lockedProperties];
			}

			if (this.config.occupiedProperties != null)
				return [this.config.occupiedProperties];

			return [];
		}

		if (this.config.emptyProperties != null)
			return [this.config.emptyProperties];

		return [];
	}

	public evalCondition(_operator: ConditionOperator, _value: string): boolean {
		return false;
	}

	public doAction(context: AppearanceModuleActionContext, { lockAction }: ItemModuleLockSlotAction): ItemModuleLockSlot<TProperties> | null {
		if (this.lock == null)
			return null;

		if (this.lock == null)
			return null;

		const result = this.lock.lockAction(context, lockAction);
		if (result == null)
			return result;

		return new ItemModuleLockSlot(this.config, {
			type: 'lockSlot',
			lock: result.exportToBundle({}),
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public readonly contentsPhysicallyEquipped: boolean = true;

	public getContents(): AppearanceItems {
		return this.lock ? [this.lock] : [];
	}

	public setContents(items: AppearanceItems): ItemModuleLockSlot<TProperties> | null {
		if (items.length > 1)
			return null;
		if (items.length === 1 && !items[0].isType('lock'))
			return null;

		return new ItemModuleLockSlot(this.config, {
			type: 'lockSlot',
			lock: items.length === 1 ? items[0].exportToBundle({}) : null,
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public acceptedContentFilter(asset: Asset): boolean {
		return asset.isType('lock');
	}
}
