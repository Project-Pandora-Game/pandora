import { freeze, Immutable } from 'immer';
import type { Writable } from 'type-fest';
import { z } from 'zod';
import type { Logger } from '../../logging/logger.ts';
import { type SpaceId } from '../../space/index.ts';
import { Assert, AssertNotNullable, CloneDeepMutable, MemoizeNoArg } from '../../utility/misc.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { AssetManager } from '../assetManager.ts';
import { Item } from '../item/base.ts';
import { AppearanceItemsBundleSchema, AppearanceItemsDeltaBundleSchema, ApplyAppearanceItemsDeltaBundle, CalculateAppearanceItemsDeltaBundle, type AppearanceItems } from '../item/items.ts';
import type { IExportOptions } from '../modules/common.ts';
import { RoomInventoryLoadAndValidate, ValidateRoomInventoryItems } from '../roomValidation.ts';
import { ResolveBackground, RoomGeometryConfigSchema, type RoomBackgroundData, type RoomGeometryConfig } from './roomGeometry.ts';

export const RoomInventoryBundleSchema = z.object({
	items: AppearanceItemsBundleSchema,
	roomGeometry: RoomGeometryConfigSchema.catch({ type: 'defaultPublicSpace' }),
	clientOnly: z.boolean().optional(),
});

export type RoomInventoryBundle = z.infer<typeof RoomInventoryBundleSchema>;
export type RoomInventoryClientBundle = RoomInventoryBundle & { clientOnly: true; };

export const RoomInventoryClientDeltaBundleSchema = z.object({
	items: AppearanceItemsDeltaBundleSchema.optional(),
	roomGeometry: RoomGeometryConfigSchema.optional(),
});
export type RoomInventoryClientDeltaBundle = z.infer<typeof RoomInventoryClientDeltaBundleSchema>;

export const ROOM_INVENTORY_BUNDLE_DEFAULT_PUBLIC_SPACE = freeze<Immutable<RoomInventoryBundle>>({
	items: [],
	roomGeometry: { type: 'defaultPublicSpace' },
}, true);

export const ROOM_INVENTORY_BUNDLE_DEFAULT_PERSONAL_SPACE = freeze<Immutable<RoomInventoryBundle>>({
	items: [],
	roomGeometry: { type: 'defaultPersonalSpace' },
}, true);

type AssetFrameworkRoomStateProps = {
	readonly assetManager: AssetManager;
	readonly spaceId: SpaceId | null;
	readonly items: AppearanceItems;
	readonly roomGeometryConfig: Immutable<RoomGeometryConfig>;
	readonly roomBackground: Immutable<RoomBackgroundData>;
};

/**
 * State of an space. Immutable.
 */
export class AssetFrameworkRoomState implements AssetFrameworkRoomStateProps {
	public readonly type = 'roomInventory';
	public readonly assetManager: AssetManager;
	public readonly spaceId: SpaceId | null;

	public readonly items: AppearanceItems;
	public readonly roomGeometryConfig: Immutable<RoomGeometryConfig>;
	public readonly roomBackground: Immutable<RoomBackgroundData>;

	private constructor(props: AssetFrameworkRoomStateProps);
	private constructor(old: AssetFrameworkRoomState, override: Partial<AssetFrameworkRoomStateProps>);
	private constructor(props: AssetFrameworkRoomStateProps, override?: Partial<AssetFrameworkRoomStateProps>) {
		this.assetManager = override?.assetManager ?? props.assetManager;
		this.spaceId = override?.spaceId ?? props.spaceId;
		this.items = override?.items ?? props.items;
		this.roomGeometryConfig = override?.roomGeometryConfig ?? props.roomGeometryConfig;
		this.roomBackground = override?.roomBackground ?? props.roomBackground;
	}

	public isValid(): boolean {
		return this.validate().success;
	}

	@MemoizeNoArg
	public validate(): AppearanceValidationResult {
		{
			const r = ValidateRoomInventoryItems(this.assetManager, this.items);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public exportToBundle(): RoomInventoryBundle {
		return {
			items: this.items.map((item) => item.exportToBundle({})),
			roomGeometry: CloneDeepMutable(this.roomGeometryConfig),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): RoomInventoryClientBundle {
		options.clientOnly = true;
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
			roomGeometry: CloneDeepMutable(this.roomGeometryConfig),
			clientOnly: true,
		};
	}

	public exportToClientDeltaBundle(originalState: AssetFrameworkRoomState, options: IExportOptions = {}): RoomInventoryClientDeltaBundle {
		Assert(this.assetManager === originalState.assetManager);
		Assert(this.spaceId === originalState.spaceId);
		options.clientOnly = true;

		const result: RoomInventoryClientDeltaBundle = {};

		if (this.items !== originalState.items) {
			result.items = CalculateAppearanceItemsDeltaBundle(originalState.items, this.items, options);
		}
		if (this.roomGeometryConfig !== originalState.roomGeometryConfig) {
			result.roomGeometry = CloneDeepMutable(this.roomGeometryConfig);
		}

		return result;
	}

	public applyClientDeltaBundle(bundle: RoomInventoryClientDeltaBundle, logger: Logger | undefined): AssetFrameworkRoomState {
		const update: Writable<Partial<AssetFrameworkRoomStateProps>> = {};

		if (bundle.items !== undefined) {
			update.items = ApplyAppearanceItemsDeltaBundle(this.assetManager, this.items, bundle.items, logger);
		}

		if (bundle.roomGeometry !== undefined) {
			update.roomGeometryConfig = bundle.roomGeometry;
		}

		const resultState = freeze(new AssetFrameworkRoomState(this, update), true);

		Assert(resultState.isValid(), 'State is invalid after delta update');
		return resultState;
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

	public static createDefault(assetManager: AssetManager, spaceId: SpaceId | null): AssetFrameworkRoomState {
		return AssetFrameworkRoomState.loadFromBundle(
			assetManager,
			spaceId != null ? ROOM_INVENTORY_BUNDLE_DEFAULT_PUBLIC_SPACE : ROOM_INVENTORY_BUNDLE_DEFAULT_PERSONAL_SPACE,
			spaceId,
			undefined,
		);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: Immutable<RoomInventoryBundle>, spaceId: SpaceId | null, logger: Logger | undefined): AssetFrameworkRoomState {
		const fixup = bundle?.clientOnly !== true;
		const parsed: RoomInventoryBundle = RoomInventoryBundleSchema.parse(bundle);

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
			roomGeometryConfig = (spaceId != null ? ROOM_INVENTORY_BUNDLE_DEFAULT_PUBLIC_SPACE : ROOM_INVENTORY_BUNDLE_DEFAULT_PERSONAL_SPACE).roomGeometry;
			roomBackground = ResolveBackground(assetManager, roomGeometryConfig);
			AssertNotNullable(roomBackground);
		}

		// Create the final state
		const resultState = freeze(new AssetFrameworkRoomState({
			assetManager,
			spaceId,
			items: newItems,
			roomGeometryConfig,
			roomBackground,
		}), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
