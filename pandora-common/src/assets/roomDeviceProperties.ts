import { Immutable } from 'immer';
import type { AssetDefinitionExtraArgs } from './definitions';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface RoomDeviceProperties<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> {
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

}

export interface RoomDevicePropertiesResult {
	blockModules: Set<string>;
	blockSelfModules: Set<string>;
}

export function CreateRoomDevicePropertiesResult(): RoomDevicePropertiesResult {
	return {
		blockModules: new Set(),
		blockSelfModules: new Set(),
	};
}

export function MergeRoomDeviceProperties<T extends RoomDevicePropertiesResult>(base: T, properties: Immutable<RoomDeviceProperties>): T {
	properties.blockModules?.forEach((a) => base.blockModules.add(a));
	properties.blockSelfModules?.forEach((a) => base.blockSelfModules.add(a));

	return base;
}
