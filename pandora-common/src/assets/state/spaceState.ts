import { freeze } from 'immer';
import { z } from 'zod';
import { Logger } from '../../logging';
import { Assert, MemoizeNoArg } from '../../utility';
import { ZodArrayWithInvalidDrop } from '../../validation';
import { AppearanceValidationResult } from '../appearanceValidation';
import { AssetManager } from '../assetManager';
import type { IExportOptions } from '../modules/common';
import { SpaceRoomsLoadAndValidate, ValidateSpaceRooms } from '../validation/spaceValidation';
import { AssetFrameworkRoomState, GenerateDefaultRoomBundle, RoomBundleSchema, RoomId } from './roomState';

// Fix for pnpm resolution weirdness
import type { } from '../item/base';

export const SpaceStateBundleSchema = z.object({
	rooms: ZodArrayWithInvalidDrop(RoomBundleSchema, z.record(z.unknown())),
	clientOnly: z.boolean().optional(),
});

export type SpaceStateBundle = z.infer<typeof SpaceStateBundleSchema>;
export type SpaceStateClientBundle = SpaceStateBundle & { clientOnly: true; };

export function GenerateDefaultSpaceStateBundle(): SpaceStateBundle {
	return {
		rooms: [
			GenerateDefaultRoomBundle(),
		],
	};
}

/**
 * State of an room. Immutable.
 */
export class AssetFrameworkSpaceState {
	public readonly assetManager: AssetManager;

	public readonly rooms: readonly AssetFrameworkRoomState[];

	private constructor(
		assetManager: AssetManager,
		rooms: readonly AssetFrameworkRoomState[],
	) {
		this.assetManager = assetManager;
		this.rooms = rooms;
	}

	public getRoomState(room: RoomId): AssetFrameworkRoomState | null {
		return this.rooms.find((r) => r.id === room) ?? null;
	}

	public getDefaultRoom(): AssetFrameworkRoomState {
		Assert(this.rooms.length > 0);
		return this.rooms[0];
	}

	public isValid(): boolean {
		return this.validate().success;
	}

	@MemoizeNoArg
	public validate(): AppearanceValidationResult {
		{
			const r = ValidateSpaceRooms(this.rooms);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public exportToBundle(options: IExportOptions = {}): SpaceStateBundle {
		return {
			rooms: this.rooms.map((room) => room.exportToBundle(options)),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): SpaceStateClientBundle {
		options.clientOnly = true;
		return {
			rooms: this.rooms.map((room) => room.exportToClientBundle(options)),
			clientOnly: true,
		};
	}

	public produceRoomState(room: RoomId, producer: (currentState: AssetFrameworkRoomState) => AssetFrameworkRoomState | null): AssetFrameworkSpaceState | null {
		const currentState = this.getRoomState(room);
		if (!currentState)
			return null;

		const newState = producer(currentState);
		if (!newState)
			return null;

		return this.withRoom(room, newState);
	}

	public withRoom(room: RoomId, roomState: AssetFrameworkRoomState | null): AssetFrameworkSpaceState {
		Assert(roomState == null || this.assetManager === roomState.assetManager);

		const newRooms: AssetFrameworkRoomState[] = [];
		const currentIndex = newRooms.findIndex((r) => r.id === room);

		if (roomState == null) {
			if (currentIndex >= 0) {
				newRooms.splice(currentIndex, 1);
			}
		} else {
			Assert(room === roomState.id);
			if (currentIndex >= 0) {
				newRooms[currentIndex] = roomState;
			} else {
				newRooms.push(roomState);
			}
		}

		return new AssetFrameworkSpaceState(
			this.assetManager,
			newRooms,
		);
	}

	public static createDefault(assetManager: AssetManager): AssetFrameworkSpaceState {
		return AssetFrameworkSpaceState.loadFromBundle(assetManager, GenerateDefaultSpaceStateBundle(), undefined);
	}

	public static loadFromBundle(assetManager: AssetManager, bundle: SpaceStateBundle, logger: Logger | undefined): AssetFrameworkSpaceState {
		const parsed = SpaceStateBundleSchema.parse(bundle);

		// Load all rooms
		const loadedRooms: AssetFrameworkRoomState[] = [];
		for (const roomBundle of parsed.rooms) {
			const room = AssetFrameworkRoomState.loadFromBundle(assetManager, roomBundle, logger);
			loadedRooms.push(room);
		}

		// Validate and add all rooms
		const newRooms = SpaceRoomsLoadAndValidate(assetManager, loadedRooms, logger);

		// Create the final state
		const resultState = freeze(new AssetFrameworkSpaceState(
			assetManager,
			newRooms,
		), true);

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
