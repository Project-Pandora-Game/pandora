import type { Immutable } from 'immer';
import type { Logger } from '../../logging/logger.ts';
import { AssertNever } from '../../utility/misc.ts';
import type { GraphicsLayer, RoomDeviceGraphicsLayer } from '../graphics/layer.ts';
import type { GraphicsSourceLayer, GraphicsSourceRoomDeviceLayer } from '../graphicsSource/layer.ts';
import type { GraphicsBuildContext, GraphicsBuildContextAssetData, GraphicsBuildContextRoomDeviceData } from './graphicsBuildContext.ts';
import { LoadAssetAutoMeshLayer } from './layers/graphicsBuildAutoMeshLayer.ts';
import { LoadAssetImageLayer } from './layers/graphicsBuildImageLayer.ts';
import { LoadRoomDeviceAutoSpriteLayer } from './layers/graphicsBuildRoomDeviceAutoSpriteLayer.ts';
import { LoadAssetRoomDeviceMeshLayer } from './layers/graphicsBuildRoomDeviceMeshLayer.ts';
import { LoadAssetRoomDeviceSlotLayer } from './layers/graphicsBuildRoomDeviceSlotLayer.ts';
import { LoadAssetRoomDeviceSpriteLayer } from './layers/graphicsBuildRoomDeviceSpriteLayer.ts';
import { LoadAssetRoomDeviceTextLayer } from './layers/graphicsBuildRoomDeviceTextLayer.ts';
import { LoadAssetTextLayer } from './layers/graphicsBuildTextLayer.ts';

export async function LoadAssetLayer(
	layer: Immutable<GraphicsSourceLayer>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextAssetData>>,
	logger: Logger,
): Promise<Immutable<GraphicsLayer[]>> {
	switch (layer.type) {
		case 'mesh':
		case 'alphaImageMesh':
			return await LoadAssetImageLayer(layer, context, logger);
		case 'autoMesh':
			return await LoadAssetAutoMeshLayer(layer, context, logger);
		case 'text':
			return await LoadAssetTextLayer(layer, context, logger);
	}
	AssertNever(layer);
}

export async function LoadAssetRoomDeviceLayer(
	layer: Immutable<GraphicsSourceRoomDeviceLayer>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>,
	logger: Logger,
): Promise<Immutable<RoomDeviceGraphicsLayer[]>> {
	switch (layer.type) {
		case 'sprite':
			return await LoadAssetRoomDeviceSpriteLayer(layer, context, logger);
		case 'autoSprite':
			return await LoadRoomDeviceAutoSpriteLayer(layer, context, logger);
		case 'slot':
			return await LoadAssetRoomDeviceSlotLayer(layer, context, logger);
		case 'text':
			return await LoadAssetRoomDeviceTextLayer(layer, context, logger);
		case 'mesh':
			return await LoadAssetRoomDeviceMeshLayer(layer, context, logger);
	}
	AssertNever(layer);
}
