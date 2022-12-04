import { Asset } from '../asset';
import { IAssetModuleDefinition, IItemModule, IModuleItemDataCommon, IModuleConfigCommon } from './common';
import { z } from 'zod';
import { AssetDefinitionExtraArgs, AssetSizeMapping } from '../definitions';
import { ConditionOperator } from '../graphics';
import { AssetProperties } from '../properties';
import { ItemInteractionType } from '../../character/restrictionsManager';
import { AppearanceItems, AppearanceValidateRequirements, AppearanceValidationResult } from '../appearanceValidation';
import { IItemLoadContext, Item, ItemBundle, ItemBundleSchema } from '../item';
import { AssetManager } from '../assetManager';

export interface IModuleConfigLockSlot<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends IModuleConfigCommon<'lockSlot'> {
	/**
	 * Requirements that locks going into this slot need to meet to be allowed into it.
	 */
	lockRequirements: (A['attributes'] | `!${A['attributes']}`)[];

	/** Effects applied when this slot isn't occupied by a lock */
	unoccupiedEffects?: AssetProperties<A>;
	/** Effects applied when this slot is occupied by a lock */
	occupiedEffects?: AssetProperties<A>;
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

	public getStaticAttributes(_config: IModuleConfigLockSlot): ReadonlySet<string> {
		return new Set<string>();
	}
}

function ValidateLock(lock: Item | null, config: IModuleConfigLockSlot): AppearanceValidationResult {
	if (lock === null)
		return { success: true };

	if (
		(AssetSizeMapping[lock.asset.definition.size] ?? 99) > AssetSizeMapping.small ||
		!AppearanceValidateRequirements(lock.getProperties().attributes, new Set(config.lockRequirements), null).success
	) {
		return {
			success: false,
			error: {
				problem: 'contentNotAllowed',
				asset: lock.asset.id,
			},
		};
	}

	return lock.validate(false);
}

export class ItemModuleLockSlot implements IItemModule<'lockSlot'> {
	public readonly type = 'lockSlot';

	private readonly assetMananger: AssetManager;
	public readonly config: IModuleConfigLockSlot;
	public readonly lock: Item | null;

	public get interactionType(): ItemInteractionType {
		return ItemInteractionType.MODIFY;
	}

	constructor(config: IModuleConfigLockSlot, data: IModuleItemDataLockSlot, context: IItemLoadContext) {
		this.assetMananger = context.assetMananger;
		this.config = config;
		if (data.lock) {
			// Load asset and skip if unknown
			const asset = this.assetMananger.getAssetById(data.lock.asset);
			if (asset === undefined) {
				context.logger?.warning(`Skipping unknown lock asset ${data.lock.asset}`);
				this.lock = null;
			} else {
				const item = new Item(
					data.lock.id,
					asset,
					data.lock,
					context,
				);

				if (context.doLoadTimeCleanup && !ValidateLock(item, this.config).success) {
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

	public validate(_isWorn: boolean): AppearanceValidationResult {
		return ValidateLock(this.lock, this.config);
	}

	public getProperties(): AssetProperties {
		return this.lock !== null ?
			(this.config.occupiedEffects ?? {}) :
			(this.config.unoccupiedEffects ?? {});
	}

	public evalCondition(_operator: ConditionOperator, _value: string): boolean {
		return false;
	}

	public doAction(_action: ItemModuleLockSlotAction): ItemModuleLockSlot | null {
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
			assetMananger: this.assetMananger,
			doLoadTimeCleanup: false,
		});
	}

	public acceptedContentFilter(asset: Asset): boolean {
		return this.config.lockRequirements.every((r) => r.startsWith('!') || asset.staticAttributes.has(r));
	}
}
