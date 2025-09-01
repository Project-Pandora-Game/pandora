import * as z from 'zod';
import { GraphicsAlphaImageMeshLayerSchema } from './layers/alphaImageMesh.ts';
import { GraphicsMeshLayerSchema } from './layers/mesh.ts';
import { GraphicsTextLayerSchema } from './layers/text.ts';

export const GraphicsLayerSchema = z.discriminatedUnion('type', [
	GraphicsMeshLayerSchema,
	GraphicsAlphaImageMeshLayerSchema,
	GraphicsTextLayerSchema,
]);
export type GraphicsLayer = z.infer<typeof GraphicsLayerSchema>;
export type GraphicsLayerType = GraphicsLayer['type'];
