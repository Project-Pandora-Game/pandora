import { freeze, type Immutable } from 'immer';
import { capitalize } from 'lodash-es';
import type { Logger } from '../../../logging/logger.ts';
import { Assert, AssertNever, CloneDeepMutable, GenerateMultipleListsFullJoin } from '../../../utility/misc.ts';
import { ArmFingersSchema, ArmRotationSchema, CharacterViewSchema, LegsPoseSchema, type AtomicCondition } from '../../graphics/conditions.ts';
import type { GraphicsLayer } from '../../graphics/layer.ts';
import { LayerMirror, type LayerImageOverride, type LayerImageSetting } from '../../graphics/layers/common.ts';
import type { GraphicsSourceAutoMeshLayer, GraphicsSourceAutoMeshLayerVariable, GraphicsSourceMeshLayer } from '../../graphicsSource/index.ts';
import { BONE_MAX, BONE_MIN } from '../../state/characterStatePose.ts';
import type { GraphicsBuildContext, GraphicsBuildContextAssetData } from '../graphicsBuildContext.ts';
import { LoadAssetImageLayer } from './graphicsBuildImageLayer.ts';

export type AutoMeshLayerGenerateVariableValue = {
	id: string;
	name: string;
	condition: AtomicCondition[];
};

export function AutoMeshLayerGenerateVariableData(
	config: Immutable<GraphicsSourceAutoMeshLayerVariable>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextAssetData>>,
	logger?: Logger,
): AutoMeshLayerGenerateVariableValue[] {
	if (config.type === 'bone') {
		let currentOpen = BONE_MIN;
		return [...config.stops, BONE_MAX + 1]
			.toSorted((a, b) => a - b)
			.map((stop): AutoMeshLayerGenerateVariableValue => {
				const start = currentOpen;
				const end = stop - 1;
				currentOpen = stop;
				return {
					id: start.toString(10),
					name: (start === end) ? `${config.bone}=${start}` : `${config.bone} ∈〈${start},${end}〉`,
					condition: (start === end) ? [{ bone: config.bone, operator: '=', value: start }] :
						[
							{ bone: config.bone, operator: '>=', value: start },
							{ bone: config.bone, operator: '<', value: stop },
						],
				};
			});
	} else if (config.type === 'typedModule') {
		const module = context.builtAssetData.modules?.[config.module];
		if (module == null) {
			logger?.warning(`Unknown module ${config.module}`);
			return [GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT];
		} else if (module.type !== 'typed') {
			logger?.warning(`Module ${config.module} is not typed module`);
			return [GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT];
		}
		return module.variants.map((v): AutoMeshLayerGenerateVariableValue => ({
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
	} else if (config.type === 'attribute') {
		return [
			{
				id: config.attribute,
				name: config.attribute,
				condition: [{ attribute: config.attribute }],
			},
			{
				id: '!' + config.attribute,
				name: 'Not ' + config.attribute,
				condition: [{ attribute: '!' + config.attribute }],
			},
		];
	} else if (config.type === 'view') {
		return CharacterViewSchema.options.map((o): AutoMeshLayerGenerateVariableValue => ({
			id: o,
			name: capitalize(o),
			condition: [{ view: o }],
		}));
	} else if (config.type === 'armRotation') {
		return ArmRotationSchema.options.map((o): AutoMeshLayerGenerateVariableValue => ({
			id: o,
			name: capitalize(config.side) + ' arm ' + o,
			condition: [{
				armType: 'rotation',
				side: config.side,
				operator: '=',
				value: o,
			}],
		}));
	} else if (config.type === 'armFingers') {
		return ArmFingersSchema.options.map((o): AutoMeshLayerGenerateVariableValue => ({
			id: o,
			name: capitalize(config.side) + ' arm fingers ' + o,
			condition: [{
				armType: 'fingers',
				side: config.side,
				operator: '=',
				value: o,
			}],
		}));
	} else if (config.type === 'legsState') {
		return LegsPoseSchema.options.map((o): AutoMeshLayerGenerateVariableValue => ({
			id: o,
			name: capitalize(o),
			condition: [{ legs: o }],
		}));
	} else if (config.type === 'blink') {
		return [false, true].map((o): AutoMeshLayerGenerateVariableValue => ({
			id: o ? 'blink' : '!blink',
			name: o ? 'Eyes blink' : 'Eyes normal',
			condition: [{ blinking: o }],
		}));
	}
	AssertNever(config);
}

export const GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT = freeze<AutoMeshLayerGenerateVariableValue>({
	id: '',
	name: 'DEFAULT',
	condition: [],
});

export async function LoadAssetAutoMeshLayer(
	layer: Immutable<GraphicsSourceAutoMeshLayer>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextAssetData>>,
	logger: Logger,
): Promise<Immutable<GraphicsLayer[]>> {
	logger = logger.prefixMessages(`[Layer ${layer.name || '[unnamed]'}]`);

	// Short circuit to allow for not-yet-configured layers
	if (!layer.points || !layer.automeshTemplate) {
		logger.warning('Layer is empty');
		return [];
	}

	const pointTemplate = context.getPointTemplate(layer.points);
	if (pointTemplate == null) {
		throw new Error(`Layer ${layer.name ?? '[unnamed]'} refers to unknown template '${layer.points}'`);
	}

	const automeshTemplate = pointTemplate.automeshTemplates?.[layer.automeshTemplate];
	const resultLayers: Immutable<GraphicsSourceMeshLayer>[] = [];

	if (automeshTemplate == null) {
		throw new Error(`Layer ${layer.name || '[unnamed]'} refers to unknown automesh template '${layer.automeshTemplate}'`);
	}

	const variants: AutoMeshLayerGenerateVariableValue[][] = [];

	for (const variable of layer.variables) {
		const values = AutoMeshLayerGenerateVariableData(variable, context, logger.prefixMessages(`Variable generation:`));
		Assert(values.length > 0, 'Generating variable variants returned empty result');
		variants.push(values);
	}

	const unusedImageMaps = new Set<string>(Object.keys(layer.imageMap));

	// Run through automesh template parts and process each of them individually
	for (const templatePart of automeshTemplate.parts) {
		if (layer.disabledTemplateParts?.includes(templatePart.id))
			continue;

		for (let i = 0; i < layer.graphicalLayers.length; i++) {
			const graphicalLayer = layer.graphicalLayers[i];
			const imageVariants: LayerImageOverride[] = [];

			const localLogger = logger.prefixMessages(`[Part ${templatePart.id}, Graphical layer '${graphicalLayer.name}']`);

			if (graphicalLayer.imageOverrides != null) {
				imageVariants.push(...CloneDeepMutable(graphicalLayer.imageOverrides));
			}

			let imageSetting: LayerImageSetting;

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
				const combinationId = GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT.id;
				const combinationName = GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT.name;

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
				type: 'mesh',
				name: `${layer.name || '[unnamed]'}:${templatePart.id}:${graphicalLayer.name || `#${i + 1}`}`,
				priority: templatePart.priority,
				points: layer.points,
				pointType: templatePart.pointType,
				previewOverrides: graphicalLayer.previewOverrides,
				mirror: templatePart.mirror ?? LayerMirror.NONE,
				colorizationKey: graphicalLayer.colorizationKey,
				normalMap: layer.normalMap,
				image: imageSetting,
			});
		}
	}

	if (unusedImageMaps.size > 0) {
		logger.warning('Following image mappings are unused:', Array.from(unusedImageMaps).join(', '));
	}

	return (await Promise.all(resultLayers.map((l) => LoadAssetImageLayer(
		l,
		context,
		logger.prefixMessages('Autogenerate layer:\n\t'),
		{ allowUnusedPointTypes: true },
	))))
		.flat();
}
