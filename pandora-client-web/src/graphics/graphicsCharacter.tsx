import { Container } from '@saitonakamura/react-pixi';
import { ArmsPose, AssertNever, AssertNotNullable, AssetId, CharacterSize, CharacterView, CreateAssetPropertiesResult, GetLogger, LayerPriority, MergeAssetProperties } from 'pandora-common';
import { Filter, InteractionEvent, Rectangle } from 'pixi.js';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';
import { GraphicsManagerInstance } from '../assets/graphicsManager';
import { AppearanceContainer, useCharacterAppearanceArmsPose, useCharacterAppearanceItems, useCharacterAppearanceView } from '../character/character';
import { ChildrenProps } from '../common/reactTypes';
import { useObservable } from '../observable';
import { LayerState, LayerStateOverrides, PRIORITY_ORDER_ARMS_BACK, PRIORITY_ORDER_ARMS_FRONT, PRIORITY_ORDER_REVERSE_PRIORITIES } from './def';
import { GraphicsLayerProps, GraphicsLayer } from './graphicsLayer';

export type PointLike = {
	x: number;
	y: number;
};

const logger = GetLogger('GraphicsCharacter');

export interface GraphicsCharacterProps extends ChildrenProps {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	Layer?: (props: GraphicsLayerProps) => ReactElement;
	appearanceContainer: AppearanceContainer;
	position?: PointLike;
	scale?: PointLike;
	pivot?: PointLike;
	hitArea?: Rectangle;
	interactive?: boolean;
	filters?: Filter[];
	zIndex?: number;

	onPointerDown?: (event: InteractionEvent) => void;
	onPointerUp?: (event: InteractionEvent) => void;
	onPointerUpOutside?: (event: InteractionEvent) => void;
	onPointerMove?: (event: InteractionEvent) => void;

	getSortOrder?: LayerGetSortOrder;
}

export type GraphicsGetterFunction = (asset: AssetId) => AssetGraphics | undefined;
export type LayerStateOverrideGetter = (layer: AssetGraphicsLayer) => LayerStateOverrides | undefined;
export type LayerGetSortOrder = (armsPose: ArmsPose, view: CharacterView) => readonly LayerPriority[];

const GetSortOrderDefault: LayerGetSortOrder = (armsPose, view) => {
	const reverse = view === CharacterView.BACK;
	if (armsPose === ArmsPose.FRONT) {
		return reverse ? PRIORITY_ORDER_ARMS_FRONT.slice().reverse() : PRIORITY_ORDER_ARMS_FRONT;
	} else if (armsPose === ArmsPose.BACK) {
		return reverse ? PRIORITY_ORDER_ARMS_BACK.slice().reverse() : PRIORITY_ORDER_ARMS_BACK;
	}
	AssertNever(armsPose);
};

function useLayerPriorityResolver(states: readonly LayerState[]): ReadonlyMap<LayerState, LayerPriority> {
	const calculate = useCallback((layers: readonly LayerState[]) => {
		const result = new Map<LayerState, LayerPriority>();
		for (const layer of layers) {
			result.set(layer, layer.layer.definition.value.priority);
		}
		return result;
	}, []);

	const [actualCalculate, setActualCalculate] = useState<(layers: readonly LayerState[]) => ReadonlyMap<LayerState, LayerPriority>>(() => calculate);

	useEffect(() => {
		const cleanup: (() => void)[] = [];

		for (const state of states) {
			cleanup.push(state.layer.definition.subscribe(() => {
				setActualCalculate(() => (l: readonly LayerState[]) => calculate(l));
			}));
		}

		return () => {
			cleanup.forEach((c) => c());
		};
	}, [calculate, states]);

	return useMemo(() => actualCalculate(states), [actualCalculate, states]);
}

export function GraphicsCharacterWithManager({
	Layer,
	appearanceContainer,
	position: positionOffset = { x: 0, y: 0 },
	scale: scaleExtra,
	pivot: pivotExtra,
	filters,
	onPointerDown,
	onPointerUp,
	onPointerUpOutside,
	onPointerMove,
	children,
	graphicsGetter,
	layerStateOverrideGetter,
	getSortOrder = GetSortOrderDefault,
	...graphicsProps
}: GraphicsCharacterProps & {
	graphicsGetter: GraphicsGetterFunction;
	layerStateOverrideGetter?: LayerStateOverrideGetter;
}): ReactElement {
	const pivot = useMemo<PointLike>(() => (pivotExtra ?? { x: CharacterSize.WIDTH / 2, y: 0 }), [pivotExtra]);
	const position = useMemo<PointLike>(() => ({ x: (pivotExtra ? 0 : pivot.x) + positionOffset.x, y: 0 + positionOffset.y }), [pivot, pivotExtra, positionOffset]);

	const items = useCharacterAppearanceItems(appearanceContainer);

	const layers = useMemo<LayerState[]>(() => {
		const visibleItems = items.slice();
		let properties = CreateAssetPropertiesResult();
		// Walk items in reverse and remove items that are hidden
		for (let i = visibleItems.length - 1; i >= 0; i--) {
			const item = visibleItems[i];

			let visible = true;

			// If this item has any attribute that is hidden, hide it
			visible &&= !Array.from(item.getProperties().attributes)
				.some((a) => properties.hides.has(a));

			// Update known properties
			properties = item.getPropertiesParts().reduce(MergeAssetProperties, properties);

			// Remove this item from rendering altogether, if not visible
			if (!visible) {
				visibleItems.splice(i, 1);
			}
		}

		const result: LayerState[] = [];
		for (const item of visibleItems) {
			const graphics = graphicsGetter(item.asset.id);
			if (!graphics) {
				if (item.asset.definition.hasGraphics) {
					logger.warning(`Asset ${item.asset.id} hasGraphics, but no graphics found`);
				}
				continue;
			}
			result.push(
				...graphics.allLayers.map<LayerState>((layer) => ({
					layer,
					item,
					state: layerStateOverrideGetter?.(layer),
				})),
			);
		}
		return result;
	}, [items, graphicsGetter, layerStateOverrideGetter]);

	const armsPose = useCharacterAppearanceArmsPose(appearanceContainer);
	const view = useCharacterAppearanceView(appearanceContainer);

	const priorities = useLayerPriorityResolver(layers);

	const priorityLayers = useMemo<ReadonlyMap<LayerPriority, ReactElement>>(() => {
		const result = new Map<LayerPriority, ReactElement>();
		for (const layerState of layers) {
			const priority = priorities.get(layerState);
			AssertNotNullable(priority);
			const reverse = PRIORITY_ORDER_REVERSE_PRIORITIES.has(priority) !== (view === CharacterView.BACK);
			const lowerLayer = result.get(priority);
			// eslint-disable-next-line @typescript-eslint/naming-convention
			const LayerElement = Layer ?? GraphicsLayer;

			result.set(priority, (
				<LayerElement
					key={ `${(layerState.item ?? layerState.layer.asset).id}-${layerState.layer.index}` }
					zIndex={ reverse ? 1 : -1 }
					lowerZIndex={ reverse ? 1 : -1 }
					layer={ layerState.layer }
					item={ layerState.item }
					state={ layerState.state }
					appearanceContainer={ appearanceContainer }
				>
					{ lowerLayer }
				</LayerElement>
			));
		}
		return result;
	}, [Layer, appearanceContainer, layers, priorities, view]);

	const scale = useMemo<PointLike>(() => (scaleExtra ?? { x: view === CharacterView.BACK ? -1 : 1, y: 1 }), [view, scaleExtra]);

	const sortOrder = useMemo<readonly LayerPriority[]>(() => getSortOrder(armsPose, view), [getSortOrder, armsPose, view]);

	return (
		<Container
			{ ...graphicsProps }
			pivot={ pivot }
			position={ position }
			scale={ scale }
			sortableChildren
			filters={ filters ?? null }
			pointerdown={ onPointerDown }
			pointerup={ onPointerUp }
			pointerupoutside={ onPointerUpOutside }
			pointermove={ onPointerMove }
		>
			{
				sortOrder.map((priority, i) => {
					const layer = priorityLayers.get(priority);
					return layer ? <Container key={ priority } zIndex={ i }>{ layer }</Container> : null;
				})
			}
			{ children }
		</Container>
	);
}

export function GraphicsCharacter(props: GraphicsCharacterProps): ReactElement | null {
	const manager = useObservable(GraphicsManagerInstance);
	const graphicsGetter = useMemo<GraphicsGetterFunction | undefined>(() => manager?.getAssetGraphicsById.bind(manager), [manager]);

	if (!manager || !graphicsGetter)
		return null;

	return <GraphicsCharacterWithManager { ...props } graphicsGetter={ graphicsGetter } />;
}
