import { type Immutable } from 'immer';
import type { Logger } from '../../../logging/logger.ts';
import { CloneDeepMutable } from '../../../utility/misc.ts';
import type { RoomDeviceGraphicsLayerSlot } from '../../graphics/layers/roomDeviceSlot.ts';
import type { GraphicsSourceRoomDeviceLayerSlot } from '../../graphicsSource/index.ts';
import type { GraphicsBuildContext, GraphicsBuildContextRoomDeviceData } from '../graphicsBuildContext.ts';

export function LoadAssetRoomDeviceSlotLayer(
	layer: Immutable<GraphicsSourceRoomDeviceLayerSlot>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>,
	logger: Logger,
): Promise<Immutable<RoomDeviceGraphicsLayerSlot[]>> {
	logger = logger.prefixMessages(`[Layer ${layer.name || '[unnamed]'}]`);

	const result: RoomDeviceGraphicsLayerSlot = {
		type: 'slot',
		enableCond: CloneDeepMutable(layer.enableCond),
		slot: layer.slot,
		characterPosition: CloneDeepMutable(layer.characterPosition),
		characterPositionOverrides: CloneDeepMutable(layer.characterPositionOverrides),
	};

	if (!context.builtAssetData.slotIds.has(result.slot)) {
		logger.error(`Links to unknown slot '${result.slot}'`);
	}

	return Promise.resolve<RoomDeviceGraphicsLayerSlot[]>([result]);
}
