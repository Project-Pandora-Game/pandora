import { type Immutable } from 'immer';
import type { Logger } from '../../../logging/logger.ts';
import { CloneDeepMutable } from '../../../utility/misc.ts';
import type { RoomDeviceGraphicsLayerText } from '../../graphics/layers/roomDeviceText.ts';
import type { GraphicsSourceRoomDeviceLayerText } from '../../graphicsSource/index.ts';
import type { GraphicsBuildContext, GraphicsBuildContextRoomDeviceData } from '../graphicsBuildContext.ts';

export function LoadAssetRoomDeviceTextLayer(
	layer: Immutable<GraphicsSourceRoomDeviceLayerText>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>,
	logger: Logger,
): Promise<Immutable<RoomDeviceGraphicsLayerText[]>> {
	logger = logger.prefixMessages(`[Layer ${layer.name || '[unnamed]'}]`);

	const result: RoomDeviceGraphicsLayerText = {
		type: 'text',
		enableCond: CloneDeepMutable(layer.enableCond),
		dataModule: layer.dataModule,
		offset: CloneDeepMutable(layer.offset),
		size: CloneDeepMutable(layer.size),
		angle: layer.angle,
		fontSize: layer.fontSize,
		colorizationKey: layer.colorizationKey,
	};

	const moduleDefinition = context.builtAssetData.modules?.[result.dataModule];
	if (moduleDefinition == null) {
		logger.warning(`Linked module '${result.dataModule}' not found.`);
	} else if (moduleDefinition.type !== 'text') {
		logger.warning(`Linked module '${result.dataModule}' is not a text module.`);
	}

	if (result.colorizationKey != null && !context.builtAssetData.colorizationKeys.has(result.colorizationKey)) {
		logger.warning(`colorizationKey ${result.colorizationKey} outside of defined colorization keys [${[...context.builtAssetData.colorizationKeys].join(', ')}]`);
	}

	return Promise.resolve<RoomDeviceGraphicsLayerText[]>([result]);
}
