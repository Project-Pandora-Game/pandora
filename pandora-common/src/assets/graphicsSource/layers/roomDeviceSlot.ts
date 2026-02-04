import * as z from 'zod';
import { ConditionSchema } from '../../graphics/conditions.ts';
import { RoomDeviceGraphicsCharacterPositionOverrideSchema, RoomDeviceGraphicsCharacterPositionSchema } from '../../graphics/layers/roomDeviceSlot.ts';

export const GraphicsSourceRoomDeviceLayerSlotSchema = z.object({
	type: z.literal('slot'),
	/** If configured, then this condition needs to be satisfied for this layer to display. */
	enableCond: ConditionSchema.optional(),
	name: z.string().optional(),
	/**
	 * Is the name of the character slot that is drawn on this layer.
	 */
	slot: z.string(),
	characterPosition: RoomDeviceGraphicsCharacterPositionSchema,
	characterPositionOverrides: RoomDeviceGraphicsCharacterPositionOverrideSchema.array().optional(),
}).strict();
export type GraphicsSourceRoomDeviceLayerSlot = z.infer<typeof GraphicsSourceRoomDeviceLayerSlotSchema>;
