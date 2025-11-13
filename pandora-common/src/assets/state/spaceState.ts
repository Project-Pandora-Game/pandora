import { freeze, type Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import * as z from 'zod';
import { GAME_LOGIC_ROOM_SETTINGS_DEFAULT, GameLogicRoomSettingsSchema, type GameLogicRoomSettings } from '../../gameLogic/spaceSettings/roomSettings.ts';
import { GAME_LOGIC_SPACE_SETTINGS_DEFAULT, GameLogicSpaceSettingsSchema, type GameLogicSpaceSettings } from '../../gameLogic/spaceSettings/spaceSettings.ts';
import { LIMIT_ITEM_SPACE_ITEMS_TOTAL, LIMIT_SPACE_ROOM_COUNT } from '../../inputLimits.ts';
import type { Logger } from '../../logging/logger.ts';
import type { SpaceId } from '../../space/space.ts';
import { Assert, CloneDeepMutable, MemoizeNoArg, type Writable } from '../../utility/misc.ts';
import { ZodArrayWithInvalidDrop } from '../../validation.ts';
import { RoomIdSchema, type RoomId } from '../appearanceTypes.ts';
import type { AppearanceValidationResult } from '../appearanceValidation.ts';
import type { AssetManager } from '../assetManager.ts';
import type { Coordinates } from '../graphics/common.ts';
import type { IExportOptions } from '../modules/common.ts';
import { AssetFrameworkRoomState, ROOM_BUNDLE_DEFAULT_PERSONAL_SPACE, ROOM_BUNDLE_DEFAULT_PUBLIC_SPACE, RoomBundleSchema, RoomClientDeltaBundleSchema } from './roomState.ts';

export const SpaceStateBundleSchema = z.object({
	rooms: ZodArrayWithInvalidDrop(RoomBundleSchema, z.record(z.string(), z.unknown())),
	/**
	 * Settings of the space.
	 *
	 * This representation of the settings is sparse; only modified settings are saved.
	 * @see Account['settings'] for more info
	 */
	spaceSettings: GameLogicSpaceSettingsSchema.partial().catch(() => ({})),
	/**
	 * Defaults settings for rooms that don't specify override.
	 *
	 * This representation of the settings is sparse; only modified settings are saved.
	 * @see Account['settings'] for more info
	 */
	globalRoomSettings: GameLogicRoomSettingsSchema.partial().catch(() => ({})),
	clientOnly: z.boolean().optional(),
});

export type SpaceStateBundle = z.infer<typeof SpaceStateBundleSchema>;
export type SpaceStateClientBundle = SpaceStateBundle & { clientOnly: true; };

export const SpaceStateClientDeltaBundleSchema = z.object({
	rooms: z.object({
		list: RoomIdSchema.array().optional(),
		deltas: RoomClientDeltaBundleSchema.array().optional(),
		bundles: RoomBundleSchema.array().optional(),
	}).optional(),
	spaceSettings: GameLogicSpaceSettingsSchema.partial().optional(),
	globalRoomSettings: GameLogicRoomSettingsSchema.partial().optional(),
});
export type SpaceStateClientDeltaBundle = z.infer<typeof SpaceStateClientDeltaBundleSchema>;

export const SPACE_STATE_BUNDLE_DEFAULT_PUBLIC_SPACE = freeze<Immutable<SpaceStateBundle>>({
	rooms: [ROOM_BUNDLE_DEFAULT_PUBLIC_SPACE],
	spaceSettings: {},
	globalRoomSettings: {},
}, true);

export const SPACE_STATE_BUNDLE_DEFAULT_PERSONAL_SPACE = freeze<Immutable<SpaceStateBundle>>({
	rooms: [ROOM_BUNDLE_DEFAULT_PERSONAL_SPACE],
	spaceSettings: {},
	globalRoomSettings: {},
}, true);

type AssetFrameworkSpaceStateProps = {
	readonly assetManager: AssetManager;
	readonly spaceId: SpaceId | null;

	readonly rooms: readonly AssetFrameworkRoomState[];
	readonly spaceSettings: Immutable<Partial<GameLogicSpaceSettings>>;
	readonly globalRoomSettings: Immutable<Partial<GameLogicRoomSettings>>;
};

/**
 * State of static part of the space (everything except characters). Immutable.
 */
export class AssetFrameworkSpaceState implements AssetFrameworkSpaceStateProps {
	public readonly assetManager: AssetManager;
	public readonly spaceId: SpaceId | null;

	public readonly rooms: readonly AssetFrameworkRoomState[];
	public readonly spaceSettings: Immutable<Partial<GameLogicSpaceSettings>>;
	public readonly globalRoomSettings: Immutable<Partial<GameLogicRoomSettings>>;

	private constructor(props: AssetFrameworkSpaceStateProps);
	private constructor(old: AssetFrameworkSpaceState, override: Partial<AssetFrameworkSpaceStateProps>);
	private constructor(props: AssetFrameworkSpaceStateProps, override?: Partial<AssetFrameworkSpaceStateProps>) {
		this.assetManager = override?.assetManager ?? props.assetManager;
		this.spaceId = override?.spaceId ?? props.spaceId;
		this.rooms = override?.rooms ?? props.rooms;
		this.spaceSettings = override?.spaceSettings ?? props.spaceSettings;
		this.globalRoomSettings = override?.globalRoomSettings ?? props.globalRoomSettings;
	}

	public getRoom(roomId: RoomId): AssetFrameworkRoomState | null {
		return this.rooms.find((i) => i.id === roomId) ?? null;
	}

	public getRoomByPosition(position: Immutable<Coordinates>): AssetFrameworkRoomState | null {
		return this.rooms.find((r) => r.position.x === position.x && r.position.y === position.y) ?? null;
	}

	public getTotalItemCount(): number {
		let itemCount = 0;
		for (const room of this.rooms) {
			itemCount += room.getTotalItemCount();
		}
		return itemCount;
	}

	/**
	 * Gets settings for this space.
	 */
	public getEffectiveSpaceSettings(): Immutable<GameLogicSpaceSettings> {
		return {
			...GAME_LOGIC_SPACE_SETTINGS_DEFAULT,
			...this.spaceSettings,
		};
	}

	/**
	 * Gets settings for a specified room. If the room is `null` or does not exist, global room settings are returned instead
	 */
	public getEffectiveRoomSettings(roomId: RoomId | null): Immutable<GameLogicRoomSettings> {
		const room = roomId == null ? null : this.getRoom(roomId);

		return {
			...GAME_LOGIC_ROOM_SETTINGS_DEFAULT,
			...this.globalRoomSettings,
			...room?.settings,
		};
	}

	public isValid(): boolean {
		return this.validate().success;
	}

	@MemoizeNoArg
	public validate(): AppearanceValidationResult {
		// There must be at least one room at all times
		if (this.rooms.length < 1) {
			return {
				success: false,
				error: {
					problem: 'invalid',
				},
			};
		}

		// Room count is limited
		if (this.getTotalItemCount() > LIMIT_ITEM_SPACE_ITEMS_TOTAL) {
			return {
				success: false,
				error: {
					problem: 'tooManySpaceItems',
					limit: LIMIT_ITEM_SPACE_ITEMS_TOTAL,
				},
			};
		}

		const roomIds = new Set<RoomId>();
		const usedCoordinates: Immutable<Coordinates>[] = [];
		for (const room of this.rooms) {
			// ID must be unique
			if (roomIds.has(room.id)) {
				return {
					success: false,
					error: {
						problem: 'invalid',
					},
				};
			}
			roomIds.add(room.id);

			// Rooms must not overlap
			if (usedCoordinates.some((c) => room.position.x === c.x && room.position.y === c.y)) {
				return {
					success: false,
					error: {
						problem: 'roomError',
						problemDetail: 'roomsOverlap',
					},
				};
			}
			usedCoordinates.push(room.position);

			const r = room.validate();
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public withRooms(rooms: readonly AssetFrameworkRoomState[]): AssetFrameworkSpaceState {
		return new AssetFrameworkSpaceState(this, { rooms });
	}

	public produceRoom(roomId: RoomId, producer: (currentState: AssetFrameworkRoomState) => AssetFrameworkRoomState | null): AssetFrameworkSpaceState | null {
		const roomIndex = this.rooms.findIndex((i) => i.id === roomId);

		if (roomIndex < 0) {
			return null;
		}

		const roomState = this.rooms[roomIndex];

		const newState = producer(roomState);
		if (!newState)
			return null;

		const newRooms = this.rooms.slice();
		newRooms[roomIndex] = newState;

		return new AssetFrameworkSpaceState(this, { rooms: newRooms });
	}

	public withSpaceSettings(spaceSettings: Immutable<Partial<GameLogicSpaceSettings>>): AssetFrameworkSpaceState {
		if (isEqual(this.spaceSettings, spaceSettings))
			return this;

		return new AssetFrameworkSpaceState(this, { spaceSettings: freeze(spaceSettings, true) });
	}

	public withGlobalRoomSettings(globalRoomSettings: Immutable<Partial<GameLogicRoomSettings>>): AssetFrameworkSpaceState {
		if (isEqual(this.globalRoomSettings, globalRoomSettings))
			return this;

		return new AssetFrameworkSpaceState(this, { globalRoomSettings: freeze(globalRoomSettings, true) });
	}

	public exportToBundle(): SpaceStateBundle {
		return {
			rooms: this.rooms.map((r) => r.exportToBundle()),
			spaceSettings: CloneDeepMutable(this.spaceSettings),
			globalRoomSettings: CloneDeepMutable(this.globalRoomSettings),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): SpaceStateClientBundle {
		options.clientOnly = true;
		return {
			rooms: this.rooms.map((r) => r.exportToClientBundle(options)),
			spaceSettings: CloneDeepMutable(this.spaceSettings),
			globalRoomSettings: CloneDeepMutable(this.globalRoomSettings),
			clientOnly: true,
		};
	}

	public exportToClientDeltaBundle(originalState: AssetFrameworkSpaceState, options: IExportOptions = {}): SpaceStateClientDeltaBundle {
		Assert(this.assetManager === originalState.assetManager);
		Assert(this.spaceId === originalState.spaceId);
		options.clientOnly = true;

		const result: SpaceStateClientDeltaBundle = {};

		if (this.rooms !== originalState.rooms) {
			result.rooms = {};
			const newOrder = this.rooms.map((r) => r.id);
			if (!isEqual(originalState.rooms.map((r) => r.id), newOrder)) {
				result.rooms.list = newOrder;
			}
			for (const room of this.rooms) {
				const originalRoom = originalState.getRoom(room.id);
				if (originalRoom == null) {
					result.rooms.bundles ??= [];
					result.rooms.bundles.push(room.exportToClientBundle(options));
				} else {
					result.rooms.deltas ??= [];
					result.rooms.deltas.push(room.exportToClientDeltaBundle(originalRoom, options));
				}
			}
		}

		if (this.spaceSettings !== originalState.spaceSettings) {
			result.spaceSettings = CloneDeepMutable(this.spaceSettings);
		}
		if (this.globalRoomSettings !== originalState.globalRoomSettings) {
			result.globalRoomSettings = CloneDeepMutable(this.globalRoomSettings);
		}

		return result;
	}

	public applyClientDeltaBundle(bundle: SpaceStateClientDeltaBundle, logger: Logger | undefined): AssetFrameworkSpaceState {
		const update: Writable<Partial<AssetFrameworkSpaceStateProps>> = {};

		if (bundle.rooms !== undefined) {
			const order = bundle.rooms.list ?? this.rooms.map((r) => r.id);

			const rooms = new Map<RoomId, AssetFrameworkRoomState>();
			for (const room of this.rooms) {
				Assert(!rooms.has(room.id));
				Assert(room.assetManager === this.assetManager);
				rooms.set(room.id, room);
			}
			if (bundle.rooms.bundles != null) {
				for (const roomBundle of bundle.rooms.bundles) {
					const room = AssetFrameworkRoomState.loadFromBundle(this.assetManager, roomBundle, this.spaceId, logger);
					rooms.set(room.id, room);
				}
			}
			if (bundle.rooms.deltas != null) {
				for (const roomDelta of bundle.rooms.deltas) {
					const currentRoom = rooms.get(roomDelta.id);
					Assert(currentRoom != null, 'DESYNC: Received room delta for unknown room');
					const room = currentRoom.applyClientDeltaBundle(roomDelta, logger);
					rooms.set(room.id, room);
				}
			}

			update.rooms = order.map((id) => {
				const room = rooms.get(id);
				Assert(room != null, 'DESYNC: Room in delta bundle not found');
				return room;
			});
		}

		if (bundle.spaceSettings !== undefined) {
			update.spaceSettings = freeze(bundle.spaceSettings, true);
		}
		if (bundle.globalRoomSettings !== undefined) {
			update.globalRoomSettings = freeze(bundle.globalRoomSettings, true);
		}

		const resultState = freeze(new AssetFrameworkSpaceState(this, update), true);

		Assert(resultState.isValid(), 'State is invalid after delta update');
		return resultState;
	}

	public static createDefault(assetManager: AssetManager, spaceId: SpaceId | null): AssetFrameworkSpaceState {
		return AssetFrameworkSpaceState.loadFromBundle(
			assetManager,
			spaceId != null ? SPACE_STATE_BUNDLE_DEFAULT_PUBLIC_SPACE : SPACE_STATE_BUNDLE_DEFAULT_PERSONAL_SPACE,
			spaceId,
			undefined,
		);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: Immutable<SpaceStateBundle>, spaceId: SpaceId | null, logger: Logger | undefined): AssetFrameworkSpaceState {
		const fixup = bundle?.clientOnly !== true;
		const parsed: SpaceStateBundle = SpaceStateBundleSchema.parse(bundle);

		let rooms = parsed.rooms.map((r) => AssetFrameworkRoomState.loadFromBundle(assetManager, r, spaceId, logger));

		if (rooms.length < 1) {
			Assert(fixup, 'DESYNC: Space without rooms');
			logger?.warning('Space has no rooms, adding default');
			rooms.push(AssetFrameworkRoomState.loadFromBundle(
				assetManager,
				(spaceId != null ? ROOM_BUNDLE_DEFAULT_PUBLIC_SPACE : ROOM_BUNDLE_DEFAULT_PERSONAL_SPACE),
				spaceId,
				logger,
			));
		}
		if (rooms.length > LIMIT_SPACE_ROOM_COUNT) {
			rooms = rooms.slice(0, LIMIT_SPACE_ROOM_COUNT);
		}

		// Fixup room coordinates
		const usedCoordinates: Immutable<Coordinates>[] = [];
		for (let i = 0; i < rooms.length; i++) {
			let room = rooms[i];
			while (usedCoordinates.some((c) => c.x === room.position.x && c.y === room.position.y)) {
				// Shift rooms that overlap to the right
				room = room.withPosition({ x: room.position.x + 1, y: room.position.y });
			}
			if (rooms[i] !== room) {
				logger?.warning(`Room @ ${rooms[i].position.x}, ${rooms[i].position.y} overlaps with another room, shifting to ${room.position.x}. ${room.position.y}`);
			}
			rooms[i] = room;
			usedCoordinates.push(room.position);
		}

		// Create the final state
		const resultState = freeze(new AssetFrameworkSpaceState({
			assetManager,
			spaceId,
			rooms,
			spaceSettings: freeze(parsed.spaceSettings, true),
			globalRoomSettings: freeze(parsed.globalRoomSettings, true),
		}), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
