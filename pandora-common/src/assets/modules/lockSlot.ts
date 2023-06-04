import { Asset } from '../asset';
import { IAssetModuleDefinition, IItemModule, IModuleItemDataCommon, IModuleConfigCommon } from './common';
import { z } from 'zod';
import { AssetDefinitionExtraArgs, AssetId } from '../definitions';
import { ConditionOperator } from '../graphics';
import { AssetProperties } from '../properties';
import { CharacterRestrictionsManager, ItemInteractionType, RestrictionResult } from '../../character/restrictionsManager';
import { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import { CreateItem, IItemLoadContext, IItemLocationDescriptor, ItemBundle, ItemBundleSchema, ItemLock } from '../item';
import { AssetManager } from '../assetManager';
import type { AppearanceActionContext } from '../appearanceActions';
import type { ActionMessageTemplateHandler, RoomActionTarget } from '../appearanceTypes';
import { Assert, AssertNever } from '../../utility';

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
	action: z.discriminatedUnion('moduleAction', [
		z.object({
			moduleAction: z.literal('lock'),
		}),
		z.object({
			moduleAction: z.literal('unlock'),
		}),
	]),
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

	public loadModule(asset: Asset, moduleName: string, config: IModuleConfigLockSlot, data: IModuleItemDataLockSlot, context: IItemLoadContext): ItemModuleLockSlot {
		return new ItemModuleLockSlot(config, { asset: asset.id, module: moduleName }, data, context);
	}

	public getStaticAttributes(config: IModuleConfigLockSlot): ReadonlySet<string> {
		const result = new Set<string>();
		config.emptyEffects?.attributes?.forEach((a) => result.add(a));
		config.occupiedEffects?.attributes?.forEach((a) => result.add(a));
		config.lockedEffects?.attributes?.forEach((a) => result.add(a));
		return result;
	}
}

type ParentInfo = {
	asset: AssetId;
	module: string;
};

export class ItemModuleLockSlot implements IItemModule<'lockSlot'> {
	public readonly type = 'lockSlot';

	private readonly assetManager: AssetManager;
	public readonly config: IModuleConfigLockSlot;
	public readonly lock: ItemLock | null;
	public readonly parent: Readonly<ParentInfo>;

	public get interactionType(): ItemInteractionType {
		return ItemInteractionType.MODIFY;
	}

	constructor(config: IModuleConfigLockSlot, parent: Readonly<ParentInfo>, data: IModuleItemDataLockSlot, context: IItemLoadContext) {
		this.assetManager = context.assetManager;
		this.config = config;
		this.parent = parent;
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

	public canDoAction(source: CharacterRestrictionsManager, target: RoomActionTarget, fullAction: ItemModuleLockSlotAction | undefined, interaction: ItemInteractionType): RestrictionResult {
		if (fullAction == null) {
			if (interaction !== ItemInteractionType.ACCESS_ONLY && this.lock?.isLocked() && !source.isInSafemode()) {
				return {
					allowed: false,
					restriction: {
						type: 'blockedModule',
						self: false,
						...this.parent,
					},
				};
			}
			return { allowed: true };
		}

		if (interaction !== this.interactionType || this.lock == null) {
			return {
				allowed: false,
				restriction: { type: 'invalid' },
			};
		}

		const action = fullAction.action;
		const isSelfAction = target.type === 'character' && target.character.id === source.character.id;
		const properties = this.lock.getLockProperties();

		if (properties.blockSelf && isSelfAction && !source.isInSafemode()) {
			return {
				allowed: false,
				restriction: {
					type: 'blockedModuleAction',
					moduleType: 'lockSlot',
					moduleAction: action.moduleAction,
					reason: 'blockSelf',
					asset: this.lock.asset.id,
				},
			};
		}

		return { allowed: true };
	}

	public doAction(_context: AppearanceActionContext, { action }: ItemModuleLockSlotAction, messageHandler: ActionMessageTemplateHandler): ItemModuleLockSlot | null {
		if (this.lock == null)
			return null;

		let lock: ItemLock | null = null;
		let message: string | undefined;

		switch (action.moduleAction) {
			case 'lock':
				if (this.lock.isLocked())
					return null;

				lock = this.lock.lock();
				if (lock == null)
					return null;

				message = lock.asset.definition.chat?.actionLock;
				break;
			case 'unlock':
				if (!this.lock.isLocked())
					return null;

				lock = this.lock.unlock();
				if (lock == null)
					return null;

				message = lock.asset.definition.chat?.actionUnlock;
				break;
			default:
				AssertNever(action);
		}
		if (lock == null)
			return null;

		if (message != null) {
			messageHandler({
				id: 'custom',
				customText: message,
			});
		}

		return new ItemModuleLockSlot(this.config, this.parent, {
			type: 'lockSlot',
			lock: lock.exportToBundle(),
		}, {
			assetManager: this.assetManager,
			doLoadTimeCleanup: false,
		});
	}

	public readonly contentsPhysicallyEquipped: boolean = true;

	public getContents(): AppearanceItems {
		return this.lock ? [this.lock] : [];
	}

	public setContents(items: AppearanceItems): ItemModuleLockSlot | null {
		if (items.length > 1)
			return null;

		return new ItemModuleLockSlot(this.config, this.parent, {
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
