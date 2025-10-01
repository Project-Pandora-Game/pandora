import * as z from 'zod';
import { CoordinatesSchema } from '../common.ts';
import { ConditionSchema } from '../conditions.ts';
import { LayerNormalDataSchema, RoomDeviceLayerImageSettingSchema } from './common.ts';

export const GraphicsMeshGeometry2DSchema = z.object({
	type: z.literal('2d'),

	/** The positions of the mesh. Must be `2*verticesNum` long. */
	positions: z.number().array(),
	/** The UVs of the mesh.  Must be `2*verticesNum` long. */
	uvs: z.number().array(),
	/** The indices of the mesh. Size depends on toplogy, must index vertices. */
	indices: z.number().int().nonnegative().array(),
	/** The topology of the mesh. */
	topology: z.enum(['triangle-list']),

	/**
	 * Offset the positions, relative to device's origin point
	 * @default { x: 0, y: 0 }
	 */
	offset: CoordinatesSchema.optional(),
	offsetOverrides: z.object({
		offset: CoordinatesSchema,
		condition: ConditionSchema,
	}).array().optional(),
});
export type GraphicsMeshGeometry2D = z.infer<typeof GraphicsMeshGeometry2DSchema>;

export const GraphicsMeshGeometrySchema = z.discriminatedUnion('type', [
	GraphicsMeshGeometry2DSchema,
]);
export type GraphicsMeshGeometry = z.infer<typeof GraphicsMeshGeometrySchema>;

export const RoomDeviceGraphicsLayerMeshSchema = z.object({
	type: z.literal('mesh'),
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
export type RoomDeviceGraphicsLayerMesh = z.infer<typeof RoomDeviceGraphicsLayerMeshSchema>;
