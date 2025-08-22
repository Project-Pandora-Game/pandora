import type { Immutable } from 'immer';
import { clamp } from 'lodash-es';
import type { RoomBackgroundData } from '../../assets/index.ts';
import { Assert, MemoizeNoArg } from '../../utility/misc.ts';
import { DEG_TO_RAD } from '../constants.ts';

export class RoomProjectionResolver {
	private readonly roomBackground: Immutable<RoomBackgroundData>;

	public readonly imageAspectRatio: number;
	public readonly floorAreaWidthLeft: number;
	public readonly floorAreaWidthRight: number;
	public readonly floorAreaDepth: number;
	public readonly ceiling: number;
	public readonly renderedAreaWidth: number;
	public readonly renderedAreaHeight: number;

	private readonly renderedAreaScale: number;
	private readonly cameraSkewX: number;
	private readonly cameraSkewY: number;
	private readonly areaCameraPositionX: number;
	private readonly areaCameraPositionZ: number;
	private readonly frustumNearDistance: number;

	@MemoizeNoArg
	public get horizonY(): number {
		return this.transform(NaN, Infinity, 0)[1];
	}

	@MemoizeNoArg
	public get maxFloorY(): number {
		return this.transform(NaN, this.floorAreaDepth, 0)[1];
	}

	constructor(roomBackground: Immutable<RoomBackgroundData>) {
		this.roomBackground = roomBackground;

		const {
			imageSize,
			cameraCenterOffset,
			ceiling,
			areaCoverage,
			cameraFov,
			floorArea,
		} = roomBackground;
		this.ceiling = ceiling;

		this.imageAspectRatio = imageSize[0] / imageSize[1];

		const floorAreaWidth = floorArea[0];
		const floorAreaWidthHalf = Math.floor(floorArea[0] / 2);
		this.floorAreaWidthLeft = floorAreaWidthHalf;
		this.floorAreaWidthRight = floorAreaWidthHalf;
		this.floorAreaDepth = floorArea[1];

		this.renderedAreaWidth = floorAreaWidth / areaCoverage;
		this.renderedAreaHeight = this.renderedAreaWidth / this.imageAspectRatio;
		this.renderedAreaScale = imageSize[0] / this.renderedAreaWidth;

		this.cameraSkewX = cameraCenterOffset[0] / imageSize[0];
		this.cameraSkewY = cameraCenterOffset[1] / imageSize[1];

		this.areaCameraPositionX = this.cameraSkewX * this.renderedAreaWidth;
		this.areaCameraPositionZ = (0.5 + this.cameraSkewY) * this.renderedAreaHeight;

		this.frustumNearDistance = (0.5 * this.renderedAreaHeight) / Math.tan(cameraFov * 0.5 * DEG_TO_RAD);

		Assert(!Number.isNaN(this.horizonY));
		Assert(!Number.isNaN(this.maxFloorY));

	}

	/**
	 * Gets an on-screen position a point on the given coordinates in the world should be rendered to.
	 */
	public transform(x: number, y: number, z: number): [x: number, y: number] {
		const scale = this.frustumNearDistance / (y + this.frustumNearDistance);

		return [
			this.roomBackground.imageSize[0] * (0.5 + this.cameraSkewX + scale * (x - this.areaCameraPositionX) / this.renderedAreaWidth),
			this.roomBackground.imageSize[1] * (0.5 - this.cameraSkewY - scale * (z - this.areaCameraPositionZ) / this.renderedAreaHeight),
		];
	}
	/**
	 * Gets a scale that should be applied to a point on the given coordinates. Accounts for base scale as well.
	 */
	public scaleAt(_x: number, y: number, _z: number): number {
		return this.renderedAreaScale * (this.frustumNearDistance / (y + this.frustumNearDistance));

	}
	/**
	 * Gets the 3D coordinates from on-screen coordinates, if Z coordinate (height) is already known
	 * @param resX - The on-screen X coordinate
	 * @param resY - The on-screen Y coordinate
	 * @param z - The target height
	 * @param ignoreFloorBounds - If normal floor bounds should be ignored
	 * (allows arbitrary values for x and y that match closest, otherwise it selects closest values still within bounds)
	 * Default: `false`
	 */
	public inverseGivenZ(resX: number, resY: number, z: number, ignoreFloorBounds: boolean = false): [x: number, y: number, z: number] {
		// Clamp input to the viewport
		resX = clamp(resX, 0, this.roomBackground.imageSize[0]);
		// Remember, that Y increases from the bottom, and we need `scale` to be strictly bigger than zero (doesn't matter how small)
		resY = clamp(resY, this.horizonY + 1, this.roomBackground.imageSize[1]);

		// If the floor bounds are not ignored, limit the values further to match floor
		if (!ignoreFloorBounds) {
			resY = clamp(resY, this.maxFloorY, this.roomBackground.imageSize[1]);
		}

		const scale = (0.5 - this.cameraSkewY - (resY / this.roomBackground.imageSize[1])) * this.renderedAreaHeight / (z - this.areaCameraPositionZ);
		const x = ((-0.5 - this.cameraSkewX + (resX / this.roomBackground.imageSize[0])) * this.renderedAreaWidth / scale) + this.areaCameraPositionX;
		const y = (this.frustumNearDistance / scale) - this.frustumNearDistance;

		// Clamp the output coordinates to the floor area
		if (!ignoreFloorBounds) {
			return this.fixupPosition([x, y, z]);
		}

		return [x, y, z];
	}
	/**
	 * Takes a position and returns the closest valid position
	 */
	public fixupPosition([x, y, z]: readonly [x: number, y: number, z: number]): [x: number, y: number, z: number] {
		const minX = -this.floorAreaWidthLeft;
		const maxX = this.floorAreaWidthRight;
		const minY = 0;
		const maxY = this.roomBackground.floorArea[1];

		return [
			clamp(Math.round(x), minX, maxX),
			clamp(Math.round(y), minY, maxY),
			Math.round(z),
		];
	}
}
