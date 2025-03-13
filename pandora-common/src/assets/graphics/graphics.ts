import { z } from 'zod';
import type { AssetId } from '../base.ts';
import { type BoneType } from './conditions.ts';
import { AlphaImageMeshLayerDefinitionSchema } from './layers/alphaImageMesh.ts';
import { MeshLayerDefinitionSchema } from './layers/mesh.ts';
import { type PointTemplate } from './points.ts';

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

export const LayerDefinitionSchema = z.discriminatedUnion('type', [
	MeshLayerDefinitionSchema,
	AlphaImageMeshLayerDefinitionSchema,
]);
export type LayerDefinition = z.infer<typeof LayerDefinitionSchema>;
export type GraphicsLayerType = LayerDefinition['type'];

export const AssetGraphicsDefinitionSchema = z.object({
	layers: z.array(LayerDefinitionSchema),
}).strict();
export type AssetGraphicsDefinition = z.infer<typeof AssetGraphicsDefinitionSchema>;

export interface AssetsGraphicsDefinitionFile {
	assets: Record<AssetId, AssetGraphicsDefinition>;
	pointTemplates: Record<string, PointTemplate>;
	imageFormats: Partial<Record<'avif' | 'webp', string>>;
}
