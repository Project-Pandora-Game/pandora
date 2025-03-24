import { z } from 'zod';
import { GraphicsSourceAlphaImageMeshLayerSchema } from './layers/alphaImageMesh.ts';
import { GraphicsSourceMeshLayerSchema } from './layers/mesh.ts';

export const GraphicsSourceLayerSchema = z.discriminatedUnion('type', [
	GraphicsSourceMeshLayerSchema,
	GraphicsSourceAlphaImageMeshLayerSchema,
]);
export type GraphicsSourceLayer = z.infer<typeof GraphicsSourceLayerSchema>;
export type GraphicsSourceLayerType = GraphicsSourceLayer['type'];
