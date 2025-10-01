import { type Immutable } from 'immer';
import type { Logger } from '../../../logging/logger.ts';
import { BitField } from '../../../utility/bitfield.ts';
import { AssertNever, CloneDeepMutable } from '../../../utility/misc.ts';
import type { RoomDeviceGraphicsLayerMesh } from '../../graphics/layers/roomDeviceMesh.ts';
import type { GraphicsSourceRoomDeviceLayerMesh } from '../../graphicsSource/layers/roomDeviceMesh.ts';
import type { GraphicsBuildContext, GraphicsBuildContextRoomDeviceData } from '../graphicsBuildContext.ts';
import { LoadLayerImage } from '../graphicsBuildImageResource.ts';

export async function LoadAssetRoomDeviceMeshLayer(
	layer: Immutable<GraphicsSourceRoomDeviceLayerMesh>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>,
	logger: Logger,
): Promise<Immutable<RoomDeviceGraphicsLayerMesh[]>> {
	logger = logger.prefixMessages(`[Layer ${layer.name || '[unnamed]'}]`);

	if (layer.geometry.type === '2d') {
		const vertices = Math.floor(layer.geometry.positions.length / 2);

		if (layer.geometry.positions.length !== (2 * vertices)) {
			logger.error('Layer defines odd number of positions');
		}
		if (layer.geometry.uvs.length !== (2 * vertices)) {
			logger.error(`Layer defines wrong number of uv coordinates (${2 * vertices} expected, got ${layer.geometry.uvs.length})`);
		}
		if (layer.geometry.indices.length < 1) {
			logger.warning('Layer does not define any indices - result will be empty');
		}

		const usedVertices = new BitField(vertices);

		if (layer.geometry.topology === 'triangle-list') {
			if ((layer.geometry.indices.length % 3) !== 0) {
				logger.error('Triangle list topology requires three indices per triangle');
			}
			for (const index of layer.geometry.indices) {
				if (!Number.isSafeInteger(index) || index < 0 || index >= vertices) {
					logger.error('Invalid index:', index);
				} else {
					usedVertices.set(index, true);
				}
			}
		} else {
			AssertNever(layer.geometry.topology);
		}

		const unusedVertices: number[] = [];
		for (let i = 0; i < vertices; i++) {
			if (!usedVertices.get(i)) {
				unusedVertices.push(i);
			}

			const u = layer.geometry.uvs[i];
			const v = layer.geometry.uvs[i];
			if (!(u >= 0 && u <= 0)) {
				logger.warning(`Vertex ${i} has U coordinate outside of expected range <0, 1>:`, u);
			}
			if (!(v >= 0 && v <= 0)) {
				logger.warning(`Vertex ${i} has V coordinate outside of expected range <0, 1>:`, v);
			}
		}
		if (unusedVertices.length > 0) {
			logger.warning('The following vertices are not used by the mesh:', unusedVertices);
		}
	} else {
		AssertNever(layer.geometry.type);
	}

	const result: RoomDeviceGraphicsLayerMesh = {
		type: 'mesh',
		geometry: CloneDeepMutable(layer.geometry),
		colorizationKey: layer.colorizationKey,
		normalMap: CloneDeepMutable(layer.normalMap),
		image: {
			image: layer.image.image && LoadLayerImage(layer.image.image, context, null),
			normalMapImage: layer.image.normalMapImage && LoadLayerImage(layer.image.normalMapImage, context, null),
			overrides: layer.image.overrides?.map((override) => ({
				image: override.image && LoadLayerImage(override.image, context, null),
				normalMapImage: override.normalMapImage && LoadLayerImage(override.normalMapImage, context, null),
				condition: CloneDeepMutable(override.condition),
			})),
		},
		clipToRoom: layer.clipToRoom,
	};

	if (result.colorizationKey != null && !context.builtAssetData.colorizationKeys.has(result.colorizationKey)) {
		logger.warning(`colorizationKey ${result.colorizationKey} outside of defined colorization keys [${[...context.builtAssetData.colorizationKeys].join(', ')}]`);
	}

	return Promise.resolve<RoomDeviceGraphicsLayerMesh[]>([result]);
}
