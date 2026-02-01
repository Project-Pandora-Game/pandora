import { freeze, type Immutable } from 'immer';
import type { Logger } from '../../../logging/logger.ts';
import { Assert, AssertNever, CloneDeepMutable, GenerateMultipleListsFullJoin } from '../../../utility/misc.ts';
import type { AtomicCondition } from '../../graphics/conditions.ts';
import type { RoomDeviceGraphicsLayer } from '../../graphics/layer.ts';
import type { LayerImageOverride, RoomDeviceLayerImageSetting } from '../../graphics/layers/common.ts';
import type { GraphicsSourceRoomDeviceAutoSpriteLayer, GraphicsSourceRoomDeviceAutoSpriteLayerVariable, GraphicsSourceRoomDeviceLayerSprite } from '../../graphicsSource/index.ts';
import type { GraphicsBuildContext, GraphicsBuildContextRoomDeviceData } from '../graphicsBuildContext.ts';
import { LoadAssetRoomDeviceSpriteLayer } from './graphicsBuildRoomDeviceSpriteLayer.ts';

export type RoomDeviceAutoSpriteLayerGenerateVariableValue = {
	id: string;
	name: string;
	condition: AtomicCondition[];
};

export function RoomDeviceAutoSpriteLayerGenerateVariableData(
	config: Immutable<GraphicsSourceRoomDeviceAutoSpriteLayerVariable>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>,
	logger?: Logger,
): RoomDeviceAutoSpriteLayerGenerateVariableValue[] {
	if (config.type === 'typedModule') {
		const module = context.builtAssetData.modules?.[config.module];
		if (module == null) {
			logger?.warning(`Unknown module ${config.module}`);
			return [GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT];
		} else if (module.type !== 'typed') {
			logger?.warning(`Module ${config.module} is not typed module`);
			return [GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT];
		}
		return module.variants.map((v): RoomDeviceAutoSpriteLayerGenerateVariableValue => ({
			id: v.id,
			name: v.name,
			condition: [
				{
					module: config.module,
					operator: '=',
					value: v.id,
				},
			],
		}));
	}
	AssertNever(config as never);
}

export const GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT = freeze<RoomDeviceAutoSpriteLayerGenerateVariableValue>({
	id: '',
	name: 'DEFAULT',
	condition: [],
});

export async function LoadRoomDeviceAutoSpriteLayer(
	layer: Immutable<GraphicsSourceRoomDeviceAutoSpriteLayer>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>,
	logger: Logger,
): Promise<Immutable<RoomDeviceGraphicsLayer[]>> {
	logger = logger.prefixMessages(`[Layer ${layer.name || '[unnamed]'}]`);

	const resultLayers: Immutable<GraphicsSourceRoomDeviceLayerSprite>[] = [];
	const variants: RoomDeviceAutoSpriteLayerGenerateVariableValue[][] = [];

	for (const variable of layer.variables) {
		const values = RoomDeviceAutoSpriteLayerGenerateVariableData(variable, context, logger.prefixMessages(`Variable generation:`));
		Assert(values.length > 0, 'Generating variable variants returned empty result');
		variants.push(values);
	}

	const unusedImageMaps = new Set<string>(Object.keys(layer.imageMap));

	// Run through graphical layers and process each of them individually
	for (let i = 0; i < layer.graphicalLayers.length; i++) {
		const graphicalLayer = layer.graphicalLayers[i];
		const imageVariants: LayerImageOverride[] = [];

		const localLogger = logger.prefixMessages(`[Graphical layer '${graphicalLayer.name}']`);

		if (graphicalLayer.imageOverrides != null) {
			imageVariants.push(...CloneDeepMutable(graphicalLayer.imageOverrides));
		}

		let imageSetting: RoomDeviceLayerImageSetting;

		if (variants.length > 0) {
			imageSetting = {
				image: '',
				overrides: imageVariants,
			};

			for (const combination of GenerateMultipleListsFullJoin(variants)) {
				const combinationId = combination.map((c) => c.id).join(':');
				const combinationName = combination.map((c) => c.name).join(' | ');
				// Conditions inside combination are joined with "AND" and we want "AND" across all combinations.
				const combinationCondition: AtomicCondition[] = combination.map((c) => c.condition).flat();

				unusedImageMaps.delete(combinationId);
				const imageLayers: (readonly string[]) | undefined = layer.imageMap[combinationId];
				let image: string;
				if (imageLayers == null) {
					localLogger.warning('Missing mapped image for generated combination', combinationName);
					image = '';
				} else if (imageLayers.length !== layer.graphicalLayers.length) {
					localLogger.warning('Mapped image combination does not match graphical layer count for combination', combinationName);
					image = '';
				} else {
					image = imageLayers[i];
				}

				const overrideVariant: LayerImageOverride = {
					image,
					normalMapImage: (layer.normalMap != null && image) ? `normal_map/${image}` : undefined,
					condition: [combinationCondition],
				};

				if (overrideVariant.image !== imageSetting.image || overrideVariant.normalMapImage !== imageSetting.normalMapImage) {
					// Only include overrides that differ from the base case
					// We can afford to do this, because automesh guarantees that no further overrides can overlap with this one
					imageVariants.push(overrideVariant);
				}
			}

			imageSetting = {
				image: '',
				overrides: imageVariants,
			};
		} else {
			const combinationId = GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT.id;
			const combinationName = GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT.name;

			unusedImageMaps.delete(combinationId);
			const imageLayers: (readonly string[]) | undefined = layer.imageMap[combinationId];
			let image: string;
			if (imageLayers == null) {
				localLogger.warning('Missing mapped image for generated combination', combinationName);
				image = '';
			} else if (imageLayers.length !== layer.graphicalLayers.length) {
				localLogger.warning('Mapped image combination does not match graphical layer count for combination', combinationName);
				image = '';
			} else {
				image = imageLayers[i];
			}

			imageSetting = {
				image,
				normalMapImage: (layer.normalMap != null && image) ? `normal_map/${image}` : undefined,
				overrides: imageVariants,
			};
		}

		resultLayers.push({
			x: layer.x,
			y: layer.y,
			width: layer.width,
			height: layer.height,
			type: 'sprite',
			enableCond: layer.enableCond,
			name: `${layer.name || '[unnamed]'}:${graphicalLayer.name || `#${i + 1}`}`,
			offsetOverrides: layer.offsetOverrides,
			clipToRoom: layer.clipToRoom,
			colorizationKey: graphicalLayer.colorizationKey,
			normalMap: layer.normalMap,
			image: imageSetting.image,
			normalMapImage: imageSetting.normalMapImage,
			imageOverrides: imageSetting.overrides,
		});
	}

	if (unusedImageMaps.size > 0) {
		logger.warning('Following image mappings are unused:', Array.from(unusedImageMaps).join(', '));
	}

	return (await Promise.all(resultLayers.map((l) => LoadAssetRoomDeviceSpriteLayer(
		l,
		context,
		logger.prefixMessages('Autogenerate layer:\n\t'),
	))))
		.flat();
}
