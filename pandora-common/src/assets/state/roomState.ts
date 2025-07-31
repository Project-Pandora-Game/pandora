import { freeze, Immutable } from 'immer';
import type { Writable } from 'type-fest';
import { z } from 'zod';
import type { Logger } from '../../logging/logger.ts';
import type { SpaceId } from '../../space/index.ts';
import { Assert, AssertNotNullable, CloneDeepMutable, MemoizeNoArg } from '../../utility/misc.ts';
import { RoomIdSchema, RoomNameSchema, type RoomId } from '../appearanceTypes.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { AssetManager } from '../assetManager.ts';
import { IntegerCoordinatesSchema, type Coordinates } from '../graphics/common.ts';
import { Item } from '../item/base.ts';
import { AppearanceItemsBundleSchema, AppearanceItemsDeltaBundleSchema, ApplyAppearanceItemsDeltaBundle, CalculateAppearanceItemsDeltaBundle, type AppearanceItems } from '../item/items.ts';
import type { IExportOptions } from '../modules/common.ts';
import { RoomInventoryLoadAndValidate, ValidateRoomInventoryItems } from '../roomValidation.ts';
import { ResolveBackground, RoomGeometryConfigSchema, type RoomBackgroundData, type RoomGeometryConfig } from './roomGeometry.ts';

export const RoomBundleSchema = z.object({
	id: RoomIdSchema,
	name: RoomNameSchema.catch(''),
	items: AppearanceItemsBundleSchema,
	position: IntegerCoordinatesSchema.catch({ x: 0, y: 0 }),
	roomGeometry: RoomGeometryConfigSchema.catch({ type: 'defaultPublicSpace' }),
	clientOnly: z.boolean().optional(),
});

export type RoomBundle = z.infer<typeof RoomBundleSchema>;
export type RoomClientBundle = RoomBundle & { clientOnly: true; };

export const RoomClientDeltaBundleSchema = z.object({
	id: RoomIdSchema,
	name: RoomNameSchema.optional(),
	items: AppearanceItemsDeltaBundleSchema.optional(),
	position: IntegerCoordinatesSchema.optional(),
	roomGeometry: RoomGeometryConfigSchema.optional(),
});
export type RoomClientDeltaBundle = z.infer<typeof RoomClientDeltaBundleSchema>;

export const ROOM_BUNDLE_DEFAULT_PUBLIC_SPACE = freeze<Immutable<RoomBundle>>({
	id: 'room:default',
	name: 'Unnamed room',
	items: [],
	position: { x: 0, y: 0 },
	roomGeometry: { type: 'defaultPublicSpace' },
}, true);

export const ROOM_BUNDLE_DEFAULT_PERSONAL_SPACE = freeze<Immutable<RoomBundle>>({
	id: 'room:default',
	name: 'My personal room',
	items: [],
	position: { x: 0, y: 0 },
	roomGeometry: { type: 'defaultPersonalSpace' },
}, true);

type AssetFrameworkRoomStateProps = {
	readonly assetManager: AssetManager;
	readonly id: RoomId;
	readonly name: string;
	readonly items: AppearanceItems;
	readonly position: Immutable<Coordinates>;
	readonly roomGeometryConfig: Immutable<RoomGeometryConfig>;
	readonly roomBackground: Immutable<RoomBackgroundData>;
};

/**
 * State of a room. Immutable.
 */
export class AssetFrameworkRoomState implements AssetFrameworkRoomStateProps {
	public readonly id: RoomId;

	public readonly assetManager: AssetManager;

	public readonly name: string;
	public readonly items: AppearanceItems;
	public readonly position: Immutable<Coordinates>;
	public readonly roomGeometryConfig: Immutable<RoomGeometryConfig>;
	public readonly roomBackground: Immutable<RoomBackgroundData>;

	private constructor(props: AssetFrameworkRoomStateProps);
	private constructor(old: AssetFrameworkRoomState, override: Partial<AssetFrameworkRoomStateProps>);
	private constructor(props: AssetFrameworkRoomStateProps, override?: Partial<AssetFrameworkRoomStateProps>) {
		this.id = override?.id ?? props.id;
		this.assetManager = override?.assetManager ?? props.assetManager;
		this.name = override?.name ?? props.name;
		this.items = override?.items ?? props.items;
		this.position = override?.position ?? props.position;
		this.roomGeometryConfig = override?.roomGeometryConfig ?? props.roomGeometryConfig;
		this.roomBackground = override?.roomBackground ?? props.roomBackground;
	}

	/**
	 * Returns a distance between this and another room.
	 * Currently the distance is a manhattan distance, but this might change in the future.
	 * @param otherRoom The room to calculate distance to
	 * @returns Non-negative distance between rooms
	 */
	public getDistanceToRoom(otherRoom: AssetFrameworkRoomState): number {
		return Math.abs(this.position.x - otherRoom.position.x) + Math.abs(this.position.y - otherRoom.position.y);
	}

	public isValid(): boolean {
		return this.validate().success;
	}

	@MemoizeNoArg
	public validate(): AppearanceValidationResult {
		if (!Number.isSafeInteger(this.position.x) || !Number.isSafeInteger(this.position.y))
			return { success: false, error: { problem: 'roomError', problemDetail: 'invalidPosition' } };

		{
			const r = ValidateRoomInventoryItems(this.assetManager, this.items);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public exportToBundle(): RoomBundle {
		return {
			id: this.id,
			name: this.name,
			items: this.items.map((item) => item.exportToBundle({})),
			position: CloneDeepMutable(this.position),
			roomGeometry: CloneDeepMutable(this.roomGeometryConfig),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): RoomClientBundle {
		options.clientOnly = true;
		return {
			id: this.id,
			name: this.name,
			items: this.items.map((item) => item.exportToBundle(options)),
			position: CloneDeepMutable(this.position),
			roomGeometry: CloneDeepMutable(this.roomGeometryConfig),
			clientOnly: true,
		};
	}

	public exportToClientDeltaBundle(originalState: AssetFrameworkRoomState, options: IExportOptions = {}): RoomClientDeltaBundle {
		Assert(this.assetManager === originalState.assetManager);
		options.clientOnly = true;

		const result: RoomClientDeltaBundle = {
			id: this.id,
		};

		if (this.name !== originalState.name) {
			result.name = this.name;
		}
		if (this.items !== originalState.items) {
			result.items = CalculateAppearanceItemsDeltaBundle(originalState.items, this.items, options);
		}
		if (this.position !== originalState.position) {
			result.position = CloneDeepMutable(this.position);
		}
		if (this.roomGeometryConfig !== originalState.roomGeometryConfig) {
			result.roomGeometry = CloneDeepMutable(this.roomGeometryConfig);
		}

		return result;
	}

	public applyClientDeltaBundle(bundle: RoomClientDeltaBundle, logger: Logger | undefined): AssetFrameworkRoomState {
		Assert(this.id === bundle.id);
		const update: Writable<Partial<AssetFrameworkRoomStateProps>> = {};

		if (bundle.name !== undefined) {
			update.name = bundle.name;
		}

		if (bundle.items !== undefined) {
			update.items = ApplyAppearanceItemsDeltaBundle(this.assetManager, this.items, bundle.items, logger);
		}

		if (bundle.position !== undefined) {
			update.position = freeze(bundle.position, true);
		}

		if (bundle.roomGeometry !== undefined) {
			update.roomGeometryConfig = bundle.roomGeometry;
			const roomBackground = ResolveBackground(this.assetManager, bundle.roomGeometry);
			Assert(roomBackground != null, 'DESYNC: Failed to resolve room background');
			update.roomBackground = roomBackground;
		}

		const resultState = freeze(new AssetFrameworkRoomState(this, update), true);

		Assert(resultState.isValid(), 'State is invalid after delta update');
		return resultState;
	}

	public withName(name: string): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(this, { name });
	}

	public withPosition(position: Immutable<Coordinates>): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(this, { position: freeze(position, true) });
	}

	public produceWithItems(newItems: AppearanceItems): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(this, { items: newItems });
	}

	public produceWithRoomGeometry(newGeometry: Immutable<RoomGeometryConfig>): AssetFrameworkRoomState | null {
		const roomBackground = ResolveBackground(this.assetManager, newGeometry);
		if (roomBackground == null)
			return null;

		return new AssetFrameworkRoomState(this, {
			roomGeometryConfig: newGeometry,
			roomBackground,
		});
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: Immutable<RoomBundle>, spaceId: SpaceId | null, logger: Logger | undefined): AssetFrameworkRoomState {
		const fixup = bundle?.clientOnly !== true;
		const parsed: RoomBundle = RoomBundleSchema.parse(bundle);

		// Load all items
		const loadedItems: Item[] = [];
		for (const itemBundle of parsed.items) {
			// Load asset and skip if unknown
			const asset = assetManager.getAssetById(itemBundle.asset);
			if (asset === undefined) {
				Assert(fixup, `DESYNC: Unknown asset ${itemBundle.asset}`);
				logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}

			const item = assetManager.loadItemFromBundle(asset, itemBundle, logger);
			loadedItems.push(item);
		}

		// Validate and add all items
		const newItems = RoomInventoryLoadAndValidate(assetManager, loadedItems, logger);

		// Validate room geometry
		let roomGeometryConfig: Immutable<RoomGeometryConfig> = bundle.roomGeometry;
		let roomBackground = ResolveBackground(assetManager, roomGeometryConfig);
		if (roomBackground == null) {
			Assert(fixup, `DESYNC: Unknown room geometry ${JSON.stringify(roomGeometryConfig)}`);
			logger?.warning('Resetting unknown room geometry', roomGeometryConfig);
			roomGeometryConfig = (spaceId != null ? ROOM_BUNDLE_DEFAULT_PUBLIC_SPACE : ROOM_BUNDLE_DEFAULT_PERSONAL_SPACE).roomGeometry;
			roomBackground = ResolveBackground(assetManager, roomGeometryConfig);
			AssertNotNullable(roomBackground);
		}

		// Create the final state
		const resultState = freeze(new AssetFrameworkRoomState({
			id: parsed.id,
			assetManager,
			name: parsed.name,
			items: newItems,
			position: freeze(parsed.position, true),
			roomGeometryConfig,
			roomBackground,
		}), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
