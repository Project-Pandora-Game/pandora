import { Asset } from '../asset';
import { IAssetModuleDefinition, IItemModule, IModuleItemDataCommon, IModuleConfigCommon } from './common';
import { z } from 'zod';
import { AssetDefinitionExtraArgs } from '../definitions';
import { ConditionOperator } from '../graphics';
import { AssetProperties } from '../properties';
import { ItemInteractionType } from '../../character/restrictionsManager';
import { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import { CreateItem, IItemLoadContext, IItemLocationDescriptor, ItemBundle, ItemBundleSchema, ItemLock } from '../item';
import { AssetManager } from '../assetManager';
import type { AppearanceActionContext } from '../appearanceActions';

export interface IModuleConfigLockSlot<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends IModuleConfigCommon<'lockSlot'> {
	/** Effects applied when this slot isn't occupied by a lock */
	emptyEffects?: AssetProperties<A>;
	/** Effects applied when this slot is occupied by a lock */
	occupiedEffects?: AssetProperties<A>;
	/** Effects applied when the slot is occupied and locked, default to occupiedEffects */
	lockedEffects?: AssetProperties<A>;
}

export interface IModuleItemDataLockSlot extends IModuleItemDataCommon<'lockSlot'> {
	lock: ItemBundle | null;
}
const ModuleItemDataLockSlotScheme = z.lazy(() => z.object({
	type: z.literal('lockSlot'),
	lock: ItemBundleSchema.nullable(),
}));

// Never used
export const ItemModuleLockSlotActionSchema = z.object({
	moduleType: z.literal('lockSlot'),
});
type ItemModuleLockSlotAction = z.infer<typeof ItemModuleLockSlotActionSchema>;

export class LockSlotModuleDefinition implements IAssetModuleDefinition<'lockSlot'> {

	public parseData(_asset: Asset, _moduleName: string, _config: IModuleConfigLockSlot, data: unknown): IModuleItemDataLockSlot {
		const parsed = ModuleItemDataLockSlotScheme.safeParse(data);
		return parsed.success ? parsed.data : {
			type: 'lockSlot',
			lock: null,
		};
	}

	public loadModule(_asset: Asset, _moduleName: string, config: IModuleConfigLockSlot, data: IModuleItemDataLockSlot, context: IItemLoadContext): ItemModuleLockSlot {
		return new ItemModuleLockSlot(config, data, context);
	}

	public getStaticAttributes(config: IModuleConfigLockSlot): ReadonlySet<string> {
		const result = new Set<string>();
		config.emptyEffects?.attributes?.forEach((a) => result.add(a));
		config.occupiedEffects?.attributes?.forEach((a) => result.add(a));
		config.lockedEffects?.attributes?.forEach((a) => result.add(a));
		return result;
	}
}

export class ItemModuleLockSlot implements IItemModule<'lockSlot'> {
	public readonly type = 'lockSlot';

	private readonly assetManager: AssetManager;
	public readonly config: IModuleConfigLockSlot;
	public readonly lock: ItemLock | null;

	public get interactionType(): ItemInteractionType {
		return ItemInteractionType.MODIFY;
	}

	constructor(config: IModuleConfigLockSlot, data: IModuleItemDataLockSlot, context: IItemLoadContext) {
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

	public exportData(): IModuleItemDataLockSlot {
		return {
			type: 'lockSlot',
			lock: this.lock ? this.lock.exportToBundle() : null,
		};
	}

	public validate(_location: IItemLocationDescriptor): AppearanceValidationResult {
		return { success: true };
	}

	public getProperties(): AssetProperties {
		if (this.lock == null)
			return this.config.emptyEffects ?? {};
		if (this.lock.isLocked())
			return this.config.lockedEffects ?? this.config.occupiedEffects ?? {};

		return this.config.occupiedEffects ?? {};
	}

	public evalCondition(_operator: ConditionOperator, _value: string): boolean {
		return false;
	}

	public doAction(_context: AppearanceActionContext, _action: ItemModuleLockSlotAction): ItemModuleLockSlot | null {
		return null;
	}

	public readonly contentsPhysicallyEquipped: boolean = true;

	public getContents(): AppearanceItems {
		return this.lock ? [this.lock] : [];
	}

	public setContents(items: AppearanceItems): ItemModuleLockSlot | null {
		if (items.length > 1)
			return null;

		return new ItemModuleLockSlot(this.config, {
			type: 'lockSlot',
			lock: items.length === 1 ? items[0].exportToBundle() : null,
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public acceptedContentFilter(asset: Asset): boolean {
		return asset.isType('lock');
	}
}
