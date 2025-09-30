import { type Immutable } from 'immer';
import type { Logger } from '../../../logging/logger.ts';
import { Assert, CloneDeepMutable } from '../../../utility/misc.ts';
import type { LayerImageOverride } from '../../graphics/layers/common.ts';
import type { RoomDeviceGraphicsLayerSprite } from '../../graphics/layers/roomDeviceSprite.ts';
import type { GraphicsSourceRoomDeviceLayerSprite } from '../../graphicsSource/index.ts';
import type { GraphicsBuildContext, GraphicsBuildContextRoomDeviceData } from '../graphicsBuildContext.ts';
import { LoadLayerImage, type ImageBoundingBox } from '../graphicsBuildImageResource.ts';

export async function LoadAssetRoomDeviceSpriteLayer(
	layer: Immutable<GraphicsSourceRoomDeviceLayerSprite>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>,
	logger: Logger,
): Promise<Immutable<RoomDeviceGraphicsLayerSprite[]>> {
	logger = logger.prefixMessages(`[Layer ${layer.name || '[unnamed]'}]`);

	const images = Array.from(new Set<string>([
		layer.image,
		...(layer.imageOverrides?.map((override) => override.image) ?? []),
	]
		.filter(Boolean),
	));

	const result: RoomDeviceGraphicsLayerSprite = {
		type: 'sprite',
		image: '',
		imageOverrides: undefined,
		colorizationKey: layer.colorizationKey,
		offset: CloneDeepMutable(layer.offset),
		offsetOverrides: CloneDeepMutable(layer.offsetOverrides),
		clipToRoom: layer.clipToRoom,
	};

	let minX = Infinity;
	let minY = Infinity;
	const boundingBoxes = new Map<string, ImageBoundingBox>();
	if (!context.generateOptimizedTextures) {
		// NOOP
		minX = 0;
		minY = 0;
	} else {
		Assert(context.runImageBasedChecks, 'generateOptimizedTextures should only be used with runImageBasedChecks');

		const boundingBoxesCalculation = await Promise.all(
			images.map((i) => context.loadImage(i).getContentBoundingBox().then((box) => [i, box] as const)),
		);
		for (const [image, boundingBox] of boundingBoxesCalculation) {
			boundingBoxes.set(image, boundingBox);

			if (boundingBox.width === 0 || boundingBox.height === 0)
				continue;

			minX = Math.min(minX, boundingBox.left);
			minY = Math.min(minY, boundingBox.top);
		}

		Assert(minX >= 0);
		Assert(minY >= 0);
		if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
			logger.warning('All layer\'s images are empty.');
			minX = 0;
			minY = 0;
		} else {
			result.offset ??= { x: 0, y: 0 };
			result.offset.x += minX;
			result.offset.y += minY;
			for (const override of (result.offsetOverrides ?? [])) {
				override.offset.x += minX;
				override.offset.y += minY;
			}
		}
	}

	function loadLayerImage(image: string, boundingBox?: ImageBoundingBox): string {
		if (boundingBox != null) {
			Assert(minX <= boundingBox.left);
			Assert(minY <= boundingBox.top);

			return LoadLayerImage(image, context, [
				minX / boundingBox.width,
				minY / boundingBox.height,
				boundingBox.rightExclusive / boundingBox.width,
				boundingBox.bottomExclusive / boundingBox.height,
			]);
		}

		return LoadLayerImage(image, context, null);
	}

	result.image = layer.image && loadLayerImage(layer.image, boundingBoxes.get(layer.image));
	result.imageOverrides = layer.imageOverrides
		?.map((override): LayerImageOverride => ({
			...CloneDeepMutable(override),
			image: override.image && loadLayerImage(override.image, boundingBoxes.get(override.image)),
		}));

	if (result.colorizationKey != null && !context.builtAssetData.colorizationKeys.has(result.colorizationKey)) {
		logger.warning(`colorizationKey ${result.colorizationKey} outside of defined colorization keys [${[...context.builtAssetData.colorizationKeys].join(', ')}]`);
	}

	return Promise.resolve<RoomDeviceGraphicsLayerSprite[]>([result]);
}
