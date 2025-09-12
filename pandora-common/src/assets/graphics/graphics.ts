import * as z from 'zod';
import { AssetIdSchema } from '../base.ts';
import type { BoneType } from './conditions.ts';
import { InversePosingHandleSchema } from './inversePosing.ts';
import { GraphicsLayerSchema } from './layer.ts';
import { PointTemplateSchema } from './points.ts';

export const CharacterSize = {
	WIDTH: 1000,
	HEIGHT: 1500,
} as const;

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

export const AssetGraphicsDefinitionSchema = z.object({
	layers: GraphicsLayerSchema.array(),
}).strict();
export type AssetGraphicsDefinition = z.infer<typeof AssetGraphicsDefinitionSchema>;

export const GraphicsImageFormatSchema = z.enum(['avif', 'webp']);
export type GraphicsImageFormat = z.infer<typeof GraphicsImageFormatSchema>;

export const GraphicsDefinitionFileSchema = z.object({
	assets: z.partialRecord(AssetIdSchema, AssetGraphicsDefinitionSchema.optional()),
	pointTemplates: z.record(z.string(), PointTemplateSchema),
	imageFormats: z.partialRecord(GraphicsImageFormatSchema, z.string().optional()),
	/** UI handles used for inverse kinematic posing of the character. */
	inversePosingHandles: InversePosingHandleSchema.array(),
});

export type GraphicsDefinitionFile = z.infer<typeof GraphicsDefinitionFileSchema>;
