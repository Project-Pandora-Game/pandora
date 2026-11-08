import type { Immutable } from 'immer';
import { RoomProjectionResolver } from '../../math/graphics/roomProjection.ts';
import type { RoomPosition } from './roomGeometry.ts';
import type { AssetFrameworkRoomState } from './roomState.ts';

const projectionResolverCache = new WeakMap<object, RoomProjectionResolver>();

/** Gets a (cached) projection resolver for the room */
export function GetRoomProjectionResolver(room: Pick<AssetFrameworkRoomState, 'roomBackground'>): RoomProjectionResolver {
	let resolver = projectionResolverCache.get(room.roomBackground);
	if (resolver === undefined) {
		resolver = new RoomProjectionResolver(room.roomBackground);
		projectionResolverCache.set(room.roomBackground, resolver);
	}
	return resolver;
}

/**
 * Calculates the x component of the "relative lock" follow delta.
 * It is the distance on the room canvas divided by the target's depth scale (so the world distance at the target's depth),
 * which keeps the visual distance constant when characters at different depths move sideways.
 */
export function CalculateRelativeLockDeltaX(
	followerPosition: Immutable<RoomPosition>,
	targetPosition: Immutable<RoomPosition>,
	room: Pick<AssetFrameworkRoomState, 'roomBackground'>,
): number {
	const resolver = GetRoomProjectionResolver(room);
	const targetCanvasX = resolver.transform(targetPosition[0], targetPosition[1], 0)[0];
	const followerCanvasX = resolver.transform(followerPosition[0], followerPosition[1], 0)[0];

	return Math.round((followerCanvasX - targetCanvasX) / resolver.scaleAt(targetPosition[0], targetPosition[1], 0));
}

/**
 * Inverse of `CalculateRelativeLockDeltaX`: finds the world x of the follower, given its already known world y.
 * (Result is not rounded or clamped)
 */
export function ApplyRelativeLockDeltaX(
	deltaX: number,
	targetPosition: Immutable<RoomPosition>,
	followerY: number,
	room: Pick<AssetFrameworkRoomState, 'roomBackground'>,
): number {
	const resolver = GetRoomProjectionResolver(room);
	const targetCanvasX = resolver.transform(targetPosition[0], targetPosition[1], 0)[0];
	const followerCanvasX = targetCanvasX + deltaX * resolver.scaleAt(targetPosition[0], targetPosition[1], 0);
	const followerFloorY = resolver.transform(0, followerY, 0)[1];

	return resolver.inverseGivenZ(followerCanvasX, followerFloorY, 0, true)[0];
}
