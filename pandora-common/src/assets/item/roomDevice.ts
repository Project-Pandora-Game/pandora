import type { Immutable } from 'immer';
import { first } from 'lodash-es';
import * as z from 'zod';

import type { AppearanceModuleActionContext } from '../../gameLogic/actionLogic/appearanceActions.ts';
import type { HexRGBAColorString } from '../../validation.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { Asset } from '../asset.ts';
import type { RoomDeviceModuleStaticData } from '../definitions.ts';
import type { IExportOptions, IItemModule } from '../modules/common.ts';
import type { AssetProperties } from '../properties.ts';
import type { IItemLoadContext, IItemValidationContext, ItemBundle, ItemTemplate } from './base.ts';
import type { AppearanceItems } from './items.ts';

import { CharacterId, CharacterIdSchema } from '../../character/characterTypes.ts';
import { MemoizeNoArg } from '../../utility/misc.ts';
import { ItemModuleAction, LoadItemModule } from '../modules.ts';
import { CreateRoomDevicePropertiesResult, MergeRoomDeviceProperties, RoomDeviceProperties, RoomDevicePropertiesResult } from '../roomDeviceProperties.ts';
import { QueryStateFlagCombinations, StateFlagCombinationRoomDevicePropertiesGetter } from '../stateFlags.ts';

import type { AppearanceActionProcessingContext } from '../../gameLogic/index.ts';
import { ItemBase, ItemBaseProps } from './_internal.ts';

declare module './_internal.ts' {
	interface InternalItemTypeMap {
		roomDevice: ItemRoomDevice;
	}
}

export const RoomDeviceDeploymentPositionSchema = z.object({
	x: z.number(),
	y: z.number(),
	yOffset: z.number().int().catch(0),
});
export type RoomDeviceDeploymentPosition = z.infer<typeof RoomDeviceDeploymentPositionSchema>;

export const RoomDeviceDeploymentSchema = RoomDeviceDeploymentPositionSchema.extend({
	deployed: z.boolean(),
}).catch({
	deployed: false,
	x: 0,
	y: 0,
	yOffset: 0,
});
export type RoomDeviceDeployment = z.infer<typeof RoomDeviceDeploymentSchema>;

export const RoomDeviceDeploymentChangeSchema = z.object({
	deployed: z.boolean(),
	position: RoomDeviceDeploymentPositionSchema.optional(),
});
export type RoomDeviceDeploymentChange = z.infer<typeof RoomDeviceDeploymentChangeSchema>;

/**
 * Defines when room device's interaction button is visible:
 * - `auto` - Decide automatically based on whether the device has character slots or not
 * - `show` - Show the button
 * - `hide` - Do not show the button normally, but show it in construction mode
 * - `hideAlways` - Always hide the button (even in construction mode)
 */
export const RoomDeviceInteractionVisibilitySchema = z.enum(['auto', 'show', 'hide', 'hideAlways']);
/**
 * Defines when room device's interaction button is visible:
 * - `auto` - Decide automatically based on whether the device has character slots or not
 * - `show` - Show the button
 * - `hide` - Do not show the button normally, but show it in construction mode
 * - `hideAlways` - Always hide the button (even in construction mode)
 */
export type RoomDeviceInteractionVisibility = z.infer<typeof RoomDeviceInteractionVisibilitySchema>;

export const RoomDeviceBundleSchema = z.object({
	deployment: RoomDeviceDeploymentSchema,
	/** Which characters have which slots reserved */
	slotOccupancy: z.record(z.string(), CharacterIdSchema),
	/** Controls visibility of the interaction button in the room UI */
	interactionVisibility: RoomDeviceInteractionVisibilitySchema.catch('auto'),
});
export type RoomDeviceBundle = z.infer<typeof RoomDeviceBundleSchema>;

interface ItemRoomDeviceProps extends ItemBaseProps<'roomDevice'> {
	readonly deployment: Immutable<RoomDeviceDeployment>;
	readonly slotOccupancy: ReadonlyMap<string, CharacterId>;
	readonly modules: ReadonlyMap<string, IItemModule<RoomDeviceProperties, RoomDeviceModuleStaticData>>;
	readonly requireFreeHandsToUse: boolean;
	readonly interactionVisibility: RoomDeviceInteractionVisibility;
}

export class ItemRoomDevice extends ItemBase<'roomDevice'> implements ItemRoomDeviceProps {
	public readonly deployment: Immutable<RoomDeviceDeployment>;
	public readonly slotOccupancy: ReadonlyMap<string, CharacterId>;
	public readonly modules: ReadonlyMap<string, IItemModule<RoomDeviceProperties, RoomDeviceModuleStaticData>>;
	public readonly requireFreeHandsToUse: boolean;
	public readonly interactionVisibility: RoomDeviceInteractionVisibility;

	protected constructor(props: ItemRoomDeviceProps, overrideProps: Partial<ItemRoomDeviceProps> = {}) {
		super(props, overrideProps);
		this.deployment = overrideProps.deployment !== undefined ? overrideProps.deployment : props.deployment;
		this.slotOccupancy = overrideProps?.slotOccupancy ?? props.slotOccupancy;
		this.modules = overrideProps?.modules ?? props.modules;
		this.requireFreeHandsToUse = overrideProps?.requireFreeHandsToUse ?? props.requireFreeHandsToUse;
		this.interactionVisibility = overrideProps?.interactionVisibility ?? props.interactionVisibility;
	}

	public isDeployed(): this is ItemRoomDevice & { deployment: RoomDeviceDeployment & { deployed: true; }; } {
		return this.deployment.deployed;
	}

	protected override withProps(overrideProps: Partial<ItemRoomDeviceProps>): ItemRoomDevice {
		return new ItemRoomDevice(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'roomDevice'>, bundle: ItemBundle, context: IItemLoadContext): ItemRoomDevice {
		// Load modules
		const modules = new Map<string, IItemModule<RoomDeviceProperties, RoomDeviceModuleStaticData>>();
		for (const [moduleName, moduleConfig] of Object.entries(asset.definition.modules ?? {})) {
			modules.set(moduleName, LoadItemModule<RoomDeviceProperties, RoomDeviceModuleStaticData>(moduleConfig, bundle.moduleData?.[moduleName], context));
		}

		// Load device-specific data
		const roomDeviceData: RoomDeviceBundle = bundle.roomDeviceData ?? {
			deployment: {
				deployed: false,
				x: Math.floor(200 + Math.random() * 800),
				y: 0,
				yOffset: 0,
			},
			slotOccupancy: {},
			interactionVisibility: 'auto',
		};

		const deployment = roomDeviceData.deployment;
		const interactionVisibility = roomDeviceData.interactionVisibility;

		const slotOccupancy = new Map<string, CharacterId>();
		// Skip occupied slots if we are not deployed
		if (deployment.deployed) {
			for (const slot of Object.keys(asset.definition.slots)) {
				if (roomDeviceData.slotOccupancy[slot] != null) {
					slotOccupancy.set(slot, roomDeviceData.slotOccupancy[slot]);
				}
			}
		}

		const requireFreeHandsToUse = bundle.requireFreeHandsToUse ?? true;

		return new ItemRoomDevice({
			...(ItemBase._parseBundle(asset, bundle, context)),
			modules,
			deployment,
			slotOccupancy,
			requireFreeHandsToUse,
			interactionVisibility,
		});
	}

	public override validate(context: IItemValidationContext): AppearanceValidationResult {
		{
			const r = super.validate(context);
			if (!r.success)
				return r;
		}

		const deviceProperties = this.getRoomDeviceProperties();

		// Check that the item's internal state is valid
		for (const [flag, reason] of deviceProperties.stateFlagsRequirements.entries()) {
			if (!deviceProperties.stateFlags.has(flag)) {
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

		// Deployed room devices must be in a room
		if (this.isDeployed() && context.location !== 'roomInventory')
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
					itemName: this.name ?? '',
				},
			};

		return { success: true };
	}

	public override checkAllowTransfer(context: AppearanceActionProcessingContext): void {
		// Moving deployed room devices between inventories requires role as specified by global room settings
		if (this.isDeployed()) {
			context.checkPlayerHasSpaceRole(context.getEffectiveRoomSettings(null).roomDeviceDeploymentMinimumRole);
		}
	}

	public override exportToTemplate(): ItemTemplate {
		return {
			...super.exportToTemplate(),
			requireFreeHandsToUse: this.requireFreeHandsToUse,
		};
	}

	public override exportToBundle(options: IExportOptions): ItemBundle & { roomDeviceData: RoomDeviceBundle; } {
		const slotOccupancy: RoomDeviceBundle['slotOccupancy'] = {};
		for (const [slot, character] of this.slotOccupancy.entries()) {
			slotOccupancy[slot] = character;
		}
		return {
			...super.exportToBundle(options),
			roomDeviceData: {
				deployment: this.deployment,
				slotOccupancy,
				interactionVisibility: this.interactionVisibility,
			},
			requireFreeHandsToUse: this.requireFreeHandsToUse,
		};
	}

	/** Colors this item with passed color, returning new item with modified color */
	public changeDeployment(newDeployment: RoomDeviceDeploymentChange): ItemRoomDevice {
		if (newDeployment.position != null) {
			return this.withProps({
				deployment: {
					x: newDeployment.position.x,
					y: newDeployment.position.y,
					yOffset: newDeployment.position.yOffset,
					deployed: newDeployment.deployed,
				},
				slotOccupancy: newDeployment.deployed ? this.slotOccupancy : new Map(),
			});
		} else if (newDeployment.deployed !== this.deployment.deployed) {
			return this.withProps({
				deployment: {
					...this.deployment,
					deployed: newDeployment.deployed,
				},
				slotOccupancy: newDeployment.deployed ? this.slotOccupancy : new Map(),
			});
		}

		return this;
	}

	public changeSlotOccupancy(slot: string, character: CharacterId | null): ItemRoomDevice | null {
		// The slot must exist and the device must be deployed
		if (this.asset.definition.slots[slot] == null || !this.isDeployed())
			return null;

		const slotOccupancy = new Map(this.slotOccupancy);
		if (character == null) {
			slotOccupancy.delete(slot);
		} else {
			slotOccupancy.set(slot, character);
		}

		return this.withProps({
			slotOccupancy,
		});
	}

	public resolveColor(colorizationKey: string): HexRGBAColorString | undefined {
		const colorization = this.asset.definition.colorization?.[colorizationKey];
		if (!colorization)
			return undefined;

		const color = this.color[colorizationKey];
		if (color)
			return color;

		return colorization.default;
	}

	public getColorRibbon(): HexRGBAColorString | undefined {
		return this.resolveColor(
			this.asset.definition.colorRibbonGroup ??
			first(Object.keys(this.asset.definition.colorization ?? {})) ??
			'',
		);
	}

	public override getModules(): ReadonlyMap<string, IItemModule<RoomDeviceProperties, RoomDeviceModuleStaticData>> {
		return this.modules;
	}

	public override moduleAction(context: AppearanceModuleActionContext, moduleName: string, action: ItemModuleAction): ItemRoomDevice | null {
		const module = this.modules.get(moduleName);
		if (!module || module.type !== action.moduleType)
			return null;
		const moduleResult = module.doAction(context, action);
		if (!moduleResult)
			return null;

		const newModules = new Map(this.modules);
		newModules.set(moduleName, moduleResult);

		return this.withProps({
			modules: newModules,
		});
	}

	public override setModuleItems(moduleName: string, items: AppearanceItems): ItemRoomDevice | null {
		const moduleResult = this.modules.get(moduleName)?.setContents(items);
		if (!moduleResult)
			return null;

		const newModules = new Map(this.modules);
		newModules.set(moduleName, moduleResult);

		return this.withProps({
			modules: newModules,
		});
	}

	/** Returns a new item with the passed requireFreeHandsToUse attribute */
	public customizeFreeHandUsage(requireFreeHandsToUse: boolean): ItemRoomDevice {
		return this.withProps({ requireFreeHandsToUse });
	}

	/** Returns a new item with the passed interactionVisibility setting */
	public customizeInteractionVisibility(interactionVisibility: RoomDeviceInteractionVisibility): ItemRoomDevice {
		return this.withProps({ interactionVisibility });
	}

	@MemoizeNoArg
	public getRoomDevicePropertiesParts(): readonly Immutable<RoomDeviceProperties>[] {
		const propertyParts: Immutable<AssetProperties>[] = [
			...Array.from(this.modules.values()).flatMap((m) => m.getProperties()),
		];

		const flags = new Set<string>();
		for (const part of propertyParts) {
			if (part.stateFlags?.provides !== undefined) {
				for (const flag of part.stateFlags.provides) {
					flags.add(flag);
				}
			}
		}
		const { stateFlagCombinations } = this.asset.definition;
		if (stateFlagCombinations !== undefined) {
			propertyParts.push(...QueryStateFlagCombinations<RoomDeviceProperties>(stateFlagCombinations, flags, StateFlagCombinationRoomDevicePropertiesGetter));
		}

		return propertyParts;
	}

	@MemoizeNoArg
	public getRoomDeviceProperties(): RoomDevicePropertiesResult {
		return this.getRoomDevicePropertiesParts()
			.reduce(MergeRoomDeviceProperties, CreateRoomDevicePropertiesResult());
	}
}
