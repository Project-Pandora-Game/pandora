import { z } from 'zod';
import { GraphicsMeshLayerSchema } from './layers/mesh.ts';
import { GraphicsAlphaImageMeshLayerSchema } from './layers/alphaImageMesh.ts';

export const GraphicsLayerSchema = z.discriminatedUnion('type', [
	GraphicsMeshLayerSchema,
	GraphicsAlphaImageMeshLayerSchema,
]);
export type GraphicsLayer = z.infer<typeof GraphicsLayerSchema>;
export type GraphicsLayerType = GraphicsLayer['type'];
