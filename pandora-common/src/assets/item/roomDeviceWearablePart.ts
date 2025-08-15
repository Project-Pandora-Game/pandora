import type { Immutable } from 'immer';
import { z } from 'zod';

import type { HexRGBAColorString } from '../../validation.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { Asset } from '../asset.ts';
import type { IExportOptions } from '../modules/common.ts';
import type { AssetProperties } from '../properties.ts';
import { ItemIdSchema, type IItemLoadContext, type IItemValidationContext, type ItemBundle, type ItemTemplate } from './base.ts';
import type { ItemRoomDevice } from './roomDevice.ts';

import { Assert, MemoizeNoArg } from '../../utility/misc.ts';
import { GetPropertiesForSlot, RoomDevicePropertiesResult } from '../roomDeviceProperties.ts';

import type { AppearanceActionProcessingContext } from '../../gameLogic/index.ts';
import { ItemBase, ItemBaseProps } from './_internal.ts';

declare module './_internal.ts' {
	interface InternalItemTypeMap {
		roomDeviceWearablePart: ItemRoomDeviceWearablePart;
	}
}

export const RoomDeviceLinkSchema = z.object({
	device: ItemIdSchema,
	slot: z.string(),
});
export type RoomDeviceLink = z.infer<typeof RoomDeviceLinkSchema>;

interface ItemRoomDeviceWearablePartProps extends ItemBaseProps<'roomDeviceWearablePart'> {
	readonly roomDeviceLink: Immutable<RoomDeviceLink> | null;
	readonly roomDevice: ItemRoomDevice | null;
}
export class ItemRoomDeviceWearablePart extends ItemBase<'roomDeviceWearablePart'> implements ItemRoomDeviceWearablePartProps {
	public readonly roomDeviceLink: Immutable<RoomDeviceLink> | null;
	public readonly roomDevice: ItemRoomDevice | null;

	protected constructor(props: ItemRoomDeviceWearablePartProps, overrideProps?: Partial<ItemRoomDeviceWearablePartProps>) {
		super(props, overrideProps);

		this.roomDeviceLink = overrideProps?.roomDeviceLink !== undefined ? overrideProps.roomDeviceLink : props.roomDeviceLink;
		this.roomDevice = overrideProps?.roomDevice !== undefined ? overrideProps.roomDevice : props.roomDevice;
	}

	protected override withProps(overrideProps: Partial<ItemRoomDeviceWearablePartProps>): ItemRoomDeviceWearablePart {
		return new ItemRoomDeviceWearablePart(this, overrideProps);
	}

	public static loadFromBundle(asset: Asset<'roomDeviceWearablePart'>, bundle: ItemBundle, context: IItemLoadContext): ItemRoomDeviceWearablePart {
		return new ItemRoomDeviceWearablePart({
			...(ItemBase._parseBundle(asset, bundle, context)),
			roomDeviceLink: bundle.roomDeviceLink ?? null,
			roomDevice: null,
		});
	}

	public override validate(context: IItemValidationContext): AppearanceValidationResult {
		{
			const r = super.validate(context);
			if (!r.success)
				return r;
		}

		// Room device wearable parts must be worn
		if (context.location !== 'worn')
			return {
				success: false,
				error: {
					problem: 'contentNotAllowed',
					asset: this.asset.id,
					itemName: this.name ?? '',
				},
			};

		// We must have a valid link
		if (this.roomDeviceLink == null)
			return {
				success: false,
				error: {
					problem: 'invalid',
				},
			};

		const device = context.roomState?.items.find((item) => item.isType('roomDevice') && item.id === this.roomDeviceLink?.device);
		if (
			// Target device must exist
			(device == null || device !== this.roomDevice) ||
			// The device must have a matching slot
			(device.asset.definition.slots[this.roomDeviceLink.slot]?.wearableAsset !== this.asset.id) ||
			// The device must be deployed with this character in target slot
			// TODO: We have no way to check that the character in the slot is us, because we don't have the character ID at this point
			(!device.isDeployed() || !device.slotOccupancy.has(this.roomDeviceLink.slot))
		) {
			return {
				success: false,
				error: {
					problem: 'invalid',
				},
			};
		}

		return { success: true };
	}

	public override checkAllowTransfer(context: AppearanceActionProcessingContext): void {
		// Wearable device part can never be moved
		context.addProblem({ result: 'invalidAction' });
	}

	public override exportToTemplate(): ItemTemplate {
		// Wearable part should create template of the device itself, not the wearable part
		if (this.roomDevice != null)
			return this.roomDevice.exportToTemplate();

		// Fallback to creating the template of the wearable part (no one will be able to use it anyway and we avoid errors)
		return super.exportToTemplate();
	}

	public override exportToBundle(options: IExportOptions): ItemBundle {
		return {
			...super.exportToBundle(options),
			roomDeviceLink: this.roomDeviceLink ?? undefined,
		};
	}

	public withLink(device: ItemRoomDevice, slot: string): ItemRoomDeviceWearablePart {
		return this.withProps({
			roomDeviceLink: {
				device: device.id,
				slot,
			},
			roomDevice: device,
		});
	}

	public updateRoomStateLink(roomDevice: ItemRoomDevice | null): ItemRoomDeviceWearablePart {
		Assert(roomDevice == null || this.roomDeviceLink?.device === roomDevice.id);
		if (this.roomDevice === roomDevice)
			return this;

		return this.withProps({
			roomDevice,
		});
	}

	public resolveColor(colorizationKey: string): HexRGBAColorString | undefined {
		return this.roomDevice?.resolveColor(colorizationKey);
	}

	public getColorRibbon(): HexRGBAColorString | undefined {
		return this.roomDevice?.getColorRibbon();
	}

	@MemoizeNoArg
	public override getPropertiesParts(): readonly Immutable<AssetProperties>[] {
		const deviceProperties: RoomDevicePropertiesResult | undefined = this.roomDevice?.getRoomDeviceProperties();

		return [
			...super.getPropertiesParts(),
			...(deviceProperties != null ? GetPropertiesForSlot(deviceProperties, this.roomDeviceLink!.slot) : []),
		];
	}
}
