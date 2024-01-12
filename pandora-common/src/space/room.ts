import { z } from 'zod';
import { HexColorString } from '../validation';
import { AssetManager } from '../assets';
import { Immutable } from 'immer';

export const RoomBackgroundDataSchema = z.object({
	/** The background image of a room */
	image: z.string(),
	/** The size of the room's area */
	size: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
	/** Limit how high can character move */
	maxY: z.number().int().min(0).optional(),
	/** The Y -> scale of the room */
	scaling: z.number().min(0),
});
export type RoomBackgroundData = z.infer<typeof RoomBackgroundDataSchema>;

export const DEFAULT_ROOM_SIZE = [4000, 2000] as const;
export const DEFAULT_BACKGROUND = {
	image: '#1099bb',
	size: DEFAULT_ROOM_SIZE,
	scaling: 1,
} as const satisfies Immutable<RoomBackgroundData & { image: HexColorString; }>;

/**
 * Resolves room background data into effective background info
 * @param assetManager - Asset manager to query for backgrounds
 * @param background - The background to resolve
 * @param baseUrl - Base URL to use for resolving image path, otherwise no change
 */
export function ResolveBackground(assetManager: AssetManager, background: string | Immutable<RoomBackgroundData>, baseUrl?: string): Immutable<RoomBackgroundData> {
	let roomBackground: Immutable<RoomBackgroundData> = DEFAULT_BACKGROUND;

	if (typeof background === 'string') {
		const definition = assetManager.getBackgroundById(background);
		if (definition) {
			roomBackground = baseUrl ? {
				...definition,
				image: baseUrl + definition.image,
			} : definition;
		}
	} else {
		roomBackground = background;
	}

	return roomBackground;
}

/** What is the minimal scale allowed for character inside room. */
export const CHARACTER_MIN_SIZE = 0.05;

/** Calculates maximum Y coordinate for character in room based on background config */
export function CalculateCharacterMaxYForBackground(roomBackground: Immutable<RoomBackgroundData>): number {
	// Y is limited by room size, but also by background and by lowest achievable character size
	return Math.floor(Math.min(
		roomBackground.maxY != null ? Math.min(roomBackground.maxY, roomBackground.size[1]) : roomBackground.size[1],
		(1 - CHARACTER_MIN_SIZE) * roomBackground.size[1] / roomBackground.scaling,
	));
}
