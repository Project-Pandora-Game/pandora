import type { Immutable } from 'immer';
import type { Logger } from '../../logging/logger.ts';
import { AssertNever } from '../../utility/misc.ts';
import type { GraphicsLayer } from '../graphics/layer.ts';
import type { GraphicsSourceLayer } from '../graphicsSource/layer.ts';
import { LoadAssetAutoMeshLayer } from './graphicsBuildAutoMeshLayer.ts';
import type { GraphicsBuildContext } from './graphicsBuildContext.ts';
import { LoadAssetImageLayer } from './graphicsBuildImageLayer.ts';
import { LoadAssetTextLayer } from './graphicsBuildTextLayer.ts';

export async function LoadAssetLayer(layer: Immutable<GraphicsSourceLayer>, context: GraphicsBuildContext, logger: Logger): Promise<Immutable<GraphicsLayer[]>> {
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
