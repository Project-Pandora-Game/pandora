import type { Immutable } from 'immer';
import { first } from 'lodash';
import { z } from 'zod';

import type { HexRGBAColorString } from '../../validation';
import type { AppearanceModuleActionContext } from '../appearanceActions';
import type { AppearanceItems, AppearanceValidationResult } from '../appearanceValidation';
import type { Asset } from '../asset';
import type { IExportOptions, IItemModule } from '../modules/common';
import type { AssetProperties } from '../properties';
import type { IItemLoadContext, IItemValidationContext, ItemBundle } from './base';

import { CharacterId, CharacterIdSchema } from '../../character/characterTypes';
import { MemoizeNoArg } from '../../utility';
import { ItemModuleAction, LoadItemModule } from '../modules';
import { CreateRoomDevicePropertiesResult, MergeRoomDeviceProperties, RoomDeviceProperties, RoomDevicePropertiesResult } from '../roomDeviceProperties';

import { ItemBase, ItemBaseProps } from './_internal';

declare module './_internal' {
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
	deployed: z.boolean().default(true),
}).catch({
	deployed: false,
	x: 0,
	y: 0,
	yOffset: 0,
});
export type RoomDeviceDeployment = z.infer<typeof RoomDeviceDeploymentSchema>;

export const RoomDeviceDeploymentChangeSchema = z.discriminatedUnion('deployed', [
	z.object({
		deployed: z.literal(false),
	}),
	z.object({
		deployed: z.literal(true),
		position: RoomDeviceDeploymentPositionSchema.optional(),
	}),
]);
export type RoomDeviceDeploymentChange = z.infer<typeof RoomDeviceDeploymentChangeSchema>;

export const RoomDeviceBundleSchema = z.object({
	deployment: RoomDeviceDeploymentSchema,
	/** Which characters have which slots reserved */
	slotOccupancy: z.record(z.string(), CharacterIdSchema),
});
export type RoomDeviceBundle = z.infer<typeof RoomDeviceBundleSchema>;

interface ItemRoomDeviceProps extends ItemBaseProps<'roomDevice'> {
	readonly deployment: Immutable<RoomDeviceDeployment>;
	readonly slotOccupancy: ReadonlyMap<string, CharacterId>;
	readonly modules: ReadonlyMap<string, IItemModule<RoomDeviceProperties>>;
}

export class ItemRoomDevice extends ItemBase<'roomDevice'> implements ItemRoomDeviceProps {
	public readonly deployment: Immutable<RoomDeviceDeployment>;
	public readonly slotOccupancy: ReadonlyMap<string, CharacterId>;
	public readonly modules: ReadonlyMap<string, IItemModule<RoomDeviceProperties>>;

	protected constructor(props: ItemRoomDeviceProps, overrideProps: Partial<ItemRoomDeviceProps> = {}) {
		super(props, overrideProps);
		this.deployment = overrideProps.deployment !== undefined ? overrideProps.deployment : props.deployment;
		this.slotOccupancy = overrideProps?.slotOccupancy ?? props.slotOccupancy;
		this.modules = overrideProps?.modules ?? props.modules;
	}

	public isDeployed(): this is ItemRoomDevice & { deployment: RoomDeviceDeployment & { deployed: true; }; } {
		return this.deployment.deployed;
	}

	protected override withProps(overrideProps: Partial<ItemRoomDeviceProps>): ItemRoomDevice {
		return new ItemRoomDevice(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'roomDevice'>, bundle: ItemBundle, context: IItemLoadContext): ItemRoomDevice {
		// Load modules
		const modules = new Map<string, IItemModule<RoomDeviceProperties>>();
		for (const [moduleName, moduleConfig] of Object.entries(asset.definition.modules ?? {})) {
			modules.set(moduleName, LoadItemModule<RoomDeviceProperties>(moduleConfig, bundle.moduleData?.[moduleName], context));
		}

		// Load device-specific data
		const roomDeviceData: RoomDeviceBundle = bundle.roomDeviceData ?? {
			deployment: {
				x: Math.floor(200 + Math.random() * 800),
				y: 0,
				yOffset: 0,
				deployed: false,
			},
			slotOccupancy: {},
		};

		const deployment = roomDeviceData.deployment;

		const slotOccupancy = new Map<string, CharacterId>();
		// Skip occupied slots if we are not deployed
		if (deployment.deployed) {
			for (const slot of Object.keys(asset.definition.slots)) {
				if (roomDeviceData.slotOccupancy[slot] != null) {
					slotOccupancy.set(slot, roomDeviceData.slotOccupancy[slot]);
				}
			}
		}

		return new ItemRoomDevice({
			...(ItemBase._parseBundle(asset, bundle, context)),
			modules,
			deployment,
			slotOccupancy,
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
				},
			};

		return { success: true };
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
			},
		};
	}

	/** Colors this item with passed color, returning new item with modified color */
	public changeDeployment(newDeployment: RoomDeviceDeploymentChange): ItemRoomDevice {
		if (!newDeployment.deployed) {
			if (!this.isDeployed())
				return this;

			return this.withProps({
				deployment: {
					...this.deployment,
					deployed: false,
				},
				slotOccupancy: new Map(),
			});
		}
		if (newDeployment.position != null) {
			return this.withProps({
				deployment: {
					...newDeployment.position,
					deployed: true,
				},
			});
		}
		return this.withProps({
			deployment: {
				...this.deployment,
				deployed: true,
			},
		});
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

	public override getModules(): ReadonlyMap<string, IItemModule<RoomDeviceProperties>> {
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

	@MemoizeNoArg
	public getRoomDevicePropertiesParts(): readonly Immutable<RoomDeviceProperties>[] {
		const propertyParts: Immutable<AssetProperties>[] = [
			...Array.from(this.modules.values()).flatMap((m) => m.getProperties()),
		];

		return propertyParts;
	}

	@MemoizeNoArg
	public getRoomDeviceProperties(): RoomDevicePropertiesResult {
		return this.getRoomDevicePropertiesParts()
			.reduce(MergeRoomDeviceProperties, CreateRoomDevicePropertiesResult());
	}
}
