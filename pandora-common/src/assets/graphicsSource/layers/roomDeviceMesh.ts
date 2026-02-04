import * as z from 'zod';
import { ConditionSchema } from '../../graphics/conditions.ts';
import { LayerNormalDataSchema, RoomDeviceLayerImageSettingSchema } from '../../graphics/layers/common.ts';
import { GraphicsMeshGeometrySchema } from '../../graphics/layers/roomDeviceMesh.ts';

export const GraphicsSourceRoomDeviceLayerMeshSchema = z.object({
	type: z.literal('mesh'),
	/** If configured, then this condition needs to be satisfied for this layer to display. */
	enableCond: ConditionSchema.optional(),
	name: z.string().optional(),
	/** Geometry for the mesh */
	geometry: GraphicsMeshGeometrySchema,
	/** Name of colorization key used to color this sprite layer */
	colorizationKey: z.string().optional(),

	normalMap: LayerNormalDataSchema.optional(),
	image: RoomDeviceLayerImageSettingSchema,

	/**
	 * Clips the graphics to the room, at the matching perspective transform depth.
	 * This is useful mainly for items that want to stop at a wall or ceiling (e.g. a chain going to ceiling), no matter how far the wall is.
	 * @default false
	 */
	clipToRoom: z.boolean().optional(),
}).strict();
export type GraphicsSourceRoomDeviceLayerMesh = z.infer<typeof GraphicsSourceRoomDeviceLayerMeshSchema>;
