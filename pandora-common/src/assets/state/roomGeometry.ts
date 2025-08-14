import { freeze, produce, type Draft, type Immutable } from 'immer';
import { clamp, isEqual } from 'lodash-es';
import type { Writable } from 'type-fest';
import { z } from 'zod';
import { CharacterIdSchema } from '../../character/characterTypes.ts';
import { Assert, AssertNever, CloneDeepMutable } from '../../utility/misc.ts';
import { HexColorStringSchema } from '../../validation.ts';
import { RoomIdSchema } from '../appearanceTypes.ts';
import type { AssetManager } from '../assetManager.ts';
import { CharacterSize } from '../graphics/graphics.ts';
import type { AssetFrameworkCharacterState } from './characterState.ts';
import type { AssetFrameworkGlobalState } from './globalState.ts';

export const RoomBackground3dBoxSideSchema = z.object({
	texture: z.string().catch('*'),
	tint: HexColorStringSchema.catch('#FFFFFF'),
	rotate: z.boolean().catch(false),
	tileScale: z.number().int().positive().max(10).catch(2),
});
export type RoomBackground3dBoxSide = z.infer<typeof RoomBackground3dBoxSideSchema>;
export const RoomBackgroundGraphicsSchema3dBoxSchema = z.object({
	type: z.literal('3dBox'),
	floor: RoomBackground3dBoxSideSchema,
	wallBack: RoomBackground3dBoxSideSchema,
	wallLeft: RoomBackground3dBoxSideSchema.nullable(),
	wallRight: RoomBackground3dBoxSideSchema.nullable(),
	ceiling: RoomBackground3dBoxSideSchema.nullable(),
});
export type RoomBackgroundGraphicsSchema3dBox = z.infer<typeof RoomBackgroundGraphicsSchema3dBoxSchema>;

export const RoomBackgroundGraphicsSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('image'),
		image: z.string(),
	}),
	RoomBackgroundGraphicsSchema3dBoxSchema,
]);
export type RoomBackgroundGraphics = z.infer<typeof RoomBackgroundGraphicsSchema>;

export const RoomBackgroundDataSchema = z.object({
	/** Graphics of the background */
	graphics: RoomBackgroundGraphicsSchema,

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
	z.object({
		type: z.literal('plain'),
		image: HexColorStringSchema.catch('#1099bb'),
	}),
	z.object({
		type: z.literal('3dBox'),
		graphics: RoomBackgroundGraphicsSchema3dBoxSchema,
		floorArea: z.tuple([z.number().int().min(CharacterSize.WIDTH), z.number().int().min(0)]),
		ceiling: z.number().min(CharacterSize.HEIGHT),
		cameraFov: z.number().min(0.1).max(135),
		cameraHeight: z.number().int().min(0),
	}),
]);
export type RoomGeometryConfig = z.infer<typeof RoomGeometryConfigSchema>;

export const DEFAULT_PLAIN_BACKGROUND = freeze<Immutable<RoomGeometryConfig>>({
	type: 'plain',
	image: '#1099bb',
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
			return assetManager.getBackgrounds()[0] ?? ResolveBackground(assetManager, DEFAULT_PLAIN_BACKGROUND);
		case 'premade':
			return assetManager.getBackgroundById(roomGeometryConfig.id);
		case 'plain':
			return {
				graphics: {
					type: 'image',
					image: roomGeometryConfig.image,
				},
				imageSize: [4000, 2000],
				floorArea: [4000, 2000],
				areaCoverage: 1,
				ceiling: 0,
				cameraCenterOffset: [0, 0],
				cameraFov: 80,
			};
		case '3dBox':
			return {
				graphics: roomGeometryConfig.graphics,
				imageSize: [roomGeometryConfig.floorArea[0], roomGeometryConfig.ceiling],
				floorArea: roomGeometryConfig.floorArea,
				areaCoverage: 1,
				ceiling: roomGeometryConfig.ceiling,
				cameraCenterOffset: [0, roomGeometryConfig.cameraHeight - 0.5 * roomGeometryConfig.ceiling],
				cameraFov: roomGeometryConfig.cameraFov,
			};
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
		graphics: {
			type: 'image',
			image,
		},
		imageSize: CloneDeepMutable(calibrationData.imageSize),
		floorArea: [Math.floor(floorAreaWidth), Math.floor(floorAreaDepth)],
		areaCoverage: calibrationData.areaCoverage,
		ceiling: Math.ceil(calibrationData.ceiling / calibrationData.baseScale),
		cameraCenterOffset: CloneDeepMutable(calibrationData.cameraCenterOffset),
		cameraFov: calibrationData.fov,
	};
}

export const CharacterRoomPositionSchema: z.ZodType<CharacterRoomPosition, z.ZodTypeDef, unknown> = z.tuple([z.number().int(), z.number().int(), z.number().int()])
	.catch([0, 0, 0])
	.readonly();
export type CharacterRoomPosition = readonly [x: number, y: number, yOffset: number];

export const CharacterRoomPositionFollowSchema = z.discriminatedUnion('followType', [
	z.object({
		followType: z.literal('relativeLock'),
		target: CharacterIdSchema,
		delta: CharacterRoomPositionSchema,
	}),
	z.object({
		followType: z.literal('leash'),
		target: CharacterIdSchema,
		distance: z.number().int().nonnegative(),
	}),
]);
export type CharacterRoomPositionFollow = z.infer<typeof CharacterRoomPositionFollowSchema>;

export const CharacterSpacePositionSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('normal'),
		room: RoomIdSchema.catch('room:default'),
		position: CharacterRoomPositionSchema,
		following: CharacterRoomPositionFollowSchema.optional(),
	}),
]);
export type CharacterSpacePosition = z.infer<typeof CharacterSpacePositionSchema>;

export function IsValidRoomPosition(roomBackground: Immutable<RoomBackgroundData>, position: Immutable<CharacterRoomPosition>): boolean {
	const { minX, maxX, minY, maxY } = GetRoomPositionBounds(roomBackground);

	return position[0] >= minX && position[0] <= maxX && position[1] >= minY && position[1] <= maxY;
}

export function GetRoomPositionBounds(roomBackground: Immutable<RoomBackgroundData>): { minX: number; maxX: number; minY: number; maxY: number; } {
	const minX = -Math.floor(roomBackground.floorArea[0] / 2);
	const maxX = Math.floor(roomBackground.floorArea[0] / 2);
	const minY = 0;
	const maxY = roomBackground.floorArea[1];

	return { minX, maxX, minY, maxY };
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

export function CharacterCanFollow(character: AssetFrameworkCharacterState, globalState: AssetFrameworkGlobalState): boolean {
	// Noone must be following this character
	if (Array.from(globalState.characters.values()).some((c) => c.position.type === 'normal' && c.position.following?.target === character.id))
		return false;

	// Characters in room devices cannot follow someone
	if (character.items.some((i) => i.isType('roomDeviceWearablePart')))
		return false;

	return true;
}

export function CharacterCanBeFollowed(character: AssetFrameworkCharacterState): boolean {
	const followTargetPosition = character.position;
	// Target character must be in a normal movement mode without any follow themselves (chaining is not allowed for now)
	if (followTargetPosition.type !== 'normal' || followTargetPosition.following != null) {
		return false;
	}
	// Characters in room devices cannot be followed
	if (character.items.some((i) => i.isType('roomDeviceWearablePart')))
		return false;

	return true;
}

export function GlobalStateAutoProcessCharacterPositions(globalState: AssetFrameworkGlobalState): AssetFrameworkGlobalState {
	let result: AssetFrameworkGlobalState = globalState;
	for (const characterId of Array.from(globalState.characters.keys())) {
		let character = result.characters.get(characterId);
		Assert(character != null);
		if (character.position.type === 'normal' && character.position.following != null) {
			const following = character.position.following;
			const followTarget = globalState.getCharacterState(following.target);
			if (followTarget == null || !CharacterCanBeFollowed(followTarget) || !CharacterCanFollow(character, result)) {
				character = character.produceWithSpacePosition(produce(character.position, (d) => {
					delete d.following;
				}));
			} else {
				const targetCharacterRoom = globalState.space.getRoom(followTarget.position.room);
				Assert(targetCharacterRoom != null);

				if (following.followType === 'relativeLock') {
					// In relative lock always maintain relative position
					const position: Draft<CharacterSpacePosition> = CloneDeepMutable(character.position);
					position.room = targetCharacterRoom.id;
					for (let i = 0; i <= 2; i++) {
						position.position[i] = followTarget.position.position[i] + following.delta[i];
					}
					const { minX, maxX, minY, maxY } = GetRoomPositionBounds(targetCharacterRoom.roomBackground);
					position.position[0] = clamp(position.position[0], minX, maxX);
					position.position[1] = clamp(position.position[1], minY, maxY);
					if (!isEqual(position, character.position)) {
						character = character.produceWithSpacePosition(position);
					}
				} else if (following.followType === 'leash') {
					// Leash works by pulling characters closer to gether if they are too far apart, keeping direction vector
					const position: Draft<CharacterSpacePosition> = CloneDeepMutable(character.position);
					position.room = targetCharacterRoom.id;
					const deltaVector: Writable<CharacterRoomPosition> = CloneDeepMutable(position.position);
					for (let i = 0; i <= 2; i++) {
						deltaVector[i] -= followTarget.position.position[i];
					}
					const currentDistance = Math.hypot(...deltaVector);
					if (currentDistance > following.distance) {
						const ratio = following.distance / currentDistance;
						for (let i = 0; i <= 2; i++) {
							deltaVector[i] = followTarget.position.position[i] + Math.round(deltaVector[i] * ratio);
						}
						const { minX, maxX, minY, maxY } = GetRoomPositionBounds(targetCharacterRoom.roomBackground);
						deltaVector[0] = clamp(deltaVector[0], minX, maxX);
						deltaVector[1] = clamp(deltaVector[1], minY, maxY);
						position.position = deltaVector;
					}
					if (!isEqual(position, character.position)) {
						character = character.produceWithSpacePosition(position);
					}
				} else {
					AssertNever(following);
				}
			}
		}

		result = result.withCharacter(characterId, character);
	}

	return result;
}
