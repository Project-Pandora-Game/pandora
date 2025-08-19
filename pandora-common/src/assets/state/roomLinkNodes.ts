import { freeze, type Immutable } from 'immer';
import { z } from 'zod';
import { Assert, AssertNever, RotateArray } from '../../utility/misc.ts';
import type { CardinalDirection, Coordinates } from '../graphics/common.ts';
import { FixRoomPosition, GetRoomPositionBounds, type RoomBackgroundData } from './roomGeometry.ts';

/*
Room link nodes describe where inside the room, the room links to another room.
*/

export const ROOM_NODE_RADIUS: number = 100;

/** A config for a single room link node */
export const RoomLinkNodeConfigSchema = z.object({
	/**
	 * Position in the room where this link node is positioned.
	 * `null` means automatic position where possible (usually in the middle of the matching room's edge)
	 */
	position: z.tuple([z.number().int(), z.number().int()]).nullable().catch(null),
	/**
	 * Disabled room links cannot be traversed in an outgoing direction.
	 * They still work fine as arrival point.
	 * Note, that even enabled link might not be usable, e.g. due to no room being in its direction.
	 */
	disabled: z.boolean().catch(false),
});
/** A config for a single room link node */
export type RoomLinkNodeConfig = z.infer<typeof RoomLinkNodeConfigSchema>;

const DEFAULT_LINK_NODE = freeze<RoomLinkNodeConfig>({ position: null, disabled: false });

/** Config for a single room, describing link nodes in cardinal directions, relative to the room's main direction */
export const RoomNeighborLinkNodesConfigSchema = z.object({
	/** -x */
	left: RoomLinkNodeConfigSchema.catch(DEFAULT_LINK_NODE),
	/** +x */
	right: RoomLinkNodeConfigSchema.catch(DEFAULT_LINK_NODE),
	/** -y */
	near: RoomLinkNodeConfigSchema.catch(DEFAULT_LINK_NODE),
	/** +y */
	far: RoomLinkNodeConfigSchema.catch(DEFAULT_LINK_NODE),
});
/** Config for a single room, describing link nodes in cardinal directions, relative to the room's main direction */
export type RoomNeighborLinkNodesConfig = z.infer<typeof RoomNeighborLinkNodesConfigSchema>;

export const DEFAULT_ROOM_NEIGHBOR_LINK_CONFIG = freeze<RoomNeighborLinkNodesConfig>({
	left: DEFAULT_LINK_NODE,
	right: DEFAULT_LINK_NODE,
	near: DEFAULT_LINK_NODE,
	far: DEFAULT_LINK_NODE,
});

/**
 * A data generated from config describing a room link node
 */
export type RoomLinkNodeData = RoomLinkNodeConfig & {
	internalDirection: keyof RoomNeighborLinkNodesConfig;
	position: NonNullable<RoomLinkNodeConfig['position']>;
};

/**
 * A data generated from config describing cardinal links for the room
 */
export type RoomNeighborLinkNodesData = Record<CardinalDirection, RoomLinkNodeData>;

const ROTATION_AMOUNT: Record<CardinalDirection, number> = {
	N: 0,
	E: -1,
	S: -2,
	W: -3,
};

export function ResolveRoomNeighborLinkData(linkConfig: Immutable<RoomNeighborLinkNodesConfig>, roomDirection: CardinalDirection, background: Immutable<RoomBackgroundData>): Immutable<RoomNeighborLinkNodesData> {
	const resultLinks: Immutable<RoomLinkNodeData>[] = [];

	const { minX, maxX, minY, maxY } = GetRoomPositionBounds(background);

	// Iterate in the clockwise direction as if going through cardinal directions, if the room was pointing north
	for (const d of (['far', 'right', 'near', 'left'] as const satisfies readonly (keyof RoomNeighborLinkNodesConfig)[])) {
		const config = linkConfig[d];

		const link: Immutable<RoomLinkNodeData> = {
			internalDirection: d,
			disabled: config.disabled,
			position: FixRoomPosition(config.position ?? [
				d === 'left' ? (minX + ROOM_NODE_RADIUS) : d === 'right' ? (maxX - ROOM_NODE_RADIUS) : (minX + maxX) / 2,
				d === 'near' ? (minY + ROOM_NODE_RADIUS) : d === 'far' ? (maxY - ROOM_NODE_RADIUS) : (minY + maxY) / 2,
			], background),
		};

		resultLinks.push(link);
	}

	// Rotate the result links
	RotateArray(resultLinks, ROTATION_AMOUNT[roomDirection]);

	Assert(resultLinks.length === 4);
	return {
		N: resultLinks[0],
		E: resultLinks[1],
		S: resultLinks[2],
		W: resultLinks[3],
	};
}

export function SpaceRoomLayoutNeighborRoomCoordinates(baseCoordinates: Immutable<Coordinates>, direction: CardinalDirection): Immutable<Coordinates> {
	switch (direction) {
		case 'N':
			return { x: baseCoordinates.x, y: baseCoordinates.y - 1 };
		case 'E':
			return { x: baseCoordinates.x + 1, y: baseCoordinates.y };
		case 'S':
			return { x: baseCoordinates.x, y: baseCoordinates.y + 1 };
		case 'W':
			return { x: baseCoordinates.x - 1, y: baseCoordinates.y };
	}
	AssertNever(direction);
}
