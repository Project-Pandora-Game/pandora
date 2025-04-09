import { z } from 'zod';
import { GraphicsSourceAlphaImageMeshLayerSchema } from './layers/alphaImageMesh.ts';
import { GraphicsSourceAutoMeshLayerSchema } from './layers/autoMesh.ts';
import { GraphicsSourceMeshLayerSchema } from './layers/mesh.ts';

export const GraphicsSourceLayerSchema = z.discriminatedUnion('type', [
	GraphicsSourceMeshLayerSchema,
	GraphicsSourceAlphaImageMeshLayerSchema,
	GraphicsSourceAutoMeshLayerSchema,
]);
export type GraphicsSourceLayer = z.infer<typeof GraphicsSourceLayerSchema>;
export type GraphicsSourceLayerType = GraphicsSourceLayer['type'];
