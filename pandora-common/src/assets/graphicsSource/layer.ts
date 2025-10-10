import * as z from 'zod';
import { GraphicsSourceAlphaImageMeshLayerSchema } from './layers/alphaImageMesh.ts';
import { GraphicsSourceAutoMeshLayerSchema } from './layers/autoMesh.ts';
import { GraphicsSourceMeshLayerSchema } from './layers/mesh.ts';
import { GraphicsSourceRoomDeviceLayerMeshSchema } from './layers/roomDeviceMesh.ts';
import { GraphicsSourceRoomDeviceLayerSlotSchema } from './layers/roomDeviceSlot.ts';
import { GraphicsSourceRoomDeviceLayerSpriteSchema } from './layers/roomDeviceSprite.ts';
import { GraphicsSourceRoomDeviceLayerTextSchema } from './layers/roomDeviceText.ts';
import { GraphicsSourceTextLayerSchema } from './layers/text.ts';

export const GraphicsSourceLayerSchema = z.discriminatedUnion('type', [
	GraphicsSourceMeshLayerSchema,
	GraphicsSourceAlphaImageMeshLayerSchema,
	GraphicsSourceAutoMeshLayerSchema,
	GraphicsSourceTextLayerSchema,
]);
export type GraphicsSourceLayer = z.infer<typeof GraphicsSourceLayerSchema>;
export type GraphicsSourceLayerType = GraphicsSourceLayer['type'];

export const GraphicsSourceRoomDeviceLayerSchema = z.discriminatedUnion('type', [
	GraphicsSourceRoomDeviceLayerSpriteSchema,
	GraphicsSourceRoomDeviceLayerSlotSchema,
	GraphicsSourceRoomDeviceLayerTextSchema,
	GraphicsSourceRoomDeviceLayerMeshSchema,
]);
export type GraphicsSourceRoomDeviceLayer = z.infer<typeof GraphicsSourceRoomDeviceLayerSchema>;
export type GraphicsSourceRoomDeviceLayerType = GraphicsSourceRoomDeviceLayer['type'];
