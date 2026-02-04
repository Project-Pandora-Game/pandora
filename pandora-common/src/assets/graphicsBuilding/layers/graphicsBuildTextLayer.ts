import { type Immutable } from 'immer';
import type { Logger } from '../../../logging/logger.ts';
import { CloneDeepMutable } from '../../../utility/misc.ts';
import type { GraphicsLayer } from '../../graphics/layer.ts';
import type { GraphicsTextLayer } from '../../graphics/layers/text.ts';
import type { GraphicsSourceTextLayer } from '../../graphicsSource/index.ts';
import type { GraphicsBuildContext, GraphicsBuildContextAssetData } from '../graphicsBuildContext.ts';

export function LoadAssetTextLayer(
	layer: Immutable<GraphicsSourceTextLayer>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextAssetData>>,
	logger: Logger,
): Promise<Immutable<GraphicsLayer[]>> {
	logger = logger.prefixMessages(`[Layer ${layer.name || '[unnamed]'}]`);

	const result: GraphicsTextLayer = {
		x: layer.x,
		y: layer.y,
		width: layer.width,
		height: layer.height,
		type: 'text',
		enableCond: CloneDeepMutable(layer.enableCond),
		priority: layer.priority,
		angle: layer.angle,
		dataModule: layer.dataModule,
		followBone: layer.followBone,
		fontSize: layer.fontSize,
		colorizationKey: layer.colorizationKey,
	};

	const moduleDefinition = context.builtAssetData.modules?.[result.dataModule];
	if (moduleDefinition == null) {
		logger.warning(`Linked module '${result.dataModule}' not found.`);
	} else if (moduleDefinition.type !== 'text') {
		logger.warning(`Linked module '${result.dataModule}' is not a text module.`);
	}

	if (result.followBone != null) {
		const bone = context.getBones().find((b) => b.name === result.followBone);
		if (bone == null) {
			logger.error(`Linked bone '${result.followBone}' not found.`);
			result.followBone = null;
		} else if (bone.x === 0 && bone.y === 0) {
			logger.warning(`Linked bone '${result.followBone}' is not a positioning bone.`);
		}
	}

	if (result.colorizationKey != null && !context.builtAssetData.colorizationKeys.has(result.colorizationKey)) {
		logger.warning(`colorizationKey ${result.colorizationKey} outside of defined colorization keys [${[...context.builtAssetData.colorizationKeys].join(', ')}]`);
	}

	return Promise.resolve<GraphicsLayer[]>([result]);
}
