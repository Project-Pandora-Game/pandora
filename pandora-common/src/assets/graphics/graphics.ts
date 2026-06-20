import * as z from 'zod';
import { AssetIdSchema, type AssetId } from '../base.ts';
import type { BoneType } from './conditions.ts';
import { InversePosingHandleSchema, type InversePosingHandle } from './inversePosing.ts';
import { GraphicsLayerSchema, RoomDeviceGraphicsLayerSchema } from './layer.ts';
import { PointTemplateSchema, type PointTemplate } from './points.ts';

export const CharacterSize = {
	WIDTH: 1000,
	HEIGHT: 1500,
} as const;

/** The maximum number of bones that can exist (includes mirrored bones as well). Used for various optimizations. */
export const MAX_BONE_COUNT = 32;

export interface BoneDefinition {
	name: string;
	x: number;
	y: number;
	baseRotation?: number;
	/** Offset relative to `x` and `y` which should be applied to UI handle. Happens before `parent` or `rotation` shifts. */
	uiPositionOffset?: readonly [x: number, y: number];
	mirror?: BoneDefinition;
	isMirror: boolean;
	parent?: BoneDefinition;
	type: BoneType;
}

export const AssetGraphicsWornDefinitionSchema = z.object({
	type: z.literal('worn'),
	layers: GraphicsLayerSchema.array(),
	/** The graphics that is used when the item can be (and is) deployed in a room. */
	roomLayers: RoomDeviceGraphicsLayerSchema.array().optional(),
}).strict();
export type AssetGraphicsWornDefinition = z.infer<typeof AssetGraphicsWornDefinitionSchema>;

export const AssetGraphicsRoomDeviceDefinitionSchema = z.object({
	type: z.literal('roomDevice'),
	/** The graphical display of the device */
	layers: RoomDeviceGraphicsLayerSchema.array(),
}).strict();
export type AssetGraphicsRoomDeviceDefinition = z.infer<typeof AssetGraphicsRoomDeviceDefinitionSchema>;

export type AssetGraphicsDefinition =
	| AssetGraphicsWornDefinition
	| AssetGraphicsRoomDeviceDefinition;
export const AssetGraphicsDefinitionSchema: z.ZodType<AssetGraphicsDefinition> = z.discriminatedUnion('type', [
	AssetGraphicsWornDefinitionSchema,
	AssetGraphicsRoomDeviceDefinitionSchema,
]);

export const GraphicsImageFormatSchema = z.enum(['avif', 'webp']);
export type GraphicsImageFormat = z.infer<typeof GraphicsImageFormatSchema>;

export interface GraphicsDefinitionFile {
	assets: Partial<Record<AssetId, AssetGraphicsDefinition>>;
	pointTemplates: Record<string, PointTemplate>;
	imageFormats: Partial<Record<GraphicsImageFormat, string>>;
	/** UI handles used for inverse kinematic posing of the character. */
	inversePosingHandles: InversePosingHandle[];
}
export const GraphicsDefinitionFileSchema: z.ZodType<GraphicsDefinitionFile> = z.object({
	assets: z.partialRecord(AssetIdSchema, AssetGraphicsDefinitionSchema.optional()),
	pointTemplates: z.record(z.string(), PointTemplateSchema),
	imageFormats: z.partialRecord(GraphicsImageFormatSchema, z.string().optional()),
	/** UI handles used for inverse kinematic posing of the character. */
	inversePosingHandles: InversePosingHandleSchema.array(),
});
