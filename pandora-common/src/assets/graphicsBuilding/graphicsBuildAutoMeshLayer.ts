import { freeze, type Immutable } from 'immer';
import type { Logger } from '../../logging/logger.ts';
import { Assert, AssertNever, CloneDeepMutable, GenerateMultipleListsFullJoin } from '../../utility/misc.ts';
import type { AtomicCondition } from '../graphics/conditions.ts';
import type { GraphicsLayer } from '../graphics/layer.ts';
import { LayerMirror, type LayerImageOverride } from '../graphics/layers/common.ts';
import type { GraphicsSourceAutoMeshLayer, GraphicsSourceAutoMeshLayerVariable, GraphicsSourceMeshLayer } from '../graphicsSource/index.ts';
import type { GraphicsBuildContext } from './graphicsBuildContext.ts';
import { LoadAssetImageLayer } from './graphicsBuildImageLayer.ts';

export type AutoMeshLayerGenerateVariableValue = {
	id: string;
	name: string;
	condition: AtomicCondition[];
};

export function AutoMeshLayerGenerateVariableData(config: Immutable<GraphicsSourceAutoMeshLayerVariable>, context: GraphicsBuildContext, logger?: Logger): AutoMeshLayerGenerateVariableValue[] {
	if (config.type === 'typedModule') {
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
	}
	AssertNever(config.type);
}

export const GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT = freeze<AutoMeshLayerGenerateVariableValue>({
	id: '',
	name: 'DEFAULT',
	condition: [],
});

export async function LoadAssetAutoMeshLayer(
	layer: Immutable<GraphicsSourceAutoMeshLayer>,
	context: GraphicsBuildContext,
	logger: Logger,
): Promise<Immutable<GraphicsLayer[]>> {
	logger = logger.prefixMessages(`[Layer ${layer.name || '[unnamed]'}]`);

	// Short circuit to allow for not-yet-configured layers
	if (!layer.automeshTemplate) {
		logger.warning('Layer is empty');
		return [];
	}

	const automeshTemplate = context.getAutomeshTemplate(layer.automeshTemplate);
	const resultLayers: Immutable<GraphicsSourceMeshLayer>[] = [];

	if (automeshTemplate == null) {
		throw new Error(`Layer ${layer.name || '[unnamed]'} refers to unknown automesh template '${layer.automeshTemplate}'`);
	}

	// Validate points early to avoid confusing errors
	if (context.getPointTemplate(automeshTemplate.points) == null) {
		throw new Error(`Automesh template ${layer.automeshTemplate} refers to unknown point template '${automeshTemplate.points}'`);
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

			for (const combination of (variants.length > 0 ? GenerateMultipleListsFullJoin(variants) : [[GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT]])) {
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

				imageVariants.push({
					image,
					condition: [combinationCondition],
				});
			}

			resultLayers.push({
				x: layer.x,
				y: layer.y,
				width: layer.width,
				height: layer.height,
				type: 'mesh',
				name: `${layer.name || '[unnamed]'}:${templatePart.id}:${graphicalLayer.name || `#${i + 1}`}`,
				priority: templatePart.priority,
				points: automeshTemplate.points,
				pointType: templatePart.pointType,
				mirror: templatePart.mirror ?? LayerMirror.NONE,
				colorizationKey: graphicalLayer.colorizationKey,
				image: {
					image: '',
					overrides: imageVariants,
				},
			});
		}
	}

	if (unusedImageMaps.size > 0) {
		logger.warning('Following image mappings are unused:', Array.from(unusedImageMaps).join(', '));
	}

	return (await Promise.all(resultLayers.map((l) => LoadAssetImageLayer(l, context, logger.prefixMessages('Autogenerate layer:\n\t')))))
		.flat();
}
