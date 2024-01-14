import { Asset } from '../asset';
import type { IAssetModuleDefinition, IItemModule, IModuleItemDataCommon, IModuleConfigCommon, IModuleActionCommon, IExportOptions } from './common';
import { z } from 'zod';
import { ConditionOperator } from '../graphics';
import { ItemInteractionType } from '../../character/restrictionsManager';
import { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import { CreateItemBundleFromTemplate, IItemCreationContext, IItemLoadContext, IItemValidationContext, ItemBundleSchema, ItemLock, ItemLockActionSchema, ItemTemplateSchema, LoadItemFromBundle } from '../item';
import { AssetManager } from '../assetManager';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import { Satisfies } from '../../utility';
import { Immutable } from 'immer';
import type { InteractionId } from '../../gameLogic/interactions';

// Fix for pnpm resolution weirdness
import type { } from '../item/base';

export interface IModuleConfigLockSlot<TProperties> extends IModuleConfigCommon<'lockSlot'> {
	/** Properties applied when this slot isn't occupied by a lock */
	emptyProperties?: TProperties;
	/** Properties applied when this slot is occupied by a lock */
	occupiedProperties?: TProperties;
	/** Properties applied when the slot is occupied and locked, default to occupiedEffects */
	lockedProperties?: TProperties;
}

export const ModuleItemDataLockSlotSchema = z.object({
	type: z.literal('lockSlot'),
	lock: z.lazy(() => ItemBundleSchema).nullable(),
});
export type IModuleItemDataLockSlot = Satisfies<z.infer<typeof ModuleItemDataLockSlotSchema>, IModuleItemDataCommon<'lockSlot'>>;

export const ModuleItemTemplateLockSlotSchema = z.object({
	type: z.literal('lockSlot'),
	lock: z.lazy(() => ItemTemplateSchema).nullable(),
});
export type IModuleItemTemplateLockSlot = z.infer<typeof ModuleItemTemplateLockSlotSchema>;

export const ItemModuleLockSlotActionSchema = z.object({
	moduleType: z.literal('lockSlot'),
	lockAction: z.lazy(() => ItemLockActionSchema),
});
export type ItemModuleLockSlotAction = Satisfies<z.infer<typeof ItemModuleLockSlotActionSchema>, IModuleActionCommon<'lockSlot'>>;

export class LockSlotModuleDefinition implements IAssetModuleDefinition<'lockSlot'> {
	public makeDefaultData(_config: IModuleConfigLockSlot<unknown>): IModuleItemDataLockSlot {
		return {
			type: 'lockSlot',
			lock: null,
		};
	}

	public makeDataFromTemplate<TProperties>(_config: IModuleConfigLockSlot<TProperties>, template: IModuleItemTemplateLockSlot, context: IItemCreationContext): IModuleItemDataLockSlot {
		return {
			type: 'lockSlot',
			lock: template.lock != null ? (CreateItemBundleFromTemplate(template.lock, context) ?? null) : null,
		};
	}

	public loadModule<TProperties>(config: Immutable<IModuleConfigLockSlot<TProperties>>, data: IModuleItemDataLockSlot, context: IItemLoadContext): ItemModuleLockSlot<TProperties> {
		return ItemModuleLockSlot.loadFromData(config, data, context);
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

interface ItemModuleLockSlotProps<TProperties = unknown> {
	readonly assetManager: AssetManager;
	readonly config: Immutable<IModuleConfigLockSlot<TProperties>>;
	readonly lock: ItemLock | null;
}

export class ItemModuleLockSlot<TProperties = unknown> implements IItemModule<TProperties, 'lockSlot'>, ItemModuleLockSlotProps<TProperties> {
	public readonly type = 'lockSlot';

	public readonly assetManager: AssetManager;
	public readonly config: Immutable<IModuleConfigLockSlot<TProperties>>;
	public readonly lock: ItemLock | null;

	public get interactionType(): ItemInteractionType {
		return ItemInteractionType.MODIFY;
	}

	public readonly interactionId: InteractionId = 'useLockSlotModule';

	protected constructor(props: ItemModuleLockSlotProps<TProperties>, overrideProps?: Partial<ItemModuleLockSlotProps<TProperties>>) {
		this.assetManager = overrideProps?.assetManager ?? props.assetManager;
		this.config = overrideProps?.config ?? props.config;
		this.lock = overrideProps?.lock !== undefined ? overrideProps.lock : props.lock;
	}

	protected withProps(overrideProps: Partial<ItemModuleLockSlotProps<TProperties>>): ItemModuleLockSlot<TProperties> {
		return new ItemModuleLockSlot(this, overrideProps);
	}

	public static loadFromData<TProperties>(config: Immutable<IModuleConfigLockSlot<TProperties>>, data: IModuleItemDataLockSlot, context: IItemLoadContext): ItemModuleLockSlot<TProperties> {
		let lock: ItemModuleLockSlotProps<TProperties>['lock'];

		if (data.lock) {
			// Load asset and skip if unknown
			const asset = context.assetManager.getAssetById(data.lock.asset);
			if (asset === undefined) {
				context.logger?.warning(`Skipping unknown lock asset ${data.lock.asset}`);
				lock = null;
			} else {
				const item = LoadItemFromBundle(
					asset,
					data.lock,
					context,
				);

				if (!item.isType('lock')) {
					context.logger?.warning(`Skipping invalid lock ${data.lock.asset}`);
					lock = null;
				} else {
					lock = item;
				}
			}
		} else {
			lock = null;
		}

		return new ItemModuleLockSlot({
			assetManager: context.assetManager,
			config,
			lock,
		});
	}

	public exportToTemplate(): IModuleItemTemplateLockSlot {
		return {
			type: 'lockSlot',
			lock: this.lock ? this.lock.exportToTemplate() : null,
		};
	}

	public exportData(options: IExportOptions): IModuleItemDataLockSlot {
		return {
			type: 'lockSlot',
			lock: this.lock ? this.lock.exportToBundle(options) : null,
		};
	}

	public validate(context: IItemValidationContext): AppearanceValidationResult {
		if (this.lock != null) {
			const r = this.lock.validate({
				...context,
				location: 'attached',
			});
			if (!r.success)
				return r;
		}

		return { success: true };
	}

	public getProperties(): readonly Immutable<TProperties>[] {
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

		return this.withProps({
			lock: result,
		});
	}

	public readonly contentsPhysicallyEquipped: boolean = true;

	public getContents(): AppearanceItems {
		return this.lock ? [this.lock] : [];
	}

	public setContents(items: AppearanceItems): ItemModuleLockSlot<TProperties> | null {
		if (items.length > 1)
			return null;

		const lock = items.length === 1 ? items[0] : null;
		if (lock != null && !lock.isType('lock'))
			return null;

		return this.withProps({
			lock,
		});
	}

	public acceptedContentFilter(asset: Asset): boolean {
		return asset.isType('lock');
	}
}
