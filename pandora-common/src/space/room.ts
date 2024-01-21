import { z } from 'zod';
import { HexColorString } from '../validation';
import { AssetManager } from '../assets';
import { Immutable } from 'immer';
import { CloneDeepMutable } from '../utility';

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

export const DEFAULT_BACKGROUND = {
	image: '#1099bb',
	imageSize: [4000, 2000],
	floorArea: [4000, 2000],
	areaCoverage: 1,
	ceiling: 0,
	cameraCenterOffset: [0, 0],
	cameraFov: 80,
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
		floorArea: [floorAreaWidth, floorAreaDepth],
		areaCoverage: calibrationData.areaCoverage,
		ceiling: Math.ceil(calibrationData.ceiling / calibrationData.baseScale),
		cameraCenterOffset: CloneDeepMutable(calibrationData.cameraCenterOffset),
		cameraFov: calibrationData.fov,
	};
}
