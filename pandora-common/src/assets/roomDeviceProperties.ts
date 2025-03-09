import type { Immutable } from 'immer';
import type { AssetDefinitionExtraArgs } from './definitions.ts';
import type { AssetProperties } from './properties.ts';

export interface RoomDeviceProperties<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> {
	/**
	 * Properties for individual slots.
	 * @default {}
	 */
	slotProperties?: Partial<Record<string, AssetProperties<A>>>;

	/**
	 * Flags allowing to limit which item's state combinations are valid.
	 * Flags only operate within a single item, they do not affect other items.
	 */
	stateFlags?: {
		/**
		 * State flags this state gives.
		 * @default []
		 * @example
		 * ['strap']
		 */
		provides?: string[];

		/**
		 * Flags that this state requires.
		 *
		 * Format is a record of <`flag`, `description if not met`>.
		 * @default {}
		 * @example
		 * {
		 *     strap: 'This option requires a strap to be present.',
		 * }
		 */
		requires?: { [flag: string]: string; };
	};

	/**
	 * Prevents listed modules from being modified by anyone, including on oneself
	 * @default []
	 */
	blockModules?: string[];

	/**
	 * Prevents listed modules from being modified by anyone wearing this item
	 * @default []
	 */
	blockSelfModules?: string[];

	/**
	 * Prevents this slot from being entered or exited by anyone, including on oneself
	 * @default false
	 */
	blockSlotsEnterLeave?: string[];

	/**
	 * Prevents this slot from being entered or exited by the character herself
	 * @default false
	 */
	blockSlotsSelfEnterLeave?: string[];
}

export interface RoomDevicePropertiesResult {
	slotProperties: Partial<Record<string, Immutable<AssetProperties>[]>>;
	stateFlags: Set<string>;
	stateFlagsRequirements: Map<string, string>;
	blockModules: Set<string>;
	blockSelfModules: Set<string>;
	blockSlotsEnterLeave: Set<string>;
	blockSlotsSelfEnterLeave: Set<string>;
}

export function CreateRoomDevicePropertiesResult(): RoomDevicePropertiesResult {
	return {
		slotProperties: {},
		stateFlags: new Set(),
		stateFlagsRequirements: new Map(),
		blockModules: new Set(),
		blockSelfModules: new Set(),
		blockSlotsEnterLeave: new Set(),
		blockSlotsSelfEnterLeave: new Set(),
	};
}

export function MergeRoomDeviceProperties<T extends RoomDevicePropertiesResult>(base: T, properties: Immutable<RoomDeviceProperties>): T {
	for (const [slot, slotProperties] of Object.entries(properties.slotProperties ?? {})) {
		if (slotProperties == null)
			continue;

		(base.slotProperties[slot] ??= []).push(slotProperties);
	}

	properties.stateFlags?.provides?.forEach((a) => base.stateFlags.add(a));
	// Merge required flags. The requirement reasons are simply concatenated (with a space between)
	for (const [flag, reason] of Object.entries(properties.stateFlags?.requires ?? {})) {
		const currentReason = base.stateFlagsRequirements.get(flag);
		base.stateFlagsRequirements.set(flag, (currentReason ? `${currentReason} ` : '') + reason);
	}

	properties.blockModules?.forEach((a) => base.blockModules.add(a));
	properties.blockSelfModules?.forEach((a) => base.blockSelfModules.add(a));
	properties.blockSlotsEnterLeave?.forEach((a) => base.blockSlotsEnterLeave.add(a));
	properties.blockSlotsSelfEnterLeave?.forEach((a) => base.blockSlotsSelfEnterLeave.add(a));

	return base;
}

export function GetPropertiesForSlot(deviceProperties: RoomDevicePropertiesResult, slot: string): Immutable<AssetProperties>[] {
	const result: Immutable<AssetProperties>[] = [];

	const slotProperties = deviceProperties.slotProperties[slot];
	if (slotProperties != null) {
		result.push(...slotProperties);
	}

	result.push({
		blockAddRemove: deviceProperties.blockSlotsEnterLeave.has(slot),
		blockSelfAddRemove: deviceProperties.blockSlotsSelfEnterLeave.has(slot),
	});

	return result;
}
