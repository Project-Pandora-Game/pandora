import { Immutable } from 'immer';
import { z } from 'zod';
import { ItemInteractionType } from '../../character/restrictionTypes';
import type { AppearanceModuleActionContext } from '../../gameLogic/actionLogic/appearanceActions';
import type { InteractionId } from '../../gameLogic/interactions';
import { LockActionSchema } from '../../gameLogic/locks/lockLogic';
import { AssertNever, Satisfies } from '../../utility/misc';
import { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { Asset } from '../asset';
import type { AssetManager } from '../assetManager';
import { ConditionOperator } from '../graphics';
import { __internal_ItemBundleSchemaRecursive, __internal_ItemTemplateSchemaRecursive } from '../item/_internalRecursion';
import { IItemCreationContext, IItemLoadContext, IItemValidationContext } from '../item/base';
import { ItemLock } from '../item/lock';
import type { IAssetModuleDefinition, IExportOptions, IItemModule, IModuleActionCommon, IModuleConfigCommon, IModuleItemDataCommon } from './common';

export type IModuleConfigLockSlot<TProperties, TStaticData> = IModuleConfigCommon<'lockSlot', TProperties, TStaticData> & {
	/** Properties applied when this slot isn't occupied by a lock */
	emptyProperties?: TProperties;
	/** Properties applied when this slot is occupied by a lock */
	occupiedProperties?: TProperties;
	/** Properties applied when the slot is occupied and locked, default to occupiedEffects */
	lockedProperties?: TProperties;
};

export const ModuleItemDataLockSlotSchema = z.object({
	type: z.literal('lockSlot'),
	lock: __internal_ItemBundleSchemaRecursive.nullable(),
});
export type IModuleItemDataLockSlot = Satisfies<z.infer<typeof ModuleItemDataLockSlotSchema>, IModuleItemDataCommon<'lockSlot'>>;

export const ModuleItemTemplateLockSlotSchema = z.object({
	type: z.literal('lockSlot'),
	lock: __internal_ItemTemplateSchemaRecursive.nullable(),
});
export type IModuleItemTemplateLockSlot = z.infer<typeof ModuleItemTemplateLockSlotSchema>;

export const ItemModuleLockSlotActionSchema = z.object({
	moduleType: z.literal('lockSlot'),
	lockAction: z.lazy(() => LockActionSchema),
});
export type ItemModuleLockSlotAction = Satisfies<z.infer<typeof ItemModuleLockSlotActionSchema>, IModuleActionCommon<'lockSlot'>>;

export class LockSlotModuleDefinition implements IAssetModuleDefinition<'lockSlot'> {
	public makeDefaultData<TProperties, TStaticData>(_config: Immutable<IModuleConfigLockSlot<TProperties, TStaticData>>): IModuleItemDataLockSlot {
		return {
			type: 'lockSlot',
			lock: null,
		};
	}

	public makeDataFromTemplate<TProperties, TStaticData>(_config: Immutable<IModuleConfigLockSlot<TProperties, TStaticData>>, template: IModuleItemTemplateLockSlot, context: IItemCreationContext): IModuleItemDataLockSlot {
		return {
			type: 'lockSlot',
			lock: template.lock != null ? (context.createItemBundleFromTemplate(template.lock, context) ?? null) : null,
		};
	}

	public loadModule<TProperties, TStaticData>(config: Immutable<IModuleConfigLockSlot<TProperties, TStaticData>>, data: IModuleItemDataLockSlot, context: IItemLoadContext): ItemModuleLockSlot<TProperties, TStaticData> {
		return ItemModuleLockSlot.loadFromData(config, data, context);
	}

	public getStaticAttributes<TProperties, TStaticData>(config: Immutable<IModuleConfigLockSlot<TProperties, TStaticData>>, staticAttributesExtractor: (properties: Immutable<TProperties>) => ReadonlySet<string>): ReadonlySet<string> {
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

interface ItemModuleLockSlotProps<TProperties, TStaticData> {
	readonly assetManager: AssetManager;
	readonly config: Immutable<IModuleConfigLockSlot<TProperties, TStaticData>>;
	readonly lock: ItemLock | null;
}

export class ItemModuleLockSlot<out TProperties = unknown, out TStaticData = unknown> implements IItemModule<TProperties, TStaticData, 'lockSlot'>, ItemModuleLockSlotProps<TProperties, TStaticData> {
	public readonly type = 'lockSlot';

	public readonly assetManager: AssetManager;
	public readonly config: Immutable<IModuleConfigLockSlot<TProperties, TStaticData>>;
	public readonly lock: ItemLock | null;

	public get interactionType(): ItemInteractionType {
		return ItemInteractionType.MODIFY;
	}

	public readonly interactionId: InteractionId = 'useLockSlotModule';

	protected constructor(props: ItemModuleLockSlotProps<TProperties, TStaticData>, overrideProps?: Partial<ItemModuleLockSlotProps<TProperties, TStaticData>>) {
		this.assetManager = overrideProps?.assetManager ?? props.assetManager;
		this.config = overrideProps?.config ?? props.config;
		this.lock = overrideProps?.lock !== undefined ? overrideProps.lock : props.lock;
	}

	protected withProps(overrideProps: Partial<ItemModuleLockSlotProps<TProperties, TStaticData>>): ItemModuleLockSlot<TProperties, TStaticData> {
		return new ItemModuleLockSlot(this, overrideProps);
	}

	public static loadFromData<TProperties, TStaticData>(config: Immutable<IModuleConfigLockSlot<TProperties, TStaticData>>, data: IModuleItemDataLockSlot, context: IItemLoadContext): ItemModuleLockSlot<TProperties, TStaticData> {
		let lock: ItemModuleLockSlotProps<TProperties, TStaticData>['lock'];

		if (data.lock) {
			// Load asset and skip if unknown
			const asset = context.assetManager.getAssetById(data.lock.asset);
			if (asset === undefined) {
				context.logger?.warning(`Skipping unknown lock asset ${data.lock.asset}`);
				lock = null;
			} else {
				const item = context.loadItemFromBundle(
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

	public doAction(context: AppearanceModuleActionContext, { lockAction }: ItemModuleLockSlotAction): ItemModuleLockSlot<TProperties, TStaticData> | null {
		if (this.lock == null)
			return null;

		if (this.lock == null)
			return null;

		const lock = this.lock;
		const result = lock.lockAction({
			...context,
			messageHandler: (message) => {
				// Add this container step to the message
				message.itemContainerPath ??= [];
				message.itemContainerPath?.unshift({ assetId: context.item.asset.id, module: context.moduleName, itemName: context.item.name ?? '' });
				message.item ??= {
					assetId: lock.asset.id,
					itemName: lock.name ?? '',
				};
				context.messageHandler(message);
			},
		}, lockAction);
		if (result == null)
			return result;

		return this.withProps({
			lock: result,
		});
	}

	public getActionInteractionType({ lockAction }: ItemModuleLockSlotAction): ItemInteractionType {
		switch (lockAction.action) {
			case 'lock':
			case 'unlock':
				return this.interactionType;
			case 'showPassword':
				return ItemInteractionType.ACCESS_ONLY;
			default:
				AssertNever(lockAction);
		}
	}

	public readonly contentsPhysicallyEquipped: boolean = true;

	public getContents(): AppearanceItems {
		return this.lock ? [this.lock] : [];
	}

	public setContents(items: AppearanceItems): ItemModuleLockSlot<TProperties, TStaticData> | null {
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
