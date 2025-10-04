import * as z from 'zod';
import { CoordinatesSchema } from '../common.ts';
import { ConditionSchema } from '../conditions.ts';

export const RoomDeviceGraphicsCharacterPositionSchema = z.object({
	offsetX: z.number(),
	offsetY: z.number(),
	/**
	 * Is the factor by which the character is made bigger or smaller inside the room device slot,
	 * compared to this room device scaled inside the room
	 * @default 1
	 */
	relativeScale: z.number().optional(),
	/**
	 * Offset to apply to the character's pivot. (point around which character rotates and turns around)
	 * @see {CHARACTER_PIVOT_POSITION}
	 * @default
	 * { x: 0, y: 0 }
	 */
	pivotOffset: CoordinatesSchema.optional(),
	/**
	 * Prevents pose from changing character's offset or scale while inside this room device slot
	 * (for slots that allow different poses, but require precision)
	 * @default false
	 */
	disablePoseOffset: z.boolean().optional(),
});
export type RoomDeviceGraphicsCharacterPosition = z.infer<typeof RoomDeviceGraphicsCharacterPositionSchema>;

export const RoomDeviceGraphicsCharacterPositionOverrideSchema = z.object({
	position: RoomDeviceGraphicsCharacterPositionSchema,
	condition: ConditionSchema,
});
export type RoomDeviceGraphicsCharacterPositionOverride = z.infer<typeof RoomDeviceGraphicsCharacterPositionOverrideSchema>;

export const RoomDeviceGraphicsLayerSlotSchema = z.object({
	type: z.literal('slot'),
	/**
	 * Is the name of the character slot that is drawn on this layer.
	 */
	slot: z.string(),
	characterPosition: RoomDeviceGraphicsCharacterPositionSchema,
	characterPositionOverrides: RoomDeviceGraphicsCharacterPositionOverrideSchema.array().optional(),
}).strict();
export type RoomDeviceGraphicsLayerSlot = z.infer<typeof RoomDeviceGraphicsLayerSlotSchema>;
