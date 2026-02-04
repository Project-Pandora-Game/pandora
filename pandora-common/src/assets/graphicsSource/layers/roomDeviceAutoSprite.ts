import * as z from 'zod';
import { CoordinatesSchema, RectangleSchema } from '../../graphics/common.ts';
import { LayerImageOverrideSchema, LayerNormalDataSchema } from '../../graphics/layers/common.ts';
import { ConditionSchema } from '../../graphics/conditions.ts';

export const GraphicsSourceRoomDeviceAutoSpriteGraphicalLayerSchema = z.object({
	name: z.string(),
	colorizationKey: z.string().optional(),
	imageOverrides: LayerImageOverrideSchema.array().optional(),
});
export type GraphicsSourceRoomDeviceAutoSpriteGraphicalLayer = z.infer<typeof GraphicsSourceRoomDeviceAutoSpriteGraphicalLayerSchema>;

export const GraphicsSourceRoomDeviceAutoSpriteLayerVariableSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('typedModule'),
		module: z.string(),
	}),
]);
export type GraphicsSourceRoomDeviceAutoSpriteLayerVariable = z.infer<typeof GraphicsSourceRoomDeviceAutoSpriteLayerVariableSchema>;

export const GraphicsSourceRoomDeviceAutoSpriteLayerSchema = RectangleSchema.extend({
	type: z.literal('autoSprite'),
	/** If configured, then this condition needs to be satisfied for this layer to display. */
	enableCond: ConditionSchema.optional(),
	name: z.string(),
	/**
	 * Offset of this sprite relative to cage's origin point
	 * @default { x: 0, y: 0 }
	 */
	offsetOverrides: z.object({
		offset: CoordinatesSchema,
		condition: ConditionSchema,
	}).array().optional(),
	/**
	 * Clips the graphics to the room, at the matching perspective transform depth.
	 * This is useful mainly for items that want to stop at a wall or ceiling (e.g. a chain going to ceiling), no matter how far the wall is.
	 * @default false
	 */
	clipToRoom: z.boolean().optional(),
	graphicalLayers: GraphicsSourceRoomDeviceAutoSpriteGraphicalLayerSchema.array(),
	variables: GraphicsSourceRoomDeviceAutoSpriteLayerVariableSchema.array(),

	normalMap: LayerNormalDataSchema.optional(),
	imageMap: z.record(z.string(), z.string().array()),
}).strict();
export type GraphicsSourceRoomDeviceAutoSpriteLayer = z.infer<typeof GraphicsSourceRoomDeviceAutoSpriteLayerSchema>;
