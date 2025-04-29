import { freeze, type Immutable } from 'immer';
import { clamp } from 'lodash-es';
import { z } from 'zod';
import type { CharacterRoomPosition } from '../../character/characterData.ts';
import { AssertNever, CloneDeepMutable } from '../../utility/misc.ts';
import { HexColorStringSchema } from '../../validation.ts';
import type { AssetManager } from '../assetManager.ts';
import { CharacterSize } from '../graphics/graphics.ts';

export const RoomBackgroundDataSchema = z.object({
	/** The background image of a room */
	image: z.string(),

	/** The size of the image, in pixels */
	imageSize: z.tuple([z.number().int().min(0), z.number().int().min(0)]),

	/** The width and depth of the floor area of the room */
	floorArea: z.tuple([z.number().int().min(0), z.number().int().min(0)]),

	/** How much of the image's bottom edge is covered by the area */
	areaCoverage: z.number().min(0.01),

	/** The height of the ceiling, in area size units. Unused, debug-only. */
	ceiling: z.number().min(0),

	/** The offset of the camera's center, used for calculating skew */
	cameraCenterOffset: z.tuple([z.number(), z.number()]),

	/** The camera's FOV - used for accurately representing distances on the Z axes (but those are not really used throughout Pandora at the moment) */
	cameraFov: z.number().min(0.1).max(135),
});
export type RoomBackgroundData = z.infer<typeof RoomBackgroundDataSchema>;

export const RoomGeometryConfigSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.enum(['defaultPersonalSpace', 'defaultPublicSpace']),
	}),
	z.object({
		type: z.literal('premade'),
		id: z.string(),
	}),
	RoomBackgroundDataSchema
		.extend({
			type: z.literal('plain'),
			image: HexColorStringSchema.catch('#1099bb'), // Overrides parent property
		}),
]);
export type RoomGeometryConfig = z.infer<typeof RoomGeometryConfigSchema>;

const FALLBACK_ROOM_BACKGROUND = freeze<Immutable<RoomBackgroundData>>({
	image: '#1099bb',
	imageSize: [4000, 2000],
	floorArea: [4000, 2000],
	areaCoverage: 1,
	ceiling: 0,
	cameraCenterOffset: [0, 0],
	cameraFov: 80,
}, true);

/**
 * Resolves room background data into effective background info
 * @param assetManager - Asset manager to query for backgrounds
 * @param background - The background to resolve
 * @param baseUrl - Base URL to use for resolving image path, otherwise no change
 */
export function ResolveBackground(assetManager: AssetManager, roomGeometryConfig: Immutable<RoomGeometryConfig>): Immutable<RoomBackgroundData> | null {
	switch (roomGeometryConfig.type) {
		case 'defaultPersonalSpace':
		case 'defaultPublicSpace':
			// Try to use the first background (if there is some)
			// otherwise default to the default, solid-color background (important for tests that don't have any assets).
			return assetManager.getBackgrounds()[0] ?? FALLBACK_ROOM_BACKGROUND;
		case 'premade':
			return assetManager.getBackgroundById(roomGeometryConfig.id);
		case 'plain':
			return roomGeometryConfig;
		default:
			AssertNever(roomGeometryConfig);
	}
}

export const RoomBackgroundCalibrationDataSchema = z.object({
	imageSize: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
	cameraCenterOffset: z.tuple([z.number().int(), z.number().int()]),
	areaCoverage: z.number(),
	ceiling: z.number().min(0),
	areaDepthRatio: z.number().min(0.01),
	baseScale: z.number().min(0.01),
	fov: z.number().min(0.1).max(135),
});
export type RoomBackgroundCalibrationData = z.infer<typeof RoomBackgroundCalibrationDataSchema>;

export function CalculateBackgroundDataFromCalibrationData(image: string, calibrationData: Immutable<RoomBackgroundCalibrationData>): RoomBackgroundData {
	const renderedAreaWidth = calibrationData.imageSize[0] / calibrationData.baseScale;
	const floorAreaWidth = calibrationData.areaCoverage * renderedAreaWidth;
	const floorAreaDepth = calibrationData.areaDepthRatio * renderedAreaWidth;

	return {
		image,
		imageSize: CloneDeepMutable(calibrationData.imageSize),
		floorArea: [Math.floor(floorAreaWidth), Math.floor(floorAreaDepth)],
		areaCoverage: calibrationData.areaCoverage,
		ceiling: Math.ceil(calibrationData.ceiling / calibrationData.baseScale),
		cameraCenterOffset: CloneDeepMutable(calibrationData.cameraCenterOffset),
		cameraFov: calibrationData.fov,
	};
}

export function IsValidRoomPosition(roomBackground: Immutable<RoomBackgroundData>, position: CharacterRoomPosition): boolean {
	const minX = -Math.floor(roomBackground.floorArea[0] / 2);
	const maxX = Math.floor(roomBackground.floorArea[0] / 2);
	const minY = 0;
	const maxY = roomBackground.floorArea[1];

	return position[0] >= minX && position[0] <= maxX && position[1] >= minY || position[1] <= maxY;
}

export function GenerateInitialRoomPosition(roomBackground: Immutable<RoomBackgroundData>): CharacterRoomPosition {
	// Random spread to use for the positioning
	const spreadX = 1000;
	const spreadY = 100;

	// Absolute bounds of the background
	const minX = -Math.floor(roomBackground.floorArea[0] / 2);
	const maxX = Math.floor(roomBackground.floorArea[0] / 2);
	const minY = 0;
	const maxY = roomBackground.floorArea[1];

	// Idea is to position new characters to the very left of still visible background
	// and slightly up to avoid the name being out of bounds
	// (as the position is position of feet and name is under the character)
	const startPointX =
		(-0.5 * (roomBackground.floorArea[0] / roomBackground.areaCoverage))
		+ 0.5 * CharacterSize.WIDTH
		+ (Math.random() - 0.5) * spreadX;

	const startPointY =
		minY
		+ 200
		+ (Math.random() - 0.5) * spreadY;

	return [
		clamp(Math.round(startPointX), minX, maxX),
		clamp(Math.round(startPointY), minY, maxY),
		0,
	];
}
