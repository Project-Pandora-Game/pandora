import { freeze, type Immutable } from 'immer';
import * as z from 'zod';
import { SpaceRoleSchema } from '../../space/spaceRoles.ts';
import type { CardinalDirection } from '../graphics/common.ts';

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
	/**
	 * Minimum space role required to use this room link node.
	 * @note This property is not saved in room templates and if used as part of it, has no effect.
	 */
	useMinimumRole: SpaceRoleSchema.optional().catch(undefined),
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
export type RoomLinkNodeData = Omit<RoomLinkNodeConfig, 'position'> & {
	direction: CardinalDirection;
	internalDirection: keyof RoomNeighborLinkNodesConfig;
	position: Immutable<NonNullable<RoomLinkNodeConfig['position']>>;
};

/**
 * A data generated from config describing cardinal links for the room
 */
export type RoomNeighborLinkNodesData = Record<CardinalDirection, RoomLinkNodeData>;
