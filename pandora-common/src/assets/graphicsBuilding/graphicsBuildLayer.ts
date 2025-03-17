import type { Immutable } from 'immer';
import type { Logger } from '../../logging.ts';
import { AssertNever } from '../../utility/misc.ts';
import type { GraphicsLayer } from '../graphics/layer.ts';
import type { GraphicsSourceLayer } from '../graphicsSource/layer.ts';
import type { GraphicsBuildContext } from './graphicsBuildContext.ts';
import { LoadAssetImageLayer } from './graphicsBuildImageLayer.ts';

export async function LoadAssetLayer(layer: Immutable<GraphicsSourceLayer>, context: GraphicsBuildContext, logger: Logger): Promise<Immutable<GraphicsLayer[]>> {
	switch (layer.type) {
		case 'mesh':
		case 'alphaImageMesh':
			return await LoadAssetImageLayer(layer, context, logger);
	}
	AssertNever(layer);
}
