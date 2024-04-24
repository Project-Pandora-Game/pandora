import { AssetDefinition, AssetFrameworkGlobalState, AssetFrameworkRoomState, AssetId, AssetManager, CharacterId, GetDefaultAppearancePose, ItemBundle, ItemId, RoomDeviceAssetDefinition, type AppearanceBundle, type RoomDeviceLink, type RoomDeviceWearablePartAssetDefinition } from '../src';

export function CreateGlobalState({
	assetManager = CreateAssetManager({}),
	characters = {},
	items = [],
}: {
	assetManager?: AssetManager;
	characters?: Record<CharacterId, AppearanceBundle>;
	items?: ItemBundle[];
}): AssetFrameworkGlobalState {
	return AssetFrameworkGlobalState.loadFromBundle(assetManager, { characters, room: { items } }, undefined);
}

export function CreateRoomState({
	assetManager = CreateAssetManager({}),
	items = [],
}: {
	assetManager?: AssetManager;
	items?: ItemBundle[];
}): AssetFrameworkRoomState {
	return AssetFrameworkRoomState.loadFromBundle(assetManager, { items }, undefined);
}

export function CreateAssetManager({ assets = [] }: { assets?: AssetDefinition[]; }): AssetManager {
	return new AssetManager('', {
		assets: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
	});
}

export function CreateRoomDeviceAssetDefinition({
	id,
	slots,
}: {
	id: AssetId;
	slots: Record<string, { name?: string; wearableAsset: AssetId; }>;
}): RoomDeviceAssetDefinition {
	return {
		type: 'roomDevice',
		id,
		name: '',
		size: 'medium',
		pivot: { x: 0, y: 0 },
		slots: Object.fromEntries(
			Object.entries(slots ?? {})
				.map(([slot, { name, wearableAsset }]) => [slot, { name: name ?? '', wearableAsset }]),
		),
		graphicsLayers: [],
	};
}

export function CreateRoomDeviceWearablePartAssetDefinition({ id }: { id: AssetId; }): RoomDeviceWearablePartAssetDefinition {
	return {
		type: 'roomDeviceWearablePart',
		id,
		name: '',
		size: 'medium',
		hasGraphics: false,
	};
}

export function CreateAppearanceBundle({
	items = [],
}: {
	items: ItemBundle[];
}): AppearanceBundle {
	return {
		requestedPose: GetDefaultAppearancePose(),
		items,
	};
}

export function CreateItemBundle({
	id,
	asset,
	roomDeviceData,
	roomDeviceLink,
}: {
	id: ItemId;
	asset: AssetId;
	roomDeviceData?: {
		deployed?: boolean;
		slotOccupancy?: Record<string, CharacterId>;
	};
	roomDeviceLink?: RoomDeviceLink;
}): ItemBundle {
	return {
		id,
		asset,
		roomDeviceData: roomDeviceData
			? {
				deployment: {
					deployed: roomDeviceData.deployed ?? false,
					x: 0,
					y: 0,
					yOffset: 0,
				},
				slotOccupancy: roomDeviceData.slotOccupancy ?? {},
			}
			: undefined,
		roomDeviceLink,
	};
}
