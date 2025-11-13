import { freeze, Immutable, produce } from 'immer';
import { isEqual } from 'lodash-es';
import * as z from 'zod';
import { GameLogicRoomSettingsSchema, type GameLogicRoomSettings } from '../../gameLogic/spaceSettings/roomSettings.ts';
import type { Logger } from '../../logging/logger.ts';
import type { SpaceId } from '../../space/index.ts';
import { Assert, AssertNotNullable, CloneDeepMutable, MemoizeNoArg, type Writable } from '../../utility/misc.ts';
import { ZodArrayWithInvalidDrop } from '../../validation.ts';
import { RoomDescriptionSchema, RoomIdSchema, RoomNameSchema, type RoomDescription, type RoomId, type RoomName } from '../appearanceTypes.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { AssetManager } from '../assetManager.ts';
import { CardinalDirectionSchema, IntegerCoordinatesSchema, type CardinalDirection, type Coordinates } from '../graphics/common.ts';
import { Item, type IItemCreationContext } from '../item/base.ts';
import { AppearanceItemsBundleSchema, AppearanceItemsDeltaBundleSchema, ApplyAppearanceItemsDeltaBundle, CalculateAppearanceItemsDeltaBundle, type AppearanceItems } from '../item/items.ts';
import { RoomDeviceDeploymentSchema } from '../item/roomDevice.ts';
import { ItemTemplateSchema } from '../item/unified.ts';
import type { IExportOptions } from '../modules/common.ts';
import { RoomInventoryLoadAndValidate, ValidateRoomInventoryItems } from '../roomValidation.ts';
import { AppearanceItemsCalculateTotalCount } from '../validation.ts';
import { ResolveBackground, RoomGeometryConfigSchema, type RoomBackgroundData, type RoomGeometryConfig } from './roomGeometry.ts';
import { DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG, RoomNeighborLinkNodesConfigSchema, type RoomLinkNodeData, type RoomNeighborLinkNodesConfig, type RoomNeighborLinkNodesData } from './roomLinkNodeDefinitions.ts';
import { ResolveRoomNeighborLinkData, SpaceRoomLayoutUnitVectorToCardinalDirection } from './roomLinkNodes.ts';

export const RoomBundleSchema = z.object({
	id: RoomIdSchema,
	name: RoomNameSchema.catch(''),
	description: RoomDescriptionSchema.catch(''),
	items: AppearanceItemsBundleSchema,
	position: IntegerCoordinatesSchema.catch({ x: 0, y: 0 }),
	roomGeometry: RoomGeometryConfigSchema.catch({ type: 'defaultPublicSpace' }),
	roomLinkNodes: RoomNeighborLinkNodesConfigSchema.catch(DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG),
	direction: CardinalDirectionSchema.catch('N'),
	/**
	 * Settings for this room.
	 *
	 * This representation of the settings is sparse; only modified settings are saved.
	 * @see Account['settings'] for more info
	 */
	settings: GameLogicRoomSettingsSchema.partial().catch(() => ({})),
	clientOnly: z.boolean().optional(),
});

export type RoomBundle = z.infer<typeof RoomBundleSchema>;
export type RoomClientBundle = RoomBundle & { clientOnly: true; };

export const RoomTemplateItemTemplateSchema = ItemTemplateSchema.and(z.object({
	roomDeviceDeployment: RoomDeviceDeploymentSchema.optional().catch(undefined),
}));
export type RoomTemplateItemTemplate = z.infer<typeof RoomTemplateItemTemplateSchema>;

export const RoomTemplateSchema = z.object({
	name: RoomNameSchema.catch(''),
	description: RoomDescriptionSchema.catch(''),
	items: ZodArrayWithInvalidDrop(RoomTemplateItemTemplateSchema, z.unknown()).catch(() => []),
	roomGeometry: RoomGeometryConfigSchema.catch({ type: 'defaultPublicSpace' }),
	roomLinkNodes: RoomNeighborLinkNodesConfigSchema.catch(DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG),
});
export type RoomTemplate = z.infer<typeof RoomTemplateSchema>;

export const RoomClientDeltaBundleSchema = z.object({
	id: RoomIdSchema,
	name: RoomNameSchema.optional(),
	description: RoomDescriptionSchema.optional(),
	items: AppearanceItemsDeltaBundleSchema.optional(),
	position: IntegerCoordinatesSchema.optional(),
	roomGeometry: RoomGeometryConfigSchema.optional(),
	roomLinkNodes: RoomNeighborLinkNodesConfigSchema.optional(),
	direction: CardinalDirectionSchema.optional(),
	settings: GameLogicRoomSettingsSchema.partial().optional(),
});
export type RoomClientDeltaBundle = z.infer<typeof RoomClientDeltaBundleSchema>;

export const ROOM_BUNDLE_DEFAULT_PUBLIC_SPACE = freeze<Immutable<RoomBundle>>({
	id: 'room:default',
	name: 'Unnamed room',
	description: '',
	items: [],
	position: { x: 0, y: 0 },
	roomGeometry: { type: 'defaultPublicSpace' },
	roomLinkNodes: DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG,
	direction: 'N',
	settings: {},
}, true);

export const ROOM_BUNDLE_DEFAULT_PERSONAL_SPACE = freeze<Immutable<RoomBundle>>({
	id: 'room:default',
	name: 'My personal room',
	description: '',
	items: [],
	position: { x: 0, y: 0 },
	roomGeometry: { type: 'defaultPersonalSpace' },
	roomLinkNodes: DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG,
	direction: 'N',
	settings: {},
}, true);

type AssetFrameworkRoomStateProps = {
	readonly assetManager: AssetManager;
	readonly id: RoomId;
	readonly name: RoomName;
	readonly description: RoomDescription;
	readonly items: AppearanceItems;
	readonly position: Immutable<Coordinates>;
	readonly roomGeometryConfig: Immutable<RoomGeometryConfig>;
	readonly roomBackground: Immutable<RoomBackgroundData>;
	readonly roomLinkNodes: Immutable<RoomNeighborLinkNodesConfig>;
	/** The direction room's +y axis is pointing relative to the space's layout */
	readonly direction: CardinalDirection;
	readonly settings: Immutable<Partial<GameLogicRoomSettings>>;
};

/**
 * State of a room. Immutable.
 */
export class AssetFrameworkRoomState implements AssetFrameworkRoomStateProps {
	public readonly id: RoomId;

	public readonly assetManager: AssetManager;

	public readonly name: RoomName;
	public readonly description: RoomDescription;
	public readonly items: AppearanceItems;
	public readonly position: Immutable<Coordinates>;
	public readonly roomGeometryConfig: Immutable<RoomGeometryConfig>;
	public readonly roomBackground: Immutable<RoomBackgroundData>;
	public readonly roomLinkNodes: Immutable<RoomNeighborLinkNodesConfig>;
	public readonly direction: CardinalDirection;
	public readonly settings: Immutable<Partial<GameLogicRoomSettings>>;

	public readonly roomLinkData: Immutable<RoomNeighborLinkNodesData>;

	public get displayName(): string {
		return this.name || this.id;
	}

	private constructor(props: AssetFrameworkRoomStateProps);
	private constructor(old: AssetFrameworkRoomState, override: Partial<AssetFrameworkRoomStateProps>);
	private constructor(props: AssetFrameworkRoomStateProps, override?: Partial<AssetFrameworkRoomStateProps>) {
		this.id = override?.id ?? props.id;
		this.assetManager = override?.assetManager ?? props.assetManager;
		this.name = override?.name ?? props.name;
		this.description = override?.description ?? props.description;
		this.items = override?.items ?? props.items;
		this.position = override?.position ?? props.position;
		this.roomGeometryConfig = override?.roomGeometryConfig ?? props.roomGeometryConfig;
		this.roomBackground = override?.roomBackground ?? props.roomBackground;
		this.roomLinkNodes = override?.roomLinkNodes ?? props.roomLinkNodes;
		this.direction = override?.direction ?? props.direction;
		this.settings = override?.settings ?? props.settings;

		if (props instanceof AssetFrameworkRoomState &&
			this.roomLinkNodes === props.roomLinkNodes &&
			this.direction === props.direction &&
			this.roomBackground === props.roomBackground
		) {
			this.roomLinkData = props.roomLinkData;
		} else {
			this.roomLinkData = ResolveRoomNeighborLinkData(this.roomLinkNodes, this.direction, this.roomBackground);
		}
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

	/**
	 * Returns a link node that can be used to get to the target room, or `null` if no such link exists.
	 * Disabled links are ignored unless `allowDisabledLinks` is set to `true`.
	 * @param otherRoom The room to get to from the current room
	 * @param allowDisabledLinks Whether to return disabled links as well. If not set default links are treated as if they didn't exist
	 */
	public getLinkToRoom(otherRoom: AssetFrameworkRoomState | null, allowDisabledLinks: boolean = false): Immutable<RoomLinkNodeData> | null {
		if (otherRoom == null)
			return null;

		const dx = otherRoom.position.x - this.position.x;
		const dy = otherRoom.position.y - this.position.y;
		const direction = SpaceRoomLayoutUnitVectorToCardinalDirection(dx, dy);
		if (direction == null)
			return null;
		const link = this.roomLinkData[direction];
		return (link.disabled && !allowDisabledLinks) ? null : link;
	}

	public getTotalItemCount(): number {
		return AppearanceItemsCalculateTotalCount(this.items);
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

	public exportToTemplate({ includeAllItems }: {
		includeAllItems: boolean;
	}): RoomTemplate {
		return {
			name: this.name,
			description: this.description,
			items: this.items
				.filter((i) => includeAllItems || i.isType('roomDevice'))
				.map((i) => {
					const template: RoomTemplateItemTemplate = i.exportToTemplate();
					if (i.isType('roomDevice')) {
						template.roomDeviceDeployment = CloneDeepMutable(i.deployment);
					}
					return template;
				}),
			roomGeometry: CloneDeepMutable(this.roomGeometryConfig),
			roomLinkNodes: CloneDeepMutable(produce(this.roomLinkNodes, (d) => {
				delete d.left.useMinimumRole;
				delete d.left.targetView;
				delete d.right.useMinimumRole;
				delete d.right.targetView;
				delete d.near.useMinimumRole;
				delete d.near.targetView;
				delete d.far.useMinimumRole;
				delete d.far.targetView;
			})),
		};
	}

	public exportToBundle(): RoomBundle {
		return {
			id: this.id,
			name: this.name,
			description: this.description,
			items: this.items.map((item) => item.exportToBundle({})),
			position: CloneDeepMutable(this.position),
			roomGeometry: CloneDeepMutable(this.roomGeometryConfig),
			roomLinkNodes: CloneDeepMutable(this.roomLinkNodes),
			direction: this.direction,
			settings: CloneDeepMutable(this.settings),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): RoomClientBundle {
		options.clientOnly = true;
		return {
			id: this.id,
			name: this.name,
			description: this.description,
			items: this.items.map((item) => item.exportToBundle(options)),
			position: CloneDeepMutable(this.position),
			roomGeometry: CloneDeepMutable(this.roomGeometryConfig),
			roomLinkNodes: CloneDeepMutable(this.roomLinkNodes),
			direction: this.direction,
			settings: CloneDeepMutable(this.settings),
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
		if (this.description !== originalState.description) {
			result.description = this.description;
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
		if (this.roomLinkNodes !== originalState.roomLinkNodes) {
			result.roomLinkNodes = CloneDeepMutable(this.roomLinkNodes);
		}
		if (this.direction !== originalState.direction) {
			result.direction = this.direction;
		}
		if (this.settings !== originalState.settings) {
			result.settings = CloneDeepMutable(this.settings);
		}

		return result;
	}

	public applyClientDeltaBundle(bundle: RoomClientDeltaBundle, logger: Logger | undefined): AssetFrameworkRoomState {
		Assert(this.id === bundle.id);
		const update: Writable<Partial<AssetFrameworkRoomStateProps>> = {};

		if (bundle.name !== undefined) {
			update.name = bundle.name;
		}

		if (bundle.description !== undefined) {
			update.description = bundle.description;
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

		if (bundle.roomLinkNodes !== undefined) {
			update.roomLinkNodes = freeze(bundle.roomLinkNodes, true);
		}

		if (bundle.direction !== undefined) {
			update.direction = bundle.direction;
		}

		if (bundle.settings !== undefined) {
			update.settings = freeze(bundle.settings, true);
		}

		const resultState = freeze(new AssetFrameworkRoomState(this, update), true);

		Assert(resultState.isValid(), 'State is invalid after delta update');
		return resultState;
	}

	public withName(name: RoomName): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(this, { name });
	}

	public withDescription(description: RoomDescription): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(this, { description });
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

	public withDirection(direction: CardinalDirection): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(this, { direction });
	}

	public withRoomLinkNodes(roomLinkNodes: Immutable<RoomNeighborLinkNodesConfig>): AssetFrameworkRoomState {
		return new AssetFrameworkRoomState(this, { roomLinkNodes: freeze(roomLinkNodes, true) });
	}

	public withSettings(settings: Immutable<Partial<GameLogicRoomSettings>>): AssetFrameworkRoomState {
		if (isEqual(this.settings, settings))
			return this;

		return new AssetFrameworkRoomState(this, { settings: freeze(settings, true) });
	}

	public static createFromTemplate(
		template: Immutable<RoomTemplate>,
		id: RoomId,
		position: Coordinates,
		direction: CardinalDirection,
		settings: Immutable<Partial<GameLogicRoomSettings>>,
		assetManager: AssetManager,
		spaceId: SpaceId | null,
		creator: IItemCreationContext['creator'],
	): AssetFrameworkRoomState {
		// Load all items
		const loadedItems: Item[] = [];
		for (const itemTemplate of template.items) {
			// Load asset and skip if unknown
			let item = assetManager.createItemFromTemplate(itemTemplate, creator);
			if (item != null) {
				if (item.isType('roomDevice') && itemTemplate.roomDeviceDeployment != null && itemTemplate.roomDeviceDeployment.deployed) {
					item = item.changeDeployment({
						deployed: true,
						position: {
							x: itemTemplate.roomDeviceDeployment.x,
							y: itemTemplate.roomDeviceDeployment.y,
							yOffset: itemTemplate.roomDeviceDeployment.yOffset,
						},
					});
				}

				loadedItems.push(item);
			}
		}

		// Validate and add all items
		const newItems = RoomInventoryLoadAndValidate(assetManager, loadedItems);

		// Validate room geometry
		let roomGeometryConfig: Immutable<RoomGeometryConfig> = CloneDeepMutable(template.roomGeometry);
		let roomBackground = ResolveBackground(assetManager, roomGeometryConfig);
		if (roomBackground == null) {
			roomGeometryConfig = (spaceId != null ? ROOM_BUNDLE_DEFAULT_PUBLIC_SPACE : ROOM_BUNDLE_DEFAULT_PERSONAL_SPACE).roomGeometry;
			roomBackground = ResolveBackground(assetManager, roomGeometryConfig);
			AssertNotNullable(roomBackground);
		}

		// Create the final state
		const resultState = freeze(new AssetFrameworkRoomState({
			id,
			assetManager,
			name: template.name,
			description: template.description,
			items: newItems,
			position: CloneDeepMutable(position),
			roomGeometryConfig,
			roomBackground,
			roomLinkNodes: produce(CloneDeepMutable(template.roomLinkNodes), (d) => {
				delete d.left.useMinimumRole;
				delete d.left.targetView;
				delete d.right.useMinimumRole;
				delete d.right.targetView;
				delete d.near.useMinimumRole;
				delete d.near.targetView;
				delete d.far.useMinimumRole;
				delete d.far.targetView;
			}),
			direction,
			settings: freeze(CloneDeepMutable(settings), true),
		}), true);

		Assert(resultState.isValid(), 'State is invalid after creation from template');

		return resultState;
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
			description: parsed.description,
			items: newItems,
			position: freeze(parsed.position, true),
			roomGeometryConfig,
			roomBackground,
			roomLinkNodes: freeze(parsed.roomLinkNodes, true),
			direction: parsed.direction,
			settings: freeze(parsed.settings, true),
		}), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
