import { Immutable } from 'immer';
import { clamp } from 'lodash-es';
import {
	Assert,
	RoomBackgroundData,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { useMemo } from 'react';

export interface RoomProjectionResolver {
	/**
	 * Gets an on-screen position a point on the given coordinates in the world should be rendered to.
	 */
	transform(x: number, y: number, z: number): [x: number, y: number];
	/**
	 * Gets a scale that should be applied to a point on the given coordinates. Accounts for base scale as well.
	 */
	scaleAt(x: number, y: number, z: number): number;
	/**
	 * Gets the 3D coordinates from on-screen coordinates, if Z coordinate (height) is already known
	 * @param resX - The on-screen X coordinate
	 * @param resY - The on-screen Y coordinate
	 * @param z - The target height
	 * @param ignoreFloorBounds - If normal floor bounds should be ignored
	 * (allows arbitrary values for x and y that match closest, otherwise it selects closest values still within bounds)
	 * Default: `false`
	 */
	inverseGivenZ(resX: number, resY: number, z: number, ignoreFloorBounds?: boolean): [x: number, y: number, z: number];
	/**
	 * Takes a position and returns the closest valid position
	 */
	fixupPosition(position: readonly [x: number, y: number, z: number]): [x: number, y: number, z: number];
	imageAspectRatio: number;
	floorAreaWidthLeft: number;
	floorAreaWidthRight: number;
	floorAreaDepth: number;
	ceiling: number;
	renderedAreaWidth: number;
	renderedAreaHeight: number;
}

export function useRoomViewProjection(roomBackground: Immutable<RoomBackgroundData>): Immutable<RoomProjectionResolver> {
	return useMemo((): Immutable<RoomProjectionResolver> => {
		const {
			imageSize,
			cameraCenterOffset,
			ceiling,
			areaCoverage,
			cameraFov,
			floorArea,
		} = roomBackground;

		const imageAspectRatio = imageSize[0] / imageSize[1];

		const floorAreaWidth = floorArea[0];
		const floorAreaWidthHalf = Math.floor(floorArea[0] / 2);
		const floorAreaDepth = floorArea[1];

		const renderedAreaWidth = floorAreaWidth / areaCoverage;
		const renderedAreaHeight = renderedAreaWidth / imageAspectRatio;
		const renderedAreaScale = imageSize[0] / renderedAreaWidth;

		const cameraSkewX = cameraCenterOffset[0] / imageSize[0];
		const cameraSkewY = cameraCenterOffset[1] / imageSize[1];

		const areaCameraPositionX = cameraSkewX * renderedAreaWidth;
		const areaCameraPositionZ = (0.5 + cameraSkewY) * renderedAreaHeight;

		const frustumNearDistance = (0.5 * renderedAreaHeight) / Math.tan(cameraFov * 0.5 * PIXI.DEG_TO_RAD);

		const transform = (x: number, y: number, z: number): [x: number, y: number] => {
			const scale = frustumNearDistance / (y + frustumNearDistance);

			return [
				imageSize[0] * (0.5 + cameraSkewX + scale * (x - areaCameraPositionX) / renderedAreaWidth),
				imageSize[1] * (0.5 - cameraSkewY - scale * (z - areaCameraPositionZ) / renderedAreaHeight),
			];
		};

		const scaleAt = (_x: number, y: number, _z: number): number => {
			return renderedAreaScale * (frustumNearDistance / (y + frustumNearDistance));
		};

		const horizonY = transform(NaN, Infinity, 0)[1];
		Assert(!Number.isNaN(horizonY));
		const maxFloorY = transform(NaN, floorAreaDepth, 0)[1];
		Assert(!Number.isNaN(maxFloorY));

		const inverseGivenZ = (resX: number, resY: number, z: number, ignoreFloorBounds: boolean = false): [x: number, y: number, z: number] => {
			// Clamp input to the viewport
			resX = clamp(resX, 0, imageSize[0]);
			// Remember, that Y increases from the bottom, and we need `scale` to be strictly bigger than zero (doesn't matter how small)
			resY = clamp(resY, horizonY + 1, imageSize[1]);

			// If the floor bounds are not ignored, limit the values further to match floor
			if (!ignoreFloorBounds) {
				resY = clamp(resY, maxFloorY, imageSize[1]);
			}

			const scale = (0.5 - cameraSkewY - (resY / imageSize[1])) * renderedAreaHeight / (z - areaCameraPositionZ);
			const x = ((-0.5 - cameraSkewX + (resX / imageSize[0])) * renderedAreaWidth / scale) + areaCameraPositionX;
			const y = (frustumNearDistance / scale) - frustumNearDistance;

			// Clamp the output coordinates to the floor area
			if (!ignoreFloorBounds) {
				return [
					clamp(x, -floorAreaWidthHalf, floorAreaWidthHalf),
					clamp(y, 0, floorAreaDepth),
					z,
				];
			}

			return [x, y, z];
		};

		const fixupPosition = ([x, y, z]: readonly [x: number, y: number, z: number]): [x: number, y: number, z: number] => {
			const minX = -floorAreaWidthHalf;
			const maxX = floorAreaWidthHalf;
			const minY = 0;
			const maxY = roomBackground.floorArea[1];

			return [
				clamp(Math.round(x), minX, maxX),
				clamp(Math.round(y), minY, maxY),
				Math.round(z),
			];
		};

		return {
			transform,
			scaleAt,
			inverseGivenZ,
			fixupPosition,
			imageAspectRatio,
			floorAreaWidthLeft: floorAreaWidthHalf,
			floorAreaWidthRight: floorAreaWidthHalf,
			floorAreaDepth,
			ceiling,
			renderedAreaWidth,
			renderedAreaHeight,
		};
	}, [roomBackground]);
}
