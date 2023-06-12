import { Container } from '@pixi/react';
import { AssertNotNullable, AssetFrameworkCharacterState, AssetId, CharacterArmsPose, CharacterSize, CharacterView, CreateAssetPropertiesResult, GetLogger, MergeAssetProperties } from 'pandora-common';
import { FederatedPointerEvent, Filter, Rectangle } from 'pixi.js';
import * as PIXI from 'pixi.js';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';
import { GraphicsManagerInstance } from '../assets/graphicsManager';
import { useCharacterAppearanceArmsPose, useCharacterAppearanceItems, useCharacterAppearanceView } from '../character/character';
import { ChildrenProps } from '../common/reactTypes';
import { useObservable } from '../observable';
import { ComputedLayerPriority, COMPUTED_LAYER_ORDERING, ComputeLayerPriority, LayerState, LayerStateOverrides, PRIORITY_ORDER_REVERSE_PRIORITIES } from './def';
import { GraphicsLayerProps, GraphicsLayer, SwapCullingDirection } from './graphicsLayer';

export type PointLike = {
	x: number;
	y: number;
};

const logger = GetLogger('GraphicsCharacter');

export interface GraphicsCharacterProps extends ChildrenProps {
	layer?: (props: GraphicsLayerProps) => ReactElement;
	characterState: AssetFrameworkCharacterState;
	position?: PointLike;
	scale?: PointLike;
	pivot?: PointLike;
	hitArea?: Rectangle;
	eventMode?: PIXI.EventMode;
	filters?: readonly Filter[];
	zIndex?: number;

	onPointerDown?: (event: FederatedPointerEvent) => void;
	onPointerUp?: (event: FederatedPointerEvent) => void;
	onPointerUpOutside?: (event: FederatedPointerEvent) => void;
	onPointerMove?: (event: FederatedPointerEvent) => void;

	getSortOrder?: LayerGetSortOrder;
}

export type GraphicsGetterFunction = (asset: AssetId) => AssetGraphics | undefined;
export type LayerStateOverrideGetter = (layer: AssetGraphicsLayer) => LayerStateOverrides | undefined;
export type LayerGetSortOrder = (view: CharacterView) => readonly ComputedLayerPriority[];

const GetSortOrderDefault: LayerGetSortOrder = (view) => {
	const reverse = view === 'back';
	return reverse ? COMPUTED_LAYER_ORDERING.slice().reverse() : COMPUTED_LAYER_ORDERING;
};

function useLayerPriorityResolver(states: readonly LayerState[], armsPose: CharacterArmsPose): ReadonlyMap<LayerState, ComputedLayerPriority> {
	const calculate = useCallback((layers: readonly LayerState[]) => {
		const result = new Map<LayerState, ComputedLayerPriority>();
		for (const layer of layers) {
			result.set(layer, ComputeLayerPriority(layer.layer.definition.value.priority, armsPose, layer.layer.isMirror));
		}
		return result;
	}, [armsPose]);

	const [actualCalculate, setActualCalculate] = useState<(layers: readonly LayerState[]) => ReadonlyMap<LayerState, ComputedLayerPriority>>(() => calculate);

	useEffect(() => {
		const cleanup: (() => void)[] = [];
		setActualCalculate(() => calculate);

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

function GraphicsCharacterWithManagerImpl({
	layer: Layer,
	characterState,
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
}, ref: React.ForwardedRef<PIXI.Container>): ReactElement {
	const pivot = useMemo<PointLike>(() => (pivotExtra ?? { x: CharacterSize.WIDTH / 2, y: 0 }), [pivotExtra]);
	const position = useMemo<PointLike>(() => ({ x: (pivotExtra ? 0 : pivot.x) + positionOffset.x, y: 0 + positionOffset.y }), [pivot, pivotExtra, positionOffset]);

	const items = useCharacterAppearanceItems(characterState);

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

	const armsPose = useCharacterAppearanceArmsPose(characterState);
	const view = useCharacterAppearanceView(characterState);

	const priorities = useLayerPriorityResolver(layers, armsPose);

	const priorityLayers = useMemo<ReadonlyMap<ComputedLayerPriority, ReactElement>>(() => {
		const result = new Map<ComputedLayerPriority, ReactElement>();
		for (const layerState of layers) {
			const priority = priorities.get(layerState);
			AssertNotNullable(priority);
			const reverse = PRIORITY_ORDER_REVERSE_PRIORITIES.has(priority) !== (view === 'back');
			const lowerLayer = result.get(priority);
			const LayerElement = Layer ?? GraphicsLayer;

			result.set(priority, (
				<LayerElement
					key={ `${(layerState.item ?? layerState.layer.asset).id}-${layerState.layer.index}` }
					zIndex={ reverse ? 1 : -1 }
					lowerZIndex={ reverse ? 1 : -1 }
					layer={ layerState.layer }
					item={ layerState.item }
					state={ layerState.state }
					characterState={ characterState }
				>
					{ lowerLayer }
				</LayerElement>
			));
		}
		return result;
	}, [Layer, characterState, layers, priorities, view]);

	const scale = useMemo<PointLike>(() => (scaleExtra ?? { x: view === 'back' ? -1 : 1, y: 1 }), [view, scaleExtra]);

	const sortOrder = useMemo<readonly ComputedLayerPriority[]>(() => getSortOrder(view), [getSortOrder, view]);

	const actualFilters = useMemo<PIXI.Filter[] | null>(() => filters?.slice() ?? null, [filters]);

	return (
		<Container
			{ ...graphicsProps }
			ref={ ref }
			pivot={ pivot }
			position={ position }
			scale={ scale }
			sortableChildren
			filters={ actualFilters }
			pointerdown={ onPointerDown }
			pointerup={ onPointerUp }
			pointerupoutside={ onPointerUpOutside }
			pointermove={ onPointerMove }
			cursor='pointer'
		>
			<SwapCullingDirection uniqueKey='filter' swap={ filters != null && filters.length > 0 }>
				<SwapCullingDirection swap={ (scale.x >= 0) !== (scale.y >= 0) }>
					{
						sortOrder.map((priority, i) => {
							const layer = priorityLayers.get(priority);
							return layer ? <Container key={ priority } zIndex={ i }>{ layer }</Container> : null;
						})
					}
					{ children }
				</SwapCullingDirection>
			</SwapCullingDirection>
		</Container>
	);
}

export const GraphicsCharacterWithManager = React.forwardRef(GraphicsCharacterWithManagerImpl);

function GraphicsCharacterImpl(props: GraphicsCharacterProps, ref: React.ForwardedRef<PIXI.Container>): ReactElement | null {
	const manager = useObservable(GraphicsManagerInstance);
	const graphicsGetter = useMemo<GraphicsGetterFunction | undefined>(() => manager?.getAssetGraphicsById.bind(manager), [manager]);

	if (!manager || !graphicsGetter)
		return null;

	return <GraphicsCharacterWithManager { ...props } graphicsGetter={ graphicsGetter } ref={ ref } />;
}

export const GraphicsCharacter = React.forwardRef(GraphicsCharacterImpl);
